// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// E2E: node --test prototypes/m1-timeline/tests/e2e.test.mjs  (모바일 390×844 터치, 데스크톱 1280×720)
// leitner-spec(D66) 규칙: 상자 갱신 표, 세션 구성(M1: 크기 6, 첫 세션 6장 도입), 재도전, 세션 카운트, 오답 노트, 로그.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chromium, startServer, openProto, currentCard, gapsFor, pressGap, editSave, VIEWPORTS, SAMPLE, REAL, REAL_BY_ID, expectedAnchorYears,
} from './helpers.mjs';

let server;
let browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.stop(); });

for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const mobile = name === 'mobile';
  describe(`${name} ${opts.viewport.width}×${opts.viewport.height}`, () => {
    async function withPage(fn, { query = {} } = {}) {
      const ctx = await browser.newContext({ ...opts, acceptDownloads: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await openProto(page, server.base, query);
        await fn(page);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    }
    /** 현재 세션을 끝까지 둔다. plan(card, firstTime) → 'right' | 'wrong' | 'near'. */
    async function playSession(page, plan = () => 'right') {
      const seen = new Set();
      const out = [];
      while (await page.getAttribute('#card', 'data-card-id')) {
        const card = await currentCard(page);
        const first = !seen.has(card.id);
        seen.add(card.id);
        const how = first ? plan(card) : 'right';
        const g = await gapsFor(page, card, { near: how === 'near' });
        await pressGap(page, how === 'right' ? g.right : g.wrong, mobile);
        out.push({ id: card.id, first, how, from: await page.getAttribute('#result-box', 'data-from'), to: await page.getAttribute('#result-box', 'data-to'), boxText: await page.innerText('#result-box') });
        await page.click('#btn-next');
      }
      return out;
    }

    test('첫 화면: 이름 숨긴 사료, 왕 단위 연표(재위 기간), 칸 = 앵커 수, 세션 6장, 가로 넘침 없음', () => withPage(async (page) => {
      const card = await currentCard(page);
      const text = await page.innerText('#card');
      assert.ok(text.includes(card.source_text));
      assert.ok(!text.includes(card.title));
      assert.doesNotMatch(text, /\bnull\b|undefined/);
      assert.match(await page.innerText('#progress'), /카드 1 \/ 6/);
      assert.deepEqual(await page.locator('#timeline .row-anchor .row-title').allInnerTexts(), [...SAMPLE.anchors].sort((a, b) => a.order - b.order).map((a) => a.reign));
      assert.deepEqual(await page.locator('#timeline .row-anchor .row-year').allInnerTexts(), expectedAnchorYears(SAMPLE));
      assert.equal(await page.locator('#timeline .gap').count(), SAMPLE.anchors.length, '첫 앵커 앞은 칸이 아니다');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `가로 넘침 ${overflow}px`);
      if (mobile) assert.ok((await page.locator('#timeline .gap').first().boundingBox()).height >= 40);
    }));

    test('정답(단서 없음): 새 카드 상자 → 2, 공개 내용, 칸 안에 놓인 카드', () => withPage(async (page) => {
      const card = await currentCard(page);
      await pressGap(page, (await gapsFor(page, card)).right, mobile);
      assert.equal(await page.getAttribute('#result', 'data-result'), 'correct');
      const text = await page.innerText('#card');
      for (const s of [card.title, card.explanation, card.source.ref]) assert.ok(text.includes(s), s);
      assert.equal(await page.getAttribute('#result-box', 'data-to'), '2');
      assert.equal(await page.locator(`#timeline .row-right[data-id="${card.id}"]`).count(), 1);
    }));

    test('오답: 한 칸 차이 표시(near_miss), 맞는 칸 안내, 상자 1', () => withPage(async (page) => {
      const card = await currentCard(page);
      await pressGap(page, (await gapsFor(page, card, { near: true })).wrong, mobile);
      assert.equal(await page.getAttribute('#result', 'data-result'), 'wrong');
      assert.equal(await page.getAttribute('#result', 'data-near'), '1');
      assert.match(await page.innerText('#result'), /한 칸 차이/);
      assert.match(await page.innerText('#result-where'), /맞는 칸/);
      assert.equal(await page.getAttribute('#result-box', 'data-to'), '1');
    }));

    test('단서 비용(§4): 관계 단서 후 정답은 승급 없음, 직접 단서 후 정답은 한 칸 강등(최소 1)', () => withPage(async (page) => {
      assert.match(await page.innerText('#clue-cost'), /상자 1→2 · 관계 단서를 열면 승급 없음/);
      if (mobile) await page.tap('#btn-clue'); else await page.click('#btn-clue');
      assert.match(await page.innerText('#clue-cost'), /상자 1→1 · 직접 단서를 열면 한 칸 내려감/);
      const ref = page.locator('#clues .ref-link').first();
      await ref.focus();
      assert.equal(await page.locator(`#timeline .row.ref-target[data-id="${await ref.getAttribute('data-ref-id')}"]`).count(), 1);
      const card = await currentCard(page);
      await pressGap(page, (await gapsFor(page, card)).right, mobile);
      assert.deepEqual([await page.getAttribute('#result-box', 'data-from'), await page.getAttribute('#result-box', 'data-to')], ['', '1']);
      await page.click('#btn-next');
      await page.click('#btn-clue');
      await page.click('#btn-clue');
      assert.equal(await page.isDisabled('#btn-clue'), true);
      const c2 = await currentCard(page);
      await pressGap(page, (await gapsFor(page, c2)).right, mobile);
      assert.equal(await page.getAttribute('#result-box', 'data-to'), '1');
    }));

    test('세션 1 → 재도전 → 결과 → 세션 2는 도래한 오답 카드 + 남은 새 카드 2장; 오답 카드는 재학습 표시로 상자 1 유지', () => withPage(async (page) => {
      let n = 0;
      const r1 = await playSession(page, () => (n++ % 3 === 1 ? 'wrong' : 'right'));
      const wrongIds = r1.filter((x) => x.first && x.how === 'wrong').map((x) => x.id);
      const retries = r1.filter((x) => !x.first);
      assert.equal(r1.filter((x) => x.first).length, 6);
      assert.deepEqual(retries.map((x) => x.id), wrongIds, '틀린 카드만 세션 끝에 한 번 더');
      assert.ok(retries.every((x) => x.to === '1'), '재도전은 상자를 바꾸지 않는다');
      await page.waitForSelector('#summary:not([hidden])');
      assert.equal(await page.getAttribute('#summary-stats', 'data-right'), String(6 - wrongIds.length));
      assert.doesNotMatch(await page.innerText('#summary-body'), /null/, 'B3: 세션 결과에 "null"이 찍히면 안 된다');
      assert.match(await page.innerText('#summary-retry'), new RegExp(`${wrongIds.length} / ${wrongIds.length} 성공`));
      await page.click('#summary-next');
      assert.match(await page.innerText('#session-no'), /세션 2/);
      const r2 = await playSession(page);
      const ids2 = r2.map((x) => x.id);
      assert.equal(ids2.length, wrongIds.length + 2, '도래 카드(오답) + 새 카드 예약 2장, 남는 자리는 채우지 않음');
      assert.ok(wrongIds.every((id) => ids2.includes(id)));
      // 재학습 표시(D74-3): 상자 1에서 틀린 카드는 깨끗한 정답 1번으로는 상자 1 그대로, 1번 더 필요.
      for (const x of r2) assert.deepEqual([x.from, x.to], wrongIds.includes(x.id) ? ['1', '1'] : ['', '2']);
      for (const x of r2.filter((y) => wrongIds.includes(y.id))) assert.match(x.boxText, /재학습 표시: 단서 없이 1번 연속 맞히면 상자 2/);
      assert.ok(r1.filter((x) => x.first && x.how === 'wrong').every((x) => /재학습 표시: 단서 없이 2번/.test(x.boxText)));
    }));

    test('도감: 현재 등급과 최고 등급, 오답 노트와 다시 풀기(연습, 상태 안 바뀜)', () => withPage(async (page) => {
      const card = await currentCard(page);
      await pressGap(page, (await gapsFor(page, card)).wrong, mobile);
      await page.click('#btn-next');
      await page.click('#btn-dogam');
      await page.waitForSelector('#dogam:not([hidden])');
      assert.equal(await page.locator(`#dogam-list [data-id="${card.id}"][data-mastery="none"]`).count(), 1);
      assert.match(await page.innerText(`#dogam-list [data-id="${card.id}"]`), /최고 없음 · 틀린 횟수 1/);
      assert.equal(await page.locator(`#note-list [data-id="${card.id}"]`).count(), 1);
      await page.click('#btn-note-practice');
      assert.equal(await page.locator('#practice-badge').count(), 1);
      assert.match(await page.innerText('#session-no'), /연습/);
      assert.match(await page.innerText('#clue-cost'), /연습이라 상자는 바뀌지 않습니다/);
      await pressGap(page, (await gapsFor(page, card)).right, mobile);
      assert.match(await page.innerText('#result-box'), /연습 · 상자 1 그대로/);
      await page.click('#btn-next');
      await page.waitForSelector('#summary:not([hidden])');
      assert.match(await page.innerText('#summary-title'), /연습 결과/);
      await page.click('#summary-dogam');
      assert.match(await page.innerText(`#dogam-list [data-id="${card.id}"]`), /상자 1/);
    }));

    test('세션 카운트(§5): 1장 이상 하고 닫으면 다시 열 때 그 세션을 끝내고 다음 세션; 0장이면 이어서', () => withPage(async (page) => {
      const c0 = await currentCard(page);
      await page.reload();
      await page.waitForSelector('body[data-ready="true"]');
      assert.match(await page.innerText('#session-no'), /세션 1/);
      assert.equal((await currentCard(page)).id, c0.id, '0장이면 같은 세션을 이어서');
      await pressGap(page, (await gapsFor(page, c0)).right, mobile);
      await page.reload();
      await page.waitForSelector('body[data-ready="true"]');
      assert.match(await page.innerText('#session-no'), /세션 2/);
      assert.match(await page.innerText('#notice'), /지난 세션 1/);
      await page.click('#btn-dogam');
      assert.match(await page.innerText(`#dogam-list [data-id="${c0.id}"]`), /상자 2/);
    }));

    test('빈 세션: 도래·새 카드가 없으면 0장, 미리 복습은 연습, "다음 세션으로"는 세션 +1', () => withPage(async (page) => {
      await editSave(page, (s) => {
        for (const n of Object.values(s.nations)) n.current = null; // M2 저장: 나라별 current
        s.cards = {};
        for (const id of ['gg-c-gungnae', 'gg-c-jindae', 'gg-c-nangnang', 'gg-c-taehak', 'gg-c-pyeongyang', 'gg-c-hanseong', 'gg-c-salsu', 'gg-c-ansi']) {
          s.cards[id] = { box: 3, introduced: true, due_session: 9, last_session: 0, clean_streak: 1, lapses: 0, best_grade: 1, last_played_at: null };
        }
        return s;
      });
      assert.match(await page.innerText('#empty-title'), /도래한 카드를 모두/);
      assert.doesNotMatch(await page.innerText('#card'), /null/, 'B3: 빈 세션 화면에 "null"이 찍히면 안 된다');
      await page.click('#btn-early');
      assert.equal(await page.locator('#practice-badge').count(), 1);
      const card = await currentCard(page);
      await pressGap(page, (await gapsFor(page, card)).wrong, mobile);
      assert.match(await page.innerText('#result-box'), /연습 · 상자 3 그대로/);
      await page.click('#btn-next');
      await page.click('#btn-dogam');
      assert.match(await page.innerText(`#dogam-list [data-id="${card.id}"]`), /상자 3/);
      await page.click('#dogam-close');
    }));

    test('세션 끝내기: 1장 이상이면 세션 +1, 남은 카드는 다음에', () => withPage(async (page) => {
      const c0 = await currentCard(page);
      await pressGap(page, (await gapsFor(page, c0)).right, mobile);
      await page.click('#btn-next');
      await page.click('#btn-end');
      await page.click('#end-confirm');
      await page.waitForSelector('#summary:not([hidden])');
      await page.click('#summary-next');
      assert.match(await page.innerText('#session-no'), /세션 2/);
    }));

    test('인출 로그 내보내기(JSONL, m1-plan 규격), 참가자 ID', () => withPage(async (page) => {
      const c0 = await currentCard(page);
      await page.click('#btn-clue');
      await pressGap(page, (await gapsFor(page, c0, { near: true })).wrong, mobile);
      await page.click('#btn-next');
      await page.click('#btn-dogam');
      assert.match(await page.inputValue('#participant'), /^P7$/);
      assert.match(await page.innerText('#log-count'), /1줄/);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
      assert.match(dl.suggestedFilename(), /^m1-log-P7-\d{8}-\d{4}\.jsonl$/);
      const lines = readFileSync(await dl.path(), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(lines.length, 1);
      const l = lines[0];
      assert.deepEqual(Object.keys(l), ['ts_ms', 'participant', 'phase', 'arm', 'session_index', 'card_id', 'slot_chosen', 'king_chosen', 'self_rating', 'correct', 'clue_used', 'box_before', 'box_after', 'near_miss', 'ms_on_card', 'relearn', 'reason_text']);
      assert.deepEqual([l.participant, l.phase, l.arm, l.session_index, l.card_id, l.correct, l.clue_used, l.box_after, l.near_miss, l.relearn], ['P7', 'learn', 'A', 1, c0.id, false, 1, 1, true, false]);
      assert.ok(l.ms_on_card >= 0 && Number.isInteger(l.ms_on_card));
      assert.ok(SAMPLE.anchors.some((a) => a.id === l.slot_chosen));
    }, { query: { participant: 'P7' } }));

    test('학습 기록 초기화는 두 번 확인', () => withPage(async (page) => {
      const c1 = await currentCard(page);
      await pressGap(page, (await gapsFor(page, c1)).right, mobile);
      await page.click('#btn-next');
      await page.click('#btn-dogam');
      await page.click('#btn-reset');
      await page.click('#reset-next');
      await page.click('#reset-confirm');
      assert.equal(await page.getAttribute('#progress', 'data-index'), '0');
      await page.click('#btn-dogam');
      assert.equal(await page.locator('#dogam-list [data-mastery="unseen"]').count(), SAMPLE.cards.length);
    }));

    if (mobile) {
      test('모바일 오탭 방지: 칸을 누르면 고르기만, 취소, "이 칸에 꽂기"로 확정', () => withPage(async (page) => {
        const card = await currentCard(page);
        const { right, wrong } = await gapsFor(page, card);
        await page.locator(`#timeline .gap[data-gap="${wrong}"]`).tap();
        assert.equal(await page.locator('#result').count(), 0);
        await page.locator('#cancel-place').tap();
        assert.equal(await page.locator('#confirm-place').count(), 0);
        await page.locator(`#timeline .gap[data-gap="${right}"]`).tap();
        assert.match(await page.innerText('.confirm-bar'), /이후/);
        await page.locator('#confirm-place').tap();
        await page.waitForSelector('#result[data-result="correct"]');
      }));
    } else {
      test('데스크톱: 클릭 한 번, 끌어 놓기, 키보드 Enter', () => withPage(async (page) => {
        let card = await currentCard(page);
        await page.click(`#timeline .gap[data-gap="${(await gapsFor(page, card)).right}"]`);
        await page.waitForSelector('#result[data-result="correct"]');
        await page.click('#btn-next');
        card = await currentCard(page);
        const from = await page.locator('#source-text').boundingBox();
        const gap = page.locator(`#timeline .gap[data-gap="${(await gapsFor(page, card)).right}"]`);
        await gap.scrollIntoViewIfNeeded();
        const to = await gap.boundingBox();
        await page.mouse.move(from.x + 20, from.y + 10);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
        assert.equal(await page.locator('#timeline .gap.over').count(), 1);
        await page.mouse.up();
        await page.waitForSelector('#result[data-result="correct"]');
        await page.click('#btn-next');
        card = await currentCard(page);
        await page.locator(`#timeline .gap[data-gap="${(await gapsFor(page, card)).right}"]`).focus();
        await page.keyboard.press('Enter');
        await page.waitForSelector('#result[data-result="correct"]');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'btn-next');
      }));
    }
  });
}

