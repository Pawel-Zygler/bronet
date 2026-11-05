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

## Automation Gate (Kryteria automatyzacji testów)

Zasada decyzyjna przed automatyzacją nowego przypadku testowego:

1. **Czy wykonanie testu będzie powtarzane w przyszłości?** (T/N)
2. **Czy automatyzacja tego przypadku jest możliwa?** (T/N)
3. **Jak ważny jest ten przypadek dla aplikacji?** (Skala 1 – 5)
4. **Jak łatwa jest automatyzacja tego przypadku?** (Skala 1 – 5)

**Reguły bramki:**
- Jeśli pytanie 1 lub 2 = **„N”** → **Nie automatyzuj**.
- Pytania 3 i 4 → **Suma punktów (2 – 10)**. Przypadki z wyższą rangą są automatyzowane w pierwszej kolejności.

### Ocena obecnego zestawu testów w Bronet

| Przypadek testowy | Typ | Q1 (Powtarzalny?) | Q2 (Możliwy?) | Q3 (Waga 1-5) | Q4 (Łatwość 1-5) | Suma (Ranga) | Status bramki |
|---|---|---|---|---|---|---|---|
| Smoke: Landing & Header | E2E `@smoke` | T | T | 5 | 5 | **10** | Spełnia (Top priorytet) |
| Backend CRUD, Auth & Matching | Unit | T | T | 5 | 5 | **10** | Spełnia (Top priorytet) |
| Diakrytyki i filtry wyszukiwania | Unit | T | T | 5 | 5 | **10** | Spełnia (Top priorytet) |
| Cykl życia profilu (auto-create, login, delete) | E2E `@smoke` | T | T | 5 | 4 | **9** | Spełnia |
| Przełączanie Compact View & email link | E2E `@smoke` | T | T | 4 | 5 | **9** | Spełnia |
| Formularz logowania dla gościa | E2E `@regression` | T | T | 4 | 5 | **9** | Spełnia |
| Szukanie po skillu i widok read-only | E2E `@regression` | T | T | 4 | 4 | **8** | Spełnia |

*Wszystkie obecne testy w repozytorium spełniają kryteria bramki (Q1=T, Q2=T, wysoki ranking 8–10).*

## CI/CD (GitHub Actions)

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) uruchamia się przy pushu/PR na `main`:
1. **Smoke Tests:** buduje aplikację i uruchamia testy `@smoke` w Playwright.
2. **Deploy to Railway:** wykonuje się **tylko wtedy, gdy smoke testy zakończą się sukcesem**. W razie błędu deploy na prod jest blokowany.
Wymagany secret w repo: `RAILWAY_TOKEN` (GitHub → Settings → Secrets and variables → Actions).

## Deploy ręczny (Railway CLI)

- **Projekt / Serwis / Env:** `bronet` (`b632c5a1-7c32-4a11-938b-9c178d971565`) / `6de612f9-9bab-463a-ac20-f128194ebeaa` / `production` (`d722d5f8-6334-4e02-add4-451db186e8ff`)
- **Wolumen SQLite:** `/data/bronet.db` (`bronet-volume`: `c84570de-ded0-4c42-b5b6-c03f986ee517`)

```bash
railway up --ci -m "Opis zmian"
```
