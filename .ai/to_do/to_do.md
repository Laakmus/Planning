# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-03-07 (sesja 38 — E2E Playwright: 25 testów, Page Objects, CI)

---

## Do zrobienia — HIGH

### H-11. ~~Brak CI/CD pipeline i pre-commit hooków~~ → CZĘŚCIOWO DONE
- **Źródło:** Audyt testów
- **Opis:** ~~Brak `.github/`~~ — GitHub Actions E2E workflow dodany (`.github/workflows/e2e.yml`). Brak husky/lint-staged (pre-commit hooks) — odroczone.

---

## Do zrobienia — MEDIUM

(brak)

---

## Do zrobienia — LOW

### L-02. Brak paginacji w endpointach słownikowych
- **Pliki:** companies, locations, products

---

## Odroczone (user decision: zostawić)

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).
- W przyszłości będzie powiązany z widokiem z order.md.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Czysto refaktoringowa zmiana (~290 linii logiki → osobny hook). Nie zmienia funkcjonalności.
- **Powiązane:** M-06 (OrderDrawer 742 linii)

### D-06. Dictionary sync endpoints — stuby
- `POST /dictionary-sync/run` i `GET /jobs/{id}` zwracają mock responses. Oczekiwane dla MVP bez integracji ERP.

### D-07. Job czyszczący anulowane zlecenia po 24h
- PRD wymaga usunięcia anulowanych po 24h. Wymaga `pg_cron` (infrastructure).
- **Powiązane:** "Wygasa za X h" w UI (wymagane w ui-plan.md, brak implementacji)

### D-08. parseJsonBody — limit rozmiaru body (revert z sesji 36)
- Było M-11 w sesji 34 (1MB limit), cofnięte w sesji 36.
- Debata sesja 37: Security (8/10), Architect (4/10), Tech Lead (overthinking dla intranetu).
- **Konsensus:** Odłożone — intranet za VPN, zaufani użytkownicy. Naprawić przed wystawieniem publicznym.

### D-09. Rate limiting — fallback na IP dla niezweryfikowanych tokenów
- Middleware dekoduje JWT bez weryfikacji podpisu (atob). Atakujący mógłby sfabrykować JWT z sub innego użytkownika.
- **Konsensus debaty:** Odłożone — na intranecie IP-based wystarczy, ryzyko minimalne.

### D-10. Health endpoint — usunięcie error.message z odpowiedzi
- GET /api/v1/health ujawnia `error.message` z PostgreSQL w odpowiedzi 503.
- **Konsensus debaty:** Odłożone — intranet, health check dla monitoringu wewnętrznego.

### D-11. N+1 queries w updateOrder
- Do 33+50 sekwencyjnych zapytań DB przy zapisie z pełną trasą i itemami (typowo 15-20).
- **Konsensus debaty:** Premature optimization przy kilkudziesięciu użytkownikach. Naprawić przy skalowaniu.

### D-12. Brak limitu długości pola search w walidatorach
- `orderListQuerySchema` i dictionary endpoints nie mają `.max()` na polu search.
- **Konsensus debaty:** Odłożone — intranet, niskie ryzyko slow query DoS.

---

## Zrobione

### Sesja 38 — E2E Playwright (25 testów, 5 Page Objects, CI)
- [x] Faza 0: Infrastruktura — `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/helpers/test-data.ts`, `e2e/fixtures/pages.ts`, `e2e/.gitignore`, @playwright/test + 5 skryptów npm
- [x] Faza 1: data-testid — 14 atrybutów w 8 komponentach (LoginCard, OrdersApp, FilterBar, OrderTable, OrderDrawer, DrawerFooter, HistoryPanel, EmptyState)
- [x] Faza 2: LoginPage PO + `auth.spec.ts` (3 testy: login, błędne hasło, redirect bez sesji)
- [x] Faza 3: OrdersPage PO + `sidebar.spec.ts` (3 testy) + `order-list.spec.ts` (3 testy)
- [x] Faza 4: `filters.spec.ts` (3 testy: filtr transportu, wyszukiwanie, czyszczenie)
- [x] Faza 5: OrderDrawerPage, ContextMenuComponent, HistoryPanelPage PO + `context-menu.spec.ts` (3), `drawer.spec.ts` (4), `history.spec.ts` (2)
- [x] Faza 6: `order-actions.spec.ts` (4 testy: duplikacja, anulowanie, przywracanie, zmiana statusu)
- [x] Faza 7: `.github/workflows/e2e.yml` — GitHub Actions (Supabase + Playwright Chromium)
- [x] Faza 8: Stabilizacja — poprawiono 2x waitForTimeout → waitForResponse. TypeScript 0 błędów, Vitest 909/909
- Wynik: 25 testów E2E w 8 plikach, 5 Page Objects, Vitest 909/909

