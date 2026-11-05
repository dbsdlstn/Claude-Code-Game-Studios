// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D82)
// M2 규칙 단위 테스트: 여러 덱 합치기·덱 목록, 나라별 저장(카드 id 기준, M1 저장 옮기기), 보상 골격.
// node --test prototypes/m1-timeline/tests/m2.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG } from '../js/config.js';
import { mergeV2, loadManifest, loadNationDeck, normalizeDeck } from '../js/data.js';
import { migrateSave, nationStoreAdapter, lastNation } from '../js/save.js';
import { createStore } from '../js/storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const V2_PATH = path.join(here, '..', '..', '..', 'assets', 'data', 'cards', 'v2', 'goguryeo-m1.json');
const V2 = JSON.parse(readFileSync(V2_PATH, 'utf8'));
const R = CONFIG.rewards;

/** 메모리 localStorage 대용. */
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
}

describe('여러 덱(manifest)', () => {
  const anchors = V2.cards.filter((c) => c.kind === 'anchor');
  const sources = V2.cards.filter((c) => c.kind === 'source');
  test('파일 두 개(같은 앵커 반복 + 서로 다른 사료)를 하나로 합친다', () => {
    const a = { schema: 2, cards: [...anchors, ...sources.slice(0, 6)] };
    const b = { schema: 2, cards: [...anchors, ...sources.slice(6)] };
    const m = mergeV2([a, b]);
    assert.deepEqual(m.errors, []);
    assert.equal(m.raw.cards.length, anchors.length + sources.length);
  });
  test('같은 사료 id가 두 파일에 있거나 앵커 내용이 다르면 오류', () => {
    const dup = mergeV2([{ schema: 2, cards: [sources[0]] }, { schema: 2, cards: [sources[0]] }]);
    assert.match(dup.errors.join(), /두 번/);
    const diff = mergeV2([{ schema: 2, cards: [anchors[0]] }, { schema: 2, cards: [{ ...anchors[0], summary: '다름' }] }]);
    assert.match(diff.errors.join(), /파일마다 다르다/);
    assert.equal(diff.raw, null);
  });
  test('덱 목록: 경로는 manifest 기준, 나라별 파일을 읽어 정규화', async () => {
    const files = {
      'http://x/p/data/decks.json': { nations: [{ id: 'goguryeo', label: '고구려', files: ['../../cards/a.json', '../../cards/b.json'] }, { id: 'baekje', label: '백제', files: [] }] },
      'http://x/cards/a.json': { schema: 2, cards: [...anchors, ...sources.slice(0, 6)] },
      'http://x/cards/b.json': { schema: 2, cards: [...anchors, ...sources.slice(6)] },
    };
    // 브라우저 fetch처럼 상대 경로는 페이지 기준으로 푼다.
    const fetchFn = async (rel) => { const u = new URL(rel, 'http://x/p/index.html').href; return { ok: u in files, status: u in files ? 200 : 404, json: async () => files[u] }; };
    const m = await loadManifest(['data/missing.json', 'data/decks.json'], fetchFn, 'http://x/p/index.html');
    assert.deepEqual(m.nations.map((n) => n.files.length), [2, 0]);
    assert.equal(m.nations[0].files[0], 'http://x/cards/a.json');
    const n = await loadNationDeck(m.nations[0], fetchFn);
    assert.deepEqual(n.errors, []);
    assert.equal(n.deck.cards.length, sources.length);
    assert.equal(n.deck.anchors.length, anchors.length);
    await assert.rejects(loadNationDeck(m.nations[1], fetchFn), /아직 카드가 없다/);
  });
  test('프로토타입 덱 목록(data/decks.json): 고구려에 M1 파일, 나머지 나라는 준비 중', () => {
    const d = JSON.parse(readFileSync(path.join(here, '..', 'data', 'decks.json'), 'utf8'));
    assert.deepEqual(d.nations.map((n) => n.id), ['goguryeo', 'baekje', 'silla'], '가야 없음(D96)');
    const g = d.nations[0].files.map((f) => path.resolve(here, '..', 'data', f));
    assert.deepEqual(g, [V2_PATH]);
  });
});

