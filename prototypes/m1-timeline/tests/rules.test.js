// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// M1 규칙 단위 테스트: node --test prototypes/m1-timeline/tests/rules.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG } from '../js/config.js';
import {
  validateDeck, buildTimeline, isCorrectGap, correctGaps, promotionFor, applyResult, isDue, mastery,
  buildSession, createRng, createSession, currentId, revealClue, placeCurrent, sessionTimeline, isSessionDone,
  sessionSummary, masteryCounts, dueCount, restoreProgress, restoreSession, dataFingerprint, isRetry,
} from '../js/rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = JSON.parse(readFileSync(path.join(here, '..', 'data', 'sample.json'), 'utf8'));
const BY_ID = new Map(SAMPLE.cards.map((c) => [c.id, c]));
const SEED = 777;

/** 학습 기록 없이 시작하는 세션. */
const fresh = (session = 1, cfg = CONFIG) => createSession(SAMPLE.cards, {}, session, cfg, SEED);
/** 지금 카드의 맞는 틈. */
function rightGap(state, cfg = CONFIG) {
  const card = BY_ID.get(currentId(state));
  return correctGaps(sessionTimeline(state, SAMPLE.anchors, cfg), card.order)[0];
}
function wrongGap(state, cfg = CONFIG) {
  const items = sessionTimeline(state, SAMPLE.anchors, cfg);
  const card = BY_ID.get(currentId(state));
  for (let k = 0; k <= items.length; k++) if (!isCorrectGap(items, k, card.order)) return k;
  throw new Error('오답 틈이 없다');
}

describe('데이터', () => {
  test('샘플 데이터는 검증 오류가 없다', () => {
    assert.deepEqual(validateDeck(SAMPLE), []);
  });
  test('사료 지문에 이름, 기준 카드 order 중복, 없는 ref를 잡는다', () => {
    const bad = structuredClone(SAMPLE);
    bad.cards[0].source_text = `${bad.cards[0].title}를 했다`;
    bad.anchors[1].order = bad.anchors[0].order;
    bad.cards[1].clues[0].refs = ['nope'];
    const errs = validateDeck(bad).join('\n');
    assert.match(errs, /사료 지문에 이름/);
    assert.match(errs, /order가 같으면/);
    assert.match(errs, /nope/);
  });
});

describe('연표 위치 판정', () => {
  const items = buildTimeline(SAMPLE.anchors);
  test('기준 카드는 시간순, 틈은 n+1개', () => {
    assert.deepEqual(items.map((i) => i.order), [-37, 371, 391, 413, 642]);
    assert.equal(correctGaps(items, 427).length, 1);
  });
  test('앞뒤 기준 카드 사이만 정답', () => {
    assert.deepEqual(correctGaps(items, 194), [1]);   // 동명성왕(-37)과 소수림왕(371) 사이
    assert.deepEqual(correctGaps(items, 427), [4]);   // 장수왕(413)과 보장왕(642) 사이
    assert.deepEqual(correctGaps(items, -100), [0]);  // 맨 앞
    assert.deepEqual(correctGaps(items, 700), [5]);   // 맨 뒤
    assert.equal(isCorrectGap(items, 2, 194), false);
    assert.equal(isCorrectGap(items, 9, 194), false);
  });
  test('같은 해는 양쪽 틈 모두 정답', () => {
    assert.deepEqual(correctGaps(items, 371), [1, 2]);
  });
  test('놓인 카드가 연표에 들어가 틈이 잘게 나뉜다', () => {
    const t = buildTimeline(SAMPLE.anchors, [{ id: 'x', order: 194, correct: true }]);
    assert.deepEqual(correctGaps(t, 3), [1]);       // 건국과 진대법(194) 사이
    assert.deepEqual(correctGaps(t, 250), [2]);     // 진대법과 낙랑군 축출 사이
  });
});

