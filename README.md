# Bronet — Jeden profil pomaga drugiemu

Minimalistyczna aplikacja internetowa (Web + Mobile), w której użytkownicy zakładają profile przypisane do adresu e-mail, zapisują swoje umiejętności (**Umiem / Potrafię pomóc z**) oraz potrzeby (**Potrzebuję / Szukam pomocy z**) i wyszukują ludzi po umiejętnościach.

## Wersja produkcyjna (Railway — Web & Mobile)

- **Strona główna („Szukaj chłopa”):** https://bronet-production-10e7.up.railway.app
- **Tworzenie / wczytywanie profilu na e-mail:** https://bronet-production-10e7.up.railway.app/profil

## Funkcjonalności

- **Minimalistyczny interfejs Web & Mobile** — czysty, lekki design, dolny pasek nawigacji mobilnej i manifest PWA.
- **Profile na e-mail („na start”)** — zapis nowego profilu pod adresem e-mail oraz szybkie wczytanie swojego profilu na dowolnym urządzeniu (telefon / komputer) przyciskiem **Wczytaj po mailu**.
- **Trwały zapis w bazie SQLite** poprzez REST API (`FastAPI`), z automatyczną obsługą wolumenu produkcyjnego (`RAILWAY_VOLUME_MOUNT_PATH`).
- **Sekcje profilu**:
  - `E-mail` (do zapisu, edycji i kontaktu mailowego `mailto:`)
  - `Imię`
  - `Umiem (Potrafię pomóc z)` — dodawanie i zapisywanie opcji w profilu + szybkie podpowiedzi z bazy
  - `Potrzebuję (Szukam pomocy z)` — dodawanie i zapisywanie potrzeb w profilu + szybkie podpowiedzi
  - `Kontakt` oraz krótki opis `O mnie` (opcjonalnie)
- **Wyszukiwarka „Szukaj chłopa” na stronie głównej**:
  - Wyszukiwanie po umiejętnościach i imionach (odporne na brak polskich znaków — np. `zwiazki` znajduje `związki`).
  - Filtrowanie po zakresie: *Wszystkie*, *Umiem (kto pomoże)*, *Potrzebuję (kto szuka)*.
  - Klikalne popularne umiejętności pobierane dynamicznie z zapisanych profili.

## Uruchomienie lokalne

```bash
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Następnie otwórz w przeglądarce: http://127.0.0.1:8000

### Testy jednostkowe

```bash
python3 -m unittest discover -s tests -v
```

## Wdrożenie i infrastruktura (Railway)

Aplikacja jest skonteneryzowana w `Dockerfile` i hostowana na **Railway** z trwałym wolumenem dla bazy SQLite (`/data/bronet.db`):

- **Projekt:** `bronet` (`b632c5a1-7c32-4a11-938b-9c178d971565`)
- **Środowisko:** `production` (`d722d5f8-6334-4e02-add4-451db186e8ff`)
- **Serwis:** `bronet` (`6de612f9-9bab-463a-ac20-f128194ebeaa`)
- **Wolumen bazy danych:** `bronet-volume` (`c84570de-ded0-4c42-b5b6-c03f986ee517`, ścieżka `/data`)
- **Panel projektu Railway:** https://railway.com/project/b632c5a1-7c32-4a11-938b-9c178d971565/service/6de612f9-9bab-463a-ac20-f128194ebeaa?environmentId=d722d5f8-6334-4e02-add4-451db186e8ff

### Wdrażanie kolejnych zmian na produkcję

```bash
railway up --ci -m "Opis zmian"
```
