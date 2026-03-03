# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-03-03 (sesja 24 — security fixes: H-07, H-08, H-01)

---

## Do zrobienia — CRITICAL

### CR-01. Brak testów endpointów API (22 z 24 bez testów)
- **Źródło:** Audyt testów
- **Opis:** Tylko `/auth/me` ma testy. Brak testów dla: orders CRUD, status transitions, lock/unlock, duplicate, prepare-email, history, dictionary endpoints. Handlery zawierają logikę auth guard, walidację UUID, obsługę błędów 403/404/422.
- **Pliki:** `src/pages/api/v1/**/*.ts`

### CR-02. Brak testów middleware (rate limiting, idempotency, CORS)
- **Źródło:** Audyt testów
- **Opis:** `middleware.ts` zawiera rate limiting, idempotency cache, JWT parsing, CORS — zero testów. Scenariusze: rate limit po 100/1000 req/min, cache eviction, OPTIONS preflight, CORS headers.
- **Plik:** `src/middleware.ts`

### ~~CR-03. Brak testów access control (role-based)~~ — CZĘŚCIOWO DONE (sesja 24)
- **Źródło:** Audyt testów
- **Opis:** `requireWriteAccess` i `requireAdmin` nie mają ani jednego testu weryfikującego: READ_ONLY → 403, PLANNER → 403 na admin-only, brak tokenu → 401.
- **Plik:** `src/lib/api-helpers.ts`
- **Status:** 8 testów dodanych w `src/lib/__tests__/access-control.test.ts` (ADMIN ok, PLANNER ok/403, READ_ONLY 403, Content-Type, brak details). Brak tokenu → 401 wymaga testów endpointów (CR-01).

### CR-04. `search_vector` tsvector nigdy nie jest populowany
- **Źródło:** Audyt architektury
- **Opis:** Kolumna `search_vector` z indeksem GIN istnieje w DB, ale żaden trigger ani kod aplikacji jej nie wypełnia. Aplikacja używa `search_text` z `ILIKE` (O(n)). Indeks GIN jest zmarnowany.
- **Plik:** `supabase/migrations/...consolidated_schema.sql:442`
- **Rekomendacja:** Dodaj trigger DB lub usuń nieużywaną kolumnę/indeks.

---

## Do zrobienia — HIGH

### ~~H-NEW-01. Implementacja OrderView (podgląd A4 z edycją inline)~~ — DONE (sesja 23)
- Zrealizowane: migracja DB, 8 nowych plików w order-view/, integracja z drawerem, PreviewUnsavedDialog.

### ~~H-NEW-02. Fix labeli pakowania w CargoSection~~ — DONE (sesja 23)
- Zrealizowane: LOADING_METHODS: Luzem, Bigbag, Paleta, Inne.

### ~~H-01. Brak React Error Boundary~~ — DONE (sesja 24)
- Zrealizowane: `ErrorBoundary` class-based (zero deps), 2-poziomowa integracja:
  - Globalny: `OrdersApp.tsx` (wewnątrz ThemeProvider, na zewnątrz AuthProvider)
  - Drawer: `OrdersPage.tsx` (wokół OrderDrawer z custom fallback)
  - 6 testów w `src/components/ui/__tests__/ErrorBoundary.test.tsx`

### H-02. `order.service.ts` — 2379 linii (god service)
- **Źródło:** Audyt kodu
- **Opis:** Jeden plik zawiera list, detail, create, update, duplicate, email, snapshoty, denormalizacje, change log. Trudno testowalny i nawigowiny.
- **Plik:** `src/lib/services/order.service.ts`
- **Rekomendacja:** Rozbij na: `order-list`, `order-detail`, `order-create`, `order-update`, `order-snapshot`, `order-changelog` services.

### H-03. 7x `(row as any)` w order.service.ts
- **Źródło:** Audyt kodu
- **Opis:** Joiny Supabase (created_by, sent_by, locked_by) dostępne w runtime ale nie w typach TS → `as any`. Ukrywa potencjalne błędy. Tak samo `(supabase as any).rpc()`.
- **Plik:** `src/lib/services/order.service.ts:469-475, 836`
- **Rekomendacja:** Rozszerz `Database` types o custom RPC functions + `type DetailRowWithJoins`.

