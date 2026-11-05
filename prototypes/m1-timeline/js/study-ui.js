// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D72)
/**
 * 사람 테스트 모드 화면(`?study=1`): 진행자 메뉴, 방식 B(플래시카드), 테스트(pre/post0/post1).
 * 방식 A 학습은 일반 화면(main.js)을 `stage=learn-A`로 연다. 규칙은 study.js·rules.js, 수치는 config.js.
 */
import { CONFIG } from './config.js';
import { createStore } from './storage.js';
import { loadRaw, normalizeDeck } from './data.js';
import {
  validateDeck, buildSession, createSessionState, currentId, isRetry, isSessionDone,
  attemptsOf, completedAfter, sessionSummary, sessionSeed, dataFingerprint, fnv1a, restoreProgress, restoreSession, logLine, previewBox,
} from './rules.js';
import {
  ASSIGNMENTS, TEST_PHASES, validParticipant, splitHalves, stageOrder, armIds, newStudySave, nextStage, testOrder, post1Timing,
  createTestState, answerTest, testDone, rateCurrent, studyKeys,
} from './study.js';

const L = CONFIG.leitner;
const S = CONFIG.study;
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

const STAGE_NAME = { pre: '사전 점검(pre)', 'learn-A': '방식 A 학습(연표 꽂기)', 'learn-B': '방식 B 학습(플래시카드)', post0: '즉시 후테스트(post0)', post1: '다음 날 재인출(post1)' };

const ui = {
  params: null, deck: null, dataId: '', anchorsById: new Map(), cardsById: new Map(), halves: null,
  pid: '', store: null, save: null, shownAt: 0, seedParam: 0, unlocked: false,
  // 테스트 화면
  choice: undefined,
  // 방식 B
  b: null,
};

function urlFor(extra) {
  const q = new URLSearchParams();
  q.set('study', '1');
  for (const k of ['data', 'seed', 'confirm']) if (ui.params.get(k)) q.set(k, ui.params.get(k));
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return `?${q}`;
}
const menuUrl = () => urlFor({ participant: ui.pid });
const persist = () => ui.store.save(ui.save);
const shortYear = (c) => c.year_label.split('(')[0].trim();

function root(...children) {
  fill($('study'), ...children);
  window.scrollTo?.({ top: 0 });
}

function announce(text) {
  const a = $('announcer');
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = text; });
}

/* ------------------------------------------------------------------ 진행자 메뉴 */

