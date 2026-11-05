// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 화면: 위쪽 사료 카드, 아래쪽 왕대 연표. 칸(틈)을 눌러 꽂는다(데스크톱은 끌어 놓기도).
 * 규칙은 rules.js(leitner-spec), 수치는 config.js, 형식 변환은 data.js. 텍스트는 전부 textContent로 넣는다.
 */
import { CONFIG } from './config.js';
import { createStore } from './storage.js';
import { loadRaw, normalizeDeck } from './data.js';
import {
  validateDeck, gapBounds, selectableGaps, buildSession, createSessionState, currentId, revealClue, placeCurrent,
  sessionTimeline, isRetry, isSessionDone, attemptsOf, completedAfter, sessionSummary, gradeCounts, gradeOf, GRADE_NAME,
  dueCount, earlyReviewIds, wrongNoteIds, logLine, sessionSeed, nextBox, restoreProgress, restoreSession, dataFingerprint, fnv1a,
} from './rules.js';

const L = CONFIG.leitner;
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

const GRADE_KEY = ['none', 'bronze', 'silver', 'gold'];

const app = {
  store: createStore(CONFIG.storageKey),
  deck: null, cardsById: new Map(), anchorsById: new Map(), dataId: '', dataFile: '', deckHash: 0,
  completed: 0, progress: Object.freeze({}), state: null, log: [], participant: '-',
  lastResult: null, seedParam: 0, pendingGap: null, confirmMode: CONFIG.confirmPlacement,
  cardShownAt: 0, notice: '',
};

const sessionIndex = () => app.completed + 1;

function needsConfirm() {
  if (app.confirmMode === 'always') return true;
  if (app.confirmMode === 'never') return false;
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

function persist() {
  app.store.save({
    format: 'hanyang-dogam-mastery', dataId: app.dataId, completed_sessions: app.completed, cards: app.progress,
    current: app.state, log: app.log, participant: app.participant,
  });
}

function announce(text) {
  const a = $('announcer');
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = text; });
}

const byId = (id) => app.cardsById.get(id) ?? app.anchorsById.get(id);
const shortYear = (c) => c.year_label.split('(')[0].trim();
/** 칸 이름: "앵커 이후 ~ 다음 앵커 이전"(스키마 v2). */
function slotText(items, k) {
  const { before, after } = gapBounds(items, k);
  const b = before && byId(before.id);
  const a = after && byId(after.id);
  if (b && a) return `${b.reign ?? b.title} 즉위(${shortYear(b)}) 이후 ~ ${a.reign ?? a.title} 즉위(${shortYear(a)}) 이전`;
  if (b) return `${b.reign ?? b.title} 즉위(${shortYear(b)}) 이후`;
  return `${a.reign ?? a.title} 즉위(${shortYear(a)}) 이전`;
}

/* ------------------------------------------------------------------ 세션 시작·끝 */

function startLearnSession() {
  const s = sessionIndex();
  const pick = buildSession(app.deck.cards, app.progress, s, L, sessionSeed(app.deckHash, s, app.seedParam));
  app.state = createSessionState(s, pick.ids, { kind: 'learn', mix: { due: pick.due, fresh: pick.fresh } });
  app.lastResult = null;
  app.pendingGap = null;
  app.cardShownAt = performance.now();
  persist();
  render();
}

function startPractice(kind, ids) {
  app.state = createSessionState(sessionIndex(), ids, { kind });
  app.lastResult = null;
  app.pendingGap = null;
  app.cardShownAt = performance.now();
  $('summary').hidden = true;
  $('dogam').hidden = true;
  persist();
  render();
  $('card').focus();
}

/** 세션을 끝낸다(큐를 다 했거나 "세션 끝내기"). 학습 세션이면 §5 세션 카운트. */
function finishSession() {
  const st = app.state;
  if (!st) return;
  app.completed = completedAfter(app.completed, st, L);
  showSummary(st);
  app.state = null;
  app.lastResult = null;
  persist();
}

/* ------------------------------------------------------------------ 렌더 */

