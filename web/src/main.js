/**
 * 화면 연결. 규칙은 rules.js, 저장은 storage.js, 로딩은 data.js에 있고 여기서는 DOM만 다룬다.
 * 텍스트는 전부 textContent로 넣는다(카드 데이터를 HTML로 해석하지 않는다).
 */
import { CONFIG } from './config.js';
import { loadCards, resolveDataUrls } from './data.js';
import { createStore } from './storage.js';
import {
  NATIONS, ERAS, nationLabel, eraLabel, validateCards, anchorCards, playableCards, releaseFilter,
  createRound, roundStatus, currentCardId, revealNextClue, placeCard, boardCells, roundStats,
  recordInCollection, serializeRound, restoreRound, restoreCollection, isDogamComplete, dogamProgress,
} from './rules.js';

const TYPE_LABEL = { event: '사건', artifact: '유물', person: '인물', myth: '전승' };
const LEVEL_LABEL = ['', '1단계 · 장면', '2단계 · 관계', '3단계 · 직접 힌트'];
const $ = (id) => document.getElementById(id);

/** 작은 DOM 생성 도우미. 문자열 자식은 텍스트 노드가 되고 null·false는 버린다. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : String(c));
  return node;
}

/** "[제목]" 표기를 강조 span으로 바꾼다. */
function clueText(text) {
  return text.split(/(\[[^\]]+\])/g).filter(Boolean)
    .map((part) => (/^\[.+\]$/.test(part) ? el('span', { class: 'ref' }, part) : part));
}

const app = {
  store: createStore(CONFIG.storageKey),
  cards: [], cardsById: new Map(), anchors: [], playable: [],
  round: null, collection: Object.freeze({}),
  selected: false, lastResult: null, lostInk: false, dogamActive: null,
  seedParam: null, focusCell: null,
};

function newSeed() {
  if (app.seedParam !== null) return (app.seedParam + (app.round ? app.round.seed + 1 : 0)) >>> 0;
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}

function persist() {
  app.store.save(serializeRound(app.round), app.collection);
}

function newRoundState() {
  return createRound(app.playable, { seed: newSeed(), startInk: CONFIG.startInk, collection: app.collection });
}

/* ------------------------------------------------------------------ 렌더 */

function renderTop() {
  const ink = $('ink');
  const { ink: n, startInk } = app.round;
  ink.replaceChildren(el('span', { class: 'ink-label' }, '먹물'));
  for (let i = 0; i < startInk; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 20');
    svg.setAttribute('aria-hidden', 'true');
    const lost = app.lostInk && i === n;
    svg.setAttribute('class', 'drop' + (i < n ? '' : ' empty') + (lost ? ' drop-lost' : ''));
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M8 1 C8 1 2 9 2 13 a6 6 0 0 0 12 0 C14 9 8 1 8 1 Z');
    svg.append(p);
    ink.append(svg);
  }
  ink.dataset.ink = String(n);
  ink.setAttribute('aria-label', `먹물 ${Math.max(n, 0)}/${startInk}`);
  const total = app.round.order.length;
  const done = app.round.index;
  $('progress').textContent = roundStatus(app.round) === 'playing' ? `카드 ${done + 1} / ${total}` : `카드 ${done} / ${total} 처리`;
  $('progress').dataset.index = String(done);
  const dp = dogamProgress(app.playable, app.collection);
  $('dogam-progress').textContent = `도감 ${dp.collected} / ${dp.total}`;
  $('dogam-progress').dataset.collected = String(dp.collected);
}

