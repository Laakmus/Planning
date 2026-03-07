# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-03-07 (sesja 39 — weryfikacja bugów + fixy PDF/RPC)

---

## Do zrobienia — HIGH

(brak — wszystkie oryginalne HIGH obniżone do MEDIUM po weryfikacji)

---

## Do zrobienia — MEDIUM

### M-04. Audit trail numeracja items — pozycyjne matchowanie
- **Kategoria:** bug
- **Pliki:** `src/lib/services/order-update.service.ts:453-537`
- **Opis:** `auditItemNum` jest inkrementowany pozycyjnie, `.find((_s, idx) => idx === auditItemNum - 1)` to de facto indeksowanie. Gdy usuniesz item ze środka listy, audit log pokaże złą nazwę produktu dla pozostałych pozycji.
- **Sugerowany fix:** Użyć mapy product snapshots wg item ID zamiast pozycyjnego matchowania.
- **Effort:** S





### M-14. useOrderActions brak testów
- **Kategoria:** test
- **Pliki:** `src/hooks/useOrderActions.ts`
- **Opis:** Hook z 10 krytycznymi handlerami (tworzenie, wysyłka, zmiana statusu, anulowanie, duplikacja) nie ma żadnych testów.
- **Sugerowany fix:** Dodać testy RTL (renderHook) dla każdego handlera: happy path + error path.
- **Effort:** L

### M-15. useOrderDrawer brak testów
- **Kategoria:** test
- **Pliki:** `src/hooks/useOrderDrawer.ts`
- **Opis:** Najbardziej złożony hook (654 linii) — lock/unlock, zapis, PDF, email, dialog niezapisanych — bez unit testów.
- **Sugerowany fix:** Dodać testy: loadDetail, handleSave (create vs update), handleCloseRequest z isDirty, doClose z unlock.
- **Effort:** L

### M-16. order-snapshot.service czyste funkcje bez testów
- **Kategoria:** test
- **Pliki:** `src/lib/services/order-snapshot.service.ts`
- **Opis:** computeDenormalizedFields, buildSearchText, autoSetDocumentsAndCurrency — czyste funkcje idealne do testów, a nie mają dedykowanych testów.
- **Sugerowany fix:** Dodać testy: puste stops/items, null country, null dateLocal, każdy typ transportu.
- **Effort:** M

### M-17. PDF moduł bez testów
- **Kategoria:** test
- **Pliki:** `src/lib/services/pdf/pdf-generator.service.ts`, `src/lib/services/pdf/pdf-sections.ts`, `src/lib/services/pdf/pdf-layout.ts`
- **Opis:** Cały nowy moduł PDF (generator, sections, layout, fonts) nie ma żadnych testów. Endpoint pdf.ts też nie.
- **Sugerowany fix:** Testy: generateOrderPdf z minimalnym input → zwraca Buffer. Test endpointu: 400 invalid UUID, 404 not found, 200 content-type.
- **Effort:** M

### M-18. Endpointy słownikowe bez testów
- **Kategoria:** test
- **Pliki:** `src/pages/api/v1/companies.ts`, `locations.ts`, `products.ts`, `transport-types.ts`, `vehicle-variants.ts`, `order-statuses.ts`, `health.ts`
- **Opis:** 7 endpointów słownikowych nie ma żadnych testów (200 OK, 401 unauth, 500 DB error, parametr search).
- **Sugerowany fix:** Dodać testy dla każdego: happy path + error path + parametry.
- **Effort:** M

### M-19. updateOrder audit trail i items/stops CRUD brak testów
- **Kategoria:** test
- **Pliki:** `src/lib/services/__tests__/order.service.test.ts`
- **Opis:** Brak testów: logowanie zmian pól biznesowych (change_log), items CRUD (insert/update/delete), stops CRUD (delete _deleted, insert new, update existing z temporary offset). 280 linii logiki bez pokrycia.
- **Sugerowany fix:** Testy weryfikujące insert do order_change_log z poprawnymi field_name/old_value/new_value. Stops/items z mixem _deleted, nowych i istniejących.
- **Effort:** L

### M-20. database.types.ts nieaktualny — brakuje kolumn
- **Kategoria:** architecture
- **Pliki:** `src/db/database.types.ts`
- **Opis:** Brakuje: `notification_details`, `confidentiality_clause` (transport_orders), `location_id` (user_profiles). Zawiera usuniętą FK `vehicle_variant_code_fkey`. Root cause `as any` castów w auth.service i warehouse.service.
- **Sugerowany fix:** Uruchomić `npx supabase gen types typescript --local > src/db/database.types.ts`. Po regeneracji usunąć zbędne `as any` casts.
- **Effort:** S

