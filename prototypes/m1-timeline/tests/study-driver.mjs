// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D72)
// 사람 테스트 모드를 한 참가자로 끝까지 돈다(E2E와 스크린샷 공용). shot(name)은 화면마다 불린다(없으면 무시).
import { buildTimeline, correctGaps, isCorrectGap } from '../js/rules.js';
import { CONFIG } from '../js/config.js';
import { gapsFor, pressGap } from './helpers.mjs';

export const STUDY_PREFIX = CONFIG.study.storagePrefix;

export function studyUrl(base, { participant = null, stage = null, data = null, seed = 7 } = {}) {
  const q = new URLSearchParams({ study: '1', seed: String(seed) });
  if (participant) q.set('participant', participant);
  if (stage) q.set('stage', stage);
  if (data) q.set('data', data);
  return `${base}/prototypes/m1-timeline/index.html?${q}`;
}

async function ready(page) {
  await page.waitForSelector('body[data-ready="true"]');
}

async function press(page, sel, mobile) {
  const l = page.locator(sel);
  await l.scrollIntoViewIfNeeded();
  if (mobile) await l.tap(); else await l.click();
}

/** 진행자 메뉴에서 단계 버튼을 누른다. */
export async function goStage(page, stage, mobile) {
  await press(page, `#study-stages a[data-go="${stage}"]`, mobile);
  await ready(page);
}

/**
 * 테스트 한 단계(12장). 카드마다 answer(i, card) → 'right' | 'wrong' | 'unknown'.
 * @returns 고른 결과 목록
 */
export async function doTest(page, byId, mobile, answer, shot = async () => {}) {
  const out = [];
  for (let i = 0; ; i++) {
    if (await page.locator('#test-done').count()) break;
    const id = await page.getAttribute('#test-card', 'data-card-id');
    const card = byId.get(id);
    const kind = answer(i, card);
    if (kind === 'unknown') await press(page, '#test-unknown', mobile);
    else {
      const items = await page.locator('#test-timeline .row-anchor').evaluateAll((rows) => rows.map((r) => ({ id: r.dataset.id, order: Number(r.dataset.order), kind: 'anchor' })));
      const t = buildTimeline([], []).concat(items);
      const right = correctGaps(t, card.order)[0];
      const ks = await page.locator('#test-timeline .gap').evaluateAll((g) => g.map((x) => Number(x.dataset.gap)));
      const k = kind === 'right' ? right : ks.find((x) => !isCorrectGap(t, x, card.order));
      await press(page, `#test-timeline .gap[data-gap="${k}"]`, mobile);
    }
    await page.fill('#test-reason', `근거 ${i + 1}: ${card.title.slice(0, 2)}`);
    if (i === 0) await shot('test');
    await press(page, '#test-submit', mobile);
    await page.waitForFunction((n) => document.querySelector('#test-done') || Number(document.querySelector('#test-progress')?.dataset.index) === n, i + 1);
    out.push({ id, kind });
  }
  return out;
}

/** 방식 A 학습(main.js 화면): 세션마다 첫 카드 하나는 틀리고 나머지는 맞힌다. 단계가 끝날 때까지. */
export async function doLearnA(page, byId, mobile, shot = async () => {}) {
  let shotTaken = false;
  for (let guard = 0; guard < 200; guard++) {
    if (await page.locator('#study-done').count()) return;
    if (await page.locator('#summary:not([hidden])').count()) {
      const end = await page.getAttribute('#summary-next', 'data-end');
      await press(page, '#summary-next', mobile);
      if (end === '1') { await ready(page); return; }
      continue;
    }
    if (await page.locator('#btn-skip').count()) { await press(page, '#btn-skip', mobile); continue; }
    if (await page.locator('#result').count()) { await press(page, '#btn-next', mobile); continue; }
    const id = await page.getAttribute('#card', 'data-card-id');
    if (!id) throw new Error('A: 알 수 없는 화면');
    if (!shotTaken) { await shot('learn-a'); shotTaken = true; }
    const card = byId.get(id);
    const idx = Number(await page.getAttribute('#progress', 'data-index'));
    const { right, wrong } = await gapsFor(page, card);
    await pressGap(page, idx === 0 && !(await page.locator('#retry-badge').count()) ? wrong : right, mobile);
  }
  throw new Error('A: 끝나지 않음');
}

