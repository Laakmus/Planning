import type { Page, Locator } from "@playwright/test";

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
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async isLoaded() {
    await this.form.waitFor({ state: "visible" });
  }
}
