/**
 * 카드 데이터 로딩. 후보 경로를 차례로 시도해 처음 읽히는 JSON 배열을 쓴다.
 */

/**
 * @param {string[]} urls
 * @param {(url: string) => Promise<Response>} [fetchFn]
 * @returns {Promise<{url: string, cards: Array<object>, tried: Array<{url: string, error: string}>}>}
 */
export async function loadCards(urls, fetchFn = (u) => fetch(u, { cache: 'no-store' })) {
  const tried = [];
  for (const url of urls) {
    try {
      const res = await fetchFn(url);
      if (!res.ok) { tried.push({ url, error: `HTTP ${res.status}` }); continue; }
      const cards = await res.json();
      if (!Array.isArray(cards)) { tried.push({ url, error: '배열이 아님' }); continue; }
      return { url, cards, tried };
    } catch (e) {
      tried.push({ url, error: String(e?.message ?? e) });
    }
  }
  const err = new Error('카드 데이터를 읽지 못했다: ' + tried.map((t) => `${t.url} (${t.error})`).join(', '));
  err.tried = tried;
  throw err;
}

/** URL 쿼리 `?data=`가 있으면 그 경로만, 없으면 설정의 후보 목록. */
export function resolveDataUrls(search, defaults) {
  const p = new URLSearchParams(search);
  const d = p.get('data');
  return d ? [d] : defaults.slice();
}
