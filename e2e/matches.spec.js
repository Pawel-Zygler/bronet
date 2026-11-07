const { test, expect } = require("@playwright/test");

test.describe("Zakładka Dopasowania (/dopasowania)", () => {
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
});

