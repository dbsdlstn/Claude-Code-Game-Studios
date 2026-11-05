// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// E2E·스크린샷 공용 도우미. 정적 서버(python3 -m http.server)와 사전 설치된 Playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { buildTimeline, correctGaps, isCorrectGap } from '../js/rules.js';
import { normalizeDeck, mergeV2 } from '../js/data.js';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
export const { chromium, devices } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROTO_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
export const SAMPLE = JSON.parse(readFileSync(path.join(PROTO_ROOT, 'data', 'sample.json'), 'utf8'));
export const BY_ID = new Map([...SAMPLE.cards, ...SAMPLE.anchors].map((c) => [c.id, c]));
// 실제 데이터: 스키마 v2(설정의 첫 dataUrls).
const V2_PATH = path.join(REPO_ROOT, 'assets', 'data', 'cards', 'v2', 'goguryeo-m1.json');
export const REAL_PATH = V2_PATH;
/** 콘텐츠 세션의 실제 고구려 초안(정규화 후). 없으면 null. */
export const REAL = existsSync(REAL_PATH) ? normalizeDeck(JSON.parse(readFileSync(REAL_PATH, 'utf8'))).deck : null;
/** 연표 기준 카드 줄의 기대 표시(앵커의 재위 기간, 없으면 즉위 연도) — 데이터에서 계산한다. */
export function expectedAnchorYears(deck) {
  return [...deck.anchors].sort((a, b) => a.order - b.order).map((a) => a.reign_range ?? a.year_label.split('(')[0].trim());
}
export const REAL_BY_ID = new Map(REAL ? [...REAL.cards, ...REAL.anchors].map((c) => [c.id, c]) : []);
// 일반 모드의 실제 덱(M2): 덱 목록(manifest)의 기본 나라 파일을 모두 합친 것. 기대값은 여기서 계산한다(카드·앵커 수를 고정하지 않는다).
// 테스트 모드(?study=1)는 계속 REAL(M1 파일 하나).
const MANIFEST_PATH = existsSync(path.join(path.dirname(V2_PATH), 'manifest.json'))
  ? path.join(path.dirname(V2_PATH), 'manifest.json') : path.join(PROTO_ROOT, 'data', 'decks.json');
const MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
export const NATIONS = MANIFEST.nations;
/** 실제 manifest의 나라별 덱(파일이 있는 나라만). {deck, byId, info} */
export function nationDeck(id) {
  const n = MANIFEST.nations.find((x) => x.id === id);
  const files = (n?.files ?? []).map((f) => path.resolve(path.dirname(MANIFEST_PATH), f));
  if (!files.length || !files.every((f) => existsSync(f))) return null;
  const deck = normalizeDeck(mergeV2(files.map((f) => JSON.parse(readFileSync(f, 'utf8')))).raw).deck;
  return {
    deck, byId: new Map([...deck.cards, ...deck.anchors].map((c) => [c.id, c])),
    info: `${n.label} ${files.map((f) => path.basename(f)).join(', ')} · 카드 ${deck.cards.length}장 · 기준 ${deck.anchors.length}장`,
  };
}
export const FULL_NATION = MANIFEST.nations.find((n) => n.id === 'goguryeo');
const FULL_FILES = (FULL_NATION?.files ?? []).map((f) => path.resolve(path.dirname(MANIFEST_PATH), f));
export const FULL = FULL_FILES.length && FULL_FILES.every((f) => existsSync(f))
  ? normalizeDeck(mergeV2(FULL_FILES.map((f) => JSON.parse(readFileSync(f, 'utf8')))).raw).deck : null;
export const FULL_BY_ID = new Map(FULL ? [...FULL.cards, ...FULL.anchors].map((c) => [c.id, c]) : []);
/** 화면 아래 데이터 줄의 기대값: "고구려 a.json, b.json · 카드 n장 · 기준 m장". */
export const FULL_INFO = FULL ? `${FULL_NATION.label} ${FULL_FILES.map((f) => path.basename(f)).join(', ')} · 카드 ${FULL.cards.length}장 · 기준 ${FULL.anchors.length}장` : '';

/** 모바일 세로 390×844(터치)와 데스크톱 1280×720. 동작 줄이기(reduce): 세션 결과 정산이 한 번에 보인다(단계 진행은 e2e-m2에서 따로). */
export const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, reducedMotion: 'reduce' },
  desktop: { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' },
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
export async function openProto(page, base, { seed = 7, data = 'data/sample.json', participant = null, intro = '0', title = '0', nation = null, manifest = null } = {}) {
  const q = new URLSearchParams({ seed: String(seed) });
  if (intro !== null) q.set('intro', intro);
  if (title !== null) q.set('title', title);
  if (nation) q.set('nation', nation);
  if (manifest) q.set('manifest', manifest);
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
