// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D82)
// M2 1차: 타이틀, 덱 목록·나라 선택, 보상 자리, M1 저장 옮기기, 테스트 모드에서 꺼짐.
// node --test prototypes/m1-timeline/tests/e2e-m2.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openProto, currentCard as cardOf, gapsFor, pressGap, editSave, VIEWPORTS, REAL, REAL_BY_ID, FULL, FULL_BY_ID, FULL_INFO, NATIONS, nationDeck } from './helpers.mjs';
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
    // D93: 처음에는 새 카드 6장(M1 설정), 시작 버튼 위에 오늘 할 일
    assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'new');
    assert.equal(await page.innerText('#title-play'), '새 카드 시작');
    const L = CONFIG.leitner;
    assert.equal(await page.innerText('#title-today'), `오늘 복습 0장 · 새 카드 ${L.session_size}장 · 약 ${Math.ceil((L.session_size * CONFIG.secondsPerCard) / 60)}분`);
    assert.ok(await page.evaluate(() => document.querySelector('#title-today').getBoundingClientRect().bottom <= document.querySelector('#title-play').getBoundingClientRect().top), '오늘 할 일은 시작 버튼 위');
    assert.equal(await page.locator('#title-meta').count(), 1, '레벨·XP·연속일 한 줄');
    assert.match(await page.innerText('#title-meta'), /레벨 1.*0 \/ 100 XP · 연속 0일/s);
    // 파일이 있는 나라만 활성(백제는 D93부터 활성), 나머지는 "준비 중"
    assert.deepEqual(await page.locator('#title-nations .nation').evaluateAll((b) => b.map((x) => [x.dataset.nation, x.disabled])), NATIONS.map((n) => [n.id, !n.files.length]));
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
    assert.match(await page.innerText('#title-play'), /이어하기 · 5장 남음/);
    assert.match(await page.innerText('#title-today'), /이어서 5장 남음 · 약 \d+분/);
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

const EMPTY = NATIONS.find((n) => !n.files.length);
test(`카드가 없는 나라(?nation=${EMPTY?.id})는 고를 수 없어 고구려로 연다`, { skip: (!FULL || !EMPTY) && '해당 없음' }, () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base, { data: null, nation: EMPTY.id });
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