function renderTop() {
  $('nation-label').textContent = app.deck.nation_label ?? '';
  $('session-no').textContent = app.state?.practice ? '연습(상태 안 바뀜)' : `세션 ${app.state?.session ?? sessionIndex()}`;
  if (!app.state) { $('progress').textContent = ''; $('progress').dataset.index = '0'; return; }
  const total = app.state.queue.length;
  const done = app.state.index;
  $('progress').textContent = isSessionDone(app.state) ? `${done} / ${total} 완료` : `카드 ${done + 1} / ${total}`;
  $('progress').dataset.index = String(done);
}

function costText(card) {
  const e = app.progress[card.id];
  const box = e?.introduced ? e.box : 1;
  if (app.state.practice || isRetry(app.state)) return '연습이라 상자는 바뀌지 않습니다.';
  const now = nextBox(box, true, app.state.clues, L);
  const parts = [`지금 맞히면 상자 ${box}→${now}`];
  if (app.state.clues === 0) parts.push('관계 단서를 열면 승급 없음');
  else if (app.state.clues === 1) parts.push('직접 단서를 열면 한 칸 내려감');
  return parts.join(' · ');
}

function clueBar(card) {
  const n = app.state.clues;
  const max = card.clues.length;
  return el('div', { class: 'clue-bar' },
    el('button', {
      type: 'button', id: 'btn-clue', class: 'btn', disabled: n >= max,
      onclick: () => { app.state = revealClue(app.state, max); persist(); renderCard(); $('btn-clue')?.focus(); },
    }, n >= max ? '단서를 모두 봤습니다' : `단서 보기 (${n + 1}/${max})`),
    el('span', { class: 'cost', id: 'clue-cost', dataset: { clues: String(n) } }, costText(card)));
}

function refText(text, refs) {
  return text.split(/(\[[^\]]+\])/g).filter(Boolean).map((part) => {
    const m = /^\[(.+)\]$/.exec(part);
    if (!m) return part;
    const a = (refs ?? []).map((r) => app.anchorsById.get(r)).find((x) => x && (x.title === m[1] || x.reign === m[1]));
    if (!a) return el('b', {}, part);
    return el('button', { type: 'button', class: 'ref-link', dataset: { refId: a.id }, 'aria-label': `${part} 연표에서 보기: ${shortYear(a)}` }, part);
  });
}

function renderQuestion(box, card) {
  box.className = 'card card-question';
  box.dataset.cardId = card.id; // E2E가 정답을 데이터에서 찾을 때 쓴다(화면에는 보이지 않음).
  const shown = card.clues.slice(0, app.state.clues);
  box.replaceChildren(...[
    el('div', { class: 'card-head' }, el('span', { class: 'badge' }, '사료'), el('span', { class: 'card-title' }, '어느 왕 때일까?'),
      isRetry(app.state) ? el('span', { class: 'badge badge-retry', id: 'retry-badge' }, '다시 풀기') : null,
      app.state.practice ? el('span', { class: 'badge badge-retry', id: 'practice-badge' }, '연습') : null),
    isRetry(app.state) ? el('p', { class: 'source-note' }, '앞에서 틀린 카드입니다. 상자는 바뀌지 않는 연습입니다.') : null,
    app.notice ? el('p', { class: 'source-note notice', id: 'notice' }, app.notice) : null,
    el('blockquote', { class: 'source-text', id: 'source-text' }, card.source_text),
    el('p', { class: 'source-note' }, '출처는 정답 뒤에 공개합니다.'),
    shown.length ? el('ol', { class: 'clues', id: 'clues' }, shown.map((cl) => el('li', { class: `clue clue-${cl.kind}` },
      el('span', { class: 'clue-kind' }, cl.kind === 'relation' ? '관계' : '직접'), refText(cl.text, cl.refs)))) : null,
    clueBar(card),
    app.state.practice ? null : el('button', { type: 'button', id: 'btn-end', class: 'btn btn-small btn-quiet', onclick: confirmEnd }, '세션 끝내기'),
  ].filter(Boolean));
}

