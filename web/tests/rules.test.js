// 규칙 모듈 단위 테스트: node --test web/tests/
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  NATIONS, ERAS, validateCards, anchorCards, playableCards, createRng, shuffle, createRound,
  roundStatus, currentCardId, revealNextClue, placeCard, boardCells, roundStats,
  recordInCollection, serializeRound, restoreRound, restoreCollection,
  buildRoundOrder, isDogamComplete, dogamProgress, releaseFilter,
  summarizeRound, historyStats, restoreHistory,
} from '../src/rules.js';
import { createStore } from '../src/storage.js';
import { loadCards, resolveDataUrls } from '../src/data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = path.join(here, '..', 'data', 'sample-cards.json');
const SAMGUK_PATH = path.join(here, '..', '..', 'assets', 'data', 'cards', 'samguk.json');
const START_INK = 5;
const SEED = 12345;

function loadSample() {
  return JSON.parse(readFileSync(SAMPLE_PATH, 'utf8'));
}

function setup() {
  const cards = loadSample();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const playable = playableCards(cards);
  return { cards, byId, playable, anchors: anchorCards(cards) };
}

/** 오답 칸 하나를 고른다(정답과 시기만 다른 칸). */
function wrongCell(card) {
  const era = ERAS.find((e) => e.id !== card.answer.era).id;
  return { nation: card.answer.nation, era };
}

function placeCurrent(state, byId, correct) {
  const card = byId.get(currentCardId(state));
  const cell = correct ? card.answer : wrongCell(card);
  return placeCard(state, byId, cell.nation, cell.era);
}

describe('카드 데이터 검증', () => {
  test('샘플 데이터는 스키마 v1 검증 오류가 없다', () => {
    const { errors } = validateCards(loadSample());
    assert.deepEqual(errors, []);
  });

  test('샘플 데이터: 12칸 각각 판정 카드 1장 이상, disputed는 판정 제외', () => {
    const { cards, playable } = setup();
    for (const n of NATIONS) for (const e of ERAS) {
      assert.ok(playable.some((c) => c.answer.nation === n.id && c.answer.era === e.id), `${n.id}:${e.id}`);
    }
    const disputed = cards.filter((c) => c.disputed);
    assert.ok(disputed.length >= 1);
    assert.ok(disputed.every((c) => !playable.includes(c)));
    assert.ok(playable.every((c) => !c.anchor));
  });

  test('samguk.json이 있으면 스키마 검증 오류가 없다', { skip: !existsSync(SAMGUK_PATH) && 'samguk.json 아직 없음' }, () => {
    const { errors } = validateCards(JSON.parse(readFileSync(SAMGUK_PATH, 'utf8')));
    assert.deepEqual(errors, []);
  });

  test('규칙 위반을 잡는다: 각 위반 카드에 해당 규칙 오류가 난다', () => {
    const base = loadSample();
    const card = base.find((c) => c.id === 'goguryeo-peak-01');
    const variant = (id, patch) => ({ ...structuredClone(card), id, ...patch(structuredClone(card)) });
    const broken = [
      variant('dup', () => ({})),
      variant('dup', () => ({})),
      variant('bad-answer', () => ({ answer: { nation: 'balhae', era: 'peak' } })),
      variant('bad-order', (c) => ({ clues: [c.clues[1], c.clues[0], c.clues[2]] })),
      variant('title-leak', (c) => ({ clues: [{ ...c.clues[0], text: `${c.title}의 장면` }, c.clues[1], c.clues[2]] })),
      variant('nation-leak', (c) => ({ clues: [{ ...c.clues[0], text: '고구려의 장면' }, c.clues[1], c.clues[2]] })),
      variant('bad-ref', (c) => ({ clues: [c.clues[0], { ...c.clues[1], refs: ['nope'] }, c.clues[2]] })),
      variant('non-anchor-ref', (c) => ({ clues: [c.clues[0], { ...c.clues[1], refs: ['goguryeo-founding-01'], text: '[졸본에서의 건국] 다음이다.' }, c.clues[2]] })),
      variant('empty-ref', (c) => ({ clues: [c.clues[0], { ...c.clues[1], refs: [] }, c.clues[2]] })),
      variant('no-note', () => ({ disputed: true, disputed_note: null })),
      variant('stray-note', () => ({ disputed_note: '있으면 안 됨' })),
      variant('no-license', () => ({ image: 'assets/art/cards/x.png' })),
      variant('no-era-in-exp', () => ({ explanation: '수도를 옮겼다.' })),
      variant('verified-no-by', () => ({ verified: true, verified_by: null })),
      variant('bad-difficulty', () => ({ difficulty: 4 })),
    ];
    const { errors } = validateCards([...base, ...broken]);
    const rulesOf = (id) => errors.filter((e) => e.id === id).map((e) => e.rule);
    assert.ok(rulesOf('dup').includes('R1'));
    assert.ok(rulesOf('bad-answer').includes('R2'));
    assert.ok(rulesOf('bad-order').includes('R3'));
    assert.ok(rulesOf('title-leak').includes('R5'));
    assert.ok(rulesOf('nation-leak').includes('R5'));
    assert.ok(rulesOf('bad-ref').includes('R4'));
    assert.ok(rulesOf('non-anchor-ref').includes('R4'), 'relation ref가 기준 카드가 아니면 오류(D10)');
    assert.ok(rulesOf('empty-ref').includes('R4'));
    assert.ok(rulesOf('no-note').includes('R6'));
    assert.ok(rulesOf('stray-note').includes('R6'));
    assert.ok(rulesOf('no-license').includes('R7'));
    assert.ok(rulesOf('no-era-in-exp').includes('FIELD'));
    assert.ok(rulesOf('verified-no-by').includes('R9'));
    assert.ok(rulesOf('bad-difficulty').includes('FIELD'));
  });

  test('출시 모드: verified 카드만으로 12칸이 차지 않으면 R9 오류', () => {
    const cards = loadSample();
    assert.ok(validateCards(cards, { release: true }).errors.some((e) => e.rule === 'R9'));
    assert.equal(releaseFilter(cards).length, 0);
  });

  test('규칙 8: 빈 칸이 있으면 오류', () => {
    const cards = loadSample().filter((c) => !(c.answer.nation === 'gaya' && c.answer.era === 'ending'));
    const { errors } = validateCards(cards);
    assert.ok(errors.some((e) => e.rule === 'R8'));
  });

  test('onlyVerified면 verified: true 카드만 판정 대상', () => {
    const cards = loadSample();
    cards[3].verified = true;
    const p = playableCards(cards, { onlyVerified: true });
    assert.deepEqual(p.map((c) => c.id), [cards[3].id]);
  });
});