// D100: 백제 카드가 manifest에 들어오기 전에, 고정 데이터로 나라가 둘일 때를 미리 확인한다.
// D100·D101: 나라가 둘일 때. 실제 백제 덱(D93)과, 고정 데이터 목록(manifest 바꿔 끼우기) 두 가지로 돈다.
const FIX_BJ = normalizeDeck(JSON.parse(readFileSync(new URL('./fixtures/baekje-fixture.json', import.meta.url), 'utf8'))).deck;
const REAL_BJ = nationDeck('baekje');
const CASES = [
  ...(REAL_BJ ? [{ label: '실제 백제', manifest: null, bj: REAL_BJ.deck }] : []),
  { label: '고정 데이터', manifest: 'tests/fixtures/manifest-two-nations.json', bj: FIX_BJ },
];
for (const [name, opts] of Object.entries(VIEWPORTS)) for (const C of CASES) {
  const TWO = C.manifest;
  const BJ = C.bj;
  const BJ_BY_ID = new Map(BJ.cards.map((c) => [c.id, c]));
  const mobile = name === 'mobile';
  const tap = (page, sel) => (mobile ? page.locator(sel).tap() : page.click(sel));
  test(`${name} · ${C.label}: 나라가 둘이면 백제가 활성, 나라별 연표·세션은 따로, 카드 진행은 한 저장에`, { skip: !REAL && '실제 데이터 없음' }, () => withPage(opts, async (page) => {
    await openProto(page, server.base, { data: null, title: null, manifest: TWO });
    await page.waitForSelector('#title:not([hidden])');
    assert.equal(await page.isDisabled('#title-nations [data-nation="baekje"]'), false);
    assert.equal(await page.isDisabled('#title-nations [data-nation="goguryeo"]'), false);
    // 타이틀 진행 표시는 나라별(고구려 덱 수)
    assert.match(await page.innerText('#title-progress'), /^고구려 카드 \d+장 중 0장 학습/);
    // 고구려 한 장
    await tap(page, '#title-play');
    const g1 = await currentCard(page, FULL_BY_ID);
    await pressGap(page, (await gapsFor(page, g1)).right, mobile);
    await tap(page, '#btn-next');
    await tap(page, '#btn-home');
    // 백제로
    await tap(page, '#title-nations [data-nation="baekje"]');
    await page.waitForURL(/nation=baekje/);
    await page.waitForSelector('#title:not([hidden])');
    assert.equal(await page.getAttribute('#title-nations [data-nation="baekje"]', 'aria-pressed'), 'true');
    assert.match(await page.innerText('#title-progress'), new RegExp(`백제 카드 ${BJ.cards.length}장 중 0장 학습`));
    assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'new', '백제는 처음');
    assert.match(await page.innerText('#title-stats'), /레벨 1/);
    await tap(page, '#title-play');
    assert.match(await page.innerText('#timeline-title'), /백제 왕대 연표/);
    assert.deepEqual(await page.locator('#timeline .row-anchor').evaluateAll((r) => r.map((x) => x.dataset.id)), [...BJ.anchors].sort((a, b) => a.order - b.order).map((a) => a.id));
    assert.match(await page.innerText('#session-no'), /세션 1/);
    const b1 = await currentCard(page, BJ_BY_ID);
    assert.ok(b1, '백제 카드가 나온다');
    await pressGap(page, (await gapsFor(page, b1)).right, mobile);
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:save:v2')));
    assert.deepEqual(Object.keys(save.nations).sort(), ['baekje', 'goguryeo']);
    assert.ok(save.cards[g1.id]?.introduced && save.cards[b1.id]?.introduced, '두 나라 카드 진행이 한 저장에');
    assert.equal(save.last_nation, 'baekje');
    assert.ok(save.rewards.xp > 0, '보상은 나라 공통');
    // 다시 열면 마지막 나라(백제). 고구려로 돌아가면 고구려 세션 번호를 잇는다(나라를 바꾸면 페이지를 다시 여므로
    // 1장 이상 한 세션은 §5대로 끝난 것으로 처리되고 다음 세션 2가 된다).
    await page.goto(page.url().replace(/&?nation=baekje/, ''));
    await page.waitForSelector('#title:not([hidden])');
    assert.equal(await page.getAttribute('#title-nations [data-nation="baekje"]', 'aria-pressed'), 'true');
    await tap(page, '#title-nations [data-nation="goguryeo"]');
    await page.waitForURL(/nation=goguryeo/);
    await page.waitForSelector('#title:not([hidden])');
    // 고구려 세션 1은 나라 전환(페이지 다시 열기)으로 끝났으므로 다음 세션의 복습(오답 카드가 없으면 새 카드)
    assert.match(await page.getAttribute('#title-play', 'data-mode'), /^(review|new)$/);
    await tap(page, '#title-play');
    assert.match(await page.innerText('#timeline-title'), /고구려 왕대 연표/);
    assert.match(await page.innerText('#session-no'), /세션 2/);
    assert.match(await page.innerText('#notice'), /지난 세션 1/);
    const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:save:v2')).nations);
    assert.equal(s2.goguryeo.completed_sessions, 1);
    assert.equal(s2.baekje.completed_sessions, 1, '백제 세션 번호는 따로(공유했다면 고구려가 2)');
    assert.ok(await noOverflow(page));
  }));
}

