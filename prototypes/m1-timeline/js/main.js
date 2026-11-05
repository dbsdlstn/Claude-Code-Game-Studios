// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 화면: 위쪽 사료 카드, 아래쪽 왕대 연표. 칸(틈)을 눌러 꽂는다(데스크톱은 끌어 놓기도).
 * 규칙은 rules.js(leitner-spec), 수치는 config.js, 형식 변환은 data.js. 텍스트는 전부 textContent로 넣는다.
 */
import { CONFIG } from './config.js';
import { createStore } from './storage.js';
import { loadRaw, normalizeDeck, loadManifest, loadNationDeck } from './data.js';
import { nationStoreAdapter, lastNation, migrateSave } from './save.js';
import { dayKey, dayDiff, newRewards, restoreRewards, levelOf, settleSession, achievementDefs, achievementStats, currentTitle } from './rewards.js';
import { titleForLevel } from './rewards.js';
import { buildTimeline, correctGaps, slotAnchorId } from './rules.js';
import {
  validateDeck, gapBounds, selectableGaps, buildSession, createSessionState, currentId, revealClue, placeCurrent,
  sessionTimeline, isRetry, isSessionDone, attemptsOf, completedAfter, sessionSummary, gradeCounts, gradeOf, GRADE_NAME,
  dueCount, earlyReviewIds, wrongNoteIds, logLine, sessionSeed, previewBox, restoreProgress, restoreSession, dataFingerprint, fnv1a,
} from './rules.js';
import { armStoreAdapter, splitHalves, armIds } from './study.js';

/** Leitner 설정: 테스트 모드는 CONFIG.leitner(M1 덮어쓰기), 일반 모드는 CONFIG.leitnerGeneral(명세 기본값 + D94, D95). init에서 고른다. */
let L = CONFIG.leitner;
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
  rewardsStore: createStore(CONFIG.rewardsKey), slotOfCard: new Map(), nationDecks: new Map(),
  dogam: { tab: 'cards', nation: null, filter: 'all', achFilter: 'all', collapsed: new Set() },
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
    current: app.state, log: app.log, participant: app.participant, first_day: app.firstDay ?? null,
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

/* ------------------------------------------------------------------ 이벤트 로그(m2-plan §8, D108) */

/** 일반 모드만. 테스트 모드의 로그 규격(m1-plan §11)은 바꾸지 않는다. 사용자 입력 텍스트는 넣지 않는다. */
const ev = { openAt: 0, taps: 0, firstCard: false, sessionAt: 0, result: null, clueAt: null };
function logEvent(event, fields = {}) {
  if (app.study) return;
  app.log = [...app.log, { ts_ms: Date.now(), participant: app.participant, event, ...fields }];
}
function dayIndex() {
  if (!app.firstDay) return 0;
  return Math.max(0, dayDiff(app.firstDay, dayOpts().today));
}
function daySessionN() {
  const rw = app.rewards;
  return (rw && rw.day.key === dayOpts().today ? rw.day.sessions : 0) + 1;
}

function startLearnSession() {
  if (app.study && app.completed >= app.study.cap) { app.state = null; render(); renderStudyDone(); return; }
  const s = sessionIndex();
  app.lastFinished = null;
  const pick = buildSession(app.deck.cards, app.progress, s, L, sessionSeed(app.deckHash, s, app.seedParam), dayOpts());
  app.state = createSessionState(s, pick.ids, { kind: 'learn', mix: { due: pick.due, fresh: pick.fresh } });
  app.lastResult = null;
  app.pendingGap = null;
  app.cardShownAt = performance.now();
  ev.sessionAt = Date.now();
  ev.clueAt = null;
  if (pick.ids.length) logEvent('session_start', { session: s, nation: app.nation, cards_n: pick.ids.length, due_n: pick.due, new_n: pick.fresh, intake_guard: !!pick.guarded, day_sessions_n: daySessionN() });
  persist();
  render();
}

