// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 화면: 위쪽 사료 카드, 아래쪽 왕대 연표. 칸(틈)을 눌러 꽂는다(데스크톱은 끌어 놓기도).
 * 규칙은 rules.js(leitner-spec), 수치는 config.js, 형식 변환은 data.js. 텍스트는 전부 textContent로 넣는다.
 */
import { CONFIG } from './config.js';
import { createStore } from './storage.js';
import { loadRaw, normalizeDeck, loadManifest, loadNationDeck } from './data.js';
import { nationStoreAdapter, lastNation } from './save.js';
import { dayKey, newRewards, restoreRewards, levelOf, settleSession, achievementDefs, achievementStats, currentTitle } from './rewards.js';
import { buildTimeline, correctGaps, slotAnchorId } from './rules.js';
import {
  validateDeck, gapBounds, selectableGaps, buildSession, createSessionState, currentId, revealClue, placeCurrent,
  sessionTimeline, isRetry, isSessionDone, attemptsOf, completedAfter, sessionSummary, gradeCounts, gradeOf, GRADE_NAME,
  dueCount, earlyReviewIds, wrongNoteIds, logLine, sessionSeed, previewBox, restoreProgress, restoreSession, dataFingerprint, fnv1a,
} from './rules.js';
import { armStoreAdapter, splitHalves, armIds } from './study.js';

const L = CONFIG.leitner;
const $ = (id) => document.getElementById(id);
/** replaceChildren은 null을 "null" 글자로 넣는다(B3). 자식 중 null·undefined·false를 거르고 넣는다. */
function fill(node, ...children) {
  node.replaceChildren(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
}
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
  /** 사람 테스트 모드의 방식 A 학습(`?study=1&stage=learn-A`)이면 {participant, cap, menuUrl}. */
  study: null,
  /** M2: 나라와 덱 목록, 보상(테스트 모드에서는 null). */
  nation: CONFIG.defaultNation, nations: [], rewards: null, lastReward: null, started: false, titleOn: false,
  rewardsStore: createStore(CONFIG.rewardsKey), slotOfCard: new Map(),
};
/** 보상 수치: config 기본값 위에 assets/data/config/rewards.json(init에서 읽음). */
let R = CONFIG.rewards;
const rewardsOn = () => !!app.rewards;

const sessionIndex = () => app.completed + 1;

