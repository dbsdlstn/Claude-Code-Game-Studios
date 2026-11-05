// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D72)
/**
 * 사람 테스트 모드의 규칙(화면 없음, 단위 테스트 대상). m1-plan §4(배정), §5(진행), §11(요건·로그 규격).
 * 단계: pre → 첫 방식 학습 → 두 번째 방식 학습 → post0 → (다음 날) post1.
 */
import {
  createRng, shuffle, fnv1a, currentId, isRetry, schedule, buildTimeline, isCorrectGap, correctGaps, isNearMiss, slotAnchorId,
} from './rules.js';

export const PHASES = Object.freeze(['pre', 'learn-A', 'learn-B', 'post0', 'post1']);
export const TEST_PHASES = Object.freeze(['pre', 'post0', 'post1']);

/** m1-plan §4 배정: P1 = A에서 S1 → B에서 S2, P2 = B에서 S1 → A에서 S2. */
export const ASSIGNMENTS = Object.freeze({
  P1: Object.freeze({ first: 'A', A: 'S1', B: 'S2' }),
  P2: Object.freeze({ first: 'B', A: 'S2', B: 'S1' }),
});

export function validParticipant(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,20}$/.test(id);
}

/**
 * 두 반으로 나눈다. preset의 id가 덱에 모두 있으면 그대로, 아니면 연대순 이웃 둘씩 짝지어 앞 → S1, 뒤 → S2.
 * @returns {{S1: string[], S2: string[], rule: 'preset'|'pairs'}}
 */
export function splitHalves(cards, preset = null) {
  const ids = new Set(cards.map((c) => c.id));
  if (preset && [...preset.S1, ...preset.S2].every((id) => ids.has(id)) && preset.S1.length + preset.S2.length === cards.length) {
    return { S1: [...preset.S1], S2: [...preset.S2], rule: 'preset' };
  }
  const sorted = [...cards].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  return { S1: sorted.filter((_, i) => i % 2 === 0).map((c) => c.id), S2: sorted.filter((_, i) => i % 2 === 1).map((c) => c.id), rule: 'pairs' };
}

/** 단계 순서(진행자 화면의 추천 순서). */
export function stageOrder(asg) {
  const second = asg.first === 'A' ? 'B' : 'A';
  return ['pre', `learn-${asg.first}`, `learn-${second}`, 'post0', 'post1'];
}

/** 방식 arm이 학습할 카드 id. */
export function armIds(halves, asg, arm) {
  return halves[asg[arm]];
}

export function newStudySave(participant, asg, dataId) {
  return {
    format: 'hanyang-m1-study', participant, assignment: { ...asg }, dataId,
    arms: { A: null, B: null }, tests: {}, stages: {}, log: [],
  };
}

/** 다음에 할 단계(끝나지 않은 첫 단계). 모두 끝났으면 null. */
export function nextStage(save) {
  return stageOrder(save.assignment).find((s) => !save.stages[s]?.done_at) ?? null;
}

/** 테스트 순서: 덱 전체를 참가자·단계별 시드로 섞는다(같은 참가자는 다시 열어도 같은 순서). */
export function testOrder(cards, participant, phase) {
  return shuffle(cards.map((c) => c.id), createRng(fnv1a(`${participant}|${phase}`)));
}

/** post1이 post0 뒤 권장 시간 안인지. post0이 없으면 null. */
export function post1Timing(save, now, [lo, hi]) {
  const t = save.stages.post0?.done_at;
  if (!t) return null;
  const hours = (now - Date.parse(t)) / 3600000;
  return { hours, ok: hours >= lo && hours <= hi };
}

/* ------------------------------------------------------------------ 테스트(pre/post0/post1) */

export function createTestState(order) {
  return Object.freeze({ order: Object.freeze(order.slice()), index: 0 });
}

/**
 * 테스트 한 장에 답한다. k = 칸 번호, null이면 "모르겠다". 정답은 화면에 알리지 않는다.
 * @returns {{state, line}}
 */
