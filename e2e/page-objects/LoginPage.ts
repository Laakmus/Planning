import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.getByTestId("login-form");
    // Label w LoginCard.tsx to "Login" (htmlFor="email")
    this.emailInput = page.getByLabel("Login");
    this.passwordInput = page.getByLabel("Hasło");
    // Przycisk ma tekst "Zaloguj" (bez "się")
    this.submitButton = page.getByRole("button", { name: /zaloguj/i });
    this.errorMessage = page.getByTestId("login-error");
  }

  async goto() {
    await this.page.goto("/");
  }

  async login(email: string, password: string) {
    // Czekaj az React zhydruje formularz.
    // Astro renderuje HTML serwerowo (formularz widoczny od razu), ale React hydruje
    // asynchronicznie. fill() przed hydracja ustawia wartosc DOM, ale React resetuje
    // ja do "" przy mount (kontrolowane inputy: value={email}).
    // Rozwiazanie: fill + krótki wait + sprawdz czy wartosc przetrwala.
    // Jesli React zresetowal — powtórz (tym razem React juz zhydrowal).
    await expect(async () => {
      await this.emailInput.fill(email);
      // Daj React 200ms na potencjalny reset (hydracja nadpisuje wartosc DOM)
      await this.page.waitForTimeout(200);
      await expect(this.emailInput).toHaveValue(email);
    }).toPass({ timeout: 15_000 });

    await expect(async () => {
      await this.passwordInput.fill(password);
      await this.page.waitForTimeout(200);
      await expect(this.passwordInput).toHaveValue(password);
    }).toPass({ timeout: 5_000 });

    await this.submitButton.click();
  }

  async isLoaded() {
    await this.form.waitFor({ state: "visible" });
  }
}
