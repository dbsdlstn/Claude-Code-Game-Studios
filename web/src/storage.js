/**
 * 진행 저장. localStorage 접근은 전부 try/catch로 감싼다(사생활 보호 창 등에서 실패할 수 있다).
 * 저장 형식: { version: 1, round: object|null, collection: {id: 'collected'|'revealed'} }
 */

/**
 * @param {string} key
 * @param {Storage|null} [storage] 테스트용 주입. 기본은 window.localStorage.
 */
export function createStore(key, storage) {
  const backend = () => {
    if (storage !== undefined) return storage;
    try { return globalThis.localStorage ?? null; } catch { return null; }
  };
  return {
    /** @returns {{version: number, round: object|null, collection: object}|null} */
    load() {
      try {
        const raw = backend()?.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && data.version === 1 ? data : null;
      } catch {
        return null;
      }
    },
    /** @returns {boolean} 저장 성공 여부 */
    save(round, collection) {
      try {
        const b = backend();
        if (!b) return false;
        b.setItem(key, JSON.stringify({ version: 1, round, collection }));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try { backend()?.removeItem(key); } catch { /* 무시 */ }
    },
  };
}
