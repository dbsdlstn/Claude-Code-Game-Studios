// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// 스크린샷: node prototypes/m1-timeline/tests/screenshots.mjs → production/qa/evidence/m1/
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, startServer, openProto, currentCard as cc, gapsFor, pressGap, VIEWPORTS, REPO_ROOT, REAL, REAL_BY_ID, BY_ID } from './helpers.mjs';

// 실제 콘텐츠 초안이 있으면 그것으로, 없으면 샘플로 찍는다.
const DATA = REAL ? null : 'data/sample.json';
const currentCard = (page) => cc(page, REAL ? REAL_BY_ID : BY_ID);

const OUT = path.join(REPO_ROOT, 'production', 'qa', 'evidence', 'm1');
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
try {
  for (const [name, opts] of Object.entries(VIEWPORTS)) {
    const mobile = name === 'mobile';
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const shot = async (file, full = false) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `${name}-${file}.png`), fullPage: full });
      console.log('saved', `production/qa/evidence/m1/${name}-${file}.png`);
    };
    await openProto(page, server.base, { data: DATA, seed: 11 });
    await shot('01-question');
    await shot('01b-question-full', true);
    await page.click('#btn-clue');
    await page.locator('#clues .ref-link').first().focus();
    await shot('02-clue-ref');
    let card = await currentCard(page);
    await pressGap(page, (await gapsFor(page, card)).right, mobile);
    await shot('03-correct');
    await page.click('#btn-next');
    card = await currentCard(page);
    await pressGap(page, (await gapsFor(page, card)).wrong, mobile);
    await shot('04-wrong');
    await page.click('#btn-next');
    while (await page.getAttribute('#card', 'data-card-id')) {
      card = await currentCard(page);
      await pressGap(page, (await gapsFor(page, card)).right, mobile);
      await page.click('#btn-next');
    }
    await page.waitForSelector('#summary:not([hidden])');
    await shot('05-summary');
    await page.click('#summary-dogam');
    await shot('06-dogam');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.stop();
}
