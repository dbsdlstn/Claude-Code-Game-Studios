// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/** 저장. localStorage 접근은 전부 try/catch(사생활 보호 창 등에서 실패할 수 있다). v0 web/src/storage.js에서 복사. */
export function createStore(key, storage) {
  const backend = () => {
    if (storage !== undefined) return storage;
    try { return globalThis.localStorage ?? null; } catch { return null; }
  };
  return {
    load() {
      try {
        const raw = backend()?.getItem(key);
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d && d.version === 1 ? d : null;
      } catch { return null; }
    },
    save(data) {
      try { const b = backend(); if (!b) return false; b.setItem(key, JSON.stringify({ version: 1, ...data })); return true; } catch { return false; }
    },
    clear() { try { backend()?.removeItem(key); } catch { /* 무시 */ } },
  };
}
