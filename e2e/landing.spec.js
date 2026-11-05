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

  test(
    "przełącza widok na compact view i wyświetla zwięzłe wiersze profili z przyciskiem email",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

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
    "potwierdza brak profili żeńskich 'kasia' i 'basia' w wyszukiwarce (men only)",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      const searchInput = page.locator("#search-input");

      // Wyszukanie 'kasia'
      await searchInput.fill("kasia");
      await expect(page.locator(".empty-state")).toContainText(
        "Brak profili pasujących do wyszukiwania „kasia”"
      );
      await expect(page.locator(".profile-card")).toHaveCount(0);

      // Wyszukanie 'basia'
      await searchInput.fill("basia");
      await expect(page.locator(".empty-state")).toContainText(
        "Brak profili pasujących do wyszukiwania „basia”"
      );
      await expect(page.locator(".profile-card")).toHaveCount(0);
    }
  );

  test(
    "stronicuje listę profili (15 profili na stronę) oraz umożliwia przejście do kolejnych stron",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      // Sprawdź limit 15 profili na pierwszej stronie w widoku kart
      await expect(page.locator(".profile-card")).toHaveCount(15);

      const paginationBar = page.locator(".pagination-bar");
      await expect(paginationBar).toBeVisible();
      await expect(page.locator(".pagination-current-page")).toContainText("Strona 1 z");

      const prevBtn = page.locator("#pagination-prev");
      const nextBtn = page.locator("#pagination-next");

      await expect(prevBtn).toBeDisabled();
      await expect(nextBtn).toBeEnabled();

      // Przejście na stronę 2
      await nextBtn.click();
      await expect(page.locator(".pagination-current-page")).toContainText("Strona 2 z");
      await expect(prevBtn).toBeEnabled();
      await expect(page.locator(".profile-card")).toHaveCount(15);

      // Przejście z powrotem na stronę 1
      await prevBtn.click();
      await expect(page.locator(".pagination-current-page")).toContainText("Strona 1 z");
      await expect(prevBtn).toBeDisabled();

      // W widoku kompaktowym również obowiązuje limit 15 profili
      await page.locator("#compact-view-toggle").click();
      await expect(page.locator(".compact-profile-item")).toHaveCount(15);
      await expect(paginationBar).toBeVisible();
    }
  );

  test(
    "wyszukiwarka: testuje wpisywanie frazy, filtry zakresu (Umiem / Potrzebuję), chipy popularne oraz spójność w widoku zwykłym i kompaktowym",
    { tag: ["@smoke", "@regression"] },
    async ({ page }) => {
      await page.goto("/");

      const searchInput = page.locator("#search-input");
      const filterAll = page.getByRole("button", { name: "Wszystkie", exact: true });
      const filterCan = page.getByRole("button", { name: "Umiem (kto pomoże)", exact: true });
      const filterNeed = page.getByRole("button", { name: "Potrzebuję (kto szuka)", exact: true });
      const compactBtn = page.locator("#compact-view-toggle");

      // 1. Wyszukiwanie frazy w widoku standardowym
      await searchInput.fill("hydraulik");
      await expect(page.locator(".active-filter-hint")).toContainText("hydraulik");
      await expect(page.locator(".profile-card").first()).toBeVisible();
      await expect(page.locator(".search-clear")).toBeVisible();

      // 2. Filtry zakresu (Umiem vs Potrzebuję)
      await filterCan.click();
      await expect(filterCan).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".active-filter-hint")).toContainText("w sekcji „Umiem”");
      await expect(page.locator(".profile-card").first()).toBeVisible();

      await filterNeed.click();
      await expect(filterNeed).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".active-filter-hint")).toContainText("w sekcji „Potrzebuję”");

      await filterAll.click();
      await expect(filterAll).toHaveAttribute("aria-pressed", "true");

      // 3. Przełączenie na widok kompaktowy z zachowaniem filtrów i wyników
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".compact-profiles-list")).toBeVisible();
      const firstCompactItem = page.locator(".compact-profile-item").first();
      await expect(firstCompactItem).toBeVisible();
      await expect(firstCompactItem.locator(".compact-profile-name")).toBeVisible();
      await expect(firstCompactItem.locator(".compact-action-btn")).toHaveCount(2); // email + profil

      // Filtr zakresu w widoku kompaktowym
      await filterCan.click();
      await expect(filterCan).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".compact-profiles-list")).toBeVisible();

      // 4. Czyszczenie wyszukiwania za pomocą przycisku ×
      await page.locator(".search-clear").click();
      await expect(searchInput).toHaveValue("");
      await expect(page.locator(".search-clear")).toHaveCount(0);

      // 5. Popularne umiejętności (chipy)
      const firstPopularChip = page.locator(".skill-filter-chip").first();
      await expect(firstPopularChip).toBeVisible();
      const chipText = (await firstPopularChip.textContent()).trim();
      await firstPopularChip.click();

      await expect(searchInput).toHaveValue(chipText);
      await expect(firstPopularChip).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".compact-profiles-list")).toBeVisible();

      // Toggle chipa z powrotem
      await firstPopularChip.click();
      await expect(searchInput).toHaveValue("");
      await expect(firstPopularChip).toHaveAttribute("aria-pressed", "false");

      // 6. Przełączenie z powrotem na widok zwykły
      await compactBtn.click();
      await expect(compactBtn).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".compact-profiles-list")).toHaveCount(0);
      await expect(page.locator(".profiles-list")).toBeVisible();
      await expect(page.locator(".profile-card").first()).toBeVisible();
    }
  );
});
