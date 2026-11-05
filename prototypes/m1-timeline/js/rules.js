// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 규칙(DOM 없음, 순수 함수). `design/leitner-spec.md`(§3~§6, §10)를 따른다.
 * 연표 칸 판정, 상자 갱신(schedule), 등급, 세션 구성(build_session), 세션 카운트, 오답 노트, 인출 로그.
 * 시간이 아니라 세션 번호를 입력으로 받는다(J1). 수치는 config(CONFIG.leitner)로 받는다.
 */

/* ------------------------------------------------------------------ 데이터 검증 */

/**
 * 정규화된 덱 검사: { nation, anchors: [...], cards: [...] }.
 * @returns {string[]} 오류 문장 목록(비면 통과)
 */
export function validateDeck(deck) {
  const errs = [];
  if (!deck || typeof deck !== 'object') return ['데이터가 객체가 아니다.'];
  if (!Array.isArray(deck.anchors) || deck.anchors.length < 2) errs.push('기준 카드(anchors)가 2장 이상 필요하다.');
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) errs.push('카드(cards)가 없다.');
  if (errs.length) return errs;
  const ids = new Set();
  for (const c of [...deck.anchors, ...deck.cards]) {
    const id = c?.id;
    if (typeof id !== 'string' || !id) { errs.push('id가 없는 카드가 있다.'); continue; }
    if (ids.has(id)) errs.push(`${id}: id 중복`);
    ids.add(id);
    if (typeof c.title !== 'string' || !c.title) errs.push(`${id}: title이 없다.`);
    if (typeof c.order !== 'number' || !Number.isFinite(c.order)) errs.push(`${id}: order(연도 정렬 값)가 숫자가 아니다.`);
    if (typeof c.year_label !== 'string' || !c.year_label) errs.push(`${id}: year_label이 없다.`);
  }
  const anchorOrders = deck.anchors.map((a) => a.order);
  if (new Set(anchorOrders).size !== anchorOrders.length) errs.push('기준 카드끼리 order가 같으면 연표 순서가 정해지지 않는다.');
  const anchorIds = new Set(deck.anchors.map((a) => a.id));
  for (const c of deck.cards) {
    if (typeof c.source_text !== 'string' || !c.source_text) errs.push(`${c.id}: source_text(사료 지문)가 없다.`);
    if (c.title && c.source_text?.includes(c.title)) errs.push(`${c.id}: 사료 지문에 이름(title)이 들어 있다.`);
    if (!Array.isArray(c.clues)) { errs.push(`${c.id}: clues가 배열이 아니다.`); continue; }
    for (const cl of c.clues) for (const r of cl.refs ?? []) if (!anchorIds.has(r)) errs.push(`${c.id}: 단서가 기준 카드가 아닌 ${r}를 가리킨다.`);
  }
  return errs;
}

/* ------------------------------------------------------------------ 연표와 칸 */

/**
 * 연표 항목(시간순). placed를 넣으면 놓인 카드도 항목이 된다(D59의 Timeline 방식, 설정 placedJoinTimeline).
 * M1(D66)은 칸 = 앵커 사이(스키마 v2 "칸 k")라서 placed를 넣지 않는다.
 */
export function buildTimeline(anchors, placed = []) {
  const items = [
    ...anchors.map((a, i) => ({ id: a.id, order: a.order, kind: 'anchor', seq: i })),
    ...placed.map((p, i) => ({ id: p.id, order: p.order, kind: 'placed', correct: p.correct, seq: 1000 + i })),
  ];
  items.sort((a, b) => a.order - b.order || a.seq - b.seq);
  return items.map(({ seq, ...rest }) => rest);
}

/** 틈 k(0..n)의 앞뒤 항목. 틈 k는 항목 k-1과 k 사이. */
export function gapBounds(items, k) {
  return { before: k > 0 ? items[k - 1] : null, after: k < items.length ? items[k] : null };
}

/** 카드(order)가 틈 k에 들어가면 맞는가. 같은 값은 양쪽 틈 모두 정답(정규화에서 ±0.5로 갈라 둔다). */
export function isCorrectGap(items, k, order) {
  if (!Number.isInteger(k) || k < 0 || k > items.length) return false;
  const { before, after } = gapBounds(items, k);
  return (before === null || before.order <= order) && (after === null || order <= after.order);
}