### H-04. `JSON.stringify` do dirty checking
- **Źródło:** Audyt kodu
- **Opis:** `JSON.stringify(fd) !== JSON.stringify(originalRef.current)` — O(n) na każdym keystroke, niestabilny porządek kluczy.
- **Plik:** `src/components/orders/drawer/OrderForm.tsx:158`
- **Rekomendacja:** Flaga `isDirty = true` przy każdym `patch()` lub shallow compare.

### H-05. Zduplikowane ciało save w OrderDrawer (POST vs PUT)
- **Źródło:** Audyt kodu
- **Opis:** ~30 linii zduplikowanych pól w `handleSave` (create vs update). Zmiana pola wymaga edycji w 2 miejscach.
- **Plik:** `src/components/orders/drawer/OrderDrawer.tsx:230-314`
- **Rekomendacja:** Wydziel `buildSaveBody(formData, isNew)`.

### H-06. Fetch requests bez AbortController w hookach
- **Źródło:** Audyt kodu
- **Opis:** `useOrders` i `useOrderHistory` używają `staleRef` do ignorowania starych zapytań, ale HTTP requests lecą nadal. Brak AbortController → marnowanie bandwidth przy szybkim przełączaniu.
- **Pliki:** `src/hooks/useOrders.ts`, `src/hooks/useOrderHistory.ts`

### ~~H-07. `.env.example` zawiera prawdziwe klucze Supabase~~ — DONE (sesja 24)
- Zrealizowane: Klucze zamienione na placeholdery `<your-anon-key-from-supabase-start>`.
  - 6 testów w `src/test/security/env-example.test.ts` (brak JWT, brak base64, CORS ≠ *).

### ~~H-08. `SECURITY DEFINER` RPC callable przez READ_ONLY~~ — DONE (sesja 24)
- Zrealizowane: Migracja `20260303120000_rpc_role_guard.sql`:
  - `require_write_role()` — reusable helper (sprawdza `user_profiles.role` via `auth.uid()`)
  - `try_lock_order` — guard roli + guard anti-spoofing (`p_user_id != auth.uid()`)
  - `generate_next_order_no` — guard roli
  - errcode `42501` → PostgREST HTTP 403

### H-09. Brak testów hooków React
- **Źródło:** Audyt testów
- **Opis:** Żaden z 4 hooków (`useOrders`, `useOrderDetail`, `useOrderHistory`, `useDictionarySync`) nie ma testu. Zawierają logikę auto-lock, unlock, polling, error handling.
- **Pliki:** `src/hooks/`

### H-10. Brak testów ViewModels (`view-models.ts`)
- **Źródło:** Audyt testów
- **Opis:** ViewModels transformują DTO → dane wyświetlane. Błąd mappingu jest cichy. Zero testów.
- **Plik:** `src/lib/view-models.ts`

### H-11. Brak CI/CD pipeline i pre-commit hooków
- **Źródło:** Audyt testów
- **Opis:** Brak `.github/`, brak husky/lint-staged. Testy uruchamiane tylko ręcznie.

---

## Do zrobienia — MEDIUM

### M-01. DRY: `hasActiveFilters` zduplikowane w 2 plikach
- **Źródło:** Audyt kodu
- **Pliki:** `OrdersPage.tsx:93-103`, `FilterBar.tsx:93-103`
- **Rekomendacja:** Wydziel do `view-models.ts`.

### M-02. DRY: `STATUS_NAMES` zduplikowane w 2 plikach
- **Źródło:** Audyt kodu
- **Pliki:** `OrderRowContextMenu.tsx:29-37`, `StatusSection.tsx:27-35`
- **Rekomendacja:** Wydziel do `view-models.ts`.

### M-03. DRY: status name capitalization powtórzona 2x
- **Źródło:** Audyt kodu
- **Pliki:** `OrderForm.tsx:182-185`, `OrderDrawer.tsx:381-386`
- **Rekomendacja:** Użyj `STATUS_NAMES[code]` zamiast runtime transformacji.

