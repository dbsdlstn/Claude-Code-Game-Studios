/** 관계 단서의 [기준 카드] 참조 → 보드의 기준 카드 칸 강조. */

/**
 * 기준 카드 칸 강조(D37). 단서의 [기준 카드]를 누르거나 포커스하면 그 칸을 강조한다.
 * 포커스가 있는 동안 유지하고, 클릭만 했으면 2.5초 뒤 지운다.
 * @param {HTMLElement} cardEl 단서가 들어 있는 카드
 * @param {() => HTMLElement} boardOf 강조할 보드
 */
export function wireRefHighlight(cardEl, boardOf) {
  let timer = null;
  const clear = () => boardOf().querySelectorAll('.ref-target').forEach((c) => c.classList.remove('ref-target'));
  const show = (btn, sticky) => {
    clear();
    clearTimeout(timer);
    const chip = boardOf().querySelector(`.chip-anchor[data-id="${CSS.escape(btn.dataset.refId)}"]`);
    chip?.closest('.cell')?.classList.add('ref-target');
    if (!sticky) timer = setTimeout(clear, 2500);
  };
  cardEl.addEventListener('focusin', (e) => { const b = e.target.closest?.('.ref-link'); if (b) show(b, true); });
  cardEl.addEventListener('focusout', (e) => { if (e.target.closest?.('.ref-link')) { clear(); } });
  cardEl.addEventListener('click', (e) => {
    const b = e.target.closest?.('.ref-link');
    if (!b) return;
    e.stopPropagation();
    show(b, document.activeElement === b);
  });
  cardEl.addEventListener('keydown', (e) => { if (e.target.closest?.('.ref-link')) e.stopPropagation(); });
}
