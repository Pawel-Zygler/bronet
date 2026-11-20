const { test, expect } = require("@playwright/test");

test.describe("Zakładka Główna / Szukaj (Landing & Search)", () => {
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
    { tag: ["@smoke", "@regression"] },
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
    "przełącza widok na compact view i wyświetla zwięzłe wiersze profili z przyciskiem email",
    { tag: ["@regression"] },
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
});