### Sesja 37 — 3x HIGH + 3x MEDIUM DONE (6 tasków)
- [x] H-12: try/catch w GET /orders/{orderId} — `logError()` + `errorResponse(500)`
- [x] H-13: Usunięcie 3. parametru signal z hooków (opcja A) — useOrders, useOrderHistory. Guard AbortController zachowany.
- [x] H-14: setTimeout(100ms) → pendingPreviewRef (ref-based flag) + useEffect w useOrderDrawer. Wyekstrahowano `buildFormDataFromDetail()` (DRY).
- [x] M-17: Aktualizacja ui-plan.md — stopka "Podgląd" zamiast "Generuj PDF", wirtualizacja oznaczona jako planowana
- [x] M-18: console.error → logError w warehouse/orders.ts i entry-fixed.ts + dodanie logError do mocków testowych
- [x] M-19: 20+ błędów TS w 8 plikach testowych — zaktualizowane mocki DTO o brakujące pola
- Wynik: 909/909 testów, 0 błędów TypeScript

### Sesja 36 — 16x LOW + M-16 + L-15 DONE (18 tasków)
- [x] L-01: Lock na anulowanych/zrealizowanych — walidacja statusu w `lockOrder()` + error `LOCK_TERMINAL_STATUS` + 3 testy
- [x] L-04: `buildSnapshotsForCarrier` pobiera address/location name z tabeli `locations`
- [x] L-10: Komentarze przy `as T` castach w `api-client.ts` (wyjaśnienie konieczności)
- [x] L-11: `week-utils.ts` regex — separator `W`/`-` wymagany (nie opcjonalny)
- [x] L-15: Testy postRaw Accept header + AbortController timeout (`api-client-extra.test.ts`, 229 linii)
- [x] L-17: JWT `extractSubFromJwt` — walidacja UUID + komentarz o ryzyku
- [x] L-18: `dark:` klasy w CarrierSection (4 labele) i EmptyState (2 paragrafy)
- [x] L-19: AutocompleteField + AutocompleteFilter — obsługa Space/Enter na `span[role=button]`
- [x] L-20: Komentarze przy pustych `catch {}` (AuthContext, api-client)
- [x] L-21: `key={idx}` → `key={productNameSnapshot-idx}` w OrderRow
- [x] L-22: TimelineEntry timezone — explicit `Europe/Warsaw` via `toLocaleTimeString`
- [x] L-23: `aria-label` na paginacji (navigation + buttony prev/next)
- [x] L-24: `@types/react` + `@types/react-dom` przeniesione do devDependencies
- [x] L-25: `Cache-Control: no-store` w COMMON_HEADERS
- [x] L-26: `Permissions-Policy: camera=(), microphone=(), geolocation=()` w COMMON_HEADERS
- [x] L-27: CORS origin wyekstrahowany do `getCorsOrigin()` (DRY — api-helpers + middleware)
- [x] L-29: Structured logging — `logError()` helper + zamiana 21x `console.error` w 15 API routes
- [x] M-16: Testy komponentów React — 7 plików (EmptyState, FilterBar, LockIndicator, OrderRow, OrderRowContextMenu, OrderTable, StatusBadge)
- Dodatkowe: uproszczenie TimelineEntry (inline rendering), revert AbortSignal z api-client, revert limitu 1MB body
- Wynik: 909/909 testów, 0 błędów

### Sesja 35 — CR-04 + L-28
- [x] CR-04: Usunięcie kolumny `search_vector` i indeksu GIN (migracja + typy + db-plan.md)
- [x] L-28: Dokumentacja strategii migracji DB (`.ai/db-migration-strategy.md`)

