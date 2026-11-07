const { test, expect } = require("@playwright/test");

test.describe("Chłopczat & Wiadomości DM", () => {
  test(
    "smoke: global chat w lewym dolnym rogu (wysyłanie wiadomości i synchronizacja między urządzeniami)",
    { tag: ["@smoke", "@regression"] },
    async ({ browser }) => {
      // 1. Urządzenie A (np. komputer)
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto("/");

      const chatWidgetA = pageA.locator("#global-chat-widget");
      await expect(chatWidgetA).toBeVisible();

      // Upewnij się, że okno czatu jest otwarte
      if (await pageA.locator("#btn-open-global-chat").isVisible()) {
        await pageA.locator("#btn-open-global-chat").click();
      }
      const chatWindowA = pageA.locator("#chat-window-content");
      await expect(chatWindowA).toBeVisible();
      await expect(chatWindowA).toContainText("Chłopczat");

      // 2. Urządzenie B (np. telefon - emulacja mobilna)
      const contextB = await browser.newContext({
        viewport: { width: 375, height: 667 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      });
      const pageB = await contextB.newPage();
      await pageB.goto("/");

      // Na telefonie otwieramy czat
      const openBtnB = pageB.locator("#btn-open-global-chat");
      if (await openBtnB.isVisible()) {
        await openBtnB.click();
      }
      const chatWindowB = pageB.locator("#chat-window-content");
      await expect(chatWindowB).toBeVisible();

      // Telefon wpisuje nick i wysyła unikalną wiadomość
      const testMsg = `Siemanko z telefonu #${Date.now().toString().slice(-5)}`;
      await pageB.locator("#chat-custom-nick").fill("ChłopMobilny");
      await pageB.locator("#chat-message-input").fill(testMsg);
      await pageB.locator("#btn-send-chat").click();

      // Wiadomość pojawia się natychmiast na telefonie
      await expect(pageB.locator("#chat-messages-list")).toContainText(testMsg);

      // Wiadomość pojawia się na komputerze w oknie czatu (synchronizacja live)
      await expect(pageA.locator("#chat-messages-list")).toContainText(testMsg, { timeout: 10000 });
      await expect(pageA.locator("#chat-messages-list")).toContainText("ChłopMobilny");

      // Test minimalizacji i ponownego otwarcia
      await pageA.locator("#btn-close-global-chat").click();
      await expect(pageA.locator("#btn-open-global-chat")).toBeVisible();
      await pageA.locator("#btn-open-global-chat").click();
      await expect(pageA.locator("#chat-window-content")).toBeVisible();

      await contextA.close();
      await contextB.close();
    }
  );

  test(
    "smoke: responsywny czat na komputerze, autouzupełnianie @name po tapnięciu oraz wiadomości prywatne (DM) z opcjami historii",
    { tag: ["@smoke", "@regression"] },
    async ({ page, request }) => {
      // 1. Utwórz dwa profile testowe do czatu prywatnego
      const uniqueSuffix = Date.now().toString().slice(-4);
      const resA = await request.post("/api/profiles", {
        data: {
          name: `Chłop Janek ${uniqueSuffix}`,
          email: `janek.dm.${uniqueSuffix}@bronet.test`,
          password: "haslo123janek",
          location_name: "Warszawa",
        },
      });
      const profA = await resA.json();

      const resB = await request.post("/api/profiles", {
        data: {
          name: `Chłop Bogdan ${uniqueSuffix}`,
          email: `bogdan.dm.${uniqueSuffix}@bronet.test`,
          password: "haslo123bogdan",
          location_name: "Kraków",
        },
      });
      const profB = await resB.json();

      try {
        // 2. Wejdź na aplikację jako Janek na komputerze (viewport 1280x800)
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.addInitScript(
          ({ user }) => {
            localStorage.setItem("bronet_my_profile_id", String(user.id));
            localStorage.setItem("bronet_my_profile_cache", JSON.stringify(user));
            localStorage.setItem("bronet_global_chat_open", "true");
          },
          { user: profA }
        );

        await page.goto("/");

        // 3. Weryfikacja responsywności okna czatu na komputerze
        const chatWidget = page.locator("#global-chat-widget");
        await expect(chatWidget).toBeVisible();

        const chatWindow = page.locator("#chat-window-content");
        await expect(chatWindow).toBeVisible();
        const box = await chatWindow.boundingBox();
        expect(box).not.toBeNull();
        expect(box.width).toBeGreaterThanOrEqual(300);
        expect(box.height).toBeGreaterThanOrEqual(360);

        // Zakładki Chłopczat & DM są widoczne
        const tabGlobal = page.locator("#chat-tab-global");
        const tabDm = page.locator("#chat-tab-dm");
        await expect(tabGlobal).toBeVisible();
        await expect(tabGlobal).toContainText("Chłopczat");
        await expect(tabDm).toBeVisible();

        // 4. Weryfikacja: tapnięcie na imię profilu robi '@name ' w polu inputu
        const testGlobalMsg = `Wiadomość z testu @name #${uniqueSuffix}`;
        await page.locator("#chat-message-input").fill(testGlobalMsg);
        await page.locator("#btn-send-chat").click();

        // Odszukaj wysłaną wiadomość i kliknij imię autora
        const authorBtn = page.locator(`[data-mention-author="${profA.name}"]`).last();
        await expect(authorBtn).toBeVisible({ timeout: 10000 });
        await authorBtn.click();

        // Input powinien mieć wstawione @Janek
        const inputField = page.locator("#chat-message-input");
        await expect(inputField).toHaveValue(new RegExp(`@${profA.name}\\s*$`));
        await expect(inputField).toBeFocused();

        // 5. Przejście na profil Bogdana i wysłanie wiadomości prywatnej (DM)
        await page.goto(`/profil/${profB.id}`);
        const sendDmBtn = page.locator("#btn-profile-send-dm");
        await expect(sendDmBtn).toBeVisible();
        await sendDmBtn.click();

        // Okno czatu przełącza się na wątek DM z Bogdanem
        const dmThread = page.locator("#chat-dm-thread");
        await expect(dmThread).toBeVisible();
        await expect(dmThread).toContainText(profB.name);

        const dmInput = page.locator("#chat-dm-message-input");
        await expect(dmInput).toBeVisible();
        const testDmText = `Siemanko Bogdan, priv #${uniqueSuffix}`;
        await dmInput.fill(testDmText);
        await page.locator("#btn-send-dm").click();

        // Wiadomość pojawia się w wątku DM
        const dmMessages = page.locator("#chat-dm-messages-list");
        await expect(dmMessages).toContainText(testDmText, { timeout: 6000 });

        // 6. Opcje historii DM (LinkedIn / Messenger inbox) i wyszukiwarka po nazwie
        // Wróć do listy rozmów
        const backBtn = page.locator("#btn-back-to-conversations");
        await expect(backBtn).toBeVisible();
        await backBtn.click();

        // Wyszukiwarka po nazwie jest widoczna zamiast listy wyboru
        const dmSearchInput = page.locator("#chat-dm-search-input");
        await expect(dmSearchInput).toBeVisible();

        // Wyszukaj profil Bogdana po nazwie
        await dmSearchInput.fill(profB.name);
        const searchResults = page.locator("#chat-dm-search-results");
        await expect(searchResults).toBeVisible();
        await expect(searchResults).toContainText(profB.name);

        // Wyszukaj nieistniejącego chłopa
        await dmSearchInput.fill("NieznanyChlop9999");
        await expect(page.locator("#chat-dm-search-empty")).toBeVisible();
        await expect(page.locator("#chat-dm-search-empty")).toContainText("NieznanyChlop9999");

        // Wyczyść wyszukiwanie przyciskiem 'X'
        const clearSearchBtn = page.locator("#btn-clear-dm-search");
        await expect(clearSearchBtn).toBeVisible();
        await clearSearchBtn.click();
        await expect(dmSearchInput).toHaveValue("");

        // Lista konwersacji zawiera Bogdana i fragment wiadomości
        const convList = page.locator("#chat-conversations-list");
        await expect(convList).toBeVisible();
        await expect(convList).toContainText(profB.name);
        await expect(convList).toContainText(testDmText);

        // Ponowne kliknięcie na rozmowę z Bogdanem otwiera wątek
        const convItem = page.locator(`[data-partner-id="${profB.id}"]`);
        await convItem.click();
        await expect(dmThread).toBeVisible();
        await expect(dmMessages).toContainText(testDmText);

        // 7. Wyczyść historię konwersacji (opcja standardowa jak na LinkedIn / FB)
        page.on("dialog", (dialog) => dialog.accept());
        const clearBtn = page.locator("#btn-clear-dm-history");
        await expect(clearBtn).toBeVisible();
        await clearBtn.click();

        // Po wyczyszczeniu lista wiadomości w wątku jest pusta
        await expect(dmMessages).not.toContainText(testDmText);
        await expect(dmMessages).toContainText("Rozpocznij prywatną rozmowę z");
      } finally {
        await request.delete(`/api/profiles/${profA.id}`, {
          data: { password: "haslo123janek" },
        });
        await request.delete(`/api/profiles/${profB.id}`, {
          data: { password: "haslo123bogdan" },
        });
      }
    }
  );
});

