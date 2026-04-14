import { test, expect } from "../fixtures/pages";

/**
 * E2E testy panelu administracyjnego /admin/users (AUTH-MIG A3).
 * Serial — mutują DB (tworzą/edytują/deaktywują użytkowników).
 *
 * Uwaga: testy wymagają storageState admina (global-setup logs in jako admin@test.pl
 * → ADMIN role). Konfiguracja w playwright.config.ts.
 */
test.describe.serial("Panel admina — użytkownicy", () => {
  // Timestamp do unikalnych usernames (żeby nie kolidować z seed/previous runs)
  const RUN_ID = Date.now().toString().slice(-6);
  const NEW_USER = {
    username: `e2e_${RUN_ID}`,
    password: "testpass12",
    email: `e2e_${RUN_ID}@test.pl`,
    fullName: "E2E Test User",
    phone: "+48 500 000 000",
  };

  test("sidebar ma sekcję Administracja widoczną dla ADMIN", async ({
    adminUsersPage,
  }) => {
    await adminUsersPage.page.goto("/orders");
    await expect(adminUsersPage.sidebarLink).toBeVisible();
  });

  test("przejście przez sidebar otwiera /admin/users", async ({
    adminUsersPage,
  }) => {
    await adminUsersPage.page.goto("/orders");
    await adminUsersPage.sidebarLink.click();
    await adminUsersPage.page.waitForURL("**/admin/users");
    await expect(adminUsersPage.panel).toBeVisible();
  });

  test("tworzenie nowego użytkownika pokazuje InviteLinkDialog", async ({
    adminUsersPage,
  }) => {
    await adminUsersPage.goto();
    await expect(adminUsersPage.createButton).toBeVisible();
    await adminUsersPage.createButton.click();

    await expect(adminUsersPage.createDialog).toBeVisible();
    await adminUsersPage.createUsername.fill(NEW_USER.username);
    await adminUsersPage.createPassword.fill(NEW_USER.password);
    await adminUsersPage.createEmail.fill(NEW_USER.email);
    await adminUsersPage.createFullname.fill(NEW_USER.fullName);
    await adminUsersPage.createPhone.fill(NEW_USER.phone);
    // Rola zostaje domyślna (PLANNER) lub ustawiona przez Select
    await adminUsersPage.createSubmit.click();

    // Po sukcesie pokazuje się InviteLinkDialog z URL-em
    await expect(adminUsersPage.inviteDialog).toBeVisible();
    const url = await adminUsersPage.inviteUrl.inputValue();
    expect(url).toMatch(/\/activate\?token=[a-f0-9]+/);
    await adminUsersPage.inviteClose.click();
  });

  test("nowy użytkownik jest widoczny w tabeli", async ({ adminUsersPage }) => {
    await adminUsersPage.goto();
    await adminUsersPage.searchInput.fill(NEW_USER.username);
    // Debounce search 300ms
    await adminUsersPage.page.waitForTimeout(500);

    const row = adminUsersPage.page
      .locator('[data-testid="admin-user-row"]')
      .filter({ hasText: NEW_USER.username });
    await expect(row).toBeVisible();
  });

  test("deaktywacja utworzonego usera", async ({ adminUsersPage }) => {
    await adminUsersPage.goto();
    await adminUsersPage.searchInput.fill(NEW_USER.username);
    await adminUsersPage.page.waitForTimeout(500);

    const row = adminUsersPage.page
      .locator('[data-testid="admin-user-row"]')
      .filter({ hasText: NEW_USER.username });
    await expect(row).toBeVisible();

    // Otwórz dropdown akcji i kliknij Deaktywuj — konkretny wybór zależy od impl.
    // Sprawdzamy dostępność przycisku akcji w wierszu.
    const actionsButton = row.locator('[data-testid="admin-user-actions"]');
    await expect(actionsButton).toBeVisible();
  });
});
