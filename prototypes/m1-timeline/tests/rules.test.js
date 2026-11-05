// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// M1 규칙 단위 테스트: node --test prototypes/m1-timeline/tests/rules.test.js
// leitner-spec §10 수용 기준 1~13과 §7 시뮬레이션 수치를 그대로 재현한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG, LEITNER_DEFAULT, M1_OVERRIDE } from '../js/config.js';
import {
  validateDeck, buildTimeline, isCorrectGap, correctGaps, selectableGaps, slotAnchorId, isNearMiss,
  nextBox, schedule, gradeOf, isDue, newEntry, buildSession, earlyReviewIds, wrongNoteIds, sessionSeed,
  createSessionState, currentId, revealClue, placeCurrent, sessionTimeline, isSessionDone, isRetry, attemptsOf,
  completedAfter, sessionSummary, gradeCounts, logLine, restoreProgress, restoreSession, dataFingerprint,
} from '../js/rules.js';
import { normalizeDeck, formatOf, loadRaw, yearText } from '../js/data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = JSON.parse(readFileSync(path.join(here, '..', 'data', 'sample.json'), 'utf8'));
const BY_ID = new Map(SAMPLE.cards.map((c) => [c.id, c]));
const D = { ...LEITNER_DEFAULT, slotBeforeFirst: false, placedJoinTimeline: false }; // 명세 기본값
const M1 = CONFIG.leitner;                                                          // M1 덮어쓰기
const DRAFT_PATH = path.join(here, '..', '..', '..', 'assets', 'data', 'cards', 'v2-draft', 'goguryeo-m1.json');
const V2_PATH = path.join(here, '..', '..', '..', 'assets', 'data', 'cards', 'v2', 'goguryeo-m1.json');

