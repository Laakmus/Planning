import { test, expect } from "../fixtures/pages";

test.describe("Historia zmian", () => {
  test("opens history panel from context menu", async ({
    ordersPage,
    contextMenu,
    historyPanel,
  }) => {
    await ordersPage.goto();

    await ordersPage.rightClickRow("ZT2026/0001");
    await contextMenu.isVisible();

    await contextMenu.clickItem("Historia zmian");

    await historyPanel.isOpen();
    await expect(historyPanel.panel).toBeVisible();
  });

  test("shows history entries", async ({
    ordersPage,
    contextMenu,
    historyPanel,
  }) => {
    await ordersPage.goto();

    await ordersPage.rightClickRow("ZT2026/0001");
    await contextMenu.isVisible();

    await contextMenu.clickItem("Historia zmian");
    await historyPanel.waitForLoaded();

    // Panel powinien zawierac tytul "Historia zmian"
    const title = await historyPanel.getTitle();
    expect(title).toContain("Historia zmian");
  });
});