export function correctGaps(items, order) {
  const out = [];
  for (let k = 0; k <= items.length; k++) if (isCorrectGap(items, k, order)) out.push(k);
  return out;
}

/** 칸으로 고를 수 있는 틈 번호. slotBeforeFirst가 false면 첫 앵커 앞(틈 0)은 칸이 아니다(스키마 v2). */
export function selectableGaps(items, cfg) {
  const out = [];
  for (let k = cfg.slotBeforeFirst ? 0 : 1; k <= items.length; k++) out.push(k);
  return out;
}

/** 로그의 slot_chosen: 고른 틈 바로 앞 앵커 id(칸 k = 앵커 k 이후). 첫 앵커 앞이면 null. */
export function slotAnchorId(items, k) {
  for (let i = k - 1; i >= 0; i--) if (items[i].kind === 'anchor') return items[i].id;
  return null;
}

/** 인접 칸 오답: 정답 칸에서 한 칸 차이(leitner-spec §4, J2). 기록만 하고 상자에는 반영하지 않는다. */
export function isNearMiss(correctList, k) {
  return !correctList.includes(k) && correctList.some((c) => Math.abs(c - k) === 1);
}

/* ------------------------------------------------------------------ 상자, 등급 (§3, §4) */

/** 상자 b의 간격(세션 수). intervals는 상자 1부터의 배열. */
export function intervalFor(box, cfg) {
  return cfg.intervals[Math.min(Math.max(box, 1), cfg.boxes) - 1];
}

/** §4 상자 갱신 표. clueUsed: 0 없음, 1 관계, 2 직접. */
export function nextBox(box, correct, clueUsed, cfg) {
  if (!correct) return cfg.wrong_box;
  if (clueUsed <= 0) return Math.min(cfg.boxes, box + 1);
  const rule = clueUsed === 1 ? cfg.clue_rules.relation : cfg.clue_rules.direct;
  if (rule === 'hold') return box;
  const m = /^demote_(\d+)$/.exec(rule);
  return m ? Math.max(1, box - Number(m[1])) : box;
}

/** 등급(§4.1): 0 없음, 1 동(box ≥ bronze), 2 은(box ≥ silver), 3 금(box = gold이고 마지막 인출이 깨끗한 정답). */
export function gradeOf(entry, cfg) {
  if (!entry?.introduced) return 0;
  if (entry.box >= cfg.grades.gold && entry.clean_streak > 0) return 3;
  if (entry.box >= cfg.grades.silver) return 2;
  if (entry.box >= cfg.grades.bronze) return 1;
  return 0;
}
export const GRADE_NAME = ['없음', '동', '은', '금'];

/** 새 카드의 출발 상태(§2). */
export function newEntry() {
  return { box: 1, introduced: false, due_session: 0, last_session: 0, clean_streak: 0, lapses: 0, best_grade: 0, last_played_at: null };
}

/**
 * 도래한(또는 새) 카드를 인출한 결과로 다음 상태를 만든다(§3, §4). 순수 함수.
 * @param {object|undefined} entry
 * @param {{correct: boolean, clueUsed: number, session: number, at?: string|null}} r
 */
export function schedule(entry, { correct, clueUsed, session, at = null }, cfg) {
  const e = entry ?? newEntry();
  const box = nextBox(e.box, correct, clueUsed, cfg);
  const clean = correct && clueUsed <= 0;
  const next = {
    box,
    introduced: true,
    due_session: session + intervalFor(box, cfg),
    last_session: session,
    clean_streak: clean ? e.clean_streak + 1 : 0,
    lapses: e.lapses + (correct ? 0 : 1),
    best_grade: e.best_grade,
    last_played_at: at,
  };
  next.best_grade = Math.max(e.best_grade, gradeOf(next, cfg));
  return Object.freeze(next);
}

export function isDue(entry, session) {
  return !!entry?.introduced && entry.due_session <= session;
}

/* ------------------------------------------------------------------ 세션 구성 (§5) */

