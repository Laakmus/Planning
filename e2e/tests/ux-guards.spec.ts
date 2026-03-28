/**
 * Testy E2E zabezpieczeń UX — pokrywają naprawione problemy interakcji.
 *
 * Testy NIE modyfikują stanu bazy danych (nie klikamy "Potwierdź" na destrukcyjnych akcjach).
 * Używamy istniejących fixtures i Page Objects.
 */

import { test, expect } from "../fixtures/pages";
import { ORDERS } from "../helpers/test-data";

test.describe("UX Guards", () => {
  // ─── 1. Drawer: dialog niezapisanych zmian (isDirty) ───

  test.describe("Drawer unsaved changes dialog", () => {
    test("shows dialog when closing drawer with unsaved changes and allows returning to editing", async ({
      ordersPage,
      drawerPage,
    }) => {
      await ordersPage.goto();

      // Otwórz zlecenie robocze (edytowalne)
      await ordersPage.clickRow(ORDERS.robocze1.orderNo);
      await drawerPage.waitForLoaded();

      // Wpisz coś w pole "Uwagi ogólne" (textarea z placeholder "Dodatkowe uwagi do zlecenia…")
      const notesTextarea = drawerPage.drawer.getByPlaceholder(
        "Dodatkowe uwagi do zlecenia…"
      );
      await expect(notesTextarea).toBeVisible({ timeout: 5_000 });
      const testNote = `E2E test ${Date.now()}`;
      await notesTextarea.fill(testNote);

      // Kliknij X (zamknij drawer) — powinien pojawić się dialog
      await drawerPage.drawer
        .locator('button[title="Zamknij (Escape)"]')
        .click();

      // Oczekiwanie: AlertDialog "Niezapisane zmiany"
      const alertDialog = ordersPage.page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });
      await expect(alertDialog).toContainText("Niezapisane zmiany");

      // Kliknij "Wróć do edycji" → drawer pozostaje otwarty
      await alertDialog.getByRole("button", { name: "Wróć do edycji" }).click();
      await expect(alertDialog).not.toBeVisible();
      await expect(drawerPage.drawer).toBeVisible();

      // Kliknij X ponownie → dialog pojawia się znowu
      await drawerPage.drawer
        .locator('button[title="Zamknij (Escape)"]')
        .click();
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });

      // Kliknij "Zamknij bez zapisywania" → drawer się zamyka
      await alertDialog
        .getByRole("button", { name: "Zamknij bez zapisywania" })
        .click();
      await drawerPage.drawer.waitFor({ state: "hidden", timeout: 10_000 });
    });
  });

  // ─── 2. Drawer Ctrl+S / Cmd+S zapis ───

  test.describe("Drawer keyboard save", () => {
    test("saves form with Ctrl+S", async ({ ordersPage, drawerPage }) => {
      await ordersPage.goto();

      // Otwórz zlecenie robocze (edytowalne)
      await ordersPage.clickRow(ORDERS.robocze3.orderNo);
      await drawerPage.waitForLoaded();

      // Wpisz coś w uwagi, żeby formularz był "dirty"
      const notesTextarea = drawerPage.drawer.getByPlaceholder(
        "Dodatkowe uwagi do zlecenia…"
      );
      await expect(notesTextarea).toBeVisible({ timeout: 5_000 });
      await notesTextarea.fill(`Ctrl+S test ${Date.now()}`);

      // Rejestruj listener na PUT PRZED naciśnięciem Ctrl+S
      const responsePromise = ordersPage.page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/orders") &&
          resp.request().method() === "PUT",
        { timeout: 15_000 }
      );

      // Naciśnij Ctrl+S (Cmd+S na macOS)
      await ordersPage.page.keyboard.press("Control+s");

      // Oczekiwanie: formularz się zapisuje (PUT response)
      const putResponse = await responsePromise;
      expect(putResponse.ok()).toBeTruthy();

      // Drawer zamyka się po udanym zapisie
      await drawerPage.drawer.waitFor({ state: "hidden", timeout: 10_000 });
    });
  });

  // ─── 3. Context menu: potwierdzenie duplikacji ───

  test.describe("Context menu duplicate confirmation", () => {
    test("shows confirmation dialog and allows cancellation", async ({
      ordersPage,
      contextMenu,
    }) => {
      await ordersPage.goto();

      // Prawy klik na zleceniu robocze
      await ordersPage.rightClickRow(ORDERS.robocze1.orderNo);
      await contextMenu.isVisible();

      // Kliknij "Skopiuj zlecenie"
      await contextMenu.clickItem("Skopiuj zlecenie");

      // Oczekiwanie: AlertDialog z numerem zlecenia
      const alertDialog = ordersPage.page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });
      await expect(alertDialog).toContainText("Skopiuj zlecenie");
      await expect(alertDialog).toContainText(ORDERS.robocze1.orderNo);

      // Kliknij "Nie" (anuluj) → dialog się zamyka, nic się nie dzieje
      await alertDialog.getByRole("button", { name: "Nie" }).click();
      await expect(alertDialog).not.toBeVisible();
    });
  });

  // ─── 4. Context menu: potwierdzenie anulowania ───

  test.describe("Context menu cancel confirmation", () => {
    test("shows confirmation dialog and allows cancellation", async ({
      ordersPage,
      contextMenu,
    }) => {
      await ordersPage.goto();

      // Prawy klik na zleceniu robocze
      await ordersPage.rightClickRow(ORDERS.robocze2.orderNo);
      await contextMenu.isVisible();

      // Kliknij "Anuluj zlecenie"
      await contextMenu.clickItem("Anuluj zlecenie");

      // Oczekiwanie: AlertDialog z numerem zlecenia
      const alertDialog = ordersPage.page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });
      await expect(alertDialog).toContainText("Anuluj zlecenie");
      await expect(alertDialog).toContainText(ORDERS.robocze2.orderNo);

      // Kliknij "Nie" (cofnij) → dialog się zamyka
      await alertDialog.getByRole("button", { name: "Nie" }).click();
      await expect(alertDialog).not.toBeVisible();
    });
  });

  // ─── 5. Loading indicator przy zmianie filtra ───

  test.describe("Loading indicator on filter change", () => {
    test("shows loading state when filtering", async ({ ordersPage }) => {
      await ordersPage.goto();

      // Wpisz tekst w search — NIE używamy ordersPage.searchByText()
      // bo ten helper czeka na response; my chcemy złapać stan pośredni (loading)
      await ordersPage.filterSearch.fill("ZT2026");

      // Oczekiwanie: tbody ma opacity < 1 LUB pojawia się komunikat "Ładowanie..."
      // OrderTable ustawia className "opacity-50" na tbody gdy isReloading=true
      await expect(async () => {
        const tbody = ordersPage.table.locator("tbody");
        const classes = await tbody.getAttribute("class");
        const hasOpacity = classes?.includes("opacity-50") ?? false;

        // Alternatywnie: sprawdź czy jest element z tekstem "Ładowanie"
        const loadingVisible = await ordersPage.page
          .getByText("Ładowanie")
          .isVisible()
          .catch(() => false);

        expect(hasOpacity || loadingVisible).toBeTruthy();
      }).toPass({ timeout: 5_000 });
    });
  });

  // ─── 6. Przycisk "Wyślij maila" w drawerze ───

  test.describe("Email button in drawer", () => {
    test("shows email button for wysłane status order", async ({
      ordersPage,
      drawerPage,
    }) => {
      await ordersPage.goto();

      // Otwórz zlecenie w statusie "wysłane" (ZT2026/0002)
      await ordersPage.clickRow(ORDERS.wyslane.orderNo);
      await drawerPage.waitForLoaded();

      // Sprawdź czy przycisk "Wyślij maila" jest widoczny w stopce drawera
      const emailButton = drawerPage.drawer.getByRole("button", {
        name: "Wyślij maila",
      });
      await expect(emailButton).toBeVisible({ timeout: 5_000 });

      // NIE klikamy — zamknij drawer
      await drawerPage.drawer
        .locator('button[title="Zamknij (Escape)"]')
        .click();
      await drawerPage.drawer.waitFor({ state: "hidden", timeout: 10_000 });
    });

    test("shows email button for korekta wysłane status order", async ({
      ordersPage,
      drawerPage,
    }) => {
      await ordersPage.goto();

      // Otwórz zlecenie w statusie "korekta wysłane" (ZT2026/0004)
      await ordersPage.clickRow(ORDERS.korektaWyslane.orderNo);
      await drawerPage.waitForLoaded();

      // Sprawdź czy przycisk "Wyślij maila" jest widoczny
      const emailButton = drawerPage.drawer.getByRole("button", {
        name: "Wyślij maila",
      });
      await expect(emailButton).toBeVisible({ timeout: 5_000 });

      // Zamknij drawer
      await drawerPage.drawer
        .locator('button[title="Zamknij (Escape)"]')
        .click();
      await drawerPage.drawer.waitFor({ state: "hidden", timeout: 10_000 });
    });
  });

  // ─── 7. Odliczanie wygaśnięcia w anulowanych zleceniach ───

  test.describe("Expiry countdown in cancelled orders", () => {
    test("shows expiry text in cancelled orders view", async ({
      ordersPage,
    }) => {
      await ordersPage.goto();

      // Nawiguj do zakładki "Anulowane"
      await ordersPage.navigateSidebar("Anulowane");

      // Sprawdź czy widok się załadował
      await expect(ordersPage.table).toBeVisible();

      // Sprawdź czy przynajmniej jeden wiersz zawiera tekst "Wygasa za" lub "Wygasło"
      // (zależy od tego jak dawno zlecenie było anulowane — seed data mogło wygasnąć)
      const rows = ordersPage.getOrderRows();
      await expect(rows.first()).toBeVisible({ timeout: 10_000 });

      // Szukamy tekstu "Wygasa za" lub "Wygasło" w dowolnym wierszu tabeli
      const expiryText = ordersPage.table.getByText(/Wygasa za|Wygasło/);
      await expect(expiryText.first()).toBeVisible({ timeout: 5_000 });
    });
  });
});
