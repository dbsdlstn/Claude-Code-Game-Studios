// 화면별 스크린샷을 production/qa/evidence/web/에 남긴다: node web/tests/screenshots.mjs
// 실제 데이터(assets/data/cards/samguk.json)가 있으면 그것으로, 없으면 샘플 데이터로 찍는다.
import { mkdirSync } from 'node:fs';
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
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await openGame(page, server.base, { seed: 42, data: DATA });
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
  let { ctx, page } = await fresh();
  await shot(page, '01-board.png');
  await page.click('#more-clue');
  await page.click('#more-clue');
  await shot(page, '02-clues-expanded.png');

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
  await page.waitForTimeout(1200);
  await shot(page, '03-correct.png');

  card = await cardNow(page);
  await dragTo(page, wrongCell(card));
  await page.waitForSelector('#fb[data-result="wrong"]');
  await page.waitForTimeout(250); // 깜빡임 중(놓은 칸 붉게, 정답 칸 초록)
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
  await page.waitForTimeout(600);
  await shot(page, '06-clear.png');
  await page.click('#modal-dogam');
  await page.click('#dogam .entry[data-state="collected"]');
  await shot(page, '05-dogam.png');
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