describe('난수와 섞기', () => {
  test('같은 시드는 같은 순서, 원본은 그대로', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffle(items, createRng(7));
    const b = shuffle(items, createRng(7));
    assert.deepEqual(a, b);
    assert.deepEqual(items, Array.from({ length: 20 }, (_, i) => i));
    assert.deepEqual([...a].sort((x, y) => x - y), items);
  });
});

describe('라운드 진행', () => {
  test('새 라운드: 먹물 5, 단서 1단계, 판정 카드 전부가 덱에 한 번씩', () => {
    const { playable } = setup();
    const s = createRound(playable, { seed: SEED, startInk: START_INK });
    assert.equal(s.ink, START_INK);
    assert.equal(s.shown, 1);
    assert.equal(roundStatus(s), 'playing');
    assert.deepEqual([...s.order].sort(), playable.map((c) => c.id).sort());
  });

  test('단서 더 보기는 3단계에서 멈춘다', () => {
    const { playable } = setup();
    let s = createRound(playable, { seed: SEED, startInk: START_INK });
    s = revealNextClue(s); assert.equal(s.shown, 2);
    s = revealNextClue(s); assert.equal(s.shown, 3);
    s = revealNextClue(s); assert.equal(s.shown, 3);
  });

  test('정답: 먹물 유지, 다음 카드, 단서 단계 초기화, 사용 단서 기록', () => {
    const { playable, byId } = setup();
    let s = createRound(playable, { seed: SEED, startInk: START_INK });
    s = revealNextClue(s);
    const first = currentCardId(s);
    const { state, result } = placeCurrent(s, byId, true);
    assert.equal(result.correct, true);
    assert.equal(result.hints, 1);
    assert.equal(state.ink, START_INK);
    assert.equal(state.index, 1);
    assert.equal(state.shown, 1);
    assert.notEqual(currentCardId(state), first);
  });

  test('오답: 먹물 -1, 카드는 정답 칸에 공개된 채 소모', () => {
    const { playable, byId, anchors } = setup();
    const s = createRound(playable, { seed: SEED, startInk: START_INK });
    const card = byId.get(currentCardId(s));
    const { state, result } = placeCurrent(s, byId, false);
    assert.equal(result.correct, false);
    assert.deepEqual(result.answer, card.answer);
    assert.equal(state.ink, START_INK - 1);
    assert.equal(state.index, 1);
    const cell = boardCells(state, anchors)[`${card.answer.nation}:${card.answer.era}`];
    assert.deepEqual(cell.placed, [{ id: card.id, correct: false }]);
  });

  test('기준 카드가 있는 칸에도 놓을 수 있다', () => {
    const { playable, byId } = setup();
    const target = playable.find((c) => c.id === 'goguryeo-peak-01');
    const s = createRound([target], { seed: SEED, startInk: START_INK });
    const { result } = placeCard(s, byId, 'goguryeo', 'peak');
    assert.equal(result.correct, true);
  });

  test('잘못된 칸 id는 무시한다', () => {
    const { playable, byId } = setup();
    const s = createRound(playable, { seed: SEED, startInk: START_INK });
    const { state, result } = placeCard(s, byId, 'balhae', 'peak');
    assert.equal(result, null);
    assert.equal(state, s);
  });

  test('오답 5번이면 실패, 이후 배치는 무시', () => {
    const { playable, byId } = setup();
    let s = createRound(playable, { seed: SEED, startInk: START_INK });
    for (let i = 0; i < START_INK; i++) s = placeCurrent(s, byId, false).state;
    assert.equal(s.ink, 0);
    assert.equal(roundStatus(s), 'failed');
    assert.equal(currentCardId(s), null);
    assert.equal(placeCard(s, byId, 'silla', 'peak').result, null);
  });

  test('마지막 카드가 오답이라 먹물 0이 되면 클리어가 아니라 실패', () => {
    const { playable, byId } = setup();
    let s = createRound(playable.slice(0, START_INK), { seed: SEED, startInk: START_INK });
    for (let i = 0; i < START_INK; i++) s = placeCurrent(s, byId, false).state;
    assert.equal(s.index, s.order.length);
    assert.equal(roundStatus(s), 'failed');
  });

  test('먹물이 남은 채 모든 카드를 놓으면 클리어(오답 섞여도)', () => {
    const { playable, byId } = setup();
    let s = createRound(playable, { seed: SEED, startInk: START_INK });
    let i = 0;
    while (roundStatus(s) === 'playing') s = placeCurrent(s, byId, i++ % 4 !== 0).state;
    assert.equal(roundStatus(s), 'cleared');
    const st = roundStats(s);
    assert.equal(st.total, playable.length);
    assert.equal(st.wrong, Math.ceil(playable.length / 4));
    assert.equal(st.ink, START_INK - st.wrong);
  });
});

