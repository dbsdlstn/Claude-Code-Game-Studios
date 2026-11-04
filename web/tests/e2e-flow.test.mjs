// 처음 하는 사람의 흐름·결과 화면·플레이 기록 E2E: node --test web/tests/e2e-flow.test.mjs
import { test, before, after, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NATIONS, ERAS } from '../src/rules.js';
import { chromium, startServer, openGame, currentCard, wrongCell, cellSel, dragTo, clickPlace, inkOf, SAMPLE, SAMPLE_BY_ID, SAMGUK } from './helpers.mjs';

// 공용 튜토리얼 파일(D31): 연습 카드는 cards[0], 기준 카드는 본 덱에서 anchor_id로 찾는다(샘플·samguk 모두 같은 id).
const TUTORIAL_FILE = JSON.parse(readFileSync(new URL('../../assets/data/cards/tutorial.json', import.meta.url), 'utf8'));
const TUT_CARD = TUTORIAL_FILE.cards[0];
const TUT_ANCHOR = SAMPLE_BY_ID.get(TUTORIAL_FILE.anchor_id);
const TUTORIAL = TUTORIAL_FILE.cards;

let server;
let browser;
let context;
let page;
let pageErrors;

before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.stop();
});
beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e));
});
afterEach(async () => {
  assert.deepEqual(pageErrors.map(String), [], '페이지 스크립트 오류');
  await context.close();
});

const tutCell = ({ nation, era }) => `#tut-board .cell[data-nation="${nation}"][data-era="${era}"]`;
const stepOf = () => page.getAttribute('#tut-step', 'data-step');

/** 라운드를 끝까지 둔다. plan(i, card) → {correct, level}. */
async function playRound(plan = () => ({ correct: true, level: 1 })) {
  let i = 0;
  while (await page.getAttribute('#card', 'data-card-id')) {
    const card = await currentCard(page);
    const { correct, level } = plan(i, card);
    for (let k = 1; k < level; k++) await page.click('#more-clue');
    await clickPlace(page, correct ? card.answer : wrongCell(card));
    i++;
  }
}

