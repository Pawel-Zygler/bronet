export async function apiGet(url, signal) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.detail || `Błąd HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function apiSend(url, method, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.detail || `Błąd zapisu (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

