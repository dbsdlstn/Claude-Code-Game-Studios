// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D72)
// 사람 테스트 모드 E2E: node --test prototypes/m1-timeline/tests/e2e-study.test.mjs
// 한 참가자가 pre → 방식 A → 방식 B → post0 → (다음 날) post1을 끝까지 돌고, 로그가 m1-plan §11 규격인지 본다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, startServer, VIEWPORTS, REAL, REAL_BY_ID } from './helpers.mjs';
import { runParticipant, studyUrl, readStudy, STUDY_PREFIX } from './study-driver.mjs';
import { CONFIG } from '../js/config.js';
import { splitHalves, ASSIGNMENTS } from '../js/study.js';

const FIELDS = ['ts_ms', 'participant', 'phase', 'arm', 'session_index', 'card_id', 'slot_chosen', 'self_rating', 'correct', 'clue_used', 'box_before', 'box_after', 'near_miss', 'ms_on_card', 'relearn', 'reason_text'];

let server;
let browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.stop(); });

async function exportLines(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#study-export')]);
  const text = readFileSync(await dl.path(), 'utf8');
  return { name: dl.suggestedFilename(), lines: text.trim().split('\n').map((l) => JSON.parse(l)) };
}

for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const mobile = name === 'mobile';
  const preset = mobile ? 'P1' : 'P2';
  test(`${name}: 참가자 ${preset} 전체 진행(pre → 첫 방식 → 두 번째 방식 → post0 → post1)과 로그 규격`, { skip: !REAL && '실제 데이터 없음' }, async () => {
    const ctx = await browser.newContext({ ...opts, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      const { order, results } = await runParticipant(page, server.base, { participant: preset, preset, byId: REAL_BY_ID, mobile });
      assert.deepEqual(order, preset === 'P1' ? ['pre', 'learn-A', 'learn-B', 'post0', 'post1'] : ['pre', 'learn-B', 'learn-A', 'post0', 'post1']);
      assert.equal(await page.locator('#study-all-done').count(), 1);
      assert.equal(await page.locator('#study-stages li[data-done="1"]').count(), 5);

      const { name: file, lines } = await exportLines(page);
      assert.match(file, new RegExp(`^m1-study-${preset}-`));
      assert.match(file, /^m1-study-P\d-\d{8}-\d{4}\.jsonl$/);
      for (const l of lines) {
        assert.deepEqual(Object.keys(l), FIELDS);
        assert.equal(l.participant, preset);
        assert.ok(Number.isInteger(l.ts_ms) && Number.isInteger(l.ms_on_card) && l.ms_on_card >= 0);
      }
      const halves = splitHalves(REAL.cards, CONFIG.study.halves);
      const asg = ASSIGNMENTS[preset];
      const by = (p, a) => lines.filter((l) => l.phase === p && (a === undefined || l.arm === a));
      // 테스트 단계: 12장씩, 단서 없음, 근거 입력, 상자 없음
      for (const p of ['pre', 'post0', 'post1']) {
        const t = by(p, '-');
        assert.equal(t.length, REAL.cards.length, p);
        assert.equal(new Set(t.map((l) => l.card_id)).size, REAL.cards.length);
        for (const l of t) {
          assert.equal(l.session_index, null); assert.equal(l.clue_used, 0); assert.equal(l.box_before, null); assert.equal(l.box_after, null);
          assert.equal(l.self_rating, null); assert.equal(l.relearn, false); assert.match(l.reason_text, /^근거 \d+/);
        }
        const exp = results[p];
        t.forEach((l, i) => {
          assert.equal(l.card_id, exp[i].id);
          assert.equal(l.correct, exp[i].kind === 'right', `${p} ${i}`);
          if (exp[i].kind === 'unknown') { assert.equal(l.slot_chosen, null); assert.equal(l.near_miss, false); } else assert.match(l.slot_chosen, /^goguryeo-reign-/);
        });
      }
      assert.ok(by('pre').some((l) => l.slot_chosen === null), 'pre에 "모르겠다"가 있어야 한다');
      // 학습: A는 꽂기, B는 자기 평가. 각자 반의 카드만.
      const A = by('learn', 'A');
      const B = by('learn', 'B');
      assert.ok(A.length >= 6 && B.length >= 6);
      assert.ok(A.every((l) => halves[asg.A].includes(l.card_id) && /^goguryeo-reign-/.test(l.slot_chosen) && l.self_rating === null && l.reason_text === null));
      assert.ok(B.every((l) => halves[asg.B].includes(l.card_id) && l.slot_chosen === null && ['knew', 'didnt_know'].includes(l.self_rating) && l.clue_used === 0 && l.near_miss === null && l.reason_text === null));
      assert.deepEqual(new Set(A.map((l) => l.card_id)), new Set(halves[asg.A]));
      assert.deepEqual(new Set(B.map((l) => l.card_id)), new Set(halves[asg.B]));
      for (const arm of [A, B]) {
        // 세션 1: 6장 모두 새 카드, 첫 카드는 틀려서 끝에 한 번 더(relearn, 상자 그대로).
        const s1 = arm.filter((l) => l.session_index === 1);
        assert.equal(s1.filter((l) => !l.relearn).length, 6);
        assert.ok(s1.filter((l) => !l.relearn).every((l) => l.box_before === null));
        const re = s1.filter((l) => l.relearn);
        assert.equal(re.length, 1);
        assert.equal(re[0].box_before, re[0].box_after);
        assert.ok(Math.max(...arm.map((l) => l.session_index)) <= CONFIG.study.sessionsPerArm);
      }
      assert.equal(B.find((l) => l.session_index === 1 && !l.relearn).self_rating, 'didnt_know');
      // 단계 순서대로 기록(시간순)
      const phaseOrder = lines.map((l) => (l.phase === 'learn' ? `learn-${l.arm}` : l.phase)).filter((p, i, a) => p !== a[i - 1]);
      assert.deepEqual(phaseOrder, order);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('참가자별 저장이 섞이지 않고 일반 학습 모드와도 따로다; 데이터가 바뀌면 단계를 막는다', { skip: !REAL && '실제 데이터 없음' }, async () => {
  const ctx = await browser.newContext(VIEWPORTS.desktop);
  const page = await ctx.newPage();
  try {
    await page.goto(studyUrl(server.base, { participant: 'P1' }));
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await page.isChecked('#asg-P1'), true);
    await page.click('#study-create');
    await page.click('#study-stages a[data-go="pre"]');
    await page.waitForSelector('#test-card');
    // 고르기 전에는 다음으로 못 간다. 같은 칸을 다시 누르면 선택 해제.
    assert.equal(await page.isDisabled('#test-submit'), true);
    await page.click('#test-timeline .gap >> nth=0');
    assert.equal(await page.isDisabled('#test-submit'), false);
    await page.click('#test-timeline .gap >> nth=0');
    assert.equal(await page.isDisabled('#test-submit'), true);
    // 정답은 보여 주지 않는다.
    await page.click('#test-unknown');
    await page.click('#test-submit');
    assert.equal(await page.locator('#result, .result-title, #clues, #btn-clue').count(), 0);
    // 다시 열면 이어서(카드 2)
    await page.reload();
    await page.waitForSelector('#test-card');
    assert.equal(await page.getAttribute('#test-progress', 'data-index'), '1');

    await page.goto(studyUrl(server.base, { participant: 'Q9' }));
    await page.waitForSelector('#study-create');
    await page.click('#study-create');
    assert.equal(await page.getAttribute('#study-log-count', 'data-count'), '0');
    assert.deepEqual(await page.locator('#study-known .chip').evaluateAll((a) => a.map((x) => x.dataset.pid)), ['P1', 'Q9']);
    const p1 = await readStudy(page, 'P1');
    assert.equal(p1.log.length, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('hanyang-m1:save:v2')), null);

    // 일반 모드는 그대로(진행자 화면 없음, 도감 있음)
    await page.goto(`${server.base}/prototypes/m1-timeline/index.html?seed=7`);
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal(await page.locator('#study').count(), 0);
    assert.equal(await page.locator('#btn-dogam').count(), 1);

    // 다른 데이터로 열면 막는다
    await page.goto(studyUrl(server.base, { participant: 'P1', data: 'data/sample.json' }));
    await page.waitForSelector('#study-mismatch');
    assert.equal(await page.locator('#study-stages a[data-go]').count(), 0);
    await page.goto(studyUrl(server.base, { participant: 'P1', stage: 'learn-A', data: 'data/sample.json' }));
    await page.waitForSelector('body[data-ready="error"]');

    // 두 단계 확인 후 지우기
    await page.goto(studyUrl(server.base, { participant: 'P1' }));
    await page.waitForSelector('#study-reset');
    await page.click('#study-reset');
    await page.click('#reset-next');
    await page.click('#reset-confirm');
    await page.waitForSelector('#study-create');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), STUDY_PREFIX + 'P1'), null);
  } finally { await ctx.close(); }
});

test('없는 참가자로 방식 A 단계를 열면 진행자 메뉴로 돌아간다', async () => {
  const ctx = await browser.newContext(VIEWPORTS.desktop);
  const page = await ctx.newPage();
  try {
    await page.goto(studyUrl(server.base, { participant: 'Z1', stage: 'learn-A', data: 'data/sample.json' }));
    await page.waitForSelector('#study-create');
    assert.doesNotMatch(page.url(), /stage=/);
  } finally { await ctx.close(); }
});