### M-04. Dead code: `SORTABLE_COLUMNS` w OrderTable.tsx
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/OrderTable.tsx:37-42`

### M-05. Identity mapping `TRANSPORT_CODE_DISPLAY` — do usunięcia
- **Źródło:** Audyt kodu
- **Pliki:** `OrderRow.tsx:22-27`, `FilterBar.tsx:25-27`
- **Rekomendacja:** Użyj `order.transportTypeCode` bezpośrednio.

### M-06. `OrderDrawer.tsx` — 742 linii, za dużo odpowiedzialności
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/drawer/OrderDrawer.tsx`
- **Rekomendacja:** Wydziel `useOrderDrawer(orderId, isOpen)` hook. (Powiązane z D-05)
- **Uwaga:** Rozrosło się z 508→742 linii po dodaniu logiki OrderView (sesja 23)

### M-07. `OrdersPage.tsx` — 433 linii, powtarzalne handlery
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/OrdersPage.tsx`
- **Rekomendacja:** Wydziel `useOrderActions()` hook lub helper `try/catch/toast/refetch`.

### M-08. `TimeCombobox` nie wydzielony z RoutePointCard
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/drawer/RoutePointCard.tsx:36-203`
- **Rekomendacja:** Wydziel do `components/orders/drawer/TimeCombobox.tsx`.

### M-09. ~~`createEmptyDetail()` zawiera `vehicleVariantCode`~~ — DONE (sesja 21)
- Naprawione: zamienione na `vehicleTypeText` + `vehicleCapacityVolumeM3` zgodne z `OrderDetailDto`.

### M-10. Brak CORS headers na odpowiedzi 429 (rate limit)
- **Źródło:** Audyt bezpieczeństwa
- **Plik:** `src/middleware.ts:153`
- **Rekomendacja:** Dodaj CORS headers do odpowiedzi 429.

### M-11. Brak limitu rozmiaru request body
- **Źródło:** Audyt bezpieczeństwa
- **Plik:** `src/lib/api-helpers.ts:158-164` (`parseJsonBody`)
- **Rekomendacja:** Reject bodies > 1MB via `Content-Length` check.

### ~~M-12. `vehicle_variant_code` — schema drift po migracji decouple~~ — DONE (sesja 22)
- Naprawione: `api-plan.md` zaktualizowany (`vehicleVariantCode` → `vehicleTypeText` + `vehicleCapacityVolumeM3`).
- Dokumentacja `prd.md`, `order.md`, `ui-plan.md` również zaktualizowana.

### ~~M-13. `entry-fixed.ts` endpoint nieudokumentowany~~ — DONE (sesja 22)
- Naprawione: Dodano sekcję `2.10b` w `api-plan.md` dokumentującą `PATCH /orders/{orderId}/entry-fixed`.

### M-14. Brak health check endpoint
- **Źródło:** Audyt architektury
- **Rekomendacja:** Dodaj `GET /api/v1/health` sprawdzający DB connectivity.

### M-15. Brak coverage konfiguracji w vitest.config.ts
- **Źródło:** Audyt testów
- **Opis:** Nie można zobaczyć % pokrycia. Brak reporters, brak testTimeout.
- **Plik:** `vitest.config.ts`

### M-16. Brak testów komponentów React (64+ pliki, 0 testów)
- **Źródło:** Audyt testów
- **Opis:** OrderRow, OrdersTable, StatusBadge, FilterBar — zero testów poza tymczasowymi drawer-e2e.

---

## Do zrobienia — LOW

### L-01. Lock możliwy na anulowanych/zrealizowanych
- **Plik:** `order-lock.service.ts`
- **Potwierdzone przez:** Audyt architektury (L-01), audyt bezpieczeństwa

### L-02. Brak paginacji w endpointach słownikowych
- **Pliki:** companies, locations, products
- **Potwierdzone przez:** Audyt architektury (L-02)

### L-04. buildSnapshotsForCarrier nie pobiera address/location name
- **Plik:** `order.service.ts:524-543`

### L-10. Unsafe type casts w api-client.ts

