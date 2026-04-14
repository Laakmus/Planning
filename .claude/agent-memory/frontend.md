# Frontend Agent — Pamięć

## Sesja A3b-2 (2026-04-14) — Panel admina użytkowników

### Wykonane
- MOD `src/components/orders/AppSidebar.tsx` — dodano sekcję "Administracja" widoczną tylko gdy `useAuth().user?.role === "ADMIN"`; link `/admin/users` z ikoną `Users`, `data-testid="sidebar-admin-users"`, active gdy `pathname.startsWith("/admin/users")`. UWAGA: spec zlecenia wskazywał `src/components/layout/AppSidebar.tsx`, ale faktyczna lokalizacja to `src/components/orders/AppSidebar.tsx` (brak katalogu `layout/`).
- NEW `src/pages/admin/users.astro` — Layout + React island `AdminUsersApp client:load`
- NEW `src/components/admin/AdminUsersApp.tsx` — AppProviders + SidebarProvider + AppSidebar + SidebarInset; guard klienta: redirect `/` gdy brak sesji, `/orders` gdy `role !== "ADMIN"`
- NEW `src/components/admin/UsersPanel.tsx` — tabela shadcn z filtrami (search/role/isActive), paginacją, DropdownMenu akcji per wiersz (Edytuj/Reset hasła/Nowy invite/Deaktywuj); button "Dodaj użytkownika" → CreateUserDialog → InviteLinkDialog
- NEW `src/components/admin/CreateUserDialog.tsx` — formularz z `createUserSchema` (Zod safeParse, field-level errors), password show/hide, role Select
- NEW `src/components/admin/EditUserDialog.tsx` — username readonly (disabled Input), pola email/fullName/phone/role/isActive (natywny checkbox — brak shadcn/Checkbox)
- NEW `src/components/admin/ResetPasswordDialog.tsx` — nowe hasło + confirm (muszą być identyczne), walidacja `passwordSchema`
- NEW `src/components/admin/InviteLinkDialog.tsx` — readonly Input z URL + Copy button (clipboard API), info o TTL 7 dni, warning o jednorazowości
- NEW `src/components/admin/DeactivateUserDialog.tsx` — AlertDialog shadcn, confirm z warningiem o natychmiastowym wylogowaniu
- NEW `src/hooks/useAdminUsers.ts` — list/create/update/deactivate/resetPassword/regenerateInvite, debounce search 300ms, toasty sonner, paginacja z `totalPages`

### Learningi
- Brak shadcn `Checkbox` w repo — użyto natywnego `<input type="checkbox">` z `accent-primary`
- Radix Select **nie dopuszcza pustego `value`** — dla filtrów "wszystkie" używam sentinela (np. `__ALL__`) i mapuję na `undefined` w `onValueChange`
- `AppSidebar` już akceptuje `activeView: ViewGroup | null` — w panelu admina przekazuję `null` + no-op `onViewChange` (nie wybieramy widoku zleceń)
- `AlertDialogAction` domyślnie zamyka dialog po kliknięciu — aby pokazać spinner `isSubmitting` przed ręcznym zamknięciem, trzeba `e.preventDefault()` w `onClick` i samemu wywołać `onOpenChange(false)` po sukcesie
- `api.patch<T>(path, body)` wymaga body; dla PATCH wysyłam pełen komplet pól (updateUserSchema jest partial, więc to OK)
- `api.delete<void>(path)` zwraca `undefined as void` dla 204 — działa bez zmian
- Deaktywacja w DropdownMenu disabled gdy `currentUser.id === user.id` (nie można deaktywować siebie) lub gdy user już nieaktywny

### data-testid dla E2E (A3c)
- Sidebar: `sidebar-admin-users`
- App: `admin-users-app`, `admin-users-panel`
- Filtry: `admin-users-search`, `admin-users-role-filter`, `admin-users-status-filter`
- Lista: `admin-user-row` (+ `data-user-id`), `admin-user-actions`
- Paginacja: `admin-users-prev`, `admin-users-next`
- Dialogi: `admin-create-user-dialog`, `admin-edit-user-dialog`, `admin-reset-password-dialog`, `admin-invite-link-dialog`, `admin-deactivate-user-dialog`
- Przyciski top-level: `admin-create-user`
- Pola formularza create: `create-user-{username,password,email,fullname,phone,role,submit}`
- Pola formularza edit: `edit-user-{email,fullname,phone,role,active,submit}`
- Reset hasła: `reset-password-{new,confirm,submit}`
- Invite link: `invite-link-{url,copy,close}`
- Deaktywacja: `deactivate-user-confirm`

## Sesja A3b-1 (2026-04-14) — Username login + aktywacja konta

### Wykonane
- `src/contexts/AuthContext.tsx` — `login(email, password)` → `login(username, password)`. Zamiast `supabase.auth.signInWithPassword` używamy `fetch POST /api/v1/auth/login` (żeby nie mieć tokena przed loginem). Po sukcesie `supabase.auth.setSession({ access_token, refresh_token })` — SDK trzyma sesję w localStorage jak dotąd, middleware i ApiClient bez zmian. Import `UsernameLoginResponse` z `@/types`, `ApiError` z `@/lib/api-client`.
- `src/components/auth/LoginCard.tsx` — state `email` → `username`, input `type="text"`, `autocomplete="username"`, placeholder `"np. j.kowalski"`, walidacja przez `loginUsernameSchema.safeParse(...)`. Dodany `data-testid="login-username"`, `data-testid="login-password"`, `data-testid="login-submit"` (istniały: `login-form`, `login-error`).
- `src/components/auth/ActivateAccountCard.tsx` (NEW) — stany `idle|activating|success|error`. Prop `token: string`. Walidacja przez `activateAccountSchema` client-side. POST do `/api/v1/auth/activate` przez `fetch` (brak sesji w tym widoku). Dark mode + ThemeProvider. `data-testid="activate-card"`, `"activate-submit"`, `"activate-status"`, `"activate-login-link"`.
- `src/pages/activate.astro` (NEW) — Astro page czytająca `Astro.url.searchParams.get('token')`, renderująca `<ActivateAccountCard client:load token={token} />` w `Layout.astro`.

