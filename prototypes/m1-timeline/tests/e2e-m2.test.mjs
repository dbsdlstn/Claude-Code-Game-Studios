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

/** 일반 모드 첫 세션 장수(명세 기본값, D95). */
const G = CONFIG.leitnerGeneral;
const FIRST = Math.max(G.new_min, Math.floor(G.session_size * G.new_max_ratio));

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
    // D93·D95: 처음에는 새 카드 FIRST장(명세 기본값), 시작 버튼 위에 오늘 할 일
    assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'new');
    assert.equal(await page.innerText('#title-play'), '새 카드 시작');
    assert.equal(await page.innerText('#title-today'), `오늘 복습 0장 · 새 카드 ${FIRST}장 · 약 ${Math.ceil((FIRST * CONFIG.secondsPerCard) / 60)}분`);
    assert.ok(await page.evaluate(() => document.querySelector('#title-today').getBoundingClientRect().bottom <= document.querySelector('#title-play').getBoundingClientRect().top), '오늘 할 일은 시작 버튼 위');
    assert.equal(await page.locator('#title-meta').count(), 1, '레벨·XP·연속일 한 줄');
    assert.match(await page.innerText('#title-meta'), new RegExp(`레벨 1[\\s\\S]*0 / ${CONFIG.rewards.level.base} XP · 연속 0일`));
    assert.equal(await page.innerText('#title-name-line'), '입문자');
    // 파일이 있는 나라만 활성(백제는 D93부터 활성), 나머지는 "준비 중"
    // 파일이 있는 나라는 모두 고를 수 있다(3개 이상이면 세로 목록, 2개 이하면 칩)
    const shown = await page.locator('#title-nations [data-nation]').evaluateAll((b) => b.map((x) => [x.dataset.nation, x.disabled]));
    assert.deepEqual(shown.filter(([, d]) => !d).map(([id]) => id).sort(), NATIONS.filter((n) => n.files.length).map((n) => n.id).sort());
    assert.match(await page.innerText('#title-progress'), new RegExp(`고구려 카드 ${FULL.cards.length}장 중 0장 학습`));
    assert.match(await page.innerText('#title-stats'), /레벨 1/);
    assert.ok(await noOverflow(page));
    await tap(page, '#title-play');
    await page.waitForSelector('#intro:not([hidden])');
    await tap(page, '#intro-skip');
    assert.equal(await page.isVisible('#title'), false);
    const card = await currentCard(page, FULL_BY_ID);
    await pressGap(page, (await gapsFor(page, card)).right, mobile);
    // 보상은 세션 결과에서 정산한다(학습 결과를 가리지 않게, rewards-spec §6). 정답 카드에는 XP를 띄우지 않는다.
    assert.equal(await page.locator('#result-xp').count(), 0);
    await tap(page, '#btn-next');
    await tap(page, '#btn-home');
    await page.waitForSelector('#title:not([hidden])');
    assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'continue');
    assert.match(await page.innerText('#title-play'), new RegExp(`이어하기 · ${FIRST - 1}장 남음`));
    assert.match(await page.innerText('#title-today'), new RegExp(`이어서 ${FIRST - 1}장 남음 · 약 \\d+분`));
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
    assert.match(await page.innerText('#progress'), new RegExp(`카드 2 / ${FIRST}`));
    // 다시 열면 타이틀부터, 안내는 다시 안 나옴
    await page.reload();
    await page.waitForSelector('#title:not([hidden])');
    await tap(page, '#title-play');
    assert.equal(await page.locator('#intro:not([hidden])').count(), 0);
  }));
}

/** 한 세션을 끝까지(첫 카드는 오답, 나머지 정답, 재도전은 정답). */
async function playOneSession(page, mobile = false) {
  let first = true;
  while (await page.getAttribute('#card', 'data-card-id')) {
    const card = await currentCard(page);
    const g = await gapsFor(page, card);
    await pressGap(page, first ? g.wrong : g.right, mobile);
    first = false;
    await page.click('#btn-next');
  }
  await page.waitForSelector('#summary:not([hidden])');
}