describe('단서 비용과 Leitner 상자', () => {
  test('단서를 볼수록 승급 폭이 준다', () => {
    assert.deepEqual([0, 1, 2, 3].map((n) => promotionFor(n, CONFIG)), [2, 1, 0, 0]);
  });
  test('처음 맞힘: 단서 0이면 1→3, 단서 1이면 1→2, 단서 2면 1→1', () => {
    assert.equal(applyResult(undefined, { correct: true, cluesUsed: 0, session: 1 }, CONFIG).box, 3);
    assert.equal(applyResult(undefined, { correct: true, cluesUsed: 1, session: 1 }, CONFIG).box, 2);
    assert.equal(applyResult(undefined, { correct: true, cluesUsed: 2, session: 1 }, CONFIG).box, 1);
  });
  test('오답은 상자 1로, 상한은 5', () => {
    const e = applyResult({ box: 4, due: 3, seen: 2, right: 2, wrong: 0 }, { correct: false, cluesUsed: 0, session: 5 }, CONFIG);
    assert.equal(e.box, 1);
    assert.equal(e.wrong, 1);
    assert.equal(applyResult({ box: 5, due: 1, seen: 1, right: 1, wrong: 0 }, { correct: true, cluesUsed: 0, session: 1 }, CONFIG).box, 5);
  });
  test('재출제: 상자 b에서 세션 s에 답하면 s + intervals[b]부터 다시 나온다', () => {
    const e = applyResult(undefined, { correct: true, cluesUsed: 0, session: 2 }, CONFIG); // 상자 3
    assert.equal(e.due, 2 + CONFIG.intervals[3]);
    assert.equal(isDue(e, e.due - 1), false);
    assert.equal(isDue(e, e.due), true);
    assert.equal(isDue(undefined, 99), false);
  });
  test('숙련 등급: 상자 2 동, 4 은, 5 금', () => {
    assert.equal(mastery(undefined, CONFIG), 'unseen');
    assert.deepEqual([1, 2, 3, 4, 5].map((box) => mastery({ box }, CONFIG)), ['none', 'bronze', 'bronze', 'silver', 'gold']);
  });
});

describe('세션 구성', () => {
  const cfg8 = { ...CONFIG, sessionSize: 4 };
  test('카드가 적으면 있는 만큼, 처음엔 모두 새 카드', () => {
    const s = buildSession(SAMPLE.cards, {}, 1, CONFIG, createRng(1));
    assert.equal(s.ids.length, 8);
    assert.equal(s.fresh, 8);
  });
  test('복습 대상(때가 된 카드)을 새 카드보다 먼저 고른다', () => {
    const progress = { 'gg-c-ansi': { box: 1, due: 2 }, 'gg-c-taehak': { box: 2, due: 2 }, 'gg-c-jindae': { box: 3, due: 9 } };
    const s = buildSession(SAMPLE.cards, progress, 2, cfg8, createRng(1));
    assert.equal(s.due, 2);
    assert.ok(s.ids.includes('gg-c-ansi') && s.ids.includes('gg-c-taehak'));
    assert.ok(!s.ids.includes('gg-c-jindae'), '때가 안 된 카드는 새 카드가 모자랄 때만');
    assert.equal(s.fresh, 2);
  });
  test('새 카드도 없으면 가장 빨리 돌아올 카드로 채운다', () => {
    const progress = Object.fromEntries(SAMPLE.cards.map((c, i) => [c.id, { box: 3, due: 10 + i }]));
    const s = buildSession(SAMPLE.cards, progress, 2, cfg8, createRng(1));
    assert.equal(s.early, 4);
    assert.deepEqual([...s.ids].sort(), SAMPLE.cards.slice(0, 4).map((c) => c.id).sort());
  });
  test('세션 크기 설정을 지킨다', () => {
    assert.equal(buildSession(SAMPLE.cards, {}, 1, { ...CONFIG, sessionSize: 3 }, createRng(1)).ids.length, 3);
  });
});