### Sesja 34 — security, DRY, hooks, tests, docs (15 tasków)
- [x] M-10: CORS headers na odpowiedzi 429 (middleware.ts)
- [x] M-11: Limit rozmiaru request body 1MB (api-helpers.ts)
- [x] M-01: `hasActiveFilters()` wydzielony do view-models.ts
- [x] M-02: `STATUS_NAMES` wydzielony do view-models.ts
- [x] M-03: Runtime capitalization → STATUS_NAMES lookup (OrderForm, OrderDrawer, TimelineEntry)
- [x] M-04: Usunięto dead code `SORTABLE_COLUMNS` (OrderTable.tsx)
- [x] M-05: Usunięto identity mapping `TRANSPORT_CODE_DISPLAY` (OrderRow, FilterBar)
- [x] M-08: `TimeCombobox` wydzielony z RoutePointCard do osobnego pliku
- [x] M-06: `useOrderDrawer` hook — OrderDrawer.tsx 742→185 linii + fix duplikacji saveToApi/buildSaveBody
- [x] M-07: `useOrderActions` hook — OrdersPage.tsx 443→245 linii
- [x] CR-01 (dokończenie): 11 testów history/status + history/changes
- [x] NEW-05: Wspólny `makeApiContext()` helper w `src/test/helpers/api-context.ts`
- [x] M-14: `GET /api/v1/health` endpoint (DB connectivity check)
- [x] M-15: vitest coverage config (v8 provider) + testTimeout 10s
- [x] M-NEW-01: Aktualizacja 5 plików docs (db-plan, api-plan, prd, ui-plan, widok-magazyn)
- Wynik: 793/793 testów, 19 pre-existing TS errors (bez zmian)

### Sesja 33 — H-02 DONE: rozbicie order.service.ts
- [x] H-02: Rozbicie `order.service.ts` (2400 linii) na 6 sub-serwisów + re-export hub (17 linii)
  - `order-snapshot.service.ts` — helpery snapshotów, denormalizacja, FK walidacja, generateOrderNo
  - `order-list.service.ts` — listOrders
  - `order-detail.service.ts` — getOrderDetail
  - `order-create.service.ts` — createOrder
  - `order-update.service.ts` — updateOrder, patchStop
  - `order-misc.service.ts` — duplicateOrder, prepareEmailForOrder, updateCarrierCellColor, updateEntryFixed
- 782 testów PASS, 0 błędów TS, Reviewer PASS 8/8

### Sesja 32 — naprawiono 5 HIGH (CR-01 dokończone, CR-02, NEW-03, H-03, H-04, H-06)
- [x] CR-01 (dokończenie): 43 nowe testy — stops (23), carrier-color (10), entry-fixed (10)
- [x] CR-02: 34 testy middleware — rate limiting (10), idempotency (8), JWT (5), CORS (3), cleanup (2), integration (6)
- [x] NEW-03: Pokryte przez CR-01 (stops.test.ts — 23 testy)
- [x] NEW-04: Pokryte przez CR-01 (carrier-color + entry-fixed — 20 testów)
- [x] H-03: `DetailRowWithJoins` type — usunięto 4x `(row as any)` w order.service.ts
- [x] H-04: `formDataDirtyRef` flag zamiast `JSON.stringify` compare w OrderForm.tsx
- [x] H-06: AbortController w useOrders.ts + useOrderHistory.ts + signal support w api-client.ts
- [x] H-02 (próba): Agent-based split nie powiódł się (stale worktree) — odroczone
- [x] Nowy mock: `src/test/mocks/astro-middleware.ts` + alias w vitest.config.ts
- [x] Fix: 2 testy drawer-e2e zaktualizowane (isDirty behavioral change)
- [x] Wynik: 782/782 testów (40 plików), 0 błędów TypeScript

