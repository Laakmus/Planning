import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

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
    // Radix ContextMenu w headless Chromium nie otwiera submenu na hover.
    // Radix nasluchuje keyboard events na rodzicu [role="menu"], nie na poszczegolnych itemach.
    // Dlatego uzywamy page.keyboard (natywny input) zamiast element.press() (syntetyczny event).
    const trigger = this.menu.first().getByText("Zmień status");
    await expect(trigger).toBeVisible({ timeout: 5_000 });

    const submenu = this.page.locator("[role='menu']").nth(1);

    // Metoda 1: hover ustawia active item w Radix, page.keyboard otwiera submenu
    await trigger.hover();
    await this.page.keyboard.press("ArrowRight");

    let opened = false;
    try {
      await submenu.waitFor({ state: "visible", timeout: 2_000 });
      opened = true;
    } catch { /* fallback ponizej */ }

    if (!opened) {
      // Metoda 2: mouse.move z krokami (symuluje naturalny ruch kursora)
      const box = await trigger.boundingBox();
      if (box) {
        await this.page.mouse.move(box.x - 20, box.y + box.height / 2);
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
      }
      await this.page.keyboard.press("ArrowRight");
      try {
        await submenu.waitFor({ state: "visible", timeout: 2_000 });
        opened = true;
      } catch { /* fallback ponizej */ }
    }

    if (!opened) {
      // Metoda 3: dispatchEvent pointerenter + pointermove (omija Playwright mouse layer)
      await trigger.dispatchEvent("pointerenter", { pointerType: "mouse" });
      await trigger.dispatchEvent("pointermove", { pointerType: "mouse" });
      try {
        await submenu.waitFor({ state: "visible", timeout: 2_000 });
        opened = true;
      } catch { /* fallback ponizej */ }
    }

    if (!opened) {
      // Metoda 4: click na subtrigger (backup)
      await trigger.click();
    }

    await submenu.waitFor({ state: "visible", timeout: 5_000 });
    await expect(submenu.getByRole("menuitem").first()).toBeVisible({ timeout: 5_000 });
  }

  async selectStatus(statusName: string) {
    // Statusy w podmenu maja format "→ NazwaStatusu" (Unicode arrow + nazwa)
    const submenu = this.page.locator("[role='menu']").nth(1);
    await submenu.getByText(statusName, { exact: false }).click();
  }

  // Polaczona metoda: otworz submenu i wybierz status w jednej sekwencji
  async changeStatus(statusName: string) {
    await this.openStatusSubmenu();
    await this.selectStatus(statusName);
  }
}