### L-11. week-utils.ts regex fałszywie akceptuje format

### L-15. Brak testów: postRaw Accept header + AbortController timeout

### L-17. JWT bez weryfikacji podpisu w `extractSubFromJwt`
- **Plik:** `middleware.ts:92-103`
- **Potwierdzone przez:** Audyt bezpieczeństwa (H-03), audyt architektury (M-05)
- **Dodatkowy kontekst:** Atakujący może sfałszować JWT z `sub` ofiary → wyczerpanie rate limit ofiary (429). Sam auth jest bezpieczny (Supabase weryfikuje server-side).

### L-18. Brak `dark:` na etykietach w CarrierSection i EmptyState

### L-19. `span[role=button]` bez obsługi Space w AutocompleteField

### L-20. Puste `catch {}` bez komentarza w wielu miejscach
- **Źródło:** Audyt kodu
- **Pliki:** `OrderDrawer.tsx:148,195`, `AuthContext.tsx:110`, `api-client.ts:175,185`
- **Rekomendacja:** Dodaj komentarze wyjaśniające dlaczego catch jest pusty.

### L-21. `key={idx}` na liście items w OrderRow — brak stabilnego klucza
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/OrderRow.tsx:193-194`

### L-22. Timezone w `TimelineEntry.tsx` — `new Date(iso)` zależy od przeglądarki
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/history/TimelineEntry.tsx:31-35`

### L-23. Brak `aria-label` na paginacji
- **Źródło:** Audyt kodu
- **Plik:** `src/components/orders/OrdersPage.tsx:364-383`

### L-24. `@types/react` i `@types/react-dom` w dependencies zamiast devDependencies
- **Źródło:** Audyt kodu
- **Plik:** `package.json:25-26`

### L-25. Brak `Cache-Control: no-store` na wrażliwych API responses
- **Źródło:** Audyt bezpieczeństwa
- **Plik:** `src/lib/api-helpers.ts:94-98`

