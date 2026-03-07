import type { Page, Locator } from "@playwright/test";

export class OrdersPage {
  readonly page: Page;
  readonly ordersApp: Locator;
  readonly table: Locator;
  readonly emptyState: Locator;
  readonly filterTransportType: Locator;
  readonly filterStatus: Locator;
  readonly filterSearch: Locator;
  readonly filterWeek: Locator;

  constructor(page: Page) {
    this.page = page;
    this.ordersApp = page.getByTestId("orders-app");
    this.table = page.getByTestId("order-table");
    this.emptyState = page.getByTestId("empty-state");
    this.filterTransportType = page.getByTestId("filter-transport-type");
    this.filterStatus = page.getByTestId("filter-status");
    this.filterSearch = page.getByTestId("filter-search");
    this.filterWeek = page.getByTestId("filter-week");
  }

  async goto() {
    await this.page.goto("/orders");
    await this.waitForTableLoaded();
  }

  async waitForTableLoaded() {
    await this.ordersApp.waitFor({ state: "visible" });
    // Poczekaj az tabela sie zaladuje
    await this.table.waitFor({ state: "visible", timeout: 10_000 });
  }

  async getOrderCount() {
    return this.table.locator("tbody tr[data-order-id]").count();
  }

  getRowByOrderNo(orderNo: string) {
    return this.table.locator("tbody tr").filter({ hasText: orderNo });
  }

  async clickRow(orderNo: string) {
    const row = this.getRowByOrderNo(orderNo);
    await row.click();
  }

  async rightClickRow(orderNo: string) {
    const row = this.getRowByOrderNo(orderNo);
    await row.click({ button: "right" });
  }

  // Nawigacja sidebar — SidebarMenuButton renderuje <button data-sidebar="menu-button">
  async navigateSidebar(view: "Aktualne" | "Zrealizowane" | "Anulowane") {
    await this.page
      .locator('[data-sidebar="menu-button"]')
      .filter({ hasText: view })
      .click();
    // Poczekaj na przeladowanie tabeli
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }

  // Filtry
  async searchByText(query: string) {
    await this.filterSearch.fill(query);
    // Debounce 300ms + response
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }

  async clearSearch() {
    await this.filterSearch.clear();
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }

  async selectTransportType(value: string) {
    await this.filterTransportType.selectOption(value);
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }

  async selectStatus(value: string) {
    await this.filterStatus.selectOption(value);
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }

  async clearTransportType() {
    await this.filterTransportType.selectOption("");
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }

  async clearStatus() {
    await this.filterStatus.selectOption("");
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  }
}
