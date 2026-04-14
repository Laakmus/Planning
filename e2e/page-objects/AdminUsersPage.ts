import type { Page, Locator } from "@playwright/test";

/**
 * Page Object dla /admin/users — panel administracyjny userów.
 * Odpowiada strukturze UsersPanel + dialogs z AUTH-MIG A3.
 */
export class AdminUsersPage {
  readonly page: Page;

  // Sidebar
  readonly sidebarLink: Locator;

  // Panel główny
  readonly panel: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly roleFilter: Locator;
  readonly statusFilter: Locator;
  readonly prevPage: Locator;
  readonly nextPage: Locator;

  // Dialog: Create
  readonly createDialog: Locator;
  readonly createUsername: Locator;
  readonly createPassword: Locator;
  readonly createEmail: Locator;
  readonly createFullname: Locator;
  readonly createPhone: Locator;
  readonly createRole: Locator;
  readonly createSubmit: Locator;

  // Dialog: Edit
  readonly editDialog: Locator;
  readonly editEmail: Locator;
  readonly editFullname: Locator;
  readonly editRole: Locator;
  readonly editActive: Locator;
  readonly editSubmit: Locator;

  // Dialog: Reset password
  readonly resetDialog: Locator;
  readonly resetNew: Locator;
  readonly resetConfirm: Locator;
  readonly resetSubmit: Locator;

  // Dialog: Invite link
  readonly inviteDialog: Locator;
  readonly inviteUrl: Locator;
  readonly inviteCopy: Locator;
  readonly inviteClose: Locator;

  // Dialog: Deactivate
  readonly deactivateDialog: Locator;
  readonly deactivateConfirm: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebarLink = page.getByTestId("sidebar-admin-users");

    this.panel = page.getByTestId("admin-users-panel");
    this.createButton = page.getByTestId("admin-create-user");
    this.searchInput = page.getByTestId("admin-users-search");
    this.roleFilter = page.getByTestId("admin-users-role-filter");
    this.statusFilter = page.getByTestId("admin-users-status-filter");
    this.prevPage = page.getByTestId("admin-users-prev");
    this.nextPage = page.getByTestId("admin-users-next");

    this.createDialog = page.getByTestId("admin-create-user-dialog");
    this.createUsername = page.getByTestId("create-user-username");
    this.createPassword = page.getByTestId("create-user-password");
    this.createEmail = page.getByTestId("create-user-email");
    this.createFullname = page.getByTestId("create-user-fullname");
    this.createPhone = page.getByTestId("create-user-phone");
    this.createRole = page.getByTestId("create-user-role");
    this.createSubmit = page.getByTestId("create-user-submit");

    this.editDialog = page.getByTestId("admin-edit-user-dialog");
    this.editEmail = page.getByTestId("edit-user-email");
    this.editFullname = page.getByTestId("edit-user-fullname");
    this.editRole = page.getByTestId("edit-user-role");
    this.editActive = page.getByTestId("edit-user-active");
    this.editSubmit = page.getByTestId("edit-user-submit");

    this.resetDialog = page.getByTestId("admin-reset-password-dialog");
    this.resetNew = page.getByTestId("reset-password-new");
    this.resetConfirm = page.getByTestId("reset-password-confirm");
    this.resetSubmit = page.getByTestId("reset-password-submit");

    this.inviteDialog = page.getByTestId("admin-invite-link-dialog");
    this.inviteUrl = page.getByTestId("invite-link-url");
    this.inviteCopy = page.getByTestId("invite-link-copy");
    this.inviteClose = page.getByTestId("invite-link-close");

    this.deactivateDialog = page.getByTestId("admin-deactivate-user-dialog");
    this.deactivateConfirm = page.getByTestId("deactivate-user-confirm");
  }

  async goto() {
    await this.page.goto("/admin/users");
  }

  /** Zwraca wiersz użytkownika po ID (atrybut data-user-id). */
  userRow(userId: string): Locator {
    return this.page.locator(`[data-testid="admin-user-row"][data-user-id="${userId}"]`);
  }
}