test('보상 정산(session-result.md): 결과 요약 → 카드별 → 하루 목표·연속 → 레벨 → 업적 → 다음 복습, 별도 저장 키', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base);
  await playOneSession(page);
  const X = CONFIG.rewards.xp;
  assert.equal(await page.innerText('#summary-title'), '오늘의 세션 · 고구려');
  assert.match(await page.innerText('#stage-summary'), new RegExp(`정답 ${FIRST - 1} / ${FIRST}\\s+깨끗한 정답 ${FIRST - 1} · 단서를 쓴 정답 0 · 오답 1\\s+다시 풀기 1장 중 1장 성공`));
  assert.doesNotMatch(await page.innerText('#stage-summary'), /XP/, '1단계에는 XP가 없다');
  assert.deepEqual(await page.locator('#summary-body .stage').evaluateAll((n) => n.map((x) => x.dataset.stage)), ['summary', 'cards', 'goal', 'level', 'ach', 'next']);
  // 카드별: 깨끗한 정답 +10, 상자 승급 +5, 오답 +0과 재학습 안내
  const lines = await page.locator('#settle-list .settle').evaluateAll((n) => n.map((x) => [x.dataset.kind, x.dataset.xp, x.innerText]));
  const all = lines.map(([k, , t]) => [k, t]);
  assert.equal(all.length, FIRST);
  const wrong = all.find(([k]) => k === 'wrong');
  assert.match(wrong[1], /해설을 읽어 보세요\s*\+0[\s\S]*다음에 두 번 연속 맞히면 올라가요/);
  assert.ok(all.filter(([k]) => k === 'clean').every(([, t]) => /깨끗한 정답\s*\+10[\s\S]*상자 1 → 2 · \+5/.test(t)));
  const xp = (FIRST - 1) * (X.clean + X.box_up) + X.daily_goal;
  assert.equal(await page.getAttribute('#summary-xp', 'data-xp'), String(xp));
  assert.match(await page.innerText('#summary-goal'), new RegExp(`오늘 목표 달성 · \\+${X.daily_goal}`));
  assert.match(await page.innerText('#summary-streak'), /연속 1일째예요/);
  assert.match(await page.innerText('#summary-levelup'), /레벨 \d → \d|레벨 \d이 되었어요/);
  assert.match(await page.innerText('#summary-achievements'), /업적 · 첫 걸음 · 첫 세션을 마쳤어요/);
  assert.match(await page.innerText('#stage-next'), /다음 세션 복습 1장|다음 세션에는 새 카드부터/);
  assert.equal(await page.isVisible('#summary-next'), true);
  assert.equal(await page.isVisible('#summary-home'), true);
  assert.doesNotMatch(await page.innerText('#summary-body'), /null|undefined|NaN/);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  const rw = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:rewards:v1')));
  assert.equal(rw.xp, xp);
  assert.ok(rw.achievements['first-step']);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:save:v2')).rewards), undefined, '학습 저장과 분리');
}));

test('보상 정산은 탭으로 한 단계씩, 건너뛰기로 끝까지(동작 줄이기 꺼짐)', () => withPage({ ...VIEWPORTS.mobile, reducedMotion: 'no-preference' }, async (page) => {
  await openProto(page, server.base);
  await playOneSession(page, true);
  const shown = () => page.locator('#summary-body .stage:not([hidden])').count();
  assert.equal(await shown(), 1, '처음에는 결과 요약만');
  assert.equal(await page.isVisible('#summary-next'), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'summary-skip');
  await page.locator('#summary-step').tap();
  assert.equal(await shown(), 2);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#summary'), true, 'Esc로 닫히지 않는다');
  await page.locator('#summary-skip').tap();
  assert.equal(await shown(), Number(await page.getAttribute('#summary-body', 'data-total')));
  assert.equal(await page.isVisible('#summary-next'), true);
  await page.locator('#summary-home').tap();
  await page.waitForSelector('#title:not([hidden])');
}));