describe('세션 진행', () => {
  test('정답: 다음 카드, 단서 수 초기화, 상자 승급, 연표에 들어감', () => {
    let s = fresh();
    s = revealClue(s, 2);
    const id = currentId(s);
    const r = placeCurrent(s, rightGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG);
    assert.equal(r.result.correct, true);
    assert.equal(r.result.cluesUsed, 1);
    assert.equal(r.result.boxTo, 2);
    assert.equal(r.progress[id].box, 2);
    assert.equal(r.state.index, 1);
    assert.equal(r.state.clues, 0);
    assert.equal(sessionTimeline(r.state, SAMPLE.anchors, CONFIG).length, SAMPLE.anchors.length + 1);
  });
  test('오답: 상자 1, 맞는 틈을 알려 주고, 카드는 맞는 자리에 들어감', () => {
    const s = fresh();
    const card = BY_ID.get(currentId(s));
    const r = placeCurrent(s, wrongGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG);
    assert.equal(r.result.correct, false);
    assert.equal(r.result.boxTo, 1);
    assert.deepEqual(r.result.correctGaps, [rightGap(s)]);
    const items = sessionTimeline(r.state, SAMPLE.anchors, CONFIG);
    const idx = items.findIndex((i) => i.id === card.id);
    assert.ok((items[idx - 1]?.order ?? -Infinity) <= card.order && card.order <= (items[idx + 1]?.order ?? Infinity));
    assert.equal(items[idx].correct, false);
  });
  test('단서는 카드의 단서 수까지만 열린다', () => {
    let s = fresh();
    s = revealClue(revealClue(revealClue(s, 2), 2), 2);
    assert.equal(s.clues, 2);
  });
  test('잘못된 틈 번호는 무시', () => {
    const s = fresh();
    assert.equal(placeCurrent(s, 99, BY_ID, SAMPLE.anchors, {}, CONFIG).result, null);
  });
  test('세션 끝, 요약, 다음 세션 복습 대상', () => {
    let s = fresh();
    let progress = {};
    let i = 0;
    while (!isSessionDone(s)) {
      if (i === 1) s = revealClue(s, 2);
      const k = i === 2 ? wrongGap(s) : rightGap(s);
      ({ state: s, progress } = placeCurrent(s, k, BY_ID, SAMPLE.anchors, progress, CONFIG));
      i++;
    }
    const sum = sessionSummary(s);
    assert.deepEqual([sum.total, sum.right, sum.clues, sum.noClueRight], [8, 7, 1, 6]);
    assert.deepEqual([sum.retried, sum.retryRight], [1, 1]);
    // 세션 1 다음: 오답(상자 1, +1)과 단서 1개 정답(상자 2, +2)
    assert.equal(dueCount(SAMPLE.cards, progress, 2), 1);
    assert.equal(dueCount(SAMPLE.cards, progress, 3), 2);
    assert.deepEqual(masteryCounts(SAMPLE.cards, progress, CONFIG), { unseen: 0, none: 1, bronze: 7, silver: 0, gold: 0 });
    // 다음 세션은 때가 된 카드가 먼저
    const s2 = createSession(SAMPLE.cards, progress, 2, { ...CONFIG, sessionSize: 2 }, SEED);
    assert.equal(s2.mix.due, 1);
  });
  test('같은 카드를 여러 세션에 걸쳐 단서 없이 맞히면 금까지 오른다', () => {
    let e;
    for (let session = 1; session <= 3; session++) e = applyResult(e, { correct: true, cluesUsed: 0, session }, CONFIG);
    assert.equal(mastery(e, CONFIG), 'gold');
  });
});

