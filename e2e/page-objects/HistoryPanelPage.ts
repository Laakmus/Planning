import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export class HistoryPanelPage {
  readonly page: Page;
  readonly panel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId("history-panel");
  }

  async isOpen() {
    await this.panel.waitFor({ state: "visible" });
  }

  async close() {
    // Przycisk X w naglowku panelu historii
    await this.panel.getByRole("button").filter({ has: this.page.locator("svg") }).first().click();
    await this.panel.waitFor({ state: "hidden" });
  }

  async getTitle() {
    return this.panel.locator("p").filter({ hasText: "Historia zmian" }).textContent();
  }

  // Auto-retry asercja na tytul panelu historii
  async expectTitle(text: string) {
    await expect(this.panel.locator("p").filter({ hasText: text })).toBeVisible({ timeout: 10_000 });
  }

  async waitForLoaded() {
    await this.panel.waitFor({ state: "visible", timeout: 10_000 });
    // Poczekaj na widocznosc tytulu "Historia zmian" zamiast arbitralnego timeout
    await expect(this.panel.locator("p").filter({ hasText: "Historia zmian" })).toBeVisible({ timeout: 10_000 });
  }
}