/** 방식 B 학습: 세션마다 첫 카드는 "몰랐다", 나머지는 "알았다". */
export async function doLearnB(page, mobile, shot = async () => {}) {
  let front = false;
  let backShot = false;
  for (let guard = 0; guard < 200; guard++) {
    if (await page.locator('#study-done').count()) return;
    if (await page.locator('#b-summary').count()) { await shot('b-summary'); await press(page, '#b-summary-next', mobile); continue; }
    if (await page.locator('#btn-skip').count()) { await press(page, '#btn-skip', mobile); continue; }
    if (await page.locator('#b-next').count()) { await press(page, '#b-next', mobile); continue; }
    if (await page.locator('#btn-flip').count()) {
      if (!front) { await shot('flash-front'); front = true; }
      await press(page, '#btn-flip', mobile);
      continue;
    }
    if (await page.locator('#btn-knew').count()) {
      if (!backShot) { await shot('flash-back'); backShot = true; }
      const idx = Number(await page.getAttribute('#b-progress', 'data-index'));
      const retry = await page.locator('#retry-badge').count();
      await press(page, idx === 0 && !retry ? '#btn-didnt' : '#btn-knew', mobile);
      continue;
    }
    throw new Error('B: 알 수 없는 화면');
  }
  throw new Error('B: 끝나지 않음');
}

/** 저장된 참가자 기록을 바꾸고(예: post0을 하루 전으로) 다시 연다. */
export async function editStudy(page, participant, fn) {
  await page.evaluate(([k, src]) => {
    const s = JSON.parse(localStorage.getItem(k));
    localStorage.setItem(k, JSON.stringify((0, eval)(src)(s)));
  }, [STUDY_PREFIX + participant, `(${fn.toString()})`]);
  await page.reload();
  await ready(page);
}

export async function readStudy(page, participant) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STUDY_PREFIX + participant);
}

/** 한 참가자: 메뉴 → 만들기(preset) → pre → 첫 방식 → 두 번째 방식 → post0 → (하루 뒤) post1. */
export async function runParticipant(page, base, { participant, preset, byId, mobile, data = null, shot = async () => {} }) {
  await page.goto(studyUrl(base, { participant, data }));
  await ready(page);
  await press(page, `#asg-${preset}`, mobile);
  await shot('menu-new');
  await press(page, '#study-create', mobile);
  await page.waitForSelector('#study-stages');
  await shot('menu');
  const order = await page.locator('#study-stages li').evaluateAll((li) => li.map((x) => x.dataset.stage));
  const results = {};
  for (const stage of order) {
    if (stage === 'post1') {
      // post0 직후는 권장 시간(18~30시간) 밖이라 경고, 하루 뒤로 옮기면 경고 없음.
      if (await page.getAttribute('#post1-timing', 'data-ok') !== '0') throw new Error('post0 직후 post1 경고가 없다');
      await editStudy(page, participant, (s) => { s.stages.post0.done_at = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); return s; });
      if (await page.getAttribute('#post1-timing', 'data-ok') !== '1') throw new Error('하루 뒤인데 post1 경고가 있다');
      await shot('menu-post1');
    }
    const next = await page.locator('#study-stages li.is-next').getAttribute('data-stage');
    if (next !== stage) throw new Error(`다음 단계가 ${stage}가 아니라 ${next}`);
    await goStage(page, stage, mobile);
    if (stage === 'learn-A') await doLearnA(page, byId, mobile, shot);
    else if (stage === 'learn-B') await doLearnB(page, mobile, shot);
    else {
      // pre: 3장마다 하나 "모르겠다", 짝수 번째 정답. post: 거의 다 정답.
      const ans = stage === 'pre' ? (i) => (i % 3 === 2 ? 'unknown' : i % 2 === 0 ? 'right' : 'wrong') : (i) => (i === 1 ? 'wrong' : 'right');
      results[stage] = await doTest(page, byId, mobile, ans, stage === 'pre' ? shot : async () => {});
      await shot(`${stage}-done`);
    }
    if (!(await page.locator('#study-stages').count())) {
      await press(page, '#btn-menu-done', mobile);
      await ready(page);
    }
  }
  await shot('menu-done');
  return { order, results };
}
