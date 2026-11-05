// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D82)
/**
 * 보상 골격: XP·레벨·연속 학습일·하루 목표·업적. 순수 함수(시간은 인자로). 수치는 config.rewards.
 * 원칙(D79-3): 보상은 학습 신호와 같은 방향. 단서 없는 정답 > 단서 정답 > 오답(0). 승급과 숙련 등급 상승에 큰 보상.
 * 재도전·연습은 0, 세션 길이로 주는 보상 없음(세션 완료 보너스는 장수와 무관한 고정값), 연속일이 끊겨도 벌 없음.
 */

export function newRewards() {
  return { xp: 0, sessions_done: 0, streak: { current: 0, best: 0, last_day: null }, daily: { day: null, sessions: 0, goal_met: false }, achievements: {} };
}

/** 저장된 보상을 읽는다(모양이 틀리면 새로). */
export function restoreRewards(saved) {
  const r = newRewards();
  if (!saved || typeof saved !== 'object') return r;
  if (Number.isFinite(saved.xp) && saved.xp >= 0) r.xp = Math.floor(saved.xp);
  if (Number.isInteger(saved.sessions_done) && saved.sessions_done >= 0) r.sessions_done = saved.sessions_done;
  if (saved.streak && typeof saved.streak === 'object') r.streak = { ...r.streak, ...saved.streak };
  if (saved.daily && typeof saved.daily === 'object') r.daily = { ...r.daily, ...saved.daily };
  if (saved.achievements && typeof saved.achievements === 'object') r.achievements = { ...saved.achievements };
  return r;
}

/** 지역 날짜 YYYY-MM-DD. */
export function dayKey(date) {
  const p = (x) => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function dayDiff(a, b) {
  const t = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

/**
 * 한 번 인출한 결과의 XP. result는 rules.placeCurrent·study.rateCurrent의 result 모양.
 * @param {number} bestBefore 인출 전 최고 등급, bestAfter 인출 뒤 최고 등급(최고 등급이 처음 오를 때만 등급 보상 → 떨어졌다 다시 올라도 반복 보상 없음)
 * @returns {{xp: number, parts: Array<[string, number]>}}
 */
export function xpForAnswer(result, bestBefore, bestAfter, cfg) {
  const X = cfg.xp;
  const parts = [];
  if (!result || result.retry || result.practice) return { xp: 0, parts };
  if (result.correct) {
    if (result.clueUsed <= 0) parts.push(['단서 없이 정답', X.clean]);
    else if (result.clueUsed === 1) parts.push(['관계 단서 후 정답', X.clue_relation]);
    else parts.push(['직접 단서 후 정답', X.clue_direct]);
  } else if (X.wrong) parts.push(['오답', X.wrong]);
  if (result.boxTo !== null && result.boxTo > (result.boxFrom ?? 1)) parts.push(['상자 승급', X.box_up]);
  for (let g = bestBefore + 1; g <= bestAfter; g++) if (X.grade_up[g]) parts.push([['', '동', '은', '금'][g] + ' 등급 첫 달성', X.grade_up[g]]);
  return { xp: parts.reduce((s, [, v]) => s + v, 0), parts };
}

/** 레벨: n → n+1에 base + step×(n−1) XP. @returns {{level, into, need}} */
export function levelOf(xp, cfg) {
  let level = 1;
  let rest = xp;
  for (;;) {
    const need = cfg.level.base + cfg.level.step * (level - 1);
    if (rest < need) return { level, into: rest, need };
    rest -= need;
    level += 1;
  }
}

/** XP를 더한다. */
export function addXp(rw, xp) {
  return { ...rw, xp: rw.xp + Math.max(0, xp) };
}

/** 업적 목록: id, 이름, 판정(stats → bool). 기준값은 cfg.achievements. */
export function achievementDefs(cfg) {
  const A = cfg.achievements;
  return [
    { id: 'first_session', name: '첫 세션', test: (s) => s.sessions_done >= A.sessions },
    { id: 'first_bronze', name: '첫 동 등급', test: (s) => s.bronzePlus >= A.bronze },
    { id: 'first_silver', name: '첫 은 등급', test: (s) => s.silverPlus >= A.silver },
    { id: 'first_gold', name: '첫 금 등급', test: (s) => s.gold >= A.gold },
    { id: 'streak_7', name: `${A.streak}일 연속`, test: (s) => s.streakBest >= A.streak },
    { id: 'level_5', name: `레벨 ${A.level}`, test: (s) => s.level >= A.level },
  ];
}

/**
 * 학습 세션을 마쳤을 때(인출 1장 이상): 세션 보너스, 하루 목표, 연속일, 업적.
 * @param {{gold:number, silver:number, bronze:number}} grades 현재 등급 수(rules.gradeCounts)
 * @returns {{rewards, gained: {xp:number, parts:Array}, newAchievements: Array<{id,name}>, streakChanged: boolean}}
 */
export function finishSessionRewards(rw, { attempts, grades }, now, cfg) {
  if (!attempts) return { rewards: rw, gained: { xp: 0, parts: [] }, newAchievements: [], streakChanged: false };
  const today = dayKey(now);
  const parts = [['세션 완료', cfg.xp.session_done]];
  let daily = rw.daily.day === today ? { ...rw.daily } : { day: today, sessions: 0, goal_met: false };
  daily.sessions += 1;
  if (!daily.goal_met && daily.sessions >= cfg.daily_goal_sessions) { daily.goal_met = true; parts.push(['오늘 목표 달성', cfg.xp.daily_goal]); }
  let streak = { ...rw.streak };
  const before = streak.current;
  if (streak.last_day !== today) {
    streak.current = streak.last_day && dayDiff(streak.last_day, today) === 1 ? streak.current + 1 : 1;
    streak.last_day = today;
    streak.best = Math.max(streak.best, streak.current);
  }
  const gainedXp = parts.reduce((s, [, v]) => s + v, 0);
  let next = { ...rw, xp: rw.xp + gainedXp, sessions_done: rw.sessions_done + 1, daily, streak, achievements: { ...rw.achievements } };
  const stats = {
    sessions_done: next.sessions_done, gold: grades.gold, silverPlus: grades.silver + grades.gold, bronzePlus: grades.bronze + grades.silver + grades.gold,
    streakBest: streak.best, level: levelOf(next.xp, cfg).level,
  };
  const newAchievements = achievementDefs(cfg).filter((a) => !next.achievements[a.id] && a.test(stats)).map(({ id, name }) => ({ id, name }));
  for (const a of newAchievements) next.achievements[a.id] = now.toISOString();
  return { rewards: next, gained: { xp: gainedXp, parts }, newAchievements, streakChanged: streak.current !== before };
}
