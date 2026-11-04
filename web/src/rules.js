/**
 * 한양 도감 게임 규칙. DOM과 저장소에 의존하지 않는 순수 함수만 둔다.
 * 상태는 불변 객체로 다루고, 모든 함수는 새 상태를 돌려준다.
 * 근거: design/game-brief.md, design/card-data-schema.md, docs/decision-log.md D2.
 */

/** 보드 행. 순서가 화면 순서다. */
export const NATIONS = Object.freeze([
  Object.freeze({ id: 'goguryeo', label: '고구려' }),
  Object.freeze({ id: 'baekje', label: '백제' }),
  Object.freeze({ id: 'silla', label: '신라' }),
  Object.freeze({ id: 'gaya', label: '가야' }),
]);

/** 보드 열. 정의는 열 머리글에 항상 표시한다(D2). */
export const ERAS = Object.freeze([
  Object.freeze({ id: 'founding', label: '건국기', definition: '건국 전승과 초창기' }),
  Object.freeze({ id: 'peak', label: '전성기', definition: '영토와 세력이 커지고 번영' }),
  Object.freeze({ id: 'ending', label: '결말기', definition: '전쟁의 마무리·멸망·통일 완성' }),
]);

export const CARD_TYPES = Object.freeze(['event', 'artifact', 'person', 'myth']);
const CLUE_KINDS = Object.freeze({ 1: 'description', 2: 'relation', 3: 'direct' });
const NATION_IDS = NATIONS.map((n) => n.id);
const ERA_IDS = ERAS.map((e) => e.id);

/** 나라 id → 한글 이름. 모르는 id는 그대로 돌려준다. */
export function nationLabel(id) {
  return NATIONS.find((n) => n.id === id)?.label ?? id;
}

/** 시기 id → 한글 이름. */
export function eraLabel(id) {
  return ERAS.find((e) => e.id === id)?.label ?? id;
}

/**
 * 스키마 v1 검증 규칙 1~8을 확인한다.
 * @param {Array<object>} cards
 * @returns {{errors: Array<{id: string|null, rule: number, message: string}>, warnings: Array<{id: string|null, rule: number, message: string}>}}
 */
export function validateCards(cards) {
  const errors = [];
  const warnings = [];
  const err = (id, rule, message) => errors.push({ id, rule, message });
  if (!Array.isArray(cards)) {
    err(null, 0, '카드 데이터가 배열이 아니다.');
    return { errors, warnings };
  }
  const byId = new Map();
  for (const c of cards) {
    if (!c || typeof c.id !== 'string' || c.id === '') { err(null, 1, 'id가 없는 카드가 있다.'); continue; }
    if (byId.has(c.id)) err(c.id, 1, `id 중복: ${c.id}`);
    byId.set(c.id, c);
  }
  for (const c of cards) {
    if (!c || typeof c.id !== 'string') continue;
    const id = c.id;
    if (typeof c.title !== 'string' || c.title === '') err(id, 0, 'title이 없다.');
    if (!CARD_TYPES.includes(c.type)) err(id, 0, `type이 잘못되었다: ${c.type}`);
    if (typeof c.anchor !== 'boolean') err(id, 0, 'anchor가 bool이 아니다.');
    if (!c.answer || !NATION_IDS.includes(c.answer.nation) || !ERA_IDS.includes(c.answer.era)) {
      err(id, 2, `answer가 잘못되었다: ${JSON.stringify(c.answer)}`);
    }
    if (c.anchor) {
      if (!Array.isArray(c.clues) || c.clues.length !== 0) err(id, 3, '기준 카드의 clues는 비어 있어야 한다.');
    } else {
      const clues = Array.isArray(c.clues) ? c.clues : [];
      const levelsOk = clues.length === 3 && clues.every((cl, i) => cl && cl.level === i + 1);
      if (!levelsOk) {
        err(id, 3, 'clues는 level 1·2·3 순서로 3개여야 한다.');
      } else {
        clues.forEach((cl) => {
          if (cl.kind !== CLUE_KINDS[cl.level]) err(id, 3, `${cl.level}단계 kind는 ${CLUE_KINDS[cl.level]}여야 한다.`);
          if (typeof cl.text !== 'string' || cl.text === '') err(id, 3, `${cl.level}단계 단서 본문이 없다.`);
          if (!Array.isArray(cl.refs)) err(id, 3, `${cl.level}단계 refs가 배열이 아니다.`);
        });
        const rel = clues[1];
        for (const ref of rel.refs ?? []) {
          const target = byId.get(ref);
          if (!target) err(id, 4, `relation 단서가 없는 id를 가리킨다: ${ref}`);
          else if (!target.anchor) warnings.push({ id, rule: 4, message: `relation 단서가 기준 카드가 아닌 ${ref}를 가리킨다.` });
        }
        if (typeof c.title === 'string' && c.title && clues[0].text?.includes(c.title)) {
          err(id, 5, '1단계 단서에 title이 들어 있다.');
        }
      }
      if (typeof c.explanation !== 'string' || c.explanation === '') err(id, 0, 'explanation이 없다.');
    }
    if (c.disputed === true && !c.disputed_note) err(id, 6, 'disputed 카드에 disputed_note가 없다.');
    if (c.image && (!c.image_source || !c.image_license)) err(id, 7, 'image가 있으면 image_source와 image_license가 필요하다.');
    if (!Number.isInteger(c.difficulty) || c.difficulty < 1 || c.difficulty > 3) err(id, 0, 'difficulty는 1~3 정수여야 한다.');
  }
  for (const n of NATION_IDS) {
    for (const e of ERA_IDS) {
      const ok = cards.some((c) => c && !c.disputed && c.answer?.nation === n && c.answer?.era === e);
      if (!ok) err(null, 8, `${nationLabel(n)} ${eraLabel(e)} 칸에 판정 가능한 카드가 없다.`);
    }
  }
  return { errors, warnings };
}

