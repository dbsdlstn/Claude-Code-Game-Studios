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

const NATION_LABELS = Object.fromEntries(NATIONS.map((n) => [n.id, n.label]));
const ERA_LABELS = Object.fromEntries(ERAS.map((e) => [e.id, e.label]));
const TARGET_PER_CELL = 3;
const REQUIRED = {
  id: 'string', type: 'string', title: 'string', anchor: 'boolean', answer: 'object',
  clues: 'array', source: 'object', verified: 'boolean', disputed: 'boolean', difficulty: 'int',
};
const OPTIONAL_NULLABLE_STR = ['explanation', 'date_label', 'verified_by', 'disputed_note', 'image', 'image_source', 'image_license'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const typeOk = (v, t) => {
  if (t === 'array') return Array.isArray(v);
  if (t === 'object') return isObj(v);
  if (t === 'int') return Number.isInteger(v);
  return typeof v === t;
};

/**
 * 카드 데이터 검증. `tools/validate_cards.py`와 같은 규칙(FIELD, R1~R9)을 같은 순서·같은 대상 id로 낸다.
 * 두 구현의 일치는 web/tests/validator-parity.test.js가 확인한다.
 * @param {Array<object>} cards
 * @param {{release?: boolean}} [opts] release면 규칙 9를 관문으로 적용(출시 카드만으로 12칸이 차야 한다).
 * @returns {{errors: Array<{id: string, rule: string, message: string}>, warnings: Array<{id: string, rule: string, message: string}>}}
 */
export function validateCards(cards, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (id, rule, message) => errors.push({ id: String(id), rule, message });
  if (!Array.isArray(cards)) {
    err('<root>', 'FIELD', '카드 데이터가 배열이 아니다.');
    return { errors, warnings };
  }

  // 필드·타입
  cards.forEach((c, i) => {
    if (!isObj(c)) { err(`<index ${i}>`, 'FIELD', '카드가 객체가 아니다.'); return; }
    const cid = 'id' in c ? c.id : `<index ${i}>`;
    for (const [k, t] of Object.entries(REQUIRED)) {
      if (!(k in c)) err(cid, 'FIELD', `필수 필드 '${k}'가 없다.`);
      else if (!typeOk(c[k], t)) err(cid, 'FIELD', `'${k}'의 타입이 ${t}가 아니다.`);
    }
    for (const k of OPTIONAL_NULLABLE_STR) {
      if (k in c && c[k] !== null && typeof c[k] !== 'string') err(cid, 'FIELD', `'${k}'는 문자열이나 null이어야 한다.`);
    }
    if ('tags' in c && !(Array.isArray(c.tags) && c.tags.every((t) => typeof t === 'string'))) err(cid, 'FIELD', "'tags'는 문자열 배열이어야 한다.");
    if (!CARD_TYPES.includes(c.type)) err(cid, 'FIELD', `type '${c.type}'이 잘못되었다.`);
    if (Number.isInteger(c.difficulty) && (c.difficulty < 1 || c.difficulty > 3)) err(cid, 'FIELD', 'difficulty는 1~3이어야 한다.');
    if (!nonEmpty(c.title)) err(cid, 'FIELD', 'title이 비어 있다.');
    const src = c.source;
    if (isObj(src)) {
      if (!nonEmpty(src.name)) err(cid, 'FIELD', 'source.name이 비어 있다.');
      if (!('url' in src) || !(src.url === null || typeof src.url === 'string')) err(cid, 'FIELD', 'source.url이 있어야 한다(문자열 또는 null).');
      else if (typeof src.url === 'string' && !/^https?:\/\//.test(src.url)) err(cid, 'FIELD', 'source.url은 http(s)://로 시작해야 한다.');
      if (typeof src.note !== 'string') err(cid, 'FIELD', 'source.note는 문자열이어야 한다.');
    }
    if (!c.anchor) {
      if (!nonEmpty(c.explanation)) err(cid, 'FIELD', '일반 카드에는 explanation이 필요하다.');
      else {
        const era = isObj(c.answer) ? c.answer.era : undefined;
        if (era in ERA_LABELS && !c.explanation.includes(ERA_LABELS[era])) err(cid, 'FIELD', `explanation에 시기 이름 '${ERA_LABELS[era]}'이 있어야 한다.`);
      }
    }
  });

  const good = cards.filter(isObj);
  // R1
  const seen = new Map();
  for (const c of good) {
    if (seen.has(c.id)) err(c.id, 'R1', 'id 중복');
    seen.set(c.id, c);
  }
  // R2
  for (const c of good) {
    if (!isObj(c.answer)) continue;
    if (!(c.answer.nation in NATION_LABELS)) err(c.id, 'R2', `answer.nation '${c.answer.nation}'이 잘못되었다.`);
    if (!(c.answer.era in ERA_LABELS)) err(c.id, 'R2', `answer.era '${c.answer.era}'이 잘못되었다.`);
  }
  // R3, R4, R5
  for (const c of good) {
    const cid = c.id;
    const clues = c.clues;
    if (!Array.isArray(clues)) continue;
    if (c.anchor === true) {
      if (clues.length) err(cid, 'R3', '기준 카드의 clues는 비어 있어야 한다.');
      continue;
    }
    const levels = clues.map((cl) => (isObj(cl) ? cl.level : null));
    if (levels.length !== 3 || levels.some((lv, i) => lv !== i + 1)) err(cid, 'R3', `단서 level은 [1, 2, 3]이어야 한다: ${JSON.stringify(levels)}`);
    for (const cl of clues) {
      if (!isObj(cl)) continue;
      const { level: lv, kind, refs } = cl;
      let text = cl.text;
      if (lv in CLUE_KINDS && kind !== CLUE_KINDS[lv]) err(cid, 'R3', `${lv}단계 kind는 '${CLUE_KINDS[lv]}'이어야 한다.`);
      if (!nonEmpty(text)) { err(cid, 'R3', `${lv}단계 단서 본문이 비어 있다.`); text = ''; }
      if (!Array.isArray(refs)) { err(cid, 'R4', `${lv}단계 refs가 배열이 아니다.`); continue; }
      if (kind === 'relation') {
        if (!refs.length) err(cid, 'R4', 'relation 단서에는 ref가 1개 이상 필요하다.');
        for (const r of refs) {
          const target = seen.get(r);
          if (!target) { err(cid, 'R4', `ref '${r}'가 없다.`); continue; }
          if (target.anchor !== true) err(cid, 'R4', `ref '${r}'가 기준 카드가 아니다(배치 보장 없음).`);
          if (target.disputed === true) err(cid, 'R4', `ref '${r}'가 disputed 카드다.`);
          if (!text.includes(`[${target.title}]`)) err(cid, 'R4', `relation 본문에 '[${target.title}]'가 있어야 한다.`);
        }
      } else if (refs.length) {
        err(cid, 'R4', `${lv}단계(${kind}) 단서의 refs는 비어 있어야 한다.`);
      }
      if (lv === 1 && text) {
        const title = c.title || '';
        if (title && text.includes(title)) err(cid, 'R5', '1단계 단서에 title이 들어 있다.');
        for (const word of [...Object.values(NATION_LABELS), ...Object.values(ERA_LABELS)]) {
          if (text.includes(word)) err(cid, 'R5', `1단계 단서에 '${word}'가 들어 있다.`);
        }
      }
    }
  }
  // R6
  for (const c of good) {
    if (c.disputed === true) {
      if (!nonEmpty(c.disputed_note)) err(c.id, 'R6', 'disputed 카드에 disputed_note가 없다.');
      if (c.anchor === true) err(c.id, 'R6', 'disputed 카드는 기준 카드가 될 수 없다.');
    } else if (c.disputed_note !== null && c.disputed_note !== undefined) {
      err(c.id, 'R6', 'disputed가 false면 disputed_note는 null이어야 한다.');
    }
  }
  // R7
  for (const c of good) {
    if (c.image !== null && c.image !== undefined) {
      for (const k of ['image_source', 'image_license']) if (!nonEmpty(c[k])) err(c.id, 'R7', `image가 있는데 ${k}가 비어 있다.`);
    }
  }
  // R8
  const cellCounts = (subset) => {
    const counts = new Map();
    for (const n of NATION_IDS) for (const e of ERA_IDS) counts.set(`${n}/${e}`, 0);
    for (const c of subset) {
      const key = isObj(c.answer) ? `${c.answer.nation}/${c.answer.era}` : '';
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    }
    return counts;
  };
  const judged = good.filter((c) => c.anchor === false && c.disputed === false);
  for (const [cell, k] of cellCounts(judged)) {
    if (k === 0) err(`cell ${cell}`, 'R8', '판정 카드가 없다.');
    else if (k < TARGET_PER_CELL) warnings.push({ id: `cell ${cell}`, rule: 'R8', message: `판정 카드 ${k}장(목표 ${TARGET_PER_CELL}장)` });
  }
  // R9
  for (const c of good) {
    if (c.verified === true && !nonEmpty(c.verified_by)) err(c.id, 'R9', 'verified: true면 verified_by가 필요하다.');
  }
  if (opts.release) {
    const releaseJudged = good.filter((c) => c.verified === true && c.disputed === false && c.anchor === false);
    for (const [cell, k] of cellCounts(releaseJudged)) if (k === 0) err(`cell ${cell}`, 'R9', '출시 카드만으로는 판정 카드가 없다.');
  }
  return { errors, warnings };
}

/** 기준 카드(보드에 미리 놓이는 카드). */
export function anchorCards(cards) {
  return cards.filter((c) => c.anchor === true);
}

/**
 * 판정 대상 카드: 기준 카드와 disputed 카드를 뺀다. onlyVerified면 verified: true만(규칙 9).
 * @param {Array<object>} cards
 * @param {{onlyVerified?: boolean}} [opts]
 */
export function playableCards(cards, opts = {}) {
  return cards.filter((c) => c.anchor !== true && c.disputed !== true && (!opts.onlyVerified || c.verified === true));
}

/** 출시 모드 로드 필터(규칙 9): verified: true이고 disputed: false인 카드만 남긴다. */
export function releaseFilter(cards) {
  return cards.filter((c) => c.verified === true && c.disputed === false);
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
 * 라운드에 낼 카드 id를 고른다(D16): 칸마다 판정 카드 1장, 아직 수집하지 않은 카드를 먼저, 그다음 섞는다.
 * Godot `RoundBuilder.build_queue`와 같은 절차다(난수 소비 순서까지 같지는 않다).
 * @param {Array<object>} playable
 * @param {() => number} rng
 * @param {Record<string, string>} [collection] {id: 'collected'|'revealed'}
 * @returns {string[]}
 */
export function buildRoundOrder(playable, rng, collection = {}) {
  const picks = [];
  for (const n of NATION_IDS) {
    for (const e of ERA_IDS) {
      const candidates = playable.filter((c) => c.answer.nation === n && c.answer.era === e);
      if (!candidates.length) continue;
      const fresh = candidates.filter((c) => collection[c.id] !== 'collected');
      const pool = fresh.length ? fresh : candidates;
      picks.push(pool[Math.floor(rng() * pool.length)].id);
    }
  }
  return shuffle(picks, rng);
}

/**
 * 새 라운드를 만든다.
 * @param {Array<object>} playable playableCards()의 결과
 * @param {{seed: number, startInk: number, collection?: Record<string, string>}} opts
 */
export function createRound(playable, { seed, startInk, collection = {} }) {
  const order = buildRoundOrder(playable, createRng(seed), collection);
  return Object.freeze({ seed, startInk, ink: startInk, order: Object.freeze(order), index: 0, shown: 1, placements: Object.freeze([]) });
}

/** 판정 카드 전부를 수집했는가(게임 클리어, D16). */
export function isDogamComplete(playable, collection) {
  return playable.length > 0 && playable.every((c) => collection[c.id] === 'collected');
}

/** 도감 진행: 수집 수 / 판정 카드 수. */
export function dogamProgress(playable, collection) {
  return { collected: playable.filter((c) => collection[c.id] === 'collected').length, total: playable.length };
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
  const byId = new Map(playable.map((c) => [c.id, c]));
  const cellsWithCards = new Set(playable.map((c) => `${c.answer.nation}:${c.answer.era}`));
  const cells = new Set();
  for (const id of saved.order) {
    const c = byId.get(id);
    if (!c) return null;
    const key = `${c.answer.nation}:${c.answer.era}`;
    if (cells.has(key)) return null;
    cells.add(key);
  }
  if (cells.size !== cellsWithCards.size) return null;
  const n = saved.order.length;
  if (!Number.isInteger(saved.index) || saved.index < 0 || saved.index > n) return null;
  if (saved.placements.length !== saved.index) return null;
  if (saved.placements.some((p, i) => !p || p.id !== saved.order[i])) return null;
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
