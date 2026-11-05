const { test, expect } = require("@playwright/test");

test.describe("Profile lifecycle", () => {
  test(
    "auto-zakładanie profilu przy braku konta, wyszukiwanie po e-mailu, ponowne logowanie i usunięcie profilu",
    { tag: ["@regression"] },
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
        await page.locator(".desktop-nav").getByRole("link", { name: "Szukaj chłopa" }).click();
        await page.locator("#search-input").fill(testEmail);
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
      } finally {
        if (createdProfileId) {
          await request.delete(`/api/profiles/${createdProfileId}`, {
            data: { password: testPw },
          });
        }
      }
    }
  );
});

