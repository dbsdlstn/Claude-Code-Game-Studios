// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 화면: 위쪽 사료 카드, 아래쪽 왕대 연표. 틈을 눌러 꽂는다(데스크톱은 끌어 놓기도).
 * 규칙은 rules.js, 수치는 config.js. 텍스트는 전부 textContent로 넣는다.
 */
import { CONFIG } from './config.js';
import { createStore } from './storage.js';
import {
  validateDeck, gapBounds, promotionFor, createSession, currentId, revealClue, placeCurrent, sessionTimeline,
  isSessionDone, sessionSummary, masteryCounts, mastery, dueCount, restoreProgress, restoreSession, dataFingerprint,
} from './rules.js';

const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : String(c));
  return n;
}

const MEDAL = { gold: '금', silver: '은', bronze: '동', none: '학습 중', unseen: '미학습' };

const app = {
  store: createStore(CONFIG.storageKey),
  deck: null, cardsById: new Map(), anchorsById: new Map(), dataId: '', dataFile: '',
  sessionNo: 1, progress: Object.freeze({}), state: null, log: [],
  lastResult: null, seedParam: null,
};

function persist() {
  app.store.save({ dataId: app.dataId, sessionNo: app.sessionNo, progress: app.progress, current: app.state, log: app.log });
}

function announce(text) {
  const a = $('announcer');
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = text; });
}

const byOrder = (id) => app.cardsById.get(id) ?? app.anchorsById.get(id);
const label = (item) => (item ? `${item.title}(${item.year_label})` : null);
function gapText(bounds) {
  const b = label(bounds.before && byOrder(bounds.before.id));
  const a = label(bounds.after && byOrder(bounds.after.id));
  if (b && a) return `${b}와 ${a} 사이`;
  if (a) return `${a}보다 앞`;
  return `${b}보다 뒤`;
}
const nextSeed = () => (app.seedParam !== null ? app.seedParam + app.sessionNo : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);

function startSession() {
  app.state = createSession(app.deck.cards, app.progress, app.sessionNo, CONFIG, nextSeed());
  app.lastResult = null;
  persist();
  render();
}

/* ------------------------------------------------------------------ 렌더 */

function renderTop() {
  $('nation-label').textContent = app.deck.nation_label ?? '';
  $('session-no').textContent = `세션 ${app.sessionNo}`;
  const total = app.state.queue.length;
  const done = app.state.index;
  $('progress').textContent = isSessionDone(app.state) ? `${done} / ${total} 완료` : `카드 ${done + 1} / ${total}`;
  $('progress').dataset.index = String(done);
}

function clueButton(card) {
  const n = app.state.clues;
  const max = card.clues.length;
  const now = promotionFor(n, CONFIG);
  const after = promotionFor(n + 1, CONFIG);
  return el('div', { class: 'clue-bar' },
    el('button', {
      type: 'button', id: 'btn-clue', class: 'btn', disabled: n >= max,
      onclick: () => { app.state = revealClue(app.state, max); persist(); renderCard(); $('btn-clue')?.focus(); },
    }, n >= max ? '단서를 모두 봤습니다' : `단서 보기 (${n + 1}/${max})`),
    el('span', { class: 'cost', id: 'clue-cost', dataset: { now: String(now), after: String(after) } },
      `지금 맞히면 상자 +${now}`, n < max ? ` · 단서를 열면 +${after}` : ''));
}

function refText(text, refs) {
  return text.split(/(\[[^\]]+\])/g).filter(Boolean).map((part) => {
    const m = /^\[(.+)\]$/.exec(part);
    if (!m) return part;
    const a = (refs ?? []).map((r) => app.anchorsById.get(r)).find((x) => x?.title === m[1]);
    if (!a) return el('b', {}, part);
    return el('button', { type: 'button', class: 'ref-link', dataset: { refId: a.id }, 'aria-label': `${part} 연표에서 보기: ${a.year_label}` }, part);
  });
}

