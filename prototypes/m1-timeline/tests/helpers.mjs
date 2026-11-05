// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// E2E·스크린샷 공용 도우미. 정적 서버(python3 -m http.server)와 사전 설치된 Playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { buildTimeline, correctGaps, isCorrectGap } from '../js/rules.js';
import { normalizeDeck } from '../js/data.js';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
export const { chromium, devices } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROTO_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
export const SAMPLE = JSON.parse(readFileSync(path.join(PROTO_ROOT, 'data', 'sample.json'), 'utf8'));
export const BY_ID = new Map([...SAMPLE.cards, ...SAMPLE.anchors].map((c) => [c.id, c]));
// 실제 데이터: 스키마 v2가 있으면 그것, 없으면 임시 형식 초안(설정의 dataUrls 순서와 같다).
const V2_PATH = path.join(REPO_ROOT, 'assets', 'data', 'cards', 'v2', 'goguryeo-m1.json');
const DRAFT_PATH = path.join(REPO_ROOT, 'assets', 'data', 'cards', 'v2-draft', 'goguryeo-m1.json');
export const REAL_PATH = existsSync(V2_PATH) ? V2_PATH : DRAFT_PATH;
/** 콘텐츠 세션의 실제 고구려 초안(정규화 후). 없으면 null. */
export const REAL = existsSync(REAL_PATH) ? normalizeDeck(JSON.parse(readFileSync(REAL_PATH, 'utf8'))).deck : null;
/** 연표 기준 카드 줄의 기대 표시(앵커의 재위 기간, 없으면 즉위 연도) — 데이터에서 계산한다. */
export function expectedAnchorYears(deck) {
  return [...deck.anchors].sort((a, b) => a.order - b.order).map((a) => a.reign_range ?? a.year_label.split('(')[0].trim());
}
export const REAL_BY_ID = new Map(REAL ? [...REAL.cards, ...REAL.anchors].map((c) => [c.id, c]) : []);

/** 모바일 세로 390×844(터치)와 데스크톱 1280×720. */
export const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
  desktop: { viewport: { width: 1280, height: 720 } },
};

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

/** 저장소 루트에서 정적 서버(실제 데이터 경로 ../../assets/...를 볼 수 있게). */
export async function startServer() {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', REPO_ROOT], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/prototypes/m1-timeline/index.html`)).ok) return { base, stop: () => proc.kill() }; } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error('정적 서버가 뜨지 않았다');
}

/** data: 'data/sample.json'(기본) 또는 null(설정의 기본 경로 = 실제 초안). */
export async function openProto(page, base, { seed = 7, data = 'data/sample.json', participant = null } = {}) {
  const q = new URLSearchParams({ seed: String(seed) });
  if (data) q.set('data', data);
  if (participant) q.set('participant', participant);
  await page.goto(`${base}/prototypes/m1-timeline/index.html?${q}`);
  await page.waitForSelector('body[data-ready="true"]');
}

export async function currentCard(page, byId = BY_ID) {
  const id = await page.getAttribute('#card', 'data-card-id');
  return id ? byId.get(id) : null;
}

/** 화면의 연표 앵커를 읽어 맞는 칸과 틀린 칸(가장 먼 칸, near면 한 칸 차이)을 계산한다. 칸 k = 앵커 k 이후. */
export async function gapsFor(page, card, { near = false } = {}) {
  const items = await page.locator('#timeline .row-anchor').evaluateAll((rows) => rows.map((r) => ({ id: r.dataset.id, order: Number(r.dataset.order), kind: 'anchor' })));
  const t = buildTimeline([], []).concat(items);
  const right = correctGaps(t, card.order)[0];
  const ks = await page.locator('#timeline .gap').evaluateAll((g) => g.map((x) => Number(x.dataset.gap)));
  const others = ks.filter((k) => !isCorrectGap(t, k, card.order));
  const wrong = near ? others.find((k) => Math.abs(k - right) === 1) : others.sort((a, b) => Math.abs(b - right) - Math.abs(a - right))[0];
  return { right, wrong };
}

/** 틈 누르기: 모바일은 tap 후 "이 자리에 꽂기" 확인(D61), 데스크톱은 click 한 번. */
export async function pressGap(page, k, mobile) {
  const g = page.locator(`#timeline .gap[data-gap="${k}"]`);
  await g.scrollIntoViewIfNeeded();
  if (mobile) {
    await g.tap();
    await page.locator('#confirm-place').tap();
  } else {
    await g.click();
  }
  await page.waitForSelector('#result');
}

/** 저장소 내용을 바꾸고 다시 연다(빈 세션 등 상태 만들기). fn(save) → save. */
export async function editSave(page, fn) {
  await page.evaluate((src) => {
    const k = 'hanyang-m1:save:v2';
    const s = JSON.parse(localStorage.getItem(k));
    localStorage.setItem(k, JSON.stringify((0, eval)(src)(s)));
  }, `(${fn.toString()})`);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
}
