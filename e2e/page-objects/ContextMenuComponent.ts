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
    // Radix ContextMenuSub otwiera submenu na pointerMove z pointerType='mouse'.
    // W headless Chromium Playwright hover() bywa zawodny — stosujemy kilka metod.
    const trigger = this.menu.first().getByText("Zmień status");
    const submenu = this.page.locator("[role='menu']").nth(1);

    // Metoda 1: hover z naturalnym ruchem myszy (steps symuluje ruch kursora)
    const box = await trigger.boundingBox();
    if (box) {
      // Rusz mysz z lewej strony menu DO srodka triggera (Radix sprawdza zmiane pozycji)
      await this.page.mouse.move(box.x - 10, box.y + box.height / 2);
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    } else {
      await trigger.hover();
    }

    // Daj Radix czas na otwarcie (ma wewnetrzny delay)
    let opened = false;
    try {
      await submenu.waitFor({ state: "visible", timeout: 1_500 });
      opened = true;
    } catch { /* fallback ponizej */ }

    if (!opened) {
      // Metoda 2: dispatchEvent pointerenter na DOM (omija Playwright mouse layer)
      await trigger.dispatchEvent("pointerenter", { pointerType: "mouse" });
      await trigger.dispatchEvent("pointermove", { pointerType: "mouse" });
      try {
        await submenu.waitFor({ state: "visible", timeout: 1_500 });
        opened = true;
      } catch { /* fallback ponizej */ }
    }

    if (!opened) {
      // Metoda 3: click na subtrigger (niektorzy klienci Radix otwieraja na click)
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
