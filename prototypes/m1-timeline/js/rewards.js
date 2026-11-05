// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D82 → D103)
/**
 * 보상: XP·레벨·칭호·연속 학습일(휴식권)·하루 목표·업적. `design/rewards-spec.md`(D120) 구현.
 * 순수 함수(날짜는 인자). 보상은 **읽기 전용**(§8): 상자·일정·재학습 표시를 쓰지 않는다. 테스트 모드에서는 부르지 않는다.
 * 수치는 assets/data/config/rewards.json(§9), 없으면 config.js의 기본값.
 */

/* ------------------------------------------------------------------ 저장(§10) */

export function newRewards() {
  return {
    format: 'hanyang-dogam-rewards', version: 1,
    xp: 0, level: 1, sessions_done: 0, streak: 0, best_streak: 0, rest_passes: 0,
    last_goal_date: null, goal_days_total: 0,
    achievements: {}, title: null, title_pinned: null,
    /** 그날의 세션 수·본 인출 장수(§1.3 하루 24장 상한, D184)와 목표(§3.2). */
    day: { key: null, sessions: 0, cards: 0, goal_met: false },
    /** 정산한 세션 id(멱등, 최근 것만). */
    settled: [],
  };
}

/** 저장된 보상을 읽는다. 골격(D82) 모양도 옮긴다. 모양이 틀린 값은 기본값. */
export function restoreRewards(saved) {
  const r = newRewards();
  if (!saved || typeof saved !== 'object') return r;
  const num = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  r.xp = num(saved.xp);
  r.sessions_done = num(saved.sessions_done);
  if (saved.format === 'hanyang-dogam-rewards') {
    r.streak = num(saved.streak); r.best_streak = num(saved.best_streak); r.rest_passes = num(saved.rest_passes);
    r.last_goal_date = typeof saved.last_goal_date === 'string' ? saved.last_goal_date : null;
    r.goal_days_total = num(saved.goal_days_total);
    r.title_pinned = typeof saved.title_pinned === 'string' ? saved.title_pinned : null;
    if (saved.day && typeof saved.day === 'object') r.day = { key: saved.day.key ?? null, sessions: num(saved.day.sessions), cards: num(saved.day.cards), goal_met: !!saved.day.goal_met };
    if (Array.isArray(saved.settled)) r.settled = saved.settled.filter((x) => typeof x === 'string').slice(-50);
  } else if (saved.streak && typeof saved.streak === 'object') {
    // 골격(D82): { streak: {current, best, last_day}, daily, achievements: {first_session…} }
    r.streak = num(saved.streak.current); r.best_streak = num(saved.streak.best);
    r.last_goal_date = typeof saved.streak.last_day === 'string' ? saved.streak.last_day : null;
  }
  if (saved.achievements && typeof saved.achievements === 'object') {
    const legacy = { first_session: 'first-step', first_bronze: 'first-bronze', first_silver: 'first-silver', first_gold: 'first-gold', streak_7: 'streak-7' };
    for (const [k, v] of Object.entries(saved.achievements)) if (typeof v === 'string') r.achievements[legacy[k] ?? k] = v.slice(0, 10);
  }
  return r;
}

/* ------------------------------------------------------------------ 날짜(§3.1) */