function renderResult(box) {
  const r = app.lastResult;
  const card = app.cardsById.get(r.id);
  const entry = app.progress[r.id];
  box.className = `card card-result ${r.correct ? 'is-right' : 'is-wrong'}`;
  delete box.dataset.cardId;
  let boxLine;
  if (r.practice) boxLine = `연습 · 상자 ${r.boxFrom ?? '-'} 그대로`;
  else if (r.retry) boxLine = `다시 풀기 ${r.correct ? '성공' : '실패'} · 상자 ${r.boxTo}는 그대로(다음 세션 기준)`;
  else {
    const wait = entry.due_session - app.state.session;
    boxLine = `상자 ${r.boxFrom ?? '새 카드'} → ${r.boxTo} · ${wait <= 1 ? '다음 세션에 다시' : `${wait}세션 뒤 복습`}`
      + (!r.correct && L.relearn_in_session ? ' · 이번 세션 끝에 한 번 더' : '');
  }
  const grade = entry?.introduced ? gradeOf(entry, L) : 0;
  const isLast = isSessionDone(app.state);
  box.replaceChildren(...[
    el('div', { class: 'result-head', id: 'result', dataset: { result: r.correct ? 'correct' : 'wrong', near: r.nearMiss ? '1' : '0' } },
      el('span', { class: 'mark', 'aria-hidden': 'true' }, r.correct ? '○' : '✕'),
      r.correct ? '정답' : (r.nearMiss ? '오답 · 한 칸 차이' : '오답')),
    el('h3', { class: 'result-title' }, card.title),
    el('p', { class: 'result-meta' }, `${card.year_label} · ${card.reign ?? ''}`),
    r.correct ? null : el('p', { class: 'result-where', id: 'result-where' }, '고른 칸: ', el('s', {}, r.placedText), el('br'), '맞는 칸: ', el('b', {}, r.rightText)),
    el('p', { class: 'result-exp' }, card.explanation),
    card.exam_note ? el('p', { class: 'result-note', id: 'result-note' }, el('b', {}, '수험 정리 '), card.exam_note) : null,
    el('p', { class: 'result-source', id: 'result-source' }, `출처: ${card.source?.name ?? ''}${card.source?.ref ? ' ' + card.source.ref : ''}`),
    el('p', { class: 'result-box', id: 'result-box', dataset: { from: String(r.boxFrom ?? ''), to: String(r.boxTo ?? '') } },
      boxLine, !r.practice && !r.retry && grade ? ` · 등급 ${GRADE_NAME[grade]}` : ''),
    el('button', { type: 'button', id: 'btn-next', class: 'btn btn-primary', onclick: onNext }, isLast ? (app.state.practice ? '연습 끝내기' : '세션 결과 보기') : '다음 카드'),
  ].filter(Boolean));
}

/** 큐가 빈 세션(§5-4): 도래 카드와 새 카드를 모두 했다. */
function renderEmpty(box) {
  box.className = 'card card-empty';
  delete box.dataset.cardId;
  const early = earlyReviewIds(app.deck.cards, app.progress, L);
  box.replaceChildren(
    el('p', { class: 'empty-title', id: 'empty-title' }, '오늘 도래한 카드를 모두 했습니다.'),
    app.notice ? el('p', { class: 'source-note', id: 'notice' }, app.notice) : null,
    el('p', { class: 'source-note' }, '미리 복습은 연습이라 상자와 일정을 바꾸지 않습니다.'),
    el('div', { class: 'clue-bar' },
      early.length ? el('button', { type: 'button', id: 'btn-early', class: 'btn', onclick: () => startPractice('early', early) }, `미리 복습 ${early.length}장`) : null,
      el('button', { type: 'button', id: 'btn-skip', class: 'btn btn-primary', onclick: skipSession }, '다음 세션으로')),
    el('p', { class: 'source-note' }, '"다음 세션으로"는 하루가 지난 것으로 칩니다(세션 번호 +1).'));
}

function renderCard() {
  const box = $('card');
  if (!app.state) { box.replaceChildren(); return; }
  if (app.lastResult) { renderResult(box); return; }
  const id = currentId(app.state);
  if (!id) { renderEmpty(box); return; }
  renderQuestion(box, app.cardsById.get(id));
}

/**
 * 연표: 앵커 줄, 그 칸에 이번 세션에 놓은 카드들, 칸 버튼. 칸 k = 앵커 k 이후 ~ 앵커 k+1 이전.
 */