function renderQuestion(box, card) {
  box.className = 'card card-question';
  box.dataset.cardId = card.id; // E2E가 정답을 데이터에서 찾을 때 쓴다(화면에는 보이지 않음).
  box.replaceChildren(...[
    el('div', { class: 'card-head' }, el('span', { class: 'badge' }, '사료'), el('span', { class: 'card-title' }, '이 사건은 언제일까?')),
    el('blockquote', { class: 'source-text', id: 'source-text' }, card.source_text),
    el('p', { class: 'source-note' }, '출처는 정답 뒤에 공개합니다.'),
    card.clues.slice(0, app.state.clues).length
      ? el('ol', { class: 'clues', id: 'clues' }, card.clues.slice(0, app.state.clues).map((cl) => el('li', { class: `clue clue-${cl.kind}` },
        el('span', { class: 'clue-kind' }, cl.kind === 'relation' ? '관계' : '직접'), refText(cl.text, cl.refs))))
      : null,
    clueButton(card),
  ].filter(Boolean));
}

function renderResult(box) {
  const r = app.lastResult;
  const card = app.cardsById.get(r.id);
  const entry = app.progress[r.id];
  const wait = entry.due - app.state.session;
  box.className = `card card-result ${r.correct ? 'is-right' : 'is-wrong'}`;
  delete box.dataset.cardId;
  const boxLine = r.correct
    ? `상자 ${r.boxFrom ?? '새 카드'} → ${r.boxTo}${r.promoted > 0 ? ` (+${r.promoted})` : ' (단서를 봐서 그대로)'}`
    : `상자 ${r.boxFrom ?? '새 카드'} → ${r.boxTo} (다시 복습)`;
  const isLast = isSessionDone(app.state);
  box.replaceChildren(...[
    el('div', { class: 'result-head', id: 'result', dataset: { result: r.correct ? 'correct' : 'wrong' } },
      el('span', { class: 'mark', 'aria-hidden': 'true' }, r.correct ? '○' : '✕'),
      r.correct ? '정답' : '오답'),
    el('h3', { class: 'result-title' }, card.title),
    el('p', { class: 'result-meta' }, `${card.year_label} · ${card.reign ?? ''}`),
    r.correct ? null : el('p', { class: 'result-where', id: 'result-where' }, '놓은 자리: ', el('s', {}, r.placedText), el('br'), '맞는 자리: ', el('b', {}, r.rightText)),
    el('p', { class: 'result-exp' }, card.explanation),
    el('p', { class: 'result-source' }, `출처: ${card.source?.name ?? ''}${card.source?.ref ? ' ' + card.source.ref : ''}`),
    el('p', { class: 'result-box', id: 'result-box', dataset: { from: String(r.boxFrom ?? ''), to: String(r.boxTo) } },
      boxLine, ` · ${wait <= 1 ? '다음 세션에 다시' : `${wait}세션 뒤 복습`}`),
    el('button', { type: 'button', id: 'btn-next', class: 'btn btn-primary', onclick: onNext }, isLast ? '세션 결과 보기' : '다음 카드'),
  ].filter(Boolean));
}

function renderCard() {
  const box = $('card');
  if (app.lastResult) { renderResult(box); return; }
  const id = currentId(app.state);
  if (!id) { box.className = 'card'; box.replaceChildren(el('p', {}, '이번 세션을 마쳤습니다.')); return; }
  renderQuestion(box, app.cardsById.get(id));
}