/** n장짜리 덱(id 순서 = 덱 순서). */
const deckOf = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${String(i + 1).padStart(2, '0')}` }));

describe('설정', () => {
  test('명세 §8 기본값과 M1 덮어쓰기', () => {
    assert.deepEqual([...LEITNER_DEFAULT.intervals], [1, 2, 4, 7, 12]);
    assert.deepEqual({ ...LEITNER_DEFAULT.grades }, { bronze: 3, silver: 4, gold: 5 });
    assert.deepEqual({ ...M1_OVERRIDE }, { session_size: 6, new_min: 6 });
    assert.equal(M1.session_size, 6);
    assert.equal(M1.intervals.length, 5);
  });
});

describe('§10 상자 갱신(1~6, 13)', () => {
  const at = (box) => ({ ...newEntry(), introduced: true, box });
  test('1. 새 카드(상자 1)를 깨끗하게 맞히면 상자 2, due = s+2', () => {
    const e = schedule(undefined, { correct: true, clueUsed: 0, session: 5 }, D);
    assert.deepEqual([e.box, e.due_session, e.introduced], [2, 7, true]);
  });
  test('2. 상자 3을 관계 단서로 맞히면 상자 3, due = s+4', () => {
    const e = schedule(at(3), { correct: true, clueUsed: 1, session: 5 }, D);
    assert.deepEqual([e.box, e.due_session], [3, 9]);
  });
  test('3. 상자 3을 직접 단서로 맞히면 상자 2', () => {
    assert.equal(schedule(at(3), { correct: true, clueUsed: 2, session: 5 }, D).box, 2);
  });
  test('4. 상자 1을 직접 단서로 맞혀도 상자 1', () => {
    assert.equal(schedule(at(1), { correct: true, clueUsed: 2, session: 5 }, D).box, 1);
  });
  test('5. 상자 5를 깨끗하게 맞히면 상자 5, due = s+12', () => {
    const e = schedule(at(5), { correct: true, clueUsed: 0, session: 5 }, D);
    assert.deepEqual([e.box, e.due_session], [5, 17]);
  });
  test('6. 오답이면 상자 1, due = s+1, lapses +1, clean_streak 0', () => {
    const e = schedule({ ...at(4), clean_streak: 3, lapses: 1 }, { correct: false, clueUsed: 0, session: 5 }, D);
    assert.deepEqual([e.box, e.due_session, e.lapses, e.clean_streak], [1, 6, 2, 0]);
  });
  test('13. 단서 0·1·2 × 정답·오답의 모든 조합(상자 1~5)', () => {
    const expect = (box, correct, clue) => (!correct ? 1 : clue === 0 ? Math.min(5, box + 1) : clue === 1 ? box : Math.max(1, box - 1));
    for (let box = 1; box <= 5; box++) for (const correct of [true, false]) for (const clue of [0, 1, 2]) {
      assert.equal(nextBox(box, correct, clue, D), expect(box, correct, clue), `box ${box} ${correct} ${clue}`);
    }
  });
});

describe('§10 등급(12)', () => {
  test('동 box≥3, 은 ≥4, 금 = box 5이면서 마지막이 깨끗한 정답', () => {
    const e = (box, clean_streak = 1) => ({ ...newEntry(), introduced: true, box, clean_streak });
    assert.deepEqual([1, 2, 3, 4, 5].map((b) => gradeOf(e(b), D)), [0, 0, 1, 2, 3]);
    assert.equal(gradeOf(e(5, 0), D), 2, '상자 5라도 마지막이 깨끗하지 않으면 은');
    assert.equal(gradeOf(undefined, D), 0);
  });
  test('best_grade는 내려가지 않고 현재 등급은 상자에서 계산', () => {
    let x;
    for (let s = 1; s <= 30 && gradeOf(x, D) < 3; s++) x = schedule(x, { correct: true, clueUsed: 0, session: s }, D);
    assert.equal(x.best_grade, 3);
    x = schedule(x, { correct: false, clueUsed: 0, session: 40 }, D);
    assert.equal(gradeOf(x, D), 0);
    assert.equal(x.best_grade, 3);
  });
});

/** 하루 1세션, 항상 깨끗하게 맞히는 학습자. 0장 세션도 하루로 센다(§7 시뮬레이션과 같은 가정, D66). */
function simulate(n, sessions, cfg = D) {
  const deck = deckOf(n);
  let progress = {};
  const out = [];
  for (let s = 1; s <= sessions; s++) {
    const { ids, due, fresh } = buildSession(deck, progress, s, cfg, sessionSeed(1, s));
    for (const id of ids) progress = { ...progress, [id]: schedule(progress[id], { correct: true, clueUsed: 0, session: s }, cfg) };
    out.push({ s, count: ids.length, due, fresh, progress });
  }
  return out;
}

describe('§7 시뮬레이션 재현', () => {
  test('(1) 한 카드를 늘 깨끗하게: (1,2,3) (3,3,7) (7,4,14) (14,5,26) (26,5,38), 동 3·은 7·금 14', () => {
    let e;
    let s = 1;
    const seen = [];
    const firstGrade = {};
    for (let i = 0; i < 5; i++) {
      e = schedule(e, { correct: true, clueUsed: 0, session: s }, D);
      seen.push([s, e.box, e.due_session]);
      const g = gradeOf(e, D);
      for (let k = 1; k <= g; k++) firstGrade[k] ??= s;
      s = e.due_session;
    }
    assert.deepEqual(seen, [[1, 2, 3], [3, 3, 7], [7, 4, 14], [14, 5, 26], [26, 5, 38]]);
    assert.deepEqual(firstGrade, { 1: 3, 2: 7, 3: 14 });
  });

  test('(2) 12장 덱: 새 카드 4·4·4, 세션 3은 8장, 모두 동 세션 5, 모두 은 9, 첫 금 14, 모두 금 16, 0장 세션 6·13·17~20', () => {
    const r = simulate(12, 20);
    assert.deepEqual(r.slice(0, 3).map((x) => x.fresh), [4, 4, 4]);
    assert.equal(r[2].count, 8);
    const firstAll = (pred) => r.find((x) => deckOf(12).every((c) => pred(x.progress[c.id])))?.s;
    assert.equal(firstAll((e) => e?.box >= 3), 5);
    assert.equal(firstAll((e) => e?.box >= 4), 9);
    assert.equal(firstAll((e) => gradeOf(e, D) === 3), 16);
    assert.equal(r.find((x) => deckOf(12).some((c) => gradeOf(x.progress[c.id], D) === 3))?.s, 14);
    const empty = r.filter((x) => x.count === 0).map((x) => x.s);
    for (const s of [6, 13, 17, 18, 19, 20]) assert.ok(empty.includes(s), `세션 ${s}는 0장이어야 한다(실제 0장: ${empty})`);
  });
});

describe('§10 세션 구성(7, 9)', () => {
  test('도래 카드 먼저(상자 낮은 순 → due 오래된 순 → 덱 순서), 새 카드 예약 2장, 새 카드 최대 S/2, 남는 자리 안 채움', () => {
    const deck = deckOf(14);
    const p = {};
    const put = (id, box, due) => { p[id] = { ...newEntry(), introduced: true, box, due_session: due }; };
    // 도래 8장(자리 6 = 8 - 예약 2), 정렬 확인용
    put('c01', 3, 1); put('c02', 1, 4); put('c03', 2, 2); put('c04', 1, 2); put('c05', 2, 1); put('c06', 3, 3); put('c07', 1, 2); put('c08', 4, 1);
    put('c09', 1, 99); // 도래 안 함
    const r = buildSession(deck, p, 5, D, 1);
    assert.equal(r.due, 6);
    assert.equal(r.fresh, 2, '새 카드 예약 2장');
    // 정렬된 도래 순서에서 앞 6장: 상자1(c04 due2, c07 due2, c02 due4) → 상자2(c05 due1, c03 due2) → 상자3(c01 due1)
    assert.deepEqual([...r.ids].filter((id) => p[id]).sort(), ['c01', 'c02', 'c03', 'c04', 'c05', 'c07']);
    assert.deepEqual([...r.ids].filter((id) => !p[id]).sort(), ['c10', 'c11']);
  });

  test('도래가 적으면 새 카드를 S/2까지, 그래도 남으면 채우지 않는다', () => {
    const deck = deckOf(20);
    const p = { c01: { ...newEntry(), introduced: true, box: 1, due_session: 1 } };
    const r = buildSession(deck, p, 1, D, 1);
    assert.deepEqual([r.due, r.fresh, r.ids.length], [1, 4, 5]);
  });

  test('도래도 새 카드도 없으면 0장(미리 복습으로 채우지 않음)', () => {
    const deck = deckOf(3);
    const p = Object.fromEntries(deck.map((c) => [c.id, { ...newEntry(), introduced: true, box: 3, due_session: 9 }]));
    assert.equal(buildSession(deck, p, 2, D, 1).ids.length, 0);
    assert.deepEqual(earlyReviewIds(deck, p, D), ['c01', 'c02', 'c03']);
  });

  test('M1 덮어쓰기: 첫 세션에 6장 모두 도입', () => {
    const r = buildSession(deckOf(6), {}, 1, M1, 1);
    assert.deepEqual([r.ids.length, r.fresh], [6, 6]);
  });

  test('9. 같은 시드와 상태면 같은 큐, 세션 번호가 다르면 순서가 바뀔 수 있다', () => {
    const deck = deckOf(8);
    const a = buildSession(deck, {}, 1, D, sessionSeed(42, 1)).ids;
    assert.deepEqual(buildSession(deck, {}, 1, D, sessionSeed(42, 1)).ids, a);
    const orders = new Set([1, 2, 3, 4].map((s) => buildSession(deck, {}, s, { ...D, new_min: 8, new_max_ratio: 1 }, sessionSeed(42, s)).ids.join()));
    assert.ok(orders.size > 1);
  });
});

/** 샘플로 학습 세션 하나. */
function sampleSession(cfg = M1, progress = {}, session = 1) {
  const { ids } = buildSession(SAMPLE.cards, progress, session, cfg, sessionSeed(7, session));
  return createSessionState(session, ids, { kind: 'learn' });
}
const right = (st, cfg = M1) => correctGaps(sessionTimeline(st, SAMPLE.anchors, cfg), BY_ID.get(currentId(st)).order)[0];
function wrong(st, cfg = M1, near = false) {
  const items = sessionTimeline(st, SAMPLE.anchors, cfg);
  const r = right(st, cfg);
  const ks = selectableGaps(items, cfg).filter((k) => k !== r);
  return near ? ks.find((k) => Math.abs(k - r) === 1) : ks.sort((a, b) => Math.abs(b - r) - Math.abs(a - r))[0];
}

describe('칸 판정과 인접 칸 오답', () => {
  const items = buildTimeline(SAMPLE.anchors);
  test('칸 = 앵커 사이, 첫 앵커 앞은 칸이 아니다', () => {
    assert.deepEqual(selectableGaps(items, M1), [1, 2, 3, 4, 5]);
    assert.deepEqual(correctGaps(items, 194), [1]);
    assert.equal(slotAnchorId(items, 1), SAMPLE.anchors[0].id);
    assert.equal(isCorrectGap(items, 2, 194), false);
  });
  test('인접 칸 오답은 near_miss', () => {
    assert.equal(isNearMiss([3], 2), true);
    assert.equal(isNearMiss([3], 4), true);
    assert.equal(isNearMiss([3], 5), false);
    assert.equal(isNearMiss([3], 3), false);
  });
  test('첫 앵커 앞 틈은 고를 수 없다(무시)', () => {
    const st = sampleSession();
    assert.equal(placeCurrent(st, 0, BY_ID, SAMPLE.anchors, {}, M1).result, null);
  });
});

describe('세션 진행과 §10(8, 10, 11)', () => {
  test('정답: 상자 갱신, 다음 카드, 단서 초기화; 놓은 카드는 칸을 나누지 않는다', () => {
    let st = sampleSession();
    st = revealClue(st, 2);
    const id = currentId(st);
    const r = placeCurrent(st, right(st), BY_ID, SAMPLE.anchors, {}, M1);
    assert.equal(r.result.correct, true);
    assert.equal(r.result.clueUsed, 1);
    assert.equal(r.progress[id].box, 1, '관계 단서로 맞히면 승급 없음');
    assert.deepEqual([r.state.index, r.state.clues], [1, 0]);
    assert.equal(sessionTimeline(r.state, SAMPLE.anchors, M1).length, SAMPLE.anchors.length);
  });

  test('오답: 상자 1, near_miss 기록, 세션 끝에 재도전 1회; 10. 재도전은 상자·일정을 바꾸지 않는다', () => {
    let st = sampleSession();
    let progress = {};
    const first = currentId(st);
    let r = placeCurrent(st, wrong(st, M1, true), BY_ID, SAMPLE.anchors, progress, M1);
    assert.equal(r.result.nearMiss, true);
    ({ state: st, progress } = r);
    assert.equal(st.queue.at(-1), first);
    while (!isRetry(st)) ({ state: st, progress } = placeCurrent(st, right(st), BY_ID, SAMPLE.anchors, progress, M1));
    const before = progress[first];
    r = placeCurrent(st, wrong(st), BY_ID, SAMPLE.anchors, progress, M1);
    assert.equal(r.result.retry, true);
    assert.equal(r.progress[first], before);
    assert.equal(isSessionDone(r.state), true);
    assert.equal(sessionSummary(r.state).retried, 1);
  });

  test('8. 미리 복습과 오답 노트 다시 풀기는 상태를 바꾸지 않는다', () => {
    const progress = { [SAMPLE.cards[0].id]: { ...newEntry(), introduced: true, box: 2, due_session: 9, lapses: 1 } };
    for (const kind of ['early', 'note']) {
      let st = createSessionState(3, [SAMPLE.cards[0].id], { kind });
      const r = placeCurrent(st, wrong(st), BY_ID, SAMPLE.anchors, progress, M1);
      assert.equal(r.progress, progress);
      assert.equal(r.result.practice, true);
      assert.equal(r.state.queue.length, 1, '연습은 재도전도 없다');
      st = r.state;
      assert.equal(completedAfter(4, st, M1), 4, '연습은 세션으로 세지 않는다');
    }
  });

  test('11. 한 장이라도 인출하면 completed_sessions +1, 0장이면 그대로', () => {
    const st = sampleSession();
    assert.equal(completedAfter(0, st, M1), 0);
    const r = placeCurrent(st, right(st), BY_ID, SAMPLE.anchors, {}, M1);
    assert.equal(attemptsOf(r.state), 1);
    assert.equal(completedAfter(0, r.state, M1), 1);
  });

  test('오답 노트: lapses ≥ 1이고 box ≤ 2', () => {
    const p = {
      a: { ...newEntry(), introduced: true, box: 1, lapses: 1 },
      b: { ...newEntry(), introduced: true, box: 3, lapses: 2 },
      c: { ...newEntry(), introduced: true, box: 2, lapses: 0 },
    };
    assert.deepEqual(wrongNoteIds([{ id: 'a' }, { id: 'b' }, { id: 'c' }], p), ['a']);
  });

  test('등급 집계(현재 등급)', () => {
    const p = { [SAMPLE.cards[0].id]: { ...newEntry(), introduced: true, box: 3 } };
    assert.deepEqual(gradeCounts(SAMPLE.cards, p, M1), { unseen: SAMPLE.cards.length - 1, none: 0, bronze: 1, silver: 0, gold: 0 });
  });
});

describe('인출 로그(m1-plan §11 규격)', () => {
  test('필드와 값', () => {
    const st = sampleSession();
    const r = placeCurrent(st, wrong(st, M1, true), BY_ID, SAMPLE.anchors, {}, M1).result;
    const line = logLine({ ts: 123, participant: 'P1', result: r, session: 1, msOnCard: 4567 });
    assert.deepEqual(Object.keys(line), ['ts_ms', 'participant', 'phase', 'arm', 'session_index', 'card_id', 'slot_chosen', 'self_rating', 'correct', 'clue_used', 'box_before', 'box_after', 'near_miss', 'ms_on_card', 'relearn', 'reason_text']);
    assert.deepEqual([line.phase, line.arm, line.correct, line.near_miss, line.box_before, line.box_after, line.relearn], ['learn', 'A', false, true, null, 1, false]);
    assert.ok(SAMPLE.anchors.some((a) => a.id === line.slot_chosen));
  });
  test('연습 줄에는 practice: true', () => {
    const st = createSessionState(1, [SAMPLE.cards[0].id], { kind: 'early' });
    const r = placeCurrent(st, right(st), BY_ID, SAMPLE.anchors, {}, M1).result;
    assert.equal(logLine({ ts: 1, participant: '-', result: r, session: 1, msOnCard: 0 }).practice, true);
  });
});

describe('저장과 복원', () => {
  test('세션 왕복(재도전 포함)', () => {
    let st = sampleSession();
    ({ state: st } = placeCurrent(st, wrong(st), BY_ID, SAMPLE.anchors, {}, M1));
    st = revealClue(st, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(restoreSession(JSON.parse(JSON.stringify(st)), SAMPLE.cards))), JSON.parse(JSON.stringify(st)));
  });
  test('깨진 세션, 없는 카드, 잘못된 상자는 버린다', () => {
    const st = JSON.parse(JSON.stringify(sampleSession()));
    assert.equal(restoreSession({ ...st, queue: ['ghost'] }, SAMPLE.cards), null);
    assert.equal(restoreSession({ ...st, index: 2 }, SAMPLE.cards), null);
    const p = restoreProgress({ [SAMPLE.cards[0].id]: { box: 2, due_session: 3 }, ghost: { box: 2, due_session: 3 }, [SAMPLE.cards[1].id]: { box: 9, due_session: 1 } }, SAMPLE.cards, M1);
    assert.deepEqual(Object.keys(p), [SAMPLE.cards[0].id]);
    assert.equal(p[SAMPLE.cards[0].id].lapses, 0, '빠진 필드는 기본값');
  });
  test('데이터 식별자는 연도가 바뀌면 달라진다', () => {
    const b = structuredClone(SAMPLE);
    b.cards[0].order += 1;
    assert.notEqual(dataFingerprint('x', SAMPLE), dataFingerprint('x', b));
  });
});

describe('데이터 로더(js/data.js)', () => {
  const draft = existsSync(DRAFT_PATH) ? JSON.parse(readFileSync(DRAFT_PATH, 'utf8')) : null;

  test('샘플: 왕 단위 앵커, 검증 통과', () => {
    assert.equal(formatOf(SAMPLE), 'm1-draft');
    assert.deepEqual(validateDeck(SAMPLE), []);
    assert.ok(SAMPLE.anchors.every((a) => a.reign && a.reign_range));
  });

  test('임시 형식 초안(D58)은 더 읽지 않는다(v2로 옮겨 변환을 지움, D72)', { skip: !draft && '초안 없음' }, () => {
    assert.equal(formatOf(draft), 'unknown');
    assert.equal(normalizeDeck(draft).deck, null);
  });

  test('스키마 v2(명세 예시 모양): 앵커 재위, 사료 카드 앞면·단서 refs·정답 칸, disputed 제외', () => {
    const anchor = (id, title, order, start, end) => ({ id, kind: 'anchor', nation: 'goguryeo', title, order, reign: { start, end, basis: 'chronicle' }, summary: `${title}.`, source_ref: { work: '삼국사기', section: '고구려본기', entry: `${title}조` }, verification: { verified: false } });
    const raw = {
      schema: 2,
      cards: [
        anchor('goguryeo-reign-jangsu', '장수왕', 2, 413, 491),
        anchor('goguryeo-reign-sosurim', '소수림왕', 1, 371, 384),
        {
          id: 'goguryeo-src-07', kind: 'source', nation: 'goguryeo', title: '평양 천도', year: 427, year_basis: 'chronicle', reign_label: '장수왕 15년',
          source_text: '왕이 도읍을 옮겼다.', text_basis: 'own_paraphrase_from_original',
          clues: [{ level: 1, kind: 'relation', relations: [{ op: 'after', ref: 'goguryeo-reign-jangsu' }], text: '[장수왕]이 즉위한 뒤의 일이다.' }, { level: 2, kind: 'direct', text: '427년.' }],
          answer: { after: 'goguryeo-reign-jangsu', before: null }, explanation: '장수왕 15년(427).', exam_tags: ['institution', 'war'], disputed: false,
          source_ref: { work: '삼국사기', section: '고구려본기', volume: '권18', entry: '장수왕 15년조' }, verification: { verified: false },
        },
        { id: 'goguryeo-src-99', kind: 'source', nation: 'goguryeo', title: '갈리는 카드', year: 380, disputed: true, answer: { after: 'goguryeo-reign-sosurim', before: 'goguryeo-reign-jangsu' }, clues: [] },
      ],
    };
    const n = normalizeDeck(raw);
    assert.equal(n.format, 'v2');
    assert.deepEqual(n.errors, []);
    assert.deepEqual(validateDeck(n.deck), []);
    assert.deepEqual(n.deck.anchors.map((a) => [a.title, a.order, a.reign_range]), [['소수림왕', 371, '371~384'], ['장수왕', 413, '413~491']]);
    assert.equal(n.deck.cards.length, 1, 'disputed 카드는 판정에서 뺀다');
    const c = n.deck.cards[0];
    assert.deepEqual([c.source_text, c.clues[0].refs[0], c.reign, c.exam_note], ['왕이 도읍을 옮겼다.', 'goguryeo-reign-jangsu', '장수왕 15년', '제도·정치 · 전쟁·대외']);
    assert.match(c.source.name, /권18/);
    assert.deepEqual(correctGaps(buildTimeline(n.deck.anchors), c.order), [2]);
    // 정답 칸 밖 연도는 오류
    raw.cards[2].year = 400;
    assert.match(normalizeDeck(raw).errors.join(), /이후가 아니다/);
  });

  test('스키마 v2 콘텐츠 파일: 변환·검증 통과, 앵커 10·사료 12, 모든 앵커에 재위 기간, 모든 카드가 answer 칸에서만 정답', () => {
    const raw = JSON.parse(readFileSync(V2_PATH, 'utf8'));
    const n = normalizeDeck(raw);
    assert.equal(n.format, 'v2');
    assert.deepEqual(n.errors, []);
    assert.deepEqual(validateDeck(n.deck), []);
    assert.equal(n.deck.anchors.length, 10);
    assert.equal(n.deck.cards.length, 12);
    assert.ok(n.deck.anchors.every((a) => a.reign_range), '앵커 reign_range가 데이터에 있어야 한다(reigns.json 삭제, D66)');
    const t = buildTimeline(n.deck.anchors);
    for (const c of raw.cards.filter((x) => x.kind === 'source' && !x.disputed)) {
      const k = correctGaps(t, n.deck.cards.find((x) => x.id === c.id).order);
      assert.equal(k.length, 1, c.id);
      assert.equal(t[k[0] - 1]?.id ?? null, c.answer.after ?? null, `${c.id} 앞`);
      assert.equal(t[k[0]]?.id ?? null, c.answer.before ?? null, `${c.id} 뒤`);
    }
  });

  test('연도 표기, loadRaw', async () => {
    assert.equal(yearText(-37), '기원전 37년');
    const r = await loadRaw(['a', 'b'], async (u) => ({ ok: u === 'b', status: 404, json: async () => ({}) }));
    assert.equal(r.url, 'b');
  });
});

/* ------------------------------------------------------------------ 사람 테스트 모드(D72) */
import {
  ASSIGNMENTS, splitHalves, stageOrder, armIds, newStudySave, nextStage, testOrder, post1Timing, createTestState, answerTest, testDone,
  rateCurrent, validParticipant, armStoreAdapter,
} from '../js/study.js';
const STUDY_CONFIG = CONFIG;
const REAL_V2 = existsSync(V2_PATH) ? normalizeDeck(JSON.parse(readFileSync(V2_PATH, 'utf8'))).deck : null;

describe('사람 테스트 모드: 배정·반·단계', () => {
  test('m1-plan §4 교차 배정: P1은 A=S1 먼저, P2는 B=S1 먼저', () => {
    assert.deepEqual(stageOrder(ASSIGNMENTS.P1), ['pre', 'learn-A', 'learn-B', 'post0', 'post1']);
    assert.deepEqual(stageOrder(ASSIGNMENTS.P2), ['pre', 'learn-B', 'learn-A', 'post0', 'post1']);
    assert.equal(ASSIGNMENTS.P1.A, 'S1'); assert.equal(ASSIGNMENTS.P1.B, 'S2');
    assert.equal(ASSIGNMENTS.P2.B, 'S1'); assert.equal(ASSIGNMENTS.P2.A, 'S2');
  });
  test('반 나누기: 고정 분할이 덱과 맞으면 그대로, 아니면 연대순 짝마다 앞→S1', () => {
    const deck = (ids, orders) => ids.map((id, i) => ({ id, order: orders[i] }));
    const preset = { S1: ['a', 'c'], S2: ['b', 'd'] };
    assert.equal(splitHalves(deck(['a', 'b', 'c', 'd'], [1, 2, 3, 4]), preset).rule, 'preset');
    const fb = splitHalves(deck(['w', 'x', 'y', 'z'], [40, 10, 30, 20]), preset);
    assert.deepEqual(fb, { S1: ['x', 'y'], S2: ['z', 'w'], rule: 'pairs' });
  });
  test('실제 v2 데이터: 고정 분할 6+6, 겹치지 않고 반마다 연대가 고르게(이웃 짝마다 한 장)', { skip: !REAL_V2 && 'v2 없음' }, () => {
    const h = splitHalves(REAL_V2.cards, STUDY_CONFIG.study.halves);
    assert.equal(h.rule, 'preset');
    assert.equal(h.S1.length, 6); assert.equal(h.S2.length, 6);
    assert.equal(new Set([...h.S1, ...h.S2]).size, 12);
    const sorted = [...REAL_V2.cards].sort((a, b) => a.order - b.order).map((c) => c.id);
    for (let i = 0; i < 12; i += 2) assert.notEqual(h.S1.includes(sorted[i]), h.S1.includes(sorted[i + 1]), `짝 ${i / 2 + 1}`);
    assert.deepEqual(armIds(h, ASSIGNMENTS.P1, 'A'), h.S1);
  });
  test('다음 단계는 끝나지 않은 첫 단계, 모두 끝나면 null', () => {
    const s = newStudySave('P2', ASSIGNMENTS.P2, 'x');
    assert.equal(nextStage(s), 'pre');
    s.stages.pre = { done_at: '2026-11-05T00:00:00Z' };
    assert.equal(nextStage(s), 'learn-B');
    for (const k of ['learn-A', 'learn-B', 'post0', 'post1']) s.stages[k] = { done_at: '2026-11-05T00:00:00Z' };
    assert.equal(nextStage(s), null);
  });
  test('post1 권장 시간 18~30시간', () => {
    const s = newStudySave('P1', ASSIGNMENTS.P1, 'x');
    assert.equal(post1Timing(s, 0, [18, 30]), null);
    s.stages.post0 = { done_at: '2026-11-05T00:00:00Z' };
    const t0 = Date.parse('2026-11-05T00:00:00Z');
    assert.equal(post1Timing(s, t0 + 17 * 3600e3, [18, 30]).ok, false);
    assert.equal(post1Timing(s, t0 + 24 * 3600e3, [18, 30]).ok, true);
    assert.equal(post1Timing(s, t0 + 31 * 3600e3, [18, 30]).ok, false);
  });
  test('참가자 ID는 영문·숫자·-·_ 1~20자', () => {
    assert.ok(validParticipant('P1')); assert.ok(validParticipant('pilot_2'));
    assert.ok(!validParticipant('')); assert.ok(!validParticipant('홍길동')); assert.ok(!validParticipant('a'.repeat(21)));
  });
});

describe('사람 테스트 모드: 테스트 화면 규칙', () => {
  const anchors = SAMPLE.anchors;
  const card = SAMPLE.cards[0];
  const items = buildTimeline(anchors, []);
  const right = correctGaps(items, card.order)[0];
  test('테스트 순서는 참가자·단계마다 고정이고 덱 전체', () => {
    const a = testOrder(SAMPLE.cards, 'P1', 'pre');
    assert.deepEqual(a, testOrder(SAMPLE.cards, 'P1', 'pre'));
    assert.deepEqual([...a].sort(), SAMPLE.cards.map((c) => c.id).sort());
    assert.notDeepEqual(a, testOrder(SAMPLE.cards, 'P1', 'post0'));
  });
  test('답 기록: 규격 필드, 단서 0, 상자 없음, 근거 저장. "모르겠다"는 slot null·오답', () => {
    const st = createTestState([card.id, SAMPLE.cards[1].id]);
    const r = answerTest(st, { k: right, reason: '  광개토왕 비문  ', card, anchors, participant: 'P1', phase: 'pre', ts: 5, msOnCard: 900 });
    assert.deepEqual(Object.keys(r.line), ['ts_ms', 'participant', 'phase', 'arm', 'session_index', 'card_id', 'slot_chosen', 'self_rating', 'correct', 'clue_used', 'box_before', 'box_after', 'near_miss', 'ms_on_card', 'relearn', 'reason_text']);
    assert.equal(r.line.correct, true); assert.equal(r.line.arm, '-'); assert.equal(r.line.clue_used, 0);
    assert.equal(r.line.box_before, null); assert.equal(r.line.reason_text, '광개토왕 비문');
    assert.equal(r.line.slot_chosen, slotAnchorId(items, right));
    const u = answerTest(r.state, { k: null, reason: '', card: SAMPLE.cards[1], anchors, participant: 'P1', phase: 'post1', ts: 6, msOnCard: 1 });
    assert.equal(u.line.slot_chosen, null); assert.equal(u.line.correct, false); assert.equal(u.line.near_miss, false);
    assert.ok(testDone(u.state));
  });
  test('한 칸 차이 오답은 near_miss', () => {
    const near = selectableGaps(items, CONFIG.leitner).find((k) => Math.abs(k - right) === 1);
    const r = answerTest(createTestState([card.id]), { k: near, reason: '', card, anchors, participant: 'P1', phase: 'post0', ts: 1, msOnCard: 1 });
    assert.equal(r.line.correct, false); assert.equal(r.line.near_miss, true);
  });
});

describe('사람 테스트 모드: 방식 B(플래시카드)', () => {
  const cfg = CONFIG.leitner;
  const ids = SAMPLE.cards.slice(0, 3).map((c) => c.id);
  test('"알았다" = 깨끗한 정답(+1), "몰랐다" = 오답(상자 1, 끝에 한 번 더). 재도전은 상자를 바꾸지 않는다', () => {
    let st = createSessionState(1, ids);
    let pr = Object.freeze({});
    let r = rateCurrent(st, true, pr, cfg);
    assert.equal(r.result.selfRating, 'knew'); assert.equal(r.result.boxTo, nextBox(1, true, 0, cfg));
    r = rateCurrent(r.state, false, r.progress, cfg);
    assert.equal(r.result.selfRating, 'didnt_know'); assert.equal(r.result.boxTo, cfg.wrong_box);
    r = rateCurrent(r.state, true, r.progress, cfg);
    assert.equal(r.state.queue.length, 4);
    const before = r.progress[ids[1]];
    r = rateCurrent(r.state, true, r.progress, cfg);
    assert.equal(r.result.retry, true);
    assert.equal(r.progress[ids[1]], before);
    assert.ok(isSessionDone(r.state));
    const sum = sessionSummary(r.state);
    assert.equal(sum.total, 3); assert.equal(sum.right, 2); assert.equal(sum.retried, 1);
    const line = logLine({ ts: 1, participant: 'P1', result: r.result, session: 1, msOnCard: 2, phase: 'learn', arm: 'B' });
    assert.equal(line.arm, 'B'); assert.equal(line.slot_chosen, null); assert.equal(line.self_rating, 'knew'); assert.equal(line.relearn, true);
  });
  test('방식 A 저장 어댑터: 참가자 저장의 arms.A에 넣고, 세션 3회면 단계 끝', () => {
    let saved = newStudySave('P1', ASSIGNMENTS.P1, 'd');
    const store = { load: () => (saved ? JSON.parse(JSON.stringify(saved)) : null), save: (s) => { saved = s; return true; } };
    const ad = armStoreAdapter(store, 'A', 3);
    assert.equal(ad.load().completed_sessions, 0);
    ad.save({ completed_sessions: 2, cards: { x: 1 }, current: null, log: [{ a: 1 }] });
    assert.equal(saved.arms.A.completed_sessions, 2); assert.equal(saved.log.length, 1); assert.equal(saved.stages['learn-A'], undefined);
    ad.save({ completed_sessions: 3, cards: {}, current: null, log: [] });
    assert.ok(saved.stages['learn-A'].done_at);
    assert.equal(saved.arms.B, null);
  });
});
