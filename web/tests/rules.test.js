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

  test('규칙 위반을 잡는다: id 중복, 잘못된 answer, 단서 순서, 1단계에 제목, 없는 ref, disputed_note, 이미지 라이선스', () => {
    const base = loadSample();
    const card = structuredClone(base.find((c) => c.id === 'goguryeo-peak-01'));
    const broken = [
      { ...structuredClone(card), id: 'dup' },
      { ...structuredClone(card), id: 'dup' },
      { ...structuredClone(card), id: 'bad-answer', answer: { nation: 'balhae', era: 'peak' } },
      { ...structuredClone(card), id: 'bad-order', clues: [card.clues[1], card.clues[0], card.clues[2]] },
      { ...structuredClone(card), id: 'title-leak', clues: [{ ...card.clues[0], text: `${card.title}의 장면` }, card.clues[1], card.clues[2]] },
      { ...structuredClone(card), id: 'bad-ref', clues: [card.clues[0], { ...card.clues[1], refs: ['nope'] }, card.clues[2]] },
      { ...structuredClone(card), id: 'no-note', disputed: true, disputed_note: null },
      { ...structuredClone(card), id: 'no-license', image: 'assets/art/cards/x.png' },
    ];
    const { errors } = validateCards([...base, ...broken]);
    const rulesOf = (id) => errors.filter((e) => e.id === id).map((e) => e.rule);
    assert.ok(rulesOf('dup').includes(1));
    assert.ok(rulesOf('bad-answer').includes(2));
    assert.ok(rulesOf('bad-order').includes(3));
    assert.ok(rulesOf('title-leak').includes(5));
    assert.ok(rulesOf('bad-ref').includes(4));
    assert.ok(rulesOf('no-note').includes(6));
    assert.ok(rulesOf('no-license').includes(7));
  });

  test('규칙 8: 빈 칸이 있으면 오류', () => {
    const cards = loadSample().filter((c) => !(c.answer.nation === 'gaya' && c.answer.era === 'ending'));
    const { errors } = validateCards(cards);
    assert.ok(errors.some((e) => e.rule === 8));
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
    assert.equal(store.save({ a: 1 }, { x: 'collected' }), true);
    assert.deepEqual(store.load(), { version: 1, round: { a: 1 }, collection: { x: 'collected' } });
    mem.set('k', '{not json');
    assert.equal(store.load(), null);
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
    const bad = createStore('k', throwing);
    assert.equal(bad.load(), null);
    assert.equal(bad.save({}, {}), false);
    assert.doesNotThrow(() => bad.clear());
    assert.equal(createStore('k', null).save({}, {}), false);
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
