// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D75)
// 처음 안내(D74-5)와 모바일 가림(B4): node --test prototypes/m1-timeline/tests/e2e-ux.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openProto, currentCard, gapsFor, VIEWPORTS } from './helpers.mjs';

let server;
let browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.stop(); });

async function withPage(opts, fn) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  try { await fn(page); } finally { await ctx.close(); }
}

/** 요소가 화면 안에 있고, 그 가운데 점에서 맨 위 요소가 자기 자신(또는 자손)인지. */
async function visibleOnTop(page, sel) {
  return page.locator(sel).evaluate((n) => {
    const r = n.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight || r.height === 0) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === n || n.contains(top));
  });
}

test('처음 안내: 처음 실행에 4장, 다음·건너뛰기, 다시 열면 안 나옴, 도감에서 다시 보기', () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base, { intro: null });
  await page.waitForSelector('#intro:not([hidden])');
  const titles = [];
  for (let i = 0; i < 4; i++) {
    assert.equal(await page.getAttribute('#intro', 'data-step'), String(i));
    titles.push(await page.innerText('#intro-title'));
    await page.locator('#intro-next').tap();
  }
  assert.deepEqual(titles, ['사료를 읽습니다', '칸을 고릅니다', '단서는 승급을 늦춥니다', '틀린 카드는 다시 나옵니다']);
  assert.equal(await page.locator('#intro:not([hidden])').count(), 0);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator('#intro:not([hidden])').count(), 0, '한 번 본 뒤에는 나오지 않는다');
  await page.locator('#btn-dogam').tap();
  await page.locator('#btn-intro').tap();
  await page.waitForSelector('#intro:not([hidden])');
  await page.locator('#intro-skip').tap();
  assert.equal(await page.locator('#intro:not([hidden])').count(), 0);
}));

test('처음 안내: 건너뛰기도 본 것으로 친다', () => withPage(VIEWPORTS.desktop, async (page) => {
  await openProto(page, server.base, { intro: null });
  await page.waitForSelector('#intro:not([hidden])');
  await page.click('#intro-skip');
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator('#intro:not([hidden])').count(), 0);
}));

test('B4 모바일: 아래쪽 칸을 골라도 확정 막대가 가려지지 않고, 결과의 ○/✕·고른 칸·맞는 칸·상자 줄이 한 화면에 보인다', () => withPage(VIEWPORTS.mobile, async (page) => {
  await openProto(page, server.base);
  const card = await currentCard(page);
  const { right } = await gapsFor(page, card);
  const ks = await page.locator('#timeline .gap').evaluateAll((g) => g.map((x) => Number(x.dataset.gap)));
  const far = ks.filter((k) => k !== right).sort((a, b) => Math.abs(b - right) - Math.abs(a - right))[0];
  for (const k of [Math.max(...ks), Math.min(...ks)]) {
    const g = page.locator(`#timeline .gap[data-gap="${k}"]`);
    await g.scrollIntoViewIfNeeded();
    await g.tap();
    assert.ok(await visibleOnTop(page, '#confirm-place'), `칸 ${k}: 확정 버튼이 보이고 눌린다`);
    assert.ok(await visibleOnTop(page, '.gap-pending .gap'), `칸 ${k}: 고른 칸이 카드나 막대에 가리지 않는다`);
    await page.locator('#cancel-place').tap();
  }
  const g = page.locator(`#timeline .gap[data-gap="${far}"]`);
  await g.scrollIntoViewIfNeeded();
  await g.tap();
  await page.locator('#confirm-place').tap();
  await page.waitForSelector('#result');
  for (const sel of ['#result', '#result-where', '#result-box', '#btn-next']) {
    assert.ok(await page.locator(sel).evaluate((n) => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), `${sel}가 첫 화면에 보인다`);
  }
}));
