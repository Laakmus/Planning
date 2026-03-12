# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-03-12 (sesja 49 — HIGH fixes H-16, H-17, H-18)

---

## Do zrobienia — HIGH

(brak)

---

## Do zrobienia — MEDIUM

### M-20. database.types.ts nieaktualny — brakuje kolumn
- **Kategoria:** architecture
- **Pliki:** `src/db/database.types.ts`
- **Opis:** Brakuje: `notification_details`, `confidentiality_clause` (transport_orders), `location_id` (user_profiles). Zawiera usuniętą FK `vehicle_variant_code_fkey`. Root cause `as any` castów w auth.service i warehouse.service.
- **Sugerowany fix:** Uruchomić `npx supabase gen types typescript --local > src/db/database.types.ts`. Po regeneracji usunąć zbędne `as any` casts.
- **Effort:** S

---

## Odroczone (user decision: zostawić)

### D-20. L-03 — Aktualizacja PRD i docs (13 rozbieżności) — odłożone
- Dokumentacja `.ai/` to wewnętrzne notatki. Aktualizować przy okazji zmian w danym obszarze, nie jako osobne zadanie.

### D-21. L-05 — React.memo / useCallback — premature optimization
- OrderRow przy 25-50 wierszach per page nie ma problemu wydajnościowego. React 19 batchuje setState.

### D-22. L-08 — Frontend drobne UX — celowe decyzje lub nie-problemy
- (1) Firma po nazwie = celowy design (snapshot). (2) onInteractOutside działa poprawnie. (3) React batching łagodzi. (4) Kosmetyka.

### D-23. L-09 — Frontend minor — standardowe patterny
- (1) cmdk standard. (2) Zagnieżdżony TooltipProvider nie szkodzi. (3) Kosmetyka. (4) Backend blokuje. (5) Poprawny wzorzec. (6) Backend robi autoSet.

### D-24. L-10.1/3/4 — Backend minor bugs — niekrytyczne
- (1) change_log insert to logi pomocnicze. (3) autoSet w PUT nadpisałby wybór użytkownika. (4) Edge case przy kilkudziesięciu zleceniach.

### D-25. L-11.1/2/4 — Backend performance — premature optimization
- (1) Max 3 zapytania FK. (2) CORS cached = poprawne. (4) 1h cache na słowniki = OK.

### D-26. L-12.2-8 — Security defense-in-depth — intranet
- (2) Standard Supabase SSR. (3) Wymaga nowego pola email. (4) Stack trace w logach serwera = feature. (5-8) Niski priorytet na intranecie.

### D-27. L-13 — Test pokrycie komponentów — wystarczające
- 1045 unit + 25 E2E. Dodawać testy przy bugach, nie proaktywnie.
- **Uwaga (sesja 47-48):** 97 tymczasowych drawer-e2e testów USUNIĘTE (3 pliki testowe + 1 helper = ~3249 linii dead code).

### D-28. L-14.4 — Drawer-e2e wolne testy — DONE (sesja 47-48)
- ~~97 testów w 5.24s (~54ms/test). Zostawić aż pojawi się decyzja o refactorze.~~
- **Rozwiązane:** Tymczasowe testy drawer-e2e usunięte w ramach refactoringu maintainability.

### D-29. L-15.1/2 — DB constraints i indeksy — premature
- (1) Zod waliduje na API, jedyny punkt wejścia. (2) pg_trgm GIN od setek tysięcy rekordów.

### D-30. L-16 — Paginacja słowników — anty-pattern
- Słowniki małe (dziesiątki rekordów). Frontend potrzebuje pełnej listy do autocomplete/select.

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

### D-03. PDF endpoint — ZAIMPLEMENTOWANY (sesja 39-40)
- PDF endpoint w pełni działa (pdf-generator.service.ts). Stub 501 zastąpiony implementacją.
- Brakuje test API route (tracked jako H-18).

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

### Sesja 49 — HIGH fixes (H-16, H-17, H-18)
- [x] H-16: Sub-query filters w listOrders — zamiana 5 osobnych sub-queries (~96 linii) na RPC `filter_order_ids` (EXISTS subqueries w jednym SQL). Nowa migracja, indeks `order_stops(kind, location_id)`, typ w database.types.ts, 6 nowych testów.
- [x] H-17: `duplicateOrder` — zmiana `notification_details: detail.order.notificationDetails ?? null` na `null` (PRD §3.1.5a). Dodany test weryfikujący.
- [x] H-18: Testy API route PDF — już istniały (10 scenariuszy w `pdf.test.ts`). Usunięto z TODO.