/** 진행자 코드 화면. 메뉴를 열 때마다 묻는다(페이지를 다시 열면 다시 잠김). */
function renderLock() {
  document.body.dataset.screen = 'lock';
  const input = el('input', { id: 'lock-code', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 12, 'aria-describedby': 'lock-msg' });
  const open = () => {
    if (input.value.trim() === S.facilitatorCode) { ui.unlocked = true; renderMenu(); $('study-pid')?.focus(); return; }
    $('lock-msg').textContent = '코드가 맞지 않습니다. 진행자에게 화면을 돌려주세요.';
    input.value = '';
    input.focus();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  root(
    el('h1', { class: 'study-title' }, '진행자 메뉴'),
    el('section', { class: 'study-box' },
      el('p', {}, '진행자만 여는 화면입니다. 참가자라면 진행자에게 알려 주세요.'),
      el('div', { class: 'study-row' }, el('label', { for: 'lock-code' }, '진행자 코드'), input,
        el('button', { type: 'button', class: 'btn btn-primary btn-small', id: 'lock-open', onclick: open }, '열기')),
      el('p', { class: 'source-note', id: 'lock-msg', 'aria-live': 'polite' }, '')));
  input.focus();
}

function renderMenu() {
  if (!ui.unlocked) { renderLock(); return; }
  document.body.dataset.screen = 'menu';
  const known = studyKeys(globalThis.localStorage ?? { length: 0 }, S.storagePrefix);
  const save = ui.save;
  const pidInput = el('input', { id: 'study-pid', type: 'text', maxlength: 20, value: ui.pid, autocomplete: 'off', 'aria-describedby': 'study-pid-help' });
  const go = () => {
    const v = pidInput.value.trim();
    if (!validParticipant(v)) { $('study-pid-help').textContent = '영문·숫자·-·_ 1~20자(예: P1).'; return; }
    location.assign(urlFor({ participant: v }));
  };
  pidInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const parts = [
    el('h1', { class: 'study-title' }, '사람 테스트 · 진행자 메뉴'),
    el('p', { class: 'source-note' }, '참가자에게 화면을 넘기기 전에 여기서 단계를 고릅니다. 순서와 대본은 STUDY.md, production/playtest/m1-plan.md §5·§8.'),
    el('section', { class: 'study-box', 'aria-labelledby': 'h-pid' },
      el('h2', { id: 'h-pid' }, '참가자'),
      el('div', { class: 'study-row' }, el('label', { for: 'study-pid' }, '참가자 ID'), pidInput,
        el('button', { type: 'button', class: 'btn btn-small', id: 'study-open', onclick: go }, '열기')),
      el('p', { class: 'source-note', id: 'study-pid-help' }, '이름 대신 P1, P2처럼 적습니다. 참가자마다 저장이 따로입니다.'),
      known.length ? el('p', { class: 'study-known', id: 'study-known' }, '저장된 참가자: ',
        known.map((k) => el('a', { href: urlFor({ participant: k }), class: 'chip', dataset: { pid: k } }, k))) : null),
  ];
  if (ui.pid && !save) parts.push(renderCreate());
  if (save) parts.push(...renderParticipant(save));
  root(...parts);
}

function renderCreate() {
  const preset = ASSIGNMENTS[ui.pid] ? ui.pid : 'P1';
  const radio = (key) => el('label', { class: 'study-radio' },
    el('input', { type: 'radio', name: 'asg', id: `asg-${key}`, value: key, checked: key === preset }),
    ` ${key} 배정: 방식 ${ASSIGNMENTS[key].first}부터 · A = ${ASSIGNMENTS[key].A}, B = ${ASSIGNMENTS[key].B}`);
  return el('section', { class: 'study-box', 'aria-labelledby': 'h-asg' },
    el('h2', { id: 'h-asg' }, `${ui.pid} 배정(교차, m1-plan §4)`),
    radio('P1'), radio('P2'),
    el('p', { class: 'source-note' }, '1명뿐이면 P1 배정만 합니다. 배정은 만든 뒤 바꿀 수 없습니다(바꾸려면 이 참가자 기록을 지우고 다시 만듭니다).'),
    halvesDetails(),
    el('button', {
      type: 'button', class: 'btn btn-primary', id: 'study-create', onclick: () => {
        const key = document.querySelector('input[name="asg"]:checked')?.value ?? 'P1';
        ui.save = newStudySave(ui.pid, ASSIGNMENTS[key], ui.dataId);
        persist();
        renderMenu();
        announce(`${ui.pid} 참가자를 만들었습니다.`);
      },
    }, '참가자 만들기'));
}

function halvesDetails() {
  const list = (half) => ui.halves[half].map((id) => ui.cardsById.get(id)).sort((a, b) => a.order - b.order)
    .map((c) => el('li', {}, `${c.title} · ${shortYear(c)} · ${c.exam_note || '-'}`));
  return el('details', { class: 'study-halves', id: 'study-halves' },
    el('summary', {}, `두 반 구성 보기(진행자만, ${ui.halves.rule === 'preset' ? '고정 분할' : '연대순 짝 나누기'})`),
    el('h3', {}, 'S1'), el('ol', { dataset: { half: 'S1' } }, list('S1')),
    el('h3', {}, 'S2'), el('ol', { dataset: { half: 'S2' } }, list('S2')));
}

function stageStatus(save, stage) {
  const st = save.stages[stage];
  if (st?.done_at) return { text: '끝남', done: true };
  if (stage.startsWith('learn-')) {
    const n = save.arms[stage.slice(-1)]?.completed_sessions ?? 0;
    return { text: n ? `세션 ${n}/${S.sessionsPerArm}` : '시작 전', done: false };
  }
  const t = save.tests[stage];
  return { text: t ? `카드 ${t.index}/${t.order.length}` : '시작 전', done: false };
}

function renderParticipant(save) {
  const mismatch = save.dataId !== ui.dataId;
  const asg = save.assignment;
  const next = nextStage(save);
  const timing = post1Timing(save, Date.now(), S.post1WindowHours);
  const stages = stageOrder(asg).map((stage, i) => {
    const s = stageStatus(save, stage);
    const isNext = stage === next;
    const half = stage.startsWith('learn-') ? ` · ${asg[stage.slice(-1)]} ${ui.halves[asg[stage.slice(-1)]].length}장` : ` · ${ui.deck.cards.length}장`;
    return el('li', { class: 'study-stage' + (isNext ? ' is-next' : '') + (s.done ? ' is-done' : ''), dataset: { stage, done: s.done ? '1' : '0' } },
      el('span', { class: 'study-stage-name' }, `${i + 1}. ${STAGE_NAME[stage]}${half}`),
      el('span', { class: 'study-stage-status' }, s.text),
      s.done || mismatch ? null : el('a', { class: 'btn btn-small' + (isNext ? ' btn-primary' : ''), href: urlFor({ participant: save.participant, stage }), dataset: { go: stage } },
        s.text === '시작 전' ? '시작' : '이어서'));
  });
  return [
    el('section', { class: 'study-box', 'aria-labelledby': 'h-stage' },
      el('h2', { id: 'h-stage' }, `${save.participant} · 방식 ${asg.first}부터 · A = ${asg.A}, B = ${asg.B}`),
      mismatch ? el('p', { class: 'data-warn', id: 'study-mismatch' }, '데이터가 이 참가자를 만들 때와 다릅니다. 기록을 내보낸 뒤 새 참가자로 하세요.') : null,
      el('ol', { class: 'study-stages', id: 'study-stages' }, stages),
      timing && !save.stages.post1?.done_at ? el('p', { class: timing.ok ? 'source-note' : 'data-warn', id: 'post1-timing', dataset: { ok: timing.ok ? '1' : '0' } },
        `post0 뒤 ${timing.hours.toFixed(1)}시간. post1 권장: ${S.post1WindowHours[0]}~${S.post1WindowHours[1]}시간 뒤${timing.ok ? '' : ' (지금은 권장 시간 밖)'}.`) : null,
      next === null ? el('p', { class: 'empty-title', id: 'study-all-done' }, '모든 단계를 마쳤습니다. 기록을 내보내세요.') : null,
      halvesDetails()),
    el('section', { class: 'study-box', 'aria-labelledby': 'h-log' },
      el('h2', { id: 'h-log' }, '기록'),
      el('p', { class: 'source-note', id: 'study-log-count', dataset: { count: String(save.log.length) } }, `인출 기록 ${save.log.length}줄(m1-plan §11 규격, 줄마다 JSON)`),
      el('div', { class: 'study-row' },
        el('button', { type: 'button', class: 'btn btn-primary btn-small', id: 'study-export', onclick: exportLog }, '기록 내보내기(JSONL)'),
        el('button', { type: 'button', class: 'btn btn-danger btn-small', id: 'study-reset', onclick: confirmReset }, '이 참가자 기록 지우기'))),
  ];
}

function exportLog() {
  const log = ui.save.log;
  const body = log.map((l) => JSON.stringify(l)).join('\n') + (log.length ? '\n' : '');
  const url = URL.createObjectURL(new Blob([body], { type: 'application/x-ndjson' }));
  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const a = el('a', { href: url, download: `m1-study-${ui.pid}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.jsonl` });
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
  openModal(`${ui.pid} 기록을 지울까요?`, [el('p', {}, '배정, 단계, 상자, 인출 기록이 모두 지워집니다. 먼저 "기록 내보내기"를 하세요.')],
    [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
      el('button', { type: 'button', class: 'btn', id: 'reset-next', onclick: () => openModal('정말 지울까요?', [el('p', {}, '되돌릴 수 없습니다.')],
        [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
          el('button', { type: 'button', class: 'btn btn-danger', id: 'reset-confirm', onclick: () => { ui.store.clear(); ui.save = null; closeModal(); renderMenu(); announce('지웠습니다.'); } }, '모두 지우기')], 'reset2') }, '계속')], 'reset1');
}

/* ------------------------------------------------------------------ 테스트(pre/post0/post1) */

function startTest(phase) {
  if (!ui.save.tests[phase]) {
    ui.save.tests[phase] = { ...createTestState(testOrder(ui.deck.cards, ui.pid, phase)) };
    ui.save.stages[phase] = { started_at: new Date().toISOString() };
    persist();
  }
  ui.choice = undefined;
  ui.shownAt = performance.now();
  renderTest(phase);
}

function renderTest(phase) {
  document.body.dataset.screen = 'test';
  const t = ui.save.tests[phase];
  if (testDone(t)) {
    root(el('section', { class: 'card card-empty study-done' },
      el('p', { class: 'empty-title', id: 'test-done', dataset: { phase } }, '점검을 마쳤습니다.'),
      el('p', { class: 'source-note' }, '진행자에게 알려 주세요. 정답은 마지막 날에 함께 봅니다.'),
      el('a', { class: 'btn btn-primary', id: 'btn-menu-done', href: menuUrl() }, '진행자 메뉴로')));
    return;
  }
  const card = ui.cardsById.get(t.order[t.index]);
  const kings = [...ui.deck.anchors].sort((x, y) => x.order - y.order);
  const reason = el('textarea', { id: 'test-reason', rows: 2, maxlength: 300, placeholder: '왜 이 왕인지 한 줄(지문의 어떤 말 때문인지)' });
  const submit = el('button', { type: 'button', class: 'btn btn-primary', id: 'test-submit', disabled: true, onclick: () => submitTest(phase, card, reason.value) }, '다음');
  const pick = (id) => {
    ui.choice = ui.choice === id ? undefined : id;
    document.querySelectorAll('#test-kings .king').forEach((b) => {
      const on = b.dataset.king === ui.choice;
      b.classList.toggle('king-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('test-unknown').setAttribute('aria-pressed', ui.choice === null ? 'true' : 'false');
    $('test-unknown').classList.toggle('btn-selected', ui.choice === null);
    $('test-choice').textContent = ui.choice === undefined ? '아직 고르지 않았습니다.' : (ui.choice === null ? '고른 것: 모르겠다' : `고른 왕: ${ui.anchorsById.get(ui.choice).reign}`);
    submit.disabled = ui.choice === undefined;
  };
  // 지문 → 왕 10명 → 근거 → 다음. 한 화면 안에 지문과 선택지가 함께 보이게 짧게 둔다(B4).
  root(
    el('div', { class: 'study-head' },
      el('span', { class: 'badge' }, STAGE_NAME[phase]),
      el('span', { id: 'test-progress', dataset: { index: String(t.index) } }, `카드 ${t.index + 1} / ${t.order.length}`)),
    el('article', { class: 'card card-question test-card', id: 'test-card', dataset: { cardId: card.id }, tabindex: '-1' },
      el('div', { class: 'card-head' }, el('span', { class: 'badge' }, '사료'), el('span', { class: 'card-title' }, '어느 왕 때일까?')),
      el('blockquote', { class: 'source-text', id: 'source-text' }, card.source_text)),
    el('section', { class: 'study-answer', 'aria-labelledby': 'test-q' },
      el('p', { class: 'source-note', id: 'test-q' }, `${ui.deck.nation_label ?? ''} 기준 왕 ${kings.length}명 중에서 고르세요. 목록에 없는 왕 때의 일이면 그 앞에 즉위한 왕을 고릅니다. 단서와 정답은 보여 주지 않습니다.`),
      el('div', { class: 'kings', id: 'test-kings', role: 'group', 'aria-label': '기준 왕' }, kings.map((a) => el('button', {
        type: 'button', class: 'king', dataset: { king: a.id }, 'aria-pressed': 'false', onclick: () => pick(a.id),
      }, el('span', { class: 'king-name' }, a.reign), el('span', { class: 'king-year' }, `즉위 ${shortYear(a)}`)))),
      el('button', { type: 'button', class: 'btn btn-small', id: 'test-unknown', 'aria-pressed': 'false', onclick: () => pick(null) }, '모르겠다'),
      el('p', { class: 'source-note', id: 'test-choice', 'aria-live': 'polite' }, '아직 고르지 않았습니다.'),
      el('label', { for: 'test-reason', class: 'study-label' }, '근거'), reason, submit));
  $('test-card').focus();
}

function submitTest(phase, card, reason) {
  if (ui.choice === undefined) return;
  const now = Date.now();
  const { state, line } = answerTest(ui.save.tests[phase], {
    king: ui.choice, reason, card, anchors: ui.deck.anchors, participant: ui.pid, phase, ts: now, msOnCard: Math.round(performance.now() - ui.shownAt),
  });
  ui.save.tests[phase] = { ...state };
  ui.save.log = [...ui.save.log, line];
  if (testDone(state)) ui.save.stages[phase] = { ...ui.save.stages[phase], done_at: new Date(now).toISOString() };
  persist();
  ui.choice = undefined;
  ui.shownAt = performance.now();
  renderTest(phase);
  announce(testDone(state) ? '점검을 마쳤습니다.' : `카드 ${state.index + 1}`);
}

/* ------------------------------------------------------------------ 방식 B(플래시카드) */

function bArm() {
  ui.save.arms.B ??= { completed_sessions: 0, cards: {}, current: null };
  return ui.save.arms.B;
}
const bCards = () => armIds(ui.halves, ui.save.assignment, 'B').map((id) => ui.cardsById.get(id));

function persistB() {
  const a = bArm();
  a.completed_sessions = ui.b.completed;
  a.cards = ui.b.progress;
  a.current = ui.b.state;
  if (ui.b.completed >= S.sessionsPerArm && !ui.save.stages['learn-B']?.done_at) ui.save.stages['learn-B'] = { done_at: new Date().toISOString() };
  persist();
}

function startB() {
  const a = bArm();
  const cards = bCards();
  ui.b = { completed: a.completed_sessions ?? 0, progress: restoreProgress(a.cards ?? {}, cards, L), state: null, flipped: false, last: null, notice: '', cards };
  const restored = restoreSession(a.current, cards);
  if (restored && attemptsOf(restored) >= L.count_session_min_answers) {
    ui.b.completed = completedAfter(ui.b.completed, restored, L);
    ui.b.notice = `지난 세션 ${restored.session}을(를) ${attemptsOf(restored)}장으로 마쳤습니다.`;
    newBSession();
  } else if (restored && restored.session === ui.b.completed + 1) {
    ui.b.state = restored;
    ui.shownAt = performance.now();
    renderB();
  } else {
    newBSession();
  }
}

function newBSession() {
  ui.b.last = null;
  ui.b.flipped = false;
  if (ui.b.completed >= S.sessionsPerArm) { ui.b.state = null; persistB(); renderB(); return; }
  const s = ui.b.completed + 1;
  const pick = buildSession(ui.b.cards, ui.b.progress, s, L, sessionSeed(fnv1a(`${ui.dataId}|B`), s, ui.seedParam));
  ui.b.state = createSessionState(s, pick.ids, { kind: 'learn', mix: { due: pick.due, fresh: pick.fresh } });
  ui.shownAt = performance.now();
  persistB();
  renderB();
}

function bHead() {
  const st = ui.b.state;
  return el('div', { class: 'study-head' },
    el('span', { class: 'badge' }, `방식 B · ${ui.pid}`),
    el('span', { id: 'b-session' }, st ? `세션 ${st.session}` : ''),
    el('span', { id: 'b-progress', dataset: { index: String(st?.index ?? 0) } }, st && !isSessionDone(st) ? `카드 ${st.index + 1} / ${st.queue.length}` : ''),
    el('a', { class: 'btn btn-small', id: 'btn-menu', href: menuUrl() }, '진행자'));
}

function back(card) {
  return [
    el('h3', { class: 'result-title' }, card.title),
    el('p', { class: 'result-meta' }, card.reign && !card.year_label.includes(card.reign) ? `${card.year_label} · ${card.reign}` : card.year_label),
    el('p', { class: 'result-exp' }, card.explanation),
    card.exam_note ? el('p', { class: 'result-note', id: 'result-note' }, el('b', {}, '수험 정리 '), card.exam_note) : null,
    el('p', { class: 'result-source', id: 'result-source' }, `출처: ${card.source?.name ?? ''}`),
  ];
}

function renderB() {
  document.body.dataset.screen = 'learn-B';
  const st = ui.b.state;
  if (!st) {
    root(bHead(), el('section', { class: 'card card-empty' },
      el('p', { class: 'empty-title', id: 'study-done' }, `학습 세션 ${S.sessionsPerArm}회를 마쳤습니다.`),
      el('p', { class: 'source-note' }, '진행자에게 알려 주세요.'),
      el('a', { class: 'btn btn-primary', id: 'btn-menu-done', href: menuUrl() }, '진행자 메뉴로')));
    return;
  }
  if (ui.b.last) { renderBResult(); return; }
  const id = currentId(st);
  if (!id) {
    if (isSessionDone(st) && attemptsOf(st) > 0) { renderBSummary(); return; }
    root(bHead(), el('section', { class: 'card card-empty' },
      el('p', { class: 'empty-title', id: 'empty-title' }, '오늘 도래한 카드를 모두 했습니다.'),
      ui.b.notice ? el('p', { class: 'source-note', id: 'notice' }, ui.b.notice) : null,
      el('button', { type: 'button', class: 'btn btn-primary', id: 'btn-skip', onclick: () => { ui.b.completed += 1; ui.b.notice = ''; newBSession(); } }, '다음 세션으로'),
      el('p', { class: 'source-note' }, '"다음 세션으로"는 하루가 지난 것으로 칩니다(세션 번호 +1).')));
    return;
  }
  const card = ui.cardsById.get(id);
  const retry = isRetry(st);
  const e = ui.b.progress[id];
  const box = e?.introduced ? e.box : 1;
  const flipped = ui.b.flipped;
  root(bHead(), el('article', { class: 'card flash' + (flipped ? ' is-flipped' : ''), id: 'flash', dataset: { cardId: id, flipped: flipped ? '1' : '0' }, tabindex: '-1' },
    el('div', { class: 'card-head' }, el('span', { class: 'badge' }, '사료'), el('span', { class: 'card-title' }, '어느 왕 때일까?'),
      retry ? el('span', { class: 'badge badge-retry', id: 'retry-badge' }, '다시 풀기') : null),
    retry ? el('p', { class: 'source-note' }, '앞에서 몰랐던 카드입니다. 상자는 바뀌지 않는 연습입니다.') : null,
    ui.b.notice ? el('p', { class: 'source-note notice', id: 'notice' }, ui.b.notice) : null,
    el('blockquote', { class: 'source-text', id: 'source-text' }, card.source_text),
    flipped ? el('div', { class: 'flash-back', id: 'flash-back' }, ...back(card).filter(Boolean)) : el('p', { class: 'source-note' }, '속으로 답한 뒤 카드를 뒤집어 확인하세요.'),
    flipped
      ? el('div', { class: 'clue-bar' },
        el('button', { type: 'button', class: 'btn btn-primary', id: 'btn-knew', onclick: () => rateB(true) }, '알았다'),
        el('button', { type: 'button', class: 'btn', id: 'btn-didnt', onclick: () => rateB(false) }, '몰랐다'),
        el('span', { class: 'cost' }, retry ? '연습이라 상자는 바뀌지 않습니다.' : `알았다면 상자 ${box}→${previewBox(e, true, 0, L)} · 몰랐다면 상자 1${e?.probation ? ` · 재학습 중(${L.probation.clean_needed - (e.probation_clean ?? 0)}번 더)` : ''}`))
      : el('button', { type: 'button', class: 'btn btn-primary', id: 'btn-flip', onclick: () => { ui.b.flipped = true; renderB(); $('btn-knew').focus(); } }, '뒤집기'),
    !flipped ? el('button', { type: 'button', class: 'btn btn-small btn-quiet', id: 'btn-end', onclick: confirmEndB }, '세션 끝내기') : null));
  if (!flipped) $('flash').focus();
}

function rateB(knew) {
  const now = new Date();
  const st = ui.b.state;
  const { state, progress, result } = rateCurrent(st, knew, ui.b.progress, L, now.toISOString());
  if (!result) return;
  ui.save.log = [...ui.save.log, logLine({ ts: now.getTime(), participant: ui.pid, result, session: st.session, msOnCard: Math.round(performance.now() - ui.shownAt), phase: 'learn', arm: 'B' })];
  ui.b.state = state;
  ui.b.progress = progress;
  ui.b.last = result;
  ui.b.flipped = false;
  ui.b.notice = '';
  persistB();
  renderB();
  $('b-next').focus();
}

function renderBResult() {
  const r = ui.b.last;
  const st = ui.b.state;
  const entry = ui.b.progress[r.id];
  let line;
  if (r.retry) line = `다시 풀기 · 상자 ${r.boxTo}는 그대로(다음 세션 기준)`;
  else {
    const wait = entry.due_session - st.session;
    line = `상자 ${r.boxFrom ?? '새 카드'} → ${r.boxTo} · ${wait <= 1 ? '다음 세션에 다시' : `${wait}세션 뒤 복습`}${!r.correct && L.relearn_in_session ? ' · 이번 세션 끝에 한 번 더' : ''}`
      + (entry.probation ? ` · 재학습 표시: ${L.probation.clean_needed - (entry.probation_clean ?? 0)}번 연속 알았다면 상자 2` : '');
  }
  root(bHead(), el('section', { class: `card card-result ${r.correct ? 'is-right' : 'is-wrong'}` },
    el('div', { class: 'result-head', id: 'result', dataset: { result: r.correct ? 'knew' : 'didnt' } }, r.correct ? '알았다' : '몰랐다'),
    el('h3', { class: 'result-title' }, ui.cardsById.get(r.id).title),
    el('p', { class: 'result-box', id: 'result-box', dataset: { from: String(r.boxFrom ?? ''), to: String(r.boxTo ?? '') } }, line),
    el('button', { type: 'button', class: 'btn btn-primary', id: 'b-next', onclick: () => { ui.b.last = null; ui.shownAt = performance.now(); renderB(); } },
      isSessionDone(st) ? '세션 결과 보기' : '다음 카드')));
}

function renderBSummary() {
  const st = ui.b.state;
  const s = sessionSummary(st);
  const end = () => { ui.b.completed = completedAfter(ui.b.completed, st, L); ui.b.state = null; newBSession(); };
  root(bHead(), el('section', { class: 'card', id: 'b-summary' },
    el('h2', { id: 'b-summary-title' }, `세션 ${st.session} 결과`),
    el('dl', { class: 'stats', id: 'b-summary-stats', dataset: { right: String(s.right), total: String(s.total) } },
      el('dt', {}, '알았다'), el('dd', {}, `${s.right} / ${s.total}`),
      el('dt', {}, '다시 풀기'), el('dd', { id: 'b-summary-retry' }, s.retried ? `${s.retryRight} / ${s.retried} 알았다` : '없음')),
    el('ol', { class: 'summary-list' }, st.placed.map((p) => el('li', { dataset: { id: p.id } },
      el('span', { class: p.correct ? 'ok' : 'bad' }, p.correct ? '○' : '✕'), ` ${ui.cardsById.get(p.id).title} · 상자 ${p.boxFrom ?? '새'}→${p.boxTo}`))),
    el('button', { type: 'button', class: 'btn btn-primary', id: 'b-summary-next', onclick: end },
      ui.b.completed + 1 >= S.sessionsPerArm ? '학습 단계 끝' : '다음 세션')));
  $('b-summary-next').focus();
}

function confirmEndB() {
  const n = attemptsOf(ui.b.state);
  openModal('세션을 끝낼까요?', [el('p', {}, n ? `${n}장을 풀었습니다. 남은 카드는 다음 세션에 다시 나옵니다.` : '아직 한 장도 풀지 않아 세션 번호는 그대로입니다.')],
    [el('button', { type: 'button', class: 'btn', id: 'end-cancel', onclick: closeModal }, '계속하기'),
      el('button', { type: 'button', class: 'btn btn-primary', id: 'end-confirm', onclick: () => { closeModal(); ui.b.completed = completedAfter(ui.b.completed, ui.b.state, L); ui.b.state = null; newBSession(); } }, '끝내기')], 'end');
}

/* ------------------------------------------------------------------ 시작 */

export async function start(params) {
  ui.params = params;
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  ui.seedParam = Number.isFinite(seed) ? seed >>> 0 : 0;
  document.querySelector('header.top').hidden = true;
  document.querySelector('main.layout').hidden = true;
  document.querySelector('footer.foot').before(el('main', { id: 'study', class: 'study' }));
  document.title = '한능검 연표 — 사람 테스트(M1)';
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
  let loaded;
  try {
    const { url, raw } = await loadRaw(params.get('data') ? [params.get('data')] : CONFIG.study.dataUrls);
    const norm = normalizeDeck(raw);
    const errs = [...norm.errors, ...(norm.deck ? validateDeck(norm.deck) : [])];
    if (errs.length) throw new Error(`데이터 오류 ${errs.length}건: ${errs.slice(0, 3).join(' / ')}`);
    loaded = { url, deck: norm.deck };
  } catch (e) {
    root(el('p', {}, String(e.message)));
    document.body.dataset.ready = 'error';
    return;
  }
  ui.deck = loaded.deck;
  ui.dataId = dataFingerprint(loaded.url, ui.deck);
  ui.cardsById = new Map(ui.deck.cards.map((c) => [c.id, c]));
  ui.anchorsById = new Map(ui.deck.anchors.map((a) => [a.id, a]));
  ui.halves = splitHalves(ui.deck.cards, S.halves);
  const unverified = [...ui.deck.cards, ...ui.deck.anchors].some((c) => !c.verified);
  $('data-info').textContent = `데이터: ${loaded.url.split('/').pop()} · 카드 ${ui.deck.cards.length}장 · 기준 ${ui.deck.anchors.length}장 · 사람 테스트 모드`;
  $('data-warn').textContent = unverified ? '사실 확인 전 카드입니다. 공부 자료로 믿지 마세요.' : '';

  const pid = params.get('participant') ?? '';
  ui.pid = validParticipant(pid) ? pid : '';
  ui.store = ui.pid ? createStore(S.storagePrefix + ui.pid) : null;
  ui.save = ui.store?.load() ?? null;
  const stage = params.get('stage');
  const ok = ui.save && ui.save.dataId === ui.dataId;
  if (ok && TEST_PHASES.includes(stage) && !ui.save.stages[stage]?.done_at) startTest(stage);
  else if (ok && stage === 'learn-B') startB();
  else renderMenu();
  document.body.dataset.ready = 'true';
}