function renderCard() {
  const box = $('card');
  const id = currentCardId(app.round);
  if (!id) {
    box.className = 'card empty';
    box.replaceChildren(el('p', {}, roundStatus(app.round) === 'cleared' ? '이번 라운드의 카드를 모두 놓았습니다.' : '먹물이 바닥났습니다.'));
    box.removeAttribute('data-card-id');
    box.setAttribute('aria-label', '놓을 카드 없음');
    return;
  }
  box.className = 'card' + (app.selected ? ' selected' : '') + (app.lastResult ? ' card-enter' : '');
  const card = app.cardsById.get(id);
  const shown = card.clues.slice(0, app.round.shown);
  const more = el('button', {
    id: 'more-clue', type: 'button', class: 'btn',
    disabled: app.round.shown >= card.clues.length,
    onclick: (e) => { e.stopPropagation(); onMoreClue(); },
    onpointerdown: (e) => e.stopPropagation(),
    onkeydown: (e) => e.stopPropagation(),
  }, '단서 더 보기');
  box.dataset.cardId = id; // E2E가 정답을 데이터에서 찾을 때 쓴다(화면에는 보이지 않음).
  box.setAttribute('aria-label', `이름이 숨겨진 ${TYPE_LABEL[card.type] ?? ''} 카드. Enter로 고른 뒤 방향키로 칸을 고르고 Enter로 놓습니다.`);
  box.replaceChildren(
    el('div', { class: 'card-head' },
      el('span', { class: 'card-title' }, '？ 이름 숨김'),
      el('span', { class: 'card-type' }, TYPE_LABEL[card.type] ?? card.type)),
    el('ol', { class: 'clues', id: 'clues' },
      shown.map((cl, i) => el('li', { class: 'clue' + (i === app.round.shown - 1 && i > 0 ? ' clue-new' : ''), dataset: { kind: cl.kind, level: String(cl.level) } },
        el('span', { class: 'clue-level' }, LEVEL_LABEL[cl.level] ?? ''),
        clueText(cl.text)))),
    el('div', { class: 'card-foot' },
      el('span', { class: 'clue-count' }, `단서 ${app.round.shown} / ${card.clues.length}`),
      more),
  );
}

function renderBoard() {
  const board = $('board');
  const cells = boardCells(app.round, app.anchors);
  const r = app.lastResult;
  const nodes = [el('div', { class: 'corner' })];
  for (const e of ERAS) {
    nodes.push(el('div', { class: 'era-head', dataset: { era: e.id } },
      el('span', { class: 'era-name' }, e.label), el('span', { class: 'era-def' }, e.definition)));
  }
  for (const n of NATIONS) {
    nodes.push(el('div', { class: 'nation-head' }, n.label));
    for (const e of ERAS) {
      const c = cells[`${n.id}:${e.id}`];
      let flash = '';
      if (r && r.answer.nation === n.id && r.answer.era === e.id) flash = ' flash-ok';
      if (r && !r.correct && r.placed.nation === n.id && r.placed.era === e.id) flash = ' flash-bad';
      nodes.push(el('button', {
        type: 'button', class: 'cell' + flash,
        dataset: { nation: n.id, era: e.id },
        'aria-label': `${n.label} ${e.label} 칸, 카드 ${c.anchors.length + c.placed.length}장`,
        onclick: () => onCellClick(n.id, e.id),
        onkeydown: (ev) => onCellKey(ev, n.id, e.id),
      },
      c.anchors.map((id) => el('span', { class: 'chip chip-anchor', dataset: { id } }, app.cardsById.get(id).title)),
      c.placed.map((p) => el('span', {
        class: 'chip ' + (p.correct ? 'chip-ok' : 'chip-bad') + (r && r.id === p.id ? ' chip-new' : ''),
        dataset: { id: p.id },
      }, el('span', { class: 'sr-only' }, p.correct ? '정답: ' : '오답 공개: '), app.cardsById.get(p.id).title))));
    }
  }
  board.replaceChildren(...nodes);
  board.classList.toggle('armed', app.selected);
}

function renderFeedback() {
  const box = $('feedback');
  const r = app.lastResult;
  if (!r) { box.replaceChildren(); return; }
  const card = app.cardsById.get(r.id);
  const where = (a) => `${nationLabel(a.nation)} ${eraLabel(a.era)}`;
  box.replaceChildren(el('div', { class: 'fb fb-enter ' + (r.correct ? 'fb-ok' : 'fb-bad'), id: 'fb', dataset: { result: r.correct ? 'correct' : 'wrong' } },
    el('div', { class: 'fb-head' },
      el('span', { class: 'fb-mark', 'aria-hidden': 'true' }, r.correct ? '○' : '✕'),
      r.correct ? '정답 · 도감에 수집' : '오답 · 먹물 1 소모'),
    el('div', { class: 'fb-title' }, card.title),
    el('div', { class: 'fb-meta' },
      r.correct ? where(r.answer) : el('span', {}, '놓은 칸 ', el('s', {}, where(r.placed)), ' → 정답 칸 ', el('b', {}, where(r.answer))),
      card.date_label ? ` · ${card.date_label}` : ''),
    el('p', { class: 'fb-exp' }, card.explanation)));
}

