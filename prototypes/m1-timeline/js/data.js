// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * 데이터 로더. 형식 차이는 이 파일 한 곳에서 흡수해 화면과 규칙에는 같은 모양({nation, anchors, cards})을 넘긴다.
 * 재위 기간 표(reigns): { [기준 카드 id]: { king, range } } — 연표 줄 표시용, 판정에 쓰지 않는다.
 * 지원 형식:
 *   - 'm1-draft'           : data/sample.json(이 세션의 임시 샘플)
 *   - 'v2-draft-content'   : assets/data/cards/v2-draft/goguryeo-m1.json(콘텐츠 세션, D58). `_format`으로 구분
 * 스키마 v2가 확정되면 여기에 변환을 하나 더하거나 바꾼다(D59).
 */

const NATION_LABEL = { goguryeo: '고구려', baekje: '백제', silla: '신라', gaya: '가야' };

/** 형식 이름. */
export function formatOf(raw) {
  if (typeof raw?._format === 'string' && raw._format.startsWith('v2-draft-content')) return 'v2-draft-content';
  if (raw?.schema === 'm1-draft') return 'm1-draft';
  return 'unknown';
}

/**
 * 원본 데이터를 화면·규칙용 형식으로 바꾼다.
 * v2-draft-content: year → order. 같은 해에 기준 카드가 있으면 `timeline.before/after`로 앞뒤를 정해 ±0.5를 준다
 * (예: 고국원왕 전사 371은 소수림왕 즉위 371보다 앞).
 * @returns {{format: string, deck: object, errors: string[]}}
 */
export function normalizeDeck(raw, reigns = {}) {
  const format = formatOf(raw);
  if (format === 'm1-draft') return { format, deck: raw, errors: [] };
  if (format !== 'v2-draft-content') return { format, deck: null, errors: ['알 수 없는 데이터 형식'] };
  const errors = [];
  // 기준 카드는 왕(즉위) 단위(D61). 재위 기간은 데이터에 있으면 그것, 없으면 표시용 표(data/reigns.json).
  const anchors = (raw.anchors ?? []).map((a) => ({
    id: a.id, title: a.title, order: a.year, year_label: a.year_label,
    reign: a.reign ?? reigns[a.id]?.king ?? a.title.replace(/\s*즉위$/, ''),
    reign_range: a.reign_range ?? reigns[a.id]?.range ?? null,
    explanation: a.explanation ?? '', source_ref: a.source_ref ?? '', verified: a.verified === true,
  }));
  const anchorById = new Map(anchors.map((a) => [a.id, a]));
  const cards = (raw.cards ?? []).map((c) => {
    let order = c.year;
    const after = c.timeline?.after ? anchorById.get(c.timeline.after) : null;
    const before = c.timeline?.before ? anchorById.get(c.timeline.before) : null;
    if (c.timeline?.after && !after) errors.push(`${c.id}: timeline.after가 기준 카드가 아니다: ${c.timeline.after}`);
    if (c.timeline?.before && !before) errors.push(`${c.id}: timeline.before가 기준 카드가 아니다: ${c.timeline.before}`);
    if (before && c.year === before.order) order = c.year - 0.5;
    else if (after && c.year === after.order) order = c.year + 0.5;
    if (after && !(after.order < order)) errors.push(`${c.id}: 연도 ${c.year}가 ${after.title}(${after.order})보다 나중이 아니다.`);
    if (before && !(order < before.order)) errors.push(`${c.id}: 연도 ${c.year}가 ${before.title}(${before.order})보다 먼저가 아니다.`);
    return {
      id: c.id, title: c.title, order, year_label: c.year_label, reign: c.reign ?? null,
      source_text: c.front, source: { name: c.source_ref ?? '', ref: '' },
      clues: (c.clues ?? []).map((cl) => ({ level: cl.level, kind: cl.kind, text: cl.text, refs: cl.refs ?? [] })),
      explanation: c.explanation ?? '', exam_note: c.exam_note ?? '', source_note: c.source_note ?? '',
      verified: c.verified === true,
    };
  });
  return {
    format,
    deck: { schema: format, nation: raw.nation, nation_label: NATION_LABEL[raw.nation] ?? raw.nation, anchors, cards },
    errors,
  };
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
