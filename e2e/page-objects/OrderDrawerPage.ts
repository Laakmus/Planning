import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

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

  // Auto-retry asercja na tytul drawera
  async expectTitle(text: string) {
    await expect(this.drawer.locator("h1").first()).toContainText(text, { timeout: 10_000 });
  }

  async save() {
    await this.saveButton.click();
  }

  async isSaveButtonVisible() {
    return this.saveButton.isVisible();
  }

  async waitForLoaded() {
    await this.drawer.waitFor({ state: "visible", timeout: 10_000 });
    // Poczekaj az h1 nie zawiera "Ladowanie" — dane zaladowane (auto-retry)
    const h1 = this.drawer.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 10_000 });
    await expect(h1).not.toContainText("Ładowanie", { timeout: 10_000 });
  }
}