function render() {
  renderTop();
  renderCard();
  renderBoard();
  renderFeedback();
}

/* ------------------------------------------------------------------ 동작 */

function onMoreClue() {
  app.round = revealNextClue(app.round);
  persist();
  renderCard();
  $('card').classList.remove('card-enter');
  $('more-clue')?.focus();
}

function setSelected(v, { focusBoard = false } = {}) {
  app.selected = v && !!currentCardId(app.round);
  $('card').classList.toggle('selected', app.selected);
  $('board').classList.toggle('armed', app.selected);
  $('hand-help').textContent = app.selected
    ? '칸을 누르거나 방향키로 칸을 고르고 Enter로 놓으세요. Esc로 취소.'
    : '카드를 끌어 칸에 놓거나, 카드를 눌러 고른 뒤 칸을 누르세요.';
  if (app.selected && focusBoard) focusCellAt(app.focusCell ?? { nation: NATIONS[0].id, era: ERAS[0].id });
}

function focusCellAt({ nation, era }) {
  app.focusCell = { nation, era };
  document.querySelector(`#board .cell[data-nation="${nation}"][data-era="${era}"]`)?.focus();
}

function onCellClick(nation, era) {
  if (!app.selected) {
    if (currentCardId(app.round)) $('hand-help').textContent = '먼저 카드를 눌러 고른 뒤 칸을 누르세요. 끌어서 놓아도 됩니다.';
    return;
  }
  place(nation, era);
}

/** 보드 안 방향키 이동. Enter/Space는 버튼 기본 동작(클릭)으로 놓는다. */
function onCellKey(ev, nation, era) {
  const ni = NATIONS.findIndex((n) => n.id === nation);
  const ei = ERAS.findIndex((e) => e.id === era);
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[ev.key]) {
    ev.preventDefault();
    const [dn, de] = moves[ev.key];
    const n2 = Math.min(Math.max(ni + dn, 0), NATIONS.length - 1);
    const e2 = Math.min(Math.max(ei + de, 0), ERAS.length - 1);
    focusCellAt({ nation: NATIONS[n2].id, era: ERAS[e2].id });
  } else if (ev.key === 'Escape' && app.selected) {
    ev.stopPropagation();
    setSelected(false);
    $('card').focus();
  }
}

function place(nation, era) {
  const before = isDogamComplete(app.playable, app.collection);
  const { state, result } = placeCard(app.round, app.cardsById, nation, era);
  if (!result) return;
  app.round = state;
  app.collection = recordInCollection(app.collection, result);
  app.lastResult = result;
  app.lostInk = !result.correct;
  app.selected = false;
  app.focusCell = { nation, era };
  persist();
  render();
  setSelected(false);
  app.lostInk = false;
  const status = roundStatus(app.round);
  const completedNow = !before && isDogamComplete(app.playable, app.collection);
  if (completedNow) showCompleteModal(status);
  else if (status !== 'playing') showEndModal(status);
  else if (document.activeElement?.classList.contains('cell') || document.activeElement === document.body) $('card').focus();
}

function startNewRound() {
  app.round = newRoundState();
  app.lastResult = null;
  app.selected = false;
  persist();
  closeModal();
  render();
  $('card').focus();
}

/* ------------------------------------------------------------------ 드래그 */

function setupDrag() {
  const card = $('card');
  const ghost = $('drag-ghost');
  let start = null;
  let dragging = false;
  let overCell = null;

  const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('#board .cell') ?? null;
  const setOver = (c) => {
    if (overCell === c) return;
    overCell?.classList.remove('over');
    overCell = c;
    overCell?.classList.add('over');
    ghost.dataset.target = c ? `${nationLabel(c.dataset.nation)} ${eraLabel(c.dataset.era)}` : '';
    ghost.querySelector('.ghost-target').textContent = c ? `→ ${ghost.dataset.target}` : '';
  };

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !currentCardId(app.round)) return;
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
      $('board').classList.add('armed', 'dragging');
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
    $('board').classList.remove('dragging');
    if (wasDragging) {
      if (target) place(target.dataset.nation, target.dataset.era);
      else setSelected(app.selected);
    } else if (!cancelled) {
      setSelected(!app.selected);
    }
  };
  card.addEventListener('pointerup', (e) => end(e, false));
  card.addEventListener('pointercancel', (e) => end(e, true));
  card.addEventListener('keydown', (e) => {
    if (e.target !== card) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(!app.selected, { focusBoard: true }); }
    if (e.key === 'Escape') setSelected(false);
  });
}

