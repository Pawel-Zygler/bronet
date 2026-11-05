const { test, expect } = require("@playwright/test");

test.describe("Landing & Search", () => {
  test(
    "otwiera stronę główną i wyświetla nagłówek 'bronet'",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      const topHeader = page.getByRole("banner");
      await expect(topHeader).toBeVisible();

      const brandHeading = topHeader.getByRole("link", { name: "bronet", exact: true });
      await expect(brandHeading).toBeVisible();
      await expect(brandHeading).toHaveText("bronet");
    }
  );

  test(
    "wyszukuje profil po umiejętności i otwiera widok read-only",
    { tag: ["@regression"] },
    async ({ page }) => {
      await page.goto("/");

      const searchInput = page.locator("#search-input");
      await searchInput.fill("qa");

      const clearBtns = page.locator(".search-clear");
      await expect(clearBtns).toHaveCount(1);

      const firstCardLink = page.locator(".profile-card .card-name").first();
      await expect(firstCardLink).toBeVisible();
      await firstCardLink.click();

      await expect(page).toHaveURL(/\/profil\/\d+$/);
      await expect(page.getByRole("button", { name: /edytuj/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /usuń/i })).toHaveCount(0);
    }
  );

  test(
    "niezalogowany użytkownik widzi logowanie na froncie zakładki Profil",
    { tag: ["@regression"] },
    async ({ page }) => {
      await page.goto("/profil");

      await expect(page.locator("#login-form")).toBeVisible();
      await expect(page.locator("#login-email")).toBeVisible();
      await expect(page.locator("#login-password")).toBeVisible();
    }
  );

  test(
    "przełącza widok na compact view i wyświetla zwięzłe wiersze profili z przyciskiem email",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".profile-card").first()).toBeVisible();

      const compactBtn = page.locator("#compact-view-toggle");
      await expect(compactBtn).toBeVisible();

      // Przełącz na kompaktowy widok
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "true");

      const compactList = page.locator(".compact-profiles-list");
      await expect(compactList).toBeVisible();

      const firstItem = page.locator(".compact-profile-item").first();
      await expect(firstItem).toBeVisible();
      await expect(firstItem.locator(".compact-label").first()).toHaveText("pomaga z:");
      await expect(firstItem.locator(".compact-email-btn")).toBeVisible();
      await expect(firstItem.locator(".compact-profile-link")).toBeVisible();

      // Przełącz z powrotem na widok standardowy
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".compact-profiles-list")).toHaveCount(0);
    }
  );

  test(
    "potwierdza brak profili żeńskich 'kasia' i 'basia' w wyszukiwarce (men only)",
    { tag: ["@regression"] },
    async ({ page }) => {
      await page.goto("/");

      const searchInput = page.locator("#search-input");

      // Wyszukanie 'kasia'
      await searchInput.fill("kasia");
      await searchInput.press("Enter");
      await expect(page.locator(".empty-state")).toContainText(
        "Brak profili pasujących do wyszukiwania „kasia”"
      );
      await expect(page.locator(".profile-card")).toHaveCount(0);

      // Wyszukanie 'basia'
      await searchInput.fill("basia");
      await searchInput.press("Enter");
      await expect(page.locator(".empty-state")).toContainText(
        "Brak profili pasujących do wyszukiwania „basia”"
      );
      await expect(page.locator(".profile-card")).toHaveCount(0);
    }
  );

  test(
    "stronicuje listę profili (15 profili na stronę) oraz umożliwia przejście do kolejnych stron",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      // Sprawdź limit 15 profili na pierwszej stronie w widoku kart
      await expect(page.locator(".profile-card")).toHaveCount(15);

      const paginationBar = page.locator(".pagination-bar");
      await expect(paginationBar).toBeVisible();
      await expect(page.locator(".pagination-current-page")).toContainText("Strona 1 z");

      const prevBtn = page.locator("#pagination-prev");
      const nextBtn = page.locator("#pagination-next");

      await expect(prevBtn).toBeDisabled();
      await expect(nextBtn).toBeEnabled();

      // Przejście na stronę 2
      await nextBtn.click();
      await expect(page.locator(".pagination-current-page")).toContainText("Strona 2 z");
      await expect(prevBtn).toBeEnabled();
      await expect(page.locator(".profile-card")).toHaveCount(15);

      // Przejście z powrotem na stronę 1
      await prevBtn.click();
      await expect(page.locator(".pagination-current-page")).toContainText("Strona 1 z");
      await expect(prevBtn).toBeDisabled();

      // W widoku kompaktowym również obowiązuje limit 15 profili
      await page.locator("#compact-view-toggle").click();
      await expect(page.locator(".compact-profile-item")).toHaveCount(15);
      await expect(paginationBar).toBeVisible();
    }
  );

  test(
    "wyszukiwarka: testuje wpisywanie frazy, filtry zakresu (Umiem / Potrzebuję), chipy popularne oraz spójność w widoku zwykłym i kompaktowym",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      const searchInput = page.locator("#search-input");
      const filterAll = page.getByRole("button", { name: "Wszystkie", exact: true });
      const filterCan = page.getByRole("button", { name: "Umiem (kto pomoże)", exact: true });
      const filterNeed = page.getByRole("button", { name: "Potrzebuję (kto szuka)", exact: true });
      const compactBtn = page.locator("#compact-view-toggle");

      // 1. Wyszukiwanie frazy w widoku standardowym
      await searchInput.fill("hydraulik");
      await searchInput.press("Enter");
      await expect(page.locator(".active-filter-hint")).toContainText("hydraulik");
      await expect(page.locator(".profile-card").first()).toBeVisible();
      await expect(page.locator(".search-clear")).toBeVisible();

      // 2. Filtry zakresu (Umiem vs Potrzebuję)
      await filterCan.click();
      await expect(filterCan).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".active-filter-hint")).toContainText("w sekcji „Umiem”");
      await expect(page.locator(".profile-card").first()).toBeVisible();

      await filterNeed.click();
      await expect(filterNeed).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".active-filter-hint")).toContainText("w sekcji „Potrzebuję”");

      await filterAll.click();
      await expect(filterAll).toHaveAttribute("aria-pressed", "true");

      // 3. Przełączenie na widok kompaktowy z zachowaniem filtrów i wyników
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".compact-profiles-list")).toBeVisible();
      const firstCompactItem = page.locator(".compact-profile-item").first();
      await expect(firstCompactItem).toBeVisible();
      await expect(firstCompactItem.locator(".compact-profile-name")).toBeVisible();
      await expect(firstCompactItem.locator(".compact-action-btn")).toHaveCount(2); // email + profil

      // Filtr zakresu w widoku kompaktowym
      await filterCan.click();
      await expect(filterCan).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".compact-profiles-list")).toBeVisible();

      // 4. Czyszczenie wyszukiwania za pomocą przycisku ×
      await page.locator(".search-clear").click();
      await expect(searchInput).toHaveValue("");
      await expect(page.locator(".search-clear")).toHaveCount(0);

      // 5. Popularne umiejętności (chipy)
      const firstPopularChip = page.locator(".skill-filter-chip").first();
      await expect(firstPopularChip).toBeVisible();
      const chipText = (await firstPopularChip.textContent()).trim();
      await firstPopularChip.click();

      await expect(searchInput).toHaveValue(chipText);
      await expect(firstPopularChip).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".compact-profiles-list")).toBeVisible();

      // Toggle chipa z powrotem
      await firstPopularChip.click();
      await expect(searchInput).toHaveValue("");
      await expect(firstPopularChip).toHaveAttribute("aria-pressed", "false");

      // 6. Przełączenie z powrotem na widok zwykły
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".compact-profiles-list")).toHaveCount(0);
      await expect(page.locator(".profiles-list")).toBeVisible();
      await expect(page.locator(".profile-card").first()).toBeVisible();
    }
  );

  test(
    "otwiera zakładkę 'Dopasowania' (chłop help auto-matching), przełącza kategorie i tryb kompaktowy",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      // 1. Przejście do zakładki Dopasowania z menu
      await page.locator(".desktop-nav").getByRole("link", { name: "Dopasowania" }).click();
      await expect(page).toHaveURL("/dopasowania");
      await expect(page.locator("#matching-heading")).toHaveText("Chłop Help Auto-Matching");

      // 2. Weryfikacja przycisków kategorii (Wzajemna pomoc 1:1, Mogą pomóc, Możesz pomóc)
      const tabMutual = page.locator("#tab-mutual");
      const tabTheyHelp = page.locator("#tab-they-help");
      const tabIHelp = page.locator("#tab-i-help");

      await expect(tabMutual).toBeVisible();
      await expect(tabTheyHelp).toBeVisible();
      await expect(tabIHelp).toBeVisible();
      await expect(tabMutual).toHaveAttribute("aria-selected", "true");

      // 3. Sprawdzenie selektora demo profilu dla niezalogowanego użytkownika
      const demoSelect = page.locator("#demo-profile-select");
      await expect(demoSelect).toBeVisible();

      // Przełączenie kategorii na 'Mogą pomóc'
      await tabTheyHelp.click();
      await expect(tabTheyHelp).toHaveAttribute("aria-selected", "true");

      // 4. Przełączenie na widok kompaktowy
      const compactBtn = page.locator("#compact-view-toggle");
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "true");

      // Przełączenie z powrotem na standardowy
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "false");
    }
  );

  test(
    "dopasowania: weryfikuje dopasowanie 1:1 (wzajemna pomoc) oraz relację 'Możesz pomóc' po utworzeniu profili",
    {
      tag: ["@smoke", "@regression"]
    },
    async ({ page, request }) => {
      const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const skillMutualA = `spawacz_${uid}`;
      const skillMutualB = `stolarz_${uid}`;
      const skillExtraC = `pilot_${uid}`;
      const testPw = "haslo123";

      const userA = {
        name: `Marian ${uid.slice(-4)}`,
        email: `marian.${uid}@bronet.test`,
        password: testPw,
        can_help: [skillMutualA],
        need_help: [skillMutualB],
      };

      const userB = {
        name: `Bogdan ${uid.slice(-4)}`,
        email: `bogdan.${uid}@bronet.test`,
        password: testPw,
        can_help: [skillMutualB],
        need_help: [skillMutualA],
      };

      const userC = {
        name: `Cezary ${uid.slice(-4)}`,
        email: `cezary.${uid}@bronet.test`,
        password: testPw,
        can_help: [skillExtraC],
        need_help: [skillMutualA],
      };

      const createdIds = [];

      try {
        // 1. Utworzenie profili A, B i C przez API
        const resA = await request.post("/api/profiles", { data: userA });
        expect(resA.ok()).toBeTruthy();
        const jsonA = await resA.json();
        createdIds.push(jsonA.id);

        const resB = await request.post("/api/profiles", { data: userB });
        expect(resB.ok()).toBeTruthy();
        const jsonB = await resB.json();
        createdIds.push(jsonB.id);

        const resC = await request.post("/api/profiles", { data: userC });
        expect(resC.ok()).toBeTruthy();
        const jsonC = await resC.json();
        createdIds.push(jsonC.id);

        // 2. Logowanie na profil A (Marian) w interfejsie
        await page.goto("/profil");
        await page.locator("#login-email").fill(userA.email);
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");
        await expect(page.locator(".desktop-nav")).toContainText(`Profil (${userA.name})`);

        // 3. Przejście do zakładki Dopasowania
        await page.locator(".desktop-nav").getByRole("link", { name: "Dopasowania" }).click();
        await expect(page).toHaveURL("/dopasowania");
        await expect(page.locator(".matching-context-name")).toHaveText(userA.name);

        // 4. Weryfikacja sekcji 'Wzajemna pomoc 1:1' (User B pasuje 1:1, User C nie pasuje 1:1)
        const tabMutual = page.locator("#tab-mutual");
        await expect(tabMutual).toBeVisible();
        await expect(tabMutual).toHaveAttribute("aria-selected", "true");

        // Bogdan (User B) jest widoczny w dopasowaniach 1:1
        const cardB = page.locator(".match-card", { hasText: userB.name });
        await expect(cardB).toBeVisible();
        await expect(cardB.locator(".badge-mutual")).toContainText("Wzajemna pomoc 1:1");
        await expect(cardB).toContainText(skillMutualB); // On pomoże z
        await expect(cardB).toContainText(skillMutualA); // Ty zaoferujesz

        // Cezary (User C) NIE powinien być w sekcji 1:1
        await expect(page.locator(".match-card", { hasText: userC.name })).toHaveCount(0);

        // 5. Weryfikacja sekcji 'Możesz pomóc' (User C oraz User B są widoczni, bo Marian może pomóc im obu)
        const tabIHelp = page.locator("#tab-i-help");
        await tabIHelp.click();
        await expect(tabIHelp).toHaveAttribute("aria-selected", "true");

        // Cezary (User C) jest widoczny w 'Możesz pomóc'
        const cardC = page.locator(".match-card", { hasText: userC.name });
        await expect(cardC).toBeVisible();
        await expect(cardC.locator(".badge-i-help")).toContainText("Możesz mu pomóc");
        await expect(cardC).toContainText(skillMutualA); // Ty zaoferujesz

        // 6. Sprawdzenie spójności w widoku kompaktowym
        const compactBtn = page.locator("#compact-view-toggle");
        await compactBtn.click();
        await expect(compactBtn).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".matching-compact-list")).toBeVisible();

        const compactItemC = page.locator(".matching-compact-item", { hasText: userC.name });
        await expect(compactItemC).toBeVisible();
        await expect(compactItemC).toContainText("Ty pomożesz z:");
        await expect(compactItemC).toContainText(skillMutualA);

        // Przełączenie na tab 1:1 w widoku kompaktowym
        await tabMutual.click();
        const compactItemB = page.locator(".matching-compact-item", { hasText: userB.name });
        await expect(compactItemB).toBeVisible();
        await expect(compactItemB).toContainText("pomoże Ci z:");
        await expect(compactItemB).toContainText(skillMutualB);
        await expect(compactItemB).toContainText("Ty pomożesz z:");
        await expect(compactItemB).toContainText(skillMutualA);

        // Przycisk kontaktu (mailto) do Bogdana
        const emailBtnB = compactItemB.locator(".compact-email-btn");
        await expect(emailBtnB).toBeVisible();
        await expect(emailBtnB).toHaveAttribute("href", new RegExp(`mailto:${userB.email}`));
      } finally {
        for (const id of createdIds) {
          await request.delete(`/api/profiles/${id}`, {
            data: { password: testPw },
          });
        }
      }
    }
  );

  test(
    "weryfikuje responsywność na ekranie mobilnym (brak poziomego scrolla, brak compact toggle w profilu, widoczny przycisk zapisu)",
    { tag: ["@regression"] },
    async ({ page }) => {
      // Ustawienie wąskiego viewportu mobilnego (np. 360x780 typowy Android / Pixel)
      await page.setViewportSize({ width: 360, height: 780 });

      // 1. Sprawdzenie strony głównej
      await page.goto("/");
      let hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalScroll).toBeFalsy();

      // 2. Sprawdzenie zakładki Profil / Załóż profil
      await page.goto("/profil");
      await page.locator("#login-email").fill("test.nowy@bronet.test");
      await page.locator("#login-password").fill("haslo123");
      await page.locator("#login-password").press("Enter");

      await expect(page.locator("#editor-heading")).toHaveText("Załóż profil");

      // Przycisk kompaktowy nie powinien się wyświetlać w widoku edytora profilu
      await expect(page.locator("#compact-view-toggle")).toHaveCount(0);

      // Przycisk 'Zapisz' w nagłówku mobilnym jest w pełni widoczny i nie jest ucięty
      const mobileSaveBtn = page.locator(".mobile-top-save-btn");
      await expect(mobileSaveBtn).toBeVisible();

      // Brak poziomego paska przewijania (brak rozjeżdżania się)
      hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalScroll).toBeFalsy();
    }
  );

  test(
    "rozdział 1.6: otwiera mapę profili (/mapa), filtruje dopasowania 1:1, sprawdza pinezki i udostępnianie lokalizacji",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const skillA = `monter_${uid}`;
      const skillB = `tokarz_${uid}`;
      const testPw = "haslo123";

      // Chłop A: w Warszawie, umie: monter, szuka: tokarz
      const userA = {
        name: `Marek ${uid.slice(-4)}`,
        email: `marek.${uid}@bronet.test`,
        password: testPw,
        can_help: [skillA],
        need_help: [skillB],
        location_name: "Warszawa",
        lat: 52.2297,
        lng: 21.0122,
        share_location: true,
      };

      // Chłop B: w Krakowie, umie: tokarz, szuka: monter (dopasowanie 1:1!)
      const userB = {
        name: `Kazik ${uid.slice(-4)}`,
        email: `kazik.${uid}@bronet.test`,
        password: testPw,
        can_help: [skillB],
        need_help: [skillA],
        location_name: "Kraków",
        lat: 50.0647,
        lng: 19.945,
        share_location: true,
      };

      const createdIds = [];

      try {
        // 1. Utworzenie profili przez API
        const resA = await request.post("/api/profiles", { data: userA });
        expect(resA.ok()).toBeTruthy();
        createdIds.push((await resA.json()).id);

        const resB = await request.post("/api/profiles", { data: userB });
        expect(resB.ok()).toBeTruthy();
        createdIds.push((await resB.json()).id);

        // 2. Logowanie na profil Marka (User A)
        await page.goto("/profil");
        await page.locator("#login-email").fill(userA.email);
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");
        await expect(page.locator(".desktop-nav")).toContainText(`Profil (${userA.name})`);

        // Sprawdzenie edycji lokalizacji w profilu (zakładka 'Lokalizacja')
        const locTab = page.locator("#editor-tab-location");
        await expect(locTab).toBeVisible();
        await locTab.click();
        await expect(page.locator("#field-share-location")).toBeChecked();
        await expect(page.locator("#field-location-name")).toHaveValue("Warszawa");

        // 3. Przejście do nowej zakładki głównej 'Mapa'
        await page.locator(".desktop-nav").getByRole("link", { name: "Mapa" }).click();
        await expect(page).toHaveURL("/mapa");
        await expect(page.locator("#map-heading")).toHaveText("Mapa Chłopów");
        await expect(page.locator("#poland-profile-map")).toBeVisible();

        // Baner pokazuje miasto zalogowanego chłopa
        await expect(page.locator(".map-banner")).toContainText("Warszawa");
        await expect(page.locator(".map-banner")).toContainText("Udostępniona ✓");

        // Kontrolki zoomu
        await page.locator("#map-zoom-in").click();
        await page.locator("#map-zoom-reset").click();

        // 4. Filtr dopasowań 1:1 na mapie
        const mutualFilterBtn = page.locator("#map-filter-mutual");
        await expect(mutualFilterBtn).toBeVisible();
        await mutualFilterBtn.click();
        await expect(mutualFilterBtn).toHaveAttribute("aria-selected", "true");

        // Pinezka Kazika (User B) jest widoczna na mapie
        const markerB = page.locator(`[id="map-marker-${createdIds[1]}"]`);
        await expect(markerB).toBeVisible();

        // Kliknięcie pinezki otwiera kartę ze szczegółami i relacją dopasowania
        await markerB.click();
        const detailCard = page.locator(".map-detail-card");
        await expect(detailCard).toBeVisible();
        await expect(detailCard.locator(".map-card-name")).toContainText(userB.name);
        await expect(detailCard).toContainText("Kraków");
        await expect(detailCard.locator(".badge-mutual")).toContainText("Wzajemna pomoc 1:1");
        await expect(detailCard).toContainText(skillB); // Pomoże z
        await expect(detailCard).toContainText(skillA); // Ty pomożesz z
        await expect(detailCard.locator(".distance-badge")).toBeVisible(); // Odległość km

        // Przycisk emaila i powrót
        await expect(detailCard.getByRole("link", { name: "Napisz e-mail" })).toBeVisible();
        await page.locator(".map-card-close").click();
        await expect(detailCard).toHaveCount(0);
      } finally {
        for (const id of createdIds) {
          await request.delete(`/api/profiles/${id}`, {
            data: { password: testPw },
          });
        }
      }
    }
  );
});
