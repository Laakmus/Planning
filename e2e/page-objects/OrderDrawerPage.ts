import type { Page, Locator } from "@playwright/test";

export class OrderDrawerPage {
  readonly page: Page;
  readonly drawer: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.getByTestId("order-drawer");
    this.saveButton = page.getByTestId("drawer-save");
  }

  async isOpen() {
    await this.drawer.waitFor({ state: "visible" });
  }

  async close() {
    // Przycisk X (title="Zamknij (Escape)") w naglowku drawera
    await this.drawer.locator('button[title="Zamknij (Escape)"]').click();
    await this.drawer.waitFor({ state: "hidden" });
  }

  async getTitle() {
    // Naglowek drawera: h1 z nr zlecenia lub "Nowe zlecenie"
    return this.drawer.locator("h1").first().textContent();
  }

  async save() {
    await this.saveButton.click();
  }

  async isSaveButtonVisible() {
    return this.saveButton.isVisible();
  }

  async waitForLoaded() {
    await this.drawer.waitFor({ state: "visible" });
    // Poczekaj na zaladowanie danych (formularz)
    await this.page.waitForLoadState("networkidle");
  }
}
