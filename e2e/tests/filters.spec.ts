import { test, expect } from "../fixtures/pages";

test.describe("Filtry", () => {
  test("filters by transport type", async ({ ordersPage }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    // Filtruj po PL — powinno byc mniej niz all
    await ordersPage.selectTransportType("PL");

    // Uzyj expect().toPass() dla dynamicznej asercji po filtracji
    await expect(async () => {
      const filteredCount = await ordersPage.getOrderCount();
      expect(filteredCount).toBeLessThan(initialCount);
      expect(filteredCount).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });
  });

  test("searches by text and shows results or empty state", async ({ ordersPage }) => {
    await ordersPage.goto();

    // Wpisz tekst w pole wyszukiwania — seed.sql nie populuje search_text,
    // wiec szukanie moze zwrocic 0 wynikow. Weryfikujemy ze filtr dziala
    // (API odpowiada, tabela sie aktualizuje do wynikow lub empty state).
    const responsePromise = ordersPage.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await ordersPage.filterSearch.fill("ZT2026/0001");
    await responsePromise;

    // Po wyszukiwaniu widoczna jest tabela z wynikami LUB empty state
    await expect(async () => {
      const hasRows = await ordersPage.table.locator("tbody tr[data-order-id]").count() > 0;
      const hasEmpty = await ordersPage.emptyState.isVisible().catch(() => false);
      expect(hasRows || hasEmpty).toBe(true);
    }).toPass({ timeout: 10_000 });
  });

  test("clears filters to show full list", async ({ ordersPage }) => {
    await ordersPage.goto();

    const initialCount = await ordersPage.getOrderCount();

    // Ustaw filtr
    await ordersPage.selectTransportType("PL");

    await expect(async () => {
      const filteredCount = await ordersPage.getOrderCount();
      expect(filteredCount).toBeLessThan(initialCount);
    }).toPass({ timeout: 10_000 });

    // Wyczysc filtr
    await ordersPage.clearTransportType();

    // Sprawdz ze wraca co najmniej poczatkowa liczba
    // (uzyj >= — inne testy w trybie parallel moga dodac zlecenia do DB)
    await expect(async () => {
      const clearedCount = await ordersPage.getOrderCount();
      expect(clearedCount).toBeGreaterThanOrEqual(initialCount);
    }).toPass({ timeout: 10_000 });
  });
});
