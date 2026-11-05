// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/** 저장. localStorage 접근은 전부 try/catch(사생활 보호 창 등에서 실패할 수 있다). v0 web/src/storage.js에서 복사. */
export function createStore(key, storage) {
  const backend = () => {
    if (storage !== undefined) return storage;
    try { return globalThis.localStorage ?? null; } catch { return null; }
  };
  const store = {
    /** 읽을 수 없는 저장을 만났으면 true(D109, M2 F11). 원문은 `${key}:broken`에 한 번 보관한다. */
    corrupt: false,
    load() {
      let raw = null;
      try {
        raw = backend()?.getItem(key);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (d && d.version === 1) return d;
      } catch { /* 아래에서 손상으로 처리 */ }
      if (raw) {
        store.corrupt = true;
        try { const b = backend(); if (b && !b.getItem(`${key}:broken`)) b.setItem(`${key}:broken`, raw); } catch { /* 무시 */ }
      }
      return null;
    },
    save(data) {
      try { const b = backend(); if (!b) return false; b.setItem(key, JSON.stringify({ version: 1, ...data })); return true; } catch { return false; }
    },
    clear() { try { backend()?.removeItem(key); } catch { /* 무시 */ } },
  };
  return store;
}