describe('타이틀과 튜토리얼', () => {
  test('첫 실행: 타이틀 → 시작하기 → 튜토리얼 4단계(시기 정의 → 단서 1 → 관계 단서로 배치 → 해설) → 본게임', async () => {
    await openGame(page, server.base, { title: true });
    assert.equal(await page.isVisible('#title-screen'), true);
    assert.match(await page.innerText('#title-name'), /한양 도감/);
    assert.equal(await page.locator('#title-continue').count(), 0, '첫 실행에는 이어하기가 없다');
    await page.click('#title-start');

    // 1. 시기 정의
    await page.waitForSelector('#tutorial:not([hidden])');
    assert.equal(await stepOf(), 'eras');
    const text = await page.innerText('#tut-step');
    for (const label of ['건국기', '전성기', '결말기']) assert.match(text, new RegExp(label));
    assert.match(text, /사건의 성격/);
    await page.click('#tut-next');

    // 2. 단서 1 — "단서 더 보기"를 눌러야 넘어간다
    assert.equal(await stepOf(), 'clue1');
    assert.equal(await page.isHidden('#tut-next'), true);
    assert.equal(await page.locator('#tut-card .clue').count(), 1);
    assert.match(await page.innerText('#tut-card'), new RegExp(TUT_CARD.clues[0].text.slice(0, 12)));
    await page.click('#tut-more');

    // 3. 관계 단서: 기준 카드 칸 강조, 오답이면 먹물 없이 다시
    assert.equal(await stepOf(), 'relation');
    assert.equal(await page.locator('#tut-card .clue').count(), 2);
    assert.equal(await page.locator(`${tutCell(TUT_ANCHOR.answer)}.tut-focus`).count(), 1);
    await page.click('#tut-card .card-head');
    await page.click(tutCell(wrongCell(TUT_CARD)));
    await page.waitForSelector('#tut-fb[data-result="wrong"]');
    assert.equal(await stepOf(), 'relation');
    // 정답: 드래그로 놓기
    const from = await page.locator('#tut-card .card-head').boundingBox();
    const to = await page.locator(tutCell(TUT_CARD.answer)).boundingBox();
    await page.mouse.move(from.x + 20, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();

    // 4. 해설
    await page.waitForSelector('#tut-fb[data-result="correct"]');
    assert.equal(await stepOf(), 'explain');
    assert.equal(await page.innerText('#tut-explanation'), TUT_CARD.explanation);
    assert.match(await page.innerText('#tut-step'), /먹물/);
    await page.click('#tut-next');

    // 본게임: 튜토리얼은 도감·먹물에 영향 없음
    assert.equal(await page.isHidden('#tutorial'), true);
    assert.equal(await page.isHidden('#title-screen'), true);
    assert.equal(await inkOf(page), 5);
    assert.equal(await page.getAttribute('#dogam-progress', 'data-collected'), '0');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'card');

    // 다시 열면 튜토리얼 없이 바로 본게임
    await openGame(page, server.base, { title: true });
    await page.click('#title-start');
    assert.equal(await page.isHidden('#tutorial'), true);
    assert.equal(await page.isVisible('#card'), true);
  });

  test('튜토리얼 연습 카드는 본 덱에 없고, 기준 카드는 본 덱의 anchor_id 카드다(샘플·실제 데이터 모두)', async () => {
    assert.ok(TUT_ANCHOR?.anchor, '샘플 덱에 anchor_id 기준 카드가 있어야 한다');
    if (SAMGUK) assert.ok(SAMGUK.find((c) => c.id === TUTORIAL_FILE.anchor_id)?.anchor);
    const deckIds = new Set([...SAMPLE, ...(SAMGUK ?? [])].map((c) => c.id));
    const deckTitles = new Set([...SAMPLE, ...(SAMGUK ?? [])].map((c) => c.title));
    for (const c of TUTORIAL) {
      assert.ok(!deckIds.has(c.id), c.id);
      assert.ok(!deckTitles.has(c.title), c.title);
    }
    await openGame(page, server.base, { title: true, data: null });
    await page.click('#title-start');
    await page.click('#tut-next');
    await page.click('#tut-more');
    assert.ok((await page.innerText('#tut-board')).includes(TUT_ANCHOR.title));
  });

  test('튜토리얼 건너뛰기: 어느 단계에서든 바로 본게임, 이후 다시 나오지 않는다', async () => {
    await openGame(page, server.base, { title: true });
    await page.click('#title-start');
    await page.click('#tut-next');
    await page.click('#tut-skip');
    assert.equal(await page.isHidden('#tutorial'), true);
    assert.ok(await page.getAttribute('#card', 'data-card-id'));
    await openGame(page, server.base, { title: true });
    await page.click('#title-start');
    assert.equal(await page.isHidden('#tutorial'), true);
  });

  test('이어하기: 진행 중 라운드가 있으면 타이틀에 이어하기, 누르면 그 자리에서 계속', async () => {
    await openGame(page, server.base);
    for (let k = 0; k < 2; k++) { const c = await currentCard(page); await clickPlace(page, c.answer); }
    await openGame(page, server.base, { title: true });
    assert.match(await page.innerText('#title-continue'), /카드 3 \/ 12/);
    assert.match(await page.innerText('#title-progress'), /도감 2 \/ 12/);
    await page.click('#title-continue');
    assert.equal(await page.isHidden('#tutorial'), true, '진행 기록이 있으면 튜토리얼을 자동으로 열지 않는다');
    assert.equal(await page.getAttribute('#progress', 'data-index'), '2');
    // 처음 화면 버튼으로 돌아가기
    await page.click('#btn-home');
    assert.equal(await page.isVisible('#title-screen'), true);
  });

  test('하는 방법 → 튜토리얼 다시 하기, 타이틀에서 도감 열고 닫기', async () => {
    await openGame(page, server.base, { title: true });
    await page.click('#title-dogam');
    await page.waitForSelector('#dogam:not([hidden])');
    await page.click('#btn-dogam-close');
    assert.equal(await page.isVisible('#title-screen'), true);
    await page.click('#title-howto');
    assert.match(await page.innerText('#modal-body'), /사건의 성격/);
    await page.click('#howto-tutorial');
    await page.waitForSelector('#tutorial:not([hidden])');
    assert.equal(await stepOf(), 'eras');
  });

  test('튜토리얼 키보드: 카드 Enter → 방향키 → Enter로 배치', async () => {
    await openGame(page, server.base, { title: true });
    await page.click('#title-start');
    await page.click('#tut-next');
    await page.click('#tut-more');
    await page.focus('#tut-card');
    await page.keyboard.press('Enter');
    // 첫 칸(고구려 건국기)에서 시작해 방향키로 정답 칸까지
    assert.equal(await page.evaluate(() => document.activeElement?.closest('#tut-board') !== null), true);
    const ni = NATIONS.findIndex((n) => n.id === TUT_CARD.answer.nation);
    const ei = ERAS.findIndex((e) => e.id === TUT_CARD.answer.era);
    for (let k = 0; k < ni; k++) await page.keyboard.press('ArrowDown');
    for (let k = 0; k < ei; k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#tut-fb[data-result="correct"]');
  });
});

describe('도감의 견해가 나뉘는 기록', () => {
  for (const [label, data, list] of [
    ['샘플', 'data/sample-cards.json', SAMPLE],
    ['실제 데이터', null, SAMGUK],
  ]) {
    test(`${label}: disputed 카드는 판정 칸이 아니라 별도 영역에, disputed_note와 함께`, { skip: !list && 'samguk.json 없음' }, async () => {
      const disputed = list.filter((c) => c.disputed);
      await openGame(page, server.base, { data });
      await page.click('#btn-dogam');
      await page.waitForSelector('#dogam:not([hidden])');
      assert.equal(await page.locator('#dogam-grid .entry.disputed').count(), 0, '판정 칸에 섞이면 안 된다');
      assert.equal(await page.locator('#dogam-disputed .disputed-card').count(), disputed.length);
      for (const c of disputed) {
        const box = page.locator(`#dogam-disputed .disputed-card[data-id="${c.id}"]`);
        const text = await box.innerText();
        assert.match(text, /견해가 나뉨/);
        assert.ok(text.includes(c.disputed_note), `${c.id} note`);
      }
      // 판정 칸 수집 수 분모는 판정 카드만
      const counts = await page.locator('#dogam-grid .cell-count').allInnerTexts();
      assert.ok(counts.every((t) => /^0 \/ [1-3]$/.test(t)), counts.join(','));
      await page.click(`#dogam-disputed [data-entry="${disputed[0].id}"]`);
      assert.match(await page.innerText('#dogam-detail'), /판정 제외/);
      assert.ok((await page.innerText('#dogam-disputed-note')).includes(disputed[0].disputed_note));
    });
  }
});

describe('라운드 결과와 플레이 기록', () => {
  test('결과 화면: 정답 수, 단서 단계 분포, 새로 수집한 카드, 오답 해설 다시 보기', async () => {
    await openGame(page, server.base);
    let wrongCard = null;
    await playRound((i, card) => {
      if (i === 0) return { correct: true, level: 3 };
      if (i === 1) { wrongCard = card; return { correct: false, level: 2 }; }
      return { correct: true, level: 1 };
    });
    await page.waitForSelector('#modal[data-kind="cleared"]:not([hidden])');
    assert.equal(await page.innerText('#result-right'), '11');
    const counts = await page.locator('#result-levels .level-row').evaluateAll((rows) => rows.map((r) => Number(r.dataset.count)));
    assert.deepEqual(counts, [10, 1, 1]);
    assert.equal(await page.locator('#result-new .chip').count(), 11);
    const item = page.locator(`#result-wrong details[data-id="${wrongCard.id}"]`);
    assert.equal(await item.count(), 1);
    assert.equal(await item.locator('p').first().isVisible(), false);
    await item.locator('summary').click();
    assert.equal(await item.locator('p').first().innerText(), wrongCard.explanation);
  });

  test('이미 수집한 카드를 다시 맞히면 "새로 수집"에 넣지 않는다', async () => {
    await openGame(page, server.base);
    await playRound();
    await page.click('#modal-retry');
    await playRound();
    await page.waitForSelector('#modal[data-kind="cleared"]:not([hidden])');
    assert.equal(await page.locator('#result-new .chip').count(), 0);
  });

  test('플레이 기록: 끝난 라운드마다 누적, 새로고침 유지, JSON 내보내기', async () => {
    await openGame(page, server.base);
    await playRound((i) => ({ correct: i !== 0, level: i < 3 ? 2 : 1 }));
    await page.click('#modal-retry');
    await playRound(() => ({ correct: false, level: 1 }));
    await page.waitForSelector('#modal[data-kind="failed"]:not([hidden])');
    // 도중에 버린 라운드는 기록하지 않는다
    await page.click('#modal-retry');
    const c = await currentCard(page);
    await clickPlace(page, c.answer);
    await page.click('#btn-new');
    await page.click('#modal-confirm');

    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    await page.click('#btn-dogam');
    assert.equal(await page.getAttribute('#play-record', 'data-rounds'), '2');
    assert.match(await page.innerText('#rec-rounds'), /2회 \(클리어 1 · 실패 1\)/);
    assert.match(await page.innerText('#rec-rate'), /65% \(11 \/ 17장\)/);
    // 단서 단계: 라운드1 = 2단계 3장 + 1단계 9장, 라운드2 = 1단계 5장 → (14*1 + 3*2) / 17
    assert.match(await page.innerText('#rec-level'), /1\.18 \(1단계 14 · 2단계 3 · 3단계 0\)/);

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
    assert.match(download.suggestedFilename(), /^hanyang-playlog-\d{8}-\d{4}\.json$/);
    const log = JSON.parse(readFileSync(await download.path(), 'utf8'));
    assert.equal(log.format, 'hanyang-dogam-playlog');
    assert.equal(log.dataFile, 'sample-cards.json');
    assert.equal(log.history.length, 2);
    assert.deepEqual(log.history.map((h) => h.status), ['cleared', 'failed']);
    assert.deepEqual(log.history[0].levels, [9, 3, 0]);
    assert.equal(log.history[0].placements.length, 12);
    assert.equal(log.stats.rounds, 2);
    // 샘플은 판정 카드가 12장뿐이라 매 라운드 같은 12장: 라운드1 정답 11장 + 버린 라운드에서 맞힌 1장(이미 수집했을 수도 있음)
    assert.equal(log.collection.collected.length, Number(await page.getAttribute('#dogam-count', 'data-collected')));
    assert.ok([11, 12].includes(log.collection.collected.length));
  });
});

describe('진행 초기화와 낭독 알림', () => {
  test('진행 초기화는 두 번 확인 후 도감·기록·튜토리얼 표시를 지우고 처음 화면으로', async () => {
    await openGame(page, server.base);
    await playRound((i) => ({ correct: i !== 0, level: 1 }));
    await page.click('#modal-dogam');
    assert.equal(await page.getAttribute('#play-record', 'data-rounds'), '1');
    await page.click('#btn-reset');
    assert.equal(await page.getAttribute('#modal', 'data-kind'), 'reset1');
    await page.click('#reset-cancel');
    assert.equal(await page.getAttribute('#dogam-count', 'data-collected'), '11', '취소하면 그대로');
    await page.click('#btn-reset');
    await page.click('#reset-next');
    assert.equal(await page.getAttribute('#modal', 'data-kind'), 'reset2');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'reset-cancel', '기본 포커스는 취소');
    await page.click('#reset-confirm');
    assert.equal(await page.isVisible('#title-screen'), true);
    assert.equal(await page.locator('#title-continue').count(), 0);
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await page.getAttribute('#dogam-progress', 'data-collected'), '0');
    await page.click('#btn-dogam');
    assert.equal(await page.getAttribute('#play-record', 'data-rounds'), '0');
  });

  test('화면 낭독용 알림: 정답·오답과 남은 먹물을 role=status 영역에 알린다', async () => {
    await openGame(page, server.base);
    assert.equal(await page.getAttribute('#announcer', 'role'), 'status');
    const c1 = await currentCard(page);
    await clickPlace(page, c1.answer);
    await page.waitForFunction(() => document.getElementById('announcer').textContent.length > 0);
    const t1 = await page.innerText('#announcer');
    assert.match(t1, /^정답\./);
    assert.ok(t1.includes(c1.title));
    assert.match(t1, /먹물 5개 남음/);
    const c2 = await currentCard(page);
    await clickPlace(page, wrongCell(c2));
    await page.waitForFunction(() => document.getElementById('announcer').textContent.startsWith('오답'));
    assert.match(await page.innerText('#announcer'), /먹물 1개 소모, 4개 남음/);
  });

  test('정답·오답은 색 말고도 기호와 글자로 구분된다', async () => {
    await openGame(page, server.base);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const c1 = await currentCard(page);
    await clickPlace(page, c1.answer);
    const c2 = await currentCard(page);
    await clickPlace(page, wrongCell(c2));
    const ok = await page.locator(`.chip-ok[data-id="${c1.id}"]`).evaluate((n) => [getComputedStyle(n, '::before').content, n.innerText]);
    const bad = await page.locator(`.chip-bad[data-id="${c2.id}"]`).evaluate((n) => [getComputedStyle(n, '::before').content, n.textContent]);
    assert.match(ok[0], /○/);
    assert.match(bad[0], /✕/);
    assert.match(bad[1], /오답 공개/);
    assert.match(await page.innerText('#fb .fb-head'), /오답/);
  });
});