/** 칸마다 `perCell`장인 판정 카드 묶음(테스트 팩토리). id: `${nation}-${era}-${k}` */
function makeDeck(perCell) {
  const deck = [];
  for (const n of NATIONS) for (const e of ERAS) for (let k = 1; k <= perCell; k++) {
    deck.push({ id: `${n.id}-${e.id}-${k}`, anchor: false, disputed: false, answer: { nation: n.id, era: e.id } });
  }
  return deck;
}

describe('라운드 구성 (D22: 칸과 무관하게 뽑기)', () => {
  const cellOf = (id) => id.split('-').slice(0, 2).join('-');

  test('판정 카드에서 서로 다른 12장', () => {
    const deck = makeDeck(3);
    const order = buildRoundOrder(deck, createRng(SEED), {});
    assert.equal(order.length, 12);
    assert.equal(new Set(order).size, 12);
    assert.ok(order.every((id) => deck.some((c) => c.id === id)));
  });

  test('같은 칸 카드가 여러 장 나올 수 있고, 빈 칸도 생긴다(시드 고정)', () => {
    const deck = makeDeck(3);
    const order = buildRoundOrder(deck, createRng(SEED), {});
    const perCell = new Map();
    for (const id of order) perCell.set(cellOf(id), (perCell.get(cellOf(id)) ?? 0) + 1);
    assert.ok(Math.max(...perCell.values()) >= 2, `칸별 장수 ${JSON.stringify([...perCell])}`);
    assert.ok(perCell.size < 12, '12칸이 모두 한 장씩이면 빈 칸이 정답을 알려 준다');
  });

  test('여러 시드에서 칸마다 1장씩 구성이 강제되지 않는다', () => {
    const deck = makeDeck(3);
    let oneEach = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const cells = new Set(buildRoundOrder(deck, createRng(seed), {}).map(cellOf));
      if (cells.size === 12) oneEach++;
    }
    assert.ok(oneEach < 5, `50번 중 ${oneEach}번이 칸마다 1장`);
  });

  test('아직 수집하지 않은 카드를 먼저, 오답으로 공개만 된 카드도 미수집으로 본다', () => {
    const deck = makeDeck(3);
    const fresh = new Set(deck.slice(0, 12).map((c) => c.id));
    const collection = Object.fromEntries(deck.map((c) => [c.id, fresh.has(c.id) ? (c.id.endsWith('-1') ? 'revealed' : undefined) : 'collected']).filter(([, v]) => v));
    const order = buildRoundOrder(deck, createRng(SEED), collection);
    assert.deepEqual([...order].sort(), [...fresh].sort());
  });

  test('미수집 카드가 12장보다 적으면 수집한 카드로 채운다', () => {
    const deck = makeDeck(3);
    const fresh = new Set(deck.slice(0, 5).map((c) => c.id));
    const collection = Object.fromEntries(deck.filter((c) => !fresh.has(c.id)).map((c) => [c.id, 'collected']));
    const order = buildRoundOrder(deck, createRng(SEED), collection);
    assert.equal(order.length, 12);
    assert.ok([...fresh].every((id) => order.includes(id)), '미수집 5장은 모두 들어간다');
  });

  test('판정 카드가 12장보다 적으면 있는 만큼', () => {
    const deck = makeDeck(3).slice(0, 7);
    assert.equal(buildRoundOrder(deck, createRng(SEED), {}).length, 7);
  });

  test('완벽한 라운드 3번이면 36장 도감 완성', () => {
    const deck = makeDeck(3);
    const byId = new Map(deck.map((c) => [c.id, c]));
    let collection = {};
    for (let round = 0; round < 3; round++) {
      assert.equal(isDogamComplete(deck, collection), false);
      let s = createRound(deck, { seed: SEED + round, startInk: START_INK, collection });
      while (roundStatus(s) === 'playing') {
        const r = placeCurrent(s, byId, true);
        s = r.state;
        collection = recordInCollection(collection, r.result);
      }
      assert.equal(roundStatus(s), 'cleared');
      assert.equal(dogamProgress(deck, collection).collected, (round + 1) * 12);
    }
    assert.equal(isDogamComplete(deck, collection), true);
  });

  test('restoreRound: 중복 id, 없는 id, 길이가 다른 저장은 버린다', () => {
    const deck = makeDeck(3);
    const s = serializeRound(createRound(deck, { seed: SEED, startInk: START_INK }));
    assert.notEqual(restoreRound(s, deck), null);
    assert.equal(restoreRound({ ...s, order: [s.order[0], ...s.order.slice(0, 11)] }, deck), null);
    assert.equal(restoreRound({ ...s, order: ['ghost', ...s.order.slice(1)] }, deck), null);
    assert.equal(restoreRound({ ...s, order: s.order.slice(0, 11) }, deck), null);
  });

  test('isDogamComplete: 판정 카드가 없으면 false', () => {
    assert.equal(isDogamComplete([], {}), false);
  });
});