describe('세션 안 다시 풀기(D61)', () => {
  test('틀린 카드는 세션 끝에 한 번 더, 맞힌 카드는 다시 나오지 않는다', () => {
    let s = fresh();
    const first = currentId(s);
    ({ state: s } = placeCurrent(s, wrongGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG));
    assert.equal(s.queue.length, s.base + 1);
    assert.equal(s.queue.at(-1), first);
    ({ state: s } = placeCurrent(s, rightGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG));
    assert.equal(s.queue.length, s.base + 1);
  });

  test('다시 풀기: 연표에서 그 카드의 공개된 자리를 빼고, 상자는 바꾸지 않으며, 다시 틀려도 또 내지 않는다', () => {
    let s = fresh();
    let progress = {};
    const first = currentId(s);
    ({ state: s, progress } = placeCurrent(s, wrongGap(s), BY_ID, SAMPLE.anchors, progress, CONFIG));
    while (!isRetry(s)) ({ state: s, progress } = placeCurrent(s, rightGap(s), BY_ID, SAMPLE.anchors, progress, CONFIG));
    assert.equal(currentId(s), first);
    const items = sessionTimeline(s, SAMPLE.anchors, CONFIG);
    assert.ok(!items.some((i) => i.id === first), '답이 연표에 보이면 안 된다');
    assert.equal(items.length, SAMPLE.anchors.length + s.base - 1);
    const before = progress[first];
    const r = placeCurrent(s, wrongGap(s), BY_ID, SAMPLE.anchors, progress, CONFIG);
    assert.equal(r.result.retry, true);
    assert.equal(r.progress[first], before, '상자 그대로');
    assert.equal(r.state.queue.length, s.queue.length, '다시 틀려도 또 내지 않는다');
    assert.equal(isSessionDone(r.state), true);
    assert.deepEqual(sessionSummary(r.state).retried, 1);
  });

  test('설정으로 끌 수 있다', () => {
    const cfg = { ...CONFIG, retryWrongInSession: false };
    const s = createSession(SAMPLE.cards, {}, 1, cfg, SEED);
    const r = placeCurrent(s, wrongGap(s, cfg), BY_ID, SAMPLE.anchors, {}, cfg);
    assert.equal(r.state.queue.length, s.queue.length);
  });

  test('다시 풀기 중 저장·복원, 옛 저장(base 없음)도 복원', () => {
    let s = fresh();
    ({ state: s } = placeCurrent(s, wrongGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG));
    while (!isRetry(s)) ({ state: s } = placeCurrent(s, rightGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG));
    const back = restoreSession(JSON.parse(JSON.stringify(s)), SAMPLE.cards);
    assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(s)));
    const bad = JSON.parse(JSON.stringify(s));
    bad.queue[bad.queue.length - 1] = bad.queue[1]; // 맞힌 카드를 다시 풀기에 넣은 저장
    assert.equal(restoreSession(bad, SAMPLE.cards), null);
    const old = JSON.parse(JSON.stringify(fresh()));
    delete old.base; delete old.retryResults;
    assert.equal(restoreSession(old, SAMPLE.cards).base, old.queue.length);
  });
});

describe('저장과 복원', () => {
  test('세션 왕복', () => {
    let s = fresh();
    s = placeCurrent(s, rightGap(s), BY_ID, SAMPLE.anchors, {}, CONFIG).state;
    s = revealClue(s, 2);
    const back = restoreSession(JSON.parse(JSON.stringify(s)), SAMPLE.cards);
    assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(s)));
  });
  test('깨진 세션과 없는 카드는 버린다', () => {
    const s = JSON.parse(JSON.stringify(fresh()));
    assert.equal(restoreSession({ ...s, queue: ['ghost'] }, SAMPLE.cards), null);
    assert.equal(restoreSession({ ...s, index: 2 }, SAMPLE.cards), null);
    assert.equal(restoreSession(null, SAMPLE.cards), null);
  });
  test('학습 기록: 없는 id와 잘못된 상자 제거', () => {
    const p = restoreProgress({ 'gg-c-ansi': { box: 2, due: 3 }, ghost: { box: 2, due: 3 }, 'gg-c-taehak': { box: 9, due: 1 } }, SAMPLE.cards, CONFIG);
    assert.deepEqual(Object.keys(p), ['gg-c-ansi']);
  });
  test('데이터 식별자: 연도(order)가 바뀌면 달라진다', () => {
    const a = dataFingerprint('x', SAMPLE);
    const b = structuredClone(SAMPLE);
    b.cards[0].order += 1;
    assert.notEqual(a, dataFingerprint('x', b));
    assert.equal(a, dataFingerprint('x', structuredClone(SAMPLE)));
  });
});