test('하루 세 번째 세션: 인출 XP 0과 안내, 승급 보너스는 그대로', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base);
  await page.evaluate(() => {
    const d = new Date(Date.now() - 3 * 3600000);
    const p = (x) => String(x).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    localStorage.setItem('hanyang-m1:rewards:v1', JSON.stringify({ version: 1, format: 'hanyang-dogam-rewards', xp: 0, sessions_done: 2, streak: 1, best_streak: 1, rest_passes: 0, last_goal_date: key, goal_days_total: 1, achievements: {}, day: { key, sessions: 2, goal_met: true }, settled: [] }));
  });
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  await playOneSession(page);
  const X = CONFIG.rewards.xp;
  assert.equal(await page.getAttribute('#summary-xp', 'data-xp'), String((FIRST - 1) * X.box_up), '승급만');
  assert.match(await page.innerText('#stage-next'), /경험치는 하루 두 세션까지예요/);
  assert.match(await page.innerText('#stage-next'), /오늘은 충분히 했어요/);
  assert.equal(await page.locator('#stage-goal').count(), 0, '목표는 이미 달성');
  // 권장 상한(하루 3세션, D94): 막지 않고 타이틀에도 안내만
  await page.click('#summary-home');
  assert.match(await page.innerText('#title-today'), /오늘은 충분히 했어요. 내일 이어서 해요/);
  assert.equal(await page.isDisabled('#title-play'), false);
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

// 카드가 없는 나라("준비 중")는 실제 manifest에 없으므로(D96) 고정 데이터 목록으로 확인한다
test('카드가 없는 나라(?nation=gaya, 고정 데이터 목록)는 고를 수 없어 기본 나라로 연다', () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base, { data: null, nation: 'gaya', manifest: 'tests/fixtures/manifest-two-nations.json' });
  assert.match(await page.innerText('#data-info'), /^데이터: 고구려 goguryeo-m1\.json/);
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
    // 진행 중 세션(1장 풂)이 있으므로 확인 대화상자(title-screen.md, D104)
    await tap(page, '#switch-confirm');
    await page.waitForURL(/nation=baekje/);
    await page.waitForSelector('#title:not([hidden])');
    assert.equal((await page.locator('#title-nations [data-nation="baekje"]').evaluate((b) => b.getAttribute('aria-checked') ?? b.getAttribute('aria-pressed'))), 'true');
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
    assert.equal(save.rewards, undefined, '보상은 학습 저장과 다른 키(나라 공통)');
    // 다시 열면 마지막 나라(백제). 고구려로 돌아가면 고구려 세션 번호를 잇는다(나라를 바꾸면 페이지를 다시 여므로
    // 1장 이상 한 세션은 §5대로 끝난 것으로 처리되고 다음 세션 2가 된다).
    await page.goto(page.url().replace(/&?nation=baekje/, ''));
    await page.waitForSelector('#title:not([hidden])');
    assert.equal((await page.locator('#title-nations [data-nation="baekje"]').evaluate((b) => b.getAttribute('aria-checked') ?? b.getAttribute('aria-pressed'))), 'true');
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

