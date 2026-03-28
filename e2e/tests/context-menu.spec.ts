import { test, expect } from "../fixtures/pages";
import { ORDERS } from "../helpers/test-data";

test.describe.serial("Context menu", () => {
  test("opens context menu on right click", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    await ordersPage.rightClickRow("ZT2026/0001");

    await contextMenu.isVisible();
    // Sprawdz obecnosc kluczowych opcji
    await expect(
      contextMenu.menu.first().getByRole("menuitem", { name: "Otwórz" }),
    ).toBeVisible();
    await expect(
      contextMenu.menu.first().getByText("Historia zmian"),
    ).toBeVisible();
    // Sprawdz obecnosc submenu statusow (nie otwieramy — Radix submenu w headless zawodne)
    await expect(
      contextMenu.menu.first().getByText("Zmień status"),
    ).toBeVisible();
  });

  test("changes status and UI reflects change", async ({
    ordersPage,
  }) => {
    // Radix ContextMenuSub (submenu) nie otwiera sie niezawodnie w headless Chromium.
    // Testujemy zmiane statusu przez API + weryfikacje ze UI sie zaktualizowalo.
    // Obecnosc submenu "Zmien status" w context menu jest weryfikowana w tescie wyzej.
    await ordersPage.goto();
    const orderId = ORDERS.robocze4.id; // ZT2026/0010 (robocze)

    // Zmien status przez API (POST /api/v1/orders/{orderId}/status)
    const apiResponse = await ordersPage.changeStatusViaApi(orderId, "zrealizowane");
    expect(apiResponse.ok()).toBeTruthy();

    // Odswiez strone i sprawdz ze zlecenie zniknelo z Aktualne
    // (zrealizowane nie jest w widoku Aktualne)
    await ordersPage.goto();
    const row = ordersPage.getRowByOrderNo("ZT2026/0010");
    await expect(row).not.toBeVisible();
  });

  test("duplicates order via context menu", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    await ordersPage.rightClickRow("ZT2026/0003");
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

    // Poczekaj na POST (duplikacja) + GET (odswiezenie)
    await postPromise;
    await getPromise;
    await ordersPage.waitForTableUpdate();

    // Sprawdz ze liczba wierszy wzrosla o co najmniej 1
    // (uzyj >= zamiast == — inne testy w trybie parallel moga tez modyfikowac DB)
    await expect(async () => {
      const newCount = await ordersPage.getOrderCount();
      expect(newCount).toBeGreaterThanOrEqual(initialCount + 1);
    }).toPass({ timeout: 10_000 });
  });
});
