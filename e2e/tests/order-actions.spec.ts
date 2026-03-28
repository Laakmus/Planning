import { test, expect } from "../fixtures/pages";
import { ORDERS } from "../helpers/test-data";

test.describe.serial("Akcje na zleceniach", () => {
  test("duplicates order and shows new row", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    await ordersPage.rightClickRow("ZT2026/0009");
    await contextMenu.isVisible();

    // Rejestruj listenery PRZED kliknieciem duplikacji
    const postPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "POST" &&
        resp.status() === 201,
      { timeout: 15_000 },
    );
    const getPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 15_000 },
    );

    await contextMenu.clickItem("Skopiuj zlecenie");

    // Poczekaj na POST + GET (odswiezenie listy)
    await postPromise;
    await getPromise;
    await ordersPage.waitForTableUpdate();

    // Sprawdz ze liczba wierszy wzrosla o co najmniej 1
    // (uzyj >= — inne testy w trybie parallel moga tez modyfikowac DB)
    await expect(async () => {
      const newCount = await ordersPage.getOrderCount();
      expect(newCount).toBeGreaterThanOrEqual(initialCount + 1);
    }).toPass({ timeout: 10_000 });
  });

  test("cancels order with confirmation dialog", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    // Kliknij Anuluj na zleceniu roboczym
    await ordersPage.rightClickRow("ZT2026/0008");
    await contextMenu.isVisible();
    await contextMenu.clickItem("Anuluj zlecenie");

    // AlertDialog — potwierdz anulowanie
    const confirmButton = ordersPage.page.getByRole("button", {
      name: /tak, anuluj/i,
    });
    await expect(confirmButton).toBeVisible();

    // Rejestruj listenery PRZED potwierdzeniem
    // handleCancelConfirm uzywa api.delete() (HTTP DELETE), nie PUT
    const deletePromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "DELETE",
      { timeout: 15_000 },
    );
    const getPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 15_000 },
    );

    await confirmButton.click();

    // Poczekaj na API response + odswiezenie listy
    await deletePromise;
    await getPromise;
    await ordersPage.waitForTableUpdate();

    // Sprawdz ze liczba wierszy zmalala (anulowane znika z Aktualne)
    // (uzyj <= — inne testy w trybie parallel moga tez modyfikowac DB)
    await expect(async () => {
      const newCount = await ordersPage.getOrderCount();
      expect(newCount).toBeLessThanOrEqual(initialCount - 1);
    }).toPass({ timeout: 10_000 });
  });

  test("restores order from Anulowane", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    // Nawiguj do Anulowane
    await ordersPage.navigateSidebar("Anulowane");

    const cancelledCount = await ordersPage.getOrderCount();

    // Przywroc zlecenie
    await ordersPage.rightClickRow("ZT2026/0007");
    await contextMenu.isVisible();

    // Rejestruj listenery PRZED kliknieciem przywrocenia
    // handleRestore uzywa api.post('/restore') (HTTP POST), nie PUT
    const postPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "POST",
      { timeout: 15_000 },
    );
    const getPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 15_000 },
    );

    await contextMenu.clickItem("Przywróć do aktualnych");

    // Poczekaj na API response + odswiezenie
    await postPromise;
    await getPromise;
    await ordersPage.waitForTableUpdate();

    // Auto-retry asercja na liczbe wierszy
    // Sprawdz ze liczba wierszy zmalala (przywrocone znika z Anulowane)
    await expect(async () => {
      const newCount = await ordersPage.getOrderCount();
      expect(newCount).toBeLessThanOrEqual(cancelledCount - 1);
    }).toPass({ timeout: 10_000 });
  });

  test("changes status via API and UI reflects change", async ({
    ordersPage,
  }) => {
    // Radix ContextMenuSub (submenu) nie otwiera sie niezawodnie w headless Chromium.
    // Testujemy zmiane statusu przez API + weryfikacje ze UI sie zaktualizowalo.
    await ordersPage.goto();
    const orderId = ORDERS.wyslane.id; // ZT2026/0002 (wyslane)

    // Zmien status na "reklamacja" przez API
    const apiResponse = await ordersPage.changeStatusViaApi(
      orderId, "reklamacja", "Test E2E reklamacja",
    );
    expect(apiResponse.ok()).toBeTruthy();

    // Odswiez strone — reklamacja jest w widoku Aktualne, wiersz powinien byc widoczny
    await ordersPage.goto();

    // Sprawdz czy wiersz wciaz widoczny (reklamacja jest w Aktualne)
    const row = ordersPage.getRowByOrderNo("ZT2026/0002");
    await expect(row).toBeVisible();

    // Sprawdz ze status badge pokazuje "Reklamacja"
    await expect(row.locator("text=Reklamacja")).toBeVisible();
  });
});