function startPractice(kind, ids) {
  logEvent('practice_start', { kind });
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
function finishSession(endedBy = 'complete') {
  const st = app.state;
  if (!st) return;
  if (!st.practice && attemptsOf(st)) logEvent('session_end', { session: st.session, duration_ms: ev.sessionAt ? Date.now() - ev.sessionAt : null, answered_n: attemptsOf(st), ended_by: endedBy });
  app.completed = completedAfter(app.completed, st, L);
  app.lastFinished = st.practice ? null : st.session;
  sessionRewards(st);
  showSummary(st);
  app.state = null;
  app.lastResult = null;
  persist();
}

/** 같은 날 재출제 금지(D94)에 쓰는 오늘과 날짜 함수(보상과 같은 하루 기준: 오전 3시). */
function dayOpts() {
  const h = R.streak?.day_rollover_hour ?? 3;
  return { today: dayKey(new Date(), h), dayOf: (iso) => dayKey(new Date(iso), h) };
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
  if (report) {
    const parts = {};
    for (const l of report.lines) { parts[l.kind] = (parts[l.kind] ?? 0) + l.xp; parts.box_up = (parts.box_up ?? 0) + l.boxXp; parts.grade = (parts.grade ?? 0) + l.gradeXp; parts.release = (parts.release ?? 0) + l.releaseXp; }
    if (report.goal) parts.daily_goal = report.goal.xp;
    logEvent('reward_settle', {
      session: st.session, xp_gained: report.sessionXp, xp_parts: Object.entries(parts).filter(([, v]) => v).map(([k, v]) => ({ k, v })), xp_total: rewards.xp,
      level_before: report.level.from, level_after: report.level.to, goal_met: !!report.goal, streak: rewards.streak, rest_pass_used: report.goal?.usedPasses ?? 0,
      achievements_new: report.achievements.map((a) => a.id), xp_capped: report.capped,
      changed_n: report.lines.filter((l) => l.changed).length, unchanged_n: report.lines.filter((l) => !l.changed).length,
    });
  }
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
  // 결과 화면 동안 머리글은 방금 끝난 세션(session-result.md §2.1)
  $('session-no').textContent = app.state?.practice ? '연습' : `세션 ${app.state?.session ?? app.lastFinished ?? sessionIndex()}`;
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

/** 단서 버튼 줄. extra(세션 끝내기)를 같은 줄에 둬 위에 붙은 카드 아래에서 잘리지 않게(디렉터 지적). */
function clueBar(card, extra = null) {
  const n = app.state.clues;
  const max = card.clues.length;
  return el('div', { class: 'clue-bar' },
    el('button', {
      type: 'button', id: 'btn-clue', class: 'btn', disabled: n >= max,
      onclick: () => { if (ev.clueAt === null) ev.clueAt = Math.round(performance.now() - app.cardShownAt); app.state = revealClue(app.state, max); persist(); renderCard(); $('btn-clue')?.focus(); },
    }, n >= max ? '단서를 모두 봤습니다' : `단서 보기 (${n + 1}/${max})`),
    extra,
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
  if (!ev.firstCard && !app.study && !app.titleOn) {
    ev.firstCard = true;
    logEvent('first_card_shown', { ms_since_open: Math.round(performance.now() - ev.openAt), taps_since_open: ev.taps });
  }
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
    clueBar(card, app.state.practice ? null : el('button', { type: 'button', id: 'btn-end', class: 'btn btn-small btn-quiet', onclick: confirmEnd }, '세션 끝내기')),
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
  const line = logLine({ ts: now.getTime(), participant: app.participant, result, session: app.state.session, msOnCard: Math.round(performance.now() - app.cardShownAt) });
  // m2-plan §8: 일반 모드 인출 줄에 나라·날짜·그날 세션 순번·단서를 연 시점(테스트 모드 규격은 그대로)
  if (!app.study) Object.assign(line, { nation: app.nation, day_index: dayIndex(), day_session_n: daySessionN(), clue_open_ms: ev.clueAt });
  app.log = [...app.log, line];
  ev.clueAt = null;
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
  ev.clueAt = null;
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
    el('button', { type: 'button', class: 'btn btn-primary', id: 'end-confirm', onclick: () => { closeModal(); finishSession('end_button'); render(); } }, '끝내기')], 'end');
}

/** 큐가 빈 상태에서 다음 세션으로(하루 경과). §5 세션 카운트의 예외(D66). */
function skipSession() {
  app.completed += 1;
  app.notice = '';
  startLearnSession();
}

const KIND_TEXT = { clean: '깨끗한 정답', relation: '단서를 보고 맞힘', direct: '직접 단서를 보고 맞힘', wrong: '해설을 읽어 보세요' };
const GRADE_LINE = ['', '동 등급이 되었어요', '은 등급', '금 등급'];

/**
 * 세션 결과(한 화면, rewards-spec §6·session-result.md D128): A 결과 요약 → B 다음 복습 + [다음 세션] → C 이번 세션 XP →
 * D 바뀐 카드만 → E 하루 목표·연속 → F 레벨 → G 업적. 사건이 없는 블록은 빠진다. 블록은 data-stage.
 */
function settleLine(l, capped, hintState) {
  const c = app.cardsById.get(l.id);
  const subs = [];
  const from = l.boxFrom ?? 1;
  if (l.boxTo !== null && l.boxTo !== from) subs.push(el('span', { class: 'settle-sub' }, `상자 ${from} → ${l.boxTo}${l.boxUp ? ` · +${l.boxXp}` : ''}`));
  if (l.released) subs.push(el('span', { class: 'settle-sub settle-grade' }, `지난번 틀린 카드를 이겨 냈어요 · +${l.releaseXp}`));
  for (const gr of l.grades) subs.push(el('span', { class: 'settle-sub settle-grade' }, `${GRADE_LINE[gr]} · +${R.xp.grade_up[gr]}`));
  if (l.newProbation) subs.push(el('span', { class: 'settle-hint' }, '다음에 두 번 연속 맞히면 올라가요'));
  if ((l.kind === 'relation' || l.kind === 'direct') && !hintState.shown) { hintState.shown = true; subs.push(el('span', { class: 'settle-hint', id: 'settle-clue-hint' }, `깨끗하게 맞히면 +${R.xp.clean}`)); }
  return el('li', { class: 'settle', dataset: { id: l.id, kind: l.kind, xp: String(l.total), changed: l.changed ? '1' : '0' } },
    el('span', { class: 'settle-main' }, `${c?.title ?? l.id} · ${KIND_TEXT[l.kind]}`), capped ? el('span') : el('b', { class: 'settle-xp' }, `+${l.xp}`), ...subs);
}

function rewardBlocks() {
  const g = app.lastReward;
  const rw = app.rewards;
  const blocks = [];
  if (!g) return blocks;
  // C 이번 세션 XP
  const bonus = g.lines.reduce((n, l) => n + l.bonus, 0);
  blocks.push(el('section', { class: 'stage', dataset: { stage: 'xp' }, id: 'stage-xp' },
    g.capped
      ? el('p', { id: 'summary-xp', dataset: { xp: String(g.sessionXp) } }, '오늘 경험치는 다 모았어요 (하루 두 세션까지)', bonus ? el('br') : null, bonus ? `승급·등급 보너스 +${bonus} XP` : null)
      : el('p', { class: 'settle-total', id: 'summary-xp', dataset: { xp: String(g.sessionXp) } }, `이번 세션 +${g.sessionXp} XP`)));
  // D 바뀐 카드만
  const hint = { shown: false };
  const changed = g.lines.filter((l) => l.changed);
  const same = g.lines.filter((l) => !l.changed);
  const list = el('ul', { class: 'settle-list', id: 'settle-list' }, changed.slice(0, changed.length > 6 ? 5 : 6).map((l) => settleLine(l, g.capped, hint)));
  const moreChanged = changed.length > 6 ? changed.slice(5) : [];
  const full = el('ul', { class: 'settle-list', id: 'settle-full', hidden: true }, g.lines.map((l) => settleLine(l, g.capped, { shown: true })));
  blocks.push(el('section', { class: 'stage', dataset: { stage: 'cards' }, id: 'stage-cards', 'aria-label': '바뀐 카드' },
    el('h3', {}, changed.length ? '바뀐 카드' : '이번 세션의 카드'),
    changed.length ? list : null,
    moreChanged.length ? el('button', { type: 'button', class: 'btn btn-small btn-quiet', id: 'settle-more', onclick: (e) => { list.append(...moreChanged.map((l) => settleLine(l, g.capped, hint))); e.target.remove(); } }, `더 보기 (${moreChanged.length}장)`) : null,
    same.length ? el('p', { class: 'source-note', id: 'settle-same' }, `그 밖에 ${same.length}장은 변화 없어요 `,
      el('button', { type: 'button', class: 'btn btn-small btn-quiet', id: 'settle-all', 'aria-expanded': 'false', onclick: (e) => { full.hidden = !full.hidden; e.target.setAttribute('aria-expanded', full.hidden ? 'false' : 'true'); e.target.textContent = full.hidden ? '전체 보기' : '접기'; } }, '전체 보기')) : null,
    full));
  // E 하루 목표·연속
  if (g.goal) {
    const G = g.goal;
    blocks.push(el('section', { class: 'stage', dataset: { stage: 'goal' }, id: 'stage-goal' },
      el('p', { id: 'summary-goal' }, `오늘 목표 달성 · +${G.xp}`),
      el('p', { id: 'summary-streak' }, G.broken ? `다시 오셨네요. 최고 연속 ${G.broken.best}일 · 오늘부터 1일째` : `연속 ${G.streak}일째예요`),
      G.usedPasses ? el('p', { id: 'summary-pass-used' }, `쉬는 날 보호권을 ${G.usedPasses}장 썼어요. 연속 ${G.streak}일이 이어졌어요`) : null,
      G.earnedPass ? el('p', { id: 'summary-pass-earned' }, `쉬는 날 보호권을 얻었어요 (${R.streak.rest_pass_max}장까지 모아요)`) : null));
  }
  // F 레벨
  const L2 = g.level;
  blocks.push(el('section', { class: 'stage', dataset: { stage: 'level' }, id: 'stage-level' },
    L2.to > L2.from ? el('p', { id: 'summary-levelup' }, L2.to - L2.from > 1 ? `레벨 ${L2.from} → ${L2.to}` : `레벨 ${L2.to}이 되었어요`) : null,
    g.title.to !== g.title.from ? el('p', { id: 'summary-title-new' }, `새 칭호: ${g.title.to}`, el('br'), el('small', {}, '칭호는 도감에서 바꿀 수 있어요')) : null,
    levelBar(rw)));
  // G 업적
  if (g.achievements.length) {
    const first = g.achievements.slice(0, 3);
    const rest = g.achievements.length - first.length;
    blocks.push(el('section', { class: 'stage', dataset: { stage: 'ach' }, id: 'summary-achievements' },
      ...first.map((a) => el('p', { class: 'ach', dataset: { id: a.id } }, el('b', {}, `업적 · ${a.name}`), ` · ${a.desc}`)),
      rest > 0 ? el('p', { class: 'source-note', id: 'summary-ach-more' }, `그 밖에 ${rest}개 · 도감에서 확인해요`) : null));
  }
  return blocks;
}

/** B 다음 복습(항상) + [다음 세션] 버튼. */
function nextBlock() {
  const plan = todayPlan();
  const lines = [];
  if (plan.mode === 'done') lines.push('오늘 할 카드를 모두 했어요');
  else lines.push(plan.due ? `다음 세션 복습 ${plan.due}장` : '다음 세션에는 새 카드부터 시작해요');
  if (plan.blocked) lines.push(`오늘 푼 카드 ${plan.blocked}장은 내일 다시 나와요`);
  if (plan.guarded && plan.unintroduced) lines.push(`아직 열리지 않은 카드 ${plan.unintroduced}장 · 복습을 먼저 마치면 열려요`);
  const soft = rewardsOn() && app.rewards.day.goal_met && app.rewards.day.sessions >= R.daily_session_soft_cap;
  if (soft) lines.push('오늘은 충분히 했어요. 내일 이어서 해요');
  return { plan, soft, node: el('section', { class: 'stage stage-next', dataset: { stage: 'next' }, id: 'stage-next' }, ...lines.map((t) => el('p', {}, t))) };
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
  // [다음 세션]은 보상 결과 화면에서 B 블록으로 옮겨 간다. 다른 결과 화면에서는 아래 버튼 줄로 되돌린다.
  const actions = $('summary').querySelector('.sheet-actions');
  if (!actions.contains($('summary-next'))) actions.append($('summary-next'));
  $('summary').onclick = null;
  $('summary').onkeydown = null;
  $('summary-next').classList.add('btn-primary');
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

/** 일반 모드의 세션 결과: 한 화면(A~G). 탭 없이 위에서 아래로 나타나고, 아무 곳이나 탭하거나 키를 누르면 바로 최종 상태. */
function showRewardSummary(st) {
  const s = sessionSummary(st);
  const clued = s.right - s.clean;
  $('summary-title').textContent = `오늘의 세션 · ${app.deck.nation_label ?? ''} · 세션 ${st.session}`;
  const head = el('section', { class: 'stage stage-head', dataset: { stage: 'summary' }, id: 'stage-summary' },
    el('p', { class: 'big-score', id: 'summary-stats', dataset: { right: String(s.right), total: String(s.total) } }, `정답 ${s.right} / ${s.total}`),
    el('p', { id: 'summary-breakdown' }, `깨끗한 정답 ${s.clean} · 단서를 쓴 정답 ${clued} · 오답 ${s.total - s.right}`),
    s.retried ? el('p', { id: 'summary-retry' }, `다시 풀기 ${s.retried}장 중 ${s.retryRight}장 성공`) : null);
  const next = nextBlock();
  const done = next.plan.mode === 'done';
  const nb = $('summary-next');
  nb.textContent = done ? '오늘은 여기까지' : '다음 세션';
  nb.disabled = done;
  nb.hidden = false;
  nb.dataset.end = '0';
  nb.classList.toggle('btn-primary', !next.soft && !done);
  next.node.append(nb);
  const blocks = [head, next.node, ...rewardBlocks()];
  blocks.forEach((b, i) => { b.style.setProperty('--i', String(i)); });
  const body = $('summary-body');
  fill(body, blocks);
  body.classList.remove('reveal-done');
  body.classList.add('reveal');
  body.dataset.total = String(blocks.length);
  for (const id of ['summary-skip', 'summary-step']) $(id).hidden = true;
  $('summary-home').hidden = false;
  $('summary-dogam').hidden = false;
  const finish = () => { body.classList.add('reveal-done'); };
  $('summary').onclick = finish;
  $('summary').onkeydown = (e) => { if (e.key !== 'Escape') finish(); };
  $('summary').hidden = false;
  (done ? $('summary-home') : nb).focus({ preventScroll: true });
  const sheet = $('summary').querySelector('.sheet');
  if (sheet) sheet.scrollTop = 0;
  announce(`정답 ${s.right} / ${s.total}. ${next.node.innerText.split('\n')[0]}`);
  ev.result = { at: Date.now(), tapped: false, expanded: false };
  $('summary').addEventListener('click', () => { if (ev.result) ev.result.tapped = true; }, { once: true });
  $('settle-all')?.addEventListener('click', () => { if (ev.result) ev.result.expanded = true; });
  logEvent('result_view', { session: st.session });
  persist();
}

/** 결과 화면을 떠날 때(m2-plan §8 result_leave). */
function leaveResult(via) {
  if (!ev.result) return;
  logEvent('result_leave', { dwell_ms: Date.now() - ev.result.at, tapped_to_finish: ev.result.tapped, expanded_all: ev.result.expanded, left_via: via });
  ev.result = null;
  persist();
}

function nextSession() {
  leaveResult('next');
  if (app.study && app.completed >= app.study.cap) { location.assign(app.study.menuUrl); return; }
  $('summary').hidden = true;
  startLearnSession();
  $('card').focus();
}

/* ------------------------------------------------------------------ 숙련 도감, 오답 노트, 기록 */

/* 도감(design/ux/dogam.md): 프로필 줄 + 탭 4개(카드·업적·칭호·오답 노트). 열 때마다 카드 탭. */

/** 저장된 모든 나라의 카드 진행(현재 나라는 메모리의 최신 값). */
function allProgress() {
  const raw = migrateSave(createStore(CONFIG.storageKey).load(), CONFIG.defaultNation);
  return { ...(raw?.cards ?? {}), ...app.progress };
}
/** 활성 나라 목록: [{id, label, deck}] (현재 나라 먼저 아니라 manifest 순서). */
function activeNations() {
  const list = app.nations.filter((n) => n.files.length).map((n) => ({ id: n.id, label: n.label, deck: n.id === app.nation ? app.deck : app.nationDecks.get(n.id) })).filter((n) => n.deck);
  return list.length ? list : [{ id: app.nation, label: app.deck.nation_label ?? app.nation, deck: app.deck }];
}
const GRADE_TEXT = ['익히는 중', '동', '은', '금'];
const md = (iso) => { const [, m, d] = String(iso).split('-').map(Number); return `${m}월 ${d}일`; };

function openDogam(from = null) {
  logEvent('dogam_open', { from: typeof from === 'string' ? from : (app.titleOn ? 'title' : 'session') });
  app.dogam.nation = app.nation;
  app.dogam.filter = 'all';
  $('card-detail').hidden = true;
  renderDogamProfile();
  selectTab('cards');
  $('participant').value = app.participant;
  $('log-count').textContent = `인출 기록 ${app.log.length}줄`;
  $('dogam').hidden = false;
  $('dogam-close').focus();
}

function renderDogamProfile() {
  const rw = app.rewards;
  fill($('dogam-profile'), rw ? [
    el('p', { class: 'title-honor', id: 'dogam-honor' }, currentTitle(rw, R)),
    levelBar(rw),
    el('p', { class: 'source-note', id: 'dogam-streak' }, `연속 ${rw.streak}일 · 최고 ${rw.best_streak}일 · 보호권 ${rw.rest_passes}장`),
  ] : null);
}

const TABS = ['cards', 'ach', 'titles', 'note'];
function selectTab(tab) {
  if (app.dogam.tab !== tab || tab !== 'cards') logEvent('dogam_tab', { tab: { cards: 'cards', ach: 'achievements', titles: 'titles', note: 'note' }[tab] });
  app.dogam.tab = tab;
  for (const t of TABS) {
    const on = t === tab;
    $(`tab-${t}`).setAttribute('aria-selected', on ? 'true' : 'false');
    $(`tab-${t}`).tabIndex = on ? 0 : -1;
    $(`panel-${t}`).hidden = !on;
  }
  if (tab === 'cards') renderDogamCards();
  if (tab === 'ach') renderAchievements();
  if (tab === 'titles') renderTitles();
  if (tab === 'note') renderNote();
}

function setupTabs() {
  for (const t of TABS) $(`tab-${t}`).addEventListener('click', () => selectTab(t));
  $('dogam-tabs').addEventListener('keydown', (e) => {
    const i = TABS.indexOf(app.dogam.tab);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const t = TABS[(i + d + TABS.length) % TABS.length];
    selectTab(t);
    $(`tab-${t}`).focus();
  });
}

/** 카드 탭: 나라 칩, 요약(필터), 왕 줄 + 그 칸 카드(연표 순서). */
function renderDogamCards() {
  const nations = activeNations();
  const cur = nations.find((n) => n.id === app.dogam.nation) ?? nations[0];
  const deck = cur.deck;
  const progress = cur.id === app.nation ? app.progress : allProgress();
  fill($('dogam-nations'), nations.length >= 2 ? nations.map((n) => el('button', {
    type: 'button', class: 'chip nation', dataset: { nation: n.id }, 'aria-pressed': n.id === cur.id ? 'true' : 'false',
    onclick: () => { app.dogam.nation = n.id; app.dogam.filter = 'all'; $('card-detail').hidden = true; renderDogamCards(); },
  }, n.label)) : null);
  const s = sessionIndex();
  const info = deck.cards.map((c) => {
    const e = progress[c.id];
    const g = e?.introduced ? gradeOf(e, L) : -1;
    const review = !!e?.introduced && ((e.lapses >= 1 && e.box <= 2) || (cur.id === app.nation && e.due_session <= s));
    return { c, e, g, key: g < 0 ? 'unseen' : GRADE_KEY[g], review };
  });
  const count = (k) => info.filter((x) => x.key === k).length;
  const counts = { gold: count('gold'), silver: count('silver'), bronze: count('bronze'), none: count('none'), unseen: count('unseen') };
  $('dogam-counts').textContent = `${cur.label} ${deck.cards.length}장 · 금 ${counts.gold} · 은 ${counts.silver} · 동 ${counts.bronze} · 익히는 중 ${counts.none} · 아직 안 만남 ${counts.unseen}`;
  $('dogam-counts').dataset.gold = String(counts.gold);
  const FILTERS = [['all', '전체'], ['gold', '금'], ['silver', '은'], ['bronze', '동'], ['none', '익히는 중'], ['unseen', '아직 안 만남'], ['review', '복습 필요']];
  fill($('dogam-filters'), FILTERS.map(([k, label]) => el('button', {
    type: 'button', class: 'chip filter', dataset: { filter: k }, 'aria-pressed': app.dogam.filter === k ? 'true' : 'false',
    onclick: () => { app.dogam.filter = k; logEvent('dogam_filter', { filter: k }); renderDogamCards(); },
  }, label)));
  const pass = (x) => app.dogam.filter === 'all' || (app.dogam.filter === 'review' ? x.review : x.key === app.dogam.filter);
  const t = buildTimeline(deck.anchors, []);
  const anchors = [...deck.anchors].sort((a, b) => a.order - b.order);
  const bySlot = new Map(anchors.map((a) => [a.id, []]));
  for (const x of info) bySlot.get(slotAnchorId(t, correctGaps(t, x.c.order)[0]))?.push(x);
  const rows = [];
  let shown = 0;
  if (counts.unseen === deck.cards.length && app.dogam.filter === 'all') {
    rows.push(el('li', { class: 'source-note', id: 'dogam-empty' }, '아직 만난 카드가 없어요. 첫 세션을 시작해 보세요'));
  }
  for (const a of anchors) {
    const items = bySlot.get(a.id).sort((p, q) => p.c.order - q.c.order);
    const vis = items.filter(pass);
    if (!vis.length && app.dogam.filter !== 'all') continue;
    if (!items.length) continue;
    const silver = items.filter((x) => x.g >= 2).length;
    const open = !app.dogam.collapsed.has(a.id);
    rows.push(el('li', { class: 'dogam-king', dataset: { king: a.id } }, el('button', {
      type: 'button', class: 'king-row', 'aria-expanded': open ? 'true' : 'false',
      onclick: () => { if (open) app.dogam.collapsed.add(a.id); else app.dogam.collapsed.delete(a.id); renderDogamCards(); },
    }, el('span', { class: 'king-row-name' }, `${open ? '▾' : '▸'} ${a.reign ?? a.title}`), el('span', { class: 'king-row-prog' }, `${silver}/${items.length}`))));
    if (!open) continue;
    for (const x of vis) {
      shown += 1;
      const { c, e, g, key } = x;
      const wait = e?.introduced && cur.id === app.nation ? Math.max(0, e.due_session - s) : null;
      rows.push(el('li', { class: `dogam-row medal-${key}`, dataset: { id: c.id, mastery: key, best: String(e?.best_grade ?? 0) } },
        el('button', {
          type: 'button', class: 'dogam-card', disabled: g < 0, 'aria-label': g < 0 ? '아직 만나지 않은 카드' : `${c.title}, ${g === 0 ? '익히는 중' : `${GRADE_NAME[g]} 등급`}`,
          onclick: () => showCardDetail(cur, c, e),
        },
        el('span', { class: 'medal' }, g < 0 ? '?' : GRADE_TEXT[g]),
        el('span', { class: 'dogam-main' },
          el('span', { class: 'dogam-title' }, g < 0 ? '? 아직 만나지 않았어요' : c.title),
          el('span', { class: 'dogam-sub' }, e?.introduced
            ? `${shortYear(c)} · 상자 ${e.box}${e.probation ? '(재학습)' : ''}${wait === null ? '' : ` · ${wait === 0 ? '복습할 때' : `${wait}세션 뒤`}`} · 최고 ${GRADE_NAME[e.best_grade]} · 틀린 횟수 ${e.lapses}`
            : '만나면 열려요'),
          x.review ? el('span', { class: 'row-tag' }, '복습') : null))));
    }
  }
  if (!shown && app.dogam.filter !== 'all') rows.push(el('li', { class: 'source-note', id: 'dogam-none' }, '조건에 맞는 카드가 없어요 ', el('button', { type: 'button', class: 'btn btn-small', onclick: () => { app.dogam.filter = 'all'; renderDogamCards(); } }, '필터 지우기')));
  fill($('dogam-list'), rows);
  $('dogam-shown').textContent = `${deck.cards.length}장 중 ${shown}장 표시`;
}

function showCardDetail(nation, c, e) {
  if (!e?.introduced) return;
  logEvent('card_detail_open', { card_id: c.id });
  const s = sessionIndex();
  const box = $('card-detail');
  fill(box,
    el('div', { class: 'sheet-head' }, el('h3', { id: 'detail-title' }, c.title), el('button', { type: 'button', class: 'btn btn-small', id: 'detail-close', onclick: () => { box.hidden = true; } }, '닫기')),
    el('p', { class: 'result-meta' }, c.year_label),
    el('p', {}, c.explanation),
    c.exam_note ? el('p', { class: 'result-note' }, el('b', {}, '출제 주제 '), c.exam_note) : null,
    el('p', { class: 'result-source' }, `출처: ${c.source?.name ?? ''}`),
    el('p', { class: 'source-note', id: 'detail-state' }, `${GRADE_TEXT[gradeOf(e, L)]} · 상자 ${e.box}${nation.id === app.nation ? ` · 다음 복습 ${Math.max(0, e.due_session - s) === 0 ? '지금' : `${e.due_session - s}세션 뒤`}` : ''} · 틀린 횟수 ${e.lapses}`),
    nation.id === app.nation ? el('button', { type: 'button', class: 'btn btn-small', id: 'detail-practice', onclick: () => startPractice('card', [c.id]) }, '이 카드만 연습') : null);
  box.hidden = false;
  box.scrollIntoView?.({ block: 'nearest' });
  $('detail-close').focus();
}

/** 업적 탭: 획득(최근 순) → 진행도 높은 순 → 나머지. 미획득도 조건을 보인다. */
function renderAchievements() {
  const rw = app.rewards;
  if (!rw) { fill($('ach-list')); return; }
  const nations = activeNations();
  const progressAll = allProgress();
  const statsOf = (deck) => achievementStats({
    cards: deck.cards, progress: progressAll, gradeOf: (e) => gradeOf(e, L),
    slotOf: (c) => { const t = buildTimeline(deck.anchors, []); return slotAnchorId(t, correctGaps(t, c.order)[0]); },
    rewards: rw, session: null,
  });
  const items = [];
  const globalStats = statsOf({ cards: nations.flatMap((n) => n.deck.cards), anchors: app.deck.anchors });
  for (const d of achievementDefs()) items.push({ d, st: globalStats, scope: 'all' });
  for (const n of nations) {
    const st = statsOf(n.deck);
    for (const d of achievementDefs(n.id, n.label).filter((x) => x.nation)) items.push({ d, st, scope: n.id });
  }
  const FILTERS = [['all', '전체'], ['got', '획득'], ['todo', '미획득'], ...nations.map((n) => [n.id, n.label])];
  fill($('ach-filters'), FILTERS.map(([k, label]) => el('button', {
    type: 'button', class: 'chip filter', dataset: { filter: k }, 'aria-pressed': app.dogam.achFilter === k ? 'true' : 'false',
    onclick: () => { app.dogam.achFilter = k; renderAchievements(); },
  }, label)));
  const f = app.dogam.achFilter;
  const rows = items.map(({ d, st, scope }) => {
    const got = rw.achievements[d.id];
    const pr = !got && d.progress ? d.progress(st) : null;
    return { d, got, pr, scope, ratio: pr ? pr[0] / pr[1] : 0 };
  }).filter((x) => f === 'all' || (f === 'got' ? x.got : f === 'todo' ? !x.got : x.scope === f))
    .sort((a, b) => (b.got ? 1 : 0) - (a.got ? 1 : 0) || String(b.got ?? '').localeCompare(String(a.got ?? '')) || b.ratio - a.ratio);
  fill($('ach-list'), rows.map(({ d, got, pr }) => el('li', { class: `ach-row${got ? ' ach-got' : ''}`, dataset: { id: d.id, got: got ? '1' : '0' } },
    el('span', { class: 'ach-name' }, `${got ? '획득' : '미획득'} · ${d.name}`),
    el('span', { class: 'ach-desc' }, d.desc),
    el('span', { class: 'ach-state' }, got ? `획득 · ${md(got)}` : pr ? `${pr[0]}/${pr[1]}` : '아직 달성하지 않았어요'))));
}

/** 칭호 탭: 레벨이 된 칭호만 고를 수 있다. 고르면 고정(레벨업이 덮어쓰지 않음), "자동"은 고정 해제. */
function renderTitles() {
  const rw = app.rewards;
  if (!rw) { fill($('title-list')); return; }
  const level = levelOf(rw.xp, R).level;
  const pick = (name) => { app.rewards = { ...app.rewards, title_pinned: name }; logEvent('title_equip', { title: name ?? 'auto' }); saveRewards(); persist(); renderDogamProfile(); renderTitles(); };
  fill($('title-list'),
    el('li', { class: 'title-row' }, el('span', {}, `자동(가장 높은 칭호: ${titleForLevel(level, R)})`),
      el('button', { type: 'button', class: 'btn btn-small', id: 'title-auto', 'aria-pressed': rw.title_pinned ? 'false' : 'true', onclick: () => pick(null) }, rw.title_pinned ? '선택' : '사용 중')),
    R.titles.map(([lv, name]) => el('li', { class: 'title-row', dataset: { title: name } },
      el('span', {}, `${name} · Lv ${lv}`),
      level < lv ? el('span', { class: 'source-note' }, `Lv ${lv}에 얻어요`)
        : el('button', { type: 'button', class: 'btn btn-small', 'aria-pressed': rw.title_pinned === name ? 'true' : 'false', onclick: () => pick(name) },
          rw.title_pinned === name ? '사용 중' : '선택'))));
}

/** 오답 노트 탭(leitner-spec §6). */
function renderNote() {
  const note = wrongNoteIds(app.deck.cards, app.progress);
  fill($('note-list'), note.length ? note.map((id) => {
    const c = app.cardsById.get(id);
    const e = app.progress[id];
    return el('li', { dataset: { id } }, el('details', {},
      el('summary', {}, `${c.title} · 틀린 횟수 ${e.lapses} · 상자 ${e.box}`),
      el('p', {}, c.explanation),
      e.probation ? el('p', { class: 'source-note' }, '두 번 연속 맞히면 올라가요') : null));
  }) : [el('li', { class: 'source-note', id: 'note-empty' }, "오답 노트가 비어 있어요. 틀렸던 카드를 모두 익혔다면 업적 '오답 노트 비우기'가 열려요")]);
  $('btn-note-practice').disabled = note.length === 0;
  $('btn-note-practice').dataset.count = String(note.length);
}

/** 인출 로그 내보내기: 줄마다 JSON(JSONL), m1-plan §11 규격. */
function exportLog() {
  if (!app.study && app.rewards) {
    const rw = app.rewards;
    logEvent('export', { lines_n: app.log.length + 1, rewards_snapshot: { xp: rw.xp, level: levelOf(rw.xp, R).level, streak: rw.streak, achievements: Object.keys(rw.achievements), title: currentTitle(rw, R) } });
    persist();
  }
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
  logEvent('intro_view', { page: step + 1 });
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
  if (!app.study) L = CONFIG.leitnerGeneral;
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
  if (!app.study) {
    ev.openAt = performance.now();
    document.addEventListener('pointerdown', () => { ev.taps += 1; }, { capture: true });
    app.firstDay = saved?.first_day ?? dayOpts().today;
    const mm = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
    logEvent('app_open', {
      viewport_w: innerWidth, viewport_h: innerHeight, dpr: devicePixelRatio, touch: mm('(pointer: coarse)'), reduced_motion: mm('(prefers-reduced-motion: reduce)'),
      mode: 'general', build: app.dataId, first_run: !saved, day_index: dayIndex(),
    });
  }

  setupDrag();
  setupRefs();
  setupTabs();
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
  $('intro-skip').addEventListener('click', () => { logEvent('intro_skip', { page: introStep + 1 }); closeIntro(); persist(); });
  $('intro-next').addEventListener('click', () => (introStep >= INTRO.length - 1 ? closeIntro() : showIntro(introStep + 1)));
  $('btn-export').addEventListener('click', exportLog);
  $('btn-note-practice').addEventListener('click', () => startPractice('note', wrongNoteIds(app.deck.cards, app.progress)));
  $('participant').addEventListener('change', (e) => { app.participant = (e.target.value.trim() || '-').slice(0, 20); persist(); });
  $('summary-next').addEventListener('click', nextSession);
  $('summary-dogam').addEventListener('click', () => { leaveResult('dogam'); $('summary').hidden = true; openDogam('result'); });
  $('summary-home').addEventListener('click', () => { leaveResult('title'); $('summary').hidden = true; showTitle(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('intro').hidden) closeIntro();
    else if (!$('modal').hidden) closeModal();
    else if (!$('dogam').hidden) closeDogam();
  });

  // §5 세션 카운트: 도중에 닫힌 학습 세션은 인출이 1장 이상이면 끝난 것으로 처리한다. 0장이면 이어서 한다. 연습은 버린다.
  if (restored && !restored.practice && attemptsOf(restored) >= L.count_session_min_answers) {
    logEvent('session_end', { session: restored.session, duration_ms: null, answered_n: attemptsOf(restored), ended_by: 'closed' });
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
  // 다른 나라 덱도 읽어 둔다(타이틀 나라 목록의 오늘 할 일, 도감의 나라 전환). 실패한 나라는 건너뛴다.
  await Promise.all(usable.filter((n) => n.id !== nation.id).map(async (n) => {
    try { const d = await loadNationDeck(n); if (d.deck && !d.errors.length) app.nationDecks.set(n.id, d.deck); } catch { /* 건너뜀 */ }
  }));
  const files = nation.files.map((f) => f.split('/').pop());
  return { url: `${nation.id}:${files.join('+')}`, label: `${nation.label} ${files.join(', ')}`, deck: norm.deck, convErrors: norm.errors };
}

/* ------------------------------------------------------------------ 타이틀(M2, 일반 모드만) */

let titleWantsIntro = false;

function setupTitle(wantIntro, params) {
  titleWantsIntro = wantIntro;
  $('title-play').addEventListener('click', () => {
    logEvent('title_play_tap', { ms_since_open: Math.round(performance.now() - ev.openAt) });
    enterLearning();
    if (titleWantsIntro) { titleWantsIntro = false; showIntro(0); }
  });
  $('title-dogam').addEventListener('click', openDogam);
  $('title-howto').addEventListener('click', () => { titleWantsIntro = false; showIntro(0); });
  app.titleParams = params;
}

/** 다른 나라의 다음 세션 미리 보기(저장된 진행으로). 현재 나라는 todayPlan(). */
function planFor(nationId) {
  if (nationId === app.nation) return todayPlan();
  const deck = app.nationDecks.get(nationId);
  if (!deck) return { mode: 'done', due: 0, fresh: 0, left: 0 };
  const raw = migrateSave(createStore(CONFIG.storageKey).load(), CONFIG.defaultNation);
  const progress = restoreProgress(raw?.cards, deck.cards, L);
  const n = raw?.nations?.[nationId] ?? {};
  const cur = restoreSession(n.current, deck.cards);
  if (cur && !cur.practice && currentId(cur)) {
    // 0장이면 이어서, 1장 이상이면 다음 실행에서 끝난 것으로 처리되므로 다음 세션을 보인다
    if (attemptsOf(cur) === 0) return { mode: 'continue', due: 0, fresh: 0, left: cur.queue.length - cur.index };
  }
  const done = (n.completed_sessions ?? 0) + (cur && attemptsOf(cur) >= L.count_session_min_answers ? 1 : 0);
  const pick = buildSession(deck.cards, progress, done + 1, L, 1, dayOpts());
  return { mode: pick.due ? 'review' : pick.fresh ? 'new' : 'done', due: pick.due, fresh: pick.fresh, left: pick.due + pick.fresh };
}

/** 나라를 바꾼다. 진행 중 세션(1장 이상 풀고 남음)이 있으면 먼저 확인한다(title-screen.md, D100 대체). */
function switchNation(n) {
  if (n.id === app.nation) return;
  const go = () => {
    const q = new URLSearchParams(app.titleParams ?? location.search);
    q.set('nation', n.id);
    q.delete('data');
    location.assign(`?${q}`);
  };
  const record = (shown, choice) => { logEvent('nation_switch', { from: app.nation, to: n.id, confirm_shown: shown, choice }); persist(); };
  if (app.state && !app.state.practice && currentId(app.state) && attemptsOf(app.state) >= 1) {
    openModal(`${n.label}로 옮길까요?`, [el('p', {}, `지금 세션을 끝내고 ${n.label}로 옮길까요? 푼 카드는 저장돼요.`)],
      [el('button', { type: 'button', class: 'btn', id: 'switch-cancel', onclick: () => { record(true, 'cancel'); closeModal(); } }, '취소'),
        el('button', { type: 'button', class: 'btn btn-primary', id: 'switch-confirm', onclick: () => { record(true, 'move'); closeModal(); go(); } }, '옮기기')], 'switch');
    return;
  }
  record(false, 'move');
  go();
}

/** 타이틀의 나라 선택: 활성 1~2개는 칩 줄 + 요약 한 줄, 3개 이상은 세로 목록(행마다 오늘 할 일). */
function renderTitleNations() {
  const nations = app.nations.length ? app.nations : [{ id: app.nation, label: app.deck.nation_label ?? app.nation, files: ['-'] }];
  const active = nations.filter((n) => n.files.length && (n.id === app.nation || app.nationDecks.has(n.id)));
  const plans = new Map(active.map((n) => [n.id, planFor(n.id)]));
  const deckOf = (id) => (id === app.nation ? app.deck : app.nationDecks.get(id));
  const allP = active.length > 1 ? allProgress() : app.progress;
  const learned = (id) => deckOf(id).cards.filter((c) => allP[c.id]?.introduced).length;
  const soon = nations.filter((n) => !active.includes(n));
  if (active.length >= 3) {
    const order = [...active].sort((a, b) => (plans.get(b.id).left > 0) - (plans.get(a.id).left > 0) || nations.indexOf(a) - nations.indexOf(b));
    const most = [...active].sort((a, b) => plans.get(b.id).due - plans.get(a.id).due)[0];
    const tot = [...plans.values()].reduce((x, p) => ({ due: x.due + p.due, fresh: x.fresh + p.fresh }), { due: 0, fresh: 0 });
    fill($('title-nations'),
      el('p', { class: 'nation-total', id: 'title-nation-total' }, `오늘 복습 모두 ${tot.due}장 · 새 카드 ${tot.fresh}장`),
      el('div', { class: 'nation-list', role: 'radiogroup', 'aria-label': '나라' }, order.map((n) => {
        const p = plans.get(n.id);
        const on = n.id === app.nation;
        const label = `${n.label}, ${deckOf(n.id).cards.length}장 중 ${learned(n.id)}장 학습, 오늘 복습 ${p.due}장 새 카드 ${p.fresh}장`;
        return el('button', { type: 'button', role: 'radio', class: 'nation-row' + (on ? ' is-on' : ''), dataset: { nation: n.id }, 'aria-checked': on ? 'true' : 'false', 'aria-label': label, onclick: () => switchNation(n) },
          el('span', { class: 'nation-mark', 'aria-hidden': 'true' }, on ? '●' : '○'),
          el('span', { class: 'nation-name' }, n.label),
          el('span', { class: 'nation-meta' }, `${deckOf(n.id).cards.length}장 중 ${learned(n.id)} 학습`, el('br'), `오늘 복습 ${p.due} · 새 ${p.fresh}`),
          most && most.id === n.id && p.due > 0 ? el('span', { class: 'nation-hint' }, '오늘 가장 많아요') : null);
      })),
      soon.length ? el('details', { class: 'nation-soon-list' }, el('summary', {}, `준비 중 ${soon.length}개`), el('p', { class: 'source-note' }, soon.map((n) => n.label).join(' · '))) : null);
    return;
  }
  fill($('title-nations'),
    el('div', { class: 'nation-chips' }, nations.map((n) => el('button', {
      type: 'button', class: 'chip nation', dataset: { nation: n.id }, 'aria-pressed': n.id === app.nation ? 'true' : 'false', disabled: !active.includes(n),
      onclick: () => switchNation(n),
    }, n.label, active.includes(n) ? null : el('span', { class: 'nation-soon' }, ' 준비 중')))),
    active.length === 2 ? el('p', { class: 'source-note', id: 'title-nation-total' }, active.map((n) => `${n.label} 복습 ${plans.get(n.id).due} · 새 ${plans.get(n.id).fresh}`).join(' / ')) : null);
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
  const pick = buildSession(app.deck.cards, app.progress, s, L, sessionSeed(app.deckHash, s, app.seedParam), dayOpts());
  const mode = pick.due ? 'review' : pick.fresh ? 'new' : 'done';
  return { mode, due: pick.due, fresh: pick.fresh, left: pick.due + pick.fresh, guarded: pick.guarded, unintroduced: pick.unintroduced, blocked: pick.blocked };
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
  renderTitleNations();
  logEvent('title_view', { resume: plan.mode === 'continue', due_n: plan.due, new_n: plan.fresh, est_min: Math.max(1, Math.ceil((plan.left * CONFIG.secondsPerCard) / 60)), nations_active_n: Math.max(1, app.nations.filter((n) => n.files.length).length) });
  persist();
  const extra = [];
  if (plan.guarded && plan.unintroduced) extra.push(`아직 열리지 않은 카드 ${plan.unintroduced}장 · 복습을 먼저 마치면 열려요`);
  if (app.rewards && app.rewards.day.key === dayOpts().today && app.rewards.day.sessions >= R.daily_session_soft_cap) extra.push('오늘은 충분히 했어요. 내일 이어서 해요');
  fill($('title-today'), today, ...extra.map((t) => [el('br'), el('small', { class: 'title-note' }, t)]));
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
