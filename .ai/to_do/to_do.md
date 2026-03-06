# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-03-05 (sesja 33 — H-02 DONE: rozbicie order.service.ts na 6 sub-serwisów)

---

## Do zrobienia — HIGH

### CR-01. Brak testów endpointów API — pozostałe (3 z 24)
- **Status:** 136 testów w 10 plikach pokrywają: orders CRUD, status, lock/unlock, duplicate, prepare-email, restore, warehouse, stops, carrier-color, entry-fixed.
- **Pozostało:** history/status, history/changes (LOW), 5 słownikowych (POMIŃ)
- **Pliki z testami:** `src/pages/api/v1/orders/__tests__/`, `src/pages/api/v1/orders/[orderId]/__tests__/`

### H-11. Brak CI/CD pipeline i pre-commit hooków
- **Źródło:** Audyt testów
- **Opis:** Brak `.github/`, brak husky/lint-staged. Testy uruchamiane tylko ręcznie.

---

## Do zrobienia — MEDIUM

### M-01. DRY: `hasActiveFilters` zduplikowane w 2 plikach
- **Pliki:** `OrdersPage.tsx:93-103`, `FilterBar.tsx:93-103`
- **Rekomendacja:** Wydziel do `view-models.ts`.

### M-02. DRY: `STATUS_NAMES` zduplikowane w 2 plikach
- **Pliki:** `OrderRowContextMenu.tsx:29-37`, `StatusSection.tsx:27-35`
- **Rekomendacja:** Wydziel do `view-models.ts`.

### M-03. DRY: status name capitalization powtórzona 2x
- **Pliki:** `OrderForm.tsx:182-185`, `OrderDrawer.tsx:381-386`
- **Rekomendacja:** Użyj `STATUS_NAMES[code]` zamiast runtime transformacji.

### M-04. Dead code: `SORTABLE_COLUMNS` w OrderTable.tsx
- **Plik:** `src/components/orders/OrderTable.tsx:37-42`

### M-05. Identity mapping `TRANSPORT_CODE_DISPLAY` — do usunięcia
- **Pliki:** `OrderRow.tsx:22-27`, `FilterBar.tsx:25-27`
- **Rekomendacja:** Użyj `order.transportTypeCode` bezpośrednio.

### M-06. `OrderDrawer.tsx` — 742 linii, za dużo odpowiedzialności
- **Plik:** `src/components/orders/drawer/OrderDrawer.tsx`
- **Rekomendacja:** Wydziel `useOrderDrawer(orderId, isOpen)` hook. (Powiązane z D-05)

### M-07. `OrdersPage.tsx` — 433 linii, powtarzalne handlery
- **Plik:** `src/components/orders/OrdersPage.tsx`
- **Rekomendacja:** Wydziel `useOrderActions()` hook lub helper `try/catch/toast/refetch`.

### M-08. `TimeCombobox` nie wydzielony z RoutePointCard
- **Plik:** `src/components/orders/drawer/RoutePointCard.tsx:36-203`
- **Rekomendacja:** Wydziel do `components/orders/drawer/TimeCombobox.tsx`.

### M-10. Brak CORS headers na odpowiedzi 429 (rate limit)
- **Plik:** `src/middleware.ts:153`
- **Rekomendacja:** Dodaj CORS headers do odpowiedzi 429.

### M-11. Brak limitu rozmiaru request body
- **Plik:** `src/lib/api-helpers.ts:158-164` (`parseJsonBody`)
- **Rekomendacja:** Reject bodies > 1MB via `Content-Length` check.

### M-NEW-01. Rozbieżności dokumentacji wykryte w audycie sesji 30 (18 pozycji)
- **Opis:** 10 brakujących + 8 nieaktualnych informacji w docs:
  - **db-plan.md**: brak `is_entry_fixed`, `confidentiality_clause`; stary FK `vehicle_variant_code`
  - **prd.md §3.2.1**: mówi "brak selektora oddziałów" (jest BranchSelector); brak `locationId` w API
  - **ui-plan.md**: stary opis vehicleVariantCode w drawerze; brak BranchSelector/OperationLegend; AppHeader nie deprecated; brak `/warehouse` w mapowaniu tras
  - **widok-magazyn-specyfikacja.md**: "5 kolumn awizacji" i "Sekcja 7" w dwóch miejscach
  - **api-plan.md**: brak `locationId` w warehouse; brak `carrierCellColor`/`isEntryFixed`/`mainProductName` w sekcji 2.2; `weekEnd` niedziela vs piątek; brak `kind` w PATCH stop
