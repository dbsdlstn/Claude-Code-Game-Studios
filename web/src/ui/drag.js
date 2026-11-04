/**
 * 포인터(마우스·펜·터치) 드래그. 6px 넘게 움직이면 드래그, 아니면 클릭(선택 토글)으로 본다.
 * 놓을 칸은 `.cell[data-nation][data-era]`이고, 손 아래 칸에 `.over`를 붙인다.
 */
import { el } from './dom.js';

/**
 * @param {HTMLElement} card 끌 요소
 * @param {{board: HTMLElement, ghost: HTMLElement, label: (cell: HTMLElement) => string,
 *          canDrag: () => boolean, onDrop: (nation: string, era: string) => void,
 *          onClick: () => void, onCancel?: () => void}} opts
 */
export function makeDraggable(card, opts) {
  const { board, ghost } = opts;
  let start = null;
  let dragging = false;
  let overCell = null;

  const cellAt = (x, y) => {
    const c = document.elementFromPoint(x, y)?.closest?.('.cell[data-nation]') ?? null;
    return c && board.contains(c) ? c : null;
  };
  const setOver = (c) => {
    if (overCell === c) return;
    overCell?.classList.remove('over');
    overCell = c;
    overCell?.classList.add('over');
    const t = ghost.querySelector('.ghost-target');
    if (t) t.textContent = c ? `→ ${opts.label(c)}` : '';
  };

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !opts.canDrag()) return;
    if (e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging = false;
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
      dragging = true;
      card.classList.add('dragging');
      ghost.replaceChildren(el('span', {}, '？ 이름 숨김 카드'), el('span', { class: 'ghost-target' }));
      ghost.hidden = false;
      board.classList.add('armed', 'dragging');
    }
    if (dragging) {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
      setOver(cellAt(e.clientX, e.clientY));
    }
  });
  const end = (e, cancelled) => {
    if (!start || e.pointerId !== start.id) return;
    const wasDragging = dragging;
    const target = cancelled || !wasDragging ? null : cellAt(e.clientX, e.clientY);
    start = null;
    dragging = false;
    card.classList.remove('dragging');
    ghost.hidden = true;
    setOver(null);
    board.classList.remove('dragging');
    if (wasDragging) {
      if (target) opts.onDrop(target.dataset.nation, target.dataset.era);
      else opts.onCancel?.();
    } else if (!cancelled) {
      opts.onClick();
    }
  };
  card.addEventListener('pointerup', (e) => end(e, false));
  card.addEventListener('pointercancel', (e) => end(e, true));
}
