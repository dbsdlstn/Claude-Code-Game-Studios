/**
 * 화면 연결. 규칙은 rules.js, 저장은 storage.js, 로딩은 data.js, 공용 DOM은 ui/에 있다.
 * 흐름: 타이틀 → (첫 실행이면) 튜토리얼 → 본게임 → 라운드 결과 → 도감.
 */
import { CONFIG } from './config.js';
import { loadCards, resolveDataUrls } from './data.js';
import { createStore } from './storage.js';
import {
  NATIONS, ERAS, nationLabel, eraLabel, validateCards, anchorCards, playableCards, releaseFilter,
  createRound, roundStatus, currentCardId, revealNextClue, placeCard, boardCells, roundStats,
  recordInCollection, serializeRound, restoreRound, restoreCollection, isDogamComplete, dogamProgress,
  summarizeRound, historyStats, restoreHistory, dataFingerprint, parseTutorial, TUTORIAL_RELEASE_EMPTY,
} from './rules.js';
import { $, el, clueText, TYPE_LABEL, LEVEL_LABEL, inkDrops, illustration, hiddenIllustration, NATION_SEAL } from './ui/dom.js';
import { makeDraggable } from './ui/drag.js';
import { wireRefHighlight } from './ui/refs.js';
import { createTutorial } from './ui/tutorial.js';

const HELP_IDLE = '카드를 끌어 칸에 놓거나, 카드를 눌러 고른 뒤 칸을 누르세요.';
const HELP_ARMED = '칸을 누르거나 방향키로 칸을 고르고 Enter로 놓으세요. Esc로 취소.';

const app = {
  store: createStore(CONFIG.storageKey),
  cards: [], cardsById: new Map(), anchors: [], playable: [], dataFile: '', dataId: '',
  round: null, collection: Object.freeze({}), meta: {}, history: [],
  selected: false, lastResult: null, lostInk: false, dogamActive: null,
  seedParam: null, focusCell: null, tutorial: null, tutorialNotice: '',
};

const where = (a) => `${nationLabel(a.nation)} ${eraLabel(a.era)}`;

function newSeed() {
  if (app.seedParam !== null) return (app.seedParam + (app.round ? app.round.seed + 1 : 0)) >>> 0;
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}

function persist() {
  app.store.save({ dataId: app.dataId, round: serializeRound(app.round), collection: app.collection, meta: app.meta, history: app.history });
}

function newRoundState() {
  return createRound(app.playable, { seed: newSeed(), startInk: CONFIG.startInk, collection: app.collection });
}

/* ------------------------------------------------------------------ 본게임 렌더 */

/** 행 머리글: 나라 인장(한 글자) + 나라 이름. 선택지 쪽 표시라 정답 누출이 아니다(D37). */
function nationHead(n) {
  return el('div', { class: `nation-head nation-${n.id}`, dataset: { nation: n.id } },
    el('span', { class: 'seal', 'aria-hidden': 'true' }, NATION_SEAL[n.id] ?? n.label[0]),
    el('span', { class: 'nation-name' }, n.label));
}

/** 관계 단서의 [제목] → 보드에 있는 기준 카드. */
function resolveAnchorRef(title) {
  const a = app.anchors.find((c) => c.title === title);
  return a ? { id: a.id, label: where(a.answer) } : null;
}


function renderTop() {
  const { ink: n, startInk } = app.round;
  const ink = $('ink');
  ink.replaceChildren(el('span', { class: 'ink-label' }, '먹물'), ...inkDrops(n, startInk, app.lostInk ? n : -1));
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
  box.dataset.cardId = id; // E2E가 정답을 데이터에서 찾을 때 쓴다(화면에는 보이지 않음).
  // 숨김 상태에는 유형·나라·시기를 짐작하게 하는 정보를 두지 않는다(D37). 접근성 이름도 마찬가지.
  box.setAttribute('aria-label', '이름이 숨겨진 카드. Enter로 고른 뒤 방향키로 칸을 고르고 Enter로 놓습니다.');
  box.replaceChildren(
    hiddenIllustration(),
    el('div', { class: 'card-head' },
      el('span', { class: 'card-title' }, '？ 이름 숨김')),
    el('ol', { class: 'clues', id: 'clues' },
      card.clues.slice(0, app.round.shown).map((cl, i) => el('li', {
        class: 'clue' + (i === app.round.shown - 1 && i > 0 ? ' clue-new' : ''), dataset: { kind: cl.kind, level: String(cl.level) },
      }, el('span', { class: 'clue-level' }, LEVEL_LABEL[cl.level] ?? ''), clueText(cl.text, resolveAnchorRef)))),
    el('div', { class: 'card-foot' },
      el('span', { class: 'clue-count' }, `단서 ${app.round.shown} / ${card.clues.length}`),
      el('button', {
        id: 'more-clue', type: 'button', class: 'btn',
        disabled: app.round.shown >= card.clues.length,
        onclick: (e) => { e.stopPropagation(); onMoreClue(); },
        onkeydown: (e) => e.stopPropagation(),
      }, '단서 더 보기')),
  );
}