/** 기준 카드(보드에 미리 놓이는 카드). */
export function anchorCards(cards) {
  return cards.filter((c) => c.anchor === true);
}

/**
 * 판정 대상 카드. 기준 카드, disputed 카드, 검증 오류가 있는 카드는 뺀다.
 * @param {Array<object>} cards
 * @param {{onlyVerified?: boolean, invalidIds?: Set<string>}} [opts]
 */
export function playableCards(cards, opts = {}) {
  const invalid = opts.invalidIds ?? new Set();
  return cards.filter((c) => c.anchor !== true && c.disputed !== true && !invalid.has(c.id)
    && (!opts.onlyVerified || c.verified === true));
}

/** 시드 고정 난수(mulberry32). 같은 시드는 같은 순서를 낸다. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. 원본을 바꾸지 않는다. */
export function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 새 라운드를 만든다.
 * @param {Array<object>} playable playableCards()의 결과
 * @param {{seed: number, startInk: number}} opts
 */
export function createRound(playable, { seed, startInk }) {
  const order = shuffle(playable.map((c) => c.id), createRng(seed));
  return Object.freeze({ seed, startInk, ink: startInk, order, index: 0, shown: 1, placements: Object.freeze([]) });
}

/** 'playing' | 'cleared' | 'failed' */
export function roundStatus(state) {
  if (state.ink <= 0) return 'failed';
  if (state.index >= state.order.length) return 'cleared';
  return 'playing';
}

/** 지금 놓을 카드 id. 라운드가 끝났으면 null. */
export function currentCardId(state) {
  return roundStatus(state) === 'playing' ? state.order[state.index] : null;
}

/** "단서 더 보기". 최대 3단계. */
export function revealNextClue(state, maxClues = 3) {
  if (roundStatus(state) !== 'playing' || state.shown >= maxClues) return state;
  return Object.freeze({ ...state, shown: state.shown + 1 });
}

/**
 * 현재 카드를 (nation, era) 칸에 놓고 판정한다.
 * 오답이면 먹물 -1, 카드는 정답 칸에 공개된 채 소모된다.
 * @returns {{state: object, result: null | {id: string, correct: boolean, placed: {nation: string, era: string}, answer: {nation: string, era: string}, hints: number}}}
 */