describe('데이터가 바뀌면 진행 중 라운드를 버린다', () => {
  test('샘플로 진행하다 samguk으로 바꾸면 라운드는 새로, 수집 기록은 samguk에 있는 id만 남는다', { skip: !SAMGUK && 'samguk.json 없음' }, async () => {
    await openGame(page, server.base, { data: 'data/sample-cards.json' });
    const placed = [];
    for (let k = 0; k < 3; k++) { const c = await currentCard(page); placed.push(c.id); await clickPlace(page, c.answer); }
    const sampleOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-dogam:save:v1')).round.order);
    const savedId = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-dogam:save:v1')).dataId);
    assert.match(savedId, /sample-cards\.json\|16\|[0-9a-f]{8}$/);

    await openGame(page, server.base, { data: null });
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hanyang-dogam:save:v1')));
    assert.match(save.dataId, /samguk\.json\|44\|/);
    assert.equal(await page.getAttribute('#progress', 'data-index'), '0', '라운드는 처음부터');
    assert.notDeepEqual(save.round.order, sampleOrder);
    const samgukIds = new Set(SAMGUK.map((c) => c.id));
    const kept = placed.filter((id) => samgukIds.has(id));
    assert.deepEqual(Object.keys(save.collection).sort(), kept.sort(), '수집 기록은 지금 덱에 있는 id만');
    assert.equal(await page.getAttribute('#dogam-progress', 'data-collected'), String(kept.filter((id) => !SAMGUK.find((c) => c.id === id).disputed).length));

    // 같은 데이터로 다시 열면 라운드가 그대로 복원된다
    const c = await currentCard(page, new Map(SAMGUK.map((x) => [x.id, x])));
    await clickPlace(page, c.answer);
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await page.getAttribute('#progress', 'data-index'), '1');
  });

  test('식별자가 없는 옛 저장의 라운드는 버리고 수집 기록은 남긴다', async () => {
    await openGame(page, server.base);
    const c = await currentCard(page);
    await clickPlace(page, c.answer);
    await page.evaluate(() => {
      const k = 'hanyang-dogam:save:v1';
      const s = JSON.parse(localStorage.getItem(k));
      delete s.dataId;
      localStorage.setItem(k, JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await page.getAttribute('#progress', 'data-index'), '0');
    assert.equal(await page.getAttribute('#dogam-progress', 'data-collected'), '1');
  });
});