function renderBoard() {
  const cells = boardCells(app.round, app.anchors);
  const r = app.lastResult;
  const nodes = [el('div', { class: 'corner' })];
  for (const e of ERAS) {
    nodes.push(el('div', { class: 'era-head', dataset: { era: e.id } },
      el('span', { class: 'era-name' }, e.label), el('span', { class: 'era-def' }, e.definition)));
  }
  for (const n of NATIONS) {
    nodes.push(nationHead(n));
    for (const e of ERAS) {
      const c = cells[`${n.id}:${e.id}`];
      const isAnswer = r && r.answer.nation === n.id && r.answer.era === e.id;
      const isWrongPlace = r && !r.correct && r.placed.nation === n.id && r.placed.era === e.id;
      nodes.push(el('button', {
        type: 'button', class: 'cell' + (isAnswer ? ' flash-ok' : '') + (isWrongPlace ? ' flash-bad' : ''),
        dataset: { nation: n.id, era: e.id },
        'aria-label': `${n.label} ${e.label} 칸, 카드 ${c.anchors.length + c.placed.length}장`,
        onclick: () => onCellClick(n.id, e.id),
        onkeydown: (ev) => onCellKey(ev, n.id, e.id),
      },
      c.anchors.map((id) => el('span', { class: 'chip chip-anchor', dataset: { id } }, app.cardsById.get(id).title)),
      c.placed.map((p) => el('span', {
        class: 'chip ' + (p.correct ? 'chip-ok' : 'chip-bad') + (r && r.id === p.id ? ' chip-new' : ''),
        dataset: { id: p.id },
      }, el('span', { class: 'sr-only' }, p.correct ? '정답: ' : '오답 공개: '), app.cardsById.get(p.id).title)),
      isAnswer && r.correct ? el('span', { class: 'stamp', 'aria-hidden': 'true' }, '正') : null,
      isWrongPlace ? el('span', { class: 'blot', 'aria-hidden': 'true' }) : null));
    }
  }
  $('board').replaceChildren(...nodes);
  $('board').classList.toggle('armed', app.selected);
}