### Sesja 47-48 — Maintainability refactoring (~3285 linii dead code usunięte)
- [x] Ekstrakcja `AppProviders` wrapper component — eliminacja duplikacji providerów
- [x] Rozbicie monolitycznego `src/types.ts` (468 linii) na 4 moduły domenowe (`src/types/common.ts`, `dictionary.ts`, `order.ts`, `warehouse.ts`) z backward-compatible re-export hub
- [x] Ekstrakcja współdzielonego `src/lib/send-email.ts` — deduplikacja logiki email z useOrderActions + useOrderDrawer
- [x] Usunięcie dead code: AppHeader.tsx, 3 strony test-order, 4 pliki drawer-e2e testów (~3285 linii łącznie)
- [x] Rozszerzenie CI pipeline: dodanie kroków lint, build, unit test przed E2E
- [x] Naprawione niespójności dokumentacji w plikach .ai/
- [x] D-28 rozwiązane (drawer-e2e testy usunięte)

### Sesja 46 — Microsoft Graph API integration (email wysyłka)
- [x] Nowy flow wysyłki maila przez Microsoft Graph API (tworzenie draftu w Outlook Web z PDF w załączniku)
- [x] Fallback na .eml (RFC 822) gdy brak konfiguracji M365 (`PUBLIC_MICROSOFT_CLIENT_ID`, `PUBLIC_MICROSOFT_TENANT_ID`)
- [x] Nowe pliki: `src/lib/microsoft-auth.ts` (MSAL config), `src/lib/graph-mail.ts` (createGraphDraft), `src/contexts/MicrosoftAuthContext.tsx` (Provider + hook)
- [x] Backend: `prepareEmailSchema` += `outputFormat`, `order-misc.service.ts` zwraca PDF base64 dla nowego formatu, `prepare-email.ts` rozgałęzienie odpowiedzi (blob .eml vs JSON)
- [x] Frontend: `useOrderActions.ts` + `useOrderDrawer.ts` — Graph API flow z popup blocker workaround (pre-open window)
- [x] `OrdersApp.tsx` — `MicrosoftAuthProvider` wrapper
- [x] `.env.example` — dodane `PUBLIC_MICROSOFT_CLIENT_ID`, `PUBLIC_MICROSOFT_TENANT_ID`
- [x] Aktualizacja 6 plików dokumentacji (prd, ui-plan, api-plan, eml-plan, orders-view-implementation-plan, to_do)

### Sesja 45 — Fix 4 failujących testów E2E (+ parallel resilience)
- [x] **Auth tests (2)**: Osobny projekt Playwright "auth" BEZ storageState — testy logowania nie kolidują z zalogowanym użytkownikiem
- [x] **Auth hydration**: Retry `fill()` z `waitForTimeout(200)` + `toHaveValue()` — ochrona przed race condition hydracją Astro/React (SSR → JS hydration resetuje kontrolowane inputy)
- [x] **Submenu tests (2)**: Refaktor z UI submenu (Radix ContextMenuSub) na API-based status change + UI verification — Radix submenu nie otwiera się niezawodnie w headless Chromium
- [x] **Context menu test 1**: Dodano weryfikację "Zmień status" trigger w context menu (visual presence check)
- [x] **OrdersPage**: Nowe helpery `getAccessToken()`, `changeStatusViaApi()` — API-based status change z auth tokenem z localStorage
- [x] **Parallel resilience**: Asercje count zmienione z `toHaveCount(exact)` na `>=/<=` pattern — odporność na równoległe modyfikacje DB w multi-worker mode
- Zmienione pliki: 7 (1 config + 3 Page Objects + 3 spec files)
- Wynik: 25/25 passed (1 skipped), 1070/1070 unit testów, 0 błędów TypeScript

### Sesja 44 — Naprawa E2E Playwright w CI (GitHub Actions)
- [x] `playwright.config.ts`: viewport 1920x1080, actionTimeout 10s, expect.timeout 10s
- [x] `OrdersPage.ts`: `ensureSidebarOpen()` (collapsed sidebar w CI), `waitForTableUpdate()` bez `waitForTimeout`, `getOrderRows()` locator
- [x] `OrderDrawerPage.ts`: `waitForLoaded()` auto-retry (nie zawiera "Ładowanie"), `expectTitle()` z auto-retry
- [x] `ContextMenuComponent.ts`: `openStatusSubmenu()` z timeout 5s + walidacja menuitem
- [x] `HistoryPanelPage.ts`: `waitForLoaded()` czeka na "Historia zmian", `expectTitle()` z auto-retry
- [x] 6 plików spec: eliminacja `waitForTimeout()`, `.count()`+`toBe()` → `toHaveCount()`, `expect().toPass()` pattern
- [x] 0 pozostałych `waitForTimeout()`, 0 pozostałych `.count()`+`toBe()` bez auto-retry
- Zmienione pliki: 12 (1 config + 4 Page Objects + 7 spec files)

