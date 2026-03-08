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
    await this.drawer.waitFor({ state: "visible", timeout: 10_000 });
    // Poczekaj na zaladowanie danych — h1 powinien miec tekst (nr zlecenia lub "Nowe zlecenie")
    await this.drawer.locator("h1").first().waitFor({ state: "visible", timeout: 10_000 });
    // Krotka stabilizacja formularza
    await this.page.waitForTimeout(300);
  }
}