function renderTimeline() {
  const items = sessionTimeline(app.state ?? createSessionState(sessionIndex(), []), app.deck.anchors, L);
  const asking = !!app.state && !app.lastResult && !!currentId(app.state);
  const allowed = new Set(selectableGaps(items, L));
  const hideId = app.state && isRetry(app.state) ? currentId(app.state) : null;
  const placed = (app.state?.placed ?? []).filter((p) => p.id !== hideId);
  const nodes = [];
  const gap = (k) => {
    if (!allowed.has(k)) return null;
    const pending = asking && app.pendingGap === k;
    const text = slotText(items, k);
    const row = el('li', { class: 'gap-row' + (pending ? ' gap-pending' : '') }, el('button', {
      type: 'button', class: 'gap' + (pending ? ' gap-selected' : ''), dataset: { gap: String(k) }, disabled: !asking,
      'aria-label': `${text} 칸에 꽂기`, 'aria-pressed': pending ? 'true' : null, onclick: () => onGap(k),
    }, el('span', { class: 'gap-plus', 'aria-hidden': 'true' }, pending ? '✓' : '＋'), el('span', { class: 'gap-label' }, pending ? '이 칸을 골랐습니다' : '이 칸에 꽂기')));
    if (pending) {
      row.append(el('div', { class: 'confirm-bar' },
        el('span', { class: 'confirm-text' }, text),
        el('button', { type: 'button', id: 'cancel-place', class: 'btn btn-small', onclick: () => { app.pendingGap = null; renderTimeline(); } }, '취소'),
        el('button', { type: 'button', id: 'confirm-place', class: 'btn btn-primary btn-small', onclick: () => place(k) }, '이 칸에 꽂기')));
    }
    return row;
  };
  const placedRow = (p) => {
    const c = byId(p.id);
    const fresh = app.lastResult && app.lastResult.id === p.id;
    return el('li', { class: `row row-placed ${p.correct ? 'row-right' : 'row-wrong'}` + (fresh ? ' row-new' : ''), dataset: { id: p.id, order: String(p.order) } },
      el('span', { class: 'row-year' }, shortYear(c)),
      el('span', { class: 'row-main' },
        el('span', { class: 'row-title' }, p.correct ? '○ ' : '✕ ', c.title),
        el('span', { class: 'row-reign' }, c.reign ?? ''),
        fresh && !p.correct ? el('span', { class: 'row-tag row-tag-wrong' }, '맞는 칸') : null));
  };
  const inSlot = (lo, hi) => placed.filter((p) => (lo === null || lo <= p.order) && (hi === null || p.order < hi)).sort((a, b) => a.order - b.order);
  nodes.push(gap(0));
  items.forEach((it, i) => {
    const c = byId(it.id);
    if (it.kind === 'anchor') {
      nodes.push(el('li', { class: 'row row-anchor', dataset: { id: it.id, order: String(it.order) } },
        el('span', { class: 'row-year' }, c.reign_range ?? shortYear(c)),
        el('span', { class: 'row-main' },
          el('span', { class: 'row-title' }, c.reign ?? c.title),
          el('span', { class: 'row-reign' }, `즉위 ${shortYear(c)}`),
          el('span', { class: 'row-tag' }, '기준'))));
      if (!L.placedJoinTimeline) nodes.push(...inSlot(it.order, items[i + 1]?.order ?? null).map(placedRow));
    } else {
      nodes.push(placedRow({ id: it.id, order: it.order, correct: it.correct }));
    }
    nodes.push(gap(i + 1));
  });
  $('timeline').replaceChildren(...nodes.filter(Boolean));
  $('timeline').classList.toggle('asking', asking);
  $('timeline-title').textContent = `${app.deck.nation_label ?? ''} 왕대 연표`;
  $('timeline-help').textContent = asking
    ? (needsConfirm() ? '사건이 들어갈 칸(＋)을 고른 뒤 "이 칸에 꽂기"를 누르세요.' : '사건이 들어갈 칸(＋)을 누르세요. 카드를 끌어 놓아도 됩니다.')
    : '';
}

function render() {
  renderTop();
  renderCard();
  renderTimeline();
}

/* ------------------------------------------------------------------ 동작 */

function onGap(k) {
  if (!needsConfirm()) { place(k); return; }
  app.pendingGap = k;
  renderTimeline();
  $('confirm-place')?.focus();
}