// D104: 도감 탭(design/ux/dogam.md)과 나라 3개 이상의 타이틀 목록·전환 확인(title-screen.md)
test('도감: 프로필 줄, 탭 4개(방향키), 안 만난 카드는 ?, 카드 상세·이 카드만 연습, 필터, 업적·칭호', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base);
  await playOneSession(page);
  await page.click('#summary-dogam');
  await page.waitForSelector('#dogam:not([hidden])');
  assert.match(await page.innerText('#dogam-profile'), /입문자|서당 학동/);
  assert.match(await page.innerText('#dogam-streak'), /연속 1일 · 최고 1일 · 보호권 0장/);
  assert.equal(await page.getAttribute('#tab-cards', 'aria-selected'), 'true');
  // 요약 줄 = 목록
  const counts = await page.innerText('#dogam-counts');
  const unseen = Number(/아직 안 만남 (\d+)/.exec(counts)[1]);
  assert.equal(await page.locator('#dogam-list .dogam-row[data-mastery="unseen"]').count(), unseen);
  assert.ok(await page.locator('#dogam-list .dogam-row[data-mastery="unseen"] .dogam-title').allInnerTexts().then((t) => t.every((x) => x.startsWith('?'))), '안 만난 카드는 제목을 숨긴다');
  // 왕 줄 진행(은 이상/칸 카드 수)
  assert.ok(await page.locator('#dogam-list .dogam-king').count() >= 1);
  // 카드 상세, 이 카드만 연습(상태 불변)
  const seen = page.locator('#dogam-list .dogam-row:not([data-mastery="unseen"]) .dogam-card').first();
  const before = await page.evaluate(() => localStorage.getItem('hanyang-m1:save:v2'));
  await seen.click();
  await page.waitForSelector('#card-detail:not([hidden])');
  assert.match(await page.innerText('#detail-state'), /상자 \d/);
  await page.click('#detail-practice');
  assert.equal(await page.locator('#practice-badge').count(), 1);
  const card = await currentCard(page);
  await pressGap(page, (await gapsFor(page, card)).right, false);
  await page.click('#btn-next');
  await page.waitForSelector('#summary:not([hidden])');
  assert.match(await page.innerText('#summary-title'), /연습 결과/);
  const cardsBefore = JSON.parse(before).cards;
  const cardsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:save:v2')).cards);
  assert.deepEqual(cardsAfter, cardsBefore, '연습은 상태를 바꾸지 않는다');
  await page.click('#summary-dogam');
  // 필터
  await page.click('#dogam-filters [data-filter="unseen"]');
  assert.equal(await page.locator('#dogam-list .dogam-row:not([data-mastery="unseen"])').count(), 0);
  // 방향키로 탭 이동
  await page.focus('#tab-cards');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('#tab-ach', 'aria-selected'), 'true');
  assert.equal(await page.isVisible('#panel-ach'), true);
  const ach = await page.locator('#ach-list .ach-row').evaluateAll((r) => r.map((x) => [x.dataset.id, x.dataset.got]));
  assert.equal(ach.length, 13 + 4, '고유 13 + 나라별 4(고구려)');
  assert.equal(ach[0][0], 'first-step');
  assert.equal(ach[0][1], '1');
  assert.match(await page.innerText('#ach-list [data-id="first-step"]'), /획득 · \d+월 \d+일/);
  assert.match(await page.innerText('#ach-list [data-id="streak-7"]'), /1\/7/);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('#tab-titles', 'aria-selected'), 'true');
  assert.match(await page.innerText('#title-list'), /서당 학동 · Lv 5\s+Lv 5에 얻어요/);
  await page.click('#title-list [data-title="입문자"] button');
  assert.equal(await page.innerText('#dogam-honor'), '입문자');
  const rw = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-m1:rewards:v1')));
  assert.equal(rw.title_pinned, '입문자');
  await page.keyboard.press('Escape');
  // 다시 열면 카드 탭
  await page.click('#btn-dogam');
  assert.equal(await page.getAttribute('#tab-cards', 'aria-selected'), 'true');
  assert.ok(await noOverflow(page));
}));

