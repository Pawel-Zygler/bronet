#!/usr/bin/env python3
"""
Generator 1500 profili IT dla platformy Bronet (software dev, testy, QA, DevOps, AI, Mobile).
Wszystkie profile spełniają rygorystyczne wymagania platformy (men-only, polskie miasta,
koordynaty do mapy, realistyczne skille i zapotrzebowania chłopa w IT).
"""

import json
import random
import sys
from pathlib import Path
from typing import List, Dict, Any

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import hash_password, PL_CITIES, validate_men_only

FIRST_NAMES = [
    "Piotr", "Tomasz", "Michał", "Krzysztof", "Paweł", "Jakub", "Mateusz", "Grzegorz",
    "Marcin", "Bartłomiej", "Wojciech", "Łukasz", "Maciej", "Dariusz", "Rafał", "Kamil",
    "Robert", "Artur", "Sebastian", "Damian", "Adrian", "Patryk", "Filip", "Szymon",
    "Dawid", "Konrad", "Hubert", "Norbert", "Igor", "Cezary", "Karol", "Radosław",
    "Przemysław", "Dominik", "Arkadiusz", "Daniel", "Marek", "Mariusz", "Jarosław",
    "Stanisław", "Andrzej", "Jan", "Adam", "Bartosz", "Bogdan", "Błażej", "Emil",
    "Gabriel", "Jacek", "Julian", "Kajetan", "Leon", "Leszek", "Maksymilian", "Marcel",
    "Mieczysław", "Mirosław", "Miłosz", "Nikodem", "Oliwier", "Roman", "Tadeusz",
    "Tymon", "Waldemar", "Wiesław", "Wiktor", "Władysław", "Zbigniew", "Zdzisław"
]

LAST_NAMES = [
    "Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski",
    "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur",
    "Wojciechowski", "Kwiatkowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski",
    "Zając", "Pawłowski", "Michalski", "Król", "Wieczorek", "Jabłoński", "Wróbel",
    "Nowakowski", "Majewski", "Olszewski", "Stępień", "Jaworski", "Malinowski", "Dudek",
    "Adamczyk", "Górski", "Nowicki", "Sikora", "Walczak", "Witkowski", "Baran",
    "Rutkowski", "Michalak", "Szewczyk", "Ostrowski", "Tomaszewski", "Pietrzak",
    "Zalewski", "Wróblewski", "Marciniak", "Jasiński", "Zawadzki", "Bąk", "Jakubowski",
    "Wilk", "Chmielewski", "Włodarczyk", "Borkowski", "Czarnecki", "Sawicki", "Sokołowski",
    "Urbański", "Kubiak", "Maciejewski", "Szczepański", "Kucharski", "Kalinowski",
    "Wysocki", "Głowacki", "Kołodziej", "Krajewski", "Sobczak", "Laskowski", "Ciesielski",
    "Sikorski", "Kołodziejczyk", "Gajewski", "Zakrzewski", "Szulc", "Baranowski", "Krupa",
    "Kozak", "Markowski", "Prus", "Brzeziński", "Błaszczyk", "Cieślak", "Kaczmarczyk"
]

