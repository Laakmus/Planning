import { test, expect } from "../fixtures/pages";
import { EXPECTED_CURRENT_COUNT } from "../helpers/test-data";

test.describe("Filtry", () => {
  test("filters by transport type", async ({ ordersPage }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    // Filtruj po PL — powinno byc mniej niz all
    await ordersPage.selectTransportType("PL");

    const filteredCount = await ordersPage.getOrderCount();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("searches by text with debounce", async ({ ordersPage }) => {
    await ordersPage.goto();

    // Szukaj konkretnego zlecenia
    await ordersPage.searchByText("ZT2026/0001");

    const count = await ordersPage.getOrderCount();
    // Powinien znalezc co najmniej 1 wynik
    expect(count).toBeGreaterThanOrEqual(1);

    // Kazdy wiersz powinien zawierac szukany tekst
    const firstRow = ordersPage.getRowByOrderNo("ZT2026/0001");
    await expect(firstRow).toBeVisible();
  });

  test("clears filters to show full list", async ({ ordersPage }) => {
    await ordersPage.goto();

    // Ustaw filtr
    await ordersPage.selectTransportType("PL");
    const filteredCount = await ordersPage.getOrderCount();
    expect(filteredCount).toBeLessThan(EXPECTED_CURRENT_COUNT);

    // Wyczysc filtr
    await ordersPage.clearTransportType();

    const fullCount = await ordersPage.getOrderCount();
    expect(fullCount).toBe(EXPECTED_CURRENT_COUNT);
  });
});