export function placeCard(state, cardsById, nation, era) {
  const id = currentCardId(state);
  if (!id || !NATION_IDS.includes(nation) || !ERA_IDS.includes(era)) return { state, result: null };
  const card = cardsById.get(id);
  const correct = card.answer.nation === nation && card.answer.era === era;
  const hints = state.shown - 1;
  const placement = Object.freeze({ id, nation: card.answer.nation, era: card.answer.era, correct, hints, placedNation: nation, placedEra: era });
  const next = Object.freeze({
    ...state,
    ink: correct ? state.ink : state.ink - 1,
    index: state.index + 1,
    shown: 1,
    placements: Object.freeze([...state.placements, placement]),
  });
  return {
    state: next,
    result: { id, correct, placed: { nation, era }, answer: { ...card.answer }, hints },
  };
}

/** 칸별로 놓인 카드 목록. 키는 `${nation}:${era}`. */
export function boardCells(state, anchors) {
  const cells = {};
  for (const n of NATION_IDS) for (const e of ERA_IDS) cells[`${n}:${e}`] = { anchors: [], placed: [] };
  for (const a of anchors) cells[`${a.answer.nation}:${a.answer.era}`]?.anchors.push(a.id);
  for (const p of state.placements) cells[`${p.nation}:${p.era}`].placed.push({ id: p.id, correct: p.correct });
  return cells;
}

/** 라운드 통계. */
export function roundStats(state) {
  const total = state.placements.length;
  const right = state.placements.filter((p) => p.correct).length;
  const hints = state.placements.reduce((s, p) => s + p.hints, 0);
  const cardsWithHints = state.placements.filter((p) => p.hints > 0).length;
  return { total, right, wrong: total - right, rate: total ? Math.round((100 * right) / total) : 0, hints, cardsWithHints, ink: state.ink, deck: state.order.length };
}

/**
 * 도감 수집 기록을 갱신한다. 정답이면 'collected', 오답으로 공개만 되었으면 'revealed'.
 * 한 번 수집한 카드는 이후 오답이 나도 수집 상태를 유지한다.
 */
export function recordInCollection(collection, result) {
  if (!result) return collection;
  const prev = collection[result.id];
  const status = result.correct || prev === 'collected' ? 'collected' : 'revealed';
  return Object.freeze({ ...collection, [result.id]: status });
}

/** 라운드 상태를 저장 가능한 평범한 객체로. */
export function serializeRound(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * 저장된 라운드를 복원한다. 카드 데이터와 맞지 않으면(카드가 바뀌었으면) null.
 * @param {object} saved
 * @param {Array<object>} playable
 */
export function restoreRound(saved, playable) {
  if (!saved || !Array.isArray(saved.order) || !Array.isArray(saved.placements)) return null;
  const ids = new Set(playable.map((c) => c.id));
  if (saved.order.length !== ids.size || !saved.order.every((id) => ids.has(id))) return null;
  const n = saved.order.length;
  if (!Number.isInteger(saved.index) || saved.index < 0 || saved.index > n) return null;
  if (saved.placements.length !== saved.index) return null;
  if (!Number.isInteger(saved.ink) || !Number.isInteger(saved.startInk)) return null;
  const shown = Number.isInteger(saved.shown) ? Math.min(Math.max(saved.shown, 1), 3) : 1;
  return Object.freeze({
    seed: saved.seed, startInk: saved.startInk, ink: saved.ink, order: Object.freeze(saved.order.slice()),
    index: saved.index, shown, placements: Object.freeze(saved.placements.map((p) => Object.freeze({ ...p }))),
  });
}

/** 도감 기록에서 현재 데이터에 없는 id를 걸러낸다. */
export function restoreCollection(saved, cards) {
  if (!saved || typeof saved !== 'object') return Object.freeze({});
  const ids = new Set(cards.map((c) => c.id));
  const out = {};
  for (const [id, v] of Object.entries(saved)) if (ids.has(id) && (v === 'collected' || v === 'revealed')) out[id] = v;
  return Object.freeze(out);
}