/* ------------------------------------------------------------------ 모달 */

function openModal(title, body, actions, kind) {
  $('modal-title').textContent = title;
  $('modal-body').replaceChildren(...body);
  $('modal-actions').replaceChildren(...actions);
  $('modal').dataset.kind = kind;
  $('modal').hidden = false;
  actions[actions.length - 1]?.focus();
}

function closeModal() {
  $('modal').hidden = true;
  delete $('modal').dataset.kind;
}

function statsList() {
  const s = roundStats(app.round);
  const dp = dogamProgress(app.playable, app.collection);
  return el('dl', { class: 'stats' },
    el('dt', {}, '정답'), el('dd', {}, `${s.right} / ${s.total}장 (${s.rate}%)`),
    el('dt', {}, '남은 먹물'), el('dd', {}, `${Math.max(s.ink, 0)} / ${app.round.startInk}`),
    el('dt', {}, '단서 더 보기'), el('dd', {}, `${s.hints}회 (${s.cardsWithHints}장에서 사용)`),
    el('dt', {}, '놓지 못한 카드'), el('dd', {}, `${s.deck - s.total}장`),
    el('dt', {}, '도감'), el('dd', {}, `${dp.collected} / ${dp.total}장 수집`));
}

function dogamButton() {
  return el('button', { type: 'button', class: 'btn', id: 'modal-dogam', onclick: () => { closeModal(); openDogam(); } }, '도감 보기');
}

