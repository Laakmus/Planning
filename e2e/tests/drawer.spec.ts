import { test, expect } from "../fixtures/pages";

test.describe("Drawer zlecenia", () => {
  test("displays order data in drawer", async ({ ordersPage, drawerPage }) => {
    await ordersPage.goto();

    await ordersPage.clickRow("ZT2026/0001");
    await drawerPage.waitForLoaded();

    const title = await drawerPage.getTitle();
    expect(title).toContain("ZT2026/0001");
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
      await drawerPage.save();

      // Poczekaj na response API
      await ordersPage.page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/orders") &&
          resp.request().method() === "PUT",
        { timeout: 5_000 },
      );
    }

    await drawerPage.close();
  });

  test("creates new order via button", async ({ ordersPage, drawerPage }) => {
    await ordersPage.goto();

    // Kliknij "Nowe zlecenie"
    await ordersPage.page
      .getByRole("button", { name: /nowe zlecenie/i })
      .click();

    // Poczekaj na POST tworzacy puste zlecenie
    await ordersPage.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/orders") &&
        resp.request().method() === "POST",
      { timeout: 10_000 },
    );

    await drawerPage.waitForLoaded();

    const title = await drawerPage.getTitle();
    // Nowe zlecenie powinno miec tekst "Nowe zlecenie" lub wygenerowany numer
    expect(title).toBeTruthy();
  });

  test("shows readonly drawer for non-editable status", async ({
    ordersPage,
    drawerPage,
  }) => {
    await ordersPage.goto();

    // ZT2026/0002 ma status "wyslane" — readonly
    await ordersPage.clickRow("ZT2026/0002");
    await drawerPage.waitForLoaded();

    // Przycisk Zapisz nie powinien byc widoczny (isReadOnly = true)
    const saveVisible = await drawerPage.isSaveButtonVisible();
    expect(saveVisible).toBe(false);

    await drawerPage.close();
  });
});