/** 시드 고정 난수(mulberry32). */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** 큐 섞기 시드: 세션 번호와 덱 해시(§5-5). extra는 테스트·재현용(?seed=). */
export function sessionSeed(deckHash, session, extra = 0) {
  return fnv1a(`${deckHash}:${session}:${extra}`);
}

/**
 * §5 큐 구성. 새 카드 예약(new_min) → 도래 카드(상자 낮은 순, due 오래된 순, 덱 순서)로 S-예약까지
 * → 새 카드를 new_max까지 → 자리가 남아도 채우지 않음 → 시드로 섞기.
 * @param {Array<object>} cards 덱 순서
 * @returns {{ids: string[], due: number, fresh: number}}
 */
export function buildSession(cards, progress, session, cfg, seed) {
  const S = cfg.session_size;
  const unintroduced = cards.filter((c) => !progress[c.id]?.introduced);
  const reserve = Math.min(cfg.new_min, unintroduced.length);
  const order = new Map(cards.map((c, i) => [c.id, i]));
  const due = cards.filter((c) => isDue(progress[c.id], session))
    .sort((a, b) => progress[a.id].box - progress[b.id].box
      || progress[a.id].due_session - progress[b.id].due_session
      || order.get(a.id) - order.get(b.id));
  const pickDue = due.slice(0, Math.max(0, S - reserve));
  const newMax = Math.max(cfg.new_min, Math.floor(S * cfg.new_max_ratio));
  const newCount = Math.min(unintroduced.length, Math.max(reserve, Math.min(newMax, S - pickDue.length)));
  const pickNew = unintroduced.slice(0, newCount);
  const ids = shuffle([...pickDue, ...pickNew].map((c) => c.id), createRng(seed));
  return { ids, due: pickDue.length, fresh: pickNew.length };
}

/** 미리 복습(연습) 큐: 도입된 카드 중 가장 빨리 도래할 카드부터 S장(§5-4). 상태를 바꾸지 않는다. */
export function earlyReviewIds(cards, progress, cfg) {
  const order = new Map(cards.map((c, i) => [c.id, i]));
  return cards.filter((c) => progress[c.id]?.introduced)
    .sort((a, b) => progress[a.id].due_session - progress[b.id].due_session || order.get(a.id) - order.get(b.id))
    .slice(0, cfg.session_size).map((c) => c.id);
}

/** 오답 노트(§6): lapses ≥ 1이고 현재 box ≤ 2. */
export function wrongNoteIds(cards, progress) {
  return cards.filter((c) => (progress[c.id]?.lapses ?? 0) >= 1 && progress[c.id].box <= 2).map((c) => c.id);
}

/* ------------------------------------------------------------------ 세션 진행 */

/**
 * 세션 상태. queue의 앞 base장이 본 카드, 그 뒤가 오답 재도전(relearn). practice면 상태를 바꾸지 않는 연습.
 * @param {'learn'|'early'|'note'} kind
 */
export function createSessionState(session, ids, { kind = 'learn', mix = null } = {}) {
  return Object.freeze({
    session, kind, practice: kind !== 'learn', queue: Object.freeze(ids.slice()), base: ids.length,
    index: 0, clues: 0, placed: Object.freeze([]), retryResults: Object.freeze([]), mix,
  });
}

export function currentId(state) {
  return state.index < state.queue.length ? state.queue[state.index] : null;
}
export function isSessionDone(state) {
  return state.index >= state.queue.length;
}
export function isRetry(state) {
  return state.index >= state.base && state.index < state.queue.length;
}
/** 이번 세션에서 실제로 인출한 수(재도전 포함). */
export function attemptsOf(state) {
  return state.placed.length + state.retryResults.length;
}

export function revealClue(state, maxClues) {
  if (isSessionDone(state) || state.clues >= maxClues) return state;
  return Object.freeze({ ...state, clues: state.clues + 1 });
}

/** 지금 판정에 쓰는 연표. placedJoinTimeline이면 놓인 카드도 항목(재도전 중인 카드는 뺀다). */
export function sessionTimeline(state, anchors, cfg) {
  if (!cfg.placedJoinTimeline) return buildTimeline(anchors, []);
  const hide = isRetry(state) ? currentId(state) : null;
  return buildTimeline(anchors, state.placed.filter((p) => p.id !== hide));
}