### L-26. Brak `Permissions-Policy` header
- **Źródło:** Audyt bezpieczeństwa
- **Plik:** `src/lib/api-helpers.ts:25`
- **Rekomendacja:** Dodaj `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### L-27. CORS config zduplikowany w 2 plikach
- **Źródło:** Audyt architektury
- **Pliki:** `src/lib/api-helpers.ts:27`, `src/middleware.ts:134`

### L-28. Brak dokumentacji strategii migracji DB
- **Źródło:** Audyt architektury

### L-29. Verbose `console.error` w API routes — brak structured logging
- **Źródło:** Audyt bezpieczeństwa (M-05), audyt kodu (L-01), audyt architektury (M-04)
- **Opis:** 21 wystąpień `console.error` bez structured JSON, request ID, log levels. Akceptowalne dla MVP.

---

## Do weryfikacji

### V-01. L-16: listOrders 5 filtrów — prawdopodobnie ZROBIONE
- **Źródło:** Audyt architektury (H-04)
- **Opis:** Arch-analyst znalazł, że filtry `productId`, `loadingLocationId`, `loadingCompanyId`, `unloadingLocationId`, `unloadingCompanyId` SĄ zaimplementowane (sub-queries na liniach 162-258 w `order.service.ts`). Komentarz na liniach 118-119 jest prawdopodobnie stary.
- **Akcja:** Zweryfikuj ręcznie i przenieś do "Zrobione" jeśli potwierdzone.

---

## Odroczone (user decision: zostawić)

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).
- W przyszłości będzie powiązany z widokiem z order.md.
- **Potwierdzone przez:** Audyt architektury (H-01) — PRD wymaga jako MVP feature.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Czysto refaktoringowa zmiana (~290 linii logiki → osobny hook). Nie zmienia funkcjonalności.
- **User decyzja**: zostawić na później.
- **Powiązane:** M-06 (OrderDrawer 508 linii)

### D-06. Dictionary sync endpoints — stuby
- **Źródło:** Audyt architektury (H-02)
- **Opis:** `POST /dictionary-sync/run` i `GET /jobs/{id}` zwracają mock responses. Oczekiwane dla MVP bez integracji ERP.

### D-07. Job czyszczący anulowane zlecenia po 24h
- **Źródło:** Audyt architektury (H-03), wcześniej M-17
- **Opis:** PRD wymaga usunięcia anulowanych po 24h. Wymaga `pg_cron` (infrastructure).

---

## Zrobione

### Sesja 16 — security audit + MEDIUM fixes
- [x] C-01: Rename `SUPABASE_KEY` → `SUPABASE_ANON_KEY`
- [x] C-02: Obsługa `READONLY`/`FORBIDDEN_EDIT` w patchStop endpoint
- [x] C-03: Unlock przed refetch w OrderDrawer
- [x] H-01: Idempotency cache — tylko 2xx cachowane (zabezpieczenie przed replay)
- [x] H-02: `unlockOrder` — atomic UPDATE z `.eq("locked_by_user_id", userId)`
- [x] H-03: `prepareEmailForOrder` — TOCTOU guard `.eq("status_code", ...)` + `STATUS_CHANGED` error
- [x] H-04: `Cache-Control: private` na companies, locations, products
- [x] H-05: `duplicateOrder` — wpis do `order_status_history`
- [x] H-06: `vehicleVariantCode` = `null` zamiast `""`
- [x] H-07: OrderForm reset na `[order.id, order.updatedAt]`
- [x] H-08: `SheetTitle`/`SheetDescription` sr-only w HistoryPanel
- [x] H-09: `tokenRef` zamiast `useState` w AuthContext — stabilny `api`
- [x] H-10: `carrier_cell_color` dodane do `database.types.ts`
- [x] M-01: `changeStatus` czyści `complaint_reason` przy wyjściu ze statusu reklamacja
- [x] M-02: `updatedAt` w odpowiedzi PUT teraz z DB (SELECT po UPDATE)
- [x] M-03: Walidacja `dateFrom <= dateTo` w `orderListQuerySchema` (.refine)
- [x] M-04: `patchStop` waliduje kolejność trasy przy zmianie kind (INVALID_ROUTE_ORDER)
- [x] M-05: `/duplicate` obsługuje `FK_VALIDATION` → HTTP 422
- [x] M-06: won't fix — in-memory rate limiter OK dla MVP
- [x] M-07 (sort): `order_seq_no INT` + trigger + indeks (sortowanie numeryczne)
- [x] M-07 (DnD): `sortableIds`/`activeStops` → `useMemo` + pełne deps w `handleDragEnd`
- [x] M-08: CarrierSection `useEffect` synchronizuje stan pojazdu przy zmianie zlecenia
- [x] M-09 (filter): won't fix — filtr tygodniowy po dacie załadunku by design
- [x] M-09 (finance): Fallback `"Przelew"` usunięty — null → pusty placeholder
- [x] M-10: RouteSummaryCell sortuje po `sequenceNo` (obsługuje mieszane trasy)
- [x] M-11: StatusSection — powód reklamacji readonly gdy aktualny status=reklamacja, wymagany tylko przy pendingStatus=reklamacja
- [x] M-12: `vehicle_variant_code: string | null` w database.types.ts (Row/Insert/Update)
- [x] M-13: won't fix — `orderNo` w UpdateOrderResponseDto jest przydatne, docs update minor
- [x] M-14: won't fix — auto-waluta frontend-only OK dla MVP
- [x] M-15: już naprawione — `prepare-email` aktualizuje `main_product_name` (kod weryfikuje)
- [x] M-16: deferred — FilterBar filtr po lokalizacji to feature work
- [x] M-17: deferred → przeniesione do D-07

### Sesja 17 — sync docs z PRD + READ_ONLY audit
- [x] Sync dokumentacji .ai/ z PRD jako źródłem prawdy (6 plików naprawionych, 1 usunięty)
  - drawer-ui-architecture.md: renumeracja sekcji 1-7 → 0-6, generalNotes 1000→500
  - orders-view-implementation-plan.md: tła wierszy, daty DD.MM, generalNotes, vehicle 2 pola, StatusBadge lowercase + display names
  - view-implementation-plan.md: reklamacja dozwolona z korekta
  - order.md: packagingType → loading_method_code
  - db-plan.md: dodano order_seq_no + carrier_cell_color
  - ui-architecture-summary.md: usunięty (przestarzały)
- [x] vehicleVariantCode → 2 osobne pola (Typ auta + Objętość m³) w walidacji orders-view-implementation-plan.md
- [x] READ_ONLY audit: 58 komponentów sprawdzonych, wszystkie akcje chronione
  - StatusSection.tsx: dodano defensywny prop `isReadOnly`
- [x] L-20: order_seq_no i carrier_cell_color udokumentowane w db-plan

### Sesja 18 — rozszerzenie audit trail
- [x] Faza 1: Wpis "Utworzono zlecenie" (`order_created`) w `createOrder()` — `order.service.ts`
- [x] Faza 2: Śledzenie zmian pozycji towarowych (dodawanie/usuwanie/edycja pól) w `updateOrder()` — `order.service.ts`
- [x] Faza 3: Śledzenie dodawania/usuwania przystanków w `updateOrder()` — `order.service.ts`
- [x] Faza 4: Czytelne wartości FK (nazwy firm zamiast UUID) w `updateOrder()` i `patchStop()` — `order.service.ts`
- [x] Faza 5: Mapa polskich nazw pól — NOWY plik `src/lib/field-labels.ts`
- [x] Faza 6: Polskie etykiety + nowe typy wpisów (stop/item added/removed) w `TimelineEntry.tsx`
- [x] Faza 7: Rozpoznawanie `order_created` w `HistoryPanel.tsx`

### Sesja 23 — implementacja OrderView (podgląd A4 z edycją inline)
- [x] Faza 0a: Migracja DB — `confidentiality_clause` (ALTER TABLE)
- [x] Faza 0b: `confidentialityClause` dodane do: types.ts, view-models.ts, order.validator.ts, order.service.ts (5 miejsc), OrderForm.tsx, OrderDrawer.tsx
- [x] Faza 1-3: 8 nowych plików w `src/components/orders/order-view/`:
  - types.ts (interfejsy + mappery formDataToViewData/viewDataToFormData)
  - constants.ts (stałe, limity, helpery, LOGO_BASE64)
  - inline-editors.tsx (EditableText, EditableNumber, EditableTextarea)
  - autocompletes.tsx (6 komponentów autocomplete)
  - date-time-pickers.tsx (TimePickerPopover, DatePickerPopover)
  - StopRows.tsx (DnD stop rows z ograniczeniami)
  - OrderDocument.tsx (pełny layout A4 z ResizeObserver zoom)
  - OrderView.tsx (kontener z toolbarem, dirty detection, keyboard shortcuts)
- [x] Faza 4: Integracja z drawerem:
  - DrawerFooter: `onGeneratePdf` → `onShowPreview` + ikona Eye + label "Podgląd"
  - PreviewUnsavedDialog.tsx (nowy: 3 opcje — Zapisz/Odrzuć/Anuluj)
  - OrderForm: nowy prop `formDataRef` do udostępniania stanu
  - OrderDrawer: dynamiczna szerokość Sheet (80vw), stany OrderView, saveToApi helper, handlery podglądu
- [x] Faza 5: Fix labeli pakowania w CargoSection (Luzem, Bigbag, Paleta, Inne)
- [x] Faza 6: Weryfikacja — 0 błędów TS, build OK
- [x] Aktualizacja testów drawer-e2e (onShowPreview, confidentialityClause)

### Sesja 24 — security fixes (H-07, H-08, H-01) + testy
- [x] H-07: `.env.example` — klucze zamienione na placeholdery + 6 testów bezpieczeństwa
- [x] H-08: Migracja RPC role guard (`require_write_role()`, anti-spoofing w `try_lock_order`)
- [x] H-01: ErrorBoundary class-based (zero deps) + 2-poziomowa integracja (global + drawer) + 6 testów
- [x] CR-03 (częściowo): 8 testów access-control (`requireWriteAccess` + `requireAdmin`)
- [x] Wynik: 372/372 testów, 0 błędów TypeScript

### Sesja 22 — analiza i aktualizacja planu ORDER-implementation-plan + dokumentacji
- [x] Analiza ORDER-implementation-plan.md vs prototyp, codebase, dokumentacja (3 agenty równolegle)
- [x] Rozwiązanie 8 rozbieżności przez Q&A z użytkownikiem
- [x] Fix sequenceNo w planie: per-kind → globalny (jak drawer/prototyp)
- [x] Klauzula poufności: zmiana z lokalnej edycji → pole w DB + API
- [x] Dodanie brakujących elementów: scoped styles, TIME_SLOTS, layout constants, helper functions, null→"" konwersja
- [x] Aktualizacja `api-plan.md`: vehicleVariantCode → vehicleTypeText + vehicleCapacityVolumeM3, confidentialityClause, entry-fixed endpoint
- [x] Aktualizacja `ui-plan.md`: nowa sekcja 2.3a OrderView, przepływ 3.7 OrderView
- [x] Aktualizacja `prd.md`: packaging labels (luzem/bigbag/paleta/inne), vehicle fields (decoupled), sekcja 3.1.5b OrderView, confidentialityClause, przycisk Podgląd
- [x] Aktualizacja `order.md`: szerokość 80vw, responsywne skalowanie, vehicleTypeText, packaging labels, przycisk Generuj PDF w toolbarze
- [x] Oznaczenie M-12 i M-13 jako DONE

### Sesja 21 — rozdzielenie pól pojazdu (vehicleVariantCode → 2 niezależne pola)
- [x] Migracja DB: nowe kolumny `vehicle_type_text` + `vehicle_capacity_volume_m3`, drop FK constraint
- [x] Typy DTO: `OrderListItemDto.vehicleTypeText` (zamiast vehicleVariantCode + vehicleVariantName), `OrderDetailDto.vehicleTypeText` + `vehicleCapacityVolumeM3`
- [x] ViewModel: `OrderFormData.vehicleTypeText` + `vehicleCapacityVolumeM3` (zamiast vehicleVariantCode)
- [x] Validator: `createOrderSchema` + `updateOrderSchema` — nowe pola Zod
- [x] Backend: order.service.ts — 12 miejsc zmienione (mapRowToOrderListItemDto, selectColumns, getOrderDetail, validateForeignKeys, createOrder, updateOrder, duplicateOrder, businessFieldMap)
- [x] Frontend: CarrierSection uproszczone (usunięto useState/useEffect/useRef, bezpośrednie bindowanie do formData)
- [x] Frontend: OrderDrawer, OrderForm, OrderRow, OrdersPage — nowe pola
- [x] field-labels.ts: vehicle_type_text + historyczny fallback vehicle_variant_code
- [x] Testy: 352/352 pass, 0 błędów TS
- [x] seed.sql: UPDATE uzupełniający nowe kolumny z vehicle_variants

### Sesja 20 — audyt 4 agentów: security, code quality, architecture, test coverage
- [x] (patrz sekcja "Do zrobienia" powyżej — wpisy CR-01..04, H-01..11, M-01..16, L-20..29)

### Sesja 19 — fix vehicle variant auto-fill + testy E2E drawera
- [x] Bug fix: auto-wypełnienie objętości przy wyborze typu auta w `CarrierSection.tsx`
  - Root cause: vehicleType/volume to local state, vehicleVariantCode (exact match) jedyny w formData
  - Fix: `handleVehicleTypeChange` → gdy 1 wariant dla typu → auto-fill volume + ustaw vehicleVariantCode
- [x] Testy E2E drawera (tymczasowe, do usunięcia): 97 testów w `src/test/drawer-e2e/`
  - `drawer-buttons.test.tsx`: 61 testów interaktywnych elementów drawera
  - `drawer-roundtrip.test.tsx`: 8 testów save→close→reopen→verify
  - `drawer-history.test.tsx`: 28 testów panelu historii zmian
- [x] Fix stabilnych referencji mocków (`vi.hoisted()` w roundtrip tests)
- [x] Fix typów TS w `drawer-buttons.test.tsx` (CompanyDto.type/notes, LocationDto fields)
