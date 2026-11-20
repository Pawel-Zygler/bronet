// Wspólna konfiguracja środowiska testów E2E.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8000";

// Zdalny cel (np. produkcja Railway): testy oznaczone @local-only są pomijane,
// bo zakładają konto administratora lub zmieniają globalny stan serwera.
const isRemoteTarget = !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(baseURL);

module.exports = { baseURL, isRemoteTarget };