/**
 * 현재 카드를 틈 k에 꽂는다. 학습 첫 시도만 상자를 바꾼다(재도전 J7, 연습 J6은 바꾸지 않음).
 * @returns {{state, progress, result: null | object}}
 */
export function placeCurrent(state, k, cardsById, anchors, progress, cfg, at = null) {
  const id = currentId(state);
  if (!id) return { state, progress, result: null };
  const card = cardsById.get(id);
  const items = sessionTimeline(state, anchors, cfg);
  if (!selectableGaps(items, cfg).includes(k)) return { state, progress, result: null };
  const correct = isCorrectGap(items, k, card.order);
  const rightList = correctGaps(items, card.order);
  const before = progress[id];
  const retry = isRetry(state);
  const counts = !retry && !state.practice;
  const entry = counts ? schedule(before, { correct, clueUsed: state.clues, session: state.session, at }, cfg) : before;
  const result = {
    id, correct, gap: k, correctGaps: rightList, clueUsed: state.clues,
    boxFrom: before?.introduced ? before.box : null, boxTo: entry?.introduced ? entry.box : null,
    retry, practice: state.practice, nearMiss: !correct && isNearMiss(rightList, k),
    slotChosen: slotAnchorId(items, k), slotRight: slotAnchorId(items, rightList[0]),
  };
  let next;
  if (counts) {
    const requeue = !correct && cfg.relearn_in_session;
    next = Object.freeze({
      ...state, index: state.index + 1, clues: 0,
      queue: requeue ? Object.freeze([...state.queue, id]) : state.queue,
      placed: Object.freeze([...state.placed, Object.freeze({ id, order: card.order, correct, gap: k, clueUsed: result.clueUsed, boxFrom: result.boxFrom, boxTo: result.boxTo, nearMiss: result.nearMiss })]),
    });
  } else {
    next = Object.freeze({
      ...state, index: state.index + 1, clues: 0,
      placed: retry ? state.placed : Object.freeze([...state.placed, Object.freeze({ id, order: card.order, correct, gap: k, clueUsed: result.clueUsed, boxFrom: result.boxFrom, boxTo: result.boxTo, nearMiss: result.nearMiss })]),
      retryResults: retry ? Object.freeze([...state.retryResults, Object.freeze({ id, correct, gap: k, clueUsed: result.clueUsed })]) : state.retryResults,
    });
  }
  return { state: next, progress: counts ? Object.freeze({ ...progress, [id]: entry }) : progress, result };
}

/**
 * 세션 카운트(§5): 학습 세션에서 인출이 count_session_min_answers장 이상이면 completed_sessions + 1.
 * 연습(미리 복습·오답 노트)은 세지 않는다.
 */
export function completedAfter(completed, state, cfg) {
  if (!state || state.practice) return completed;
  return attemptsOf(state) >= cfg.count_session_min_answers ? completed + 1 : completed;
}

/** 세션 요약. */
export function sessionSummary(state) {
  const p = state.placed;
  return {
    total: p.length,
    right: p.filter((x) => x.correct).length,
    clean: p.filter((x) => x.correct && x.clueUsed === 0).length,
    clueRelation: p.filter((x) => x.clueUsed === 1).length,
    clueDirect: p.filter((x) => x.clueUsed >= 2).length,
    nearMiss: p.filter((x) => x.nearMiss).length,
    up: p.filter((x) => x.boxTo !== null && x.boxTo > (x.boxFrom ?? 1)).length,
    down: p.filter((x) => x.boxFrom !== null && x.boxTo !== null && x.boxTo < x.boxFrom).length,
    retried: state.retryResults.length,
    retryRight: state.retryResults.filter((x) => x.correct).length,
  };
}

/** 숙련 도감 집계: 현재 등급 기준. */
export function gradeCounts(cards, progress, cfg) {
  const out = { unseen: 0, none: 0, bronze: 0, silver: 0, gold: 0 };
  const key = ['none', 'bronze', 'silver', 'gold'];
  for (const c of cards) {
    const e = progress[c.id];
    if (!e?.introduced) out.unseen += 1;
    else out[key[gradeOf(e, cfg)]] += 1;
  }
  return out;
}