### L-03. Aktualizacja PRD i docs — 13 rozbieżności
- **Kategoria:** docs
- **Pliki:** `.ai/prd.md`, `.ai/api-plan.md`, `.ai/ui-plan.md`, `.ai/db-plan.md`
- **Opis:** Nieaktualne fragmenty dokumentacji: (1) PRD: carrier bez kontaktu (świadoma decyzja), ikona email w wierszu, historia zmian w stopce, kolory per zakładka, sposoby załadunku, layout CarrierSection 2→3 wiersze, brak kolumny Fix, format daty wysłania, bg-emerald wartość. (2) api-plan: duplicate "(etap 2)". (3) ui-plan: "dwa stany" → trzy trasy, AppHeader dead code opis. (4) db-plan: vehicle_type_text varchar(200) vs 100, order_seq_no NOT NULL vs nullable.
- **Sugerowany fix:** Jednorazowa aktualizacja 4 plików docs.
- **Effort:** M

### L-04. A11y improvements — aria-label, scope, role
- **Kategoria:** a11y
- **Pliki:** `FilterBar.tsx`, `ListSettings.tsx`, `OrderDrawer.tsx`, `RoutePointCard.tsx`, `OrderTable.tsx`
- **Opis:** (1) Przełącznik Trasa/Kolumny bez role="group" i aria-pressed. (2) Przycisk X drawera bez aria-label. (3) Przyciski "Usuń punkt" bez aria-label. (4) `<th>` bez scope="col".
- **Sugerowany fix:** Dodać brakujące atrybuty ARIA i scope.
- **Effort:** S

### L-05. Frontend performance — React.memo, useCallback
- **Kategoria:** performance
- **Pliki:** `src/components/orders/OrderRow.tsx`, `src/components/orders/OrdersPage.tsx`
- **Opis:** OrderRow bez React.memo (re-render 200 wierszy). Handlery filtrów bez useCallback (nowe referencje).
- **Sugerowany fix:** React.memo na OrderRow, useCallback na handlery w OrdersPage. Profilować przed wdrożeniem.
- **Effort:** S

### L-06. FilterBar debounce cleanup przy unmount
- **Kategoria:** bug
- **Pliki:** `src/components/orders/FilterBar.tsx:57-58`
- **Opis:** searchDebounceRef i weekDebounceRef nie czyszczone w useEffect cleanup. Timeout może się wykonać po unmount.
- **Sugerowany fix:** Dodać useEffect cleanup: `clearTimeout(searchDebounceRef.current)`.
- **Effort:** S

### L-07. CargoSection key={idx} → stabilny key
- **Kategoria:** bug
- **Pliki:** `src/components/orders/drawer/CargoSection.tsx:92-93`
- **Opis:** Pozycje towarowe mają `key={idx}`. Usunięcie ze środka listy może pomylić React state.
- **Sugerowany fix:** Użyć item.id lub generować tymczasowy UUID przy addItem.
- **Effort:** S

### L-08. Frontend drobne UX
- **Kategoria:** ux
- **Pliki:** `RoutePointCard.tsx`, `OrderDrawer.tsx`, `useWarehouseWeek.ts`, `FinanceSection.tsx`
- **Opis:** (1) Firma w RoutePointCard wyszukiwana po nazwie zamiast UUID. (2) onInteractOutside preventDefault — brak animacji zamknięcia gdy !isDirty. (3) Non-atomic week/year state (2 setState, React batching łagodzi). (4) "Forma płatności" bez opcji pustej.
- **Sugerowany fix:** Indywidualne fixy per punkt.
- **Effort:** M

### L-09. Frontend minor
- **Kategoria:** ux
- **Pliki:** `TimeCombobox.tsx`, `LockIndicator.tsx`, `StatusFooter.tsx`, `OrderRowContextMenu.tsx`
- **Opis:** (1) TimeCombobox globalny document.querySelector. (2) LockIndicator zagnieżdżony TooltipProvider. (3) StatusFooter "System Status: OK" hardcoded. (4) "Anuluj zlecenie" widoczne dla zrealizowanych (backend blokuje). (5) useOrders aborted check może ukryć błąd sieciowy (edge case). (6) Brak auto-set dokumentów/waluty we frontendzie przy zmianie transportTypeCode.
- **Sugerowany fix:** Indywidualne fixy per punkt. Priorytet niski.
- **Effort:** M

### L-10. Backend minor bugs
- **Kategoria:** bug
- **Pliki:** `order-misc.service.ts:393`, `order-snapshot.service.ts:241`, `order-update.service.ts:240`, `warehouse.service.ts:148`
- **Opis:** (1) updateEntryFixed nie sprawdza błędu insertu do change_log. (2) autoSetDocumentsAndCurrency nigdy nie zmienia currencyCode — mylący komentarz. (3) updateOrder nie wywołuje autoSet przy zmianie transportTypeCode. (4) Warehouse stopy bez daty — brak limitu (obniżone z MEDIUM).
- **Sugerowany fix:** (1) Dodać `{ error }` destructuring + throw. (2) Poprawić komentarz lub zaimplementować. (3/4) Rozważyć implementację.
- **Effort:** S