function renderTimeline() {
  const items = sessionTimeline(app.state, app.deck.anchors, CONFIG);
  const asking = !app.lastResult && !!currentId(app.state);
  const list = $('timeline');
  const nodes = [];
  const gap = (k) => {
    const bounds = gapBounds(items, k);
    return el('li', { class: 'gap-row' }, el('button', {
      type: 'button', class: 'gap', dataset: { gap: String(k) }, disabled: !asking,
      'aria-label': `${gapText(bounds)}에 꽂기`,
      onclick: () => place(k),
    }, el('span', { class: 'gap-plus', 'aria-hidden': 'true' }, '＋'), el('span', { class: 'gap-label' }, '여기에 꽂기')));
  };
  items.forEach((it, i) => {
    nodes.push(gap(i));
    const c = byOrder(it.id);
    const fresh = app.lastResult && app.lastResult.id === it.id;
    const cls = it.kind === 'anchor' ? 'row row-anchor' : `row row-placed ${it.correct ? 'row-right' : 'row-wrong'}`;
    nodes.push(el('li', { class: cls + (fresh ? ' row-new' : ''), dataset: { id: it.id, order: String(it.order) } },
      el('span', { class: 'row-year' }, c.year_label.split('(')[0].trim()),
      el('span', { class: 'row-main' },
        el('span', { class: 'row-title' }, it.kind === 'placed' ? (it.correct ? '○ ' : '✕ ') : '', c.title),
        el('span', { class: 'row-reign' }, c.reign ? `${c.reign}` : ''),
        it.kind === 'anchor' ? el('span', { class: 'row-tag' }, '기준') : null,
        fresh && !it.correct ? el('span', { class: 'row-tag row-tag-wrong' }, '맞는 자리') : null)));
  });
  nodes.push(gap(items.length));
  list.replaceChildren(...nodes);
  list.classList.toggle('asking', asking);
  $('timeline-title').textContent = `${app.deck.nation_label ?? ''} 왕대 연표`;
  $('timeline-help').textContent = asking ? '사건이 들어갈 틈(＋)을 누르세요. 데스크톱은 카드를 끌어 놓아도 됩니다.' : '';
}

function render() {
  renderTop();
  renderCard();
  renderTimeline();
}

/* ------------------------------------------------------------------ 동작 */

function place(k) {
  const before = sessionTimeline(app.state, app.deck.anchors, CONFIG);
  const { state, progress, result } = placeCurrent(app.state, k, app.cardsById, app.deck.anchors, app.progress, CONFIG);
  if (!result) return;
  app.state = state;
  app.progress = progress;
  app.lastResult = { ...result, placedText: gapText(gapBounds(before, k)), rightText: gapText(gapBounds(before, result.correctGaps[0])) };
  persist();
  render();
  const card = app.cardsById.get(result.id);
  announce(result.correct
    ? `정답. ${card.title}, ${card.year_label}. 상자 ${result.boxTo}.`
    : `오답. 맞는 자리는 ${app.lastResult.rightText}. ${card.title}, ${card.year_label}. 상자 1로.`);
  $('btn-next').focus();
  document.querySelector('.row-new')?.scrollIntoView?.({ block: 'nearest' });
}

function onNext() {
  app.lastResult = null;
  if (isSessionDone(app.state)) { showSummary(); render(); return; }
  render();
  $('card').focus();
  window.scrollTo?.({ top: 0 });
}

function showSummary() {
  const s = sessionSummary(app.state);
  const counts = masteryCounts(app.deck.cards, app.progress, CONFIG);
  const nextDue = dueCount(app.deck.cards, app.progress, app.sessionNo + 1);
  if (!app.log.some((l) => l.session === app.state.session)) {
    app.log = [...app.log, { session: app.state.session, at: new Date().toISOString(), ...s, cards: app.state.placed.map((p) => ({ id: p.id, correct: p.correct, clues: p.cluesUsed, from: p.boxFrom, to: p.boxTo })) }];
    persist();
  }
  $('summary-body').replaceChildren(
    el('dl', { class: 'stats', id: 'summary-stats', dataset: { right: String(s.right), total: String(s.total) } },
      el('dt', {}, '정답'), el('dd', {}, `${s.right} / ${s.total}`),
      el('dt', {}, '단서 없이 정답'), el('dd', {}, `${s.noClueRight}장`),
      el('dt', {}, '연 단서'), el('dd', {}, `${s.clues}개`),
      el('dt', {}, '다음 세션 복습'), el('dd', { id: 'summary-due' }, `${nextDue}장`)),
    el('ol', { class: 'summary-list' }, app.state.placed.map((p) => {
      const c = app.cardsById.get(p.id);
      return el('li', { dataset: { id: p.id } }, el('span', { class: p.correct ? 'ok' : 'bad' }, p.correct ? '○' : '✕'), ` ${c.title} · 단서 ${p.cluesUsed} · 상자 ${p.boxFrom ?? '새'}→${p.boxTo}`);
    })),
    el('p', { class: 'medals' }, `숙련: 금 ${counts.gold} · 은 ${counts.silver} · 동 ${counts.bronze}`));
  $('summary').hidden = false;
  $('summary-next').focus();
}

