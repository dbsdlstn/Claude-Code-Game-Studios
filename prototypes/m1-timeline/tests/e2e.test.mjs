// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
// E2E: node --test prototypes/m1-timeline/tests/e2e.test.mjs  (모바일 390×844, 데스크톱 1280×720)
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openProto, currentCard, gapsFor, pressGap, VIEWPORTS, SAMPLE, BY_ID, REAL, REAL_BY_ID } from './helpers.mjs';

let server;
let browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.stop(); });

for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const mobile = name === 'mobile';
  describe(`${name} ${opts.viewport.width}×${opts.viewport.height}`, () => {
    async function withPage(fn) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await openProto(page, server.base);
        await fn(page);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    }

    test('첫 화면: 사료 카드(이름 숨김), 연표에 기준 카드 시간순, 틈 n+1개, 가로 넘침 없음', () => withPage(async (page) => {
      const card = await currentCard(page);
      assert.ok(card);
      const text = await page.innerText('#card');
      assert.ok(text.includes(card.source_text));
      assert.ok(!text.includes(card.title), '이름이 보이면 안 된다');
      assert.ok(!text.includes(card.source.ref), '출처(왕대)는 정답 뒤에');
      assert.doesNotMatch(text, /\bnull\b|undefined/, '빈 값이 글자로 찍히면 안 된다');
      const orders = await page.locator('#timeline .row').evaluateAll((r) => r.map((x) => Number(x.dataset.order)));
      assert.deepEqual(orders, SAMPLE.anchors.map((a) => a.order).sort((a, b) => a - b));
      assert.equal(await page.locator('#timeline .gap').count(), SAMPLE.anchors.length + 1);
      assert.match(await page.innerText('#progress'), /카드 1 \/ 8/);
      // 기준 카드는 왕 단위: 왕 이름 + 재위 기간
      assert.deepEqual(await page.locator('#timeline .row-anchor .row-title').allInnerTexts(), ['동명성왕', '소수림왕', '광개토왕', '장수왕', '보장왕']);
      assert.match(await page.locator('#timeline .row-anchor .row-year').nth(1).innerText(), /371~384/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `가로 넘침 ${overflow}px`);
      if (mobile) {
        const box = await page.locator('#timeline .gap').first().boundingBox();
        assert.ok(box.height >= 40, `터치 대상 높이 ${box.height}`);
      }
    }));

    test('꽂기 정답: 이름·연도·해설·출처 공개, 단서 0개면 상자 +2, 연표에 들어감', () => withPage(async (page) => {
      const card = await currentCard(page);
      const { right } = await gapsFor(page, card);
      await pressGap(page, right, mobile);
      assert.equal(await page.getAttribute('#result', 'data-result'), 'correct');
      const text = await page.innerText('#card');
      for (const s of [card.title, card.year_label, card.explanation, card.source.ref]) assert.ok(text.includes(s), s);
      assert.equal(await page.getAttribute('#result-box', 'data-to'), '3');
      assert.equal(await page.locator(`#timeline .row-right[data-id="${card.id}"]`).count(), 1);
      assert.match(await page.innerText('#announcer'), /정답/);
    }));

    test('꽂기 오답: 맞는 자리 표시와 해설, 상자 1, 카드는 맞는 자리에', () => withPage(async (page) => {
      const card = await currentCard(page);
      const { wrong } = await gapsFor(page, card);
      await pressGap(page, wrong, mobile);
      assert.equal(await page.getAttribute('#result', 'data-result'), 'wrong');
      assert.match(await page.innerText('#result-where'), /맞는 자리/);
      assert.ok((await page.innerText('#card')).includes(card.explanation));
      assert.equal(await page.getAttribute('#result-box', 'data-to'), '1');
      const rows = await page.locator('#timeline .row').evaluateAll((r) => r.map((x) => ({ id: x.dataset.id, order: Number(x.dataset.order) })));
      const i = rows.findIndex((r) => r.id === card.id);
      assert.ok(i > 0 && rows[i - 1].order <= card.order, "앞 항목보다 나중");
      assert.ok(card.order <= (rows[i + 1]?.order ?? Infinity));
      assert.equal(await page.locator(`#timeline .row-wrong[data-id="${card.id}"]`).count(), 1);
    }));

    test('단서 비용: 단서를 열 때마다 승급 폭 안내가 줄고, 실제 상자 이동도 준다', () => withPage(async (page) => {
      assert.equal(await page.getAttribute('#clue-cost', 'data-now'), '2');
      if (mobile) await page.tap('#btn-clue'); else await page.click('#btn-clue');
      assert.equal(await page.getAttribute('#clue-cost', 'data-now'), '1');
      assert.equal(await page.locator('#clues .clue').count(), 1);
      // 관계 단서의 기준 카드를 누르면 연표 줄 강조
      const ref = page.locator('#clues .ref-link').first();
      const refId = await ref.getAttribute('data-ref-id');
      await ref.focus();
      assert.equal(await page.locator(`#timeline .row.ref-target[data-id="${refId}"]`).count(), 1);
      await page.click('#btn-clue');
      assert.equal(await page.getAttribute('#clue-cost', 'data-now'), '0');
      assert.equal(await page.isDisabled('#btn-clue'), true);
      const card = await currentCard(page);
      const { right } = await gapsFor(page, card);
      await pressGap(page, right, mobile);
      assert.equal(await page.getAttribute('#result-box', 'data-to'), '1', '단서 2개 열고 맞히면 상자 그대로(1)');
    }));

    test('세션 끝 → 결과, 틀린 카드는 세션 끝에 다시 풀기, 다음 세션 복습, 숙련 도감, 상자 이동', () => withPage(async (page) => {
      let i = 0;
      const wrongIds = [];
      const seen = new Set();
      while (await page.getAttribute('#card', 'data-card-id')) {
        const card = await currentCard(page);
        const { right, wrong } = await gapsFor(page, card);
        const retry = seen.has(card.id);
        seen.add(card.id);
        if (retry) {
          assert.ok(wrongIds.includes(card.id), '맞힌 카드는 다시 나오지 않는다');
          assert.equal(await page.locator('#retry-badge').count(), 1);
          assert.equal(await page.locator(`#timeline .row[data-id="${card.id}"]`).count(), 0, '다시 풀기 중에는 답이 연표에 없다');
          await pressGap(page, right, mobile);
          assert.match(await page.innerText('#result-box'), /그대로/);
        } else {
          const bad = i % 3 === 1;
          if (bad) wrongIds.push(card.id);
          await pressGap(page, bad ? wrong : right, mobile);
          i++;
        }
        await page.click('#btn-next');
      }
      assert.equal(i, 8);
      await page.waitForSelector('#summary:not([hidden])');
      assert.equal(await page.getAttribute('#summary-stats', 'data-right'), String(8 - wrongIds.length));
      assert.match(await page.innerText('#summary-retry'), new RegExp(`${wrongIds.length} / ${wrongIds.length} 성공`));
      assert.match(await page.innerText('#summary-due'), new RegExp(`${wrongIds.length}장`));
      await page.click('#summary-dogam');
      await page.waitForSelector('#dogam:not([hidden])');
      assert.equal(await page.locator('#dogam-list .medal-bronze').count(), 8 - wrongIds.length);
      assert.equal(await page.locator('#dogam-list .medal-none').count(), wrongIds.length, '다시 풀기는 상자를 올리지 않는다');
      await page.click('#dogam-close');
      await page.click('#summary-next');
      assert.match(await page.innerText('#session-no'), /세션 2/);
      // 세션 2: 카드 8장이 다시 나오고(카드가 적음), 오답 카드를 맞히면 1→3, 나머지는 3→5
      const ids = [];
      while (await page.getAttribute('#card', 'data-card-id')) {
        const card = await currentCard(page);
        ids.push(card.id);
        const { right } = await gapsFor(page, card);
        await pressGap(page, right, mobile);
        const pair = [await page.getAttribute('#result-box', 'data-from'), await page.getAttribute('#result-box', 'data-to')];
        assert.deepEqual(pair, wrongIds.includes(card.id) ? ['1', '3'] : ['3', '5']);
        await page.click('#btn-next');
      }
      assert.ok(wrongIds.every((id) => ids.includes(id)));
      await page.click('#summary-dogam');
      assert.equal(await page.getAttribute('#dogam-counts', 'data-gold'), String(8 - wrongIds.length));
    }));

    test('저장·복원: 새로고침하면 세션 번호, 진행, 연 단서, 상자가 그대로', () => withPage(async (page) => {
      const c1 = await currentCard(page);
      await pressGap(page, (await gapsFor(page, c1)).right, mobile);
      await page.click('#btn-next');
      await page.click('#btn-clue');
      const c2 = await currentCard(page);
      await page.reload();
      await page.waitForSelector('body[data-ready="true"]');
      assert.equal(await page.getAttribute('#progress', 'data-index'), '1');
      assert.equal((await currentCard(page)).id, c2.id);
      assert.equal(await page.locator('#clues .clue').count(), 1);
      assert.equal(await page.locator(`#timeline .row-right[data-id="${c1.id}"]`).count(), 1);
      await page.click('#btn-dogam');
      assert.equal(await page.locator(`#dogam-list [data-id="${c1.id}"][data-mastery="bronze"]`).count(), 1);
    }));

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
      test('모바일 오탭 방지: 틈을 누르면 고르기만, 취소하면 그대로, "이 자리에 꽂기"로 확정', () => withPage(async (page) => {
        const card = await currentCard(page);
        const { right, wrong } = await gapsFor(page, card);
        await page.locator(`#timeline .gap[data-gap="${wrong}"]`).tap();
        assert.equal(await page.locator('#result').count(), 0, '한 번 탭으로는 꽂히지 않는다');
        assert.equal(await page.getAttribute(`#timeline .gap[data-gap="${wrong}"]`, 'aria-pressed'), 'true');
        await page.locator('#cancel-place').tap();
        assert.equal(await page.locator('#confirm-place').count(), 0);
        await page.locator(`#timeline .gap[data-gap="${right}"]`).tap();
        assert.match(await page.innerText('.confirm-bar'), /사이|앞|뒤/);
        await page.locator('#confirm-place').tap();
        await page.waitForSelector('#result[data-result="correct"]');
      }));
    }

    if (!mobile) {
      test('데스크톱은 한 번 클릭으로 꽂힌다(확인 없음)', () => withPage(async (page) => {
        const card = await currentCard(page);
        await page.click(`#timeline .gap[data-gap="${(await gapsFor(page, card)).right}"]`);
        await page.waitForSelector('#result[data-result="correct"]');
        assert.equal(await page.locator('#confirm-place').count(), 0);
      }));

      test('데스크톱 보조: 카드를 끌어 틈에 놓기', () => withPage(async (page) => {
        const card = await currentCard(page);
        const { right } = await gapsFor(page, card);
        const from = await page.locator('#source-text').boundingBox();
        const gap = page.locator(`#timeline .gap[data-gap="${right}"]`);
        await gap.scrollIntoViewIfNeeded();
        const to = await gap.boundingBox();
        await page.mouse.move(from.x + 20, from.y + 10);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
        assert.equal(await page.locator('#timeline .gap.over').count(), 1);
        await page.mouse.up();
        await page.waitForSelector('#result[data-result="correct"]');
      }));

      test('키보드: Tab으로 틈에 가서 Enter로 꽂기', () => withPage(async (page) => {
        const card = await currentCard(page);
        const { right } = await gapsFor(page, card);
        await page.locator(`#timeline .gap[data-gap="${right}"]`).focus();
        await page.keyboard.press('Enter');
        await page.waitForSelector('#result[data-result="correct"]');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'btn-next');
      }));
    }
  });
}