function needsConfirm() {
  if (app.confirmMode === 'always') return true;
  if (app.confirmMode === 'never') return false;
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

/** 보상은 학습 저장과 다른 키(rewards-spec §8·§10). */
function saveRewards() {
  if (app.rewards) app.rewardsStore.save(app.rewards);
}

function persist() {
  app.store.save({
    format: 'hanyang-dogam-mastery', dataId: app.dataId, completed_sessions: app.completed, cards: app.progress,
    current: app.state, log: app.log, participant: app.participant,
  });
  saveRewards();
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
  if (app.study && app.completed >= app.study.cap) { app.state = null; render(); renderStudyDone(); return; }
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
  sessionRewards(st);
  showSummary(st);
  app.state = null;
  app.lastResult = null;
  persist();
}

/** 학습 세션을 마칠 때의 보상(세션 보너스·하루 목표·연속일·업적). 연습·0장은 없음. */
function sessionRewards(st) {
  app.lastReward = null;
  if (!rewardsOn() || !st || st.practice) return;
  const defs = achievementDefs(app.nation, app.deck.nation_label);
  const statsFor = (rw, sess) => achievementStats({
    cards: app.deck.cards, progress: app.progress, gradeOf: (e) => gradeOf(e, L), slotOf: (c) => app.slotOfCard.get(c.id),
    rewards: rw, session: sess, comeback: sess.comeback,
  });
  const { rewards, report } = settleSession(app.rewards, { sessionId: `${app.nation}:${st.session}`, records: st.placed, base: st.base }, statsFor, new Date(), R, defs);
  app.rewards = rewards;
  app.lastReward = report;
  saveRewards();
}

/* ------------------------------------------------------------------ 렌더 */

/** 테스트 모드: 방식 A 학습 단계를 다 했다. */
function renderStudyDone() {
  $('card').className = 'card card-empty';
  fill($('card'), 
    el('p', { class: 'empty-title', id: 'study-done' }, `학습 세션 ${app.study.cap}회를 마쳤습니다.`),
    el('p', { class: 'source-note' }, '진행자에게 알려 주세요.'),
    el('a', { class: 'btn btn-primary', id: 'btn-menu-done', href: app.study.menuUrl }, '진행자 메뉴로'));
}

function renderTop() {
  $('nation-label').textContent = app.study ? `방식 A · ${app.study.participant}` : (app.deck.nation_label ?? '');
  $('session-no').textContent = app.state?.practice ? '연습' : `세션 ${app.state?.session ?? sessionIndex()}`;
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
  const now = previewBox(e, true, app.state.clues, L);
  const parts = [`지금 맞히면 상자 ${box}→${now}`];
  if (e?.probation) parts.push(`재학습 중: 단서 없이 ${L.probation.clean_needed - (e.probation_clean ?? 0)}번 더 맞혀야 상자 2`);
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
  fill(box, ...[
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
      + (!r.correct && L.relearn_in_session ? ' · 이번 세션 끝에 한 번 더' : '')
      + (entry.probation ? ` · 재학습 표시: 단서 없이 ${L.probation.clean_needed - (entry.probation_clean ?? 0)}번 연속 맞히면 상자 2` : '');
  }
  const grade = entry?.introduced ? gradeOf(entry, L) : 0;
  const isLast = isSessionDone(app.state);
  fill(box, ...[
    el('div', { class: 'result-head', id: 'result', dataset: { result: r.correct ? 'correct' : 'wrong', near: r.nearMiss ? '1' : '0' } },
      el('span', { class: 'mark', 'aria-hidden': 'true' }, r.correct ? '○' : '✕'),
      r.correct ? '정답' : (r.nearMiss ? '오답 · 한 칸 차이' : '오답')),
    el('h3', { class: 'result-title' }, card.title),
    el('p', { class: 'result-meta' }, card.reign && !card.year_label.includes(card.reign) ? `${card.year_label} · ${card.reign}` : card.year_label),
    r.correct ? null : el('p', { class: 'result-where', id: 'result-where' }, '고른 칸: ', el('s', {}, r.placedText), el('br'), '맞는 칸: ', el('b', {}, r.rightText)),
    el('p', { class: 'result-box', id: 'result-box', dataset: { from: String(r.boxFrom ?? ''), to: String(r.boxTo ?? '') } },
      boxLine, !r.practice && !r.retry && grade ? ` · 등급 ${GRADE_NAME[grade]}` : ''),
    explainBlock(card, !app.study && r.correct && grade >= 2),
    el('button', { type: 'button', id: 'btn-next', class: 'btn btn-primary', onclick: onNext }, isLast ? (app.state.practice ? '연습 끝내기' : '세션 결과 보기') : '다음 카드'),
  ].filter(Boolean));
}

/**
 * 해설·수험 정리·출처. 숙련 카드(은 이상)를 맞혔으면 기본으로 접는다(D93: 세션 피로). 테스트 모드는 M1 그대로 펼침.
 */
function explainBlock(card, folded) {
  const body = [
    el('p', { class: 'result-exp' }, card.explanation),
    card.exam_note ? el('p', { class: 'result-note', id: 'result-note' }, el('b', {}, '수험 정리 '), card.exam_note) : null,
    el('p', { class: 'result-source', id: 'result-source' }, `출처: ${card.source?.name ?? ''}${card.source?.ref ? ' ' + card.source.ref : ''}`),
  ];
  if (!folded) return body;
  return el('details', { class: 'result-details', id: 'result-details' }, el('summary', {}, '해설 보기(숙련 카드)'), ...body);
}

/** 큐가 빈 세션(§5-4): 도래 카드와 새 카드를 모두 했다. */
function renderEmpty(box) {
  box.className = 'card card-empty';
  delete box.dataset.cardId;
  const early = earlyReviewIds(app.deck.cards, app.progress, L);
  fill(box, 
    el('p', { class: 'empty-title', id: 'empty-title' }, '오늘 도래한 카드를 모두 했습니다.'),
    app.notice ? el('p', { class: 'source-note', id: 'notice' }, app.notice) : null,
    app.study ? null : el('p', { class: 'source-note' }, '미리 복습은 연습이라 상자와 일정을 바꾸지 않습니다.'),
    el('div', { class: 'clue-bar' },
      early.length && !app.study ? el('button', { type: 'button', id: 'btn-early', class: 'btn', onclick: () => startPractice('early', early) }, `미리 복습 ${early.length}장`) : null,
      el('button', { type: 'button', id: 'btn-skip', class: 'btn btn-primary', onclick: skipSession }, '다음 세션으로')),
    el('p', { class: 'source-note' }, '"다음 세션으로"는 하루가 지난 것으로 칩니다(세션 번호 +1).'));
}

function renderCard() {
  const box = $('card');
  if (!app.state) { if (!app.study) fill(box); return; }
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
  let dock = null;
  // D93(M2 평가): 일반 모드는 칸 압축(앵커 한 줄, 틈 줄 없이 앵커 경계에 44px "+"). 테스트 모드는 M1 화면 그대로.
  const compact = !app.study;
  const gapButton = (k, pending, text) => el('button', {
    type: 'button', class: 'gap' + (pending ? ' gap-selected' : '') + (compact ? ' gap-compact' : ''), dataset: { gap: String(k) }, disabled: !asking,
    'aria-label': `${text} 칸에 꽂기`, 'aria-pressed': pending ? 'true' : null, onclick: () => onGap(k),
  }, el('span', { class: 'gap-plus', 'aria-hidden': 'true' }, pending ? '✓' : '＋'), compact ? null : el('span', { class: 'gap-label' }, pending ? '이 칸을 골랐습니다' : '이 칸에 꽂기'));
  /** 칸 k의 버튼(압축: 앵커 줄 안에 넣을 버튼, M1: 틈 줄). */
  const gap = (k, inline = false) => {
    if (!allowed.has(k)) return null;
    if (compact !== inline) return null;
    const pending = asking && app.pendingGap === k;
    const text = slotText(items, k);
    const btn = gapButton(k, pending, text);
    const row = compact ? btn : el('li', { class: 'gap-row' + (pending ? ' gap-pending' : '') }, btn);
    if (pending) {
      // B4: 확정 막대는 화면 아래 고정(연표 밖의 #confirm-dock, 위에 붙은 카드에 가리지 않게).
      dock = (el('div', { class: 'confirm-bar', id: 'confirm-bar' },
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
    if (it.kind === 'anchor' && compact) {
      const pending = asking && app.pendingGap === i + 1;
      nodes.push(el('li', { class: 'row row-anchor row-compact' + (pending ? ' gap-pending' : ''), dataset: { id: it.id, order: String(it.order) } },
        el('span', { class: 'row-year' }, c.reign_range ?? shortYear(c)),
        el('span', { class: 'row-main' }, el('span', { class: 'row-title' }, c.reign ?? c.title)),
        gap(i + 1, true)));
      if (!L.placedJoinTimeline) nodes.push(...inSlot(it.order, items[i + 1]?.order ?? null).map(placedRow));
    } else if (it.kind === 'anchor') {
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
  fill($('timeline'), ...nodes.filter(Boolean));
  $('timeline').classList.toggle('asking', asking);
  $('timeline').classList.toggle('compact', compact);
  fill($('confirm-dock'), dock);
  $('timeline-title').textContent = `${app.deck.nation_label ?? ''} 왕대 연표`;
  $('timeline-help').textContent = asking
    ? (compact
      ? (needsConfirm() ? '사건이 일어난 왕 줄의 ＋를 누른 뒤 "이 칸에 꽂기"로 확정하세요. ＋는 "이 왕 즉위 이후 ~ 다음 왕 즉위 이전"입니다.' : '사건이 일어난 왕 줄의 ＋를 누르세요(이 왕 즉위 이후 ~ 다음 왕 즉위 이전). 카드를 끌어 놓아도 됩니다.')
      : (needsConfirm() ? '사건이 들어갈 칸(＋)을 고른 뒤 "이 칸에 꽂기"를 누르세요.' : '사건이 들어갈 칸(＋)을 누르세요. 카드를 끌어 놓아도 됩니다.'))
    : '';
}

/** 좁은 화면(한 단 배치, 카드가 위에 붙음). */
const narrow = () => { try { return matchMedia('(max-width: 899px)').matches; } catch { return false; } };

function render() {
  // B4: 결과를 보일 때는 카드를 위에 붙이지 않고 펼친다(○/✕·고른 칸·맞는 칸·상자 줄이 잘리지 않게).
  document.body.classList.toggle('has-result', !!app.lastResult);
  renderTop();
  renderCard();
  renderTimeline();
}

/* ------------------------------------------------------------------ 동작 */

function onGap(k) {
  if (!needsConfirm()) { place(k); return; }
  app.pendingGap = k;
  renderTimeline();
  $('confirm-place')?.focus({ preventScroll: true });
  // B4: 고른 칸이 위에 붙은 카드나 아래 확정 막대에 가리지 않게.
  document.querySelector('.gap-pending')?.scrollIntoView?.({ block: narrow() ? 'end' : 'nearest' });
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
  $('btn-next').focus({ preventScroll: true });
  if (narrow()) window.scrollTo?.({ top: 0 });
  else document.querySelector('.row-new')?.scrollIntoView?.({ block: 'nearest' });
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

const KIND_TEXT = { clean: '깨끗한 정답', relation: '단서를 보고 맞힘', direct: '직접 힌트를 보고 맞힘', wrong: '해설을 읽어 보세요' };
const GRADE_LINE = ['', '동 등급이 되었어요', '은 등급', '금 등급'];

/**
 * 세션 결과의 보상 정산(design/ux/session-result.md, rewards-spec §6): 2 카드별 정산 → 3 하루 목표·연속일 → 4 레벨 →
 * 5 업적 → 6 다음 복습. 1(결과 요약)은 showSummary가 그린다. 사건이 없는 단계는 빠진다. 각 단계는 data-stage.
 */
function rewardStages(st) {
  const g = app.lastReward;
  const rw = app.rewards;
  const stages = [];
  if (g) {
    const lines = g.lines.map((l) => {
      const c = app.cardsById.get(l.id);
      return el('li', { class: 'settle', dataset: { id: l.id, kind: l.kind, xp: String(l.total) } },
        el('span', { class: 'settle-main' }, `${c?.title ?? l.id} · ${KIND_TEXT[l.kind]}`), el('b', { class: 'settle-xp' }, `+${l.xp}`),
        l.boxUp ? el('span', { class: 'settle-sub' }, `상자 ${l.boxFrom ?? 1} → ${l.boxTo} · +${l.boxXp}`) : null,
        ...l.grades.map((gr) => el('span', { class: 'settle-sub settle-grade' }, `${GRADE_LINE[gr]} · +${R.xp.grade_up[gr]}`)),
        (l.kind === 'relation' || l.kind === 'direct') ? el('span', { class: 'settle-hint' }, `깨끗하게 맞히면 +${R.xp.clean}`) : null,
        l.kind === 'wrong' && l.probation ? el('span', { class: 'settle-hint' }, '다음에 두 번 연속 맞히면 올라가요') : null);
    });
    const shown = lines.slice(0, 5);
    const more = lines.slice(5);
    const list = el('ul', { class: 'settle-list', id: 'settle-list' }, shown);
    stages.push(el('section', { class: 'stage', dataset: { stage: 'cards' }, id: 'stage-cards', 'aria-label': '카드별 정산' },
      el('h3', {}, '카드별 정산'), list,
      more.length ? el('button', { type: 'button', class: 'btn btn-small btn-quiet', id: 'settle-more', onclick: (e) => { list.append(...more); e.target.remove(); } }, `더 보기 (${more.length}장)`) : null,
      el('p', { class: 'settle-total', id: 'summary-xp', dataset: { xp: String(g.sessionXp) } }, `이번 세션 +${g.sessionXp} XP`)));
    if (g.goal) {
      const G = g.goal;
      stages.push(el('section', { class: 'stage', dataset: { stage: 'goal' }, id: 'stage-goal' },
        el('p', { id: 'summary-goal' }, `오늘 목표 달성 · +${G.xp}`),
        el('p', { id: 'summary-streak' }, G.broken ? `다시 오셨네요. 최고 연속 ${G.broken.best}일 · 오늘부터 1일째` : `연속 ${G.streak}일째예요`),
        G.usedPasses ? el('p', { id: 'summary-pass-used' }, `쉬는 날 보호권을 ${G.usedPasses}장 썼어요. 연속 ${G.streak}일이 이어졌어요`) : null,
        G.earnedPass ? el('p', { id: 'summary-pass-earned' }, `쉬는 날 보호권을 얻었어요 (${R.streak.rest_pass_max}장까지 모아요)`) : null));
    }
    const L2 = g.level;
    stages.push(el('section', { class: 'stage', dataset: { stage: 'level' }, id: 'stage-level' },
      L2.to > L2.from ? el('p', { id: 'summary-levelup' }, L2.to - L2.from > 1 ? `레벨 ${L2.from} → ${L2.to}` : `레벨 ${L2.to}이 되었어요`) : null,
      g.title.to !== g.title.from ? el('p', { id: 'summary-title-new' }, `새 칭호: ${g.title.to}`, el('br'), el('small', {}, '칭호는 도감에서 바꿀 수 있어요')) : null,
      levelBar(rw)));
    if (g.achievements.length) {
      const first = g.achievements.slice(0, 3);
      const rest = g.achievements.length - first.length;
      stages.push(el('section', { class: 'stage', dataset: { stage: 'ach' }, id: 'summary-achievements' },
        ...first.map((a) => el('p', { class: 'ach', dataset: { id: a.id } }, el('b', {}, `업적 · ${a.name}`), ` · ${a.desc}`)),
        rest > 0 ? el('p', { class: 'source-note', id: 'summary-ach-more' }, `그 밖에 ${rest}개 · 도감에서 확인해요`) : null));
    }
  }
  return stages;
}

/** 6단계 다음 복습(항상). */
function nextStage(st) {
  const plan = todayPlan();
  const g = app.lastReward;
  const lines = [];
  if (plan.mode === 'done') lines.push('오늘 할 카드를 모두 했어요');
  else lines.push(plan.due ? `다음 세션 복습 ${plan.due}장` : '다음 세션에는 새 카드부터 시작해요');
  if (g?.capped) lines.push('경험치는 하루 두 세션까지예요. 학습은 그대로 쌓여요');
  if (rewardsOn() && app.rewards.day.goal_met && app.rewards.day.sessions >= R.daily_session_soft_cap) lines.push('오늘은 충분히 했어요. 내일 이어서 해요');
  return { plan, node: el('section', { class: 'stage', dataset: { stage: 'next' }, id: 'stage-next' }, ...lines.map((t) => el('p', {}, t))) };
}

function levelBar(rw, extra = '', id = null) {
  const lv = levelOf(rw.xp, R);
  return el('div', { class: 'level', id, dataset: { level: String(lv.level) } },
    el('span', { class: 'level-name' }, `레벨 ${lv.level}`),
    el('span', { class: 'level-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(lv.need), 'aria-valuenow': String(lv.into), 'aria-label': `다음 레벨까지 ${lv.need - lv.into} XP` },
      el('span', { class: 'level-fill', style: `width:${Math.round((100 * lv.into) / lv.need)}%` })),
    el('span', { class: 'level-num' }, `${lv.into} / ${lv.need} XP${extra}`));
}

function showSummary(st) {
  if (rewardsOn() && !st.practice) { showRewardSummary(st); return; }
  const s = sessionSummary(st);
  const counts = gradeCounts(app.deck.cards, app.progress, L);
  const nextDue = dueCount(app.deck.cards, app.progress, app.completed + 1);
  $('summary-title').textContent = st.practice ? '연습 결과' : `세션 ${st.session} 결과`;
  fill($('summary-body'), 
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
  const studyEnd = app.study && app.completed >= app.study.cap;
  $('summary-next').textContent = studyEnd ? '학습 단계 끝 · 진행자 메뉴로' : '다음 세션';
  $('summary-next').dataset.end = studyEnd ? '1' : '0';
  $('summary-dogam').hidden = !!app.study;
  for (const id of ['summary-skip', 'summary-step', 'summary-home']) $(id).hidden = true;
  $('summary-next').hidden = false;
  $('summary-next').disabled = false;
  $('summary').hidden = false;
  $('summary-next').focus();
}

/** 일반 모드의 세션 결과: 1 결과 요약 → 보상 단계들 → 다음 복습. 탭(계속)으로 한 단계씩, 건너뛰기로 끝까지. */
function showRewardSummary(st) {
  const s = sessionSummary(st);
  const clued = s.right - s.clean;
  $('summary-title').textContent = `오늘의 세션 · ${app.deck.nation_label ?? ''}`;
  const head = el('section', { class: 'stage stage-head', dataset: { stage: 'summary' }, id: 'stage-summary' },
    el('p', { class: 'big-score', id: 'summary-stats', dataset: { right: String(s.right), total: String(s.total) } }, `정답 ${s.right} / ${s.total}`),
    el('p', { id: 'summary-breakdown' }, `깨끗한 정답 ${s.clean} · 단서를 쓴 정답 ${clued} · 오답 ${s.total - s.right}`),
    s.retried ? el('p', { id: 'summary-retry' }, `다시 풀기 ${s.retried}장 중 ${s.retryRight}장 성공`) : null);
  const next = nextStage(st);
  const stages = [head, ...rewardStages(st), next.node];
  fill($('summary-body'), stages);
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let shown = reduce ? stages.length : 1;
  const finalButtons = () => {
    $('summary-skip').hidden = true;
    $('summary-step').hidden = true;
    $('summary-next').hidden = false;
    $('summary-home').hidden = false;
    $('summary-dogam').hidden = false;
    const done = next.plan.mode === 'done';
    $('summary-next').textContent = done ? '오늘은 여기까지' : '다음 세션';
    $('summary-next').disabled = done;
    $('summary-next').dataset.end = '0';
    (done ? $('summary-home') : $('summary-next')).focus();
  };
  const update = () => {
    stages.forEach((n, i) => { n.hidden = i >= shown; });
    $('summary-body').dataset.shown = String(shown);
    $('summary-body').dataset.total = String(stages.length);
    if (shown >= stages.length) finalButtons();
    else {
      for (const id of ['summary-next', 'summary-home', 'summary-dogam']) $(id).hidden = true;
      $('summary-skip').hidden = false;
      $('summary-step').hidden = false;
    }
    const last = stages[shown - 1];
    if (shown > 1) { last.scrollIntoView?.({ block: 'nearest' }); announce(last.innerText.split('\n').slice(0, 2).join(' ')); }
  };
  $('summary-step').onclick = () => { shown = Math.min(stages.length, shown + 1); update(); if (shown < stages.length) $('summary-step').focus(); };
  $('summary-skip').onclick = () => { shown = stages.length; update(); announce('정산을 모두 보였어요.'); };
  $('summary').hidden = false;
  update();
  if (shown < stages.length) $('summary-skip').focus();
}

function nextSession() {
  if (app.study && app.completed >= app.study.cap) { location.assign(app.study.menuUrl); return; }
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
  fill($('dogam-list'), ...cards.map((c) => {
    const e = app.progress[c.id];
    const g = e?.introduced ? gradeOf(e, L) : -1;
    const key = g < 0 ? 'unseen' : GRADE_KEY[g];
    const wait = e?.introduced ? Math.max(0, e.due_session - s) : null;
    return el('li', { class: `dogam-row medal-${key}`, dataset: { id: c.id, mastery: key, best: String(e?.best_grade ?? 0) } },
      el('span', { class: 'medal' }, g < 0 ? '미학습' : (g === 0 ? '학습 중' : GRADE_NAME[g])),
      el('span', { class: 'dogam-main' },
        el('span', { class: 'dogam-title' }, e?.introduced ? c.title : '？？？'),
        el('span', { class: 'dogam-sub' }, e?.introduced
          ? `${shortYear(c)} · 상자 ${e.box}${e.probation ? '(재학습)' : ''} · ${wait === 0 ? '복습할 때' : `${wait}세션 뒤`} · 최고 ${GRADE_NAME[e.best_grade]} · 틀린 횟수 ${e.lapses}`
          : '아직 만나지 않은 카드')));
  }));
  // 오답 노트(§6)
  const note = wrongNoteIds(app.deck.cards, app.progress);
  fill($('note-list'), ...(note.length ? note.map((id) => {
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
  fill($('modal-body'), ...body);
  fill($('modal-actions'), ...actions);
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
  if (app.rewards) { app.rewards = newRewards(); app.rewardsStore.clear(); }
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

/* ------------------------------------------------------------------ 처음 안내(30초) */

const INTRO = [
  ['사료를 읽습니다', '위 카드는 이름을 숨긴 사료 지문입니다. 읽고 어느 왕 때의 일인지 떠올려 보세요.'],
  ['칸을 고릅니다', '아래 왕대 연표에서 사건이 들어갈 칸(＋)을 고릅니다. 칸은 "이 왕 즉위 이후 ~ 다음 왕 즉위 이전"입니다. 휴대폰에서는 칸을 누른 뒤 "이 칸에 꽂기"로 확정합니다.'],
  ['단서는 승급을 늦춥니다', '막히면 단서를 볼 수 있습니다. 대신 상자(복습 간격)가 덜 오릅니다. 처음 보는 카드를 찍어서 틀리면 재학습 표시가 붙어 오히려 더 오래 걸리니, 모르면 단서가 낫습니다.'],
  ['틀린 카드는 다시 나옵니다', '틀린 카드는 세션 끝에 한 번 더, 다음 세션에도 다시 나옵니다. 맞힐수록 상자가 올라 더 드물게 나옵니다.'],
];
let introStep = 0;

function introSeen() { try { return localStorage.getItem(CONFIG.introKey) === '1'; } catch { return false; } }
function markIntroSeen() { try { localStorage.setItem(CONFIG.introKey, '1'); } catch { /* 무시 */ } }

function showIntro(step = 0) {
  introStep = step;
  const [title, body] = INTRO[step];
  $('intro-step').textContent = `처음 안내 ${step + 1} / ${INTRO.length}`;
  $('intro-title').textContent = title;
  $('intro-body').textContent = body;
  $('intro-next').textContent = step === INTRO.length - 1 ? '시작하기' : '다음';
  $('intro').dataset.step = String(step);
  $('intro').hidden = false;
  $('intro-next').focus();
}

function closeIntro() {
  $('intro').hidden = true;
  markIntroSeen();
  $('card').focus();
}

/* ------------------------------------------------------------------ 시작 */

async function init() {
  const params = new URLSearchParams(location.search);
  // 사람 테스트 모드: 방식 A 학습만 이 화면을 쓰고, 나머지(진행자 설정·방식 B·테스트)는 study-ui.js.
  if (params.get('study') === '1') {
    if (params.get('stage') !== 'learn-A') { (await import('./study-ui.js')).start(params); return; }
    const pid = params.get('participant') ?? '';
    const menuUrl = studyMenuUrl(params);
    const studyStore = createStore(CONFIG.study.storagePrefix + pid);
    if (!studyStore.load()) { location.replace(menuUrl); return; }
    app.study = { participant: pid, cap: CONFIG.study.sessionsPerArm, menuUrl, studyStore };
    app.store = armStoreAdapter(studyStore, 'A', CONFIG.study.sessionsPerArm);
  }
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  app.seedParam = Number.isFinite(seed) ? seed >>> 0 : 0;
  if (params.get('confirm') === '1') app.confirmMode = 'always';
  if (params.get('confirm') === '0') app.confirmMode = 'never';
  let loaded;
  try {
    loaded = await loadDeck(params);
  } catch (e) {
    fill($('card'), el('p', {}, String(e.message)));
    document.body.dataset.ready = 'error';
    return;
  }
  const errs = [...loaded.convErrors, ...(loaded.deck ? validateDeck(loaded.deck) : [])];
  if (errs.length) {
    fill($('card'), el('p', {}, `데이터 오류 ${errs.length}건`), el('ul', {}, errs.slice(0, 10).map((x) => el('li', {}, x))));
    document.body.dataset.ready = 'error';
    return;
  }
  app.deck = loaded.deck;
  app.dataId = dataFingerprint(loaded.url, app.deck);
  if (app.study) {
    const save = app.study.studyStore.load();
    if (save.dataId !== app.dataId) {
      fill($('card'), el('p', {}, '데이터가 이 참가자를 만들 때와 다릅니다. 진행자 메뉴에서 확인하세요.'), el('a', { class: 'btn', href: app.study.menuUrl }, '진행자 메뉴로'));
      document.body.dataset.ready = 'error';
      return;
    }
    const keep = new Set(armIds(splitHalves(app.deck.cards, CONFIG.study.halves), save.assignment, 'A'));
    app.deck = { ...app.deck, cards: app.deck.cards.filter((c) => keep.has(c.id)) };
  }
  app.dataFile = loaded.label;
  app.cardsById = new Map(app.deck.cards.map((c) => [c.id, c]));
  app.anchorsById = new Map(app.deck.anchors.map((a) => [a.id, a]));
  app.deckHash = fnv1a(app.dataId);
  const unverified = [...app.deck.cards, ...app.deck.anchors].some((c) => !c.verified);
  $('data-info').textContent = `데이터: ${app.dataFile} · 카드 ${app.deck.cards.length}장 · 기준 ${app.deck.anchors.length}장 · ${app.study ? 'M1 사람 테스트' : 'M2 프로토타입'}`;
  $('data-warn').textContent = unverified ? '사실 확인 전 카드입니다. 공부 자료로 믿지 마세요.' : '';

  const saved = app.store.load();
  // M2: 진행은 카드 id 기준이라 덱 파일이 늘거나 바뀌어도 유지한다(테스트 모드는 위에서 데이터 일치를 이미 확인).
  app.progress = restoreProgress(saved?.cards, app.deck.cards, L);
  app.completed = Number.isInteger(saved?.completed_sessions) && saved.completed_sessions >= 0 ? saved.completed_sessions : 0;
  app.log = Array.isArray(saved?.log) ? saved.log : [];
  if (!app.study && R.enabled) {
    R = await loadRewardsConfig();
    // 보상은 별도 키. 없으면 골격(D82) 때 학습 저장 안에 있던 rewards를 옮긴다.
    const own = app.rewardsStore.load();
    app.rewards = restoreRewards(own ?? saved?.rewards ?? null);
    const t = buildTimeline(app.deck.anchors, []);
    app.slotOfCard = new Map(app.deck.cards.map((c) => [c.id, slotAnchorId(t, correctGaps(t, c.order)[0])]));
  } else app.rewards = null;
  app.participant = app.study ? app.study.participant : (params.get('participant') || saved?.participant || '-').slice(0, 20);
  const restored = restoreSession(saved?.current, app.deck.cards);

  setupDrag();
  setupRefs();
  if (app.study) {
    $('btn-dogam').replaceWith(el('a', { class: 'btn btn-small', id: 'btn-menu', href: app.study.menuUrl }, '진행자'));
    $('btn-home').hidden = true;
    $('summary-dogam').hidden = true;
  }
  $('btn-dogam')?.addEventListener('click', openDogam);
  const closeDogam = () => { $('dogam').hidden = true; $('btn-dogam')?.focus(); };
  $('dogam-close').addEventListener('click', closeDogam);
  $('btn-reset').addEventListener('click', confirmReset);
  $('btn-intro').addEventListener('click', () => { $('dogam').hidden = true; showIntro(0); });
  $('intro-skip').addEventListener('click', closeIntro);
  $('intro-next').addEventListener('click', () => (introStep >= INTRO.length - 1 ? closeIntro() : showIntro(introStep + 1)));
  $('btn-export').addEventListener('click', exportLog);
  $('btn-note-practice').addEventListener('click', () => startPractice('note', wrongNoteIds(app.deck.cards, app.progress)));
  $('participant').addEventListener('change', (e) => { app.participant = (e.target.value.trim() || '-').slice(0, 20); persist(); });
  $('summary-next').addEventListener('click', nextSession);
  $('summary-dogam').addEventListener('click', () => { $('summary').hidden = true; openDogam(); });
  $('summary-home').addEventListener('click', () => { $('summary').hidden = true; showTitle(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('intro').hidden) closeIntro();
    else if (!$('modal').hidden) closeModal();
    else if (!$('dogam').hidden) closeDogam();
  });

  // §5 세션 카운트: 도중에 닫힌 학습 세션은 인출이 1장 이상이면 끝난 것으로 처리한다. 0장이면 이어서 한다. 연습은 버린다.
  if (restored && !restored.practice && attemptsOf(restored) >= L.count_session_min_answers) {
    app.completed = completedAfter(app.completed, restored, L);
    sessionRewards(restored);
    app.notice = `지난 세션 ${restored.session}을(를) ${attemptsOf(restored)}장으로 마쳤습니다.`;
    persist();
  } else if (restored && !restored.practice && restored.session === sessionIndex()) {
    app.state = restored;
  }
  const introParam = params.get('intro');
  const wantIntro = !app.study && (introParam === '1' || (introParam !== '0' && !introSeen()));
  $('btn-home')?.addEventListener('click', showTitle);
  if (app.study || params.get('title') === '0') {
    enterLearning();
    if (wantIntro) showIntro(0);
  } else {
    setupTitle(wantIntro, params);
    showTitle();
  }
  document.body.dataset.ready = 'true';
}

/** 학습 화면으로 들어간다(처음이면 세션을 만들고, 진행 중이면 그대로). */
function enterLearning() {
  hideTitle();
  if (!app.started) {
    app.started = true;
    if (app.state) { app.cardShownAt = performance.now(); render(); } else startLearnSession();
    if (app.notice) announce(app.notice);
  } else {
    render();
  }
}

/** rewards.json(rewards-spec §9)을 config 기본값 위에 얹는다. 없거나 읽지 못하면 기본값. */
async function loadRewardsConfig() {
  try {
    const { raw } = await loadRaw(CONFIG.rewardsUrls);
    const merged = { ...CONFIG.rewards };
    for (const [k, v] of Object.entries(raw ?? {})) {
      if (k.startsWith('_') || !(k in CONFIG.rewards)) continue;
      merged[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...CONFIG.rewards[k], ...v } : v;
    }
    return merged;
  } catch { return CONFIG.rewards; }
}

/* ------------------------------------------------------------------ 덱 읽기(M2) */

/**
 * 일반 모드: 덱 목록(manifest)에서 나라를 골라 그 나라 파일을 모두 합쳐 읽는다. manifest가 없으면 dataUrls의 파일 하나.
 * 테스트 모드: config.study.dataUrls(M1 파일)로 고정. `?data=경로`는 어느 모드든 그 파일 하나.
 * @returns {{url, label, deck, convErrors}}
 */
async function loadDeck(params) {
  const one = async (urls) => {
    const { url, raw } = await loadRaw(urls);
    const norm = normalizeDeck(raw);
    return { url, label: url.split('/').pop(), deck: norm.deck, convErrors: norm.errors };
  };
  if (app.study) return one(params.get('data') ? [params.get('data')] : CONFIG.study.dataUrls);
  try {
    // `?manifest=경로`: 덱 목록을 바꿔 끼운다(나라가 늘 때의 화면을 미리 확인하는 테스트용, D100).
    const m = await loadManifest(params.get('manifest') ? [params.get('manifest')] : CONFIG.manifestUrls);
    app.nations = m.nations;
  } catch { app.nations = []; }
  if (params.get('data')) {
    const r = await one([params.get('data')]);
    app.nation = r.deck?.nation ?? CONFIG.defaultNation;
    app.store = nationStoreAdapter(app.store, app.nation, CONFIG.defaultNation);
    return r;
  }
  const want = params.get('nation') ?? lastNation(app.store, CONFIG.defaultNation);
  const usable = app.nations.filter((n) => n.files.length);
  const nation = usable.find((n) => n.id === want) ?? usable.find((n) => n.id === CONFIG.defaultNation) ?? usable[0];
  if (!nation) {
    const r = await one(CONFIG.dataUrls);
    app.nation = r.deck?.nation ?? CONFIG.defaultNation;
    app.store = nationStoreAdapter(app.store, app.nation, CONFIG.defaultNation);
    return r;
  }
  app.nation = nation.id;
  app.store = nationStoreAdapter(app.store, nation.id, CONFIG.defaultNation);
  const norm = await loadNationDeck(nation);
  const files = nation.files.map((f) => f.split('/').pop());
  return { url: `${nation.id}:${files.join('+')}`, label: `${nation.label} ${files.join(', ')}`, deck: norm.deck, convErrors: norm.errors };
}

/* ------------------------------------------------------------------ 타이틀(M2, 일반 모드만) */

let titleWantsIntro = false;

function setupTitle(wantIntro, params) {
  titleWantsIntro = wantIntro;
  $('title-play').addEventListener('click', () => {
    enterLearning();
    if (titleWantsIntro) { titleWantsIntro = false; showIntro(0); }
  });
  $('title-dogam').addEventListener('click', openDogam);
  $('title-howto').addEventListener('click', () => { titleWantsIntro = false; showIntro(0); });
  const nations = app.nations.length ? app.nations : [{ id: app.nation, label: app.deck.nation_label ?? app.nation, files: ['-'] }];
  fill($('title-nations'), nations.map((n) => el('button', {
    type: 'button', class: 'chip nation', dataset: { nation: n.id }, 'aria-pressed': n.id === app.nation ? 'true' : 'false', disabled: !n.files.length,
    onclick: () => {
      if (n.id === app.nation) return;
      const q = new URLSearchParams(params);
      q.set('nation', n.id);
      q.delete('data');
      location.assign(`?${q}`);
    },
  }, n.label, n.files.length ? null : el('span', { class: 'nation-soon' }, ' 준비 중'))));
}

/**
 * 타이틀의 오늘 할 일(D93·D102): 진행 중 세션이 있으면 남은 장수, 없으면 다음 세션 구성 미리 보기(같은 시드라 실제와 같다).
 * @returns {{mode: 'continue'|'review'|'new'|'done', due: number, fresh: number, left: number}}
 */
function todayPlan() {
  if (app.state && currentId(app.state)) {
    const left = app.state.queue.length - app.state.index;
    return { mode: 'continue', due: 0, fresh: 0, left };
  }
  const s = sessionIndex();
  const pick = buildSession(app.deck.cards, app.progress, s, L, sessionSeed(app.deckHash, s, app.seedParam));
  const mode = pick.due ? 'review' : pick.fresh ? 'new' : 'done';
  return { mode, due: pick.due, fresh: pick.fresh, left: pick.due + pick.fresh };
}

function showTitle() {
  app.titleOn = true;
  document.body.classList.add('on-title');
  $('title').hidden = false;
  const learned = app.deck.cards.filter((c) => app.progress[c.id]?.introduced).length;
  const counts = gradeCounts(app.deck.cards, app.progress, L);
  const plan = todayPlan();
  const mins = Math.max(1, Math.ceil((plan.left * CONFIG.secondsPerCard) / 60));
  const today = {
    continue: `이어서 ${plan.left}장 남음 · 약 ${mins}분`,
    review: `오늘 복습 ${plan.due}장 · 새 카드 ${plan.fresh}장 · 약 ${mins}분`,
    new: `오늘 복습 0장 · 새 카드 ${plan.fresh}장 · 약 ${mins}분`,
    done: '오늘 할 카드를 모두 했습니다. 미리 복습은 연습입니다.',
  }[plan.mode];
  const label = { continue: `이어하기 · ${plan.left}장 남음`, review: '복습 시작', new: '새 카드 시작', done: '오늘 끝 · 미리 복습' }[plan.mode];
  $('title-today').textContent = today;
  Object.assign($('title-today').dataset, { mode: plan.mode, due: String(plan.due), fresh: String(plan.fresh), left: String(plan.left), minutes: String(mins) });
  $('title-play').textContent = label;
  $('title-play').dataset.mode = plan.mode;
  $('title-play').classList.toggle('btn-primary', plan.mode !== 'done');
  const rw = app.rewards;
  fill($('title-stats'),
    el('p', { id: 'title-progress' }, `${app.deck.nation_label ?? ''} 카드 ${app.deck.cards.length}장 중 ${learned}장 학습 · 금 ${counts.gold} · 은 ${counts.silver} · 동 ${counts.bronze}`),
    rw ? el('p', { id: 'title-name-line', class: 'title-honor' }, currentTitle(rw, R)) : null,
    rw ? levelBar(rw, ` · 연속 ${rw.streak}일${rw.day.goal_met && rw.day.key === dayKey(new Date(), R.streak.day_rollover_hour) ? ' · 오늘 목표 달성' : ''}`, 'title-meta') : null);
  $('title-play').focus();
}

function hideTitle() {
  app.titleOn = false;
  document.body.classList.remove('on-title');
  $('title').hidden = true;
}

/** 진행자 메뉴 주소(참가자·데이터·시드 파라미터를 유지). */
function studyMenuUrl(params) {
  const q = new URLSearchParams();
  q.set('study', '1');
  for (const k of ['participant', 'data', 'seed', 'confirm']) if (params.get(k)) q.set(k, params.get(k));
  return `?${q}`;
}

init();
