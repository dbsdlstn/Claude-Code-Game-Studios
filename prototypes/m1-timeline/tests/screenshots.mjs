// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// 스크린샷: node prototypes/m1-timeline/tests/screenshots.mjs → production/qa/evidence/m2/ (M1 때 것은 evidence/m1에 남김)
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { runParticipant } from './study-driver.mjs';
import { chromium, startServer, openProto, currentCard as cc, gapsFor, pressGap, VIEWPORTS, REPO_ROOT, REAL, REAL_BY_ID, BY_ID, FULL, FULL_BY_ID } from './helpers.mjs';

// 실제 콘텐츠 초안이 있으면 그것으로, 없으면 샘플로 찍는다.
const DATA = FULL ? null : 'data/sample.json';
const currentCard = (page) => cc(page, FULL ? FULL_BY_ID : BY_ID);

const OUT = path.join(REPO_ROOT, 'production', 'qa', 'evidence', 'm2');
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
      console.log('saved', `production/qa/evidence/m2/${name}-${file}.png`);
    };
    // M2 타이틀(D82)
    await openProto(page, server.base, { data: DATA, seed: 11, title: null });
    await shot('00b-title');
    // 앵커 12개(D85 대비, 테스트 고정 데이터): 콘텐츠 반영 뒤에는 위 기본 덱 화면이 그대로 12개가 된다.
    await openProto(page, server.base, { data: 'tests/fixtures/goguryeo-12anchors.json', seed: 11 });
    await shot('20-twelve-anchors', true);
    // 백제(D93 실제 데이터, D101): 타이틀과 백제 연표(전체 높이)
    await openProto(page, server.base, { data: null, title: null, nation: 'baekje' });
    await shot('21-baekje-title');
    await page.click('#title-play');
    await shot('22-baekje-timeline', true);
    await page.evaluate(() => localStorage.clear());
    // 나라 3개(D104, 신라는 테스트 고정 데이터): 세로 목록
    await openProto(page, server.base, { data: null, title: null, manifest: 'tests/fixtures/manifest-three-nations.json' });
    await shot('23-three-nations-title');
    await page.evaluate(() => localStorage.clear());
    // 처음 안내(D74-5)
    await openProto(page, server.base, { data: DATA, seed: 11, intro: '1' });
    await shot('00-intro');
    await openProto(page, server.base, { data: DATA, seed: 11 });
    await shot('01-question');
    if (mobile) {
      const c0 = await currentCard(page);
      const g = page.locator(`#timeline .gap[data-gap="${(await gapsFor(page, c0)).right}"]`);
      await g.scrollIntoViewIfNeeded();
      await g.tap();
      await shot('01c-confirm');
      await page.locator('#cancel-place').tap();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await shot('01b-question-full', true);
    // 전체 화면 캡처는 뷰포트를 잠시 바꾸므로(이후 탭 좌표가 어긋남) 다시 연다.
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
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
    let retryShot = false;
    while (await page.getAttribute('#card', 'data-card-id')) {
      card = await currentCard(page);
      if (!retryShot && await page.locator('#retry-badge').count()) { await shot('04b-retry'); retryShot = true; }
      await pressGap(page, (await gapsFor(page, card)).right, mobile);
      await page.click('#btn-next');
    }
    await page.waitForSelector('#summary:not([hidden])');
    await shot('05-summary');
    await page.evaluate(() => { const sh = document.querySelector('#summary .sheet'); sh.scrollTop = sh.scrollHeight; });
    await shot('05b-summary-bottom');
    await page.evaluate(() => { document.querySelector('#summary .sheet').scrollTop = 0; });
    await page.click('#summary-dogam');
    await shot('06-dogam');
    await page.click('#tab-ach');
    await shot('06b-dogam-achievements');
    await page.click('#tab-titles');
    await shot('06c-dogam-titles');
    await page.click('#tab-note');
    await shot('06d-dogam-note');
    await page.click('#tab-cards');
    // M2: 학습한 뒤의 타이틀(이어하기, 레벨·연속일)
    await page.click('#dogam-close');
    await page.click('#btn-home');
    await shot('00c-title-continue');
    await ctx.close();

    // 사람 테스트 모드(D72): 한 참가자 전체 진행 중 화면마다 한 장.
    if (REAL) {
      const MAP = { 'menu-new': '07-study-create', menu: '08-study-menu', test: '09-study-test', 'learn-a': '10-study-learn-a', 'flash-front': '11-study-flash-front', 'flash-back': '12-study-flash-back', 'b-summary': '13-study-b-summary', 'menu-post1': '14-study-menu-post1', 'menu-done': '15-study-done' };
      const sctx = await browser.newContext({ ...opts, deviceScaleFactor: 2 });
      const sp = await sctx.newPage();
      // 진행자 메뉴 잠금(B5)
      await sp.goto(`${server.base}/prototypes/m1-timeline/index.html?study=1&participant=${mobile ? 'P1' : 'P2'}`);
      await sp.waitForSelector('#lock-code');
      await sp.waitForTimeout(300);
      await sp.screenshot({ path: path.join(OUT, `${name}-07a-study-lock.png`) });
      console.log('saved', `production/qa/evidence/m2/${name}-07a-study-lock.png`);
      const taken = new Set();
      const sshot = async (key) => {
        const file = MAP[key];
        if (!file || taken.has(key)) return;
        taken.add(key);
        await sp.waitForTimeout(300);
        await sp.screenshot({ path: path.join(OUT, `${name}-${file}.png`) });
        console.log('saved', `production/qa/evidence/m2/${name}-${file}.png`);
      };
      await runParticipant(sp, server.base, { participant: mobile ? 'P1' : 'P2', preset: mobile ? 'P1' : 'P2', deck: REAL, byId: REAL_BY_ID, mobile, shot: sshot });
      await sctx.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