function nextSession() {
  $('summary').hidden = true;
  app.sessionNo += 1;
  startSession();
  $('card').focus();
}

/* ------------------------------------------------------------------ 숙련 도감 */

function openDogam() {
  const counts = masteryCounts(app.deck.cards, app.progress, CONFIG);
  $('dogam-counts').textContent = `금 ${counts.gold} · 은 ${counts.silver} · 동 ${counts.bronze} · 학습 중 ${counts.none} · 미학습 ${counts.unseen}`;
  $('dogam-counts').dataset.gold = String(counts.gold);
  const cards = [...app.deck.cards].sort((a, b) => a.order - b.order);
  $('dogam-list').replaceChildren(...cards.map((c) => {
    const e = app.progress[c.id];
    const m = mastery(e, CONFIG);
    const wait = e ? Math.max(0, e.due - app.sessionNo) : null;
    return el('li', { class: `dogam-row medal-${m}`, dataset: { id: c.id, mastery: m } },
      el('span', { class: 'medal' }, MEDAL[m]),
      el('span', { class: 'dogam-main' },
        el('span', { class: 'dogam-title' }, e ? c.title : '？？？'),
        el('span', { class: 'dogam-sub' }, e ? `${c.year_label} · 상자 ${e.box} · ${wait === 0 ? '복습할 때' : `${wait}세션 뒤 복습`} · 정답 ${e.right}/${e.seen}` : '아직 만나지 않은 카드')));
  }));
  $('dogam').hidden = false;
  $('dogam-close').focus();
}

function openModal(title, body, actions, kind) {
  $('modal-title').textContent = title;
  $('modal-body').replaceChildren(...body);
  $('modal-actions').replaceChildren(...actions);
  $('modal').dataset.kind = kind;
  $('modal').hidden = false;
  actions[0]?.focus();
}
const closeModal = () => { $('modal').hidden = true; };

function confirmReset() {
  openModal('학습 기록을 지울까요?', [el('p', {}, '상자, 숙련 등급, 세션 기록이 모두 지워집니다.')],
    [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
      el('button', { type: 'button', class: 'btn', id: 'reset-next', onclick: () => openModal('정말 모두 지울까요?', [el('p', {}, '되돌릴 수 없습니다.')],
        [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
          el('button', { type: 'button', class: 'btn btn-danger', id: 'reset-confirm', onclick: doReset }, '모두 지우기')], 'reset2') }, '계속')], 'reset1');
}

function doReset() {
  app.store.clear();
  app.progress = Object.freeze({});
  app.log = [];
  app.sessionNo = 1;
  closeModal();
  $('dogam').hidden = true;
  startSession();
  announce('학습 기록을 지웠습니다.');
}

/* ------------------------------------------------------------------ 끌어 놓기(데스크톱 마우스 보조) */

function setupDrag() {
  const card = $('card');
  const ghost = $('drag-ghost');
  let start = null;
  let dragging = false;
  let over = null;
  const gapAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('#timeline .gap:not([disabled])') ?? null;
  const setOver = (g) => { if (over !== g) { over?.classList.remove('over'); over = g; over?.classList.add('over'); } };
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || app.lastResult || !currentId(app.state) || e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging = false;
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
      dragging = true;
      ghost.textContent = '사료 카드';
      ghost.hidden = false;
      card.classList.add('dragging');
    }
    if (dragging) {
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
      setOver(gapAt(e.clientX, e.clientY));
    }
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const target = dragging ? gapAt(e.clientX, e.clientY) : null;
    start = null;
    dragging = false;
    ghost.hidden = true;
    card.classList.remove('dragging');
    setOver(null);
    if (target) place(Number(target.dataset.gap));
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', (e) => { if (start && e.pointerId === start.id) { start = null; dragging = false; ghost.hidden = true; setOver(null); card.classList.remove('dragging'); } });
}