describe('나라별 저장(카드 id 기준)', () => {
  test('M1 저장 모양을 기본 나라로 옮기고 카드 진행을 유지한다', () => {
    const old = { format: 'hanyang-dogam-mastery', dataId: 'd1', completed_sessions: 4, cards: { x: { box: 2 } }, current: null, log: [1], participant: 'P' };
    const m = migrateSave(old, 'goguryeo');
    assert.deepEqual(m.nations.goguryeo, { dataId: 'd1', completed_sessions: 4, current: null });
    assert.equal('completed_sessions' in m, false);
    assert.deepEqual(m.cards, { x: { box: 2 } });
  });
  test('나라마다 세션 번호는 따로, 카드 진행은 합쳐서 저장; 다른 나라 카드를 지우지 않는다', () => {
    const store = createStore('k', memStorage());
    const g = nationStoreAdapter(store, 'goguryeo', 'goguryeo');
    g.save({ dataId: 'g', completed_sessions: 3, cards: { g1: { box: 3 } }, current: null, log: [], participant: '-', rewards: { xp: 5 } });
    const b = nationStoreAdapter(store, 'baekje', 'goguryeo');
    assert.equal(b.load().completed_sessions, 0);
    b.save({ dataId: 'b', completed_sessions: 1, cards: { b1: { box: 1 } }, current: null, log: [], participant: '-', rewards: { xp: 9 } });
    const gl = g.load();
    assert.equal(gl.completed_sessions, 3);
    assert.deepEqual(Object.keys(gl.cards).sort(), ['b1', 'g1']);
    assert.equal(gl.rewards.xp, 9, '보상은 나라 공통');
    assert.equal(lastNation(store, 'goguryeo'), 'baekje');
  });
  test('덱 파일이 바뀌어도(dataId 다름) 카드 진행은 그대로 읽힌다', () => {
    const store = createStore('k', memStorage());
    const g = nationStoreAdapter(store, 'goguryeo', 'goguryeo');
    g.save({ dataId: 'old', completed_sessions: 2, cards: { g1: { box: 4 } }, current: null, log: [], participant: '-' });
    assert.equal(g.load().cards.g1.box, 4);
  });
});

describe('실제 덱 목록(assets/data/cards/v2/manifest.json): 파일이 있는 나라마다', () => {
  const dir = path.dirname(V2_PATH);
  const man = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const nation of man.nations.filter((n) => n.files.length)) {
    test(`${nation.label}: 파일을 모두 합치면 오류 없음, 사료 id 겹침 없음, 앵커 12 이하, 모든 카드가 한 칸에서만 정답`, async () => {
      const raws = nation.files.map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
      const m = mergeV2(raws);
      assert.deepEqual(m.errors, []);
      const { normalizeDeck } = await import('../js/data.js');
      const { validateDeck, buildTimeline, correctGaps } = await import('../js/rules.js');
      const n = normalizeDeck(m.raw);
      assert.deepEqual(n.errors, []);
      assert.deepEqual(validateDeck(n.deck), []);
      assert.equal(n.deck.nation, nation.id);
      assert.ok(n.deck.anchors.length <= 12, '나라별 앵커 상한 12(D85)');
      const t = buildTimeline(n.deck.anchors);
      for (const c of n.deck.cards) assert.equal(correctGaps(t, c.order).length, 1, c.id);
    });
  }

});

// D113: 고려(goryeo) 준비. 나라 이름과 임시 인장, 인장끼리 글자가 겹치지 않고 글자 대비 AA(4.5:1) 이상.
describe('나라 인장·이름(D110·D113)', () => {
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  test('인장 글자는 나라마다 다르고 대비 4.5:1 이상', () => {
    const seals = Object.entries(CONFIG.nationSeals);
    assert.equal(new Set(seals.map(([, s]) => s.ch)).size, seals.length);
    for (const [id, s] of seals) assert.ok(ratio(s.bg, s.fg) >= 4.5, `${id} ${ratio(s.bg, s.fg).toFixed(2)}`);
    assert.equal(CONFIG.nationSeals.goryeo.ch, '려');
  });
  test('nation: goryeo 덱은 "고려"로 표시된다', () => {
    const raw = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/silla-fixture.json'), 'utf8'));
    const { deck } = normalizeDeck(mergeV2([{ ...raw, cards: raw.cards.map((c) => ({ ...c, nation: 'goryeo' })) }]).raw);
    assert.equal(deck.nation, 'goryeo');
    assert.equal(deck.nation_label, '고려');
  });
});