function renderFeedback() {
  const box = $('feedback');
  const r = app.lastResult;
  if (!r) { box.replaceChildren(); return; }
  const card = app.cardsById.get(r.id);
  box.replaceChildren(el('div', { class: 'fb fb-enter ' + (r.correct ? 'fb-ok' : 'fb-bad'), id: 'fb', dataset: { result: r.correct ? 'correct' : 'wrong' } },
    illustration(card, CONFIG.assetRoot, 'illust-side'),
    el('div', { class: 'fb-head' },
      el('span', { class: 'fb-mark', 'aria-hidden': 'true' }, r.correct ? '○' : '✕'),
      r.correct ? (r.isNew ? '정답 · 도감에 수집' : '정답 · 이미 수집한 카드') : '오답 · 먹물 1 소모'),
    el('div', { class: 'fb-title' }, card.title),
    el('div', { class: 'fb-meta' },
      `${TYPE_LABEL[card.type] ?? card.type} · `,
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

/* ------------------------------------------------------------------ 본게임 동작 */

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
  $('hand-help').textContent = app.selected ? HELP_ARMED : HELP_IDLE;
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
    focusCellAt({
      nation: NATIONS[Math.min(Math.max(ni + dn, 0), NATIONS.length - 1)].id,
      era: ERAS[Math.min(Math.max(ei + de, 0), ERAS.length - 1)].id,
    });
  } else if (ev.key === 'Escape' && app.selected) {
    ev.stopPropagation();
    setSelected(false);
    $('card').focus();
  }
}

function place(nation, era) {
  const before = isDogamComplete(app.playable, app.collection);
  const { state, result } = placeCard(app.round, app.cardsById, nation, era, app.collection);
  if (!result) return;
  app.round = state;
  app.collection = recordInCollection(app.collection, result);
  app.lastResult = result;
  app.lostInk = !result.correct;
  app.focusCell = { nation, era };
  const status = roundStatus(app.round);
  if (status !== 'playing') {
    // 끝난 라운드는 한 번만 기록한다(D12: 도중에 새 라운드를 시작하면 기록하지 않음).
    app.history = [...app.history, summarizeRound(app.round, { at: new Date().toISOString(), dataFile: app.dataFile })];
  }
  persist();
  render();
  setSelected(false);
  app.lostInk = false;
  const title = app.cardsById.get(result.id).title;
  announce(result.correct
    ? `정답. ${title}, ${where(result.answer)}. ${result.isNew ? '도감에 수집했습니다. ' : ''}먹물 ${app.round.ink}개 남음.`
    : `오답. 먹물 1개 소모, ${Math.max(app.round.ink, 0)}개 남음. ${title}의 정답 칸은 ${where(result.answer)}.`);
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

/* ------------------------------------------------------------------ 모달 */

function openModal(title, body, actions, kind, { wide = false } = {}) {
  $('modal-title').textContent = title;
  $('modal-body').replaceChildren(...body);
  $('modal-actions').replaceChildren(...actions);
  $('modal').dataset.kind = kind;
  $('modal').querySelector('.modal-sheet').classList.toggle('wide', wide);
  $('modal').hidden = false;
  actions[actions.length - 1]?.focus();
}

function closeModal() {
  $('modal').hidden = true;
  delete $('modal').dataset.kind;
}

/** 라운드 결과: 정답 수, 단서 단계 분포, 새로 수집한 카드, 오답 해설 다시 보기. */
function roundResult() {
  const s = roundStats(app.round);
  const h = summarizeRound(app.round);
  const max = Math.max(1, ...h.levels);
  const fresh = app.round.placements.filter((p) => p.isNew);
  const wrong = app.round.placements.filter((p) => !p.correct);
  return el('div', { class: 'result', id: 'round-result' },
    el('div', { class: 'result-head' },
      el('div', { class: 'result-big' }, el('b', { id: 'result-right' }, String(s.right)), ` / ${s.deck}`, el('span', {}, '정답')),
      el('div', { class: 'result-big' }, el('b', {}, String(Math.max(s.ink, 0))), ` / ${app.round.startInk}`, el('span', {}, '남은 먹물')),
      el('div', { class: 'result-big' }, el('b', {}, String(fresh.length)), el('span', {}, '새로 수집'))),
    s.deck > s.total ? el('p', { class: 'meta' }, `놓지 못한 카드 ${s.deck - s.total}장`) : null,
    el('h4', {}, '몇 단계 단서에서 놓았나'),
    el('div', { class: 'levels', id: 'result-levels' }, h.levels.map((n, k) => el('div', { class: 'level-row', dataset: { level: String(k + 1), count: String(n) } },
      el('span', { class: 'level-name' }, LEVEL_LABEL[k + 1]),
      el('span', { class: 'level-bar' }, el('span', { class: 'level-fill', style: `width:${Math.round((100 * n) / max)}%` })),
      el('span', { class: 'level-n' }, `${n}장`)))),
    el('h4', {}, `새로 수집한 카드 ${fresh.length}장`),
    fresh.length
      ? el('div', { class: 'chips', id: 'result-new' }, fresh.map((p) => el('span', { class: 'chip chip-ok', dataset: { id: p.id } }, app.cardsById.get(p.id).title)))
      : el('p', { class: 'meta', id: 'result-new' }, '이번 라운드에 새로 모은 카드가 없습니다.'),
    wrong.length ? el('h4', {}, `오답 다시 보기 ${wrong.length}장`) : null,
    wrong.length ? el('div', { class: 'wrong-list', id: 'result-wrong' }, wrong.map((p) => {
      const c = app.cardsById.get(p.id);
      return el('details', { class: 'wrong-item', dataset: { id: p.id } },
        el('summary', {}, el('b', {}, c.title), ` — 놓은 칸 ${where({ nation: p.placedNation, era: p.placedEra })} → 정답 ${where(p)}`),
        el('p', {}, c.explanation),
        c.date_label ? el('p', { class: 'meta' }, c.date_label) : null);
    })) : null);
}

function dogamButton() {
  return el('button', { type: 'button', class: 'btn', id: 'modal-dogam', onclick: () => { closeModal(); openDogam(); } }, '도감 보기');
}

function showEndModal(status) {
  const retry = el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-retry', onclick: startNewRound }, status === 'cleared' ? '새 라운드' : '재도전');
  if (status === 'cleared') {
    openModal('라운드 클리어', [el('p', {}, '먹물이 남은 채 이번 라운드의 12장을 모두 놓았습니다. 새 라운드는 아직 모으지 않은 카드부터 나옵니다.'), roundResult()],
      [dogamButton(), retry], 'cleared', { wide: true });
  } else {
    openModal('먹물이 바닥났습니다', [el('p', {}, '이번 라운드는 실패입니다. 지금까지 수집한 카드는 도감에 남습니다.'), roundResult()],
      [dogamButton(), retry], 'failed', { wide: true });
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
    status === 'playing' ? null : roundResult(),
  ], [dogamButton(), next], 'complete', { wide: status !== 'playing' });
}

function confirmNewRound() {
  if (roundStatus(app.round) !== 'playing' || app.round.index === 0) { startNewRound(); return; }
  openModal('새 라운드를 시작할까요?', [el('p', {}, '지금 라운드의 보드와 먹물이 초기화됩니다. 끝나지 않은 라운드라 플레이 기록에는 남지 않습니다. 도감 수집 기록은 남습니다.')],
    [el('button', { type: 'button', class: 'btn', onclick: closeModal }, '취소'),
      el('button', { type: 'button', class: 'btn btn-primary', id: 'modal-confirm', onclick: startNewRound }, '새 라운드')], 'confirm');
}

function showHowTo() {
  openModal('하는 방법', [
    el('ul', { class: 'rule-list' },
      el('li', {}, '이름이 숨겨진 카드의 단서를 읽고, 나라 × 시기 보드의 칸에 놓습니다.'),
      el('li', {}, '시기는 사건의 성격으로 나눕니다: ', ERAS.map((e, i) => [i ? ' · ' : '', el('b', {}, e.label), `(${e.definition})`])),
      el('li', {}, '단서는 3단계입니다. 1 장면 → 2 기준 카드와의 관계 → 3 직접 힌트. "단서 더 보기"로 엽니다.'),
      el('li', {}, '맞히면 도감에 수집, 틀리면 먹물 1 소모와 정답 공개. 먹물 5가 다 떨어지면 라운드 실패.'),
      el('li', {}, '한 라운드는 12장. 칸과 상관없이 뽑으므로 한 칸에 여러 장이 들어갈 수도, 빈 칸이 남을 수도 있습니다. 36장을 모두 모으면 도감 완성.'),
      el('li', {}, '조작: 끌어서 놓기, 또는 카드를 누르고 칸 누르기. 키보드는 카드에서 Enter → 방향키 → Enter.')),
  ], [
    el('button', { type: 'button', class: 'btn', id: 'howto-tutorial', onclick: () => { closeModal(); hideTitle(); openTutorial(); } }, '튜토리얼 다시 하기'),
    el('button', { type: 'button', class: 'btn btn-primary', id: 'howto-close', onclick: () => { closeModal(); if (!$('title-screen').hidden) $('title-actions').querySelector('button')?.focus(); } }, '닫기'),
  ], 'howto');
}

/* ------------------------------------------------------------------ 타이틀·튜토리얼 */

function hasProgress() {
  return (roundStatus(app.round) === 'playing' && app.round.index > 0) || Object.keys(app.collection).length > 0 || app.history.length > 0;
}

function showTitle() {
  closeModal();
  const dp = dogamProgress(app.playable, app.collection);
  const hs = historyStats(app.history);
  $('title-progress').textContent = hasProgress()
    ? `도감 ${dp.collected} / ${dp.total}장 · 끝낸 라운드 ${hs.rounds}회`
    : `카드 ${dp.total}장 · 한 라운드 12장 · 먹물 ${CONFIG.startInk}`;
  const resumable = roundStatus(app.round) === 'playing' && app.round.index > 0;
  const actions = [];
  if (resumable) {
    actions.push(el('button', { type: 'button', class: 'btn btn-primary btn-big', id: 'title-continue', onclick: () => enterGame(false) }, `이어하기 (카드 ${app.round.index + 1} / ${app.round.order.length})`));
    actions.push(el('button', { type: 'button', class: 'btn btn-big', id: 'title-start', onclick: () => enterGame(true) }, '새 라운드'));
  } else {
    actions.push(el('button', { type: 'button', class: 'btn btn-primary btn-big', id: 'title-start', onclick: () => enterGame(roundStatus(app.round) !== 'playing') }, hasProgress() ? '라운드 시작' : '시작하기'));
  }
  actions.push(el('button', { type: 'button', class: 'btn', id: 'title-dogam', onclick: openDogam }, '도감'));
  actions.push(el('button', { type: 'button', class: 'btn', id: 'title-howto', onclick: showHowTo }, '하는 방법'));
  $('title-actions').replaceChildren(...actions);
  $('title-notice').textContent = app.tutorialNotice;
  $('title-notice').hidden = !app.tutorialNotice;
  $('title-screen').hidden = false;
  actions[0].focus();
}

function hideTitle() {
  $('title-screen').hidden = true;
}

/** 타이틀에서 본게임으로. 튜토리얼을 아직 안 했으면 먼저 튜토리얼. */
function enterGame(fresh) {
  const hadProgress = hasProgress();
  hideTitle();
  if (fresh) {
    app.round = newRoundState();
    app.lastResult = null;
    persist();
  }
  render();
  // 첫 실행(튜토리얼 미완료이고 진행 기록도 없음)에만 튜토리얼을 자동으로 연다. 이미 플레이한 사람은 "하는 방법"에서 다시 볼 수 있다.
  if (!app.meta.tutorialDone && !hadProgress && app.tutorial) { openTutorial(); return; }
  if (!app.meta.tutorialDone && !hadProgress && app.tutorialNotice) $('hand-help').textContent = app.tutorialNotice;
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
  else $('card').focus();
}

function openTutorial() {
  if (!app.tutorial) {
    if (app.tutorialNotice) { $('hand-help').textContent = app.tutorialNotice; announce(app.tutorialNotice); }
    $('card').focus();
    return;
  }
  app.tutorial.open();
}

function onTutorialFinish(skipped) {
  app.meta = { ...app.meta, tutorialDone: true, tutorialSkipped: skipped };
  persist();
  render();
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
  else $('card').focus();
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
  if (!$('title-screen').hidden) { $('title-actions').querySelector('button')?.focus(); return; }
  const status = roundStatus(app.round);
  if (status !== 'playing') showEndModal(status);
  else $('btn-dogam').focus();
}

function selectEntry(id) {
  app.dogamActive = id;
  renderDogam();
  document.querySelector(`#dogam [data-entry="${CSS.escape(id)}"]`)?.focus();
}

function entryButton(c, extraClass = '') {
  const st = dogamState(c);
  const known = st !== 'unknown' || c.disputed;
  return el('button', {
    type: 'button',
    class: `entry ${st}${c.disputed ? ' disputed' : ''}${app.dogamActive === c.id ? ' active' : ''}${extraClass}`,
    dataset: { id: c.id, state: c.disputed ? 'disputed' : st, entry: c.id },
    'aria-label': known ? `${c.title} (${c.disputed ? '견해가 나뉨' : ({ anchor: '기준 카드', collected: '수집', revealed: '오답으로 공개' })[st]})` : '미수집 카드',
    onclick: () => selectEntry(c.id),
  }, known ? c.title : '？？？');
}

function renderDogam() {
  const nodes = [el('div', { class: 'corner' })];
  for (const e of ERAS) {
    nodes.push(el('div', { class: 'era-head' }, el('span', { class: 'era-name' }, e.label), el('span', { class: 'era-def' }, e.definition)));
  }
  for (const n of NATIONS) {
    nodes.push(nationHead(n));
    for (const e of ERAS) {
      // 판정 칸에는 기준 카드와 판정 카드만. disputed 카드는 아래 "견해가 나뉘는 기록"으로 분리(D12).
      const inCell = app.cards.filter((c) => c.answer.nation === n.id && c.answer.era === e.id && !c.disputed)
        .sort((a, b) => Number(b.anchor) - Number(a.anchor));
      const judged = inCell.filter((c) => !c.anchor);
      const got = judged.filter((c) => app.collection[c.id] === 'collected').length;
      nodes.push(el('div', { class: 'cell dogam-cell' + (judged.length && got === judged.length ? ' cell-done' : ''), dataset: { nation: n.id, era: e.id } },
        el('span', { class: 'cell-count' }, `${got} / ${judged.length}`),
        inCell.map((c) => entryButton(c))));
    }
  }
  $('dogam-grid').replaceChildren(...nodes);

  const disputed = app.cards.filter((c) => c.disputed);
  $('dogam-disputed').replaceChildren(...(disputed.length ? disputed.map((c) => el('div', { class: 'disputed-card', dataset: { id: c.id } },
    el('div', { class: 'disputed-top' }, entryButton(c), el('span', { class: 'badge badge-warn' }, '견해가 나뉨')),
    el('p', { class: 'meta' }, `자료상 분류 ${where(c.answer)} · 판정 제외`),
    el('p', { class: 'disputed-note' }, c.disputed_note || ''))) : [el('p', { class: 'meta' }, '없음')]));

  renderPlayRecord();
  const dp = dogamProgress(app.playable, app.collection);
  const revealed = app.playable.filter((c) => app.collection[c.id] === 'revealed').length;
  $('dogam-count').textContent = `수집 ${dp.collected} / ${dp.total}장 · 오답으로 공개 ${revealed}장`;
  $('dogam-count').dataset.collected = String(dp.collected);
  renderDogamDetail();
}

function renderPlayRecord() {
  const hs = historyStats(app.history);
  const box = $('play-record');
  box.dataset.rounds = String(hs.rounds);
  box.replaceChildren(
    el('dl', { class: 'stats record-stats' },
      el('dt', {}, '끝낸 라운드'), el('dd', { id: 'rec-rounds' }, `${hs.rounds}회 (클리어 ${hs.cleared} · 실패 ${hs.failed})`),
      el('dt', {}, '정답률'), el('dd', { id: 'rec-rate' }, hs.placed ? `${hs.rate}% (${hs.right} / ${hs.placed}장)` : '—'),
      el('dt', {}, '평균 단서 단계'), el('dd', { id: 'rec-level' }, hs.placed ? `${hs.avgLevel.toFixed(2)} (1단계 ${hs.levels[0]} · 2단계 ${hs.levels[1]} · 3단계 ${hs.levels[2]})` : '—')),
    el('div', { class: 'record-actions' },
      el('button', { type: 'button', class: 'btn', id: 'btn-export', onclick: exportPlayLog }, '기록 내보내기 (JSON)'),
      el('button', { type: 'button', class: 'btn btn-danger', id: 'btn-reset', onclick: confirmReset1 }, '진행 초기화')));
}

/** 진행 초기화: 두 번 확인한다. 도감, 플레이 기록, 진행 중 라운드, 튜토리얼 완료 표시를 지운다. */
function confirmReset1() {
  openModal('진행을 초기화할까요?', [el('p', {}, '도감 수집, 플레이 기록, 진행 중인 라운드가 모두 지워집니다.')],
    [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
      el('button', { type: 'button', class: 'btn', id: 'reset-next', onclick: confirmReset2 }, '계속')], 'reset1');
  $('reset-cancel').focus();
}

function confirmReset2() {
  const dp = dogamProgress(app.playable, app.collection);
  openModal('정말 모두 지울까요?', [
    el('p', {}, `도감 ${dp.collected}장, 플레이 기록 ${app.history.length}회가 지워지고 되돌릴 수 없습니다. 필요하면 먼저 "기록 내보내기"로 저장하세요.`),
  ], [el('button', { type: 'button', class: 'btn', id: 'reset-cancel', onclick: closeModal }, '취소'),
    el('button', { type: 'button', class: 'btn btn-danger', id: 'reset-confirm', onclick: doReset }, '모두 지우기')], 'reset2');
  $('reset-cancel').focus();
}

function doReset() {
  app.store.clear();
  app.collection = Object.freeze({});
  app.history = [];
  app.meta = {};
  app.dogamActive = null;
  app.lastResult = null;
  app.round = newRoundState();
  persist();
  closeModal();
  $('dogam').hidden = true;
  render();
  announce('진행을 초기화했습니다.');
  showTitle();
}

/** 플레이테스트 데이터 수집용 JSON 내보내기. 카드 본문 대신 id만 담는다. */
function exportPlayLog() {
  const now = new Date();
  const payload = {
    format: 'hanyang-dogam-playlog',
    version: 1,
    exportedAt: now.toISOString(),
    dataFile: app.dataFile,
    cardsJudged: app.playable.length,
    tutorial: { done: !!app.meta.tutorialDone, skipped: !!app.meta.tutorialSkipped },
    collection: {
      collected: Object.keys(app.collection).filter((id) => app.collection[id] === 'collected'),
      revealed: Object.keys(app.collection).filter((id) => app.collection[id] === 'revealed'),
    },
    stats: historyStats(app.history),
    history: app.history,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const pad = (x) => String(x).padStart(2, '0');
  const a = el('a', { href: url, download: `hanyang-playlog-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderDogamDetail() {
  const box = $('dogam-detail');
  const card = app.dogamActive ? app.cardsById.get(app.dogamActive) : null;
  if (!card) {
    box.replaceChildren(el('p', { class: 'meta' }, '카드를 누르면 해설과 출처를 볼 수 있습니다.'),
      el('ul', { class: 'legend' },
        el('li', {}, el('span', { class: 'entry collected' }, '이름'), ' 정답으로 수집'),
        el('li', {}, el('span', { class: 'entry revealed' }, '이름'), ' 오답으로 공개(수집 아님)'),
        el('li', {}, el('span', { class: 'entry unknown' }, '？？？'), ' 아직 만나지 못한 카드'),
        el('li', {}, el('span', { class: 'entry anchor' }, '이름'), ' 기준 카드')));
    return;
  }
  const st = dogamState(card);
  const loc = `${nationLabel(card.answer.nation)} · ${eraLabel(card.answer.era)}${card.date_label ? ' · ' + card.date_label : ''}`;
  if (st === 'unknown' && !card.disputed) {
    box.replaceChildren(hiddenIllustration(), el('h3', { id: 'dogam-detail-title' }, '？？？'), el('p', { class: 'meta' }, loc),
      el('p', {}, '아직 수집하지 않은 카드입니다. 라운드에서 정답으로 놓으면 해설이 열립니다.'));
    return;
  }
  const badges = [];
  if (card.disputed) badges.push(el('span', { class: 'badge badge-warn' }, '견해가 나뉨 · 판정 제외'));
  else if (st === 'collected') badges.push(el('span', { class: 'badge badge-ok' }, '수집'));
  else if (st === 'revealed') badges.push(el('span', { class: 'badge badge-bad' }, '오답으로 공개'));
  else if (st === 'anchor') badges.push(el('span', { class: 'badge' }, '기준 카드'));
  if (!card.verified) badges.push(el('span', { class: 'badge badge-warn' }, '사실 확인 전'));
  const src = card.source ?? {};
  const url = typeof src.url === 'string' && /^https?:\/\//.test(src.url) ? src.url : null;
  box.replaceChildren(...[
    illustration(card, CONFIG.assetRoot, 'illust-detail'),
    el('h3', { id: 'dogam-detail-title' }, card.title),
    el('p', { class: 'meta' }, card.disputed ? `자료상 분류 ${loc}` : loc, ' · ', TYPE_LABEL[card.type] ?? card.type),
    el('div', { class: 'badges' }, badges),
    card.explanation ? el('p', { class: 'exp' }, card.explanation) : null,
    card.disputed && card.disputed_note ? el('p', { class: 'note', id: 'dogam-disputed-note' }, el('b', {}, '견해 '), card.disputed_note) : null,
    el('div', { class: 'src', id: 'dogam-source' },
      el('b', {}, '출처 '), src.name || '미상',
      src.note ? el('div', { class: 'src-note' }, src.note) : null,
      url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, '원문 링크') : null,
      card.image_source ? el('div', { class: 'src-note' }, `이미지: ${card.image_source} (${card.image_license ?? '라이선스 미상'})`) : null),
  ].filter(Boolean));
}

/* ------------------------------------------------------------------ 시작 */

/**
 * 공용 튜토리얼 파일(D31)을 읽는다. 출시 모드면 사실 확인된 연습 카드만 쓰고(D35·D40), 없으면 튜토리얼을 건너뛰고 알린다.
 * 그 밖의 오류나 파일이 없을 때도 튜토리얼 없이 진행한다.
 */
async function loadTutorial() {
  try {
    const res = await fetch(CONFIG.tutorialDataUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const t = parseTutorial(await res.json(), app.cards, { release: CONFIG.onlyVerified });
    if (t.errors.some((e) => e.rule === TUTORIAL_RELEASE_EMPTY)) {
      app.tutorialNotice = '사실 확인된 연습 카드가 없어 튜토리얼을 건너뜁니다. "하는 방법"에서 규칙을 볼 수 있습니다.';
      return null;
    }
    if (t.errors.length) { console.warn('[한양 도감] 튜토리얼 파일 오류', t.errors); return null; }
    return createTutorial({ anchor: t.anchor, card: t.card, boardAnchors: t.boardAnchors }, { onFinish: onTutorialFinish, assetRoot: CONFIG.assetRoot });
  } catch (e) {
    console.warn('[한양 도감] 튜토리얼 파일을 읽지 못했다', e);
    return null;
  }
}

/** 화면 낭독기에 알린다(정답·오답·먹물). 같은 문장이 연달아 와도 읽히도록 비웠다가 넣는다. */
function announce(text) {
  const a = $('announcer');
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = text; });
}

function showLoadError(title, lines) {
  $('card').className = 'card empty error';
  $('card').replaceChildren(el('div', {},
    el('p', {}, el('b', {}, title)),
    el('ul', { class: 'err-list', id: 'load-errors' }, lines.slice(0, 12).map((l) => el('li', {}, l))),
    lines.length > 12 ? el('p', {}, `외 ${lines.length - 12}건 — 콘솔 참고`) : null));
  document.body.dataset.ready = 'error';
}

function wireGame() {
  const card = $('card');
  wireRefHighlight(card, () => $('board'));
  makeDraggable(card, {
    board: $('board'),
    ghost: $('drag-ghost'),
    label: (c) => `${nationLabel(c.dataset.nation)} ${eraLabel(c.dataset.era)}`,
    canDrag: () => !!currentCardId(app.round),
    onDrop: (n, e) => place(n, e),
    onClick: () => setSelected(!app.selected),
    onCancel: () => setSelected(app.selected),
  });
  card.addEventListener('keydown', (e) => {
    if (e.target !== card) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(!app.selected, { focusBoard: true }); }
    if (e.key === 'Escape') setSelected(false);
  });
  $('btn-dogam').addEventListener('click', openDogam);
  $('btn-dogam-close').addEventListener('click', closeDogam);
  $('btn-new').addEventListener('click', confirmNewRound);
  $('btn-home').addEventListener('click', showTitle);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (['confirm', 'howto', 'reset1', 'reset2'].includes($('modal').dataset.kind)) closeModal();
    else if (!$('dogam').hidden) closeDogam();
    else if ($('modal').dataset.kind === 'complete' && roundStatus(app.round) === 'playing') closeModal();
  });
}

async function init() {
  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  app.seedParam = Number.isFinite(seed) ? seed >>> 0 : null;
  const skipTitle = params.get('notitle') === '1'; // 테스트·개발용: 타이틀과 튜토리얼을 건너뛴다.

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
  app.dataFile = loaded.url.split('/').pop();
  if (warnings.length) console.warn('[한양 도감] 카드 데이터 경고', warnings);
  if (errors.length) {
    console.error('[한양 도감] 카드 데이터 검증 오류', errors);
    $('data-info').textContent = `데이터: ${app.dataFile}`;
    showLoadError(`카드 데이터 검증 오류 ${errors.length}건 — 게임을 시작하지 않습니다.`, errors.map((x) => `[${x.rule}] ${x.id}: ${x.message}`));
    return;
  }
  app.cards = cards;
  app.cardsById = new Map(cards.map((c) => [c.id, c]));
  app.anchors = anchorCards(cards);
  app.playable = playableCards(cards);
  app.dataId = dataFingerprint(loaded.url, cards);

  $('data-info').textContent = `데이터: ${app.dataFile} · 판정 카드 ${app.playable.length}장 · 기준 카드 ${app.anchors.length}장`
    + (app.playable.some((c) => !c.verified) ? ' · 플레이테스트 빌드(사실 확인 전 카드 포함)' : '');
  if (warnings.length) $('data-warn').textContent = `데이터 경고 ${warnings.length}건(콘솔 참고)`;

  const saved = app.store.load();
  app.collection = restoreCollection(saved?.collection, app.cards);
  app.meta = saved?.meta && typeof saved.meta === 'object' ? { ...saved.meta } : {};
  app.history = restoreHistory(saved?.history);
  // 다른 데이터에서 저장한 라운드(식별자가 다르거나 없음)는 버린다. 수집 기록은 지금 덱에 있는 id만 남는다.
  const sameData = saved?.dataId === app.dataId;
  if (saved?.round && !sameData) console.info('[한양 도감] 카드 데이터가 바뀌어 진행 중 라운드를 버렸다', { saved: saved.dataId, now: app.dataId });
  app.round = (sameData && restoreRound(saved.round, app.playable)) || newRoundState();
  persist();

  app.tutorial = await loadTutorial();

  wireGame();
  render();
  if (skipTitle) {
    const status = roundStatus(app.round);
    if (status !== 'playing') showEndModal(status);
  } else {
    showTitle();
  }
  document.body.dataset.ready = 'true';
}

init();
