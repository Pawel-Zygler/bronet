const { test, expect } = require("@playwright/test");

test.describe("Zakładka Profil (/profil) & Profil Chłopa (/profil/:id)", () => {
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
    "auto-zakładanie profilu przy braku konta, wyszukiwanie po e-mailu, ponowne logowanie i usunięcie profilu",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const testEmail = `e2e.${uniqueId}@bronet.test`;
      const testPw = "proste123";
      const testName = `Tester ${uniqueId.slice(-4)}`;
      let createdProfileId = null;

      try {
        await page.goto("/profil");

        // 1. Próba logowania na nieistniejący e-mail -> automatyczna propozycja założenia profilu
        await page.locator("#login-email").fill(testEmail);
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");

        await expect(page.locator(".create-prompt-banner")).toContainText(testEmail);
        await expect(page.locator("#editor-heading")).toHaveText("Załóż profil");

        // 2. Uzupełnienie imienia + umiejętności i zapis profilu
        await page.locator("#field-name").fill(testName);
        await page.locator("#field-can-help").fill("testowanie e2e");
        await page.getByRole("button", { name: "Dodaj umiejętność do Umiem" }).click();
        await expect(page.locator(".editable-chip", { hasText: "testowanie e2e" })).toBeVisible();

        const createResponsePromise = page.waitForResponse(
          (res) => res.url().endsWith("/api/profiles") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Zapisz profil" }).click();
        const createRes = await createResponsePromise;
        expect(createRes.ok()).toBeTruthy();
        const createdJson = await createRes.json();
        createdProfileId = createdJson.id;

        await expect(page.locator("#editor-feedback")).toContainText("Zapisano profil");

        // 3. Wyszukanie utworzonego profilu po adresie e-mail
        await page.locator(".desktop-nav").getByRole("link", { name: "Szukaj", exact: true }).click();
        const searchInput = page.locator("#search-input");
        await expect(searchInput).toBeVisible();
        await searchInput.fill(testEmail);
        await searchInput.press("Enter");
        await expect(page.locator(".profile-card .card-name", { hasText: testName })).toBeVisible();

        // 4. Wylogowanie i ponowne zalogowanie klawiszem Enter
        await page.locator(".desktop-nav").getByRole("button", { name: "Wyloguj" }).click();
        await page.goto("/profil");
        await expect(page.locator("#login-form")).toBeVisible();

        await page.locator("#login-email").fill(testEmail);
        await page.locator("#login-email").press("Enter");
        await expect(page.locator("#login-password")).toBeFocused();
        await page.locator("#login-password").fill(testPw);
        await page.locator("#login-password").press("Enter");

        await expect(page.locator("#editor-tab-skills")).toHaveAttribute("aria-selected", "true");

        // 5. Usunięcie własnego profilu
        await page.getByRole("button", { name: "Usuń profil" }).click();
        await page.getByRole("button", { name: "Tak, usuń profil" }).click();

        await expect(page.locator("#login-form")).toBeVisible();
        await expect(page.locator("#login-feedback")).toContainText("Profil został usunięty");
        createdProfileId = null;

        // 6. Ponowne wyszukanie usuniętego profilu — potwierdzenie braku w wyszukiwarce
        await page.locator(".desktop-nav").getByRole("link", { name: "Szukaj", exact: true }).click();
        await page.locator("#search-input").fill("");
        await page.locator("#search-input").fill(testEmail);
        await expect(page.locator(".empty-state")).toContainText(
          `Brak profili pasujących do wyszukiwania „${testEmail}”`
        );
        await expect(page.locator(".profile-card")).toHaveCount(0);
      } finally {
        if (createdProfileId) {
          await request.delete(`/api/profiles/${createdProfileId}`, {
            data: { password: testPw },
          });
        }
      }
    }
  );

  test(
    "blokuje rejestrację profilu z żeńskim imieniem (np. Basia / Kasia) — men only",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/profil");

      await page.locator("#login-email").fill("nowa.kasia@bronet.test");
      await page.locator("#login-password").fill("haslo123");
      await page.locator("#login-password").press("Enter");

      await expect(page.locator("#editor-heading")).toHaveText("Załóż profil");

      await page.locator("#field-name").fill("Basia");
      await page.locator("#field-can-help").fill("księgowość");
      await page.getByRole("button", { name: "Dodaj umiejętność do Umiem" }).click();

      await page.getByRole("button", { name: "Zapisz profil" }).click();

      await expect(page.locator("#editor-feedback")).toContainText("men only");
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
        if (await loadAllBtn.isVisible()) {
          await loadAllBtn.click();
        }
        await expect(globalLedger).toContainText(userA.name);
        await expect(globalLedger).toContainText(userB.name);
        await expect(globalLedger).toContainText("+2 🪙 CC");

        // Tablica liderów jest widoczna i zawiera ranking
        await page.locator("#tab-btn-leaderboard").click();
        const leaderboard = page.locator("#global-stats-leaderboard");
        await expect(leaderboard).toBeVisible();
        await expect(leaderboard).toContainText("Pozycja");

        // Panel silnika ekonomii (TPS, cykl 60%)
        const engineCard = page.locator("#economy-engine-panel");
        await expect(engineCard).toBeVisible();
        await expect(engineCard).toContainText("Silnik Obrotu Gospodarczego");
        await expect(engineCard).toContainText(/TPS/);
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
    "smoke: portfel coinów i dashboard chłopchain na profilu każdego użytkownika",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      // 1. Utworzenie testowego profilu z coinami
      const uniqueSuffix = Date.now().toString().slice(-4);
      const testEmail = `chlop.portfel.${uniqueSuffix}@bronet.test`;
      const res = await request.post("/api/profiles", {
        data: {
          name: `Zenek Portfelowy ${uniqueSuffix}`,
          email: testEmail,
          password: "haslo123wallet",
          can_help: ["mechanika"],
          need_help: ["spawanie"],
        },
      });
      expect(res.ok()).toBeTruthy();
      const prof = await res.json();

      try {
        // 2. Otwarcie profilu Zenka jako gość
        await page.goto(`/profil/${prof.id}`);
        await expect(page.locator("#detail-heading")).toHaveText(`Zenek Portfelowy ${uniqueSuffix}`);

        // Pigułka monet w nagłówku profilu jest widoczna
        const coinPill = page.locator("#detail-coin-pill");
        await expect(coinPill).toBeVisible();

        // Zakładka 'Portfel Coinów' jest obecna w liście zakładek profilu
        const walletTab = page.locator("#detail-tab-wallet");
        await expect(walletTab).toBeVisible();
        await expect(walletTab).toContainText("Portfel Coinów");

        // 3. Przełączenie do zakładki Portfel Coinów
        await walletTab.click();
        await expect(walletTab).toHaveAttribute("aria-selected", "true");

        // Dashboard portfela jest widoczny
        const walletPanel = page.locator("#detail-panel-wallet");
        await expect(walletPanel).toBeVisible();

        // Hero portfela z saldem
        await expect(page.locator("#detail-wallet-hero")).toBeVisible();
        await expect(page.locator("#detail-wallet-balance")).toBeVisible();

        // Metryki portfela (saldo, wykopane bloki, oczekujące)
        const metricsGrid = page.locator("#detail-wallet-metrics");
        await expect(metricsGrid).toBeVisible();
        await expect(page.locator("#detail-metric-balance")).toBeVisible();
        await expect(page.locator("#detail-metric-completed")).toBeVisible();
        await expect(page.locator("#detail-metric-pending")).toBeVisible();

        // Księga bloków na profilu chłopa
        const ledger = page.locator("#detail-blocks-ledger");
        await expect(ledger).toBeVisible();
        await expect(ledger).toContainText("Księga Rozproszona Chłopchain");

        // Link do globalnej sieci Chłopchain
        const globalLink = ledger.locator(".ledger-global-link");
        await expect(globalLink).toBeVisible();
        await globalLink.click();
        await expect(page).toHaveURL("/chlopchain");
      } finally {
        await request.delete(`/api/profiles/${prof.id}`, {
          data: { password: "haslo123wallet" },
        });
      }
    }
  );
});

