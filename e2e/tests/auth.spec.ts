import { test, expect } from "../fixtures/pages";
import { TEST_USER } from "../helpers/test-data";

test.describe("Autentykacja", () => {
  test("redirects to /orders after successful login", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.isLoaded();

    await loginPage.login(TEST_USER.email, TEST_USER.password);

    await loginPage.page.waitForURL("**/orders");
    expect(loginPage.page.url()).toContain("/orders");
  });

  test("shows error on wrong password", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.isLoaded();

    await loginPage.login(TEST_USER.email, "wrongpassword123");

    await expect(loginPage.errorMessage).toBeVisible();
  });

  test("redirects to / when accessing /orders without session", async ({
    browser,
  }) => {
    // Nowy kontekst BEZ storageState (brak sesji)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/orders");

    // Oczekuj redirect na strone logowania — czekaj az URL nie zawiera /orders
    await page.waitForURL(
      (url) => !url.pathname.includes("/orders"),
      { timeout: 15_000 },
    );
    expect(page.url()).not.toContain("/orders");

    await context.close();
  });
});
