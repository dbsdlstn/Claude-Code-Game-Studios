// 화면별 스크린샷을 production/qa/evidence/web/에 남긴다: node web/tests/screenshots.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, startServer, openGame, currentCard, wrongCell, dragTo, clickPlace, REPO_ROOT } from './helpers.mjs';

const OUT = path.join(REPO_ROOT, 'production', 'qa', 'evidence', 'web');
mkdirSync(OUT, { recursive: true });
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
  await openGame(page, server.base, { seed: 42 });
  return { ctx, page };
};

try {
  let { ctx, page } = await fresh();
  await shot(page, '01-board.png');
  await page.click('#more-clue');
  await page.click('#more-clue');
  await shot(page, '02-clues-expanded.png');
  let card = await currentCard(page);
  await dragTo(page, card.answer);
  await page.waitForSelector('#fb[data-result="correct"]');
  await page.waitForTimeout(1200); // 칸 깜빡임이 끝난 뒤
  await shot(page, '03-correct.png');
  card = await currentCard(page);
  await dragTo(page, wrongCell(card));
  await page.waitForSelector('#fb[data-result="wrong"]');
  await page.waitForTimeout(250); // 깜빡임 중(놓은 칸 붉게, 정답 칸 초록)
  await shot(page, '04-wrong.png');
  // 클리어까지 진행(3장마다 1장 오답)
  let i = 0;
  while (await page.getAttribute('#card', 'data-card-id')) {
    card = await currentCard(page);
    await clickPlace(page, i++ % 3 === 2 ? wrongCell(card) : card.answer);
  }
  await page.waitForSelector('#modal[data-kind="cleared"]:not([hidden])');
  await page.waitForTimeout(1200);
  await shot(page, '06-clear.png');
  await page.click('#modal-dogam');
  await page.click('#dogam .entry[data-state="collected"]');
  await shot(page, '05-dogam.png');
  await ctx.close();

  ({ ctx, page } = await fresh());
  for (let k = 0; k < 5; k++) {
    card = await currentCard(page);
    await clickPlace(page, wrongCell(card));
  }
  await page.waitForSelector('#modal[data-kind="failed"]:not([hidden])');
  await page.waitForTimeout(1200);
  await shot(page, '07-fail.png');
  await ctx.close();
} finally {
  await browser.close();
  server.stop();
}
