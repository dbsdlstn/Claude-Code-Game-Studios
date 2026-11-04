// 배포본(tools/build_web.py → dist/web/) E2E: node --test web/tests/e2e-dist.test.mjs
// 빌드를 실제로 돌리고, dist/web만 서버 루트로 띄워(저장소의 assets/는 보이지 않음) 게임이 실제 카드로 도는지 본다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, startServer, REPO_ROOT, SAMGUK, SAMGUK_BY_ID, currentCard, clickPlace, wrongCell } from './helpers.mjs';

const DIST = path.join(REPO_ROOT, 'dist', 'web');
const build = (...args) => spawnSync('python3', [path.join(REPO_ROOT, 'tools', 'build_web.py'), ...args], { encoding: 'utf8' });

let server;
let browser;

before(async () => {
  if (!SAMGUK) return;
  const r = build();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  server = await startServer({ root: DIST, probe: '/index.html' });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.stop();
});

test('빌드 결과: 카드 JSON 포함, 경로가 data/로 바뀜, 테스트 파일 제외', { skip: !SAMGUK && 'samguk.json 없음' }, () => {
  assert.ok(existsSync(path.join(DIST, 'index.html')));
  assert.deepEqual(JSON.parse(readFileSync(path.join(DIST, 'data', 'samguk.json'), 'utf8')), SAMGUK);
  assert.deepEqual(JSON.parse(readFileSync(path.join(DIST, 'data', 'tutorial.json'), 'utf8')),
    JSON.parse(readFileSync(path.join(REPO_ROOT, 'assets', 'data', 'cards', 'tutorial.json'), 'utf8')));
  assert.equal(existsSync(path.join(REPO_ROOT, 'web', 'data', 'tutorial.json')), false, '웹 전용 튜토리얼 파일은 없어야 한다(D31)');
  const config = readFileSync(path.join(DIST, 'src', 'config.js'), 'utf8');
  assert.match(config, /'data\/samguk\.json'/);
  assert.doesNotMatch(config, /\.\.\/assets/);
  assert.equal(existsSync(path.join(DIST, 'tests')), false);
  for (const t of ['event', 'artifact', 'person', 'myth']) assert.ok(existsSync(path.join(DIST, 'assets', 'art', 'placeholders', `placeholder-${t}.svg`)), t);
  assert.match(config, /assetRoot: ''/);
  assert.match(readFileSync(path.join(DIST, 'BUILD.txt'), 'utf8'), /mode: playtest/);
});

test('배포본만으로 실제 카드 로드 → 타이틀 → 튜토리얼 → 본게임 정답·오답', { skip: !SAMGUK && 'samguk.json 없음' }, async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  const errors = [];
  const failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${server.base}/index.html?seed=7`);
  await page.waitForSelector('body[data-ready="true"]');
  assert.match(await page.innerText('#data-info'), /samguk\.json · 판정 카드 36장/);
  await page.click('#title-start');
  await page.waitForSelector('#tutorial:not([hidden])');
  await page.click('#tut-next');
  await page.click('#tut-more');
  const tut = JSON.parse(readFileSync(path.join(DIST, 'data', 'tutorial.json'), 'utf8'));
  assert.ok((await page.innerText('#tut-card')).includes(tut.cards[0].clues[1].text.replace(/\[|\]/g, '').slice(0, 6)));
  await page.click('#tut-skip');
  const c1 = await currentCard(page, SAMGUK_BY_ID);
  assert.ok(c1, '실제 데이터의 카드여야 한다');
  await clickPlace(page, c1.answer);
  await page.waitForSelector('#fb[data-result="correct"]');
  await page.waitForFunction(() => document.querySelector('#fb .illust img')?.naturalWidth > 0);
  const c2 = await currentCard(page, SAMGUK_BY_ID);
  await clickPlace(page, wrongCell(c2));
  await page.waitForSelector('#fb[data-result="wrong"]');
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, [], '배포본에서 404 등 실패한 요청이 없어야 한다');
  await page.close();
});

test('--release 빌드는 사실 확인된 카드가 12칸을 채우지 못하면 실패한다(지금은 전부 verified: false)', { skip: !SAMGUK && 'samguk.json 없음' }, () => {
  const out = mkdtempSync(path.join(tmpdir(), 'hanyang-release-'));
  try {
    const verified = SAMGUK.filter((c) => c.verified === true && !c.anchor && !c.disputed).length;
    const r = build('--release', '--out', out);
    if (verified === 0) {
      assert.notEqual(r.status, 0);
      assert.match(r.stdout, /card validation failed/);
    } else {
      assert.ok(r.status === 0 || /card validation failed/.test(r.stdout));
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