function showEndModal(status) {
  if (status === 'cleared') {
    openModal('라운드 클리어', [el('p', {}, '먹물이 남은 채 이번 라운드의 12장을 모두 놓았습니다. 새 라운드는 아직 모으지 않은 카드부터 나옵니다.'), statsList()],
      [dogamButton(), el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-retry', onclick: startNewRound }, '새 라운드')], 'cleared');
  } else {
    openModal('먹물이 바닥났습니다', [el('p', {}, '이번 라운드는 실패입니다. 지금까지 수집한 카드는 도감에 남습니다.'), statsList()],
      [dogamButton(), el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-retry', onclick: startNewRound }, '재도전')], 'failed');
  }
}

function showCompleteModal(status) {
  const dp = dogamProgress(app.playable, app.collection);
  const next = status === 'playing'
    ? el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-continue', onclick: () => { closeModal(); $('card').focus(); } }, '라운드 계속')
    : el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-retry', onclick: startNewRound }, '새 라운드');
  openModal('도감 완성', [
    el('p', { class: 'complete-seal', 'aria-hidden': 'true' }, '完'),
    el('p', {}, `삼국시대 판정 카드 ${dp.total}장을 모두 수집했습니다. 도감에서 해설을 다시 읽을 수 있습니다.`),
    statsList(),
  ], [dogamButton(), next], 'complete');
}

function confirmNewRound() {
  if (roundStatus(app.round) !== 'playing' || app.round.index === 0) { startNewRound(); return; }
  openModal('새 라운드를 시작할까요?', [el('p', {}, '지금 라운드의 보드와 먹물이 초기화됩니다. 도감 수집 기록은 남습니다.')],
    [el('button', { type: 'button', class: 'btn', onclick: closeModal }, '취소'),
      el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-confirm', onclick: startNewRound }, '새 라운드')], 'confirm');
}

/* ------------------------------------------------------------------ 도감 */

function dogamState(card) {
  if (card.anchor) return 'anchor';
  return app.collection[card.id] ?? 'unknown';
}

function openDogam() {
  renderDogam();
  $('dogam').hidden = false;
  $('btn-dogam-close').focus();
}

function closeDogam() {
  $('dogam').hidden = true;
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
  else $('btn-dogam').focus();
}

function renderDogam() {
  const grid = $('dogam-grid');
  const nodes = [el('div', { class: 'corner' })];
  for (const e of ERAS) {
    nodes.push(el('div', { class: 'era-head' }, el('span', { class: 'era-name' }, e.label), el('span', { class: 'era-def' }, e.definition)));
  }
  for (const n of NATIONS) {
    nodes.push(el('div', { class: 'nation-head' }, n.label));
    for (const e of ERAS) {
      const inCell = app.cards.filter((c) => c.answer.nation === n.id && c.answer.era === e.id);
      const judged = inCell.filter((c) => !c.anchor && !c.disputed);
      const got = judged.filter((c) => app.collection[c.id] === 'collected').length;
      const order = (c) => (c.anchor ? 0 : c.disputed ? 2 : 1);
      nodes.push(el('div', { class: 'cell dogam-cell' + (judged.length && got === judged.length ? ' cell-done' : ''), dataset: { nation: n.id, era: e.id } },
        el('span', { class: 'cell-count' }, `${got} / ${judged.length}`),
        inCell.slice().sort((a, b) => order(a) - order(b)).map((c) => {
          const st = dogamState(c);
          const known = st !== 'unknown' || c.disputed;
          return el('button', {
            type: 'button',
            class: `entry ${st}${c.disputed ? ' disputed' : ''}${app.dogamActive === c.id ? ' active' : ''}`,
            dataset: { id: c.id, state: st },
            'aria-label': known ? `${c.title} (${({ anchor: '기준 카드', collected: '수집', revealed: '오답으로 공개', unknown: '판정 제외' })[st]})` : '미수집 카드',
            onclick: () => { app.dogamActive = c.id; renderDogam(); document.querySelector(`#dogam .entry[data-id="${CSS.escape(c.id)}"]`)?.focus(); },
          }, known ? c.title : '？？？');
        })));
    }
  }
  grid.replaceChildren(...nodes);

  const dp = dogamProgress(app.playable, app.collection);
  const revealed = app.playable.filter((c) => app.collection[c.id] === 'revealed').length;
  $('dogam-count').textContent = `수집 ${dp.collected} / ${dp.total}장 · 오답으로 공개 ${revealed}장`;
  $('dogam-count').dataset.collected = String(dp.collected);
  renderDogamDetail();
}

function renderDogamDetail() {
  const box = $('dogam-detail');
  const card = app.dogamActive ? app.cardsById.get(app.dogamActive) : null;
  if (!card) {
    box.replaceChildren(el('p', { class: 'meta' }, '칸 안의 카드를 누르면 해설과 출처를 볼 수 있습니다.'),
      el('ul', { class: 'legend' },
        el('li', {}, el('span', { class: 'entry collected' }, '이름'), ' 정답으로 수집'),
        el('li', {}, el('span', { class: 'entry revealed' }, '이름'), ' 오답으로 공개(수집 아님)'),
        el('li', {}, el('span', { class: 'entry unknown' }, '？？？'), ' 아직 만나지 못한 카드'),
        el('li', {}, el('span', { class: 'entry disputed' }, '이름'), ' 견해가 나뉨 · 판정 제외'),
        el('li', {}, el('span', { class: 'entry anchor' }, '이름'), ' 기준 카드')));
    return;
  }
  const st = dogamState(card);
  const where = `${nationLabel(card.answer.nation)} · ${eraLabel(card.answer.era)}${card.date_label ? ' · ' + card.date_label : ''}`;
  if (st === 'unknown' && !card.disputed) {
    box.replaceChildren(el('h3', { id: 'dogam-detail-title' }, '？？？'), el('p', { class: 'meta' }, where),
      el('p', {}, '아직 수집하지 않은 카드입니다. 라운드에서 정답으로 놓으면 해설이 열립니다.'));
    return;
  }
  const badges = [];
  if (st === 'collected') badges.push(el('span', { class: 'badge badge-ok' }, '수집'));
  if (st === 'revealed') badges.push(el('span', { class: 'badge badge-bad' }, '오답으로 공개'));
  if (st === 'anchor') badges.push(el('span', { class: 'badge' }, '기준 카드'));
  if (card.disputed) badges.push(el('span', { class: 'badge badge-warn' }, '견해가 나뉨 · 판정 제외'));
  if (!card.verified) badges.push(el('span', { class: 'badge badge-warn' }, '사실 확인 전'));
  const src = card.source ?? {};
  const url = typeof src.url === 'string' && /^https?:\/\//.test(src.url) ? src.url : null;
  box.replaceChildren(...[
    el('h3', { id: 'dogam-detail-title' }, card.title),
    el('p', { class: 'meta' }, where, ' · ', TYPE_LABEL[card.type] ?? card.type),
    el('div', { class: 'badges' }, badges),
    card.explanation ? el('p', { class: 'exp' }, card.explanation) : null,
    card.disputed && card.disputed_note ? el('p', { class: 'note' }, el('b', {}, '견해 '), card.disputed_note) : null,
    el('div', { class: 'src', id: 'dogam-source' },
      el('b', {}, '출처 '), src.name || '미상',
      src.note ? el('div', { class: 'src-note' }, src.note) : null,
      url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, '원문 링크') : null,
      card.image_source ? el('div', { class: 'src-note' }, `이미지: ${card.image_source} (${card.image_license ?? '라이선스 미상'})`) : null),
  ].filter(Boolean));
}

/* ------------------------------------------------------------------ 시작 */

function showLoadError(title, lines) {
  $('card').className = 'card empty error';
  $('card').replaceChildren(el('div', {},
    el('p', {}, el('b', {}, title)),
    el('ul', { class: 'err-list', id: 'load-errors' }, lines.slice(0, 12).map((l) => el('li', {}, l))),
    lines.length > 12 ? el('p', {}, `외 ${lines.length - 12}건 — 콘솔 참고`) : null));
  document.body.dataset.ready = 'error';
}

async function init() {
  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  app.seedParam = Number.isFinite(seed) ? seed >>> 0 : null;

  let loaded;
  try {
    loaded = await loadCards(resolveDataUrls(location.search, CONFIG.cardDataUrls));
  } catch (e) {
    showLoadError('카드 데이터를 읽지 못했습니다. README의 실행 방법(저장소 루트에서 정적 서버)을 확인하세요.', [String(e.message)]);
    return;
  }
  // D11: 모드로 거르기(규칙 9) → 남은 카드 전체 검증 → 오류가 하나라도 있으면 시작하지 않는다.
  const cards = CONFIG.onlyVerified ? releaseFilter(loaded.cards) : loaded.cards;
  const { errors, warnings } = validateCards(cards, { release: CONFIG.onlyVerified });
  const file = loaded.url.split('/').pop();
  if (warnings.length) console.warn('[한양 도감] 카드 데이터 경고', warnings);
  if (errors.length) {
    console.error('[한양 도감] 카드 데이터 검증 오류', errors);
    $('data-info').textContent = `데이터: ${file}`;
    showLoadError(`카드 데이터 검증 오류 ${errors.length}건 — 게임을 시작하지 않습니다.`, errors.map((x) => `[${x.rule}] ${x.id}: ${x.message}`));
    return;
  }
  app.cards = cards;
  app.cardsById = new Map(cards.map((c) => [c.id, c]));
  app.anchors = anchorCards(cards);
  app.playable = playableCards(cards);

  $('data-info').textContent = `데이터: ${file} · 판정 카드 ${app.playable.length}장 · 기준 카드 ${app.anchors.length}장`
    + (app.playable.some((c) => !c.verified) ? ' · 플레이테스트 빌드(사실 확인 전 카드 포함)' : '');
  if (warnings.length) $('data-warn').textContent = `데이터 경고 ${warnings.length}건(콘솔 참고)`;

  const saved = app.store.load();
  app.collection = restoreCollection(saved?.collection, app.cards);
  app.round = restoreRound(saved?.round, app.playable) ?? newRoundState();
  persist();

  setupDrag();
  $('btn-dogam').addEventListener('click', openDogam);
  $('btn-dogam-close').addEventListener('click', closeDogam);
  $('btn-new').addEventListener('click', confirmNewRound);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('dogam').hidden) closeDogam();
    else if (['confirm', 'complete'].includes($('modal').dataset.kind) && roundStatus(app.round) === 'playing') closeModal();
  });
  render();
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
  document.body.dataset.ready = 'true';
}

init();
