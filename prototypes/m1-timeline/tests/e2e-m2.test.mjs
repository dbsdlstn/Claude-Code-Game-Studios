// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D82)
// M2 1차: 타이틀, 덱 목록·나라 선택, 보상 자리, M1 저장 옮기기, 테스트 모드에서 꺼짐.
// node --test prototypes/m1-timeline/tests/e2e-m2.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openProto, currentCard as cardOf, gapsFor, pressGap, VIEWPORTS, REAL, REAL_BY_ID, FULL, FULL_BY_ID, FULL_INFO } from './helpers.mjs';
import { studyUrl, ready } from './study-driver.mjs';
import { CONFIG } from '../js/config.js';
import { normalizeDeck } from '../js/data.js';
import { readFileSync } from 'node:fs';

let server;
let browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.stop(); });

async function withPage(opts, fn) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try { await fn(page); assert.deepEqual(errors, []); } finally { await ctx.close(); }
}
const TWELVE_RAW = JSON.parse(readFileSync(new URL('./fixtures/goguryeo-12anchors.json', import.meta.url), 'utf8'));
const TWELVE_BY_ID = new Map(normalizeDeck(TWELVE_RAW).deck.cards.map((c) => [c.id, c]));
/** data를 주면 그 덱, 아니면 기본(샘플·실제) 덱에서 카드를 찾는다. */
const currentCard = (page, byId) => cardOf(page, byId ?? (page.url().includes('12anchors') ? TWELVE_BY_ID : undefined));
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const mobile = name === 'mobile';
  const tap = (page, sel) => (mobile ? page.locator(sel).tap() : page.click(sel));

  test(`${name}: 타이틀 → 시작하기 → 처음 안내 → 학습, "처음"으로 돌아오면 이어하기`, { skip: !FULL && '실제 데이터 없음' }, () => withPage(opts, async (page) => {
    await openProto(page, server.base, { data: null, intro: null, title: null });
    await page.waitForSelector('#title:not([hidden])');
    assert.equal(await page.isVisible('#timeline'), false, '타이틀에서는 학습 화면이 안 보인다');
    assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'start');
    assert.equal(await page.innerText('#title-play'), '시작하기');
    assert.deepEqual(await page.locator('#title-nations .nation').evaluateAll((b) => b.map((x) => [x.dataset.nation, x.disabled])), [['goguryeo', false], ['baekje', true], ['silla', true], ['gaya', true]]);
    assert.match(await page.innerText('#title-progress'), new RegExp(`고구려 카드 ${FULL.cards.length}장 중 0장 학습`));
    assert.match(await page.innerText('#title-stats'), /레벨 1/);
    assert.ok(await noOverflow(page));
    await tap(page, '#title-play');
    await page.waitForSelector('#intro:not([hidden])');
    await tap(page, '#intro-skip');
    assert.equal(await page.isVisible('#title'), false);
    const card = await currentCard(page, FULL_BY_ID);
    await pressGap(page, (await gapsFor(page, card)).right, mobile);
    // 보상 자리: 정답 XP(단서 없이 정답 + 상자 승급)
    assert.equal(await page.getAttribute('#result-xp', 'data-xp'), String(CONFIG.rewards.xp.clean + CONFIG.rewards.xp.box_up));
    await tap(page, '#btn-next');
    await tap(page, '#btn-home');
    await page.waitForSelector('#title:not([hidden])');
    assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'continue');
    assert.match(await page.innerText('#title-play'), /이어하기 · 세션 1/);
    assert.match(await page.innerText('#title-progress'), /1장 학습/);
    // 하는 방법 = 처음 안내 다시 보기, 숙련 도감
    await tap(page, '#title-howto');
    await page.waitForSelector('#intro:not([hidden])');
    await tap(page, '#intro-skip');
    await tap(page, '#title-dogam');
    await page.waitForSelector('#dogam:not([hidden])');
    await tap(page, '#dogam-close');
    // 이어하기: 같은 세션의 다음 카드
    await tap(page, '#title-play');
    assert.match(await page.innerText('#progress'), /카드 2 \/ 6/);
    // 다시 열면 타이틀부터, 안내는 다시 안 나옴
    await page.reload();
    await page.waitForSelector('#title:not([hidden])');
    await tap(page, '#title-play');
    assert.equal(await page.locator('#intro:not([hidden])').count(), 0);
  }));
}

