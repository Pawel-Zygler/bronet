#!/usr/bin/env python3
"""
Generator 1500 profili dla Bronet na podstawie zawodów i kategorii Pracuj.pl.
Zawiera autentyczne polskie zawody, realistyczne umiejętności (can_help),
zapotrzebowania (need_help), kontakty oraz naturalne biogramy.
"""

import json
import random
import sys
from pathlib import Path
from typing import List, Dict, Any

# Dodaj główny katalog projektu do sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import hash_password

FIRST_NAMES = [
    "Adam", "Adrian", "Aleksander", "Andrzej", "Antoni", "Arkadiusz", "Artur", "Bartłomiej",
    "Bartosz", "Bogdan", "Błażej", "Cezary", "Czesław", "Damian", "Daniel", "Dariusz",
    "Dawid", "Dominik", "Edward", "Emil", "Eugeniusz", "Filip", "Franciszek", "Gabriel",
    "Grzegorz", "Henryk", "Hubert", "Igor", "Jacek", "Jakub", "Jan", "Jarosław",
    "Jerzy", "Julian", "Kajetan", "Kamil", "Karol", "Kazimierz", "Konrad", "Krystian",
    "Krzysztof", "Leon", "Leszek", "Maciej", "Maksymilian", "Marcel", "Marcin", "Marek",
    "Marian", "Mariusz", "Mateusz", "Michał", "Mieczysław", "Mirosław", "Miłosz", "Nikodem",
    "Norbert", "Oliwier", "Patryk", "Paweł", "Piotr", "Przemysław", "Radosław", "Rafał",
    "Robert", "Roman", "Sebastian", "Stanisław", "Szymon", "Tadeusz", "Tomasz", "Tymon",
    "Waldemar", "Wiesław", "Wiktor", "Wojciech", "Władysław", "Zbigniew", "Zdzisław", "Łukasz"
]

LAST_NAMES = [
    "Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński",
    "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Wojciechowski", "Kwiatkowski",
    "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski", "Zając", "Pawłowski", "Michalski", "Król",
    "Wieczorek", "Jabłoński", "Wróbel", "Nowakowski", "Majewski", "Olszewski", "Stępień", "Jaworski",
    "Malinowski", "Dudek", "Adamczyk", "Górski", "Nowicki", "Sikora", "Walczak", "Witkowski",
    "Baran", "Rutkowski", "Michalak", "Szewczyk", "Ostrowski", "Tomaszewski", "Pietrzak", "Zalewski",
    "Wróblewski", "Marciniak", "Jasiński", "Zawadzki", "Bąk", "Jakubowski", "Wilk", "Chmielewski",
    "Włodarczyk", "Borkowski", "Czarnecki", "Sawicki", "Sokołowski", "Urbański", "Kubiak", "Maciejewski",
    "Szczepański", "Kucharski", "Kalinowski", "Wysocki", "Głowacki", "Kołodziej", "Krajewski", "Sobczak",
    "Laskowski", "Ciesielski", "Sikorski", "Kołodziejczyk", "Gajewski", "Zakrzewski", "Szulc", "Baranowski",
    "Krupa", "Kozak", "Markowski", "Prus", "Brzeziński", "Błaszczyk", "Cieślak", "Kaczmarczyk"
]

CITIES = [
    "Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Katowice", "Łódź", "Szczecin",
    "Lublin", "Bydgoszcz", "Białystok", "Gdynia", "Częstochowa", "Radom", "Rzeszów",
    "Toruń", "Sosnowiec", "Kielce", "Gliwice", "Olsztyn", "Zabrze", "Bielsko-Biała",
    "Bytom", "Zielona Góra", "Rybnik", "Ruda Śląska", "Opole", "Tychy", "Gorzów Wlkp.",
    "Dąbrowa Górnicza", "Płock", "Elbląg", "Wałbrzych", "Włocławek", "Tarnów", "Kalisz",
    "Koszalin", "Legnica", "Grudziądz", "Słupsk"
]

