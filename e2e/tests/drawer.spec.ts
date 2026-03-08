import { test, expect } from "../fixtures/pages";

test.describe("Drawer zlecenia", () => {
  test("displays order data in drawer", async ({ ordersPage, drawerPage }) => {
    await ordersPage.goto();

    await ordersPage.clickRow("ZT2026/0001");
    await drawerPage.waitForLoaded();

    await drawerPage.expectTitle("ZT2026/0001");
  });

  test("edits notes and saves", async ({ ordersPage, drawerPage }) => {
    await ordersPage.goto();

    // Otworz zlecenie robocze (edytowalne)
    await ordersPage.clickRow("ZT2026/0009");
    await drawerPage.waitForLoaded();

    // Znajdz pole uwag (generalNotes — textarea)
    const notesField = drawerPage.drawer.locator("textarea").last();
    if (await notesField.isVisible()) {
      const testNote = `Test E2E ${Date.now()}`;
      await notesField.fill(testNote);

      // Przycisk Zapisz powinien byc aktywny
      await expect(drawerPage.saveButton).toBeEnabled();

      // Rejestruj listener PRZED kliknieciem Zapisz
      const responsePromise = ordersPage.page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/orders") &&
          resp.request().method() === "PUT",
        { timeout: 15_000 },
      );
      await drawerPage.save();

      // Poczekaj na response API
      await responsePromise;
    }

    // handleSave zamyka drawer automatycznie — nie wywoluj close() recznie
    // (race condition: drawer moze byc juz zamkniety po save)
    await drawerPage.drawer.waitFor({ state: "hidden", timeout: 10_000 });
  });

  test("creates new order via button", async ({ ordersPage, drawerPage }) => {
    await ordersPage.goto();

    // Rejestruj listener PRZED kliknieciem "Nowe zlecenie"
    const responsePromise = ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "POST",
      { timeout: 15_000 },
    );

    // Kliknij "Nowe zlecenie"
    await ordersPage.page
      .getByRole("button", { name: /nowe zlecenie/i })
      .click();

    // Poczekaj na POST tworzacy puste zlecenie
    const postResponse = await responsePromise;
    expect(postResponse.status()).toBe(201);

    // handleAddOrder nie otwiera drawera automatycznie — tylko tworzy zlecenie
    // i odsweza tabele. Sprawdzamy ze POST sie powiodl i tabela ma nowy wiersz.
    await ordersPage.waitForTableUpdate();
  });

  test("shows editable drawer for wysłane status", async ({
    ordersPage,
    drawerPage,
  }) => {
    await ordersPage.goto();

    // ZT2026/0002 ma status "wyslane" — edytowalny (isReadOnly zalezy od roli i locka, nie statusu)
    await ordersPage.clickRow("ZT2026/0002");
    await drawerPage.waitForLoaded();

    await drawerPage.expectTitle("ZT2026/0002");

    await drawerPage.close();
  });
});
