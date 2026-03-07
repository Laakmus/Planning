import { test, expect } from "../fixtures/pages";

test.describe.serial("Akcje na zleceniach", () => {
  test("duplicates order and shows new row", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    await ordersPage.rightClickRow("ZT2026/0009");
    await contextMenu.isVisible();
    await contextMenu.clickItem("Skopiuj zlecenie");

    // Poczekaj na POST + GET (odswiezenie listy)
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "POST" &&
        resp.status() === 201,
      { timeout: 10_000 },
    );
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 },
    );

    const newCount = await ordersPage.getOrderCount();
    expect(newCount).toBe(initialCount + 1);
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
    await confirmButton.click();

    // Poczekaj na API response
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "PUT",
      { timeout: 5_000 },
    );

    // Poczekaj na odswiezenie listy
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 },
    );

    // Zlecenie powinno zniknac z widoku Aktualne
    const newCount = await ordersPage.getOrderCount();
    expect(newCount).toBe(initialCount - 1);
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
    await contextMenu.clickItem("Przywróć do aktualnych");

    // Poczekaj na API response
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "PUT",
      { timeout: 5_000 },
    );

    // Poczekaj na odswiezenie
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 },
    );

    const newCount = await ordersPage.getOrderCount();
    expect(newCount).toBe(cancelledCount - 1);
  });

  test("auto-changes status on wyslane to korekta", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    // ZT2026/0002 ma status "wyslane" — zmien na "korekta"
    // Dozwolone tranzycje z "wyslane": korekta, zrealizowane
    await ordersPage.rightClickRow("ZT2026/0002");
    await contextMenu.isVisible();

    await contextMenu.openStatusSubmenu();
    await contextMenu.selectStatus("Korekta");

    // Poczekaj na API response
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "PUT",
      { timeout: 5_000 },
    );

    // Poczekaj na odswiezenie tabeli
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 },
    );

    // Sprawdz czy wiersz wciaz widoczny (korekta jest w Aktualne)
    const row = ordersPage.getRowByOrderNo("ZT2026/0002");
    await expect(row).toBeVisible();
  });
});
