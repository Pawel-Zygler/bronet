import { vi } from "vitest";

/**
 * Podmienia globalny fetch na prosty router. `routes` to lista [metoda, wzorzec, odpowiedź],
 * gdzie wzorzec to początek ścieżki albo RegExp, a odpowiedź to obiekt JSON albo funkcja
 * (url, options) => obiekt | { status, body }. Pierwsze dopasowanie wygrywa.
 */
export function mockApi(routes) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const route = routes.find(([m, pattern]) => {
      if (m !== method) return false;
      return pattern instanceof RegExp ? pattern.test(url) : url.startsWith(pattern);
    });
    if (!route) {
      return { ok: false, status: 404, json: async () => ({ detail: `brak mocka: ${method} ${url}` }) };
    }
    let result = typeof route[2] === "function" ? route[2](url, options) : route[2];
    const status = result && result.status && result.body !== undefined ? result.status : 200;
    const body = result && result.status && result.body !== undefined ? result.body : result;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