function place(k) {
  app.pendingGap = null;
  app.notice = '';
  const items = sessionTimeline(app.state, app.deck.anchors, L);
  const now = new Date();
  const { state, progress, result } = placeCurrent(app.state, k, app.cardsById, app.deck.anchors, app.progress, L, now.toISOString());
  if (!result) return;
  app.log = [...app.log, logLine({ ts: now.getTime(), participant: app.participant, result, session: app.state.session, msOnCard: Math.round(performance.now() - app.cardShownAt) })];
  app.state = state;
  app.progress = progress;
  app.lastResult = { ...result, placedText: slotText(items, k), rightText: slotText(items, result.correctGaps[0]) };
  persist();
  render();
  const card = app.cardsById.get(result.id);
  announce(result.correct
    ? `정답. ${card.title}, ${card.year_label}.`
    : `오답${result.nearMiss ? ', 한 칸 차이' : ''}. 맞는 칸은 ${app.lastResult.rightText}. ${card.title}, ${card.year_label}.`);
  $('btn-next').focus();
  document.querySelector('.row-new')?.scrollIntoView?.({ block: 'nearest' });
}

function onNext() {
  app.lastResult = null;
  if (isSessionDone(app.state)) { finishSession(); render(); return; }
  app.cardShownAt = performance.now();
  render();
  $('card').focus();
  window.scrollTo?.({ top: 0 });
}

function confirmEnd() {
  const n = attemptsOf(app.state);
  openModal('세션을 끝낼까요?', [el('p', {}, n >= L.count_session_min_answers
    ? `${n}장을 풀었습니다. 남은 카드는 다음 세션에 다시 나옵니다.`
    : '아직 한 장도 풀지 않아 세션 번호는 그대로입니다.')],
  [el('button', { type: 'button', class: 'btn', id: 'end-cancel', onclick: closeModal }, '계속하기'),
    el('button', { type: 'button', class: 'btn btn-primary', id: 'end-confirm', onclick: () => { closeModal(); finishSession(); render(); } }, '끝내기')], 'end');
}

/** 큐가 빈 상태에서 다음 세션으로(하루 경과). §5 세션 카운트의 예외(D66). */
function skipSession() {
  app.completed += 1;
  app.notice = '';
  startLearnSession();
}

function showSummary(st) {
  const s = sessionSummary(st);
  const counts = gradeCounts(app.deck.cards, app.progress, L);
  const nextDue = dueCount(app.deck.cards, app.progress, app.completed + 1);
  $('summary-title').textContent = st.practice ? '연습 결과' : `세션 ${st.session} 결과`;
  $('summary-body').replaceChildren(
    st.practice ? el('p', { class: 'source-note' }, '연습이라 상자와 일정은 바뀌지 않았습니다.') : null,
    el('dl', { class: 'stats', id: 'summary-stats', dataset: { right: String(s.right), total: String(s.total) } },
      el('dt', {}, '정답'), el('dd', {}, `${s.right} / ${s.total}`),
      el('dt', {}, '단서 없이 정답'), el('dd', {}, `${s.clean}장`),
      el('dt', {}, '단서 사용'), el('dd', {}, `관계 ${s.clueRelation} · 직접 ${s.clueDirect}`),
      el('dt', {}, '한 칸 차이 오답'), el('dd', {}, `${s.nearMiss}장`),
      el('dt', {}, '다시 풀기'), el('dd', { id: 'summary-retry' }, s.retried ? `${s.retryRight} / ${s.retried} 성공` : '없음'),
      el('dt', {}, '다음 세션 복습'), el('dd', { id: 'summary-due' }, `${nextDue}장`)),
    el('ol', { class: 'summary-list' }, st.placed.map((p) => {
      const c = app.cardsById.get(p.id);
      const clue = ['', ' · 관계 단서', ' · 직접 단서'][Math.min(p.clueUsed, 2)];
      return el('li', { dataset: { id: p.id } }, el('span', { class: p.correct ? 'ok' : 'bad' }, p.correct ? '○' : '✕'),
        ` ${c.title}${clue}${st.practice ? '' : ` · 상자 ${p.boxFrom ?? '새'}→${p.boxTo}`}`);
    })),
    el('p', { class: 'medals' }, `숙련(현재): 금 ${counts.gold} · 은 ${counts.silver} · 동 ${counts.bronze}`));
  $('summary-next').textContent = '다음 세션';
  $('summary').hidden = false;
  $('summary-next').focus();
}

