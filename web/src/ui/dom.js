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

/** "[제목]" 표기를 강조 span으로 바꾼다. */
export function clueText(text) {
  return text.split(/(\[[^\]]+\])/g).filter(Boolean)
    .map((part) => (/^\[.+\]$/.test(part) ? el('span', { class: 'ref' }, part) : part));
}

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
