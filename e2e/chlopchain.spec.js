const { test, expect } = require("@playwright/test");

test.describe("Zakładka Chłopchain (/chlopchain) & Ekonomia", () => {
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
      await expect(enginePanel).toContainText(/TPS/);
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
      const sliderGrowth = page.locator("#slider-profiles-growth");

      await expect(sliderMin).toBeVisible();
      await expect(sliderMax).toBeVisible();
      await expect(sliderInterval).toBeVisible();
      await expect(sliderPool).toBeVisible();
      await expect(sliderGrowth).toBeVisible();

      // Wartość suwaka przyrostu profili
      await expect(page.locator("#val-profiles-growth")).toContainText("profil");

      // Przyciski akcji są widoczne
      await expect(page.locator("#btn-toggle-engine")).toBeVisible();
      await expect(page.locator("#btn-generate-profile")).toBeVisible();
      await expect(page.locator("#btn-force-tick-5")).toBeVisible();
      await expect(page.locator("#btn-force-tick-25")).toBeVisible();
      await expect(page.locator("#btn-reset-cycle")).toBeVisible();
      await expect(page.locator("#btn-default-config")).toBeVisible();

      // Test natychmiastowego wygenerowania profilu chłopa
      await page.locator("#btn-generate-profile").click();
      await expect(sidebar).toContainText("Utworzono chłopa:");

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
});