/** 관계 단서의 [기준 카드]를 누르거나 포커스하면 연표의 그 줄을 강조한다(v0 D37과 같은 상호작용). */
function setupRefs() {
  const card = $('card');
  let timer = null;
  const clear = () => document.querySelectorAll('#timeline .ref-target').forEach((r) => r.classList.remove('ref-target'));
  const show = (b, sticky) => {
    clear();
    clearTimeout(timer);
    const row = document.querySelector(`#timeline .row[data-id="${CSS.escape(b.dataset.refId)}"]`);
    row?.classList.add('ref-target');
    row?.scrollIntoView?.({ block: 'nearest' });
    if (!sticky) timer = setTimeout(clear, 2500);
  };
  card.addEventListener('focusin', (e) => { const b = e.target.closest?.('.ref-link'); if (b) show(b, true); });
  card.addEventListener('focusout', (e) => { if (e.target.closest?.('.ref-link')) clear(); });
  card.addEventListener('click', (e) => { const b = e.target.closest?.('.ref-link'); if (b) show(b, document.activeElement === b); });
}

/* ------------------------------------------------------------------ 시작 */

async function loadDeck(urls) {
  const tried = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) { tried.push(`${url} (HTTP ${res.status})`); continue; }
      return { url, deck: await res.json() };
    } catch (e) { tried.push(`${url} (${e.message})`); }
  }
  throw new Error(`데이터를 읽지 못했다: ${tried.join(', ')}`);
}

async function init() {
  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  app.seedParam = Number.isFinite(seed) ? seed >>> 0 : null;
  let loaded;
  try {
    loaded = await loadDeck(params.get('data') ? [params.get('data')] : CONFIG.dataUrls);
  } catch (e) {
    $('card').replaceChildren(el('p', {}, String(e.message)));
    document.body.dataset.ready = 'error';
    return;
  }
  const errs = validateDeck(loaded.deck);
  if (errs.length) {
    $('card').replaceChildren(el('p', {}, `데이터 오류 ${errs.length}건`), el('ul', {}, errs.slice(0, 10).map((x) => el('li', {}, x))));
    document.body.dataset.ready = 'error';
    return;
  }
  app.deck = loaded.deck;
  app.dataFile = loaded.url.split('/').pop();
  app.cardsById = new Map(app.deck.cards.map((c) => [c.id, c]));
  app.anchorsById = new Map(app.deck.anchors.map((a) => [a.id, a]));
  app.dataId = dataFingerprint(loaded.url, app.deck);
  $('data-info').textContent = `데이터: ${app.dataFile} · 카드 ${app.deck.cards.length}장 · 기준 ${app.deck.anchors.length}장 · M1 프로토타입(사실 확인 전)`;

  const saved = app.store.load();
  const same = saved?.dataId === app.dataId;
  app.progress = same ? restoreProgress(saved.progress, app.deck.cards, CONFIG) : Object.freeze({});
  app.sessionNo = same && Number.isInteger(saved.sessionNo) && saved.sessionNo >= 1 ? saved.sessionNo : 1;
  app.log = same && Array.isArray(saved.log) ? saved.log : [];
  const restored = same ? restoreSession(saved.current, app.deck.cards) : null;

  setupDrag();
  setupRefs();
  $('btn-dogam').addEventListener('click', openDogam);
  const closeDogam = () => { $('dogam').hidden = true; if (isSessionDone(app.state)) showSummary(); else $('btn-dogam').focus(); };
  $('dogam-close').addEventListener('click', closeDogam);
  $('btn-reset').addEventListener('click', confirmReset);
  $('summary-next').addEventListener('click', nextSession);
  $('summary-dogam').addEventListener('click', () => { $('summary').hidden = true; openDogam(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('modal').hidden) closeModal();
    else if (!$('dogam').hidden) closeDogam();
  });

  if (restored && restored.session === app.sessionNo) {
    app.state = restored;
    render();
    if (isSessionDone(app.state)) showSummary();
  } else {
    startSession();
  }
  document.body.dataset.ready = 'true';
}

init();
