// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * 데이터 로더. 형식 차이는 이 파일 한 곳에서 흡수해 화면과 규칙에는 같은 모양({nation, anchors, cards})을 넘긴다.
 * 지원 형식:
 *   - 'v2'               : 스키마 v2 `{ schema: 2, cards: [...] }`(design/card-data-schema-v2.md). 콘텐츠가 옮기면 이것만 남긴다.
 *   - 'v2-draft-content' : 임시 형식(D58, assets/data/cards/v2-draft/). v2로 옮겨지면 지운다(D66).
 *   - 'm1-draft'         : data/sample.json(테스트용 샘플)
 * 정규화 결과(카드 공통): id, title, order(정렬 값), year_label, reign(왕), source_text, source{name, ref},
 * clues[{level, kind, text, refs}], explanation, exam_note, verified. 앵커: id, title(단서의 [제목]과 맞춤),
 * order(즉위 연도), year_label, reign(왕 이름), reign_range, explanation.
 */

const NATION_LABEL = { goguryeo: '고구려', baekje: '백제', silla: '신라', gaya: '가야' };
const TAG_LABEL = { institution: '제도·정치', person: '인물', war: '전쟁·대외', culture: '문화·종교·사회' };

/** 연도 표기: 음수는 기원전. */
export function yearText(y) {
  return y < 0 ? `기원전 ${-y}년` : `${y}년`;
}
const rangeText = (s, e) => `${s < 0 ? `기원전 ${-s}` : s}~${e < 0 ? `기원전 ${-e}` : e}`;

export function formatOf(raw) {
  if (raw?.schema === 2 && Array.isArray(raw.cards)) return 'v2';
  if (typeof raw?._format === 'string' && raw._format.startsWith('v2-draft-content')) return 'v2-draft-content';
  if (raw?.schema === 'm1-draft') return 'm1-draft';
  return 'unknown';
}

/**
 * 같은 해에 기준 카드가 있으면 정답 칸(after/before)에 맞춰 ±0.5를 준다(예: 고국원왕 전사 371 → 소수림왕 즉위 371 앞).
 * 정답 칸 밖의 연도면 오류.
 */
function orderInSlot(card, year, after, before, errors) {
  let order = year;
  if (before && year === before.order) order = year - 0.5;
  else if (after && year === after.order) order = year + 0.5;
  if (after && !(after.order < order)) errors.push(`${card.id}: 연도 ${year}가 ${after.title}(${after.order}) 이후가 아니다.`);
  if (before && !(order < before.order)) errors.push(`${card.id}: 연도 ${year}가 ${before.title}(${before.order}) 이전이 아니다.`);
  return order;
}

function fromV2(raw) {
  const errors = [];
  const all = raw.cards.filter((c) => c && typeof c === 'object');
  const nation = all[0]?.nation;
  const anchorsRaw = all.filter((c) => c.kind === 'anchor').sort((a, b) => a.order - b.order);
  const anchors = anchorsRaw.map((a) => ({
    id: a.id, title: a.title, order: a.reign?.start, year_label: yearText(a.reign?.start),
    reign: a.title, reign_range: a.reign ? rangeText(a.reign.start, a.reign.end) : null,
    explanation: a.summary ?? '', verified: a.verification?.verified === true,
  }));
  const byId = new Map(anchors.map((a) => [a.id, a]));
  const cards = all.filter((c) => c.kind === 'source' && c.disputed !== true).map((c) => {
    const after = byId.get(c.answer?.after) ?? null;
    const before = c.answer?.before ? byId.get(c.answer.before) ?? null : null;
    if (!after) errors.push(`${c.id}: answer.after가 기준 카드가 아니다: ${c.answer?.after}`);
    if (c.answer?.before && !before) errors.push(`${c.id}: answer.before가 기준 카드가 아니다: ${c.answer.before}`);
    const ref = c.source_ref ?? {};
    return {
      id: c.id, title: c.title, order: orderInSlot(c, c.year, after, before, errors),
      year_label: `${yearText(c.year)}${c.reign_label ? `(${c.reign_label})` : ''}`, reign: c.reign_label ?? null,
      source_text: c.source_text, source: { name: [ref.work, ref.section, ref.volume, ref.entry].filter(Boolean).join(' '), ref: '' },
      clues: (c.clues ?? []).map((cl) => ({ level: cl.level, kind: cl.kind, text: cl.text, refs: (cl.relations ?? []).map((r) => r.ref) })),
      explanation: c.explanation ?? '',
      exam_note: (c.exam_tags ?? []).map((t) => TAG_LABEL[t] ?? t).join(' · '),
      verified: c.verification?.verified === true,
    };
  });
  return { deck: { schema: 'v2', nation, nation_label: NATION_LABEL[nation] ?? nation, anchors, cards }, errors };
}

function fromDraft(raw) {
  const errors = [];
  const anchors = (raw.anchors ?? []).map((a) => ({
    id: a.id, title: a.title, order: a.year, year_label: a.year_label,
    reign: a.reign ?? a.title.replace(/\s*즉위$/, ''), reign_range: a.reign_range ?? null,
    explanation: a.explanation ?? '', verified: a.verified === true,
  }));
  const byId = new Map(anchors.map((a) => [a.id, a]));
  const cards = (raw.cards ?? []).map((c) => {
    const after = c.timeline?.after ? byId.get(c.timeline.after) ?? null : null;
    const before = c.timeline?.before ? byId.get(c.timeline.before) ?? null : null;
    if (c.timeline?.after && !after) errors.push(`${c.id}: timeline.after가 기준 카드가 아니다: ${c.timeline.after}`);
    if (c.timeline?.before && !before) errors.push(`${c.id}: timeline.before가 기준 카드가 아니다: ${c.timeline.before}`);
    return {
      id: c.id, title: c.title, order: orderInSlot(c, c.year, after, before, errors), year_label: c.year_label, reign: c.reign ?? null,
      source_text: c.front, source: { name: c.source_ref ?? '', ref: '' },
      clues: (c.clues ?? []).map((cl) => ({ level: cl.level, kind: cl.kind, text: cl.text, refs: cl.refs ?? [] })),
      explanation: c.explanation ?? '', exam_note: c.exam_note ?? '', verified: c.verified === true,
    };
  });
  return { deck: { schema: 'v2-draft-content', nation: raw.nation, nation_label: NATION_LABEL[raw.nation] ?? raw.nation, anchors, cards }, errors };
}

/** @returns {{format: string, deck: object|null, errors: string[]}} */
export function normalizeDeck(raw) {
  const format = formatOf(raw);
  if (format === 'm1-draft') return { format, deck: raw, errors: [] };
  if (format === 'v2') return { format, ...fromV2(raw) };
  if (format === 'v2-draft-content') return { format, ...fromDraft(raw) };
  return { format, deck: null, errors: ['알 수 없는 데이터 형식'] };
}

/** 후보 경로를 차례로 시도해 처음 읽히는 파일을 쓴다. */
export async function loadRaw(urls, fetchFn = (u) => fetch(u, { cache: 'no-store' })) {
  const tried = [];
  for (const url of urls) {
    try {
      const res = await fetchFn(url);
      if (!res.ok) { tried.push(`${url} (HTTP ${res.status})`); continue; }
      return { url, raw: await res.json() };
    } catch (e) { tried.push(`${url} (${e.message})`); }
  }
  throw new Error(`데이터를 읽지 못했다: ${tried.join(', ')}`);
}
