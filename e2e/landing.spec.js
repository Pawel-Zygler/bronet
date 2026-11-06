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
      await expect(page.locator(".active-filter-hint")).not.toContainText("Szukanie...", { timeout: 15000 });
      await expect(page.locator(".profile-card").first()).toBeVisible({ timeout: 15000 });
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
      test.setTimeout(60000);
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
    "zakładka Chłopchain (/chlopchain): prezentuje sieć Chłopchain, silnik 1–5 TPS, księgę bloków oraz przekierowanie z /statystyki",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      // 1. Otwarcie strony głównej i kliknięcie 'Chłopchain' w nawigacji
      await page.goto("/");
      const chlopchainLink = page.locator("#nav-link-chlopchain");
      await expect(chlopchainLink).toBeVisible();
      await expect(chlopchainLink).toHaveText("Chłopchain");
      await chlopchainLink.click();

      // 2. Weryfikacja URL i nagłówka
      await expect(page).toHaveURL("/chlopchain");
      await expect(page.locator("#stats-heading")).toContainText("Chłopchain");

      // 3. Weryfikacja integralności łańcucha i metryk sieci
      await expect(page.locator("#stats-chain-integrity")).toBeVisible();
      await expect(page.locator("#stats-chain-integrity")).toContainText("Integralność sieci potwierdzona kryptograficznie");
      await expect(page.locator("#global-stats-supply")).toBeVisible();
      await expect(page.locator("#global-stats-blocks")).toBeVisible();
      await expect(page.locator("#global-stats-helps")).toBeVisible();

      // Weryfikacja panelu silnika obrotu gospodarczego (ruch 1-5 TPS & cykl 60%)
      const enginePanel = page.locator("#economy-engine-panel");
      await expect(enginePanel).toBeVisible();
      await expect(enginePanel).toContainText("1–5 TPS");
      await expect(enginePanel).toContainText("60%");

      // 4. Weryfikacja tabeli księgi bloków
      await expect(page.locator("#global-stats-blocks-ledger")).toBeVisible();
      await expect(page.locator("#global-stats-blocks-ledger")).toContainText("Konsensus 2/2");

      // 5. Przełączenie na zakładkę 'Ranking Pomocnych Chłopów' / podgląd
      await page.locator("#tab-btn-leaderboard").click();
      await expect(page.locator("#global-stats-leaderboard")).toBeVisible();

      // 6. Przełączenie na zakładkę 'Mempool'
      await page.locator("#tab-btn-mempool").click();
      await expect(page.locator("#panel-stats-mempool")).toBeVisible();

      // 7. Przycisk 'Odśwież dane'
      const refreshBtn = page.locator("#btn-refresh-stats");
      await expect(refreshBtn).toBeVisible();
      await refreshBtn.click();

      // 8. Weryfikacja przekierowania ze starych adresów /mapa oraz /statystyki -> /chlopchain
      await page.goto("/mapa");
      await expect(page).toHaveURL("/chlopchain");
      await page.goto("/statystyki");
      await expect(page).toHaveURL("/chlopchain");
    }
  );

  test(
    "zakładka Rankingi (/rankingi): eksponuje dedykowany ranking pomocnych chłopów, medale, filtry i wyszukiwarkę",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");
      const rankingsLink = page.locator("#nav-link-rankings");
      await expect(rankingsLink).toBeVisible();
      await expect(rankingsLink).toHaveText("Rankingi");
      await rankingsLink.click();

      await expect(page).toHaveURL("/rankingi");
      await expect(page.locator("#rankings-heading")).toHaveText("Rankingi Pomocnych Chłopów");
      await expect(page.locator("#rankings-container")).toBeVisible();

      // Tabela rankingu jest widoczna i zawiera pozycje
      const leaderboard = page.locator("#global-stats-leaderboard");
      await expect(leaderboard).toBeVisible();
      await expect(leaderboard).toContainText("Pozycja");

      // Weryfikacja działania przycisku 'Zobacz profil' w rankingu
      const firstProfileBtn = leaderboard.locator("button", { hasText: "Zobacz profil" }).first();
      await expect(firstProfileBtn).toBeVisible();
      await firstProfileBtn.click();
      await expect(page).toHaveURL(/\/profil\/\d+/);
      await expect(page.locator("#detail-heading")).toBeVisible();

      // Powrót do rankingu
      await page.goto("/rankingi");
      await expect(page.locator("#rankings-container")).toBeVisible();

      // Wyszukiwarka w rankingu
      const searchInput = page.locator("#rankings-search-input");
      await expect(searchInput).toBeVisible();

      // Przycisk odświeżenia
      const refreshBtn = page.locator("#btn-refresh-rankings");
      await expect(refreshBtn).toBeVisible();
    }
  );

  test(
    "smoke: po wypełnionej usłudze obaj chłopi przyciskają 'coina' na profilu i każdy otrzymuje po chłopocoinie (+1 CC dla obu w profilu i sieci)",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      test.setTimeout(60000);
      const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const testPw = "haslo123";

      const userA = {
        name: `Wojtek ${uid.slice(-4)}`,
        email: `wojtek.${uid}@bronet.test`,
        password: testPw,
        can_help: [`spawanie_${uid}`],
        need_help: [`tokarka_${uid}`],
      };

      const userB = {
        name: `Mirek ${uid.slice(-4)}`,
        email: `mirek.${uid}@bronet.test`,
        password: testPw,
        can_help: [`tokarka_${uid}`],
        need_help: [`spawanie_${uid}`],
      };

      const createdIds = [];

      try {
        // 1. Rejestracja profili przez API (umówieni na wzajemną pomoc)
        const resA = await request.post("/api/profiles", { data: userA });
        expect(resA.ok()).toBeTruthy();
        const profA = await resA.json();
        createdIds.push(profA.id);

        const resB = await request.post("/api/profiles", { data: userB });
        expect(resB.ok()).toBeTruthy();
        const profB = await resB.json();
        createdIds.push(profB.id);

        // 2. Logowanie Wojtka (Chłop A)
        await page.goto("/profil");
        await page.locator("#login-email").fill(userA.email);
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");
        await expect(page.locator(".desktop-nav")).toContainText(`Profil (${userA.name})`);

        // 3. Wojtek odwiedza stronę profilu Mirka (Chłop B) po wykonanej usłudze
        await page.goto(`/profil/${profB.id}`);
        await expect(page.locator("#detail-heading")).toHaveText(userB.name);
        const actionBoxA = page.locator("#chlopocoin-action-box");
        await expect(actionBoxA).toBeVisible();

        // Wojtek klika przycisk 'coina' (potwierdzenie 1/2 po wykonanej usłudze)
        const coinBtnA = page.locator("#btn-grant-chlopocoin");
        await expect(coinBtnA).toBeVisible();
        await coinBtnA.click();

        // Pojawia się status oczekiwania na Mirka (1/2)
        await expect(page.locator("#chlopocoin-pending-box")).toBeVisible();
        await expect(page.locator("#chlopocoin-pending-box")).toContainText("Twoje potwierdzenie zapisane (1/2)");

        // 4. Wylogowanie Wojtka
        await page.locator(".desktop-nav button", { hasText: "Wyloguj" }).click();
        await expect(page.locator(".desktop-nav button", { hasText: "Wyloguj" })).toHaveCount(0);
        await page.goto("/profil");
        await expect(page.locator("#login-email")).toBeVisible();

        // 5. Logowanie Mirka (Chłop B)
        await page.locator("#login-email").fill(userB.email);
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");
        await expect(page.locator(".desktop-nav")).toContainText(`Profil (${userB.name})`);

        // 6. Mirek odwiedza stronę profilu Wojtka (Chłop A)
        await page.goto(`/profil/${profA.id}`);
        await expect(page.locator("#detail-heading")).toHaveText(userA.name);

        // Mirek widzi informację, że Wojtek już potwierdził pomoc
        await expect(page.locator("#chlopocoin-ready-box")).toBeVisible();
        await expect(page.locator("#chlopocoin-ready-box")).toContainText("Wojtek");

        // Mirek klika przycisk coina -> KONSENSUS 2/2 OSIĄGNIĘTY!
        const coinBtnB = page.locator("#btn-grant-chlopocoin");
        await expect(coinBtnB).toBeVisible();
        await coinBtnB.click();

        // Sukces: blok zatwierdzony w sieci Chłopchain, obaj dostali po coinie
        await expect(page.locator("#chlopocoin-settled-box")).toBeVisible();
        await expect(page.locator("#chlopocoin-settled-box")).toContainText("Chłopocoin przyznany obu profilom (2/2)");

        // 7. Weryfikacja Mirka: przechodzi do swojego profilu i otwiera zakładkę 'Statystyki'
        await page.goto("/profil");
        const statsTabB = page.locator("#editor-tab-stats");
        await expect(statsTabB).toBeVisible();
        await statsTabB.click();

        // Saldo Mirka wynosi co najmniej 1 CC (otrzymał monetę za konsensus)
        await expect(page.locator("#editor-panel-stats")).toBeVisible();
        const coinBalanceB = page.locator("#stats-coin-balance");
        await expect(coinBalanceB).toBeVisible();
        await expect(coinBalanceB).toHaveText(/^[1-9]\d*$/);

        // W księdze bloków Mirka widnieje Wojtek z nagrodą +1 CC
        const ledgerB = page.locator("#stats-blocks-ledger");
        await expect(ledgerB).toBeVisible();
        await expect(ledgerB).toContainText(userA.name);
        await expect(ledgerB).toContainText("+1 🪙 CC");

        // 8. Wylogowanie Mirka
        await page.locator(".desktop-nav button", { hasText: "Wyloguj" }).click();
        await expect(page.locator(".desktop-nav button", { hasText: "Wyloguj" })).toHaveCount(0);
        await page.goto("/profil");
        await expect(page.locator("#login-email")).toBeVisible();

        // 9. Ponowne logowanie Wojtka (Chłop A) i weryfikacja, że ON RÓWNIEŻ OTRZYMAŁ COINA
        await page.locator("#login-email").fill(userA.email);
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");
        await expect(page.locator(".desktop-nav")).toContainText(`Profil (${userA.name})`);

        // Wojtek sprawdza swoje saldo w zakładce 'Statystyki'
        await page.goto("/profil");
        const statsTabA = page.locator("#editor-tab-stats");
        await expect(statsTabA).toBeVisible();
        await statsTabA.click();

        // Saldo Wojtka również wynosi co najmniej 1 CC (każdy profil dostał po coinie!)
        const coinBalanceA = page.locator("#stats-coin-balance");
        await expect(coinBalanceA).toBeVisible();
        await expect(coinBalanceA).toHaveText(/^[1-9]\d*$/);

        // W księdze bloków Wojtka widnieje Mirek z nagrodą +1 CC
        const ledgerA = page.locator("#stats-blocks-ledger");
        await expect(ledgerA).toBeVisible();
        await expect(ledgerA).toContainText(userB.name);
        await expect(ledgerA).toContainText("+1 🪙 CC");

        // 10. Weryfikacja w zakładce 'Chłopchain' (/chlopchain)
        const chlopchainNav = page.locator("#nav-link-chlopchain");
        await expect(chlopchainNav).toBeVisible();
        await chlopchainNav.click();
        await expect(page).toHaveURL("/chlopchain");

        // Nowo wykopany blok jest w księdze globalnej
        const globalLedger = page.locator("#global-stats-blocks-ledger");
        await expect(globalLedger).toBeVisible();
        const loadAllBtn = page.locator("#btn-load-all-blocks");
        try {
          await loadAllBtn.waitFor({ state: "visible", timeout: 3000 });
          await loadAllBtn.click();
        } catch (_) {}
        await expect(globalLedger).toContainText(userA.name);
        await expect(globalLedger).toContainText(userB.name);
        await expect(globalLedger).toContainText("+2 🪙 CC");

        // Tablica liderów jest widoczna i zawiera ranking
        await page.locator("#tab-btn-leaderboard").click();
        const leaderboard = page.locator("#global-stats-leaderboard");
        await expect(leaderboard).toBeVisible();
        await expect(leaderboard).toContainText("Pozycja");

        // Panel silnika ekonomii (1–5 TPS, cykl 60%)
        const engineCard = page.locator("#economy-engine-panel");
        await expect(engineCard).toBeVisible();
        await expect(engineCard).toContainText("1–5 TPS");
        await expect(engineCard).toContainText("60%");
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
    "smoke: sidebar z suwakami kontroli ekonomii chłopchaina (zmiana TPS, tempa, cel puli, przyciski akcji)",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      // 1. Zwykły gość / użytkownik bez uprawnień -> brak sidebara ekonomii
      await page.goto("/chlopchain");
      await expect(page.locator("#global-stats-container")).toBeVisible();
      await expect(page.locator("#chlopchain-sidebar")).toHaveCount(0);
      await expect(page.locator("#guest-indicator-badge")).toBeVisible();

      // 2. Utworzenie konta administratora (pawel.zygler@gmail.com) i logowanie
      const adminEmail = "pawel.zygler@gmail.com";
      const adminPw = "admin123";
      await request.post("/api/profiles", {
        data: {
          name: "Paweł Admin",
          email: adminEmail,
          password: adminPw,
          can_help: ["programowanie"],
          need_help: ["hydraulika"],
        },
      });

      await page.goto("/profil");
      await page.locator("#login-email").fill(adminEmail);
      await page.locator("#login-password").fill(adminPw);
      await page.locator("#login-password").press("Enter");
      await expect(page.locator(".desktop-nav")).toContainText("Admin");

      // 3. Przejście do Chłopchain przez Administratora -> Sidebar jest widoczny
      await page.goto("/chlopchain");
      const sidebar = page.locator("#chlopchain-sidebar");
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toContainText("Konsola Ekonomii");
      await expect(page.locator("#admin-indicator-badge")).toBeVisible();

      // Suwaki są obecne w DOM dla admina
      const sliderMin = page.locator("#slider-min-tps");
      const sliderMax = page.locator("#slider-max-tps");
      const sliderInterval = page.locator("#slider-interval");
      const sliderPool = page.locator("#slider-pool-pct");

      await expect(sliderMin).toBeVisible();
      await expect(sliderMax).toBeVisible();
      await expect(sliderInterval).toBeVisible();
      await expect(sliderPool).toBeVisible();

      // Przyciski akcji są widoczne
      await expect(page.locator("#btn-toggle-engine")).toBeVisible();
      await expect(page.locator("#btn-force-tick-5")).toBeVisible();
      await expect(page.locator("#btn-force-tick-25")).toBeVisible();
      await expect(page.locator("#btn-reset-cycle")).toBeVisible();
      await expect(page.locator("#btn-default-config")).toBeVisible();

      // Test kliknięcia szybkiego profilu 'Turbo'
      const turboBtn = page.locator("#preset-turbo");
      await expect(turboBtn).toBeVisible();
      await turboBtn.click();

      // Odczyt suwaków po kliknięciu Turbo (5-15 TPS)
      await expect(page.locator("#val-min-tps")).toHaveText("5 tx/s");
      await expect(page.locator("#val-max-tps")).toHaveText("15 tx/s");

      // Test przycisku 'Przywróć domyślne'
      await page.locator("#btn-default-config").click();
      await expect(page.locator("#val-min-tps")).toHaveText("1 tx/s");
      await expect(page.locator("#val-max-tps")).toHaveText("5 tx/s");

      // Test ręcznego wymuszenia ticku (+5 tx)
      const initialTotal = await sidebar.locator(".telemetry-item strong").first().innerText();
      await page.locator("#btn-force-tick-5").click();
      // Po ticku silnik zaktualizował telemetrię
      await expect(sidebar.locator(".telemetry-item strong").first()).not.toHaveText(initialTotal);
    }
  );

  test(
    "smoke: global chat w lewym dolnym rogu (wysyłanie wiadomości i synchronizacja między urządzeniami)",
    { tag: ["@smoke", "@regression"] },
    async ({ browser }) => {
      // 1. Urządzenie A (np. komputer)
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto("/");

      const chatWidgetA = pageA.locator("#global-chat-widget");
      await expect(chatWidgetA).toBeVisible();

      // Upewnij się, że okno czatu jest otwarte
      if (await pageA.locator("#btn-open-global-chat").isVisible()) {
        await pageA.locator("#btn-open-global-chat").click();
      }
      const chatWindowA = pageA.locator("#chat-window-content");
      await expect(chatWindowA).toBeVisible();
      await expect(chatWindowA).toContainText("Globalny Czat");

      // 2. Urządzenie B (np. telefon - emulacja mobilna)
      const contextB = await browser.newContext({
        viewport: { width: 375, height: 667 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      });
      const pageB = await contextB.newPage();
      await pageB.goto("/");

      // Na telefonie otwieramy czat
      const openBtnB = pageB.locator("#btn-open-global-chat");
      if (await openBtnB.isVisible()) {
        await openBtnB.click();
      }
      const chatWindowB = pageB.locator("#chat-window-content");
      await expect(chatWindowB).toBeVisible();

      // Telefon wpisuje nick i wysyła unikalną wiadomość
      const testMsg = `Siemanko z telefonu #${Date.now().toString().slice(-5)}`;
      await pageB.locator("#chat-custom-nick").fill("ChłopMobilny");
      await pageB.locator("#chat-message-input").fill(testMsg);
      await pageB.locator("#btn-send-chat").click();

      // Wiadomość pojawia się natychmiast na telefonie
      await expect(pageB.locator("#chat-messages-list")).toContainText(testMsg);

      // Wiadomość pojawia się na komputerze w oknie czatu (synchronizacja live)
      await expect(pageA.locator("#chat-messages-list")).toContainText(testMsg, { timeout: 10000 });
      await expect(pageA.locator("#chat-messages-list")).toContainText("ChłopMobilny");

      // Test minimalizacji i ponownego otwarcia
      await pageA.locator("#btn-close-global-chat").click();
      await expect(pageA.locator("#btn-open-global-chat")).toBeVisible();
      await pageA.locator("#btn-open-global-chat").click();
      await expect(pageA.locator("#chat-window-content")).toBeVisible();

      await contextA.close();
      await contextB.close();
    }
  );
});