describe('도감 기록', () => {
  test('정답은 collected, 오답은 revealed, collected는 내려가지 않는다', () => {
    let col = {};
    col = recordInCollection(col, { id: 'a', correct: false });
    assert.equal(col.a, 'revealed');
    col = recordInCollection(col, { id: 'a', correct: true });
    assert.equal(col.a, 'collected');
    col = recordInCollection(col, { id: 'a', correct: false });
    assert.equal(col.a, 'collected');
  });

  test('restoreCollection은 없는 id와 잘못된 값을 버린다', () => {
    const { cards } = setup();
    const col = restoreCollection({ [cards[3].id]: 'collected', ghost: 'collected', [cards[4].id]: 'weird' }, cards);
    assert.deepEqual(col, { [cards[3].id]: 'collected' });
  });
});

describe('저장과 복원', () => {
  test('직렬화한 라운드를 그대로 복원한다', () => {
    const { playable, byId } = setup();
    let s = createRound(playable, { seed: SEED, startInk: START_INK });
    s = placeCurrent(s, byId, true).state;
    s = placeCurrent(s, byId, false).state;
    s = revealNextClue(s);
    const json = JSON.parse(JSON.stringify(serializeRound(s)));
    const r = restoreRound(json, playable);
    assert.deepEqual(serializeRound(r), serializeRound(s));
  });

  test('카드 구성이 바뀌었거나 저장이 깨졌으면 null', () => {
    const { playable } = setup();
    const s = serializeRound(createRound(playable, { seed: SEED, startInk: START_INK }));
    assert.equal(restoreRound(s, playable.slice(1)), null);
    assert.equal(restoreRound({ ...s, index: 3 }, playable), null);
    assert.equal(restoreRound(null, playable), null);
    assert.equal(restoreRound({ foo: 1 }, playable), null);
  });

  test('저장소: 왕복, 손상된 값, 예외를 던지는 저장소', () => {
    const mem = new Map();
    const fake = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    const store = createStore('k', fake);
    assert.equal(store.load(), null);
    assert.equal(store.save({ round: { a: 1 }, collection: { x: 'collected' } }), true);
    assert.deepEqual(store.load(), { version: 1, round: { a: 1 }, collection: { x: 'collected' }, meta: {}, history: [] });
    store.save({ round: null, collection: {}, meta: { tutorialDone: true }, history: [{ placed: 1 }] });
    assert.deepEqual(store.load().meta, { tutorialDone: true });
    assert.deepEqual(store.load().history, [{ placed: 1 }]);
    mem.set('k', '{not json');
    assert.equal(store.load(), null);
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
    const bad = createStore('k', throwing);
    assert.equal(bad.load(), null);
    assert.equal(bad.save({}), false);
    assert.doesNotThrow(() => bad.clear());
    assert.equal(createStore('k', null).save({}), false);
  });
});

