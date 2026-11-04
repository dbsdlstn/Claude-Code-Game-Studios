/**
 * 화면 연결. 규칙은 rules.js, 저장은 storage.js, 로딩은 data.js에 있고 여기서는 DOM만 다룬다.
 * 텍스트는 전부 textContent로 넣는다(카드 데이터를 HTML로 해석하지 않는다).
 */
import { CONFIG } from './config.js';
import { loadCards, resolveDataUrls } from './data.js';
import { createStore } from './storage.js';
import {
  NATIONS, ERAS, nationLabel, eraLabel, validateCards, anchorCards, playableCards,
  createRound, roundStatus, currentCardId, revealNextClue, placeCard, boardCells, roundStats,
  recordInCollection, serializeRound, restoreRound, restoreCollection,
} from './rules.js';

const TYPE_LABEL = { event: '사건', artifact: '유물', person: '인물', myth: '전승' };
const $ = (id) => document.getElementById(id);

/** 작은 DOM 생성 도우미. 문자열 자식은 텍스트 노드가 된다. */
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
  selected: false, lastResult: null, dogamActive: null,
  seedParam: null,
};

function newSeed() {
  if (app.seedParam !== null) return app.seedParam;
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}

function persist() {
  app.store.save(serializeRound(app.round), app.collection);
}

/* ------------------------------------------------------------------ 렌더 */

function renderTop() {
  const ink = $('ink');
  const { ink: n, startInk } = app.round;
  ink.replaceChildren(el('span', { class: 'ink-label' }, '먹물'));
  for (let i = 0; i < startInk; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 20');
    svg.setAttribute('class', 'drop' + (i < n ? '' : ' empty'));
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M8 1 C8 1 2 9 2 13 a6 6 0 0 0 12 0 C14 9 8 1 8 1 Z');
    svg.append(p);
    ink.append(svg);
  }
  ink.dataset.ink = String(n);
  ink.setAttribute('aria-label', `먹물 ${Math.max(n, 0)}/${startInk}`);
  const total = app.round.order.length;
  const done = app.round.index;
  $('progress').textContent = roundStatus(app.round) === 'playing'
    ? `카드 ${done + 1} / ${total}` : `카드 ${done} / ${total} 처리`;
  $('progress').dataset.index = String(done);
}

function renderCard() {
  const box = $('card');
  const id = currentCardId(app.round);
  box.classList.toggle('selected', app.selected && !!id);
  if (!id) {
    box.className = 'card empty';
    box.replaceChildren(el('p', {}, roundStatus(app.round) === 'cleared' ? '이번 라운드의 카드를 모두 놓았습니다.' : '먹물이 바닥났습니다.'));
    box.removeAttribute('data-card-id');
    return;
  }
  box.className = 'card' + (app.selected ? ' selected' : '');
  const card = app.cardsById.get(id);
  const shown = card.clues.slice(0, app.round.shown);
  const more = el('button', {
    id: 'more-clue', type: 'button', class: 'btn',
    disabled: app.round.shown >= card.clues.length,
    onclick: (e) => { e.stopPropagation(); onMoreClue(); },
    onpointerdown: (e) => e.stopPropagation(),
  }, '단서 더 보기');
  box.dataset.cardId = id; // E2E가 정답을 데이터에서 찾을 때 쓴다(화면에는 보이지 않음).
  box.replaceChildren(
    el('div', { class: 'card-head' },
      el('span', { class: 'card-title' }, '？ 이름 숨김'),
      el('span', { class: 'card-type' }, TYPE_LABEL[card.type] ?? card.type)),
    el('ol', { class: 'clues', id: 'clues' },
      shown.map((cl) => el('li', { class: 'clue', dataset: { kind: cl.kind, level: String(cl.level) } },
        el('span', { class: 'clue-level' }, ['', '1단계 · 장면', '2단계 · 관계', '3단계 · 직접 힌트'][cl.level] ?? ''),
        clueText(cl.text)))),
    el('div', { class: 'card-foot' },
      el('span', { class: 'clue-count' }, `단서 ${app.round.shown} / ${card.clues.length}`),
      more),
  );
}