### Sesja 31 — 233 nowych testów + DRY buildSaveBody + fix bug week 53
- [x] NEW-01: 63 testy mapperów OrderView — roundtrip, null handling, carrier resolve
- [x] NEW-02: 20 testów warehouse endpoint — auth, locationId, walidacja
- [x] H-05: DRY `buildSaveBody(formData)` w OrderDrawer.tsx
- [x] H-10: 53 testy ViewModels — matryca przejść, domyślne filtry, typy unii, spójność
- [x] H-09: 87 testów hooków React — useOrders (19), useOrderDetail (13), useOrderHistory (15), useDictionarySync (18), useWarehouseWeek (22)
- [x] CR-01 (częściowo): 93 testy endpointów API — orders CRUD, status, lock/unlock, duplicate, prepare-email, restore
- [x] CR-03: 8 testów access-control (sesja 24)
- [x] H-01: ErrorBoundary class-based + 6 testów (sesja 24)
- [x] H-07: `.env.example` — klucze zamienione na placeholdery + 6 testów (sesja 24)
- [x] H-08: Migracja RPC role guard + anti-spoofing (sesja 24)
- [x] H-NEW-01: Implementacja OrderView — migracja DB, 8 nowych plików (sesja 23)
- [x] H-NEW-02: Fix labeli pakowania w CargoSection (sesja 23)
- [x] Fix bug: `useWarehouseWeek` week >= 52 → >= 53 (obsługa lat z 53 tygodniami ISO)
- [x] Fix: vehicleVariantCode → vehicleTypeText w fixture'ach testowych
- [x] Audyt: code reviewer + thought partner — zidentyfikowano NEW-03..05
- [x] Wynik: 705/705 testów (36 plików), 0 błędów TypeScript

### Sesja 30 — Audyt API (4 agenty) + fix bugów
- [x] Audyt API: 4 równoległe agenty (audyt endpointów, kontrakt frontend↔API, spójność docs, przegląd TODO)
- [x] Fix: `notificationDetails`/`confidentialityClause` `.optional()` → `.default(null)` w `order.validator.ts`
- [x] Fix: Dodanie pól do `TransportOrderRowExtended` w `order.service.ts`
- [x] Fix: Usunięcie 5x `(row as any)` castów w `order.service.ts`
- [x] Fix: `duplicateOrder` — kopiowanie `notificationDetails` z oryginału
- [x] Fix: Dodanie `confidentiality_clause` do SELECT/type assertion w `updateOrder`
- [x] V-01: Potwierdzono że listOrders filtry SĄ zaimplementowane
- [x] Wynik: 388/388 testów, 0 błędów TypeScript

### Sesje 26-29 — Widok magazynowy (WM-01..WM-08)
- [x] WM-01: Aktualizacja specyfikacji
- [x] WM-02: Migracja DB — location_id, notification_details, indeks
- [x] WM-03: Types + API — warehouse DTOs, warehouseQuerySchema, warehouse.service
- [x] WM-04: Frontend — 13 komponentów warehouse, nawigacja w sidebarze
- [x] WM-05: Testy — 16 testów warehouse
- [x] WM-06: Aktualizacja dokumentacji
- [x] WM-07: BranchSelector + locationId w API
- [x] WM-08: Redesign wizualny — 18 punktów

### Sesja 25 — shadcn/ui Sidebar
- [x] AppSidebar.tsx, OrdersApp refaktor, dark mode fix, dokumentacja

### Sesja 24 — security fixes + testy
- [x] H-07, H-08, H-01, CR-03 (częściowo). Wynik: 372/372 testów

### Sesja 23 — implementacja OrderView (podgląd A4 z edycją inline)
- [x] Migracja DB (confidentiality_clause), 8 nowych plików order-view/, integracja z drawerem, PreviewUnsavedDialog, fix labeli pakowania

### Sesja 22 — analiza i aktualizacja planu + dokumentacji
- [x] Rozwiązanie 8 rozbieżności, aktualizacja api-plan.md, ui-plan.md, prd.md, order.md. M-12, M-13 DONE.

### Sesja 21 — rozdzielenie pól pojazdu
- [x] vehicleVariantCode → vehicleTypeText + vehicleCapacityVolumeM3 (migracja DB, typy, backend, frontend, testy). M-09 DONE.

### Sesja 20 — audyt 4 agentów
- [x] Zidentyfikowano CR-01..04, H-01..11, M-01..16, L-20..29

### Sesja 19 — fix vehicle variant auto-fill + testy E2E drawera
- [x] Bug fix auto-wypełnienia objętości, 97 testów E2E drawera (tymczasowe)

### Sesja 18 — rozszerzenie audit trail
- [x] 7 faz: wpis "Utworzono zlecenie", śledzenie zmian items/stops, czytelne FK, polskie nazwy pól

### Sesja 17 — sync docs z PRD + READ_ONLY audit
- [x] 6 plików docs naprawionych, READ_ONLY audit 58 komponentów

### Sesja 16 — security audit + MEDIUM fixes
- [x] 20+ fixów: C-01..C-03, H-01..H-10, M-01..M-17
