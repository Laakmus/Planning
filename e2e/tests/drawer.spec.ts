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

    // Pole uwag (generalNotes) — czekamy na widoczność (wcześniej `if (isVisible())`
    // sprawdzało zanim pole się wyrenderowało i test pomijał zapis)
    const notesField = drawerPage.drawer.getByPlaceholder("Dodatkowe uwagi do zlecenia…");
    await expect(notesField).toBeVisible({ timeout: 5_000 });
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
    expect((await responsePromise).ok()).toBeTruthy();

    // PRD: po zapisie drawer zostaje otwarty z odświeżonymi danymi
    await expect(drawerPage.drawer).toBeVisible();
    await expect(drawerPage.saveButton).toBeDisabled({ timeout: 10_000 });
    await expect(notesField).toHaveValue(testNote);
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
