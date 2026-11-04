// 브라우저 E2E: node --test web/tests/e2e.test.mjs
import { test, before, after, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openGame, currentCard, wrongCell, cellSel, dragTo, clickPlace, inkOf, SAMPLE } from './helpers.mjs';

const START_INK = 5;
const PLAYABLE = SAMPLE.filter((c) => !c.anchor && !c.disputed);

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
  context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e));
  await openGame(page, server.base);
});
afterEach(async () => {
  assert.deepEqual(pageErrors.map(String), [], '페이지 스크립트 오류');
  await context.close();
});

describe('한양 도감 웹 빌드', () => {
  test('첫 화면: 보드 12칸, 열 머리글 시기 정의, 기준 카드 선배치, 먹물 5, 단서 1단계', async () => {
    assert.equal(await page.locator('#board .cell').count(), 12);
    const heads = await page.locator('#board .era-head').allInnerTexts();
    assert.equal(heads.length, 3);
    assert.match(heads[0], /건국기[\s\S]*건국 전승과 초창기/);
    assert.match(heads[1], /전성기[\s\S]*번영/);
    assert.match(heads[2], /결말기[\s\S]*멸망/);
    const anchors = await page.locator('#board .chip-anchor').allInnerTexts();
    assert.deepEqual(anchors.map((t) => t.replace(/^기준\s*/, '')).sort(), SAMPLE.filter((c) => c.anchor).map((c) => c.title).sort());
    assert.equal(await inkOf(page), START_INK);
    assert.equal(await page.locator('#clues .clue').count(), 1);
    const card = await currentCard(page);
    assert.ok(card && !card.anchor && !card.disputed);
    assert.ok(!(await page.locator('#card').innerText()).includes(card.title), '카드 이름이 숨겨져 있어야 한다');
  });

  test('단서 더 보기: 2단계(관계)·3단계(직접)가 열리고 3단계에서 버튼이 꺼진다', async () => {
    await page.click('#more-clue');
    assert.equal(await page.locator('#clues .clue').count(), 2);
    assert.equal(await page.getAttribute('#clues .clue:nth-child(2)', 'data-kind'), 'relation');
    await page.click('#more-clue');
    assert.equal(await page.locator('#clues .clue').count(), 3);
    assert.equal(await page.isDisabled('#more-clue'), true);
  });

  test('드래그 정답: 칸에 이름 공개, 해설 표시, 먹물 유지, 다음 카드', async () => {
    const card = await currentCard(page);
    await dragTo(page, card.answer);
    await page.waitForSelector('#fb[data-result="correct"]');
    assert.match(await page.innerText('#feedback'), new RegExp(card.title));
    assert.match(await page.innerText('#feedback'), new RegExp(card.explanation.slice(0, 10).replace(/[()]/g, '.')));
    assert.equal(await page.locator(`${cellSel(card.answer)} .chip-ok[data-id="${card.id}"]`).count(), 1);
    assert.equal(await inkOf(page), START_INK);
    assert.notEqual((await currentCard(page)).id, card.id);
  });

  test('드래그 오답: 먹물 -1, 정답 칸에 공개되고 카드 소모', async () => {
    const card = await currentCard(page);
    const wrong = wrongCell(card);
    await dragTo(page, wrong);
    await page.waitForSelector('#fb[data-result="wrong"]');
    assert.equal(await inkOf(page), START_INK - 1);
    assert.equal(await page.locator(`${cellSel(card.answer)} .chip-bad[data-id="${card.id}"]`).count(), 1);
    assert.equal(await page.locator(`${cellSel(wrong)} [data-id="${card.id}"]`).count(), 0);
    assert.notEqual((await currentCard(page)).id, card.id);
    assert.equal(await page.getAttribute('#progress', 'data-index'), '1');
  });

  test('클릭 배치: 카드 선택 후 칸 클릭. 선택 없이 칸만 누르면 놓이지 않는다', async () => {
    const card = await currentCard(page);
    await page.click(cellSel(card.answer));
    assert.equal(await page.getAttribute('#progress', 'data-index'), '0');
    await clickPlace(page, card.answer);
    await page.waitForSelector('#fb[data-result="correct"]');
    assert.equal(await page.getAttribute('#progress', 'data-index'), '1');
  });

  test('실패: 오답 5번이면 실패 화면, 재도전하면 먹물 5로 새 라운드', async () => {
    for (let i = 0; i < START_INK; i++) {
      const card = await currentCard(page);
      await clickPlace(page, wrongCell(card));
    }
    await page.waitForSelector('#modal[data-kind="failed"]:not([hidden])');
    assert.match(await page.innerText('#modal-title'), /먹물이 바닥/);
    assert.equal(await inkOf(page), 0);
    await page.click('#modal-retry');
    assert.equal(await page.isHidden('#modal'), true);
    assert.equal(await inkOf(page), START_INK);
    assert.equal(await page.getAttribute('#progress', 'data-index'), '0');
  });

  test('클리어: 오답 섞어 전부 놓으면 클리어 화면, 도감에 수집 반영', async () => {
    let i = 0;
    let right = 0;
    while (await page.getAttribute('#card', 'data-card-id')) {
      const card = await currentCard(page);
      const ok = i++ % 3 !== 0;
      if (ok) right++;
      await (i % 2 ? dragTo(page, ok ? card.answer : wrongCell(card)) : clickPlace(page, ok ? card.answer : wrongCell(card)));
    }
    assert.equal(i, PLAYABLE.length);
    await page.waitForSelector('#modal[data-kind="cleared"]:not([hidden])');
    assert.match(await page.innerText('#modal-body'), new RegExp(`${right} / ${PLAYABLE.length}`));
    await page.click('#modal-dogam');
    await page.waitForSelector('#dogam:not([hidden])');
    assert.equal(await page.getAttribute('#dogam-count', 'data-collected'), String(right));
    assert.equal(await page.locator('#dogam .entry[data-state="collected"]').count(), right);
    assert.equal(await page.locator('#dogam .entry[data-state="revealed"]').count(), PLAYABLE.length - right);
    const first = page.locator('#dogam .entry[data-state="collected"]').first();
    const id = await first.getAttribute('data-id');
    await first.click();
    const card = SAMPLE.find((c) => c.id === id);
    assert.equal(await page.innerText('#dogam-detail-title'), card.title);
    assert.match(await page.innerText('#dogam-detail'), /사실 확인 전/);
    assert.doesNotMatch(await page.innerText('#dogam-detail'), /\bnull\b|undefined/, '빈 값이 글자로 찍히면 안 된다');
  });

  test('도감: 수집 전 카드는 ？？？, disputed 카드는 해설용으로 표시', async () => {
    await page.click('#btn-dogam');
    await page.waitForSelector('#dogam:not([hidden])');
    assert.equal(await page.locator('#dogam .entry[data-state="unknown"]:not(.disputed)').first().innerText(), '？？？');
    await page.click('#dogam .entry.disputed');
    assert.match(await page.innerText('#dogam-detail'), /판정 제외/);
    await page.click('#btn-dogam-close');
    assert.equal(await page.isHidden('#dogam'), true);
  });

  test('저장: 새로고침 후 먹물·진행·보드·단서 단계·도감이 복원된다', async () => {
    const c1 = await currentCard(page);
    await dragTo(page, c1.answer);
    const c2 = await currentCard(page);
    await clickPlace(page, wrongCell(c2));
    await page.click('#more-clue');
    const c3 = await currentCard(page);
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await inkOf(page), START_INK - 1);
    assert.equal(await page.getAttribute('#progress', 'data-index'), '2');
    assert.equal((await currentCard(page)).id, c3.id);
    assert.equal(await page.locator('#clues .clue').count(), 2);
    assert.equal(await page.locator(`${cellSel(c1.answer)} .chip-ok[data-id="${c1.id}"]`).count(), 1);
    assert.equal(await page.locator(`${cellSel(c2.answer)} .chip-bad[data-id="${c2.id}"]`).count(), 1);
    await page.click('#btn-dogam');
    assert.equal(await page.getAttribute('#dogam-count', 'data-collected'), '1');
  });

  test('저장 불가 환경(localStorage 예외)에서도 플레이된다', async () => {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    await openGame(page, server.base);
    const card = await currentCard(page);
    await clickPlace(page, card.answer);
    await page.waitForSelector('#fb[data-result="correct"]');
  });
});