describe('데이터 로딩', () => {
  const resp = (status, body) => ({ ok: status === 200, status, json: async () => body });

  test('첫 경로가 없으면 다음 경로로 넘어간다', async () => {
    const calls = [];
    const r = await loadCards(['a.json', 'b.json'], async (u) => { calls.push(u); return u === 'a.json' ? resp(404) : resp(200, [{ id: 'x' }]); });
    assert.equal(r.url, 'b.json');
    assert.deepEqual(calls, ['a.json', 'b.json']);
    assert.equal(r.tried[0].error, 'HTTP 404');
  });

  test('모두 실패하면 예외', async () => {
    await assert.rejects(loadCards(['a.json'], async () => resp(200, { not: 'array' })));
  });

  test('?data= 쿼리가 기본 경로를 덮어쓴다', () => {
    assert.deepEqual(resolveDataUrls('?data=x.json', ['a', 'b']), ['x.json']);
    assert.deepEqual(resolveDataUrls('', ['a', 'b']), ['a', 'b']);
  });
});

describe('라운드 결과와 플레이 기록', () => {
  test('placeCard: 처음 맞힌 카드만 isNew, 이미 수집했거나 오답이면 false', () => {
    const { playable, byId } = setup();
    const s = createRound(playable, { seed: SEED, startInk: START_INK });
    const id = currentCardId(s);
    assert.equal(placeCurrent(s, byId, true).result.isNew, true);
    const card = byId.get(id);
    assert.equal(placeCard(s, byId, card.answer.nation, card.answer.era, { [id]: 'collected' }).result.isNew, false);
    assert.equal(placeCard(s, byId, card.answer.nation, card.answer.era, { [id]: 'revealed' }).result.isNew, true);
    assert.equal(placeCurrent(s, byId, false).result.isNew, false);
  });

  test('summarizeRound: 단서 단계 분포, 정답·오답·새 수집 수, 남은 먹물', () => {
    const { playable, byId } = setup();
    let s = createRound(playable, { seed: SEED, startInk: START_INK });
    s = placeCurrent(s, byId, true).state;                       // 1단계 정답
    s = revealNextClue(s); s = placeCurrent(s, byId, false).state; // 2단계 오답
    s = revealNextClue(revealNextClue(s)); s = placeCurrent(s, byId, true).state; // 3단계 정답
    while (roundStatus(s) === 'playing') s = placeCurrent(s, byId, true).state;
    const h = summarizeRound(s, { at: 'T', dataFile: 'x.json' });
    assert.equal(h.status, 'cleared');
    assert.equal(h.placed, 12);
    assert.equal(h.right, 11);
    assert.equal(h.wrong, 1);
    assert.equal(h.newlyCollected, 11);
    assert.equal(h.inkLeft, START_INK - 1);
    assert.deepEqual(h.levels, [10, 1, 1]);
    assert.deepEqual(h.placements.slice(0, 3).map((p) => p.level), [1, 2, 3]);
    assert.equal(h.dataFile, 'x.json');
  });

  test('historyStats: 라운드 수, 클리어 수, 정답률, 평균 단서 단계', () => {
    const rows = [
      { status: 'cleared', placed: 12, right: 9, levels: [6, 4, 2] },
      { status: 'failed', placed: 8, right: 3, levels: [8, 0, 0] },
    ];
    const st = historyStats(rows);
    assert.equal(st.rounds, 2);
    assert.equal(st.cleared, 1);
    assert.equal(st.failed, 1);
    assert.equal(st.rate, 60); // 12/20
    assert.equal(st.avgLevel, 1.4); // (14*1 + 4*2 + 2*3) / 20 = 28/20
    assert.deepEqual(st.levels, [14, 4, 2]);
    assert.deepEqual(historyStats([]), { rounds: 0, cleared: 0, failed: 0, placed: 0, right: 0, rate: 0, avgLevel: 0, levels: [0, 0, 0] });
  });

  test('restoreHistory: 형식이 틀린 줄은 버린다', () => {
    const ok = { status: 'failed', placed: 5, right: 0, levels: [5, 0, 0] };
    assert.deepEqual(restoreHistory([ok, null, { placed: 'x' }, { ...ok, status: 'playing' }]), [ok]);
    assert.deepEqual(restoreHistory('nope'), []);
  });
});

