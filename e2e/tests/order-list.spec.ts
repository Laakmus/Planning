import { test, expect } from "../fixtures/pages";
import { EXPECTED_CURRENT_COUNT } from "../helpers/test-data";

test.describe("Lista zlecen", () => {
  test("displays orders from seed data", async ({ ordersPage }) => {
    await ordersPage.goto();

    const count = await ordersPage.getOrderCount();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("opens drawer on row click", async ({ ordersPage, drawerPage }) => {
    await ordersPage.goto();

    await ordersPage.clickRow("ZT2026/0001");

    await drawerPage.isOpen();
    await expect(drawerPage.drawer).toBeVisible();
  });

  test("shows expected table columns", async ({ ordersPage }) => {
    await ordersPage.goto();

    const headers = ordersPage.table.locator("thead th");
    // Sprawdz czy sa kolumny: Nr, Status, Transport
    await expect(headers.filter({ hasText: "Nr" }).first()).toBeVisible();
    await expect(headers.filter({ hasText: "Status" }).first()).toBeVisible();
    await expect(
      headers.filter({ hasText: "Rodzaj" }).first(),
    ).toBeVisible();
  });
});
