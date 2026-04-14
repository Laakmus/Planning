import { test, expect } from "../fixtures/pages";
import { TEST_USER } from "../helpers/test-data";

/**
 * E2E testy logowania przez username (AUTH-MIG A3).
 *
 * Uwaga: te testy wymagają projektu BEZ storageState (brak zalogowanej sesji
 * admina z global-setup). W playwright.config.ts osobny projekt "auth" z
 * `storageState: undefined` obsługuje ten przypadek.
 *
 * Uzupełnia `auth.spec.ts` o bardziej szczegółowe scenariusze nowego flow.
 */
test.describe("AUTH-MIG — logowanie username+hasło", () => {
  test("nieznany username pokazuje generyczny błąd (anti-enumeration)", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.isLoaded();

    await loginPage.login("nieistniejacy", TEST_USER.password);

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText(/Nieprawidłowy login lub hasło/i);
  });

  test("zła walidacja formatu username (za krótki) — client-side Zod", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.isLoaded();

    await loginPage.login("ab", "somepass123");

    // Walidacja przed wysłaniem — error widoczny bez network roundtrip.
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test("poprawne logowanie username 'admin' → redirect /orders", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.isLoaded();

    await loginPage.login(TEST_USER.username, TEST_USER.password);

    await loginPage.page.waitForURL("**/orders", { timeout: 30_000 });
    expect(loginPage.page.url()).toContain("/orders");
  });
});