// D93·D102: 연표 칸 압축(일반 모드), 테스트 모드는 M1 화면 그대로, 숙련 카드 해설 접기
test('390px: 칸 압축 — 앵커 한 줄(≤48px), "+"는 44px, 틈 줄 없음, 연표 높이 2창 이하', { skip: !FULL && '실제 데이터 없음' }, () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base, { data: null });
  assert.equal(await page.locator('#timeline.compact').count(), 1);
  assert.equal(await page.locator('#timeline .gap-row').count(), 0, '틈 줄 없음');
  assert.equal(await page.locator('#timeline .gap').count(), FULL.anchors.length);
  const rows = await page.locator('#timeline .row-anchor').evaluateAll((r) => r.map((x) => x.getBoundingClientRect().height));
  assert.ok(rows.every((h) => h <= 48), `앵커 줄 높이 ${rows}`);
  const btn = await page.locator('#timeline .gap').first().evaluate((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
  assert.deepEqual(btn.map(Math.round), [44, 44], '터치 타깃 44px');
  const ratio = await page.evaluate(() => document.querySelector('.timeline-wrap').getBoundingClientRect().height / innerHeight);
  assert.ok(ratio <= 2.0, `연표 ${ratio.toFixed(2)}창`);
  assert.ok(await noOverflow(page));
  // 마지막 앵커의 +도 누를 수 있고 확정 막대에 가리지 않는다
  const last = page.locator(`#timeline .gap[data-gap="${FULL.anchors.length}"]`);
  await last.scrollIntoViewIfNeeded();
  await last.tap();
  const onTop = await page.evaluate(() => { const n = document.querySelector('.gap-pending .gap'); const r = n.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.bottom <= innerHeight && (t === n || n.contains(t)); });
  assert.ok(onTop);
}));

test('테스트 모드(방식 A)의 연표는 M1 화면 그대로(틈 줄, 압축 없음)', { skip: !REAL && '실제 데이터 없음' }, () => withPage(VIEWPORTS.mobile, async (page) => {
  await page.goto(studyUrl(server.base, { participant: 'C1' }));
  await ready(page);
  await page.locator('#study-create').tap();
  await page.goto(studyUrl(server.base, { participant: 'C1', stage: 'learn-A' }));
  await page.waitForSelector('#card[data-card-id]');
  assert.equal(await page.locator('#timeline.compact').count(), 0);
  assert.equal(await page.locator('#timeline .gap-row').count(), REAL.anchors.length);
}));

test('숙련 카드(은 이상)를 맞히면 해설은 접혀 있고, 그 밖에는 펼쳐 있다', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base);
  const first = await currentCard(page);
  await pressGap(page, (await gapsFor(page, first)).right, false);
  assert.equal(await page.locator('#result-details').count(), 0, '새 카드는 펼침');
  assert.ok(await page.isVisible('.result-exp'));
  await editSave(page, (s) => {
    for (const n of Object.values(s.nations)) n.current = null;
    for (const id of Object.keys(s.cards)) delete s.cards[id];
    return s;
  });
  await editSave(page, (s) => {
    const ids = ['gg-c-gungnae', 'gg-c-jindae', 'gg-c-nangnang', 'gg-c-taehak', 'gg-c-pyeongyang', 'gg-c-hanseong', 'gg-c-salsu', 'gg-c-ansi'];
    for (const id of ids) s.cards[id] = { box: 4, introduced: true, due_session: 1, last_session: 0, clean_streak: 2, lapses: 0, best_grade: 2, last_played_at: null, probation: false, probation_clean: 0 };
    for (const n of Object.values(s.nations)) { n.current = null; n.completed_sessions = 0; }
    return s;
  });
  const c = await currentCard(page);
  await pressGap(page, (await gapsFor(page, c)).right, false);
  assert.equal(await page.locator('#result-details').count(), 1);
  assert.equal(await page.getAttribute('#result-details', 'open'), null, '기본은 접힘');
  assert.equal(await page.isVisible('.result-exp'), false);
  await page.click('#result-details summary');
  assert.ok(await page.isVisible('.result-exp'));
}));