function nextSession() {
  $('summary').hidden = true;
  startLearnSession();
  $('card').focus();
}

/* ------------------------------------------------------------------ 숙련 도감, 오답 노트, 기록 */

function openDogam() {
  const counts = gradeCounts(app.deck.cards, app.progress, L);
  $('dogam-counts').textContent = `현재 등급: 금 ${counts.gold} · 은 ${counts.silver} · 동 ${counts.bronze} · 학습 중 ${counts.none} · 미학습 ${counts.unseen}`;
  $('dogam-counts').dataset.gold = String(counts.gold);
  const cards = [...app.deck.cards].sort((a, b) => a.order - b.order);
  const s = sessionIndex();
  $('dogam-list').replaceChildren(...cards.map((c) => {
    const e = app.progress[c.id];
    const g = e?.introduced ? gradeOf(e, L) : -1;
    const key = g < 0 ? 'unseen' : GRADE_KEY[g];
    const wait = e?.introduced ? Math.max(0, e.due_session - s) : null;
    return el('li', { class: `dogam-row medal-${key}`, dataset: { id: c.id, mastery: key, best: String(e?.best_grade ?? 0) } },
      el('span', { class: 'medal' }, g < 0 ? '미학습' : (g === 0 ? '학습 중' : GRADE_NAME[g])),
      el('span', { class: 'dogam-main' },
        el('span', { class: 'dogam-title' }, e?.introduced ? c.title : '？？？'),
        el('span', { class: 'dogam-sub' }, e?.introduced
          ? `${shortYear(c)} · 상자 ${e.box} · ${wait === 0 ? '복습할 때' : `${wait}세션 뒤`} · 최고 ${GRADE_NAME[e.best_grade]} · 틀린 횟수 ${e.lapses}`
          : '아직 만나지 않은 카드')));
  }));
  // 오답 노트(§6)
  const note = wrongNoteIds(app.deck.cards, app.progress);
  $('note-list').replaceChildren(...(note.length ? note.map((id) => {
    const c = app.cardsById.get(id);
    return el('li', { dataset: { id } }, el('details', {}, el('summary', {}, `${c.title} · ${c.year_label}`), el('p', {}, c.explanation)));
  }) : [el('li', { class: 'source-note' }, '없음')]));
  $('btn-note-practice').disabled = note.length === 0;
  $('btn-note-practice').dataset.count = String(note.length);
  $('participant').value = app.participant;
  $('log-count').textContent = `인출 기록 ${app.log.length}줄`;
  $('dogam').hidden = false;
  $('dogam-close').focus();
}

/** 인출 로그 내보내기: 줄마다 JSON(JSONL), m1-plan §11 규격. */
function exportLog() {
  const body = app.log.map((l) => JSON.stringify(l)).join('\n') + (app.log.length ? '\n' : '');
  const blob = new Blob([body], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const a = el('a', { href: url, download: `m1-log-${app.participant}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.jsonl` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  openModal('학습 기록을 지울까요?', [el('p', {}, '상자, 등급, 세션 번호, 인출 기록이 모두 지워집니다. 필요하면 먼저 "기록 내보내기"를 하세요.')],
    [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
      el('button', { type: 'button', class: 'btn', id: 'reset-next', onclick: () => openModal('정말 모두 지울까요?', [el('p', {}, '되돌릴 수 없습니다.')],
        [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
          el('button', { type: 'button', class: 'btn btn-danger', id: 'reset-confirm', onclick: doReset }, '모두 지우기')], 'reset2') }, '계속')], 'reset1');
}

function doReset() {
  app.store.clear();
  app.progress = Object.freeze({});
  app.log = [];
  app.completed = 0;
  closeModal();
  $('dogam').hidden = true;
  startLearnSession();
  announce('학습 기록을 지웠습니다.');
}

/* ------------------------------------------------------------------ 끌어 놓기(마우스 보조), 참조 강조 */

function setupDrag() {
  const card = $('card');
  const ghost = $('drag-ghost');
  let start = null;
  let dragging = false;
  let over = null;
  const gapAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('#timeline .gap:not([disabled])') ?? null;
  const setOver = (g) => { if (over !== g) { over?.classList.remove('over'); over = g; over?.classList.add('over'); } };
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || app.lastResult || !app.state || !currentId(app.state) || e.target.closest('button')) return;
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
  const reset = () => { start = null; dragging = false; ghost.hidden = true; card.classList.remove('dragging'); setOver(null); };
  card.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const target = dragging ? gapAt(e.clientX, e.clientY) : null;
    reset();
    if (target) place(Number(target.dataset.gap));
  });
  card.addEventListener('pointercancel', (e) => { if (start && e.pointerId === start.id) reset(); });
}

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