describe('데이터 로더(js/data.js)', async () => {
  const { normalizeDeck, formatOf, loadRaw } = await import('../js/data.js');
  const REAL_PATH = path.join(here, '..', '..', '..', 'assets', 'data', 'cards', 'v2-draft', 'goguryeo-m1.json');
  const { existsSync } = await import('node:fs');
  const raw = existsSync(REAL_PATH) ? JSON.parse(readFileSync(REAL_PATH, 'utf8')) : null;

  test('샘플은 그대로, 알 수 없는 형식은 오류', () => {
    assert.equal(formatOf(SAMPLE), 'm1-draft');
    assert.equal(normalizeDeck(SAMPLE).deck, SAMPLE);
    assert.deepEqual(normalizeDeck({ foo: 1 }).errors, ['알 수 없는 데이터 형식']);
  });

  test('콘텐츠 초안: 변환 후 검증 오류 없음, 앵커 5·카드 12, 앞면은 사료 지문', { skip: !raw && '초안 없음' }, () => {
    const n = normalizeDeck(raw);
    assert.equal(n.format, 'v2-draft-content');
    assert.deepEqual(n.errors, []);
    assert.deepEqual(validateDeck(n.deck), []);
    assert.equal(n.deck.anchors.length, 5);
    assert.equal(n.deck.cards.length, 12);
    assert.equal(n.deck.cards[0].source_text, raw.cards[0].front);
  });

  test('콘텐츠 초안: 모든 카드가 timeline.after/before가 가리키는 기준 카드 사이에서 정답', { skip: !raw && '초안 없음' }, () => {
    const { deck } = normalizeDeck(raw);
    const t = buildTimeline(deck.anchors);
    for (const c of raw.cards) {
      const k = correctGaps(t, deck.cards.find((x) => x.id === c.id).order);
      assert.equal(k.length, 1, c.id);
      const before = k[0] > 0 ? t[k[0] - 1].id : null;
      const after = k[0] < t.length ? t[k[0]].id : null;
      assert.equal(before, c.timeline.after ?? null, `${c.id} 앞`);
      assert.equal(after, c.timeline.before ?? null, `${c.id} 뒤`);
    }
  });

  test('같은 해 기준 카드와의 순서는 timeline으로, 모순이면 오류', () => {
    const base = { _format: 'v2-draft-content x', nation: 'goguryeo',
      anchors: [{ id: 'a1', title: 'A1', year: 100, year_label: '100년' }, { id: 'a2', title: 'A2', year: 200, year_label: '200년' }],
      cards: [{ id: 'c1', title: 'C1', year: 200, year_label: '200년', front: '지문', clues: [], timeline: { after: 'a1', before: 'a2' } }] };
    assert.equal(normalizeDeck(base).deck.cards[0].order, 199.5);
    const bad = structuredClone(base);
    bad.cards[0].year = 300;
    assert.match(normalizeDeck(bad).errors.join(), /먼저가 아니다/);
  });

  test('loadRaw: 앞 경로가 없으면 다음 경로', async () => {
    const r = await loadRaw(['a', 'b'], async (u) => ({ ok: u === 'b', status: 404, json: async () => ({ x: 1 }) }));
    assert.equal(r.url, 'b');
  });
});
