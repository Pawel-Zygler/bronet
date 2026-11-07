const { test, expect } = require("@playwright/test");

test.describe("Zakładka Osiągnięcia (/osiagniecia)", () => {
  test(
    "smoke: gamifikacja - sekcja osiągnięcia w nawigacji, na profilu chłopa oraz powiadomienie WoW w prawym dolnym rogu",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      // 1. Sprawdzenie linku w Topbarze i przejście do globalnej Hali Chwały & Osiągnięć
      await page.goto("/");
      const achNavLink = page.locator("#nav-link-achievements");
      await expect(achNavLink).toBeVisible();
      await expect(achNavLink).toContainText("Osiągnięcia");
      await achNavLink.click();
      await expect(page).toHaveURL("/osiagniecia");

      // 2. Weryfikacja elementów globalnej Hali Chwały
      const hero = page.locator("#achievements-hero");
      await expect(hero).toBeVisible();
      await expect(hero).toContainText("Hala Chwały & Osiągnięcia");
      await expect(page.locator("#achievements-stats-grid")).toBeVisible();

      // Ściana Sławy: Realm Firsts
      const sfWall = page.locator("#server-firsts-wall");
      await expect(sfWall).toBeVisible();
      await expect(sfWall).toContainText("Realm Firsts");
      await expect(page.locator("#sf-card-server_first_10")).toBeVisible();

      // Spotlight Billboard hot 200
      const billboard = page.locator("#billboard-spotlight");
      await expect(billboard).toBeVisible();
      await expect(billboard).toContainText("Billboard hot 200");

      // Katalog osiągnięć i wyszukiwarka
      const searchInput = page.locator("#achievements-search-input");
      await expect(searchInput).toBeVisible();
      await searchInput.fill("Pierwsza pomoc");
      const catalog = page.locator("#achievements-catalog-grid");
      await expect(catalog).toContainText("Pierwsza pomoc!");

      // 3. Sprawdzenie zakładki Osiągnięcia na profilu chłopa
      const uniqueSuffix = Date.now().toString().slice(-4);
      const res = await request.post("/api/profiles", {
        data: {
          name: `Waldek Zdobywca ${uniqueSuffix}`,
          email: `waldek.ach.${uniqueSuffix}@bronet.test`,
          password: "haslo123waldek",
          can_help: ["hydraulika", "spawanie", "mechanika"],
          need_help: ["it"],
          location_name: "Radom",
          bio: "Chłop z Radomia",
        },
      });
      const prof = await res.json();

      try {
        await page.goto(`/profil/${prof.id}`);
        // Pigułka punktów w nagłówku
        const achPill = page.locator("#detail-achievement-pill");
        await expect(achPill).toBeVisible();
        await expect(achPill).toContainText("PKT");

        // Zakładka Osiągnięcia w profilu
        const achTab = page.locator("#detail-tab-achievements");
        await expect(achTab).toBeVisible();
        await expect(achTab).toContainText("Osiągnięcia");
        await achTab.click();

        // Panel osiągnięć profilu
        const achPanel = page.locator("#detail-panel-achievements");
        await expect(achPanel).toBeVisible();
        await expect(page.locator("#detail-achievements-hero")).toBeVisible();
        await expect(page.locator("#detail-achievements-grid")).toBeVisible();

        // 4. Weryfikacja powiadomienia w stylu World of Warcraft w prawym dolnym rogu
        await page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent("bronet_achievement_unlocked", {
              detail: {
                id: "first_aid_1",
                title: "Pierwsza pomoc!",
                description: "Zdobądź swój 1. Chłopocoin (+1 CC) za bezinteresowną pomoc innemu chłopowi.",
                points: 10,
                icon: "🩹",
                rarity: "common",
                is_server_first: false,
              },
            })
          );
        });

        // Toast WoW pojawia się w prawym dolnym rogu
        const wowToast = page.locator("#wow-achievement-toast");
        await expect(wowToast).toBeVisible({ timeout: 5000 });
        await expect(wowToast).toContainText("OSIĄGNIĘCIE ZDOBYTE!");
        await expect(page.locator("#wow-toast-title")).toHaveText("Pierwsza pomoc!");
        await expect(page.locator("#wow-toast-points")).toContainText("+10");

        // Zamknięcie powiadomienia przyciskiem X
        await page.locator("#wow-toast-close").click();
        await expect(wowToast).not.toBeVisible();
      } finally {
        await request.delete(`/api/profiles/${prof.id}`, {
          data: { password: "haslo123waldek" },
        });
      }
    }
  );
});