### L-11. Backend minor — performance i edge cases
- **Kategoria:** performance
- **Pliki:** `order-update.service.ts:600`, `api-helpers.ts:24`, `order.validator.ts:143`, `companies.ts:26`
- **Opis:** (1) resolveFkName w pętli — cache old FK names. (2) CORS origin cached at import — OK w praktyce. (3) Zod .max(11) na stops liczy deleted. (4) Companies 1h cache stale data.
- **Sugerowany fix:** Indywidualne fixy. Niski priorytet.
- **Effort:** S

### L-12. Security minor — defense-in-depth
- **Kategoria:** security
- **Pliki:** `middleware.ts`, `companies.ts`, `transport-types.ts`, `order.validator.ts`, `order-create.service.ts`, `order-misc.service.ts`
- **Opis:** (1) Cache-Control `public` → `private` na authenticated endpoints. (2) Middleware auth flow (Supabase client z raw header). (3) mailto brak email odbiorcy. (4) logError stack traces w prod. (5) Empty string validation (min(1)). (6) Rate limiter FIFO eviction. (7) Non-transactional cleanup createOrder. (8) duplicateOrder resetStatusToDraft.
- **Sugerowany fix:** Indywidualne fixy. Wszystkie defense-in-depth, nie krytyczne.
- **Effort:** M

### L-13. Test pokrycie — komponenty i endpointy
- **Kategoria:** test
- **Pliki:** `DictionaryContext.tsx`, `OrdersPage.tsx`, `HistoryPanel.tsx`, `LoginCard.tsx`, `WarehouseApp.tsx`, `dictionary-sync/run.ts`, drawer components
- **Opis:** Brakujące unit testy: DictionaryContext, drawer sekcje (Route, Cargo, Carrier, Finance, Notes, Status), OrdersPage, HistoryPanel, LoginCard, Warehouse UI, dictionary-sync endpoints. E2E pokrywają happy path.
- **Sugerowany fix:** Dodać przynajmniej renderowanie + basic interaction test per komponent.
- **Effort:** L

### L-14. Test jakość — act warnings, weak assertions, slow tests
- **Kategoria:** test
- **Pliki:** `useDictionarySync.test.ts`, `order.service.test.ts:491`, `order.service.test.ts:375`, drawer-e2e
- **Opis:** (1) "not wrapped in act" warnings. (2) toBeDefined zamiast toThrow. (3) autoSetDocuments — brak weryfikacji payload. (4) drawer-e2e testy 3.6-4s (tymczasowe, do usunięcia).
- **Sugerowany fix:** (1) waitFor + act. (2) rejects.toThrow(). (3) spy na insert payload. (4) Zastąpić lżejszymi testami.
- **Effort:** M

### L-15. DB constraints i docs
- **Kategoria:** architecture
- **Pliki:** `supabase/migrations/`, `.ai/db-plan.md`
- **Opis:** (1) notificationDetails/confidentialityClause — Zod max bez CHECK constraint w DB. (2) search_text ILIKE bez indeksu pg_trgm GIN. (3) db-plan: vehicle_type_text varchar(200) vs varchar(100). (4) db-plan: order_seq_no NOT NULL vs nullable.
- **Sugerowany fix:** (1) Rozważyć CHECK constraints. (2) pg_trgm GIN index przy skalowaniu. (3/4) Aktualizacja db-plan.md.
- **Effort:** M

### L-16. Brak paginacji w endpointach słownikowych
- **Kategoria:** performance
- **Pliki:** `src/pages/api/v1/companies.ts`, `locations.ts`, `products.ts`
- **Opis:** Endpointy słownikowe zwracają wszystkie rekordy bez paginacji.
- **Sugerowany fix:** Dodać limit/offset lub cursor-based pagination.
- **Effort:** M

---

## Odroczone (user decision: zostawić)

### D-13. M-01 — Walidacja 1 stop to NIE jest bug (zamierzone zachowanie)
- W trakcie planowania (status robocze/korekta) zlecenie może mieć dowolną liczbę stopów: 0, tylko załadunki, tylko rozładunki.
- Planista może nie znać jeszcze wszystkich punktów trasy (np. wie kto kupuje towar, ale nie wie z którego magazynu wyśle).
- Walidacja min. 1 LOADING + 1 UNLOADING dotyczy **wysyłki** (email/PDF), nie zapisu draftu.
- PRD zaktualizowany o tę informację (§3.1.5, sekcja "trasa").