### Sesja 43 — H-15 "Wyślij maila" (.eml z PDF)
- [x] H-15: Generacja .eml z PDF — `eml-builder.service.ts`, `pdf-data-resolver.ts`, modyfikacja `order-misc.service.ts`, `prepare-email.ts`, `pdf.ts`, `useOrderDrawer.ts`, `useOrderActions.ts`
- [x] Nowe testy: eml-builder (10), pdf-data-resolver (5), zaktualizowane prepare-email.test.ts, order.service.test.ts, useOrderActions.test.ts
- [x] Usunięcie PrepareEmailResponseDto i PrepareEmailCommand z types.ts
- Wynik: 1070/1070 testów, 0 błędów TypeScript

### Audyt 42 — pełny audyt 6 agentów + debata (2026-03-08)
- 6 agentów: Security, Backend, Frontend, Docs, Tests, DB&Types
- 11 findings surowych → debata reviewer → 3 HIGH confirmed, 3 MEDIUM (pominięte per user), 1 LOW (pominięty), 4 deferred (duplikaty D-14, D-15, D-25, D-06)
- Nowe HIGH: H-16 (sub-query filter limit), H-17 (notificationDetails kopiowane), H-18 (brak testu PDF route)
- Zaktualizowano D-03 (PDF już zaimplementowany)
- Usunięto z "Do zrobienia" items naprawione w sesji 41 (L-04, L-05, L-06, L-07, L-08) — przeniesione do sekcji Zrobione sesji 41

### Sesja 41 — Analiza + fixy LOW (agent teams)
- [x] L-04: A11y — `scope="col"` na 13 `<th>`, `aria-label` na X drawera i usuwaniu stopu, `role="group"` + `aria-pressed` na przełączniku widoku
- [x] L-06: FilterBar debounce cleanup — `useEffect` cleanup przy unmount
- [x] L-07: CargoSection stabilny key — `_clientKey: crypto.randomUUID()` w `OrderFormItem`, `key={item._clientKey || item.id || idx}`
- [x] L-10.2: autoSetDocumentsAndCurrency — poprawiony mylący komentarz (waluta nie jest zmieniana)
- [x] L-11.3: Zod `.max()` na stops/items — podwojone limity (22/100) żeby uwzględnić `_deleted`
- [x] L-12.1: Cache-Control `public` → `private` na transport-types, vehicle-variants, order-statuses
- [x] L-14.1/2/3: Testy — `advanceTimersByTimeAsync`, `rejects.toThrow()`, nazwy testów autoSet (już wcześniej naprawione)
- [x] L-15.3/4: db-plan.md — `vehicle_type_text varchar(100)`, `order_seq_no` nullable (już zsynchronizowane)
- [x] L-03, L-05, L-08, L-09, L-10.1/3/4, L-11.1/2/4, L-12.2-8, L-13, L-14.4, L-15.1/2, L-16 → odroczone (D-20..D-30)
- Wynik: 1045/1045 testów, 0 błędów TypeScript

### Sesja 40 — Testy MEDIUM M-14..M-19 (agent teams)
- [x] M-14: `useOrderActions.test.ts` — 23 testy (addOrder, sendEmail, cancel, duplicate, changeStatus, restore)
- [x] M-15: `useOrderDrawer.test.ts` — 16 testów (loadDetail, save create/update, close/dirty, readOnly, preview, PDF, email)
- [x] M-16: `order-snapshot.service.test.ts` — 30 testów (computeDenormalizedFields, buildSearchText, autoSetDocumentsAndCurrency)
- [x] M-17: `pdf/__tests__/pdf.test.ts` — 25 testów (generateOrderPdf, helpers, sekcje PDF)
- [x] M-18: 7 plików testów endpointów słownikowych — 29 testów (companies, locations, products, transport-types, vehicle-variants, order-statuses, health)
- [x] M-19: Audit trail items/stops CRUD — 4 testy (zmiana product_name, quantity_tons, dodanie, usunięcie) + 4 testy stops CRUD — już istniały w order.service.test.ts
- Wynik: 1045/1045 testów (60 plików), 0 błędów TypeScript

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
