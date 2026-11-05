const { test, expect } = require("@playwright/test");

test.describe("Landing page", () => {
  test("otwiera stronę główną i wyświetla nagłówek 'bronet'", async ({ page }) => {
    await page.goto("/");

    const topHeader = page.getByRole("banner");
    await expect(topHeader).toBeVisible();

    const brandHeading = topHeader.getByRole("link", { name: "bronet", exact: true });
    await expect(brandHeading).toBeVisible();
    await expect(brandHeading).toHaveText("bronet");
  });
});

