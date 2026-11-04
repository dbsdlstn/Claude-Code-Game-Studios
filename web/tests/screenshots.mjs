// 화면별 스크린샷을 production/qa/evidence/web/에 남긴다: node web/tests/screenshots.mjs
// 실제 데이터(assets/data/cards/samguk.json)가 있으면 그것으로, 없으면 샘플 데이터로 찍는다.
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  chromium, startServer, openGame, currentCard, wrongCell, dragTo, clickPlace, cellSel, REPO_ROOT,
  SAMGUK, SAMGUK_BY_ID, SAMPLE_BY_ID,
} from './helpers.mjs';

const OUT = path.join(REPO_ROOT, 'production', 'qa', 'evidence', 'web');
mkdirSync(OUT, { recursive: true });
const BY_ID = SAMGUK ? SAMGUK_BY_ID : SAMPLE_BY_ID;
const DATA = SAMGUK ? null : 'data/sample-cards.json';
const cardNow = (p) => currentCard(p, BY_ID);

const server = await startServer();
const browser = await chromium.launch();
const shot = async (page, name) => {
  await page.waitForTimeout(150);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  console.log('saved', path.relative(REPO_ROOT, file));
};
const fresh = async (title = false) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await openGame(page, server.base, { seed: 42, data: DATA, title });
  return { ctx, page };
};
/** 라운드를 끝까지 둔다. 순번 % 4 === 2인 카드는 오답. 도감 완성 화면이 뜨면 멈춘다. */
async function playRound(page, { wrongEvery = 4 } = {}) {
  let i = 0;
  while (await page.getAttribute('#card', 'data-card-id')) {
    const card = await cardNow(page);
    await clickPlace(page, wrongEvery && i % wrongEvery === 2 ? wrongCell(card) : card.answer);
    i++;
    if (await page.getAttribute('#modal', 'data-kind') === 'complete') return;
  }
}

try {
  // 타이틀과 튜토리얼
  let { ctx, page } = await fresh(true);
  await shot(page, '00-title.png');
  await page.click('#title-start');
  await page.waitForSelector('#tutorial:not([hidden])');
  await shot(page, '00a-tutorial-eras.png');
  await page.click('#tut-next');
  await page.click('#tut-more');
  await shot(page, '00b-tutorial-relation.png');
  const tc = JSON.parse(readFileSync(new URL('../../assets/data/cards/tutorial.json', import.meta.url), 'utf8')).cards[0];
  await page.click('#tut-card .card-head');
  await page.click(`#tut-board .cell[data-nation="${tc.answer.nation}"][data-era="${tc.answer.era}"]`);
  await page.waitForTimeout(350);
  await shot(page, '00c-tutorial-explain.png');
  await ctx.close();

  ({ ctx, page } = await fresh());
  await shot(page, '01-board.png');
  await page.click('#more-clue');
  await page.click('#more-clue');
  await shot(page, '02-clues-expanded.png');
  await page.locator('#card .ref-link').first().focus();
  await shot(page, '02a-ref-highlight.png');
  await page.focus('#card');

  let card = await cardNow(page);
  // 드래그 도중(칸 강조)
  const from = await page.locator('#card .card-head').boundingBox();
  const to = await page.locator(cellSel(card.answer)).boundingBox();
  await page.mouse.move(from.x + 30, from.y + 12);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await shot(page, '03a-dragging.png');
  await page.mouse.up();
  await page.waitForSelector('#fb[data-result="correct"]');
  await page.waitForTimeout(450); // 도장이 찍힌 직후
  await shot(page, '03-correct.png');

  card = await cardNow(page);
  await dragTo(page, wrongCell(card));
  await page.waitForSelector('#fb[data-result="wrong"]');
  await page.waitForTimeout(300); // 먹물 번짐 중(놓은 칸), 정답 칸 초록
  await shot(page, '04-wrong.png');

  // 키보드 조작: 카드 Enter → 방향키
  await page.focus('#card');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await shot(page, '04a-keyboard.png');
  await page.keyboard.press('Escape');

  await playRound(page);
  await page.waitForSelector('#modal[data-kind="cleared"]:not([hidden])');
  await page.locator('#result-wrong details').first().locator('summary').click();
  await page.waitForTimeout(600);
  await shot(page, '06-clear.png');
  await page.click('#modal-dogam');
  await page.click('#dogam .entry[data-state="collected"]');
  await shot(page, '05-dogam.png');
  await page.locator('#dogam-disputed .entry').first().click();
  await page.locator('#play-record').scrollIntoViewIfNeeded();
  await shot(page, '05a-dogam-disputed-record.png');
  await page.click('#btn-reset');
  await page.click('#reset-next');
  await shot(page, '05b-reset-confirm.png');
  await page.click('#reset-cancel');
  await ctx.close();

  ({ ctx, page } = await fresh());
  for (let k = 0; k < 5; k++) {
    card = await cardNow(page);
    await clickPlace(page, wrongCell(card));
  }
  await page.waitForSelector('#modal[data-kind="failed"]:not([hidden])');
  await page.waitForTimeout(600);
  await shot(page, '07-fail.png');
  await ctx.close();

  // 도감 완성: 오답 없이 라운드를 반복
  ({ ctx, page } = await fresh());
  for (let round = 0; round < 6; round++) {
    await playRound(page, { wrongEvery: 0 });
    if (await page.getAttribute('#modal', 'data-kind') === 'complete') break;
    await page.click('#modal-retry');
  }
  await page.waitForSelector('#modal[data-kind="complete"]:not([hidden])');
  await page.waitForTimeout(600);
  await shot(page, '08-dogam-complete.png');
  await page.click('#modal-dogam');
  await page.click('#dogam .entry[data-state="collected"] >> nth=4');
  await shot(page, '09-dogam-full.png');
  await ctx.close();
} finally {
  await browser.close();
  server.stop();
}
