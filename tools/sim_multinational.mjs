// 5개 나라 다국가 시뮬레이션 (rewards-spec §14.7, D237). 실제 웹 엔진(rules.js)을 그대로 쓴다. 가짜 학습자, 사람 데이터 아님.
// 실행: node tools/sim_multinational.mjs   (약 1~2분, CI에는 넣지 않는다)
import { buildSession, schedule, createRng, dueCount, isDue } from '../prototypes/m1-timeline/js/rules.js';
import { CONFIG } from '../prototypes/m1-timeline/js/config.js';
const cfg = CONFIG.leitnerGeneral;
const NAMES = ['고구려', '백제', '신라', '통일신라', '고려'];
const DECKS = { A: [36, 29, 33, 22, 20], B: [36, 29, 33, 22, 26] }; // A: 현재 140장, B: 고려 보강(D174) 146장
const CAP = 24;
function run({ sizes, policy, days, seed, profile = 'honest' }) {
  const rng = createRng(seed * 7919);
  const nations = sizes.map((n, i) => ({ name: NAMES[i], cards: Array.from({ length: n }, (_, j) => ({ id: `${i}-${j}` })), progress: {}, session: 0, know: new Map() }));
  const log = [];
  let rot = 0;
  for (let d = 0; d < days; d++) {
    const today = `d${d}`;
    const dueStart = nations.reduce((s, n) => s + dueCount(n.cards, n.progress, n.session + 1), 0);
    const lateStart = nations.reduce((s, n) => s + n.cards.filter((c) => isDue(n.progress[c.id], n.session + 1) && n.session + 1 - n.progress[c.id].due_session >= 2).length, 0);
    let k = policy.perDay(d, rng);
    const played = new Set();
    let cardsToday = 0, sessionsToday = 0, short = 0, guardedSessions = 0;
    for (let s = 0; s < k; s++) {
      let n;
      if (policy.pick === 'rotate') { n = nations[rot % nations.length]; rot++; }
      else if (policy.pick === 'most-due') {
        const score = (x) => buildSession(x.cards, x.progress, x.session + 1, cfg, 1, { today, dayOf: (v) => v }).ids.length;
        const c = nations.filter((x) => !played.has(x.name)).sort((a, b) => score(b) - score(a));
        n = c[0];
      } else if (policy.pick === 'random') {
        const c = nations.filter((x) => !played.has(x.name)); n = c[Math.floor(rng() * c.length)];
      } else if (policy.pick === 'all') n = nations[s % nations.length];
      if (!n) break;
      played.add(n.name);
      n.session += 1;
      const pick = buildSession(n.cards, n.progress, n.session, cfg, seed * 1000 + d * 10 + s, { today, dayOf: (x) => x });
      if (pick.guarded) guardedSessions++;
      if (!pick.ids.length) { n.session -= 1; continue; }
      sessionsToday++;
      if (pick.ids.length < 5) short++;
      for (const id of pick.ids) {
        const kk = n.know.get(id) ?? 0;
        const clue = profile === 'honest' ? (kk < 0.1 ? 2 : kk < 0.35 ? 1 : 0) : 0;
        const p = clue === 2 ? 1 : clue === 1 ? kk + 0.4 * (1 - kk) : kk + 0.1 * (1 - kk);
        const correct = rng() < p;
        n.progress = { ...n.progress, [id]: schedule(n.progress[id], { correct, clueUsed: clue, session: n.session, at: today }, cfg) };
        n.know.set(id, kk + 0.3 * (1 - kk));
        cardsToday++;
      }
    }
    const intro = nations.reduce((s, n) => s + n.cards.filter((c) => n.progress[c.id]?.introduced).length, 0);
    const dueEnd = nations.reduce((s, n) => s + dueCount(n.cards, n.progress, n.session + 1), 0);
    log.push({ d, dueStart, lateStart, cardsToday, sessionsToday, short, guardedSessions, intro, dueEnd });
  }
  return log;
}
const POL = {
  '1세션 순환': { perDay: () => 1, pick: 'rotate' },
  '2세션 순환': { perDay: () => 2, pick: 'rotate' },
  '3세션 순환(권장 24장)': { perDay: () => 3, pick: 'rotate' },
  '3세션 도래 많은 나라': { perDay: () => 3, pick: 'most-due' },
  '3세션 무작위': { perDay: () => 3, pick: 'random' },
  '5세션 전부': { perDay: () => 5, pick: 'all' },
  '불규칙(30% 쉼, 1~3세션 무작위)': { perDay: (d, r) => (r() < 0.3 ? 0 : 1 + Math.floor(r() * 3)), pick: 'random' },
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const out = [];
for (const deckKey of ['A', 'B']) {
  for (const [name, pol] of Object.entries(POL)) {
    const runs = [];
    for (let seed = 1; seed <= 12; seed++) runs.push(run({ sizes: DECKS[deckKey], policy: pol, days: 180, seed }));
    const col = (f) => runs.map(f);
    const at = (day, key) => mean(runs.map((r) => r[day][key]));
    const win = (a, b, key) => mean(runs.map((r) => mean(r.slice(a, b).map((x) => x[key]))));
    const total = DECKS[deckKey].reduce((x, y) => x + y, 0);
    out.push({
      deck: deckKey, total, policy: name,
      intro30: at(29, 'intro'), intro90: at(89, 'intro'),
      due30: at(29, 'dueStart'), due90: at(89, 'dueStart'),
      late30: at(29, 'lateStart'), late90: at(89, 'lateStart'),
      cards_d1_30: win(0, 30, 'cardsToday'), cards_last30: win(60, 90, 'cardsToday'),
      over24_last30: mean(runs.map((r) => r.slice(60, 90).filter((x) => x.cardsToday > CAP).length / 30)),
      dueGt24_last30: mean(runs.map((r) => r.slice(60, 90).filter((x) => x.dueStart > CAP).length / 30)),
      short: mean(runs.map((r) => { const s = r.reduce((x, y) => x + y.sessionsToday, 0); return s ? r.reduce((x, y) => x + y.short, 0) / s : 0; })),
      guard: mean(runs.map((r) => { const s = r.reduce((x, y) => x + y.sessionsToday, 0); return s ? r.reduce((x, y) => x + y.guardedSessions, 0) / s : 0; })),
      maxdue: mean(runs.map((r) => Math.max(...r.map((x) => x.dueStart)))),
      peakday: mean(runs.map((r) => r.reduce((b, x) => (x.dueStart > r[b].dueStart ? x.d : b), 0))),
      settle: mean(runs.map((r) => { const pk = r.reduce((b, x) => (x.dueStart > r[b].dueStart ? x.d : b), 0); const i = r.findIndex((x) => x.d > pk && x.dueStart <= CAP); return i < 0 ? 181 : i; })),
      over24_first30: mean(runs.map((r) => r.slice(0, 30).filter((x) => x.cardsToday > CAP).length / 30)),
      due180: at(179, 'dueStart'), late180: at(179, 'lateStart'), intro180: at(179, 'intro'),
    });
  }
}
const f = (x, n = 1) => x.toFixed(n);
console.log('덱 | 정책 | 열린 카드 30일/90일 | 오늘 복습 모두 30일/90일 | 밀린(2세션↑) 30일/90일 | 하루 장수 1~30일/61~90일 | 24장 초과한 날(61~90) | 도래>24인 날(61~90) | 5장 미만 세션 | 보호 걸린 세션 | 최대 도래');
console.log('\n정책 | 오늘 복습 모두 최대(평균 날짜) | 24장 이하로 내려간 날 | 하루 24장 초과한 날(1~30일) | 180일: 열림/도래/밀림');
for (const o of out) console.log([o.deck, o.policy, f(o.maxdue,0)+'('+f(o.peakday,0)+'일째)', f(o.settle,0)+'일째', f(o.over24_first30*100,0)+'%', f(o.intro180,0)+'/'+f(o.due180,1)+'/'+f(o.late180,1)].join(' | '));
console.log('\n--- 위 표');
for (const o of out) console.log([o.deck + '(' + o.total + ')', o.policy, f(o.intro30) + '/' + f(o.intro90), f(o.due30) + '/' + f(o.due90), f(o.late30) + '/' + f(o.late90), f(o.cards_d1_30) + '/' + f(o.cards_last30), f(o.over24_last30 * 100, 0) + '%', f(o.dueGt24_last30 * 100, 0) + '%', f(o.short * 100, 0) + '%', f(o.guard * 100, 0) + '%', f(o.maxdue)].join(' | '));