/** 하루 = 기기 달력 날짜, 오전 rolloverHour시에 바뀐다. YYYY-MM-DD. */
export function dayKey(date, rolloverHour = 0) {
  const d = new Date(date.getTime() - rolloverHour * 3600000);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayDiff(a, b) {
  const t = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

/* ------------------------------------------------------------------ 레벨·칭호(§2, §5) */

/** 누적 XP C(L) = base(L−1) + step(L−1)(L−2)/2. */
export function xpForLevel(level, cfg) {
  const n = level - 1;
  return cfg.level.base * n + (cfg.level.step * n * (n - 1)) / 2;
}

/** @returns {{level, into, need}} 레벨 n → n+1에 base + step(n−1). */
export function levelOf(xp, cfg) {
  let level = 1;
  while (xp >= xpForLevel(level + 1, cfg)) level += 1;
  return { level, into: xp - xpForLevel(level, cfg), need: xpForLevel(level + 1, cfg) - xpForLevel(level, cfg) };
}

/** 그 레벨에서 얻은 칭호 중 가장 높은 것. */
export function titleForLevel(level, cfg) {
  let t = cfg.titles[0][1];
  for (const [lv, name] of cfg.titles) if (level >= lv) t = name;
  return t;
}

/** 표시할 칭호: 고정한 칭호가 아직 쓸 수 있으면 그것(레벨업이 덮어쓰지 않음, dogam §5), 아니면 가장 높은 것. */
export function currentTitle(rw, cfg) {
  const level = levelOf(rw.xp, cfg).level;
  const pinned = cfg.titles.find(([lv, name]) => name === rw.title_pinned && level >= lv);
  return pinned ? pinned[1] : titleForLevel(level, cfg);
}

/* ------------------------------------------------------------------ 인출 XP(§1) */

/** 본 인출 하나의 결과 종류. */
export function answerKind(rec) {
  if (!rec.correct) return 'wrong';
  if (rec.clueUsed <= 0) return 'clean';
  return rec.clueUsed === 1 ? 'relation' : 'direct';
}

/** 인출 XP(10/5/3/0). 보너스 제외. */
export function answerXp(rec, cfg) {
  return { clean: cfg.xp.clean, relation: cfg.xp.clue_relation, direct: cfg.xp.clue_direct, wrong: cfg.xp.wrong }[answerKind(rec)];
}

/**
 * 보너스(§1.2, D98·D128). 세션 수와 무관하게 항상(§1.3).
 * - 승급 +box_up: **상자 box_up_min_box(2) 이상에서** 오를 때만(상자 1 → 2, 처음 보는 카드의 첫 정답은 없음, D164).
 * - 재학습 해제 만회 +probation_release: 재학습 표시가 풀리며 상자 1 → 2가 될 때(D166).
 * - 등급: 최고 등급이 처음 오를 때 한 번.
 * changed: 상자·등급·재학습 표시가 바뀐 카드(결과 화면 D 블록).
 */
export function bonusXp(rec, cfg) {
  const from = rec.boxFrom ?? 1;
  const to = rec.boxTo ?? from;
  const up = to > from;
  const minBox = cfg.xp.box_up_min_box ?? 1;
  const boxUp = up && from >= minBox;
  const released = !!rec.probationFrom && !rec.probation && up;
  const newProbation = !!rec.probation && !rec.probationFrom;
  const grades = [];
  for (let g = (rec.bestFrom ?? 0) + 1; g <= (rec.bestTo ?? 0); g++) grades.push(g);
  return {
    boxUp, boxXp: boxUp ? cfg.xp.box_up : 0, released, releaseXp: released ? (cfg.xp.probation_release ?? 0) : 0, newProbation,
    grades, gradeXp: grades.reduce((s, g) => s + (cfg.xp.grade_up[g] ?? 0), 0),
    changed: to !== from || grades.length > 0 || newProbation || released,
  };
}

/* ------------------------------------------------------------------ 업적(§4) */

/**
 * 업적 정의. stats는 achievementStats()가 만든다. 나라별 업적 id는 `nation-*:{나라}`.
 * progress(stats) → [현재, 목표] 또는 null(진행도 없음).
 */
export function achievementDefs(nation = null, nationLabel = '') {
  const N = nationLabel || nation || '';
  const defs = [
    { id: 'first-step', name: '첫 걸음', desc: '첫 세션을 마쳤어요', test: (s) => s.sessionsDone >= 1, progress: (s) => [Math.min(1, s.sessionsDone), 1] },
    { id: 'first-bronze', name: '첫 동', desc: '카드 하나가 동 등급이 되었어요', test: (s) => s.bronzePlus >= 1, progress: null },
    { id: 'first-silver', name: '첫 은', desc: '카드 하나가 은 등급이 되었어요', test: (s) => s.silverPlus >= 1, progress: null },
    { id: 'first-gold', name: '첫 금', desc: '카드 하나를 금 등급까지 올렸어요', test: (s) => s.gold >= 1, progress: null },
    { id: 'clean-session', name: '깨끗한 한 판', desc: '한 세션에서 5장을 모두 힌트 없이 맞혔어요', test: (s) => s.sessionCards >= 5 && s.sessionClean === s.sessionCards, progress: null },
    { id: 'wrong-note-clear', name: '오답 노트 비우기', desc: '틀렸던 카드를 모두 다시 익혔어요', test: (s) => s.lapsed >= 3 && s.lapsedRecovered === s.lapsed, progress: (s) => (s.lapsed >= 3 ? [s.lapsedRecovered, s.lapsed] : null) },
    { id: 'streak-3', name: '사흘 연속', desc: '3일 이어서 공부했어요', test: (s) => s.bestStreak >= 3, progress: (s) => [Math.min(3, s.streak), 3] },
    { id: 'streak-7', name: '일주일 연속', desc: '7일 이어서 공부했어요', test: (s) => s.bestStreak >= 7, progress: (s) => [Math.min(7, s.streak), 7] },
    { id: 'streak-30', name: '한 달 연속', desc: '30일 이어서 공부했어요', test: (s) => s.bestStreak >= 30, progress: (s) => [Math.min(30, s.streak), 30] },
    { id: 'goal-days-10', name: '열흘의 공부', desc: '공부한 날이 10일이 되었어요', test: (s) => s.goalDays >= 10, progress: (s) => [Math.min(10, s.goalDays), 10] },
    { id: 'goal-days-50', name: '쉰 날의 공부', desc: '공부한 날이 50일이 되었어요', test: (s) => s.goalDays >= 50, progress: (s) => [Math.min(50, s.goalDays), 50] },
    { id: 'comeback', name: '다시 오셨네요', desc: '쉬었다가 돌아와 공부했어요', test: (s) => !!s.comeback, progress: null },
    { id: 'king-silver', name: '왕대 하나 은', desc: '한 왕 때의 카드를 모두 은 등급 이상으로 올렸어요', test: (s) => s.kingSilver, progress: null },
  ];
  if (nation) {
    defs.push(
      { id: `nation-intro:${nation}`, name: `${N} 연표 도입 완료`, desc: '모든 카드를 한 번씩 만났어요', nation, test: (s) => s.total > 0 && s.introduced === s.total, progress: (s) => [s.introduced, s.total] },
      { id: `nation-bronze:${nation}`, name: `${N} 동 완성`, desc: '모든 카드가 동 등급 이상이에요', nation, test: (s) => s.total > 0 && s.bronzePlus === s.total, progress: (s) => [s.bronzePlus, s.total] },
      { id: `nation-silver:${nation}`, name: `${N} 은 완성`, desc: '모든 카드가 은 등급 이상이에요', nation, test: (s) => s.total > 0 && s.silverPlus === s.total, progress: (s) => [s.silverPlus, s.total] },
      { id: `nation-gold:${nation}`, name: `${N} 금 완성`, desc: '모든 카드가 금 등급이에요', nation, test: (s) => s.total > 0 && s.gold === s.total, progress: (s) => [s.gold, s.total] },
    );
  }
  return defs;
}

/**
 * 업적 판정에 쓰는 값(저장 데이터에서 계산, 저장하지 않음).
 * @param {{cards, progress, gradeOf: (entry)=>0..3, slotOf: (card)=>string, rewards, session?: {cards, clean}, comeback?}} a
 */
export function achievementStats({ cards, progress, gradeOf, slotOf, rewards, session = null, comeback = false }) {
  let gold = 0; let silverPlus = 0; let bronzePlus = 0; let introduced = 0; let lapsed = 0; let lapsedRecovered = 0;
  const bySlot = new Map();
  for (const c of cards) {
    const e = progress[c.id];
    const g = e?.introduced ? gradeOf(e) : 0;
    if (e?.introduced) introduced += 1;
    if (g >= 3) gold += 1;
    if (g >= 2) silverPlus += 1;
    if (g >= 1) bronzePlus += 1;
    if ((e?.lapses ?? 0) >= 1) { lapsed += 1; if (e.box >= 3) lapsedRecovered += 1; }
    const k = slotOf(c);
    const v = bySlot.get(k) ?? { n: 0, silver: 0 };
    v.n += 1; if (g >= 2) v.silver += 1;
    bySlot.set(k, v);
  }
  const kingSilver = [...bySlot.values()].some((v) => v.n >= 2 && v.silver === v.n);
  return {
    total: cards.length, gold, silverPlus, bronzePlus, introduced, lapsed, lapsedRecovered, kingSilver,
    sessionsDone: rewards.sessions_done,
    sessionCards: session?.cards ?? 0, sessionClean: session?.clean ?? 0,
    streak: rewards.streak, bestStreak: rewards.best_streak, goalDays: rewards.goal_days_total, comeback,
  };
}

/* ------------------------------------------------------------------ 세션 정산(§1~§6) */

/**
 * 학습 세션 하나를 정산한다(세션 끝에 한 번, 같은 sessionId는 다시 정산하지 않는다).
 * @param {object} rw 보상 상태
 * @param {{sessionId: string, records: Array, base: number, retries?: number}} session records = 본 인출(첫 시도)마다
 *   {id, correct, clueUsed, boxFrom, boxTo, bestFrom, bestTo, probation}. base = 세션 큐의 원래 장수(목표 판정용).
 * @param {(rw) => object} statsFor 업적 판정 값(정산 뒤 보상 상태를 받아 achievementStats 결과를 돌려준다)
 * @param {Date} now
 * @returns {{rewards, report: object|null}} 이미 정산한 세션이면 report null
 */
export function settleSession(rw, { sessionId, records, base }, statsFor, now, cfg, defs = achievementDefs()) {
  if (rw.settled.includes(sessionId) || !records.length) return { rewards: rw, report: null };
  const today = dayKey(now, cfg.streak.day_rollover_hour);
  const day = rw.day.key === today ? { cards: 0, ...rw.day } : { key: today, sessions: 0, cards: 0, goal_met: false };
  day.sessions += 1;
  // D184: 인출 XP와 하루 목표는 그날 처음 xp_cards_per_day장(24)까지. 세션 중간에 넘기면 그 장부터 0. 승급·등급·만회는 항상.
  const cap = cfg.xp_cards_per_day ?? Infinity;
  const startCards = day.cards;
  const lines = records.map((r, i) => {
    const kind = answerKind(r);
    const b = bonusXp(r, cfg);
    const within = startCards + i < cap;
    const ax = within ? answerXp(r, cfg) : 0;
    return {
      id: r.id, kind, xp: ax, boxUp: b.boxUp, boxFrom: r.boxFrom ?? null, boxTo: r.boxTo ?? null, boxXp: b.boxXp, grades: b.grades, gradeXp: b.gradeXp,
      released: b.released, releaseXp: b.releaseXp, newProbation: b.newProbation, changed: b.changed, probation: !!r.probation,
      bonus: b.boxXp + b.gradeXp + b.releaseXp, total: ax + b.boxXp + b.gradeXp + b.releaseXp, capped: !within,
    };
  });
  day.cards = startCards + records.length;
  const xpAllowed = startCards < cap; // 목표 보너스: 이 세션이 시작될 때 아직 상한 안이면
  // 하루 목표(§3.2): 본 인출이 goal_min_cards장 이상, 또는 세션 카드가 그보다 적으면 그 전부
  const need = Math.min(cfg.goal_min_cards, Math.max(1, base));
  const goalNow = records.length >= need;
  let goal = null;
  let next = { ...rw, day, sessions_done: rw.sessions_done + 1, achievements: { ...rw.achievements }, settled: [...rw.settled, sessionId].slice(-50) };
  let comeback = false;
  if (goalNow && !day.goal_met) {
    day.goal_met = true;
    goal = { xp: xpAllowed ? cfg.xp.daily_goal : 0, usedPasses: 0, earnedPass: false, broken: null, streak: 0 };
    const last = rw.last_goal_date;
    let streak = rw.streak;
    let passes = rw.rest_passes;
    if (!last) streak = 1;
    else if (last !== today) {
      const gap = dayDiff(last, today);
      const missed = gap - 1;
      if (gap >= 8) comeback = true;
      if (missed <= 0) streak += 1;
      else if (passes >= missed) { passes -= missed; goal.usedPasses = missed; streak += 1; }
      else { if (streak > 0) goal.broken = { prev: streak, best: Math.max(rw.best_streak, streak) }; streak = 1; }
    }
    if (streak > 0 && streak % cfg.streak.rest_pass_every === 0 && streak !== rw.streak && passes < cfg.streak.rest_pass_max) { passes += 1; goal.earnedPass = true; }
    goal.streak = streak;
    next = { ...next, streak, best_streak: Math.max(rw.best_streak, streak), rest_passes: passes, last_goal_date: today, goal_days_total: rw.goal_days_total + 1 };
  }
  const sessionXp = lines.reduce((s, l) => s + l.total, 0) + (goal?.xp ?? 0);
  const lvFrom = levelOf(rw.xp, cfg).level;
  next.xp = rw.xp + sessionXp;
  const lv = levelOf(next.xp, cfg);
  next.level = lv.level;
  const titleFrom = currentTitle(rw, cfg);
  next.title = currentTitle(next, cfg);
  const stats = statsFor(next, { cards: records.length, clean: lines.filter((l) => l.kind === 'clean').length, comeback });
  const newAchievements = defs.filter((a) => !next.achievements[a.id] && a.test(stats)).map(({ id, name, desc }) => ({ id, name, desc }));
  for (const a of newAchievements) next.achievements[a.id] = today;
  return {
    rewards: next,
    report: {
      sessionId, lines, sessionXp, capped: lines.some((l) => l.capped), cappedAll: lines.every((l) => l.capped), goal, daySessions: day.sessions, dayCards: day.cards,
      level: { from: lvFrom, to: lv.level, into: lv.into, need: lv.need }, title: { from: titleFrom, to: next.title },
      achievements: newAchievements,
    },
  };
}
