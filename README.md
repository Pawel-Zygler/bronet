# Bronet — Jeden chłop pomaga drugiemu

Minimalistyczna wymiana umiejętności peer-to-peer (React + FastAPI + SQLite).

## Produkcja (Railway)

- **App:** https://bronet-production-10e7.up.railway.app
- **Profil:** https://bronet-production-10e7.up.railway.app/profil
- **Panel Railway:** https://railway.com/project/b632c5a1-7c32-4a11-938b-9c178d971565/service/6de612f9-9bab-463a-ac20-f128194ebeaa?environmentId=d722d5f8-6334-4e02-add4-451db186e8ff

## Start lokalny

```bash
npm run build
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

URL lokalny: http://127.0.0.1:8000

## Testy (Unit / Smoke / Regression)

| Komenda | Zakres |
|---|---|
| `npm run test:unit` | Testy jednostkowe backendu (`unittest`) |
| `npm run test:smoke` | Szybkie testy E2E `@smoke` (Playwright, lokalnie) |
| `npm run test:regression` | Pełna regresja E2E `@regression` (Playwright, lokalnie) |
| `npm test` | Wszystkie testy Playwright E2E |
| `npm run test:headed` | Testy E2E z widoczną przeglądarką |
| `npm run test:ui` | Interaktywny tryb Playwright UI |
| `npm run test:prod:smoke` | Testy `@smoke` na produkcji Railway |
| `npm run test:prod:regression` | Pełna regresja `@regression` na produkcji Railway |

## Deploy (Railway)

- **Projekt / Serwis / Env:** `bronet` (`b632c5a1-7c32-4a11-938b-9c178d971565`) / `6de612f9-9bab-463a-ac20-f128194ebeaa` / `production` (`d722d5f8-6334-4e02-add4-451db186e8ff`)
- **Wolumen SQLite:** `/data/bronet.db` (`bronet-volume`: `c84570de-ded0-4c42-b5b6-c03f986ee517`)

```bash
railway up --ci -m "Opis zmian"
```
