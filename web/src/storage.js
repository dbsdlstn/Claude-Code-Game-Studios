/**
 * 진행 저장. localStorage 접근은 전부 try/catch로 감싼다(사생활 보호 창 등에서 실패할 수 있다).
 * 저장 형식(v1, 필드 추가는 하위 호환):
 *   { version: 1, dataId: string, round: object|null, collection: {id: 'collected'|'revealed'},
 *     meta: { tutorialDone: bool }, history: Array<라운드 요약> }
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
    /** @returns {{version: number, round: object|null, collection: object, meta?: object, history?: Array<object>}|null} */
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
    /**
     * @param {{dataId?: string, round: object|null, collection: object, meta?: object, history?: Array<object>}} data
     * @returns {boolean} 저장 성공 여부
     */
    save(data) {
      try {
        const b = backend();
        if (!b) return false;
        b.setItem(key, JSON.stringify({ version: 1, dataId: data.dataId ?? '', round: data.round ?? null, collection: data.collection ?? {}, meta: data.meta ?? {}, history: data.history ?? [] }));
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