test('데이터 확인: 샘플 카드의 order가 표시 연도와 같은 해', () => {
  for (const c of [...SAMPLE.cards, ...SAMPLE.anchors]) {
    const y = c.order < 0 ? `기원전 ${-c.order}년` : `${c.order}년`;
    assert.ok(c.year_label.includes(y), `${c.id}: ${c.year_label} / ${y}`);
  }
  assert.equal(BY_ID.size, SAMPLE.cards.length + SAMPLE.anchors.length);
});

describe('실제 콘텐츠 초안(assets/data/cards/v2-draft/goguryeo-m1.json)', { skip: !REAL && '초안 파일 없음' }, () => {
  for (const [name, opts] of Object.entries(VIEWPORTS)) {
    const mobile = name === 'mobile';
    test(`${name}: 기본 경로로 읽고 "사실 확인 전" 표시, 세션 8장 끝까지(같은 해 카드 포함), 수험 정리·출처 공개`, async () => {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await openProto(page, server.base, { data: null, seed: 11 });
        assert.match(await page.innerText('#data-info'), new RegExp(`goguryeo-m1\\.json · 카드 ${REAL.cards.length}장 · 기준 ${REAL.anchors.length}장`));
        assert.match(await page.innerText('#data-warn'), /사실 확인 전/);
        assert.match(await page.innerText('#progress'), /카드 1 \/ 8/);
        const anchorTitles = await page.locator('#timeline .row-anchor .row-title').allInnerTexts();
        assert.deepEqual(anchorTitles, [...REAL.anchors].sort((a, b) => a.order - b.order).map((a) => a.title.replace(/\s*즉위$/, '')));
        // 재위 기간(data/reigns.json, 표시용)
        assert.deepEqual(await page.locator('#timeline .row-anchor .row-year').allInnerTexts(), ['기원전 37~기원전 19', '371~384', '391~412', '413~491', '642~668']);
        let n = 0;
        while (await page.getAttribute('#card', 'data-card-id')) {
          const card = await currentCard(page, REAL_BY_ID);
          assert.ok(!(await page.innerText('#card')).includes(card.title), `${card.id} 이름 노출`);
          await pressGap(page, (await gapsFor(page, card)).right, mobile);
          assert.equal(await page.getAttribute('#result', 'data-result'), 'correct', card.id);
          if (card.exam_note) assert.ok((await page.innerText('#result-note')).includes(card.exam_note));
          assert.ok((await page.innerText('#result-source')).includes(card.source.name));
          await page.click('#btn-next');
          n++;
        }
        assert.equal(n, 8);
        await page.waitForSelector('#summary:not([hidden])');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  test('같은 해: 고국원왕 전사(371)는 소수림왕 즉위(371) 앞 틈만 정답', async () => {
    const { buildTimeline, correctGaps } = await import('../js/rules.js');
    const card = REAL.cards.find((c) => c.title === '고국원왕 전사');
    assert.ok(card, '카드가 있어야 한다');
    const t = buildTimeline(REAL.anchors);
    const k = correctGaps(t, card.order);
    assert.equal(k.length, 1);
    assert.equal(t[k[0]].title ?? REAL_BY_ID.get(t[k[0]].id).title, '소수림왕 즉위');
  });
});