export function answerTest(state, { k, reason, card, anchors, participant, phase, ts, msOnCard }) {
  const items = buildTimeline(anchors, []);
  const correct = k === null ? false : isCorrectGap(items, k, card.order);
  const right = correctGaps(items, card.order);
  const line = {
    ts_ms: ts, participant, phase, arm: '-', session_index: null, card_id: card.id,
    slot_chosen: k === null ? null : slotAnchorId(items, k), self_rating: null, correct, clue_used: 0,
    box_before: null, box_after: null, near_miss: k === null ? false : !correct && isNearMiss(right, k),
    ms_on_card: msOnCard, relearn: false, reason_text: String(reason ?? '').trim(),
  };
  return { state: Object.freeze({ ...state, index: state.index + 1 }), line };
}

export function testDone(state) {
  return state.index >= state.order.length;
}

/* ------------------------------------------------------------------ 방식 B(플래시카드) */

/**
 * 플래시카드 자기 평가. "알았다" = 깨끗한 정답, "몰랐다" = 오답(m1-plan §2). 상자 규칙·재도전은 A와 같다.
 * state는 rules.createSessionState의 모양(placed/retryResults를 sessionSummary가 그대로 읽는다).
 */
export function rateCurrent(state, knew, progress, cfg, at = null) {
  const id = currentId(state);
  if (!id) return { state, progress, result: null };
  const before = progress[id];
  const retry = isRetry(state);
  const counts = !retry && !state.practice;
  const entry = counts ? schedule(before, { correct: knew, clueUsed: 0, session: state.session, at }, cfg) : before;
  const result = {
    id, correct: knew, selfRating: knew ? 'knew' : 'didnt_know', clueUsed: 0, nearMiss: null, slotChosen: null,
    boxFrom: before?.introduced ? before.box : null, boxTo: entry?.introduced ? entry.box : null, retry, practice: state.practice,
  };
  const rec = Object.freeze({ id, correct: knew, clueUsed: 0, boxFrom: result.boxFrom, boxTo: result.boxTo, nearMiss: false });
  let next;
  if (counts) {
    const requeue = !knew && cfg.relearn_in_session;
    next = Object.freeze({ ...state, index: state.index + 1, queue: requeue ? Object.freeze([...state.queue, id]) : state.queue, placed: Object.freeze([...state.placed, rec]) });
  } else {
    next = Object.freeze({
      ...state, index: state.index + 1,
      placed: retry ? state.placed : Object.freeze([...state.placed, rec]),
      retryResults: retry ? Object.freeze([...state.retryResults, Object.freeze({ id, correct: knew, clueUsed: 0 })]) : state.retryResults,
    });
  }
  return { state: next, progress: counts ? Object.freeze({ ...progress, [id]: entry }) : progress, result };
}

/* ------------------------------------------------------------------ 저장(참가자별 키) */

export function studyKeys(storage, prefix) {
  const out = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
  } catch { /* 무시 */ }
  return out.sort();
}

/**
 * 방식 A 학습 화면(main.js)이 쓰는 저장소 어댑터: 일반 모드 저장 모양을 참가자 저장의 arms.A로 옮긴다.
 * 인출 로그는 참가자 저장 하나에 모인다(단계 사이에 섞이지 않게 phase·arm 필드로 구분).
 */
export function armStoreAdapter(studyStore, arm, sessionsPerArm) {
  return {
    load() {
      const s = studyStore.load();
      if (!s) return null;
      const a = s.arms?.[arm];
      return { dataId: s.dataId, completed_sessions: a?.completed_sessions ?? 0, cards: a?.cards ?? {}, current: a?.current ?? null, log: s.log ?? [], participant: s.participant };
    },
    save(data) {
      const s = studyStore.load();
      if (!s) return false;
      s.arms = { ...s.arms, [arm]: { completed_sessions: data.completed_sessions, cards: data.cards, current: data.current } };
      s.log = data.log;
      const stage = `learn-${arm}`;
      if (data.completed_sessions >= sessionsPerArm && !s.stages[stage]?.done_at) s.stages = { ...s.stages, [stage]: { done_at: new Date().toISOString() } };
      return studyStore.save(s);
    },
    clear() { /* 테스트 모드에서는 진행자 화면에서만 지운다 */ },
  };
}
