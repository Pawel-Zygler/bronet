# Bronet — Jeden profil pomaga drugiemu

Minimalistyczna aplikacja internetowa (Web + Mobile), w której użytkownicy zapisują swoje profile z umiejętnościami (**Umiem / Potrafię pomóc z**) oraz potrzebami (**Potrzebuję / Szukam pomocy z**), wyszukują zapisane profile po umiejętnościach i dopasowują się do wzajemnej pomocy.

## Funkcjonalności

- **Minimalistyczny interfejs Web & Mobile** (czysty design, dolna nawigacja mobilna, wsparcie PWA).
- **Prawdziwy zapis profili w bazie SQLite** poprzez REST API (`FastAPI`).
- **Sekcje profilu**:
  - `Imię`
  - `Umiem (Potrafię pomóc z)` — dodawanie i zapisywanie opcji w profilu + szybkie podpowiedzi
  - `Potrzebuję (Szukam pomocy z)` — dodawanie i zapisywanie opcji w profilu + szybkie podpowiedzi
  - `Kontakt` oraz krótki opis (opcjonalnie)
- **Landing page z wyszukiwarką profili**:
  - Wyszukiwanie po umiejętnościach i imionach (odporne na brak polskich znaków, np. `zwiazki` znajduje `związki`).
  - Filtrowanie po zakresie: *Wszystkie*, *Umiem (kto pomoże)*, *Potrzebuję (kto szuka)*.
  - Klikalne popularne umiejętności wyciągane z zapisanych profili.
- **Automatyczne dopasowania (Jeden profil pomaga drugiemu)**:
  - Wskazywanie wzajemnej wymiany 1:1, osób mogących pomóc oraz osób, którym dany profil może pomóc.

## Uruchomienie lokalne

```bash
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Następnie otwórz w przeglądarce: http://127.0.0.1:8000