test('보상: 세션 결과에 이번 세션 XP·레벨·연속일·오늘 목표·새 업적, 다시 열어도 유지', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base);
  let first = true;
  while (await page.getAttribute('#card', 'data-card-id')) {
    const card = await currentCard(page);
    const g = await gapsFor(page, card);
    await pressGap(page, first ? g.wrong : g.right, false);
    if (first) assert.equal(await page.locator('#result-xp').count(), 0, '오답은 XP 없음');
    first = false;
    await page.click('#btn-next');
  }
  await page.waitForSelector('#summary:not([hidden])');
  const xp = Number(await page.getAttribute('#summary-rewards', 'data-xp'));
  const X = CONFIG.rewards.xp;
  // 6장 중 5장 깨끗한 정답(+상자 승급), 재도전 0, 세션 완료 + 오늘 목표
  assert.equal(xp, 5 * (X.clean + X.box_up) + X.session_done + X.daily_goal);
  assert.match(await page.innerText('#summary-streak'), /연속 1일 \(최고 1일\) · 오늘 목표 달성/);
  assert.match(await page.innerText('#summary-achievements'), /첫 세션/);
  assert.doesNotMatch(await page.innerText('#summary-body'), /null|undefined|NaN/);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:save:v2')).rewards);
  assert.equal(saved.xp, xp);
  assert.ok(saved.achievements.first_session);
}));

test('M1 저장(최상위 completed_sessions·cards)을 읽어 진행을 잇는다', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base);
  const ids = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hanyang-m1:save:v2')).cards));
  const anyId = (await currentCard(page)).id;
  await page.evaluate((id) => {
    localStorage.setItem('hanyang-m1:save:v2', JSON.stringify({ version: 1, format: 'hanyang-dogam-mastery', dataId: 'old-m1', completed_sessions: 4, current: null, log: [], participant: '-',
      cards: { [id]: { box: 3, introduced: true, due_session: 9, last_session: 4, clean_streak: 2, lapses: 0, best_grade: 1, last_played_at: null } } }));
  }, anyId);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  assert.match(await page.innerText('#session-no'), /세션 5/);
  await page.click('#btn-dogam');
  assert.match(await page.innerText(`#dogam-list [data-id="${anyId}"]`), /상자 3/);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:save:v2')));
  assert.equal(s.nations.goguryeo.completed_sessions, 4);
  assert.equal('completed_sessions' in s, false);
  assert.ok(ids.length >= 0);
}));

test('없는 나라(?nation=baekje)는 고를 수 없어 고구려로 연다', { skip: !FULL && '실제 데이터 없음' }, () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base, { data: null, nation: 'baekje' });
  assert.ok((await page.innerText('#data-info')).includes(FULL_INFO));
}));

test('테스트 모드(방식 A·B)에는 타이틀·보상·"처음" 버튼이 없다', { skip: !REAL && '실제 데이터 없음' }, () => withPage(VIEWPORTS.mobile, async (page) => {
  await page.goto(studyUrl(server.base, { participant: 'M2' }));
  await ready(page);
  await page.locator('#study-create').tap();
  await page.goto(studyUrl(server.base, { participant: 'M2', stage: 'learn-A' }));
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.isVisible('#title'), false);
  assert.equal(await page.isVisible('#btn-home'), false);
  // 테스트 모드는 덱 목록이 늘어도 M1 파일 하나(반 6장)로 고정
  assert.match(await page.innerText('#data-info'), /^데이터: goguryeo-m1\.json · 카드 6장/);
  const card = await currentCard(page, REAL_BY_ID);
  await pressGap(page, (await gapsFor(page, card)).right, true);
  assert.equal(await page.locator('#result-xp').count(), 0);
  const save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), CONFIG.study.storagePrefix + 'M2');
  assert.equal(save.rewards, undefined);
  assert.equal(await page.evaluate(() => localStorage.getItem('hanyang-m1:save:v2')), null);
  await page.goto(studyUrl(server.base, { participant: 'M2', stage: 'learn-B' }));
  await page.waitForSelector('#btn-flip');
  assert.equal(await page.isVisible('#title'), false);
}));

const TWELVE = 'tests/fixtures/goguryeo-12anchors.json';
for (const [name, opts] of Object.entries(VIEWPORTS)) {
  test(`${name}: 앵커 12개(D85 대비)도 연표·칸·테스트 화면이 넘치지 않는다`, () => withPage(opts, async (page) => {
    const mobile = name === 'mobile';
    await openProto(page, server.base, { data: TWELVE });
    assert.equal(await page.locator('#timeline .row-anchor').count(), 12);
    assert.equal(await page.locator('#timeline .gap').count(), 12, '칸 = 앵커 수(첫 앵커 앞은 칸이 아님)');
    assert.ok(await noOverflow(page));
    const card = await currentCard(page);
    await pressGap(page, (await gapsFor(page, card)).right, mobile);
    assert.equal(await page.getAttribute('#result', 'data-result'), 'correct');
    // 테스트 화면: 왕 12명 버튼
    await page.goto(studyUrl(server.base, { participant: `T${mobile ? 1 : 2}`, data: TWELVE }));
    await ready(page);
    await page.click('#study-create');
    await page.click('#study-stages a[data-go="pre"]');
    await page.waitForSelector('#test-card');
    assert.equal(await page.locator('#test-kings .king').count(), 12);
    assert.ok(await noOverflow(page));
  }));
}
