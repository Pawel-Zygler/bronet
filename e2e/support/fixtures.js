// Wspólne fixture'y i helpery testów E2E.
//
// - createProfile: zakłada profil przez API (sprawdza odpowiedź) i usuwa go po teście,
//   nawet gdy test padnie.
// - loginViaUi / logoutViaUi: jedno miejsce na logowanie przez formularz /profil.
const base = require("@playwright/test");

const DEFAULT_PASSWORD = "haslo123";

function uniqueId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const test = base.test.extend({
  createProfile: async ({ request }, use) => {
    const created = [];

    const createProfile = async (overrides = {}) => {
      const uid = uniqueId();
      const data = {
        name: `Tester ${uid.slice(-4)}`,
        email: `e2e.${uid}@bronet.test`,
        password: DEFAULT_PASSWORD,
        ...overrides,
      };
      const res = await request.post("/api/profiles", { data });
      base.expect(res.ok(), `POST /api/profiles: ${res.status()} ${await res.text()}`).toBeTruthy();
      const profile = await res.json();
      created.push({ id: profile.id, password: data.password });
      return { ...profile, password: data.password };
    };

    await use(createProfile);

    for (const { id, password } of created.reverse()) {
      await request.delete(`/api/profiles/${id}`, { data: { password } });
    }
  },
});

async function loginViaUi(page, { email, password, name }) {
  await page.goto("/profil");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator("#login-password").press("Enter");
  if (name) {
    await base.expect(page.locator(".desktop-nav")).toContainText(`Profil (${name})`);
  }
}

async function logoutViaUi(page) {
  const logoutBtn = page.locator(".desktop-nav button", { hasText: "Wyloguj" });
  await logoutBtn.click();
  await base.expect(logoutBtn).toHaveCount(0);
}

module.exports = { test, expect: base.expect, uniqueId, loginViaUi, logoutViaUi, DEFAULT_PASSWORD };
