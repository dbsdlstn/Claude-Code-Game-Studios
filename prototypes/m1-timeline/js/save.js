// PROTOTYPE - NOT FOR PRODUCTION (M2, decision-log D82)
/**
 * 일반 모드 저장(나라별, 카드 id 기준). main.js는 나라 하나의 평평한 모양({dataId, completed_sessions, cards, current, log,
 * participant, rewards})으로 읽고 쓴다. 저장 안에서는:
 *   cards: 모든 나라의 카드 진행(카드 id 기준, 덱 파일이 늘거나 바뀌어도 유지),
 *   nations: { [나라]: { dataId, completed_sessions, current } }, last_nation, log, participant, rewards.
 * M1 모양(최상위 completed_sessions·current·dataId)은 defaultNation의 것으로 옮긴다.
 */
const LEGACY = ['dataId', 'completed_sessions', 'current'];

export function migrateSave(s, defaultNation) {
  if (!s || typeof s !== 'object') return null;
  const out = { ...s, cards: s.cards && typeof s.cards === 'object' ? { ...s.cards } : {}, nations: { ...(s.nations ?? {}) } };
  if (!s.nations && LEGACY.some((k) => k in s)) {
    out.nations[defaultNation] = { dataId: s.dataId ?? null, completed_sessions: s.completed_sessions ?? 0, current: s.current ?? null };
  }
  for (const k of LEGACY) delete out[k];
  return out;
}

export function lastNation(store, defaultNation) {
  const s = migrateSave(store.load(), defaultNation);
  return s?.last_nation ?? defaultNation;
}

export function nationStoreAdapter(store, nation, defaultNation) {
  return {
    load() {
      const s = migrateSave(store.load(), defaultNation);
      if (!s) return null;
      const n = s.nations[nation] ?? {};
      return {
        dataId: n.dataId ?? null, completed_sessions: n.completed_sessions ?? 0, cards: s.cards, current: n.current ?? null,
        log: s.log ?? [], participant: s.participant, rewards: s.rewards ?? null, first_day: s.first_day ?? null,
      };
    },
    save(data) {
      const s = migrateSave(store.load(), defaultNation) ?? { cards: {}, nations: {} };
      s.format = data.format ?? s.format;
      s.cards = { ...s.cards, ...data.cards };
      s.nations = { ...s.nations, [nation]: { dataId: data.dataId, completed_sessions: data.completed_sessions, current: data.current } };
      s.last_nation = nation;
      s.log = data.log;
      s.participant = data.participant;
      if (data.rewards) s.rewards = data.rewards;
      if (data.first_day) s.first_day = data.first_day;
      return store.save(s);
    },
    clear() { store.clear(); },
  };
}
