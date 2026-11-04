// E2E·스크린샷 공용 도우미. 정적 서버(python3 -m http.server)와 사전 설치된 Playwright를 쓴다.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..');
export const SAMPLE = JSON.parse(readFileSync(path.join(here, '..', 'data', 'sample-cards.json'), 'utf8'));
export const SAMPLE_BY_ID = new Map(SAMPLE.map((c) => [c.id, c]));
export const ERA_IDS = ['founding', 'peak', 'ending'];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

/** 저장소 루트에서 정적 서버를 띄운다. */
export async function startServer() {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', REPO_ROOT], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/web/index.html'); if (r.ok) return { base, stop: () => proc.kill() }; } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error('정적 서버가 뜨지 않았다');
}

/** 샘플 데이터·고정 시드로 게임을 연다. */
export async function openGame(page, base, { seed = 42 } = {}) {
  await page.goto(`${base}/web/index.html?data=data/sample-cards.json&seed=${seed}`);
  await page.waitForSelector('body[data-ready="true"]');
}

export async function currentCard(page) {
  const id = await page.getAttribute('#card', 'data-card-id');
  return id ? SAMPLE_BY_ID.get(id) : null;
}

export function wrongCell(card) {
  return { nation: card.answer.nation, era: ERA_IDS.find((e) => e !== card.answer.era) };
}

export const cellSel = ({ nation, era }) => `#board .cell[data-nation="${nation}"][data-era="${era}"]`;

/** 마우스로 카드를 끌어 칸에 놓는다(카드 머리 부분을 잡는다). */
export async function dragTo(page, cell) {
  const card = await page.locator('#card .card-head').boundingBox();
  const target = await page.locator(cellSel(cell)).boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 + 20, card.y + card.height / 2 + 10, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** 클릭 배치: 카드를 눌러 고르고 칸을 누른다. */
export async function clickPlace(page, cell) {
  await page.click('#card .card-head');
  await page.click(cellSel(cell));
}

export const inkOf = async (page) => Number(await page.getAttribute('#ink', 'data-ink'));
