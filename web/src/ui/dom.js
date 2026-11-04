/** DOM 도우미. 텍스트는 전부 텍스트 노드로 넣는다(카드 데이터를 HTML로 해석하지 않는다). */

export const $ = (id) => document.getElementById(id);

/** 요소 생성. 문자열 자식은 텍스트 노드가 되고 null·false는 버린다. `on*` 속성은 이벤트 리스너. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : String(c));
  return node;
}

/**
 * "[제목]" 표기를 강조한다. resolveRef(title)이 기준 카드 {id, label}을 돌려주면 버튼으로 만들어
 * 누르거나 포커스하면 그 기준 카드 칸을 강조할 수 있게 한다(D37). 못 찾으면 글자 강조만.
 * @param {string} text
 * @param {(title: string) => ({id: string, label: string} | null)} [resolveRef]
 */
export function clueText(text, resolveRef = () => null) {
  return text.split(/(\[[^\]]+\])/g).filter(Boolean).map((part) => {
    const m = /^\[(.+)\]$/.exec(part);
    if (!m) return part;
    const ref = resolveRef(m[1]);
    if (!ref) return el('span', { class: 'ref' }, part);
    return el('button', {
      type: 'button', class: 'ref ref-link', dataset: { refId: ref.id },
      'aria-label': `${part} 기준 카드 위치 보기: ${ref.label}`,
    }, part);
  });
}

/**
 * 공개 후 일러스트(4:3). image가 있으면 그림, 없거나 못 읽으면 유형별 대체 문양(D37, 아트 바이블 §7.1).
 * @param {object} card
 * @param {string} assetRoot 저장소에서는 '../', 배포본에서는 ''
 * @param {string} [extraClass]
 */
export function illustration(card, assetRoot, extraClass = '') {
  const placeholder = `${assetRoot}assets/art/placeholders/placeholder-${card.type}.svg`;
  const hasImage = typeof card.image === 'string' && card.image !== '';
  const img = el('img', {
    src: hasImage ? `${assetRoot}${card.image}` : placeholder,
    alt: hasImage ? card.title : '',
    loading: 'lazy', decoding: 'async',
  });
  const box = el('figure', { class: `illust${hasImage ? '' : ' illust-placeholder'} ${extraClass}`.trim(), dataset: { kind: hasImage ? 'image' : 'placeholder' } },
    img, hasImage ? null : el('figcaption', {}, '그림 준비 중'));
  if (hasImage) {
    img.addEventListener('error', () => {
      img.src = placeholder;
      img.alt = '';
      box.dataset.kind = 'placeholder';
      box.classList.add('illust-placeholder');
      box.append(el('figcaption', {}, '그림 준비 중'));
    }, { once: true });
  }
  return box;
}

/** 숨김 상태 일러스트: 먹 번짐과 큰 "?". 유형·나라·시기 정보를 담지 않는다(D37). */
export function hiddenIllustration() {
  return el('div', { class: 'illust illust-hidden', 'aria-hidden': 'true' }, el('span', {}, '?'));
}

/** 나라 인장(행 머리글). 색만으로 구분하지 않도록 한 글자를 넣는다(아트 바이블 §3, §4.2). */
export const NATION_SEAL = { goguryeo: '고', baekje: '백', silla: '신', gaya: '가' };

export const TYPE_LABEL = { event: '사건', artifact: '유물', person: '인물', myth: '전승' };
export const LEVEL_LABEL = ['', '1단계 · 장면', '2단계 · 관계', '3단계 · 직접 힌트'];

/** 물방울 모양 먹물 아이콘 n개. lostIndex 위치는 방금 잃은 먹물. */
export function inkDrops(ink, startInk, lostIndex = -1) {
  const out = [];
  for (let i = 0; i < startInk; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 20');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'drop' + (i < ink ? '' : ' empty') + (i === lostIndex ? ' drop-lost' : ''));
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M8 1 C8 1 2 9 2 13 a6 6 0 0 0 12 0 C14 9 8 1 8 1 Z');
    svg.append(p);
    out.push(svg);
  }
  return out;
}