IT_ROLES = [
    # 1. QA & Test Automation
    {
        "title": "QA Automation Engineer (Playwright / TS)",
        "can": ["testy automatyczne", "playwright", "typescript", "ci/cd test automation", "allure reporting", "testy e2e"],
        "need": ["mechanika samochodowa", "podatki b2b ryczałt", "remont łazienki", "trening siłowy", "fizjoterapia na kręgosłup"],
        "bio_tmpl": "QA Automation z kilkuletnim doświadczeniem w Playwright i TypeScript. Pomogę ogarnąć stabilne testy E2E, pipeline CI/CD lub zautomatyzować powtarzalne taski w przeglądarce. Chętnie wymienię się za pomoc przy {need} w okolicach {city} lub zdalnie."
    },
    {
        "title": "QA Engineer (Python / Pytest & API)",
        "can": ["pytest", "python", "testy api", "postman", "docker", "testy integracyjne", "mockowanie serwisów"],
        "need": ["wymiana opon i geometria", "doradztwo kredytowe", "układanie paneli", "elektryk sep"],
        "bio_tmpl": "Automatyzuję testy backendu i API w Pythonie (pytest, requests, tox). Przygotuję zestaw testów regresyjnych lub zintegruję z GitHub Actions. W zamian przyda mi się chłop znający się na {need}."
    },
    {
        "title": "Performance QA (k6 / JMeter)",
        "can": ["k6", "jmeter", "testy wydajnościowe", "grafana", "prometheus", "analiza wąskich gardeł"],
        "need": ["klimatyzacja domowa", "stolarstwo meblowe", "hydraulik", "wymiana rozrządu"],
        "bio_tmpl": "Specjalizuję się w testach obciążeniowych (load & stress testing) w k6 i JMeterze. Wykrywam bottlenecki przed wejściem na produkcję. Potrzebuję fachowca do {need}."
    },
    {
        "title": "Manual QA & Test Lead",
        "can": ["testy manualne", "jira", "test plan", "scenariusze testowe", "istqb", "testy regresji"],
        "need": ["mechanika pojazdowa", "wykończenie wnętrz", "spawanie tig", "trener personalny"],
        "bio_tmpl": "Doświadczony tester manualny i QA Lead. Przekopię aplikację pod kątem edge case'ów, przygotuję dokumentację testową i zgłoszę czytelne bugi. Szukam pomocy z {need}."
    },
    {
        "title": "Cypress QA Specialist",
        "can": ["cypress", "javascript", "testy frontendu", "mock service worker", "testy e2e"],
        "need": ["blacharstwo i lakiernictwo", "remont dachu", "podatki b2b", "fizjoterapia"],
        "bio_tmpl": "Frontend QA. Piszę i utrzymuję testy w Cypressie, integruję z Bitbucket Pipelines i GitLab CI. Z chęcią dogadam się z kimś od {need}."
    },
    {
        "title": "Security QA / Pentester Web",
        "can": ["pentesty aplikacji webowych", "owasp top 10", "burp suite", "audyt bezpieczeństwa", "wireshark"],
        "need": ["mechanika motocyklowa", "instalacja elektryczna w garażu", "układanie płytek"],
        "bio_tmpl": "Sprawdzam bezpieczeństwo aplikacji webowych, szukam podatności (XSS, SQLi, CSRF, IDOR). Mogę zrobić pentest Twojego serwisu. W zamian szukam wsparcia przy {need}."
    },

    # 2. Backend Development
    {
        "title": "Senior Python Developer (FastAPI / Django)",
        "can": ["python", "fastapi", "django", "postgresql", "celery", "redis", "rest api"],
        "need": ["mechanik samochodowy", "prawo umów b2b", "wymiana oleju w skrzyni", "stolarz"],
        "bio_tmpl": "Senior Python Backendowiec. Projektuję skalowalne API, asynchroniczne kolejki w Celery i czystą architekturę. Szukam chłopa, który pomoże z {need}."
    },
    {
        "title": "Java & Spring Boot Engineer",
        "can": ["java", "spring boot", "mikroserwisy", "apache kafka", "hibernate", "postgresql"],
        "need": ["fizjoterapia na kręgosłup", "remont kuchni", "hydraulik", "trening trójboju"],
        "bio_tmpl": "Enterprise Java developer (Spring Boot, Kafka, architektura heksagonalna). Zoptymalizuję zapytania JPA lub pomogę przy refaktorze monolitu. Potrzebuję pomocy przy {need}."
    },
    {
        "title": "Go / Golang Backend Dev",
        "can": ["golang", "microservices", "grpc", "docker", "kubernetes", "systemy rozproszone"],
        "need": ["ustawianie zbieżności kół", "trener personalny", "doradztwo podatkowe", "montaż rolet"],
        "bio_tmpl": "Piszę w Go wydajne mikrousługi i serwisy gRPC o niskich opóźnieniach. Chętnie wymienię się wiedzą lub pomogę w kodzie w zamian za wsparcie z {need}."
    },
    {
        "title": "Rust Systems Programmer",
        "can": ["rust", "tokio", "actix-web", "webassembly", "programowanie niskopoziomowe", "optymalizacja wydajności"],
        "need": ["spawanie mig/mag", "naprawa skrzyni biegów", "odnawianie drewna", "mechanika 4x4"],
        "bio_tmpl": "Entuzjasta i zawodowy programista Rusta. Bezpieczeństwo pamięci i maksymalna wydajność to mój chleb powszedni. Szukam fachowca od {need}."
    },
    {
        "title": ".NET / C# Backend Developer",
        "can": ["c#", ".net core", "asp.net core", "entity framework", "azure", "sql server"],
        "need": ["montaż fotowoltaiki", "wymiana sprzęgła", "tynkowanie", "fizjoterapia"],
        "bio_tmpl": "Full-time .NET Core developer. Buduję systemy w Clean Architecture i chmurze Azure. Przyda mi się pomocna dłoń przy {need}."
    },
    {
        "title": "Node.js & NestJS Developer",
        "can": ["node.js", "nest.js", "typescript", "prisma", "graphql", "redis", "websockets"],
        "need": ["naprawa zawieszenia", "rehabilitacja barku", "montaż klimatyzacji split", "stolarz"],
        "bio_tmpl": "Backend Node/NestJS z TypeScriptem. Buduję real-time aplikacje, integracje z zewnętrznymi API i mikrousługi. Chętnie dogadam się w temacie {need}."
    },
    {
        "title": "C++ / Embedded Developer",
        "can": ["c++", "embedded c", "rtos", "stm32", "linux kernel", "protokoły przemysłowe"],
        "need": ["mechanika klasyków", "ogrzewanie podłogowe", "blacharstwo", "doradztwo podatkowe"],
        "bio_tmpl": "Programuję mikrokontrolery i systemy czasu rzeczywistego (RTOS, STM32, C++20). Pomogę przy elektronice lub firmware. Szukam wsparcia w {need}."
    },
    {
        "title": "PHP / Symfony / Laravel Dev",
        "can": ["php", "laravel", "symfony", "mysql", "redis", "docker", "architektura mvc"],
        "need": ["doradztwo ryczałt 12%", "wymiana klocków i tarcz", "hydraulika domowa", "remont"],
        "bio_tmpl": "Doświadczony dev PHP (nowoczesny Laravel/Symfony). Pomogę postawić aplikację, sklep e-commerce lub API. W zamian przyda mi się fachowiec do {need}."
    },

    # 3. Frontend Development
    {
        "title": "React & Next.js Senior Developer",
        "can": ["react", "next.js", "typescript", "tailwind css", "zustand", "tanstack query"],
        "need": ["ergonomia biurka i fotela", "doradztwo leasingowe", "mechanik diesel", "trening siłowy"],
        "bio_tmpl": "Senior React/Next.js z naciskiem na SSR, responsywność i czysty kod. Pomogę przy Twoim frontendzie lub design systemie. Szukam chłopa do {need}."
    },
    {
        "title": "Vue.js & Nuxt Specialist",
        "can": ["vue 3", "nuxt", "pinia", "typescript", "vite", "tailwind css"],
        "need": ["malowanie natryskowe", "wymiana amortyzatorów", "dietetyka sportowa", "elektryk"],
        "bio_tmpl": "Tworzę szybkie i estetyczne interfejsy w ekosystemie Vue 3 i Nuxt. Chętnie pomogę przy projekcie webowym. Szukam kogoś do {need}."
    },
    {
        "title": "Angular & Enterprise Frontend Dev",
        "can": ["angular", "rxjs", "ngrx", "typescript", "design systems", "testy jednostkowe jest"],
        "need": ["montaż mebli kuchennych", "naprawa klimatyzacji", "fizjoterapia kręgosłupa", "hydraulik"],
        "bio_tmpl": "Frontender pracujący w dużych projektach enterprise (Angular, RxJS, NgRx). Zorganizuję modularny kod i reaktywne przepływy danych. Szukam wsparcia przy {need}."
    },
    {
        "title": "Web Performance & Core Web Vitals Expert",
        "can": ["optymalizacja lcp", "core web vitals", "web performance", "seo techniczne", "lighthouse"],
        "need": ["mechanika samochodowa", "podatki spółka z o.o.", "remont mieszkania", "stolarz"],
        "bio_tmpl": "Przyspieszam wolne strony WWW i optymalizuję metryki LCP, CLS, INP pod kątem Google CWV. Pomogę Twojemu serwisowi ładować się błyskawicznie. Szukam chłopa do {need}."
    },

    # 4. DevOps, Cloud & SRE
    {
        "title": "Cloud Architect (AWS / Kubernetes)",
        "can": ["kubernetes", "terraform", "aws", "helm", "gitops", "architektura chmurowa"],
        "need": ["instalacja elektryczna", "wymiana oleju w skrzyni automatycznej", "stolarstwo", "klimatyzacja"],
        "bio_tmpl": "Projektuję i wdrażam architekturę chmurową w AWS i Kubernetesie. Infrastruktura jako kod (IaC), GitOps, wysoka dostępność (HA). Potrzebuję wsparcia przy {need}."
    },
    {
        "title": "DevOps Engineer (CI/CD & Docker)",
        "can": ["github actions", "gitlab ci", "docker", "bash", "ansible", "linux administration"],
        "need": ["trener personalny", "montaż pieca gazowego", "podatki b2b", "blacharstwo"],
        "bio_tmpl": "Automatyzuję wdrażanie aplikacji: konteneryzacja, pipeline CI/CD, deploymenty zero-downtime. Z chęcią dogadam się z kimś ogarniającym {need}."
    },
    {
        "title": "Linux Sysadmin & High-Availability SRE",
        "can": ["administracja linux", "proxmox", "zfs", "haproxy", "wireguard vpn", "monitoring grafana"],
        "need": ["spawanie wydechów", "układanie płytek w garażu", "rehabilitacja kolana", "mechanik"],
        "bio_tmpl": "Sysadmin starej daty i współczesny SRE. Utrzymuję klastry Linuxa, sieci i wirtualizację Proxmox. Potrzebuję rąk do pomocy przy {need}."
    },
    {
        "title": "DevSecOps & Cloud Security Specialist",
        "can": ["devsecops", "bezpieczeństwo chmury", "vault", "trivy", "aws iam", "audyty bezpieczeństwa"],
        "need": ["mechanik motocyklowy", "prawo podatkowe", "blacharka samochodowa", "fizjoterapeuta"],
        "bio_tmpl": "Łączę DevOps z bezpieczeństwem. Wdrażam skanowanie kontenerów, zarządzanie sekretami i polisy IAM. Szukam fachowca od {need}."
    },

    # 5. Mobile Development
    {
        "title": "Android Developer (Kotlin / Compose)",
        "can": ["android", "kotlin", "jetpack compose", "coroutines", "clean architecture", "google play"],
        "need": ["wymiana turbosprężarki", "doradztwo w zakupie mieszkania", "trening siłowy", "hydraulik"],
        "bio_tmpl": "Tworzę nowoczesne aplikacje na Androida w Kotlinie z Jetpack Compose. Pomogę opublikować apkę lub poprawić architekturę. Szukam pomocy przy {need}."
    },
    {
        "title": "iOS Developer (Swift / SwiftUI)",
        "can": ["ios", "swift", "swiftui", "combine", "core data", "app store distribution"],
        "need": ["auto detailing i lakier", "montaż rolet i moskitier", "fizjoterapia kręgosłupa", "elektryk"],
        "bio_tmpl": "Natywny iOS dev (Swift, SwiftUI). Zbuduję aplikację na iPhone'a lub pomogę przejść review Apple App Store. Chętnie wymienię się za {need}."
    },
    {
        "title": "Flutter Cross-Platform Developer",
        "can": ["flutter", "dart", "bloc", "firebase", "architektura mobilna", "aplikacje wieloplatformowe"],
        "need": ["wymiana opon z wyważeniem", "ogrzewanie domu", "masaż głęboki", "stolarz"],
        "bio_tmpl": "Programista Fluttera — jeden kod na Androida i iOS. Pomogę postawić aplikację od zera z backendem w Firebase/Supabase. Szukam kogoś do {need}."
    },

    # 6. Data & Machine Learning / AI
    {
        "title": "Data Engineer (Spark / Airflow / SQL)",
        "can": ["apache spark", "airflow", "sql", "python", "snowflake", "dbt", "etl pipelines"],
        "need": ["doradztwo finansowe", "mechanika audi/vw", "układanie paneli podłogowych", "trening"],
        "bio_tmpl": "Buduję potoki danych (ETL/ELT) w Airflow, Sparku i Snowflake. Optymalizuję zapytania SQL na dużych zbiorach danych. Chętnie wymienię się za pomoc przy {need}."
    },
    {
        "title": "Machine Learning & MLOps Engineer",
        "can": ["machine learning", "pytorch", "mlops", "python", "docker", "gpu inference"],
        "need": ["trening na siłowni", "remont łazienki", "geometria zawieszenia", "podatki b2b"],
        "bio_tmpl": "Trenuję i wdrażam modele uczenia maszynowego (PyTorch, HuggingFace). Zbuduję pipeline MLOps lub endpoint inferencyjny. Potrzebuję wsparcia przy {need}."
    },
    {
        "title": "AI & LLM Application Engineer",
        "can": ["llm", "langchain", "rag", "wektoryzacja danych", "fastapi", "python"],
        "need": ["prawo autorskie i umowy it", "naprawa klimatyzacji", "stolarstwo na wymiar", "mechanik"],
        "bio_tmpl": "Integruję modele językowe (LLM, RAG, wektorowe bazy danych) z aplikacjami biznesowymi. W zamian przyda mi się chłop od {need}."
    },

    # 7. Database Administration & IT Infrastructure
    {
        "title": "Database Administrator (PostgreSQL DBA)",
        "can": ["postgresql", "optymalizacja zapytań sql", "replikacja baz danych", "pgbouncer", "strojenie wydajności"],
        "need": ["regeneracja wtryskiwaczy", "układanie kostki brukowej", "podatki dla programistów", "hydraulik"],
        "bio_tmpl": "DBA z wieloletnim doświadczeniem w PostgreSQL. Rozwiązuję problemy z blokadami, replikacją i wolnymi zapytaniami. Szukam pomocy z {need}."
    },
    {
        "title": "IT Systems & Hardware Administrator",
        "can": ["administracja sieciami", "mikrotik", "cisco", "składanie komputerów", "backup i nas", "wsparcie it"],
        "need": ["naprawa blacharska", "remont poddasza", "wymiana rozrządu", "trener personalny"],
        "bio_tmpl": "Ogarniam sieci biurowe, sprzęt serwerowy, storage NAS i konfigurację firewalli (MikroTik/OPNsense). Szukam chłopa do {need}."
    }
]

