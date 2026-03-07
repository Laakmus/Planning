import { test, expect } from "../fixtures/pages";

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
  });

  test("changes status via context menu", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    // ZT2026/0001 ma status "robocze" — dozwolona tranzycja to "wyslane"
    await ordersPage.rightClickRow("ZT2026/0001");
    await contextMenu.isVisible();

    await contextMenu.openStatusSubmenu();
    await contextMenu.selectStatus("Wysłane");

    // Poczekaj na response API (zmiana statusu)
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") && resp.request().method() === "PUT",
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
  });

  test("duplicates order via context menu", async ({
    ordersPage,
    contextMenu,
  }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    await ordersPage.rightClickRow("ZT2026/0003");
    await contextMenu.isVisible();

    await contextMenu.clickItem("Skopiuj zlecenie");

    // Poczekaj na POST (duplikacja tworzy nowe zlecenie)
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "POST" &&
        resp.status() === 201,
      { timeout: 10_000 },
    );

    // Poczekaj na odswiezenie tabeli
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
});
