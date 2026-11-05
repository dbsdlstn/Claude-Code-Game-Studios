// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D110)
// 대비 점검 도우미: 보이는 글자 요소마다 글자색과 실제 바탕색(불투명해질 때까지 위로)의 WCAG 대비를 잰다.
// 큰 글자(24px 이상, 또는 18.66px 이상 굵게)는 3:1, 나머지는 4.5:1. 비활성 요소·장식(aria-hidden)은 뺀다.
export async function contrastIssues(page, root = 'body') {
  return page.evaluate((rootSel) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
    const bgOf = (el) => {
      const stack = [];
      for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } }
      let bg = { r: 239, g: 230, b: 210, a: 1 }; // 한지(맨 아래 바탕)
      for (const c of stack.reverse()) bg = blend(c, bg);
      return bg;
    };
    const out = [];
    const root = document.querySelector(rootSel);
    for (const el of root.querySelectorAll('*')) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('[aria-hidden="true"], [hidden], [disabled]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fg = parse(cs.color); if (!fg) continue;
      const bg = bgOf(el);
      const col = fg.a < 1 ? blend(fg, bg) : fg;
      const L1 = lum(col); const L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if (ratio + 1e-6 < need) out.push({ text: el.textContent.trim().slice(0, 30), sel: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''}`, ratio: +ratio.toFixed(2), need, color: cs.color });
    }
    return out;
  }, root);
}