def ascii_clean(s: str) -> str:
    pl_map = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
    return s.translate(pl_map).lower().replace(" ", "").replace(".", "")

def generate_it_profiles(count: int = 1500, existing_emails: set = None) -> List[Dict[str, Any]]:
    if existing_emails is None:
        existing_emails = set()

    used_emails = set(existing_emails)
    default_pwd_hash = hash_password("bronet")
    domains = ["dev.bronet.pl", "it.bronet.pl", "tech.bronet.pl", "qa.bronet.pl", "ops.bronet.pl"]

    profiles: List[Dict[str, Any]] = []

    for i in range(count):
        role = IT_ROLES[i % len(IT_ROLES)]
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        city_name, lat, lng = PL_CITIES[i % len(PL_CITIES)]

        # Różne warianty wyświetlania imienia
        style = i % 4
        if style == 0:
            name = f"{first_name} {last_name}"
        elif style == 1:
            name = f"{first_name} {last_name[0]}."
        elif style == 2:
            role_short = role["title"].split("(")[0].strip()
            name = f"{first_name} ({role_short})"
        else:
            name = f"{first_name} {last_name}"

        # Walidacja men-only
        validate_men_only(name)

        base_email = f"{ascii_clean(first_name)}.{ascii_clean(last_name)}"
        domain = domains[i % len(domains)]
        candidate_email = f"{base_email}@{domain}"
        counter = 1
        while candidate_email in used_emails:
            counter += 1
            candidate_email = f"{base_email}{counter}@{domain}"
        used_emails.add(candidate_email)
        validate_men_only(name, candidate_email)

        # Skille
        can_pool = role["can"].copy()
        random.shuffle(can_pool)
        can_help = can_pool[:max(2, min(4, len(can_pool)))]

        need_pool = role["need"].copy()
        random.shuffle(need_pool)
        need_help = need_pool[:max(2, min(3, len(need_pool)))]

        need_str = " lub ".join(need_help[:2])
        bio = role["bio_tmpl"].format(need=need_str, city=city_name)

        phone_prefix = random.choice(["501", "502", "503", "601", "602", "692", "731", "515", "668", "790", "882", "530"])
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
            "location_name": city_name,
            "lat": lat,
            "lng": lng,
            "share_location": 1,
            "can_help": can_help,
            "need_help": need_help
        })

    return profiles

def main():
    # Pobierz istniejące e-maile z bazy lub seed_profiles.json
    existing_emails = set()
    seed_file = BASE_DIR / "app" / "seed_profiles.json"
    if seed_file.exists():
        with open(seed_file, "r", encoding="utf-8") as f:
            for p in json.load(f):
                em = p.get("email")
                if em:
                    existing_emails.add(em.strip().lower())

    profiles = generate_it_profiles(1500, existing_emails)
    out_file = BASE_DIR / "app" / "seed_it_profiles.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(profiles, f, ensure_ascii=False, indent=1)

    print(f"Pomyślnie wygenerowano {len(profiles)} profili IT do {out_file}")

if __name__ == "__main__":
    main()
