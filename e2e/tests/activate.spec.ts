import { test, expect } from "../fixtures/pages";

/**
 * E2E test aktywacji konta przez invite token (AUTH-MIG A3).
 *
 * Smoke — sprawdza że strona /activate renderuje się i reaguje na brak/zły token.
 * Pełen flow (create user → copy link → activate incognito → login nowym userem)
 * wymaga bardziej złożonego setup (service_role SQL cleanup) — zostaje jako TODO.
 */
test.describe("Aktywacja konta — /activate", () => {
  test("brak tokenu w URL pokazuje błąd", async ({ page }) => {
    await page.goto("/activate");

    const card = page.getByTestId("activate-card");
    await expect(card).toBeVisible();

    const status = page.getByTestId("activate-status");
    await expect(status).toBeVisible();
    await expect(status).toContainText(/token/i);
  });

  test("nieprawidłowy token — 400 z message backendu", async ({ page }) => {
    // 64-znakowy fake token (valid format, ale nie istnieje w DB)
    const fakeToken = "a".repeat(64);
    await page.goto(`/activate?token=${fakeToken}`);

    const card = page.getByTestId("activate-card");
    await expect(card).toBeVisible();

    const submit = page.getByTestId("activate-submit");
    await expect(submit).toBeVisible();
    await submit.click();

    const status = page.getByTestId("activate-status");
    await expect(status).toContainText(/nieprawidłowy|wygasł/i, { timeout: 10_000 });
  });
});