export function dueCount(cards, progress, session) {
  return cards.filter((c) => isDue(progress[c.id], session)).length;
}

/* ------------------------------------------------------------------ 인출 로그 (m1-plan §11) */

/**
 * 로그 한 줄. 필드는 m1-plan의 규격 그대로: ts_ms, participant, phase, arm, session_index, card_id,
 * slot_chosen, correct, clue_used, box_before, box_after, near_miss, ms_on_card, relearn, reason_text.
 * 연습(미리 복습·오답 노트)은 규격에 phase 값이 없어 phase "learn"으로 두고 추가 필드 practice를 붙인다(D66).
 */
export function logLine({ ts, participant, result, session, msOnCard }) {
  const line = {
    ts_ms: ts, participant, phase: 'learn', arm: 'A', session_index: session, card_id: result.id,
    slot_chosen: result.slotChosen, correct: result.correct, clue_used: result.clueUsed,
    box_before: result.boxFrom, box_after: result.boxTo, near_miss: result.nearMiss,
    ms_on_card: msOnCard, relearn: result.retry, reason_text: null,
  };
  if (result.practice) line.practice = true;
  return line;
}

/* ------------------------------------------------------------------ 저장 복원 */

export function dataFingerprint(url, deck) {
  const ids = [...deck.anchors.map((a) => `a:${a.id}:${a.order}`), ...deck.cards.map((c) => `c:${c.id}:${c.order}`)].sort().join('\n');
  return `${url}|${deck.cards.length}|${fnv1a(ids).toString(16).padStart(8, '0')}`;
}

/** 저장된 카드 상태에서 지금 카드에 있는 id와 올바른 형식만 남긴다. */
export function restoreProgress(saved, cards, cfg) {
  const out = {};
  if (!saved || typeof saved !== 'object') return Object.freeze(out);
  const ids = new Set(cards.map((c) => c.id));
  for (const [id, e] of Object.entries(saved)) {
    if (!ids.has(id) || !e || !Number.isInteger(e.box) || e.box < 1 || e.box > cfg.boxes || !Number.isInteger(e.due_session)) continue;
    out[id] = Object.freeze({ ...newEntry(), ...e });
  }
  return Object.freeze(out);
}

/** 저장된 세션 상태를 검사해 복원. 맞지 않으면 null. */
export function restoreSession(saved, cards) {
  if (!saved || !Array.isArray(saved.queue) || !Array.isArray(saved.placed)) return null;
  const ids = new Set(cards.map((c) => c.id));
  const base = Number.isInteger(saved.base) ? saved.base : saved.queue.length;
  const retryResults = Array.isArray(saved.retryResults) ? saved.retryResults : [];
  if (base < 0 || base > saved.queue.length || !saved.queue.every((id) => ids.has(id))) return null;
  const head = saved.queue.slice(0, base);
  const tail = saved.queue.slice(base);
  if (new Set(head).size !== head.length || new Set(tail).size !== tail.length) return null;
  if (!Number.isInteger(saved.index) || saved.index < 0 || saved.index > saved.queue.length) return null;
  if (saved.placed.length !== Math.min(saved.index, base) || saved.placed.some((p, i) => p?.id !== head[i])) return null;
  const wrongFirst = new Set(saved.placed.filter((p) => !p.correct).map((p) => p.id));
  if (!tail.every((id) => wrongFirst.has(id))) return null;
  if (retryResults.length !== Math.max(0, saved.index - base) || retryResults.some((r, i) => r?.id !== tail[i])) return null;
  if (!Number.isInteger(saved.session) || saved.session < 1) return null;
  const kind = ['learn', 'early', 'note'].includes(saved.kind) ? saved.kind : 'learn';
  return Object.freeze({
    session: saved.session, kind, practice: kind !== 'learn', queue: Object.freeze(saved.queue.slice()), base, index: saved.index,
    clues: Number.isInteger(saved.clues) ? Math.max(0, saved.clues) : 0,
    placed: Object.freeze(saved.placed.map((p) => Object.freeze({ ...p }))),
    retryResults: Object.freeze(retryResults.map((r) => Object.freeze({ ...r }))), mix: saved.mix ?? null,
  });
}