### D-14. M-02 — Nie-atomowe operacje na stopach — NIE jest bug
- Zweryfikowano: każde zapytanie DB MA `if (err) throw` guard. Error handling jest poprawny.
- Brak transakcji DB to trade-off wydajności, nie bug — przy kilkudziesięciu użytkownikach ryzyko minimalne.
- Powiązane z D-11 (N+1 queries w updateOrder).

### D-15. M-03 — Snapshot items pozycyjne matchowanie — NIE jest bug
- Zweryfikowano: indeksowanie jest prawidłowe. Deleted items są pomijane spójnie w obu pętlach.
- Kod jest mylący ale działa poprawnie. Refaktoring na matchowanie po ID byłby czytelniejszy, ale nie naprawia buga.

### D-16. M-05 — duplicateOrder niespójna denormalizacja — nieosiągalny z UI
- Frontend ZAWSZE wysyła `{ includeStops: true, includeItems: true }` (hardcoded w `useOrderActions.ts:194`).
- Parametr `includeStops=false` jest osiągalny tylko przez bezpośredni request API (curl/Postman).
- Ryzyko minimalne — defense-in-depth, nie realny bug.

### D-17. M-06 — robocze→reklamacja — celowe ograniczenie
- Reklamacja dotyczy zleceń już wysłanych (wysłane, korekta, korekta wysłane), nie draftów (robocze).
- Brak tranzycji robocze→reklamacja jest logicznie poprawny — nie można reklamować czegoś co nie zostało wysłane.

### D-18. M-12 — handleCloseRequest stale closure — NIE jest bug
- Zweryfikowano: `isDirty` jest z `useState` → closure bierze aktualną wartość przy każdym renderze.
- `handleCloseRequest` jest zwykłą funkcją (nie useCallback) → tworzona na nowo przy każdym renderze → zawsze ma aktualny `isDirty`.
- Brak `useCallback` to co najwyżej mikro-optimizacja (nowa referencja per render), nie bug poprawności.

### D-19. M-07 — Race condition lockOrder (TOCTOU)
- SELECT statusu i RPC try_lock_order to osobne operacje. Między nimi inny użytkownik może zmienić status.
- Wymaga migracji SQL: `AND status_code NOT IN ('anulowane','zrealizowane')` w RPC.
- Ryzyko niskie — wymaga precyzyjnego timingu dwóch użytkowników. Aplikacja wewnętrzna, kilkudziesięciu użytkowników.

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

### Sesja 39 — Weryfikacja bugów MEDIUM + fixy PDF/RPC
- [x] M-21: Usunięto `(supabase as any).rpc()` w order-snapshot.service.ts i order-lock.service.ts — typy RPC już były w database.types.ts
- [x] M-08: PDF endpoint — owinięto cały blok w try/catch z logError + errorResponse(500)
- [x] M-09: PDF security headers — spread COMMON_HEADERS (wyeksportowany z api-helpers.ts) + nadpisanie Content-Type
- [x] L-01: PDF filename sanityzacja — `orderNo.replace(/["\r\n/]/g, "-")`
- [x] L-02: PDF console.error → `logError("[POST /api/v1/orders/{orderId}/pdf]", err)`
- [x] M-01 → D-13: Przeniesione do odroczonych — zamierzone zachowanie (planista może nie znać wszystkich punktów trasy)
- [x] M-02 → D-14: Przeniesione do odroczonych — nierealny bug (error handling jest poprawny)
- [x] M-03 → D-15: Przeniesione do odroczonych — nierealny bug (indeksowanie prawidłowe)
- [x] M-05 → D-16: Przeniesione do odroczonych — nieosiągalny z UI (frontend hardcoded includeStops: true)
- [x] M-06 → D-17: Przeniesione do odroczonych — celowe ograniczenie (reklamacja tylko dla wysłanych)
- [x] M-12 → D-18: Przeniesione do odroczonych — nierealny bug (isDirty z useState, closure poprawna)
- [x] M-10: PDF autoryzacja — READ_ONLY MOŻE generować PDF (decyzja biznesowa, udokumentowane w PRD §3.1.1)
- [x] M-11: FilterBar aria-label — niepotrzebne (aplikacja wewnętrzna, a11y nie wymagane)
- [x] M-13: Ponowna wysyłka maila — zamierzone zachowanie, udokumentowane w PRD §5 (stopka drawera)
- [x] M-22: Podwójny dialog przy "Podgląd" z niezapisanymi zmianami — guard `closest('[role="alertdialog"]')` w `onInteractOutside`
- [x] M-04: Audit trail items — matchowanie snapshot po item.id zamiast pozycyjnego indeksu
- [x] PRD zaktualizowany — §3.1.5 trasa: planowanie z częściowymi stopami jest zamierzone
- Wynik: 914/914 testów, 0 błędów TypeScript

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

### Sesja 32 — naprawiono 5 HIGH (CR-01 dokończenie, CR-02, NEW-03, H-03, H-04, H-06)
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