const THREE = 'tests/fixtures/manifest-three-nations.json';
test('390px 나라 3개: 세로 목록(행 56px 이상, radiogroup, 행마다 오늘 할 일, 합계, 준비 중 접기), 진행 중 세션이면 전환 확인', { skip: !nationDeck('baekje') && '백제 없음' }, () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base, { data: null, title: null, manifest: THREE });
  await page.waitForSelector('#title:not([hidden])');
  const rows = page.locator('#title-nations .nation-row');
  assert.equal(await rows.count(), 3);
  assert.equal(await page.locator('#title-nations [role="radiogroup"]').count(), 1);
  const hs = await rows.evaluateAll((r) => r.map((x) => x.getBoundingClientRect().height));
  assert.ok(hs.every((h) => h >= 56), String(hs));
  assert.equal(await page.getAttribute('#title-nations [data-nation="goguryeo"]', 'aria-checked'), 'true');
  assert.match(await page.getAttribute('#title-nations [data-nation="baekje"]', 'aria-label'), /백제, \d+장 중 0장 학습, 오늘 복습 0장 새 카드 \d+장/);
  assert.match(await page.innerText('#title-nation-total'), /오늘 복습 모두 \d+장 · 새 카드 \d+장/);
  assert.match(await page.innerText('#title-nations .nation-soon-list summary'), /준비 중 1개/);
  assert.ok(await noOverflow(page));
  // 한 장 풀고 타이틀로 → 신라로 바꾸려 하면 확인, 취소하면 그대로
  await page.locator('#title-play').tap();
  const c = await currentCard(page, FULL_BY_ID);
  await pressGap(page, (await gapsFor(page, c)).right, true);
  await page.locator('#btn-next').tap();
  await page.locator('#btn-home').tap();
  await page.locator('#title-nations [data-nation="silla"]').tap();
  await page.waitForSelector('#modal:not([hidden])');
  assert.match(await page.innerText('#modal-body'), /지금 세션을 끝내고 신라로 옮길까요\? 푼 카드는 저장돼요/);
  await page.locator('#switch-cancel').tap();
  assert.doesNotMatch(page.url(), /nation=silla/);
  assert.equal(await page.getAttribute('#title-play', 'data-mode'), 'continue');
  await page.locator('#title-nations [data-nation="silla"]').tap();
  await page.locator('#switch-confirm').tap();
  await page.waitForURL(/nation=silla/);
  await page.waitForSelector('#title:not([hidden])');
  assert.equal(await page.getAttribute('#title-nations [data-nation="silla"]', 'aria-checked'), 'true');
}));

// D95: 일반 모드는 명세 기본값(new_min 2). 세션 1의 오답이 다음 세션(다음 날)에 복습으로 돌아온다(실제 고구려 36장).
test('D95 실제 덱: 세션 1 오답 카드가 다음 세션 복습으로 나온다(같은 날은 D94로 다음 날)', { skip: !FULL && '실제 데이터 없음' }, () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base, { data: null });
  let wrongId = null;
  while (await page.getAttribute('#card', 'data-card-id')) {
    const card = await currentCard(page, FULL_BY_ID);
    const g = await gapsFor(page, card);
    const first = !wrongId && !(await page.locator('#retry-badge').count());
    if (first) wrongId = card.id;
    await pressGap(page, first ? g.wrong : g.right, false);
    await page.click('#btn-next');
  }
  await page.waitForSelector('#summary:not([hidden])');
  await editSave(page, (s) => {
    const y = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    for (const e of Object.values(s.cards)) if (e.last_played_at) e.last_played_at = y;
    return s;
  });
  assert.match(await page.innerText('#session-no'), /세션 2/);
  const ids = [];
  while (await page.getAttribute('#card', 'data-card-id')) {
    const card = await currentCard(page, FULL_BY_ID);
    if (!ids.includes(card.id)) ids.push(card.id);
    await pressGap(page, (await gapsFor(page, card)).right, false);
    await page.click('#btn-next');
  }
  assert.ok(ids.includes(wrongId), `세션 2에 오답 카드 ${wrongId}가 복습으로 나와야 한다: ${ids}`);
  assert.ok(ids.length > 1, '복습 + 새 카드');
}));