- **Rekomendacja:** Jednorazowa sesja aktualizacji 5 plików docs.

### ~~NEW-04.~~ (DONE — sesja 32, wchłonięte do CR-01)

### NEW-05. `makeContext()` zduplikowany w 7 plikach testowych API
- **Opis:** Każdy plik testowy endpointów definiuje własny `makeContext()` (~30 linii boilerplate). Wydzielić do `src/test/helpers/api-context.ts`.

### M-14. Brak health check endpoint
- **Rekomendacja:** Dodaj `GET /api/v1/health` sprawdzający DB connectivity.

### M-15. Brak coverage konfiguracji w vitest.config.ts
- **Opis:** Nie można zobaczyć % pokrycia. Brak reporters, brak testTimeout.
- **Plik:** `vitest.config.ts`

### M-16. Brak testów komponentów React (64+ pliki, 0 testów)
- **Opis:** OrderRow, OrdersTable, StatusBadge, FilterBar — zero testów poza tymczasowymi drawer-e2e.

---

## Do zrobienia — LOW

### CR-04. `search_vector` tsvector nigdy nie jest populowany
- **Opis:** Kolumna `search_vector` z indeksem GIN istnieje w DB, ale żaden trigger ani kod aplikacji jej nie wypełnia.
- **Plik:** `supabase/migrations/...consolidated_schema.sql:442`
- **Rekomendacja:** Dodaj trigger DB lub usuń nieużywaną kolumnę/indeks.

### L-01. Lock możliwy na anulowanych/zrealizowanych
- **Plik:** `order-lock.service.ts`

### L-02. Brak paginacji w endpointach słownikowych
- **Pliki:** companies, locations, products

### L-04. buildSnapshotsForCarrier nie pobiera address/location name
- **Plik:** `order-snapshot.service.ts` (funkcja `buildSnapshotsForCarrier`)

### L-10. Unsafe type casts w api-client.ts

### L-11. week-utils.ts regex fałszywie akceptuje format

### L-15. Brak testów: postRaw Accept header + AbortController timeout

### L-17. JWT bez weryfikacji podpisu w `extractSubFromJwt`
- **Plik:** `middleware.ts:92-103`
- **Dodatkowy kontekst:** Atakujący może sfałszować JWT z `sub` ofiary → wyczerpanie rate limit ofiary (429). Sam auth jest bezpieczny (Supabase weryfikuje server-side).

### L-18. Brak `dark:` na etykietach w CarrierSection i EmptyState

### L-19. `span[role=button]` bez obsługi Space w AutocompleteField

### L-20. Puste `catch {}` bez komentarza w wielu miejscach
- **Pliki:** `OrderDrawer.tsx:148,195`, `AuthContext.tsx:110`, `api-client.ts:175,185`
- **Rekomendacja:** Dodaj komentarze wyjaśniające dlaczego catch jest pusty.

### L-21. `key={idx}` na liście items w OrderRow — brak stabilnego klucza
- **Plik:** `src/components/orders/OrderRow.tsx:193-194`

### L-22. Timezone w `TimelineEntry.tsx` — `new Date(iso)` zależy od przeglądarki
- **Plik:** `src/components/orders/history/TimelineEntry.tsx:31-35`

### L-23. Brak `aria-label` na paginacji
- **Plik:** `src/components/orders/OrdersPage.tsx:364-383`

### L-24. `@types/react` i `@types/react-dom` w dependencies zamiast devDependencies
- **Plik:** `package.json:25-26`

### L-25. Brak `Cache-Control: no-store` na wrażliwych API responses
- **Plik:** `src/lib/api-helpers.ts:94-98`

### L-26. Brak `Permissions-Policy` header
- **Plik:** `src/lib/api-helpers.ts:25`
- **Rekomendacja:** Dodaj `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### L-27. CORS config zduplikowany w 2 plikach
- **Pliki:** `src/lib/api-helpers.ts:27`, `src/middleware.ts:134`

### L-28. Brak dokumentacji strategii migracji DB

### L-29. Verbose `console.error` w API routes — brak structured logging
- **Opis:** 21 wystąpień `console.error` bez structured JSON, request ID, log levels. Akceptowalne dla MVP.

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

---

## Zrobione

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
