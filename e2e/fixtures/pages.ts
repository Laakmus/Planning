import { test as base } from "@playwright/test";
import { LoginPage } from "../page-objects/LoginPage";
import { OrdersPage } from "../page-objects/OrdersPage";
import { OrderDrawerPage } from "../page-objects/OrderDrawerPage";
import { ContextMenuComponent } from "../page-objects/ContextMenuComponent";
import { HistoryPanelPage } from "../page-objects/HistoryPanelPage";

type Pages = {
  loginPage: LoginPage;
  ordersPage: OrdersPage;
  drawerPage: OrderDrawerPage;
  contextMenu: ContextMenuComponent;
  historyPanel: HistoryPanelPage;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  ordersPage: async ({ page }, use) => {
    await use(new OrdersPage(page));
  },
  drawerPage: async ({ page }, use) => {
    await use(new OrderDrawerPage(page));
  },
  contextMenu: async ({ page }, use) => {
    await use(new ContextMenuComponent(page));
  },
  historyPanel: async ({ page }, use) => {
    await use(new HistoryPanelPage(page));
  },
});

export { expect } from "@playwright/test";
