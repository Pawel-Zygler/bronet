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
});
