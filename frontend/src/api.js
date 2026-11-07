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
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extraHeaders,
  };

  try {
    const rawAuth =
      localStorage.getItem("bronet_my_profile_cache") ||
      localStorage.getItem("bronet_auth");
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      const email = parsed?.email?.trim().toLowerCase();
      if (email === "pawel.zygler@gmail.com" || parsed?.role === "admin") {
        headers["X-Admin-Email"] = parsed.email || "pawel.zygler@gmail.com";
      }
    }
  } catch (_) {}

  const res = await fetch(url, {
    method,
    headers,
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

