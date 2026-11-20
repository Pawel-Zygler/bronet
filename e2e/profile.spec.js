const { test, expect, uniqueId, loginViaUi, logoutViaUi } = require("./support/fixtures");
const { deleteOwnProfile } = require("./helpers");

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
          await deleteOwnProfile(request, { id: createdProfileId, email: testEmail }, testPw);
        }
      }
    }
  );

  test(
    "blokuje rejestrację profilu z żeńskim imieniem (np. Basia / Kasia) — men only",
    { tag: ["@regression"] },
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
    "coin 2/2: obaj chłopi potwierdzają pomoc na swoich profilach i dostają po Chłopocoinie",
    { tag: ["@smoke", "@regression"] },
    async ({ page, createProfile }) => {
      const uid = uniqueId();
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

      // 1. Rejestracja profili przez API (umówieni na wzajemną pomoc)
      const profA = await createProfile(userA);
      const profB = await createProfile(userB);

      // 2. Logowanie Wojtka (Chłop A)
      await loginViaUi(page, userA);

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
      await logoutViaUi(page);

      // 5. Logowanie Mirka (Chłop B)
      await loginViaUi(page, userB);

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

      // Saldo i blok po stronie Wojtka, globalna księga i ranking: tests/test_chlopchain.py
      // (konsensus 2/2) oraz ProfileDetailView.test.jsx (stany pending/ready/settled).
    }
  );

  test(
    "portfel coinów i dashboard chłopchain na profilu każdego użytkownika",
    { tag: ["@regression"] },
    async ({ page, createProfile }) => {
      // 1. Utworzenie testowego profilu z coinami
      const uniqueSuffix = Date.now().toString().slice(-4);
      const prof = await createProfile({
        name: `Zenek Portfelowy ${uniqueSuffix}`,
        can_help: ["mechanika"],
        need_help: ["spawanie"],
      });

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
    }
  );
});

