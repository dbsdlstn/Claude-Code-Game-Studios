// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D103)
// 보상 명세(design/rewards-spec.md) §11 수용 기준 1~12와 §7.2·§7.2b 시뮬레이션 방향을 재현한다.
// node --test prototypes/m1-timeline/tests/rewards.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG, LEITNER_DEFAULT } from '../js/config.js';
import {
  newRewards, restoreRewards, dayKey, levelOf, xpForLevel, titleForLevel, currentTitle, answerXp, bonusXp, settleSession, achievementDefs, achievementStats,
} from '../js/rewards.js';
import { schedule, gradeOf, buildSession, createSessionState, currentId, createRng } from '../js/rules.js';

const R = CONFIG.rewards;
const FILE = JSON.parse(readFileSync(new URL('../../../assets/data/config/rewards.json', import.meta.url), 'utf8'));
const at = (d, h = 12) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`);
const rec = (o = {}) => ({ id: 'c1', correct: true, clueUsed: 0, boxFrom: 1, boxTo: 2, bestFrom: 0, bestTo: 0, probation: false, ...o });
const noStats = (rw, sess) => ({ total: 0, gold: 0, silverPlus: 0, bronzePlus: 0, introduced: 0, lapsed: 0, lapsedRecovered: 0, kingSilver: false, sessionsDone: rw.sessions_done, sessionCards: sess.cards, sessionClean: sess.clean, streak: rw.streak, bestStreak: rw.best_streak, goalDays: rw.goal_days_total, comeback: sess.comeback });
let sid = 0;
const settle = (rw, records, now, base = records.length) => settleSession(rw, { sessionId: `s${++sid}`, records, base }, noStats, now, R);

describe('설정(§9)', () => {
  test('assets/data/config/rewards.json = config 기본값(세션 완료 보너스 없음, 하루 2세션, 레벨 25+30)', () => {
    for (const k of Object.keys(R).filter((x) => x !== 'enabled')) assert.deepEqual(FILE[k], JSON.parse(JSON.stringify(R[k])), k);
    assert.equal('session_done' in R.xp, false);
    assert.equal(R.xp_cards_per_day, 24);
    assert.equal('xp_sessions_per_day' in R, false);
  });
});

describe('§11 수용 기준', () => {
  test('1. 인출 XP 10 > 5 > 3 > 0', () => {
    const v = [rec(), rec({ clueUsed: 1 }), rec({ clueUsed: 2 }), rec({ correct: false })].map((r) => answerXp(r, R));
    assert.deepEqual(v, [10, 5, 3, 0]);
  });
  test('1. 재도전·연습은 세션 기록(placed)에 들어오지 않으므로 정산 대상이 아니다; 빈 세션은 정산 없음', () => {
    const r = settle(newRewards(), [], at('2026-11-05'));
    assert.equal(r.report, null);
  });
  test('2. 승급 +5는 상자 2 이상에서 오를 때만(D164), 상자 1 → 2와 새 카드 첫 정답은 없음, 상자별 차등 없음', () => {
    assert.equal(bonusXp(rec({ boxFrom: 2, boxTo: 3 }), R).boxXp, 5);
    assert.equal(bonusXp(rec({ boxFrom: 4, boxTo: 5 }), R).boxXp, 5);
    assert.equal(bonusXp(rec({ boxFrom: 1, boxTo: 2 }), R).boxXp, 0, '상자 1 → 2');
    assert.equal(bonusXp(rec({ boxFrom: null, boxTo: 2 }), R).boxXp, 0, '새 카드 첫 깨끗한 정답');
    assert.equal(bonusXp(rec({ boxFrom: 1, boxTo: 1, probation: true, probationFrom: true }), R).boxXp, 0, '표시 중 첫 깨끗한 정답');
    assert.equal(bonusXp(rec({ boxFrom: 3, boxTo: 1, correct: false }), R).boxXp, 0);
  });
  test('2. 재학습 해제(표시가 풀리며 상자 1 → 2)에 만회 +5(D166), 오답 자체는 0', () => {
    const r = bonusXp(rec({ boxFrom: 1, boxTo: 2, probationFrom: true, probation: false }), R);
    assert.deepEqual([r.released, r.releaseXp, r.boxXp], [true, 5, 0]);
    assert.equal(answerXp(rec({ correct: false }), R), 0);
  });
  test('바뀐 카드 판정(D 블록): 상자·등급·재학습 표시가 바뀐 카드만', () => {
    assert.equal(bonusXp(rec({ boxFrom: 1, boxTo: 2 }), R).changed, true);
    assert.equal(bonusXp(rec({ boxFrom: null, boxTo: 1, clueUsed: 1 }), R).changed, false, '새 카드를 단서로 맞혀 상자 1 그대로');
    assert.equal(bonusXp(rec({ boxFrom: null, boxTo: 1, correct: false, probation: true }), R).changed, true, '재학습 표시가 새로 붙음');
    assert.equal(bonusXp(rec({ boxFrom: 1, boxTo: 1, correct: false, probation: true, probationFrom: true }), R).changed, false);
    assert.equal(bonusXp(rec({ boxFrom: 3, boxTo: 3, clueUsed: 1, bestFrom: 0, bestTo: 1 }), R).changed, true, '등급');
  });
  test('3. 등급 보너스는 best_grade가 오를 때만(한 번)', () => {
    assert.equal(bonusXp(rec({ bestFrom: 0, bestTo: 1 }), R).gradeXp, 20);
    assert.equal(bonusXp(rec({ bestFrom: 1, bestTo: 3 }), R).gradeXp, 40 + 80);
    assert.equal(bonusXp(rec({ bestFrom: 2, bestTo: 2 }), R).gradeXp, 0, '내려갔다 다시 올라가도 best가 같으면 없음');
  });
  test('4. 인출 XP와 하루 목표는 그날 처음 24장까지(D184): 24번째는 받고 25번째는 0, 세션 중간에 넘기면 그 장부터, 보너스는 항상, 날짜가 바뀌면 0부터', () => {
    let rw = newRewards();
    const ten = Array.from({ length: 10 }, (_, i) => rec({ id: `a${i}` }));
    const s1 = settle(rw, ten, at('2026-11-05')); rw = s1.rewards;
    assert.equal(s1.report.sessionXp, 10 * 10 + R.xp.daily_goal);
    const s2 = settle(rw, ten, at('2026-11-05', 13)); rw = s2.rewards;
    assert.equal(s2.report.sessionXp, 100, '20장까지');
    // 세 번째 세션: 21~24번째는 XP, 25번째부터 0. 승급 보너스(상자 2 → 3)는 상한과 무관
    const mixed = Array.from({ length: 6 }, (_, i) => rec({ id: `b${i}`, boxFrom: 2, boxTo: 3 }));
    const s3 = settle(rw, mixed, at('2026-11-05', 14)); rw = s3.rewards;
    assert.deepEqual(s3.report.lines.map((l) => l.xp), [10, 10, 10, 10, 0, 0], '24번째까지 받고 25번째부터 0');
    assert.ok(s3.report.lines.every((l) => l.boxXp === 5));
    assert.equal(s3.report.capped, true);
    assert.equal(s3.report.cappedAll, false);
    assert.equal(s3.report.dayCards, 26);
    const s4 = settle(rw, [rec({ id: 'c' })], at('2026-11-05', 15));
    assert.equal(s4.report.cappedAll, true);
    assert.equal(s4.report.sessionXp, 0);
    const next = settle(s4.rewards, [rec({ id: 'd' }), rec({ id: 'e' }), rec({ id: 'f' })], at('2026-11-06'));
    assert.equal(next.report.sessionXp, 30 + R.xp.daily_goal, '다음 날 0부터');
  });
  test('5. 레벨 경계 C(L) = 25(L−1) + 15(L−1)(L−2)', () => {
    const table = { 2: 25, 3: 80, 4: 165, 5: 280, 6: 425, 8: 805, 10: 1305, 12: 1925, 15: 3080, 20: 5605, 25: 8880, 30: 12905, 40: 23205, 50: 36505 };
    for (const [L, c] of Object.entries(table)) {
      assert.equal(xpForLevel(Number(L), R), c, `C(${L})`);
      assert.equal(levelOf(c, R).level, Number(L));
      assert.equal(levelOf(c - 1, R).level, Number(L) - 1);
    }
  });
  test('6. 하루 목표: 3장 이상, 또는 세션 카드가 3장 미만이면 그 전부; 2장만 한 3장 세션은 미달', () => {
    assert.ok(settle(newRewards(), [rec(), rec(), rec()], at('2026-11-05')).report.goal);
    assert.ok(settle(newRewards(), [rec()], at('2026-11-05'), 1).report.goal, '도래 1장 세션을 다 하면 달성');
    assert.equal(settle(newRewards(), [rec(), rec()], at('2026-11-05'), 6).report.goal, null);
  });
  test('6. 오전 3시에 날짜가 바뀐다', () => {
    assert.equal(dayKey(at('2026-11-06', 2), 3), '2026-11-05');
    assert.equal(dayKey(at('2026-11-06', 3), 3), '2026-11-06');
  });
  const days = (n, start = '2026-11-01') => Array.from({ length: n }, (_, i) => { const d = new Date(`${start}T12:00:00`); d.setDate(d.getDate() + i); return d; });
  const goalRun = (rw, dates) => dates.reduce((r, d) => settle(r, [rec(), rec(), rec()], d).rewards, rw);
  test('7. 연속 7일마다 휴식권 1장(최대 2), 놓친 날 휴식권을 자동으로 쓴다', () => {
    let rw = goalRun(newRewards(), days(7));
    assert.deepEqual([rw.streak, rw.rest_passes], [7, 1]);
    rw = goalRun(rw, days(14, '2026-11-08'));
    assert.deepEqual([rw.streak, rw.rest_passes], [21, 2], '최대 2장');
    // 하루 쉬고(11-22) 11-23에 학습: 보호권 1장 사용, 연속 이어짐
    const r = settle(rw, [rec(), rec(), rec()], at('2026-11-23'));
    assert.equal(r.report.goal.usedPasses, 1);
    assert.deepEqual([r.rewards.streak, r.rewards.rest_passes], [22, 1]);
  });
  test('8. 휴식권 없이 끊겨도 XP·레벨·업적·best_streak은 그대로, 연속은 1부터', () => {
    let rw = goalRun(newRewards(), days(3));
    rw = { ...rw, achievements: { 'first-step': '2026-11-01' } };
    const before = { xp: rw.xp, best: rw.best_streak };
    const r = settle(rw, [rec(), rec(), rec()], at('2026-11-10'));
    assert.equal(r.rewards.streak, 1);
    assert.equal(r.rewards.best_streak, before.best);
    assert.ok(r.rewards.xp >= before.xp);
    assert.ok(r.rewards.achievements['first-step']);
    assert.deepEqual(r.report.goal.broken, { prev: 3, best: 3 });
  });
  test('9. 업적은 조건에서 계산, 두 번 주지 않음, 나라별은 따로', () => {
    const cards = [{ id: 'a' }, { id: 'b' }];
    const progress = { a: { introduced: true, box: 5, clean_streak: 1, lapses: 0 }, b: { introduced: true, box: 5, clean_streak: 1, lapses: 0 } };
    const statsFor = (rw, sess) => achievementStats({ cards, progress, gradeOf: (e) => gradeOf(e, LEITNER_DEFAULT), slotOf: () => 'k1', rewards: rw, session: sess, comeback: sess.comeback });
    const g = settleSession(newRewards(), { sessionId: 'x1', records: [rec({ id: 'a' }), rec({ id: 'b' })], base: 2 }, statsFor, at('2026-11-05'), R, achievementDefs('goguryeo', '고구려'));
    const ids = g.report.achievements.map((a) => a.id);
    for (const id of ['first-step', 'first-bronze', 'first-silver', 'first-gold', 'king-silver', 'nation-intro:goguryeo', 'nation-bronze:goguryeo', 'nation-silver:goguryeo', 'nation-gold:goguryeo']) assert.ok(ids.includes(id), id);
    const again = settleSession(g.rewards, { sessionId: 'x2', records: [rec({ id: 'a' })], base: 1 }, statsFor, at('2026-11-05', 13), R, achievementDefs('goguryeo', '고구려'));
    assert.deepEqual(again.report.achievements, []);
    const bj = settleSession(g.rewards, { sessionId: 'b1', records: [rec({ id: 'a' })], base: 1 }, statsFor, at('2026-11-05', 14), R, achievementDefs('baekje', '백제'));
    assert.ok(bj.report.achievements.some((a) => a.id === 'nation-gold:baekje'), '나라마다 따로');
    assert.equal(achievementDefs().length, 13);
    assert.equal(achievementDefs('goguryeo').length, 17, '고유 17종');
  });
  test('9. 깨끗한 한 판(5장 이상 모두 깨끗), 다시 오셨네요(7일 이상 쉰 뒤)', () => {
    const statsFor = (rw, sess) => achievementStats({ cards: [], progress: {}, gradeOf: () => 0, slotOf: () => 'k', rewards: rw, session: sess, comeback: sess.comeback });
    const five = Array.from({ length: 5 }, (_, i) => rec({ id: `c${i}` }));
    const a = settleSession(newRewards(), { sessionId: 'p1', records: five, base: 5 }, statsFor, at('2026-11-01'), R);
    assert.ok(a.report.achievements.some((x) => x.id === 'clean-session'));
    const b = settleSession(a.rewards, { sessionId: 'p2', records: five.slice(0, 3), base: 3 }, statsFor, at('2026-11-09'), R);
    assert.ok(b.report.achievements.some((x) => x.id === 'comeback'), '8일 차이(7일 쉼)');
  });
  test('10. 결정성: 같은 입력이면 같은 결과; 같은 세션 id는 두 번 정산하지 않는다(멱등)', () => {
    const run = () => settleSession(newRewards(), { sessionId: 'z', records: [rec(), rec({ clueUsed: 1, boxTo: 1 })], base: 2 }, noStats, at('2026-11-05'), R);
    assert.deepEqual(run(), run());
    const once = run();
    const twice = settleSession(once.rewards, { sessionId: 'z', records: [rec()], base: 1 }, noStats, at('2026-11-05'), R);
    assert.equal(twice.report, null);
    assert.equal(twice.rewards, once.rewards);
  });
  test('11. 보상 모듈은 Leitner 저장 데이터를 바꾸지 않는다', () => {
    const progress = Object.freeze({ a: Object.freeze({ introduced: true, box: 3, due_session: 5, probation: false, lapses: 1, clean_streak: 1 }) });
    const snap = JSON.stringify(progress);
    const statsFor = (rw, sess) => achievementStats({ cards: [{ id: 'a' }], progress, gradeOf: (e) => gradeOf(e, LEITNER_DEFAULT), slotOf: () => 'k', rewards: rw, session: sess });
    settleSession(newRewards(), { sessionId: 'q', records: [rec({ id: 'a' })], base: 1 }, statsFor, at('2026-11-05'), R, achievementDefs('goguryeo'));
    assert.equal(JSON.stringify(progress), snap);
  });
  test('칭호: 레벨 5 서당 학동; 고정한 낮은 칭호는 레벨업이 덮어쓰지 않는다', () => {
    assert.equal(titleForLevel(1, R), '입문자');
    assert.equal(titleForLevel(5, R), '서당 학동');
    assert.equal(titleForLevel(14, R), '향교 유생');
    const rw = { ...newRewards(), xp: xpForLevel(12, R), title_pinned: '입문자' };
    assert.equal(currentTitle(rw, R), '입문자');
    assert.equal(currentTitle({ ...rw, title_pinned: '진사' }, R), '향교 유생', '레벨이 안 된 칭호는 무시');
  });
  test('저장 복원: 골격(D82) 모양을 옮긴다', () => {
    const old = { xp: 95, sessions_done: 1, streak: { current: 2, best: 4, last_day: '2026-11-04' }, daily: {}, achievements: { first_session: '2026-11-04T10:00:00Z' } };
    const r = restoreRewards(old);
    assert.deepEqual([r.xp, r.streak, r.best_streak, r.last_goal_date], [95, 2, 4, '2026-11-04']);
    assert.equal(r.achievements['first-step'], '2026-11-04');
    assert.equal(restoreRewards({ xp: -3 }).xp, 0);
  });
});

/* §7.2 시뮬레이션: 명세의 지식 모델(k ← k + 0.3(1−k), 깨끗한 시도 k+0.1(1−k), 관계 단서 k+0.4(1−k), 직접 단서 100%),
   하루 1세션 8장, 24장 덱, 30일, 시드 15개 평균. 수치 대신 순서를 확인한다(정직 ≈ 찍기 ≫ 직접 단서). */
function simulate(strategy, { deck = 24, daysN = 30, perDay = 1, seeds = 15 } = {}) {
  const cfg = { ...LEITNER_DEFAULT, slotBeforeFirst: false, placedJoinTimeline: false };
  let total = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const rng = createRng(seed * 7919);
    const cards = Array.from({ length: deck }, (_, i) => ({ id: `c${i}` }));
    const know = new Map(cards.map((c) => [c.id, 0]));
    let progress = {};
    let rw = newRewards();
    let session = 0;
    for (let d = 0; d < daysN; d++) {
      const day = new Date(2026, 0, 1 + d, 12);
      for (let n = 0; n < perDay; n++) {
        session += 1;
        const pick = buildSession(cards, progress, session, cfg, seed * 1000 + session);
        const st = createSessionState(session, pick.ids);
        const recs = [];
        for (const id of st.queue) {
          const k = know.get(id);
          const clue = strategy === 'direct' ? 2 : strategy === 'relation' ? 1 : strategy === 'honest' ? (k < 0.1 ? 2 : k < 0.35 ? 1 : 0) : 0;
          const p = clue === 2 ? 1 : clue === 1 ? k + 0.4 * (1 - k) : k + 0.1 * (1 - k);
          const correct = rng() < p;
          const before = progress[id];
          const after = schedule(before, { correct, clueUsed: clue, session }, cfg);
          progress = { ...progress, [id]: after };
          know.set(id, k + 0.3 * (1 - k));
          recs.push({ id, correct, clueUsed: clue, boxFrom: before?.introduced ? before.box : null, boxTo: after.box, bestFrom: before?.best_grade ?? 0, bestTo: after.best_grade, probation: after.probation, probationFrom: !!before?.probation });
        }
        if (recs.length) rw = settleSession(rw, { sessionId: `s${session}`, records: recs, base: recs.length }, noStats, day, R).rewards;
      }
    }
    total += rw.xp;
  }
  return total / seeds;
}

describe('§7.2 시뮬레이션(방향)', () => {
  const honest = simulate('honest');
  const guess = simulate('guess');
  const direct = simulate('direct');
  const relation = simulate('relation');
  test(`12. 정직(${Math.round(honest)}) ≈ 찍기(${Math.round(guess)}) ≫ 관계 단서만(${Math.round(relation)}) > 직접 단서만(${Math.round(direct)})`, () => {
    assert.ok(Math.abs(honest - guess) / guess < 0.25, '정직과 찍기는 비슷하다(모를 때 단서를 써도 손해가 거의 없다)');
    assert.ok(honest > 2 * direct, '단서에 기대면 크게 적다');
    assert.ok(guess > 2 * direct);
    assert.ok(relation < honest && direct < relation);
  });
  test('§7.2b(D184) 하루 6세션을 해도 하루 24장(3세션) 수준에서 크게 늘지 않는다', () => {
    const three = simulate('honest', { perDay: 3, seeds: 8 });
    const six = simulate('honest', { perDay: 6, seeds: 8 });
    assert.ok(six < three * 1.3, `6세션 ${Math.round(six)} vs 3세션 ${Math.round(three)}`);
  });
});
