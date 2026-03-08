import { test, expect } from "../fixtures/pages";

test.describe("Nawigacja sidebar", () => {
  test("navigates to Zrealizowane and shows completed orders", async ({
    ordersPage,
  }) => {
    await ordersPage.goto();

    await ordersPage.navigateSidebar("Zrealizowane");

    // Widok zrealizowane powinien zawierac ZT2026/0005
    const row = ordersPage.getRowByOrderNo("ZT2026/0005");
    await expect(row).toBeVisible();
  });

  test("navigates to Anulowane and shows cancelled view", async ({
    ordersPage,
  }) => {
    await ordersPage.goto();

    await ordersPage.navigateSidebar("Anulowane");

    // Widok Anulowane powinien sie zaladowac — tabela widoczna
    // (ilosc zlecen anulowanych moze sie zmieniac w serial testach,
    // wiec sprawdzamy ze widok sie renderuje, nie konkretne zlecenie)
    await expect(ordersPage.table).toBeVisible();
  });

  test("returns to Aktualne after navigating away", async ({ ordersPage }) => {
    await ordersPage.goto();

    // Zapamietaj poczatkowa liczbe wierszy w Aktualne
    const initialRows = ordersPage.getOrderRows();
    const initialCount = await initialRows.count();

    // Nawiguj do Zrealizowane
    await ordersPage.navigateSidebar("Zrealizowane");

    // Wroc do Aktualne
    await ordersPage.navigateSidebar("Aktualne");

    // Sprawdz ze wraca co najmniej taka sama liczba wierszy co na poczatku
    // (uzyj >= — inne testy w trybie parallel moga dodac zlecenia do DB)
    await expect(async () => {
      const currentCount = await ordersPage.getOrderCount();
      expect(currentCount).toBeGreaterThanOrEqual(initialCount);
    }).toPass({ timeout: 10_000 });
  });
});