describe('실제 콘텐츠(초안 또는 v2)', { skip: !REAL && '데이터 없음' }, () => {
  for (const [name, opts] of Object.entries(VIEWPORTS)) {
    const mobile = name === 'mobile';
    test(`${name}: 기본 경로, "사실 확인 전", 모든 앵커 재위 기간, 세션 6장 완주(재도전 포함)`, async () => {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await openProto(page, server.base, { data: null, seed: 11 });
        assert.match(await page.innerText('#data-info'), new RegExp(`goguryeo-m1\\.json · 카드 ${REAL.cards.length}장 · 기준 ${REAL.anchors.length}장`));
        assert.match(await page.innerText('#data-warn'), /사실 확인 전/);
        const years = await page.locator('#timeline .row-anchor .row-year').allInnerTexts();
        assert.deepEqual(years, expectedAnchorYears(REAL));
        assert.ok(years.every((y) => y.includes('~')), `재위 기간이 빠진 기준 카드: ${years.filter((y) => !y.includes('~'))}`);
        let first = 0;
        const seen = new Set();
        while (await page.getAttribute('#card', 'data-card-id')) {
          const card = await currentCard(page, REAL_BY_ID);
          assert.ok(!(await page.innerText('#card')).includes(card.title), `${card.id} 이름 노출`);
          const g = await gapsFor(page, card);
          const bad = !seen.has(card.id) && first === 2;
          if (!seen.has(card.id)) first++;
          seen.add(card.id);
          await pressGap(page, bad ? g.wrong : g.right, mobile);
          if (!bad) {
            if (card.exam_note) assert.ok((await page.innerText('#result-note')).includes(card.exam_note));
            assert.ok((await page.innerText('#result-source')).includes(card.source.name));
          }
          await page.click('#btn-next');
        }
        assert.equal(first, 6);
        await page.waitForSelector('#summary:not([hidden])');
        assert.match(await page.innerText('#summary-retry'), /1 \/ 1 성공/);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
});