### Learningi
- `supabase.auth.setSession({ access_token, refresh_token })` pozwala zapisać sesję otrzymaną z backendu (np. z `POST /auth/login` wywoływanego serwerowo), zachowując zgodność z `onAuthStateChange` i localStorage.
- Używanie `fetch` bezpośrednio (zamiast ApiClient) przy login/activate — ApiClient ma `getToken`, ale przed zalogowaniem tokena nie ma. Nie trzeba tworzyć pustej instancji.
- `Button asChild` (shadcn `Slot.Root`) — pozwala renderować `<a>` z wyglądem przycisku (używane w ActivateAccountCard dla linku "Przejdź do logowania").
- Brak komponentów Card/Alert w `src/components/ui/` — używamy plain divów (podobnie jak istniejący LoginCard).

### data-testid dla E2E (Faza C)
- Login: `login-form`, `login-username` (NOWE, wcześniej `login-email`), `login-password` (NOWE), `login-submit` (NOWE), `login-error`
- Activate: `activate-card`, `activate-submit`, `activate-status`, `activate-login-link`

## Sesja 46 (2026-03-08) — ValidationErrorDialog (422 prepare-email)

### Wykonane
- `src/components/orders/ValidationErrorDialog.tsx` — nowy komponent AlertDialog wyświetlający listę brakujących pól z backendu (422 z `details.missing`)
- `src/hooks/useOrderActions.ts` — dodano `emailValidationErrors` stan + obsługa 422 w `handleSendEmail` catch block
- `src/hooks/useOrderDrawer.ts` — analogiczna zmiana w `handleSendEmailFromDrawer`
- `src/components/orders/OrdersPage.tsx` — render `<ValidationErrorDialog>` z useOrderActions
- `src/components/orders/drawer/OrderDrawer.tsx` — render `<ValidationErrorDialog>` z useOrderDrawer

### Learningi
- `api.postRaw()` (raw: true) parsuje błędy do `ApiError` z `details` (linie 136-139 api-client.ts) — wystarczy `err instanceof ApiError` w catch
- `ApiError.details?.missing` zawiera string[] z kluczami pól; pola "items"/"stops" są już po polsku z backendu
- `AlertDialogDescription asChild` + `<div>` wrapper rozwiązuje problem list wewnątrz `<p>` (hydration mismatch)

## Sesja 37 (2026-03-07) — setTimeout race condition fix

### Wykonane
- `src/hooks/useOrderDrawer.ts` — usunięcie `setTimeout(100ms)` w `handlePreviewSaveAndGo`
  - Nowy mechanizm: `pendingPreviewRef` (useRef) + useEffect reagujący na zmianę `detail`
  - Po save+loadDetail: flaga `pendingPreviewRef.current = true` → useEffect buduje formData z `detail` i otwiera podgląd
  - Wyekstrahowano `buildFormDataFromDetail()` — helper budujący OrderFormData z OrderDetailResponseDto (DRY)
  - `handlePreviewDiscardAndGo` teraz też używa `buildFormDataFromDetail()` zamiast ~45 linii duplikowanego kodu

### Learningi
- Gdy komponent-dziecko (OrderForm) aktualizuje ref async (useEffect), parent nie powinien polegać na timing hacku (setTimeout) — zamiast tego używaj ref-based flag + useEffect na state który jest źródłem danych
- Po save, dane w `detail` (po loadDetail) = to co user zapisał → można bezpiecznie budować formData z detail zamiast czekać na formDataRef z komponentu-dziecka
- `buildFormDataFromDetail()` jako helper eliminuje duplikację między save-and-go a discard-and-go

## Sesja 24 (2026-03-03) — ErrorBoundary

### Wykonane
- `src/components/ui/ErrorBoundary.tsx` — class-based, zero npm deps
  - Props: `children`, `fallback?: ReactNode`, `onError?: (error, info) => void`
  - Domyślny fallback: `role="alert"`, polskie komunikaty, dev-only stack trace, dark mode
  - Przyciski: "Spróbuj ponownie" (reset state) + "Odśwież stronę" (reload)
  - Używa `@/components/ui/button` (shadcn)
- Integracja 2-poziomowa:
  - `OrdersApp.tsx`: `<ErrorBoundary>` wewnątrz ThemeProvider, na zewnątrz AuthProvider
  - `OrdersPage.tsx`: `<ErrorBoundary fallback={...}>` wokół `<OrderDrawer>`

### Learningi
- React 19 nadal wymaga class-based ErrorBoundary (brak hooka)
- ErrorBoundary MUSI być wewnątrz ThemeProvider żeby dark mode fallbacku działał
- ErrorBoundary wokół AuthProvider łapie błędy z dowolnego providera/context
- Custom fallback (ReactNode prop) zastępuje domyślny ekran — używamy go dla drawera
- `import.meta.env.DEV` — Astro/Vite flag do warunkowego renderowania stack trace
