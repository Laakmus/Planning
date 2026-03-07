import { test, expect } from "../fixtures/pages";
import { EXPECTED_CURRENT_COUNT } from "../helpers/test-data";

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

  test("navigates to Anulowane and shows cancelled orders", async ({
    ordersPage,
  }) => {
    await ordersPage.goto();

    await ordersPage.navigateSidebar("Anulowane");

    // Widok anulowane powinien zawierac ZT2026/0007
    const row = ordersPage.getRowByOrderNo("ZT2026/0007");
    await expect(row).toBeVisible();
  });

  test("returns to Aktualne after navigating away", async ({ ordersPage }) => {
    await ordersPage.goto();

    // Nawiguj do Zrealizowane
    await ordersPage.navigateSidebar("Zrealizowane");

    // Wroc do Aktualne
    await ordersPage.navigateSidebar("Aktualne");

    const count = await ordersPage.getOrderCount();
    expect(count).toBe(EXPECTED_CURRENT_COUNT);
  });
});