function renderBoard() {
  const board = $('board');
  const cells = boardCells(app.round, app.anchors);
  const nodes = [el('div', { class: 'corner' })];
  for (const e of ERAS) {
    nodes.push(el('div', { class: 'era-head', dataset: { era: e.id } },
      el('span', { class: 'era-name' }, e.label), el('span', { class: 'era-def' }, e.definition)));
  }
  for (const n of NATIONS) {
    nodes.push(el('div', { class: 'nation-head' }, n.label));
    for (const e of ERAS) {
      const key = `${n.id}:${e.id}`;
      const c = cells[key];
      const flash = app.lastResult && (
        (app.lastResult.answer.nation === n.id && app.lastResult.answer.era === e.id && 'flash-ok')
        || (!app.lastResult.correct && app.lastResult.placed.nation === n.id && app.lastResult.placed.era === e.id && 'flash-bad'));
      nodes.push(el('button', {
        type: 'button', class: 'cell' + (flash ? ' ' + flash : ''),
        dataset: { nation: n.id, era: e.id },
        'aria-label': `${n.label} ${e.label}`,
        onclick: () => onCellClick(n.id, e.id),
      },
      c.anchors.map((id) => el('span', { class: 'chip chip-anchor', dataset: { id } }, app.cardsById.get(id).title)),
      c.placed.map((p) => el('span', { class: 'chip ' + (p.correct ? 'chip-ok' : 'chip-bad'), dataset: { id: p.id }, title: p.correct ? '정답으로 수집' : '오답으로 공개' },
        app.cardsById.get(p.id).title))));
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
  const where = (a) => `${nationLabel(a.nation)} · ${eraLabel(a.era)}`;
  box.replaceChildren(el('div', { class: 'fb ' + (r.correct ? 'fb-ok' : 'fb-bad'), id: 'fb', dataset: { result: r.correct ? 'correct' : 'wrong' } },
    el('div', { class: 'fb-head' }, r.correct ? '정답 — 도감에 수집했습니다' : '오답 — 먹물 1 소모, 카드는 정답 칸에 공개됩니다'),
    el('div', { class: 'fb-title' }, card.title),
    el('div', { class: 'fb-meta' },
      r.correct ? where(r.answer) : `놓은 칸 ${where(r.placed)} → 정답 칸 ${where(r.answer)}`,
      card.date_label ? ` · ${card.date_label}` : ''),
    el('p', {}, card.explanation)));
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
}

function setSelected(v) {
  app.selected = v && !!currentCardId(app.round);
  $('card').classList.toggle('selected', app.selected);
  $('board').classList.toggle('armed', app.selected);
}

function onCellClick(nation, era) {
  if (!app.selected) {
    if (currentCardId(app.round)) $('hand-help').textContent = '먼저 카드를 눌러 고른 뒤 칸을 누르세요. 끌어서 놓아도 됩니다.';
    return;
  }
  place(nation, era);
}

function place(nation, era) {
  const { state, result } = placeCard(app.round, app.cardsById, nation, era);
  if (!result) return;
  app.round = state;
  app.collection = recordInCollection(app.collection, result);
  app.lastResult = result;
  app.selected = false;
  persist();
  render();
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
}

function startNewRound() {
  app.round = createRound(app.playable, { seed: newSeed(), startInk: CONFIG.startInk });
  app.lastResult = null;
  app.selected = false;
  persist();
  closeModal();
  render();
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
      ghost.textContent = '？ 이름 숨김 카드';
      ghost.hidden = false;
      $('board').classList.add('armed');
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
    const target = cancelled ? null : (wasDragging ? cellAt(e.clientX, e.clientY) : null);
    start = null;
    dragging = false;
    card.classList.remove('dragging');
    ghost.hidden = true;
    setOver(null);
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
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(!app.selected); }
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

function showEndModal(status) {
  const s = roundStats(app.round);
  const stats = el('dl', { class: 'stats' },
    el('dt', {}, '정답'), el('dd', {}, `${s.right} / ${s.total}장 (${s.rate}%)`),
    el('dt', {}, '남은 먹물'), el('dd', {}, `${Math.max(s.ink, 0)} / ${app.round.startInk}`),
    el('dt', {}, '단서 더 보기'), el('dd', {}, `${s.hints}회 (${s.cardsWithHints}장에서 사용)`),
    el('dt', {}, '놓지 못한 카드'), el('dd', {}, `${s.deck - s.total}장`));
  const dogamBtn = el('button', { type: 'button', class: 'btn', id: 'modal-dogam', onclick: () => { closeModal(); openDogam(); } }, '도감 보기');
  if (status === 'cleared') {
    openModal('라운드 클리어', [el('p', {}, '이번 라운드의 카드를 모두 놓았습니다. 정답으로 놓은 카드는 도감에 수집되었습니다.'), stats],
      [dogamBtn, el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-retry', onclick: startNewRound }, '새 라운드')], 'cleared');
  } else {
    openModal('먹물이 바닥났습니다', [el('p', {}, '이번 라운드는 실패입니다. 지금까지 수집한 카드는 도감에 남습니다.'), stats],
      [dogamBtn, el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-retry', onclick: startNewRound }, '재도전')], 'failed');
  }
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
      const inCell = app.cards.filter((c) => c.answer?.nation === n.id && c.answer?.era === e.id && app.cardsById.has(c.id));
      nodes.push(el('div', { class: 'cell', dataset: { nation: n.id, era: e.id } },
        inCell.map((c) => {
          const st = dogamState(c);
          const known = st !== 'unknown';
          return el('button', {
            type: 'button',
            class: `entry ${st}${c.disputed ? ' disputed' : ''}${app.dogamActive === c.id ? ' active' : ''}`,
            dataset: { id: c.id, state: st },
            onclick: () => { app.dogamActive = c.id; renderDogam(); },
          }, known || c.disputed ? c.title : '？？？');
        })));
    }
  }
  grid.replaceChildren(...nodes);

  const judged = app.playable;
  const collected = judged.filter((c) => app.collection[c.id] === 'collected').length;
  const revealed = judged.filter((c) => app.collection[c.id] === 'revealed').length;
  $('dogam-count').textContent = `수집 ${collected} / ${judged.length}장 · 오답으로 공개 ${revealed}장`;
  $('dogam-count').dataset.collected = String(collected);
  renderDogamDetail();
}

function renderDogamDetail() {
  const box = $('dogam-detail');
  const card = app.dogamActive ? app.cardsById.get(app.dogamActive) : null;
  if (!card) {
    box.replaceChildren(el('p', { class: 'meta' }, '칸 안의 카드를 누르면 해설을 볼 수 있습니다.'),
      el('p', {}, '○ 정답으로 수집 · 점선은 오답으로 공개된 카드 · ？？？는 아직 만나지 못한 카드입니다.'));
    return;
  }
  const st = dogamState(card);
  const where = `${nationLabel(card.answer.nation)} · ${eraLabel(card.answer.era)}${card.date_label ? ' · ' + card.date_label : ''}`;
  if (st === 'unknown' && !card.disputed) {
    box.replaceChildren(el('h3', {}, '？？？'), el('p', { class: 'meta' }, where),
      el('p', {}, '아직 수집하지 않은 카드입니다. 라운드에서 정답으로 놓으면 해설이 열립니다.'));
    return;
  }
  const badges = [];
  if (st === 'collected') badges.push(el('span', { class: 'badge badge-ok' }, '수집'));
  if (st === 'revealed') badges.push(el('span', { class: 'badge badge-bad' }, '오답으로 공개'));
  if (st === 'anchor') badges.push(el('span', { class: 'badge' }, '기준 카드'));
  if (card.disputed) badges.push(el('span', { class: 'badge badge-warn' }, '견해가 나뉨 · 판정 제외'));
  if (!card.verified) badges.push(el('span', { class: 'badge badge-warn' }, '사실 확인 전'));
  box.replaceChildren(...[
    el('h3', { id: 'dogam-detail-title' }, card.title),
    el('p', { class: 'meta' }, where, ' · ', TYPE_LABEL[card.type] ?? card.type),
    el('div', {}, badges),
    el('p', {}, card.explanation || ''),
    card.disputed && card.disputed_note ? el('p', { class: 'meta' }, '견해: ', card.disputed_note) : null,
    card.source ? el('div', { class: 'src' }, '근거: ', card.source.name, card.source.note ? ` (${card.source.note})` : '') : null,

  ].filter(Boolean));
}

/* ------------------------------------------------------------------ 시작 */

async function init() {
  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  app.seedParam = Number.isFinite(seed) ? seed >>> 0 : null;

  let loaded;
  try {
    loaded = await loadCards(resolveDataUrls(location.search, CONFIG.cardDataUrls));
  } catch (e) {
    $('card').className = 'card empty';
    $('card').replaceChildren(el('p', {}, '카드 데이터를 읽지 못했습니다. README의 실행 방법(저장소 루트에서 정적 서버)을 확인하세요.'));
    $('data-warn').textContent = String(e.message);
    document.body.dataset.ready = 'error';
    return;
  }
  const { errors, warnings } = validateCards(loaded.cards);
  const invalidIds = new Set(errors.map((x) => x.id).filter(Boolean));
  app.cards = loaded.cards.filter((c) => c && typeof c.id === 'string' && !invalidIds.has(c.id));
  app.cardsById = new Map(app.cards.map((c) => [c.id, c]));
  app.anchors = anchorCards(app.cards);
  app.playable = playableCards(app.cards, { onlyVerified: CONFIG.onlyVerified });

  const file = loaded.url.split('/').pop();
  $('data-info').textContent = `데이터: ${file} · 판정 카드 ${app.playable.length}장 · 기준 카드 ${app.anchors.length}장`
    + (app.playable.some((c) => !c.verified) ? ' · 플레이테스트 빌드(사실 확인 전 카드 포함)' : '');
  if (errors.length || warnings.length) {
    $('data-warn').textContent = `데이터 검증: 오류 ${errors.length}건(해당 카드 제외), 경고 ${warnings.length}건 — 콘솔 참고`;
    console.warn('[한양 도감] 카드 데이터 검증', { errors, warnings });
  }

  const saved = app.store.load();
  app.collection = restoreCollection(saved?.collection, app.cards);
  app.round = restoreRound(saved?.round, app.playable)
    ?? createRound(app.playable, { seed: newSeed(), startInk: CONFIG.startInk });
  persist();

  setupDrag();
  $('btn-dogam').addEventListener('click', openDogam);
  $('btn-dogam-close').addEventListener('click', closeDogam);
  $('btn-new').addEventListener('click', confirmNewRound);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('dogam').hidden) closeDogam();
    else if ($('modal').dataset.kind === 'confirm') closeModal();
  });
  render();
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
  document.body.dataset.ready = 'true';
}

init();