describe('튜토리얼 카드(web/data/tutorial.json)', () => {
  const TUT = JSON.parse(readFileSync(path.join(here, '..', 'data', 'tutorial.json'), 'utf8'));

  test('카드 단위 검증 오류가 없다(12칸 규칙 R8 제외)', () => {
    assert.deepEqual(validateCards(TUT).errors.filter((e) => e.rule !== 'R8'), []);
  });

  test('본 덱(샘플·samguk)과 id·제목이 겹치지 않고, 기준 1장 + 연습 1장', () => {
    const decks = [loadSample(), existsSync(SAMGUK_PATH) ? JSON.parse(readFileSync(SAMGUK_PATH, 'utf8')) : []].flat();
    for (const c of TUT) {
      assert.ok(!decks.some((d) => d.id === c.id || d.title === c.title), c.title);
      assert.equal(c.verified, false);
    }
    assert.equal(TUT.filter((c) => c.anchor).length, 1);
    assert.equal(TUT.filter((c) => !c.anchor).length, 1);
  });

  test('pickTutorialCards: 기준 카드를 가리키는 연습 카드 한 쌍, 본 덱 id는 제외', async () => {
    const { pickTutorialCards } = await import('../src/ui/tutorial.js');
    const pair = pickTutorialCards(TUT);
    assert.equal(pair.card.clues[1].refs[0], pair.anchor.id);
    assert.equal(pickTutorialCards(TUT, new Set(TUT.map((c) => c.id))), null);
  });
});