async function init() {
  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  app.seedParam = Number.isFinite(seed) ? seed >>> 0 : 0;
  if (params.get('confirm') === '1') app.confirmMode = 'always';
  if (params.get('confirm') === '0') app.confirmMode = 'never';
  let loaded;
  try {
    const { url, raw } = await loadRaw(params.get('data') ? [params.get('data')] : CONFIG.dataUrls);
    const norm = normalizeDeck(raw);
    loaded = { url, deck: norm.deck, convErrors: norm.errors };
  } catch (e) {
    $('card').replaceChildren(el('p', {}, String(e.message)));
    document.body.dataset.ready = 'error';
    return;
  }
  const errs = [...loaded.convErrors, ...(loaded.deck ? validateDeck(loaded.deck) : [])];
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
  app.deckHash = fnv1a(app.dataId);
  const unverified = [...app.deck.cards, ...app.deck.anchors].some((c) => !c.verified);
  $('data-info').textContent = `데이터: ${app.dataFile} · 카드 ${app.deck.cards.length}장 · 기준 ${app.deck.anchors.length}장 · M1 프로토타입`;
  $('data-warn').textContent = unverified ? '사실 확인 전 카드입니다. 공부 자료로 믿지 마세요.' : '';

  const saved = app.store.load();
  const same = saved?.dataId === app.dataId;
  app.progress = same ? restoreProgress(saved.cards, app.deck.cards, L) : Object.freeze({});
  app.completed = same && Number.isInteger(saved.completed_sessions) && saved.completed_sessions >= 0 ? saved.completed_sessions : 0;
  app.log = same && Array.isArray(saved.log) ? saved.log : [];
  app.participant = (params.get('participant') || saved?.participant || '-').slice(0, 20);
  const restored = same ? restoreSession(saved.current, app.deck.cards) : null;

  setupDrag();
  setupRefs();
  $('btn-dogam').addEventListener('click', openDogam);
  const closeDogam = () => { $('dogam').hidden = true; $('btn-dogam').focus(); };
  $('dogam-close').addEventListener('click', closeDogam);
  $('btn-reset').addEventListener('click', confirmReset);
  $('btn-export').addEventListener('click', exportLog);
  $('btn-note-practice').addEventListener('click', () => startPractice('note', wrongNoteIds(app.deck.cards, app.progress)));
  $('participant').addEventListener('change', (e) => { app.participant = (e.target.value.trim() || '-').slice(0, 20); persist(); });
  $('summary-next').addEventListener('click', nextSession);
  $('summary-dogam').addEventListener('click', () => { $('summary').hidden = true; openDogam(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('modal').hidden) closeModal();
    else if (!$('dogam').hidden) closeDogam();
  });

  // §5 세션 카운트: 도중에 닫힌 학습 세션은 인출이 1장 이상이면 끝난 것으로 처리한다. 0장이면 이어서 한다. 연습은 버린다.
  if (restored && !restored.practice && attemptsOf(restored) >= L.count_session_min_answers) {
    app.completed = completedAfter(app.completed, restored, L);
    app.notice = `지난 세션 ${restored.session}을(를) ${attemptsOf(restored)}장으로 마쳤습니다.`;
    startLearnSession();
  } else if (restored && !restored.practice && restored.session === sessionIndex()) {
    app.state = restored;
    app.cardShownAt = performance.now();
    render();
  } else {
    startLearnSession();
  }
  if (app.notice) announce(app.notice);
  document.body.dataset.ready = 'true';
}

init();