JOB_CATEGORIES = [
    # 1. IT - Software & Cloud
    {
        "category": "IT - Software",
        "jobs": [
            {
                "title": "Python / Django Developer",
                "can": ["python", "django", "fastapi", "postgresql", "rest api", "docker"],
                "need": ["mechanika samochodowa", "hydraulik", "remont łazienki", "fizjoterapia"],
                "bio_tmpl": "Senior Python developer z 7-letnim stażem. Postawię backend, zoptymalizuję bazę danych lub napiszę scraper. Chętnie wymienię się za pomoc przy {need} w okolicach {city} lub zdalnie."
            },
            {
                "title": "Frontend / React Developer",
                "can": ["react", "typescript", "next.js", "tailwind css", "javascript", "figma"],
                "need": ["elektryk sep", "montaż mebli", "klimatyzacja", "doradztwo podatkowe"],
                "bio_tmpl": "Programista frontend (React/TypeScript). Pomogę postawić nowoczesną stronę WWW, aplikację webową lub sklep. Szukam chłopa, który ogarnia {need}."
            },
            {
                "title": "DevOps / Cloud Engineer",
                "can": ["kubernetes", "aws", "docker", "terraform", "ci/cd", "linux"],
                "need": ["blacharstwo", "wymiana rozrządu", "układanie paneli", "trener personalny"],
                "bio_tmpl": "Na co dzień stawiam chmury AWS i klastry K8s. Zautomatyzuję wdrożenia i infrastrukturę serwerową. Potrzebuję wsparcia z {need}."
            },
            {
                "title": "Java / Spring Developer",
                "can": ["java", "spring boot", "mikroserwisy", "kafka", "sql", "hibernate"],
                "need": ["kafelkowanie", "geometria kół", "prawo budowlane", "rehabilitacja"],
                "bio_tmpl": "Backendowiec enterprise w korpo. Pomogę przy architekturze kodu, integracjach systemowych i Springu. Szukam kogoś do {need}."
            },
            {
                "title": "QA Automation / Tester oprogramowania",
                "can": ["testy automatyczne", "playwright", "cypress", "python", "selenium", "postman"],
                "need": ["stolarstwo", "klimatyzacja domowa", "podatki b2b", "wymiana opon"],
                "bio_tmpl": "QA Automation. Pokryję Twój projekt testami E2E w Playwright lub pomogę wejść w branżę testowania. W zamian przyda mi się fachowiec od {need}."
            },
            {
                "title": "Mobile Developer (Android / iOS)",
                "can": ["android", "kotlin", "ios", "swift", "flutter", "aplikacje mobilne"],
                "need": ["instalacja elektryczna", "ogrzewanie podłogowe", "diagnostyka obd", "masaż"],
                "bio_tmpl": "Tworzę natywne i hybrydowe aplikacje na smartfony. Pomogę wdrożyć apkę do Google Play i App Store. Potrzebuję rąk do pracy przy {need}."
            },
            {
                "title": "Data Analyst / Data Engineer",
                "can": ["sql", "power bi", "analiza danych", "python", "excel", "etl"],
                "need": ["mechanik", "malowanie ścian", "spawanie", "umowy handlowe"],
                "bio_tmpl": "Wyciągam wnioski z danych, buduję dashboardy w Power BI i skrypty w Pythonie. Chętnie pomogę w zamian za wsparcie: {need}."
            },
            {
                "title": "Administrator Linux & Sieci",
                "can": ["linux", "sieci lan/wan", "mikrotik", "cisco", "vpn", "bezpieczeństwo sieci"],
                "need": ["montaż klimatyzacji", "pompa ciepła", "remont kuchni", "dietetyka"],
                "bio_tmpl": "Sysadmin z krwi i kości. Skonfiguruję serwery, firewalle, bezpieczny VPN i infrastrukturę biurową. Szukam pomocy przy {need}."
            },
            {
                "title": "Specjalista ds. Cyberbezpieczeństwa",
                "can": ["cyberbezpieczeństwo", "audyt it", "pentesty", "ochrona danych", "bezpieczeństwo sieci"],
                "need": ["blacharz samochodowy", "hydraulika", "cyklinowanie parkietu", "fizjoterapeuta"],
                "bio_tmpl": "Audytor security. Sprawdzę bezpieczeństwo Twojego sklepu, serwera lub sieci firmowej. W zamian poszukuję kogoś do {need}."
            },
            {
                "title": "Fullstack PHP & WordPress",
                "can": ["wordpress", "woocommerce", "php", "mysql", "optymalizacja stron", "seo techniczne"],
                "need": ["naprawa agd", "elektryk sep", "badania techniczne auta", "trening siłowy"],
                "bio_tmpl": "Stawiam i ratuję sklepy WooCommerce oraz serwisy na WordPressie. Szybko i bez lania wody. Szukam chłopa znającego się na {need}."
            }
        ]
    },

    # 2. Budownictwo, Remonty, Wykończenia wnętrz
    {
        "category": "Budownictwo i Wykończenia",
        "jobs": [
            {
                "title": "Elektryk z uprawnieniami SEP",
                "can": ["instalacje elektryczne", "uprawnienia sep", "rozdzielnice", "pomiary elektryczne", "smart home", "oświetlenie led"],
                "need": ["strona www", "księgowość b2b", "pozycjonowanie google", "serwis laptopa"],
                "bio_tmpl": "Elektryk z uprawnieniami SEP E+D do 1kV oraz pomiarami. Wykonam nową instalację, biały montaż, modernizację rozdzielnicy. Wymienię się za {need}."
            },
            {
                "title": "Hydraulik / Instalator sanitarny",
                "can": ["instalacje hydrauliczne", "ogrzewanie podłogowe", "montaż pieców", "udrażnianie rur", "pompy ciepła", "biały montaż"],
                "need": ["reklama na facebooku", "program do faktur", "angielski biznesowy", "naprawa auta"],
                "bio_tmpl": "15 lat w branży instalacyjnej. Piony, podłogówka, montaż kotłów i armatury. Solidna robota. Szukam kogoś od {need}."
            },
            {
                "title": "Glazurnik / Mistrz kafelkowania",
                "can": ["układanie płytek", "glazura", "spieki kwarcowe", "remonty łazienek", "hydroizolacja", "cięcie pod kątem 45"],
                "need": ["sklep internetowy", "umowy b2b", "angielski techniczny", "doradztwo kredytowe"],
                "bio_tmpl": "Precyzyjny glazurnik. Łazienki pod klucz, wielki format, gresy, cięcia pod kątem 45 stopni. Wymienię moje usługi za wsparcie z {need}."
            },
            {
                "title": "Stolarz meblowy / Meble na wymiar",
                "can": ["kuchnie na wymiar", "stolarstwo", "szafy przesuwne", "obróbka drewna", "montaż blatów", "projektowanie mebli"],
                "need": ["kampanie google ads", "program magazynowy", "prawo autorskie", "mechanika silników"],
                "bio_tmpl": "Własny warsztat stolarski. Kuchnie, garderoby, zabudowy wnękowe na Blumie i Hettichu. Szukam fachowca, który ogarnie mi {need}."
            },
            {
                "title": "Malarz / Szpachlarz natryskowy",
                "can": ["szpachlowanie bezpyłowe", "malowanie natryskowe", "zabudowa g-k", "gładzie gipsowe", "sufity podwieszane"],
                "need": ["konfiguracja komputera", "księgowość jdg", "social media", "fizjoterapia kręgosłupa"],
                "bio_tmpl": "Gładzie maszynowe i malowanie hydrodynamiczne. Idealnie proste ściany bez pyłu. Chętnie zrobię mieszkanie w zamian za {need}."
            },
            {
                "title": "Monter klimatyzacji i pomp ciepła",
                "can": ["montaż klimatyzacji", "f-gazy", "pompy ciepła", "wentylacja", "serwis klimatyzacji", "rekuperacja"],
                "need": ["strona wizytówka", "umowy handlowe", "aplikacja webowa", "marketing lokalny"],
                "bio_tmpl": "Uprawnienia F-gazy, montaż klimatyzacji split/multisplit oraz pomp ciepła. Chętnie założę klimę w zamian za profesjonalne {need}."
            },
            {
                "title": "Kierownik budowy / Inżynier budowlany",
                "can": ["nadzór budowlany", "odbiory techniczne", "kierowanie budową", "kosztorysowanie", "przeglądy budynków", "uprawnienia budowlane"],
                "need": ["automatyzacja excela", "python", "angielski w pracy", "serwis klimatyzacji"],
                "bio_tmpl": "Uprawniony inżynier budownictwa. Prowadzę dzienniki budowy, odbiory mieszkań od dewelopera i ekspertyzy. Szukam kogoś od {need}."
            },
            {
                "title": "Geodeta uprawniony",
                "can": ["geodezja", "mapy do celów projektowych", "tyczenie budynków", "podziały działek", "inwentaryzacja powykonawcza"],
                "need": ["regeneracja turbiny", "montaż paneli fotowoltaicznych", "copywriting b2b", "trening personalny"],
                "bio_tmpl": "Geodeta z własnym sprzętem GPS i tachimetrem. Pomiary działek, tyczenia, inwentaryzacje. Wymienię usługi geodezyjne na {need}."
            },
            {
                "title": "Dekarz / Blacharz dachowy",
                "can": ["pokrycia dachowe", "obróbki blacharskie", "naprawa dachów", "blachodachówka", "montaż rynien", "więźba dachowa"],
                "need": ["doradztwo podatkowe", "strona internetowa", "fizjoterapeuta", "diagnostyka samochodu"],
                "bio_tmpl": "Dachy to moje życie od 12 lat. Od więźby po dachówkę i rynny. Zrobię dach lub naprawię przeciek w zamian za pomoc w {need}."
            },
            {
                "title": "Złota rączka / Wykończeniowiec",
                "can": ["złota rączka", "drobne naprawy", "montaż paneli", "skręcanie mebli", "silikonowanie", "wiercenie w betonie"],
                "need": ["rozliczenie pit", "odzyskiwanie danych", "angielski konwersacje", "prawo konsumenckie"],
                "bio_tmpl": "Ogarniam wszelkie naprawy domowe, od wymiany zamka, przez panele, po powieszenie szafek. Przyda mi się pomoc w temacie {need}."
            }
        ]
    },

    # 3. Mechanika, Motoryzacja, Transport
    {
        "category": "Motoryzacja i Transport",
        "jobs": [
            {
                "title": "Mechanik samochodowy ogólny",
                "can": ["wymiana rozrządu", "zawieszenie", "układ hamulcowy", "serwis olejowy", "remonty silników", "wymiana sprzęgła"],
                "need": ["fakturowanie online", "system crm", "porada prawna b2b", "klimatyzacja w warsztacie"],
                "bio_tmpl": "Prowadzę warsztat mechaniczny. Diagnozuję stuki, robię rozrządy, sprzęgła i całe zawieszenia. Chętnie ogarnę Twoje auto za {need}."
            },
            {
                "title": "Elektromechanik pojazdowy / Diagnosta OBD",
                "can": ["diagnostyka komputerowa", "naprawa wiązek", "kodowanie sterowników", "regeneracja alternatorów", "usuwanie błędów obd", "elektronika samochodowa"],
                "need": ["strona www", "angielski techniczny", "remont garażu", "rehabilitacja barku"],
                "bio_tmpl": "Elektromechanik. Znajduję zwarcia, naprawiam sterowniki, koduję wtryski i usuwam choinkę na desce. Wymienię wiedzę za {need}."
            },
            {
                "title": "Blacharz i lakiernik / Auto detailing",
                "can": ["blacharstwo", "lakiernictwo", "polerowanie lakieru", "usuwanie wgnieceń pdr", "zabezpieczenie antykorozyjne", "powłoki ceramiczne"],
                "need": ["księgowość ryczałt", "pozycjonowanie warsztatu", "instalacja elektryczna 3-fazy", "spawanie tig"],
                "bio_tmpl": "Usuwam wgniotki po gradzie metodą PDR, lakieruję elementy i kładę ceramikę. Zadbajmy o Twoje auto w zamian za {need}."
            },
            {
                "title": "Gazownik samochodowy / Serwis LPG",
                "can": ["montaż lpg", "regulacja gazu", "serwis instalacji lpg", "wymiana wtryskiwaczy lpg", "strojenie sondy lambda"],
                "need": ["grafika reklamowa", "doradca leasingowy", "remont podłogi", "trener siłownia"],
                "bio_tmpl": "Montaż i precyzyjne strojenie instalacji Stag, BRC, KME pod obciążeniem. Potrzebuję wsparcia od kogoś, kto ogarnia {need}."
            },
            {
                "title": "Diagnosta SKP / Rzeczoznawca aut",
                "can": ["badanie techniczne", "sprawdzanie auta przed zakupem", "geometria 3d", "pomiar grubości lakieru", "weryfikacja vin"],
                "need": ["pomoc it", "fizjoterapia kręgosłupa", "podatki dochodowe", "instalacja fotowoltaiczna"],
                "bio_tmpl": "Diagnosta na stacji kontroli pojazdów. Sprawdzę każde auto przed zakupem, przetrzepię zawieszenie i geometrię. W zamian: {need}."
            },
            {
                "title": "Kierowca międzynarodowy C+E",
                "can": ["transport c+e", "przewóz towarów", "znajomość tras ue", "czas pracy kierowcy", "zabezpieczanie ładunków", "adr"],
                "need": ["prawo podatkowe", "fizjoterapia kręgosłupa", "serwis laptopa", "naprawa pralki"],
                "bio_tmpl": "Kierowca zawodowy w trasach międzynarodowych. Pomogę przy relokacji, transporcie gabarytów lub poradach transportowych. Szukam wsparcia: {need}."
            },
            {
                "title": "Spedytor międzynarodowy",
                "can": ["spedycja drogowa", "giełdy transportowe", "planowanie tras", "odprawy celne", "optymalizacja logistyki", "negocjacje stawek"],
                "need": ["mechanik bmw/audi", "remont mieszkania", "fitness i dieta", "pomiary sep"],
                "bio_tmpl": "Spedytor z 6-letnim stażem na rynkach UE. Zorganizuję fracht lub zoptymalizuję logistykę firmy. Wymienię wiedzę za {need}."
            },
            {
                "title": "Operator wózka widłowego / Magazynier UDT",
                "can": ["uprawnienia udt", "obsługa wózków widłowych", "logistyka magazynowa", "kompletacja zamówień", "zarządzanie towarem"],
                "need": ["doradztwo prawne", "prawo jazdy kat a", "hydraulik", "napisanie dobrego cv"],
                "bio_tmpl": "Wieloletni magazynier z uprawnieniami UDT na wózki wysokiego składu. Pomogę przy rozładunku, załadunku i magazynowaniu. Szukam {need}."
            }
        ]
    },

    # 4. Inżynieria, Produkcja, Obróbka metali
    {
        "category": "Inżynieria i Produkcja",
        "jobs": [
            {
                "title": "Spawacz TIG / MAG (Konstrukcje stalowe)",
                "can": ["spawanie tig", "spawanie mag", "spawanie aluminium", "balustrady nierdzewne", "konstrukcje stalowe", "cięcie plazmą"],
                "need": ["angielski techniczny", "cv na pracuj.pl", "doradztwo podatkowe", "strona firmowa"],
                "bio_tmpl": "Uprawnienia spawalnicze TIG/MAG. Spawam stal czarną, nierdzewkę i aluminium. Zrobię balustradę, bramę lub naprawię pęknięcie za {need}."
            },
            {
                "title": "Ślusarz / Tokarz i Frezer CNC",
                "can": ["tokarstwo", "frezowanie cnc", "obróbka skrawaniem", "dorabianie części", "gwintowanie", "szlifowanie metali"],
                "need": ["pomoc z komputerem", "porada prawna", "remont pokoju", "fizjoterapia"],
                "bio_tmpl": "Doświadczony tokarz/frezer z własnym zapleczem maszynowym. Dorobię każdą nietypową tuleję, wałek czy śrubę. Wymienię usługi za {need}."
            },
            {
                "title": "Automatyk przemysłowy / Programista PLC",
                "can": ["programowanie plc", "siemens s7", "falowniki", "automatyka przemysłowa", "szafy sterownicze", "scada"],
                "need": ["mechanika samochodowa", "dietetyka", "naprawa dachu", "stolarz"],
                "bio_tmpl": "Automatyk na fabrykach. Programuję PLC (Siemens, Allen Bradley), projektuję szafy sterownicze. Szukam pomocy fachowca od {need}."
            },
            {
                "title": "Inżynier konstruktor CAD (SolidWorks)",
                "can": ["solidworks", "projektowanie cad", "autocad", "druk 3d", "dokumentacja techniczna", "modelowanie 3d"],
                "need": ["kafelkowanie", "hydraulika", "rehabilitacja rąk", "auto detailing"],
                "bio_tmpl": "Projektuję części maszyn i obudowy w SolidWorks. Wykonam model 3D, rysunki wykonawcze lub prototyp na drukarce 3D. W zamian: {need}."
            },
            {
                "title": "Serwisant AGD i elektroniki",
                "can": ["naprawa pralek", "naprawa zmywarek", "naprawa ekspresów do kawy", "lutowanie smd", "serwis płyt indukcyjnych"],
                "need": ["social media", "optymalizacja podatkowa", "transport busem", "trener personalny"],
                "bio_tmpl": "Naprawiam pralki, lodówki, zmywarki i ciśnieniowe ekspresy do kawy. Zamiast wyrzucać sprzęt, ożywię go! Szukam kogoś do {need}."
            },
            {
                "title": "Tapicer meblowy i samochodowy",
                "can": ["tapicerstwo", "renowacja foteli", "obszywanie kierownic", "tapicerka meblowa", "pianki i sprężyny"],
                "need": ["landing page", "sprzedaż na allegro", "prawo pracy", "elektryk"],
                "bio_tmpl": "Odnawiam klasyczne fotele, sofy i tapicerkę samochodową. Nowe obszycie kierownicy skórzaną nicią. W zamian potrzebuję {need}."
            }
        ]
    },

    # 5. Finanse, Księgowość, Prawo i B2B
    {
        "category": "Finanse, Księgowość i Prawo",
        "jobs": [
            {
                "title": "Księgowy B2B / Doradca jednoosobowych firm",
                "can": ["księgowość jdg", "ryczałt ewidencjonowany", "kpir", "deklaracje vat i zus", "optymalizacja kosztów", "jpk"],
                "need": ["remont mieszkania", "serwis laptopa", "mechanik samochodowy", "klimatyzacja"],
                "bio_tmpl": "Księgowy z licencją MF. Prowadzę KPiR, ryczałt, pomagam założyć firmę i nie dać się ograbić z podatków. Chętnie pomogę w zamian za {need}."
            },
            {
                "title": "Doradca podatkowy / Specjalista spółek",
                "can": ["doradztwo podatkowe", "estoński cit", "spółki z o.o.", "ulga b+r", "audyt podatkowy", "kontrole skarbowe"],
                "need": ["hydraulik", "wykończenie wnętrz", "serwis klimatyzacji", "detailing auta"],
                "bio_tmpl": "Doradca podatkowy. Przekształcam firmy, wdrażam estoński CIT i zabezpieczam majątek przed fiskusem. Poszukuję solidnego chłopa do {need}."
            },
            {
                "title": "Radca prawny / Prawnik biznesowy",
                "can": ["umowy b2b", "prawo spółek", "dochodzenie należności", "regulaminy", "prawo pracy", "opiniowanie umów"],
                "need": ["tworzenie stron www", "hydraulik", "malowanie natryskowe", "wymiana klocków hamulcowych"],
                "bio_tmpl": "Radca prawny z 10-letnim doświadczeniem. Zabezpieczam umowy, windykuję niepłacących kontrahentów i piszę pozwy. Wymienię usługi prawne za {need}."
            },
            {
                "title": "Ekspert kredytowy / Kredyty hipoteczne",
                "can": ["kredyty hipoteczne", "zdolność kredytowa", "leasing maszyn i aut", "kredyty firmowe", "refinansowanie"],
                "need": ["stolarz meblowy", "mechanik", "kafelkowanie", "ogrodzenie działki"],
                "bio_tmpl": "Niezależny doradca finansowy. Zbadam zdolność kredytową, wywalczę najniższą marżę i załatwię leasing. Wymienię się za {need}."
            },
            {
                "title": "Audytor finansowy / Analityk kosztów",
                "can": ["controlling finansowy", "analiza kosztów", "budżetowanie", "modele w excelu", "wycena przedsiębiorstw"],
                "need": ["remont łazienki", "trener personalny", "naprawa zawieszenia", "geodeta"],
                "bio_tmpl": "Analityk finansowy. Znajdę gdzie uciekają pieniądze w Twoim biznesie i ułożę model płynności. Potrzebuję wsparcia przy {need}."
            }
        ]
    },

    # 6. Marketing, Sprzedaż, Media i Grafika
    {
        "category": "Marketing, Grafika i Sprzedaż",
        "jobs": [
            {
                "title": "Specjalista SEO & Google Ads",
                "can": ["pozycjonowanie seo", "google ads", "audyt seo", "analityka internetowa", "google my business", "link building"],
                "need": ["elektryka w domu", "mechanik auto", "spawanie ramy", "naprawa skrzyni biegów"],
                "bio_tmpl": "Wbijam strony na 1. stronę Google i prowadzę skuteczne kampanie Ads, które przynoszą telefony. Zrobię marketing Twojego fachu za {need}."
            },
            {
                "title": "Grafik komputerowy / UI Designer",
                "can": ["identyfikacja wizualna", "projektowanie logo", "figma", "photoshop", "materiały reklamowe", "grafika www"],
                "need": ["doradztwo podatkowe", "hydraulika", "wymiana opon", "montaż rolet"],
                "bio_tmpl": "Zaprojektuję spójne logo, wizytówki, oklejenie na busa lub interfejs aplikacji. Chętnie wymienię projekty graficzne za {need}."
            },
            {
                "title": "Montażysta wideo / Twórca rolek i YouTube",
                "can": ["montaż wideo", "premiere pro", "davinci resolve", "rolki na instagram", "kolorokorekcja", "udźwiękowienie"],
                "need": ["prawo autorskie", "księgowość", "meble na wymiar", "naprawa laptopa"],
                "bio_tmpl": "Montuję dynamiczne materiały wideo, rolki, podcasty i filmy na YT. Dodam napisy, dźwięk i efekty. Szukam pomocy z {need}."
            },
            {
                "title": "Fotograf produktowy i biznesowy",
                "can": ["fotografia produktowa", "zdjęcia biznesowe", "obróbka zdjęć", "sesje wizerunkowe", "fotografia wnętrz"],
                "need": ["marketing seo", "naprawa auta", "meble pod wymiar", "instalacja elektryczna"],
                "bio_tmpl": "Profesjonalny fotograf. Zrobię zdjęcia Twoich realizacji budowlanych, produktów lub portret do CV i na stronę. W zamian: {need}."
            },
            {
                "title": "Copywriter B2B / Pisarz ofert handlowych",
                "can": ["copywriting b2b", "pisanie ofert", "teksty na stronę", "artykuły branżowe", "scenariusze wideo"],
                "need": ["pomoc techniczna it", "fizjoterapia", "remonty", "przegląd techniczny"],
                "bio_tmpl": "Piszę konkretne teksty bez lania wody. Przygotuję ofertę handlową, która sprzedaje usługi fachowców. Potrzebuję wsparcia z {need}."
            },
            {
                "title": "Specjalista E-commerce / BaseLinker & Allegro",
                "can": ["baselinker", "sprzedaż allegro", "integracja sklepów", "shopify", "automatyzacja e-commerce"],
                "need": ["doradztwo prawne", "transport mebli", "mechanika", "malowanie natryskowe"],
                "bio_tmpl": "Specjalista od e-commerce. Wdrożę BaseLinkera, podepnę kurierów, Allegro, magazyn i przyspieszę wysyłki x3. Szukam kogoś do {need}."
            },
            {
                "title": "Przedstawiciel handlowy B2B / Negocjator",
                "can": ["negocjacje handlowe", "pozyskiwanie klientów", "sprzedaż b2b", "prospecting", "budowanie relacji"],
                "need": ["programowanie python", "podatki", "serwis samochodu", "układanie płytek"],
                "bio_tmpl": "Handlowiec B2B. Pomogę Ci wycenić Twoją pracę, dotrzeć do dużych zleceń i twardo negocjować stawki z klientami. W zamian: {need}."
            }
        ]
    },

    # 7. Zdrowie, Fizjoterapia i Sport
    {
        "category": "Zdrowie, Fizjoterapia i Sport",
        "jobs": [
            {
                "title": "Fizjoterapeuta / Terapia manualna",
                "can": ["fizjoterapia", "terapia manualna", "bóle kręgosłupa", "rehabilitacja pourazowa", "suche igłowanie", "kinezyterapia"],
                "need": ["audyt strony www", "instalacja elektryczna", "mechanik", "montaż mebli"],
                "bio_tmpl": "Fizjoterapeuta. Uwalniam od bólu pleców, karku i rwy kulszowej po ciężkiej pracy fizycznej lub siedzeniu przed kompem. Wymienię terapię za {need}."
            },
            {
                "title": "Masażysta sportowy i tkanek głębokich",
                "can": ["masaż sportowy", "masaż tkanek głębokich", "drenaż limfatyczny", "masaż relaksacyjny", "punkty spustowe"],
                "need": ["księgowość b2b", "marketing internetowy", "hydraulika", "wymiana zawieszenia"],
                "bio_tmpl": "Masażysta sportowy. Rozbijam spięte mięśnie, regeneruję ciało po zawodach i ciężkim tygodniu na budowie. Chętnie pomogę za {need}."
            },
            {
                "title": "Trener personalny / Przygotowanie siłowe",
                "can": ["trening siłowy", "trójbój siłowy", "plany treningowe", "poprawa sylwetki", "korekta postawy"],
                "need": ["montaż wideo", "doradztwo prawne", "mechanika pojazdowa", "remont kuchni"],
                "bio_tmpl": "Trener personalny. Nauczę prawidłowej techniki przysiadu, martwego ciągu, rozpiszę plan bez kontuzji. W zamian szukam fachowca od {need}."
            },
            {
                "title": "Dietetyk sportowy i kliniczny",
                "can": ["dietetyka", "plany żywieniowe", "redukcja masy ciała", "analiza badań krwi", "suplementacja"],
                "need": ["projektowanie logo", "strona www", "remont łazienki", "elektryk sep"],
                "bio_tmpl": "Dietetyk. Ułożę prostą dietę bez głodówki z tanich i dostępnych produktów pod wyniki siłowe lub zrzucenie brzucha. Szukam wsparcia: {need}."
            }
        ]
    },

    # 8. Edukacja, Języki i Doradztwo zawodowe
    {
        "category": "Edukacja i Języki",
        "jobs": [
            {
                "title": "Lektor języka angielskiego technicznego",
                "can": ["angielski techniczny", "business english", "konwersacje angielski", "przygotowanie do rozmowy o pracę"],
                "need": ["remont mieszkania", "serwis auta", "programowanie python", "hydraulik"],
                "bio_tmpl": "Lektor angielskiego. Pomogę przełamać barierę językową, przygotuję do wyjazdu za granicę lub rozmowy w zagranicznym projekcie. Wymienię lekcje za {need}."
            },
            {
                "title": "Lektor języka niemieckiego (Praca w DACH)",
                "can": ["język niemiecki", "niemiecki w budownictwie", "tłumaczenia dokumentów", "rozmowy z niemieckimi klientami"],
                "need": ["instalacje elektryczne", "doradztwo podatkowe", "mechanika bmw", "klimatyzacja"],
                "bio_tmpl": "Praktyczny niemiecki do pracy w Niemczech, Austrii i Szwajcarii. Dokumenty, zlecenia, bezpośrednia rozmowa. Szukam fachowca od {need}."
            },
            {
                "title": "Rekruter IT / Doradca CV z Pracuj.pl",
                "can": ["pisanie cv", "przygotowanie do rozmowy", "optymalizacja profilu linkedin", "doradztwo kariery", "stawki rynkowe"],
                "need": ["wykończenie mieszkania", "mechanika", "stolarz meblowy", "pompa ciepła"],
                "bio_tmpl": "Wieloletni rekruter techniczny. Przepiszę Twoje CV tak, by rekruterzy sami pisali z ofertami. Przetestujemy mock interview. W zamian: {need}."
            },
            {
                "title": "Doradca ds. Dotacji z UP i UE",
                "can": ["dotacje na rozpoczęcie działalności", "wnioski unijne", "biznesplany", "rozliczanie dotacji", "dofinansowania pfron"],
                "need": ["grafika komputerowa", "naprawa samochodu", "montaż mebli", "tworzenie www"],
                "bio_tmpl": "Pomagam zdobyć bezzwrotne dotacje z Urzędu Pracy i funduszy europejskich na start lub rozwój firmy. Chętnie napiszę wniosek w zamian za {need}."
            }
        ]
    },

    # 9. Ogród, Fotowoltaika i Ekologia
    {
        "category": "Ogród i Odnawialne Źródła Energii",
        "jobs": [
            {
                "title": "Instalator fotowoltaiki i magazynów energii",
                "can": ["fotowoltaika", "magazyny energii", "falowniki pv", "audyt energetyczny", "montaż paneli"],
                "need": ["strona internetowa", "aplikacja crm", "porada prawna", "serwis zawieszenia"],
                "bio_tmpl": "Montuję instalacje fotowoltaiczne i nowoczesne magazyny energii. Dobiorę odpowiednią moc, załatwię odbiory OSD. Szukam chłopa do {need}."
            },
            {
                "title": "Arborysta / Wycinka alpinistyczna drzew",
                "can": ["wycinka drzew", "pielęgnacja koron", "prace na wysokości", "frezowanie pni", "chirurgia drzew"],
                "need": ["serwis pilarek i sprzętu", "social media", "księgowość ryczałt", "wymiana klocków"],
                "bio_tmpl": "Arborysta ze sprzętem linowym. Bezpiecznie zetnę niebezpieczne drzewo przy budynku, prześwietlę koronę, uprzątnę teren. Wymiana za {need}."
            },
            {
                "title": "Ogrodnik / Zakładanie ogrodów i nawadnianie",
                "can": ["systemy nawadniania", "zakładanie trawników", "przycinanie żywopłotów", "pielęgnacja ogrodów", "glebogryzarka"],
                "need": ["księgowość", "mechanika maszyn", "marketing lokalny", "spawanie bramy"],
                "bio_tmpl": "Pielęgnuję ogrody, montuję automatyczne nawadnianie Rain Bird i sieję trawniki z rolki. Chętnie zajmę się Twoim ogrodem w zamian za {need}."
            }
        ]
    }
]

