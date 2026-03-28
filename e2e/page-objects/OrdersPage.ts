import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

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
    // Poczekaj az dane sie wyrenderuja — przynajmniej 1 wiersz z data-order-id
    await this.table.locator("tbody tr[data-order-id]").first().waitFor({ state: "visible", timeout: 15_000 });
  }

  // Upewnij sie ze sidebar jest rozwiniety (w CI moze byc collapsed)
  async ensureSidebarOpen() {
    const sidebar = this.page.locator('[data-slot="sidebar"]');
    const state = await sidebar.getAttribute("data-state");
    if (state === "collapsed") {
      await this.page.locator('[data-sidebar="trigger"]').click();
      await expect(sidebar).toHaveAttribute("data-state", "expanded", { timeout: 5_000 });
    }
  }

  // Poczekaj az tabela sie ustabilizuje po odpowiedzi API
  async waitForTableUpdate() {
    await this.table.locator("tbody tr[data-order-id]").first().waitFor({ state: "visible", timeout: 10_000 });
  }

  // Locator do wierszy tabeli — do uzytku z toHaveCount() (auto-retry)
  getOrderRows() {
    return this.table.locator("tbody tr[data-order-id]");
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
    await this.ensureSidebarOpen();

    // Rejestruj listener PRZED akcja (unikniecie race condition)
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.page
      .locator('[data-sidebar="menu-button"]')
      .filter({ hasText: view })
      .click();
    // Poczekaj na przeladowanie tabeli
    await responsePromise;
    await this.waitForTableUpdate();
  }

  // Filtry
  async searchByText(query: string) {
    // Rejestruj listener PRZED akcja (unikniecie race condition)
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.filterSearch.fill(query);
    // Debounce 300ms + response
    await responsePromise;
    await this.waitForTableUpdate();
  }

  async clearSearch() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.filterSearch.clear();
    await responsePromise;
    await this.waitForTableUpdate();
  }

  async selectTransportType(value: string) {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.filterTransportType.selectOption(value);
    await responsePromise;
    await this.waitForTableUpdate();
  }

  async selectStatus(value: string) {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.filterStatus.selectOption(value);
    await responsePromise;
    await this.waitForTableUpdate();
  }

  async clearTransportType() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.filterTransportType.selectOption("");
    await responsePromise;
    await this.waitForTableUpdate();
  }

  async clearStatus() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
      { timeout: 15_000 },
    );
    await this.filterStatus.selectOption("");
    await responsePromise;
    await this.waitForTableUpdate();
  }

  // Helper: pobierz access token z localStorage (Supabase SDK przechowuje tam sesje)
  async getAccessToken(): Promise<string> {
    return this.page.evaluate(() => {
      const raw = localStorage.getItem("sb-127-auth-token");
      if (!raw) throw new Error("Brak tokenu auth w localStorage");
      const parsed = JSON.parse(raw);
      return parsed.access_token as string;
    });
  }

  // Helper: zmien status zlecenia przez API (omija UI submenu Radix)
  async changeStatusViaApi(orderId: string, newStatusCode: string, complaintReason?: string) {
    const token = await this.getAccessToken();
    const body: Record<string, string> = { newStatusCode };
    if (complaintReason) body.complaintReason = complaintReason;

    return this.page.request.post(
      `http://localhost:4321/api/v1/orders/${orderId}/status`,
      {
        data: body,
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }
}
