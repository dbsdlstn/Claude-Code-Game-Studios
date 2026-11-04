/**
 * 첫 실행 튜토리얼. 기준 카드 1장과 연습 카드 1장으로 "시기 정의 → 단서 1 → 관계 단서로 칸 좁히기 → 배치 → 해설"을 직접 해 본다.
 * 먹물·도감·저장에 영향을 주지 않는다. 언제든 건너뛸 수 있다.
 */
import { NATIONS, ERAS, nationLabel, eraLabel } from '../rules.js';
import { $, el, clueText, LEVEL_LABEL, TYPE_LABEL, illustration, hiddenIllustration, NATION_SEAL } from './dom.js';
import { makeDraggable } from './drag.js';
import { wireRefHighlight } from './refs.js';

const STEPS = ['eras', 'clue1', 'relation', 'explain'];

/**
 * @param {{anchor: object, card: object}} pair
 * @param {{onFinish: (skipped: boolean) => void}} hooks
 */
export function createTutorial(pair, hooks) {
  const { anchor, card } = pair;
  const where = (a) => `${nationLabel(a.nation)} ${eraLabel(a.era)}`;
  const t = { step: 0, shown: 1, selected: false, placed: null, wrongTries: 0 };
  let wired = false;

  function setStep(i) {
    t.step = i;
    render();
  }

  function stepText() {
    const name = STEPS[t.step];
    if (name === 'eras') {
      return [
        el('h3', {}, '보드 읽기'),
        el('p', {}, '세로줄은 나라(고구려·백제·신라·가야), 가로줄은 시기입니다. 시기는 연도가 아니라 ', el('b', {}, '사건의 성격'), '으로 나눕니다.'),
        el('ul', { class: 'era-list' }, ERAS.map((e) => el('li', {}, el('b', {}, e.label), ` — ${e.definition}`))),
        el('p', {}, '열 머리글에 이 정의가 늘 적혀 있습니다. 진하게 놓인 ', el('b', {}, '기준 카드'), '는 이름이 보이는 카드로, 단서가 가리키는 이정표입니다.'),
      ];
    }
    if (name === 'clue1') {
      return [
        el('h3', {}, '단서 1 — 장면'),
        el('p', {}, '카드 이름은 숨겨져 있습니다. 1단계 단서는 나라와 시기를 말하지 않고 장면만 보여 줍니다.'),
        el('p', {}, '이것만으로 모르겠으면 카드 아래 ', el('b', {}, '단서 더 보기'), '를 눌러 보세요.'),
      ];
    }
    if (name === 'relation') {
      return [
        el('h3', {}, '단서 2 — 관계로 칸 좁히기'),
        el('p', {}, '2단계 단서는 기준 카드와의 관계입니다. ', el('b', {}, `[${anchor.title}]`), `은 보드의 ${where(anchor.answer)} 칸에 있습니다(강조된 칸).`),
        el('p', {}, '단서가 말하는 관계를 따라가 칸을 고르세요. 카드를 끌어 놓거나, 카드를 누른 뒤 칸을 누릅니다. 키보드는 카드에서 Enter → 방향키 → Enter.'),
        el('p', { class: 'meta' }, '연습이라 틀려도 먹물이 줄지 않습니다.'),
      ];
    }
    return [
      el('h3', {}, '해설과 규칙'),
      el('p', {}, '맞히면 이름이 공개되고 ', el('b', {}, '도감'), '에 모입니다. 해설은 그 시기로 분류되는 이유를 알려 줍니다.'),
      el('ul', { class: 'rule-list' },
        el('li', {}, '틀리면 먹물 1 소모, 정답 칸이 공개되고 카드는 소모됩니다.'),
        el('li', {}, '먹물 5개가 모두 떨어지면 라운드 실패, 다시 도전합니다.'),
        el('li', {}, '한 라운드는 12장. 아직 모으지 않은 카드가 먼저 나오고, 같은 칸의 카드가 여러 장 나올 수도 있습니다.'),
        el('li', {}, '판정 카드 36장을 모두 모으면 도감 완성입니다.')),
    ];
  }

  function renderCard() {
    const box = $('tut-card');
    if (STEPS[t.step] === 'eras') { box.hidden = true; return; }
    box.hidden = false;
    if (t.placed?.correct) {
      box.className = 'card tut-card revealed';
      box.replaceChildren(
        illustration(card, hooks.assetRoot ?? '../', 'illust-side'),
        el('div', { class: 'card-head' }, el('span', { class: 'card-title revealed-title' }, card.title), el('span', { class: 'card-type' }, TYPE_LABEL[card.type] ?? card.type)),
        el('p', { class: 'fb-meta' }, where(card.answer), card.date_label ? ` · ${card.date_label}` : ''),
        el('p', { class: 'fb-exp', id: 'tut-explanation' }, card.explanation));
      return;
    }
    box.className = 'card tut-card' + (t.selected ? ' selected' : '');
    const canMore = (STEPS[t.step] === 'clue1' && t.shown < 2) || (STEPS[t.step] === 'relation' && t.shown < 3 && t.wrongTries > 0);
    box.replaceChildren(
      hiddenIllustration(),
      el('div', { class: 'card-head' }, el('span', { class: 'card-title' }, '？ 이름 숨김')),
      el('ol', { class: 'clues' }, card.clues.slice(0, t.shown).map((cl, i) => el('li', {
        class: 'clue' + (i === t.shown - 1 && i > 0 ? ' clue-new' : ''), dataset: { kind: cl.kind },
      }, el('span', { class: 'clue-level' }, LEVEL_LABEL[cl.level]), clueText(cl.text, (title) => (title === anchor.title ? { id: anchor.id, label: where(anchor.answer) } : null))))),
      el('div', { class: 'card-foot' },
        el('span', { class: 'clue-count' }, `단서 ${t.shown} / 3`),
        el('button', {
          type: 'button', id: 'tut-more', class: 'btn' + (canMore ? ' pulse' : ''), disabled: !canMore,
          onclick: (e) => { e.stopPropagation(); more(); },
          onkeydown: (e) => e.stopPropagation(),
        }, '단서 더 보기')));
  }

  function renderBoard() {
    const board = $('tut-board');
    const focusAnchor = STEPS[t.step] === 'relation';
    const nodes = [el('div', { class: 'corner' })];
    for (const e of ERAS) {
      nodes.push(el('div', { class: 'era-head' + (STEPS[t.step] === 'eras' ? ' tut-focus' : '') },
        el('span', { class: 'era-name' }, e.label), el('span', { class: 'era-def' }, e.definition)));
    }
    for (const n of NATIONS) {
      nodes.push(el('div', { class: `nation-head nation-${n.id}` },
        el('span', { class: 'seal', 'aria-hidden': 'true' }, NATION_SEAL[n.id] ?? n.label[0]),
        el('span', { class: 'nation-name' }, n.label)));
      for (const e of ERAS) {
        const isAnchor = anchor.answer.nation === n.id && anchor.answer.era === e.id;
        const isAnswer = t.placed?.correct && card.answer.nation === n.id && card.answer.era === e.id;
        const wrongHere = t.placed && !t.placed.correct && t.placed.nation === n.id && t.placed.era === e.id;
        nodes.push(el('button', {
          type: 'button',
          class: 'cell' + (isAnchor && focusAnchor ? ' tut-focus' : '') + (isAnswer ? ' flash-ok' : '') + (wrongHere ? ' flash-bad' : ''),
          dataset: { nation: n.id, era: e.id },
          'aria-label': `${n.label} ${e.label} 칸`,
          onclick: () => { if (t.selected) place(n.id, e.id); },
          onkeydown: (ev) => onCellKey(ev, n.id, e.id),
        },
        isAnchor ? el('span', { class: 'chip chip-anchor', dataset: { id: anchor.id } }, anchor.title) : null,
        isAnswer ? el('span', { class: 'chip chip-ok chip-new' }, card.title) : null,
        isAnswer ? el('span', { class: 'stamp', 'aria-hidden': 'true' }, '正') : null,
        wrongHere ? el('span', { class: 'blot', 'aria-hidden': 'true' }) : null));
      }
    }
    board.replaceChildren(...nodes);
    board.classList.toggle('armed', t.selected);
  }

  function render() {
    $('tut-progress').textContent = `${t.step + 1} / ${STEPS.length}`;
    $('tut-step').dataset.step = STEPS[t.step];
    $('tut-step').replaceChildren(...stepText());
    renderCard();
    renderBoard();
    const next = $('tut-next');
    const name = STEPS[t.step];
    next.hidden = name === 'clue1' || (name === 'relation' && !t.placed?.correct);
    next.textContent = name === 'explain' ? '본게임 시작' : '다음';
    if (name !== 'relation' || t.placed?.correct) $('tut-feedback').replaceChildren();
  }

  function more() {
    if (t.shown >= 3) return;
    t.shown += 1;
    if (STEPS[t.step] === 'clue1') setStep(2);
    else render();
    $('tut-card').focus();
  }

  function place(nation, era) {
    if (STEPS[t.step] !== 'relation') return;
    const correct = card.answer.nation === nation && card.answer.era === era;
    t.placed = { nation, era, correct };
    t.selected = false;
    if (correct) {
      t.step = 3;
      render();
      $('tut-feedback').replaceChildren(el('div', { class: 'fb fb-ok fb-enter', id: 'tut-fb', dataset: { result: 'correct' } },
        el('div', { class: 'fb-head' }, el('span', { class: 'fb-mark' }, '○'), '정답! 관계 단서로 칸을 찾았습니다')));
      $('tut-next').focus();
    } else {
      t.wrongTries += 1;
      render();
      $('tut-feedback').replaceChildren(el('div', { class: 'fb fb-bad fb-enter', id: 'tut-fb', dataset: { result: 'wrong' } },
        el('div', { class: 'fb-head' }, el('span', { class: 'fb-mark' }, '✕'), `${where({ nation, era })}는 아닙니다`),
        el('p', {}, '본게임이라면 먹물 1을 잃고 정답이 공개됩니다. 연습이니 다시 놓아 보세요. 막히면 3단계 단서를 열 수 있습니다.')));
    }
  }

  function onCellKey(ev, nation, era) {
    const ni = NATIONS.findIndex((n) => n.id === nation);
    const ei = ERAS.findIndex((e) => e.id === era);
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (!moves[ev.key]) return;
    ev.preventDefault();
    const [dn, de] = moves[ev.key];
    const n2 = NATIONS[Math.min(Math.max(ni + dn, 0), NATIONS.length - 1)].id;
    const e2 = ERAS[Math.min(Math.max(ei + de, 0), ERAS.length - 1)].id;
    document.querySelector(`#tut-board .cell[data-nation="${n2}"][data-era="${e2}"]`)?.focus();
  }

  function wire() {
    if (wired) return;
    wired = true;
    const cardEl = $('tut-card');
    wireRefHighlight(cardEl, () => $('tut-board'));
    makeDraggable(cardEl, {
      board: $('tut-board'),
      ghost: $('drag-ghost'),
      label: (c) => `${nationLabel(c.dataset.nation)} ${eraLabel(c.dataset.era)}`,
      canDrag: () => STEPS[t.step] === 'relation' && !t.placed?.correct,
      onDrop: (n, e) => place(n, e),
      onClick: () => { if (STEPS[t.step] === 'relation' && !t.placed?.correct) { t.selected = !t.selected; render(); } },
    });
    cardEl.addEventListener('keydown', (e) => {
      if (e.target !== cardEl || STEPS[t.step] !== 'relation' || t.placed?.correct) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        t.selected = true;
        render();
        document.querySelector('#tut-board .cell')?.focus();
      }
    });
    $('tut-next').addEventListener('click', () => {
      if (STEPS[t.step] === 'explain') finish(false);
      else setStep(t.step + 1);
    });
    $('tut-skip').addEventListener('click', () => finish(true));
  }

  function finish(skipped) {
    $('tutorial').hidden = true;
    hooks.onFinish(skipped);
  }

  return {
    open() {
      Object.assign(t, { step: 0, shown: 1, selected: false, placed: null, wrongTries: 0 });
      wire();
      $('tutorial').hidden = false;
      render();
      $('tut-next').focus();
    },
  };
}