def generate_profiles(count: int = 1500) -> List[Dict[str, Any]]:
    default_pwd_hash = hash_password("bronet123")

    all_jobs = []
    for cat in JOB_CATEGORIES:
        for job in cat["jobs"]:
            all_jobs.append((cat["category"], job))

    random.seed(42)
    profiles: List[Dict[str, Any]] = []
    used_emails = set()

    email_domains = ["gmail.com", "wp.pl", "o2.pl", "interia.pl", "onet.pl", "bronet.pl", "gazeta.pl"]

    for i in range(count):
        cat_name, job = all_jobs[i % len(all_jobs)]
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        city = random.choice(CITIES)

        style = i % 4
        if style == 0:
            name = first_name
        elif style == 1:
            name = f"{first_name} {last_name[0]}."
        elif style == 2:
            name = f"{first_name} {last_name}"
        else:
            name = f"{first_name} ({job['title'].split('/')[0].strip()})"

        def ascii_clean(s: str) -> str:
            pl_map = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
            return s.translate(pl_map).lower().replace(" ", "").replace(".", "")

        base_email = f"{ascii_clean(first_name)}.{ascii_clean(last_name)}"
        domain = email_domains[i % len(email_domains)]
        candidate_email = f"{base_email}@{domain}"
        counter = 1
        while candidate_email in used_emails:
            counter += 1
            candidate_email = f"{base_email}{counter}@{domain}"
        used_emails.add(candidate_email)

        can_pool = job["can"].copy()
        random.shuffle(can_pool)
        can_count = random.choice([2, 3, 3, 4])
        can_help = can_pool[:min(can_count, len(can_pool))]

        need_pool = job["need"].copy()
        random.shuffle(need_pool)
        need_count = random.choice([2, 2, 3])
        need_help = need_pool[:min(need_count, len(need_pool))]

        need_str = " lub ".join(need_help[:2])
        bio = job["bio_tmpl"].format(
            need=need_str,
            city=city
        )

        phone_prefix = random.choice(["601", "502", "503", "692", "731", "515", "668", "790", "882"])
        phone_num = f"+48 {phone_prefix} {random.randint(100, 999)} {random.randint(100, 999)}"
        contact_type = i % 3
        if contact_type == 0:
            contact = candidate_email
        elif contact_type == 1:
            contact = phone_num
        else:
            contact = f"{candidate_email} | tel: {phone_num}"

        profiles.append({
            "name": name,
            "email": candidate_email,
            "password_hash": default_pwd_hash,
            "contact": contact,
            "bio": bio,
            "can_help": can_help,
            "need_help": need_help
        })

    return profiles

def main():
    profs = generate_profiles(1500)
    out_file = BASE_DIR / "app" / "seed_profiles.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(profs, f, ensure_ascii=False, indent=1)
    print(f"Pomyślnie wygenerowano {len(profs)} profili do {out_file}")

if __name__ == "__main__":
    main()
