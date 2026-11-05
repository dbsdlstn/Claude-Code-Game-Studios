// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// 묶음 빌드(build.py → dist/m1) E2E: node --test prototypes/m1-timeline/tests/e2e-dist.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { CONFIG } from '../js/config.js';
import { FULL, FULL_BY_ID, FULL_INFO } from './helpers.mjs';
import { chromium, VIEWPORTS, REPO_ROOT, PROTO_ROOT, REAL, REAL_BY_ID, currentCard, gapsFor, pressGap, expectedAnchorYears } from './helpers.mjs';

const DIST = path.join(REPO_ROOT, 'dist', 'm1');

test('dist/m1만으로 실제 초안을 읽고 모바일에서 한 장 꽂기, 실패한 요청 없음', { skip: !REAL && '초안 없음' }, async () => {
  const r = spawnSync('python3', [path.join(PROTO_ROOT, 'build.py')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(path.join(DIST, 'data', 'cards', 'goguryeo-m1.json')));
  assert.ok(existsSync(path.join(DIST, 'data', 'decks.json')));
  assert.equal(existsSync(path.join(DIST, 'tests')), false);
  assert.doesNotMatch(readFileSync(path.join(DIST, 'js', 'config.js'), 'utf8'), /\.\.\/\.\.\/assets/);

  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', DIST], { stdio: 'ignore' });
  const browser = await chromium.launch();
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/index.html`)).ok) break; } catch { /* 대기 */ } await new Promise((x) => setTimeout(x, 100)); }
    const ctx = await browser.newContext(VIEWPORTS.mobile);
    const page = await ctx.newPage();
    const failed = [];
    const errors = [];
    page.on('response', (res) => { if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/index.html?seed=11&intro=0&title=0`);
    await page.waitForSelector('body[data-ready="true"]');
    assert.ok((await page.innerText('#data-info')).includes(FULL_INFO), await page.innerText('#data-info'));
    assert.match(await page.innerText('#data-warn'), /사실 확인 전/);
    assert.deepEqual(await page.locator('#timeline .row-anchor .row-year').allInnerTexts(), expectedAnchorYears(FULL));
    const card = await currentCard(page, FULL_BY_ID);
    await pressGap(page, (await gapsFor(page, card)).right, true);
    assert.equal(await page.getAttribute('#result', 'data-result'), 'correct');
    // M2: 타이틀 화면과 덱 목록(data/decks.json)도 묶음만으로
    await page.goto(`http://127.0.0.1:${port}/index.html?intro=0`);
    await page.waitForSelector('#title:not([hidden])');
    assert.equal((await page.locator('#title-nations [data-nation="goguryeo"]').evaluate((b) => b.getAttribute('aria-checked') ?? b.getAttribute('aria-pressed'))), 'true');
    assert.match(await page.innerText('#title-play'), /복습 시작|새 카드 시작|이어하기/);
    assert.match(await page.innerText('#title-today'), /이번 세션 \d+장\(복습 \d+ · 새 \d+\) · 약 \d+분|이어서/);
    assert.deepEqual(failed, []);
    // 사람 테스트 모드도 묶음만으로 돈다: 참가자 만들기 → pre 한 장 → 방식 B 화면.
    await page.goto(`http://127.0.0.1:${port}/index.html?study=1&participant=P1`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.locator('#lock-code').fill(CONFIG.study.facilitatorCode);
    await page.locator('#lock-open').tap();
    await page.waitForSelector('#study-create');
    await page.locator('#study-create').tap();
    await page.locator('#study-stages a[data-go="pre"]').tap();
    await page.waitForSelector('#test-card');
    await page.locator('#test-unknown').tap();
    await page.locator('#test-submit').tap();
    await page.waitForSelector('#test-progress[data-index="1"]');
    await page.goto(`http://127.0.0.1:${port}/index.html?study=1&participant=P1&stage=learn-B`);
    await page.waitForSelector('#btn-flip');
    await page.goto(`http://127.0.0.1:${port}/index.html?study=1&participant=P1&stage=learn-A`);
    await page.waitForSelector('#card[data-card-id]');
    assert.match(await page.innerText('#nation-label'), /방식 A · P1/);
    assert.deepEqual(failed, []);
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    await browser.close();
    proc.kill();
  }
});
