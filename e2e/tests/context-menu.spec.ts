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

    // Rejestruj listenery PRZED kliknieciem statusu
    const putPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") && resp.request().method() === "PUT",
      { timeout: 15_000 },
    );
    const getPromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 15_000 },
    );

    await contextMenu.selectStatus("Wysłane");

    // Poczekaj na response API (zmiana statusu) + odswiezenie tabeli
    await putPromise;
    await getPromise;
    await ordersPage.waitForTableUpdate();
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

    const newCount = await ordersPage.getOrderCount();
    expect(newCount).toBe(initialCount + 1);
  });
});
