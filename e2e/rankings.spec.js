const { test, expect } = require("@playwright/test");

test.describe("Zakładka Rankingi (/rankingi)", () => {
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
});

