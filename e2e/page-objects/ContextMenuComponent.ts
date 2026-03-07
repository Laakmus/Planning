import type { Page } from "@playwright/test";

export class ContextMenuComponent {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get menu() {
    return this.page.locator("[role='menu']");
  }

  async isVisible() {
    await this.menu.first().waitFor({ state: "visible" });
  }

  async clickItem(name: string) {
    await this.menu.first().getByRole("menuitem", { name }).click();
  }

  async openStatusSubmenu() {
    // "Zmien status" to submenu trigger (ContextMenuSubTrigger)
    await this.menu.first().getByText("Zmień status").hover();
    // Poczekaj na podmenu
    await this.page.locator("[role='menu']").nth(1).waitFor({ state: "visible" });
  }

  async selectStatus(statusName: string) {
    // Statusy w podmenu maja format "-> NazwaStatusu"
    await this.page
      .locator("[role='menu']")
      .nth(1)
      .getByRole("menuitem", { name: statusName })
      .click();
  }
}
