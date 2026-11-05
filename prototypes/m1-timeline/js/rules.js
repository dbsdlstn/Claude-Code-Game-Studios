// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 규칙(DOM 없음, 순수 함수). 연표 위치 판정, 단서 비용, Leitner 상자, 세션 구성, 숙련 도감.
 * 상태는 불변 객체로 다루고 모든 함수는 새 값을 돌려준다. 수치는 config(CONFIG)로 받는다.
 */

/* ------------------------------------------------------------------ 데이터 검증 */

/**
 * M1 초안 형식 검사: { nation, anchors: [...], cards: [...] }.
 * @returns {string[]} 오류 문장 목록(비면 통과)
 */
export function validateDeck(deck) {
  const errs = [];
  if (!deck || typeof deck !== 'object') return ['데이터가 객체가 아니다.'];
  if (!Array.isArray(deck.anchors) || deck.anchors.length < 2) errs.push('기준 카드(anchors)가 2장 이상 필요하다.');
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) errs.push('카드(cards)가 없다.');
  if (errs.length) return errs;
  const ids = new Set();
  const all = [...deck.anchors.map((a) => ['anchor', a]), ...deck.cards.map((c) => ['card', c])];
  for (const [kind, c] of all) {
    const id = c?.id;
    if (typeof id !== 'string' || !id) { errs.push(`${kind}: id가 없다.`); continue; }
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

/* ------------------------------------------------------------------ 연표와 판정 */

/**
 * 연표 항목을 시간순으로 만든다. 같은 order면 기준 카드가 먼저, 그다음 놓인 순서.
 * @param {Array<object>} anchors
 * @param {Array<{id: string, order: number, correct: boolean}>} placed 이번 세션에 놓인 카드
 * @returns {Array<{id: string, order: number, kind: 'anchor'|'placed', correct?: boolean}>}
 */
export function buildTimeline(anchors, placed = []) {
  const items = [
    ...anchors.map((a, i) => ({ id: a.id, order: a.order, kind: 'anchor', seq: i })),
    ...placed.map((p, i) => ({ id: p.id, order: p.order, kind: 'placed', correct: p.correct, seq: 1000 + i })),
  ];
  items.sort((a, b) => a.order - b.order || a.seq - b.seq);
  return items.map(({ seq, ...rest }) => rest);
}

/** 틈 k(0..n)의 앞뒤 항목. 0은 맨 앞(앞 항목 없음), n은 맨 뒤. */
export function gapBounds(items, k) {
  return { before: k > 0 ? items[k - 1] : null, after: k < items.length ? items[k] : null };
}

/** 카드(order)가 틈 k에 들어가면 맞는가. 같은 해(order 같음)는 양쪽 틈 모두 정답. */
export function isCorrectGap(items, k, order) {
  if (!Number.isInteger(k) || k < 0 || k > items.length) return false;
  const { before, after } = gapBounds(items, k);
  return (before === null || before.order <= order) && (after === null || order <= after.order);
}

/** 맞는 틈 번호 목록(같은 해가 연표에 있으면 둘 이상일 수 있다). */
export function correctGaps(items, order) {
  const out = [];
  for (let k = 0; k <= items.length; k++) if (isCorrectGap(items, k, order)) out.push(k);
  return out;
}

/* ------------------------------------------------------------------ Leitner */

/** 정답일 때 승급 폭(단서 비용). 단서를 표 길이 이상 열면 마지막 값. */
export function promotionFor(cluesUsed, cfg) {
  const t = cfg.promoteByClues;
  return t[Math.min(Math.max(cluesUsed, 0), t.length - 1)];
}

/**
 * 카드 한 장의 결과를 학습 기록에 반영한다.
 * @param {object|undefined} entry {box, due, seen, right, wrong, lastClues, lastSession}
 * @param {{correct: boolean, cluesUsed: number, session: number}} result
 * @returns {object} 새 기록
 */
export function applyResult(entry, { correct, cluesUsed, session }, cfg) {
  const from = entry?.box ?? cfg.startBox;
  const box = correct ? Math.min(cfg.boxCount, from + promotionFor(cluesUsed, cfg)) : cfg.wrongBox;
  return Object.freeze({
    box,
    due: session + cfg.intervals[box],
    seen: (entry?.seen ?? 0) + 1,
    right: (entry?.right ?? 0) + (correct ? 1 : 0),
    wrong: (entry?.wrong ?? 0) + (correct ? 0 : 1),
    lastClues: cluesUsed,
    lastSession: session,
  });
}

/** 세션 s에 다시 낼 때가 되었는가(처음 보는 카드는 false; 새 카드는 따로 고른다). */
export function isDue(entry, session) {
  return !!entry && entry.due <= session;
}

/** 숙련 등급: 'none' | 'bronze' | 'silver' | 'gold'. 한 번도 안 봤으면 'unseen'. */
export function mastery(entry, cfg) {
  if (!entry) return 'unseen';
  if (entry.box >= cfg.mastery.gold) return 'gold';
  if (entry.box >= cfg.mastery.silver) return 'silver';
  if (entry.box >= cfg.mastery.bronze) return 'bronze';
  return 'none';
}

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

/**
 * 세션 카드 고르기: (1) 다시 낼 때가 된 카드(오래 밀린 것, 낮은 상자 먼저) (2) 처음 보는 카드
 * (3) 그래도 모자라면 아직 때가 안 된 카드 중 가장 빨리 돌아올 것. 고른 뒤 섞는다.
 * @param {Array<object>} cards
 * @param {Record<string, object>} progress 카드 id → 학습 기록
 * @param {number} session 이번 세션 번호(1부터)
 * @returns {{ids: string[], due: number, fresh: number, early: number}}
 */
export function buildSession(cards, progress, session, cfg, rng) {
  const size = Math.min(cfg.sessionSize, cards.length);
  const due = cards.filter((c) => isDue(progress[c.id], session))
    .sort((a, b) => progress[a.id].due - progress[b.id].due || progress[a.id].box - progress[b.id].box);
  const fresh = shuffle(cards.filter((c) => !progress[c.id]), rng);
  const early = cards.filter((c) => progress[c.id] && !isDue(progress[c.id], session))
    .sort((a, b) => progress[a.id].due - progress[b.id].due || progress[a.id].box - progress[b.id].box);
  const pickDue = due.slice(0, size);
  const pickFresh = fresh.slice(0, size - pickDue.length);
  const pickEarly = early.slice(0, size - pickDue.length - pickFresh.length);
  const ids = shuffle([...pickDue, ...pickFresh, ...pickEarly].map((c) => c.id), rng);
  return { ids, due: pickDue.length, fresh: pickFresh.length, early: pickEarly.length };
}

/* ------------------------------------------------------------------ 세션 진행 */

/** 새 세션 상태. */
export function createSession(cards, progress, session, cfg, seed) {
  const pick = buildSession(cards, progress, session, cfg, createRng(seed));
  return Object.freeze({ session, seed, queue: Object.freeze(pick.ids), index: 0, clues: 0, placed: Object.freeze([]), mix: { due: pick.due, fresh: pick.fresh, early: pick.early } });
}

export function currentId(state) {
  return state.index < state.queue.length ? state.queue[state.index] : null;
}

export function isSessionDone(state) {
  return state.index >= state.queue.length;
}

/** 단서 하나 더 열기(카드의 단서 수까지). */
export function revealClue(state, maxClues) {
  if (isSessionDone(state) || state.clues >= maxClues) return state;
  return Object.freeze({ ...state, clues: state.clues + 1 });
}

/** 지금 연표(기준 카드 + 설정에 따라 이번 세션에 놓인 카드). */
export function sessionTimeline(state, anchors, cfg) {
  return buildTimeline(anchors, cfg.placedJoinTimeline ? state.placed : []);
}

/**
 * 현재 카드를 틈 k에 꽂는다. 결과와 함께 새 세션 상태와 새 학습 기록을 돌려준다.
 * 오답이어도 카드는 맞는 자리에 공개된 채 연표에 들어간다(정답 위치를 보여 주기 위해).
 * @returns {{state, progress, result: null | {id, correct, gap, correctGaps: number[], cluesUsed, boxFrom, boxTo, promoted: number}}}
 */
export function placeCurrent(state, k, cardsById, anchors, progress, cfg) {
  const id = currentId(state);
  if (!id) return { state, progress, result: null };
  const card = cardsById.get(id);
  const items = sessionTimeline(state, anchors, cfg);
  if (!Number.isInteger(k) || k < 0 || k > items.length) return { state, progress, result: null };
  const correct = isCorrectGap(items, k, card.order);
  const before = progress[id];
  const entry = applyResult(before, { correct, cluesUsed: state.clues, session: state.session }, cfg);
  const result = {
    id, correct, gap: k, correctGaps: correctGaps(items, card.order), cluesUsed: state.clues,
    boxFrom: before?.box ?? null, boxTo: entry.box, promoted: entry.box - (before?.box ?? cfg.startBox), isNew: !before,
  };
  const next = Object.freeze({
    ...state,
    index: state.index + 1,
    clues: 0,
    placed: Object.freeze([...state.placed, Object.freeze({ id, order: card.order, correct, gap: k, cluesUsed: state.clues, boxFrom: result.boxFrom, boxTo: entry.box })]),
  });
  return { state: next, progress: Object.freeze({ ...progress, [id]: entry }), result };
}

/** 세션 요약. */
export function sessionSummary(state) {
  const p = state.placed;
  return {
    total: p.length,
    right: p.filter((x) => x.correct).length,
    clues: p.reduce((s, x) => s + x.cluesUsed, 0),
    noClueRight: p.filter((x) => x.correct && x.cluesUsed === 0).length,
    up: p.filter((x) => x.boxTo > (x.boxFrom ?? 1)).length,
    down: p.filter((x) => x.boxFrom !== null && x.boxTo < x.boxFrom).length,
  };
}

/** 숙련 도감 집계. */
export function masteryCounts(cards, progress, cfg) {
  const out = { unseen: 0, none: 0, bronze: 0, silver: 0, gold: 0 };
  for (const c of cards) out[mastery(progress[c.id], cfg)] += 1;
  return out;
}

/** 다음 세션(s)에 다시 낼 카드 수. */
export function dueCount(cards, progress, session) {
  return cards.filter((c) => isDue(progress[c.id], session)).length;
}

/* ------------------------------------------------------------------ 저장 복원 */

/** 데이터 식별자(FNV-1a): 경로 + 카드·기준 id 목록. */
export function dataFingerprint(url, deck) {
  const ids = [...deck.anchors.map((a) => `a:${a.id}:${a.order}`), ...deck.cards.map((c) => `c:${c.id}:${c.order}`)].sort().join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < ids.length; i++) { h ^= ids.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${url}|${deck.cards.length}|${h.toString(16).padStart(8, '0')}`;
}

/** 저장된 학습 기록에서 지금 카드에 있는 id와 올바른 형식만 남긴다. */
export function restoreProgress(saved, cards, cfg) {
  const out = {};
  if (!saved || typeof saved !== 'object') return Object.freeze(out);
  const ids = new Set(cards.map((c) => c.id));
  for (const [id, e] of Object.entries(saved)) {
    if (!ids.has(id) || !e || !Number.isInteger(e.box) || e.box < 1 || e.box > cfg.boxCount || !Number.isInteger(e.due)) continue;
    out[id] = Object.freeze({ ...e });
  }
  return Object.freeze(out);
}

/** 저장된 세션 상태를 검사해 복원. 맞지 않으면 null. */
export function restoreSession(saved, cards) {
  if (!saved || !Array.isArray(saved.queue) || !Array.isArray(saved.placed)) return null;
  const ids = new Set(cards.map((c) => c.id));
  if (!saved.queue.every((id) => ids.has(id)) || new Set(saved.queue).size !== saved.queue.length) return null;
  if (!Number.isInteger(saved.index) || saved.index < 0 || saved.index > saved.queue.length) return null;
  if (saved.placed.length !== saved.index || saved.placed.some((p, i) => p?.id !== saved.queue[i])) return null;
  if (!Number.isInteger(saved.session) || saved.session < 1) return null;
  return Object.freeze({
    session: saved.session, seed: saved.seed, queue: Object.freeze(saved.queue.slice()), index: saved.index,
    clues: Number.isInteger(saved.clues) ? Math.max(0, saved.clues) : 0,
    placed: Object.freeze(saved.placed.map((p) => Object.freeze({ ...p }))), mix: saved.mix ?? null,
  });
}
