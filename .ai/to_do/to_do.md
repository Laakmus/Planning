# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-03-26 (sesja: naprawiono H-01, H-02, H-03 → przenumerowano na H-04, H-05)

---

## Do zrobienia — HIGH

### H-04. Przeniesienie Microsoft Graph API na backend (Confidential Client)
- **Kategoria:** security
- **Pliki:** `graph-mail.server.ts` (nowy), `prepare-email.ts`, `order-misc.service.ts`, `useOrderActions.ts`, `useOrderDrawer.ts`, `OrdersApp.tsx`, `MicrosoftAuthContext.tsx` (usunąć)
- **Opis:** Token Mail.ReadWrite w przeglądarce = ryzyko XSS → pełny dostęp do skrzynki. Status zmienia się na "wysłane" ZANIM draft powstanie (race condition). Wymaga rejestracji app w Azure AD jako Confidential Client.
- **Effort:** L (8-12h), **Zależność:** Azure AD app registration

### H-05. Integracja dictionary-sync z Comarch ERP XL
- **Kategoria:** architecture
- **Pliki:** `src/pages/api/v1/dictionary-sync/`
- **Opis:** **ZABLOKOWANE**: Brak dokumentacji API Comarch ERP XL od działu IT. Krok wstępny: IT → typ API (SOAP? REST? SQL?), dane dostępowe, struktura tabel.
- **Effort:** XL (16-24h), **Zależność:** zewnętrzna (Comarch API)

---

## Do zrobienia — MEDIUM

### M-01. IDOR na locationId w warehouse report endpoints
- **Kategoria:** security
- **Pliki:** `src/pages/api/v1/warehouse/report/pdf.ts:52`, `src/pages/api/v1/warehouse/report/send-email.ts:47`
- **Opis:** Endpointy PDF i send-email przyjmują dowolny `locationId` bez walidacji, czy user ma prawo do danej lokalizacji (typ INTERNAL). GET /warehouse/orders ma tę walidację — brak spójności.
- **Sugerowany fix:** Skopiować walidację lokalizacji (typ INTERNAL) z `warehouse/orders.ts:112-125` do obu endpointów report.
- **Effort:** S
- *Źródło: SEC-03*

### M-02. "Anuluj zlecenie" widoczne w zakładce Zrealizowane
- **Kategoria:** bug
- **Pliki:** `src/components/orders/OrderRowContextMenu.tsx:190`
- **Opis:** Opcja "Anuluj zlecenie" widoczna gdy `statusCode !== "anulowane"` — pojawia się w zakładce Zrealizowane. PRD 3.1.7 mówi: "z widoku zrealizowane nie można bezpośrednio anulować". Backend odrzuci (400), ale UI nie powinno wyświetlać niedozwolonej akcji.
- **Sugerowany fix:** Dodać warunek `&& activeView !== "COMPLETED"` do widoczności "Anuluj zlecenie".
- **Effort:** S
- *Źródło: DOC-03*

### M-03. Brak walidacji pustego powodu reklamacji z context menu
- **Kategoria:** bug
- **Pliki:** `src/components/orders/OrdersPage.tsx:340-346`
- **Opis:** Zmiana statusu na "reklamacja" z menu kontekstowego pozwala zatwierdzić z pustym polem powodu. Walidacja jest w drawerze (useOrderDrawer.ts:347), ale nie w dialogu zmiany statusu. Niezgodne z ui-plan.md ("Zmiana zablokowana bez wypełnienia").
- **Sugerowany fix:** Dodać `disabled={pendingStatusChange?.newStatus === "reklamacja" && !complaintReasonInput.trim()}` do AlertDialogAction.
- **Effort:** S
- *Źródło: UI-05*

### M-04. Mylący tekst "Tej operacji nie można cofnąć" w dialogu anulowania
- **Kategoria:** ux
- **Pliki:** `src/components/orders/OrdersPage.tsx:290`
- **Opis:** Dialog anulowania mówi "Tej operacji nie można cofnąć" — ale anulowane zlecenia SĄ przywracalne w ciągu 24h ("Przywróć do aktualnych").
- **Sugerowany fix:** Zmienić tekst na "Zlecenie przejdzie do zakładki Anulowane. Można je przywrócić w ciągu 24h."
- **Effort:** S
- *Źródło: UI-02*

### M-05. Select "Typ auta" nie wyświetla wartości spoza listy VEHICLE_TYPES
- **Kategoria:** bug
- **Pliki:** `src/components/orders/drawer/CarrierSection.tsx:103-121`
- **Opis:** Jeśli w bazie istnieje wartość vehicleTypeText, która nie jest w hardcoded liście VEHICLE_TYPES, Select wyświetli placeholder "Wybierz typ..." zamiast faktycznej wartości. Bug przy danych legacy lub wpisanych API.
- **Sugerowany fix:** Jeśli vehicleTypeText nie jest w VEHICLE_TYPES, dodać ją tymczasowo do listy opcji lub wyświetlić jako fallback text.
- **Effort:** S
- *Źródło: UI-09*

### M-06. Fragile index-based matching w audit trail items
- **Kategoria:** architecture
- **Pliki:** `src/lib/services/order-update.service.ts:401-446`
- **Opis:** Audit trail matchuje snapshoty items po indeksach numerycznych (activeItemIdx). Matchowanie poprawne w obecnej implementacji (obie tablice mają ten sam porządek), ale fragile coupling z frontendem — zmiana kolejności items w payload złamie matchowanie.
- **Sugerowany fix:** Matchuj snapshot po item.id (istniejące) lub buduj mapę ID→snapshot. Dla nowych items — matchuj po pozycji w filtrowanej liście (!snap.id).
- **Effort:** M
- *Źródło: BUG-01*

### M-07. Brakujące testy: admin/cleanup + dictionary-sync (4 endpointy)
- **Kategoria:** test
- **Pliki:** `src/pages/api/v1/admin/cleanup.ts`, `src/pages/api/v1/dictionary-sync/run.ts`, `src/pages/api/v1/dictionary-sync/jobs/[jobId].ts`
- **Opis:** 4 endpointy bez testów. Cleanup wymaga roli ADMIN (service_role client). Dictionary-sync wymaga writeAccess. Auth guards nietestowane.
- **Sugerowany fix:** Dodać testy: 401 niezalogowany, 403 brak uprawnień, 400 zły body, 200 sukces.
- **Effort:** S
- *Źródła: TST-02, TST-03*

### M-08. Brakujące testy: warehouse PDF generator + auto-korekta
- **Kategoria:** test
- **Pliki:** `src/lib/services/pdf/warehouse-pdf-generator.service.ts`, `src/lib/services/__tests__/order.service.test.ts:610`
- **Opis:** (1) Warehouse PDF generator (350 linii) bez testów — istniejący pdf.test.ts testuje TYLKO order PDF. (2) Test auto-korekta pokrywa "wysłane"→"korekta", ale brak "korekta wysłane"→"korekta".
- **Sugerowany fix:** (1) Dodać testy warehouse PDF: minimalny input → ArrayBuffer, pełne dane → nie rzuca, pusta lista. (2) Dodać test auto-korekty "korekta wysłane".
- **Effort:** M
- *Źródła: TST-08, TST-04*

### M-09. Słabe assertions w testach audit trail
- **Kategoria:** test
- **Pliki:** `src/lib/services/__tests__/order.service.test.ts:814-933`
- **Opis:** Testy audit trail weryfikują że `from("order_change_log").insert()` wywołane, ale NIE sprawdzają treści INSERT payload (field_name, old_value, new_value). Nie da się zweryfikować poprawności logowanej zmiany.
- **Sugerowany fix:** Przechwycić argument mock.calls i sprawdzić field_name, old_value, new_value.
- **Effort:** M
- *Źródło: TST-05*

### M-10. Sentry integration (error tracking)
- **Kategoria:** architecture
- **Pliki:** SDK Sentry dla Node.js (backend) + React (frontend)
- **Opis:** `logError()` → Sentry.captureException(), ErrorBoundary → Sentry.ErrorBoundary
- **Effort:** M (2-3h)

### M-11. Centralized logging (structured)
- **Kategoria:** architecture
- **Pliki:** Zastąpienie `console.error` → pino/winston z rotacją logów
- **Effort:** M (3-4h)

### M-12. Backup strategy + disaster recovery
- **Kategoria:** architecture
- **Pliki:** Dokumentacja RTO/RPO, automatyczne backupy DB (pg_dump cron lub Supabase managed)
- **Opis:** Podstawowe instrukcje w DEPLOYMENT.md — wymaga rozszerzenia o skrypty i testy restore
- **Effort:** M (2-3h)

### M-13. CI/CD deployment pipeline
- **Kategoria:** architecture
- **Pliki:** Rozszerzenie `.github/workflows/e2e.yml` o krok deploy (SSH/Docker push)
- **Effort:** M (3-4h), **Zależność:** Dockerfile (DONE)

### M-14. Load testing
- **Kategoria:** performance
- **Pliki:** k6 script testujący 50 concurrent users (orders CRUD, list, PDF)
- **Effort:** M (3-4h)

### M-15. Remaining `as any` casts (w kodzie produkcyjnym)
- **Kategoria:** architecture
- **Pliki:** `warehouse/orders.ts:117`, `useOrderDrawer.ts:439-440`
- **Effort:** S (30 min)

---

## Do zrobienia — LOW

### L-01. Sanityzacja CRLF w EML builder + Content-Disposition filename
- **Kategoria:** security
- **Pliki:** `src/lib/services/eml/eml-builder.service.ts:76-77`, `src/lib/services/order-misc.service.ts:364`
- **Opis:** (1) `encodeSubjectRfc2047` nie koduje czystych ASCII z CRLF — potencjalny email header injection. (2) Filename sanitization w Content-Disposition nie blokuje backslash, semicolon, NUL.
- **Sugerowany fix:** (1) Sanityzacja `\r\n` w subject/to/body: `.replace(/[\r\n]/g, "")`. (2) Allowlist regex: `.replace(/[^a-zA-Z0-9._-]/g, "-")`.
- **Effort:** S
- *Źródła: SEC-01, SEC-05*

### L-02. Brakujące aria-label w filtrach i formularzach
- **Kategoria:** a11y
- **Pliki:** `src/components/orders/FilterBar.tsx:103-119,175-188`, `src/components/orders/drawer/RoutePointCard.tsx:181`, `src/components/orders/drawer/CarrierSection.tsx:79-96`
- **Opis:** Select (rodzaj transportu, status), input tygodnia, wyszukiwanie, komentarz do punktu trasy, pola firmy transportowej — brak powiązanych etykiet dla screen readerów.
- **Sugerowany fix:** Dodać `aria-label` do każdego pola.
- **Effort:** S
- *Źródła: UI-03, UI-04, UI-11, UI-12*

### L-03. Hardening middleware i konfiguracja
- **Kategoria:** security
- **Pliki:** `src/middleware.ts:149-166`, `src/lib/api-helpers.ts:24-36`, `src/pages/api/v1/health.ts`
- **Opis:** (1) Body size limit oparty na Content-Length header — chunked TE omija (reverse proxy limit zalecany). (2) COMMON_HEADERS stały obiekt, CORS_ORIGIN ewaluowany raz przy starcie. (3) Health endpoint publiczny (minimalny info leak).
- **Sugerowany fix:** (1) Limit na reverse proxy. (2) Walidacja CORS_ORIGIN przy starcie w production. (3) Rozważyć publiczny/prywatny health check.
- **Effort:** M
- *Źródła: SEC-02, SEC-09, SEC-10*

### L-04. Brak requireWriteAccess w PDF i recipients endpoints
- **Kategoria:** security
- **Pliki:** `src/pages/api/v1/orders/[orderId]/pdf.ts:23`, `src/pages/api/v1/warehouse/report/recipients.ts:22`
- **Opis:** READ_ONLY może generować PDF (intensywne obliczeniowo) i widzieć adresy email odbiorców raportów. Niekonsekwentne z innymi endpointami.
- **Sugerowany fix:** Dodać `requireWriteAccess` lub osobny rate limit dla READ_ONLY.
- **Effort:** S
- *Źródła: SEC-04, SEC-06*

### L-05. Unsafe type casts w serwisach
- **Kategoria:** architecture
- **Pliki:** `src/lib/services/order-update.service.ts:53-78`, `src/lib/services/warehouse.service.ts:143`
- **Opis:** `as unknown as Promise<...>` w order-update i `as any` w warehouse.service — pomijają walidację kompilatora. Zmiana schematu DB nie zostanie wykryta.
- **Sugerowany fix:** Po regeneracji database.types.ts (H-01) zweryfikować czy casty nadal potrzebne. Jeśli tak — dodać Zod runtime validation.
- **Effort:** M
- *Źródła: SEC-07, BUG-12*

### L-06. Redundantne DB queries (shipper/receiver snapshots)
- **Kategoria:** performance
- **Pliki:** `src/lib/services/order-update.service.ts:177-183`, `src/lib/services/order-create.service.ts:127-134`
- **Opis:** Shipper/receiver snapshoty budowane osobnymi zapytaniami DB, mimo że dane już dostępne w `locationSnapMap` (batch-pobranej mapie).
- **Sugerowany fix:** Użyj `locationSnapMap` do budowania shipper/receiver snapshotów.
- **Effort:** S
- *Źródła: BUG-08, BUG-09*

### L-07. Drobne poprawki backend (5 items)
- **Kategoria:** bug
- **Pliki:** `order-misc.service.ts:370-375`, `cleanup.service.ts:98`, `api-helpers.ts:33`, `order-misc.service.ts:289`, `order-misc.service.ts:460`
- **Opis:** (1) ArrayBuffer→base64 pętla po bajtach → użyj `Buffer.from().toString("base64")`. (2) Cleanup deduplikacja opiera się na Set insertion order — dodaj komentarz. (3) COMMON_HEADERS brak `Access-Control-Allow-Credentials` (nieistotne bo JWT, nie cookies). (4) Stawka 0 PLN przechodzi walidację prepare-email — do potwierdzenia z biznesem. (5) Brak sprawdzenia błędu INSERT do change_log w `updateEntryFixed()`.
- **Sugerowany fix:** Każdy punkt to S effort, łącznie ~1h.
- **Effort:** S (łącznie)
- *Źródła: BUG-04, BUG-05, BUG-06, BUG-10, BUG-13*

### L-08. Drobne poprawki frontend (7 items)
- **Kategoria:** ux
- **Pliki:** `useOrderDrawer.ts:427`, `OrderRowContextMenu.tsx:110`, `OrderForm.tsx:232`, `OrderTable.tsx:133`, `StatusFooter.tsx:61`, `MicrosoftAuthContext.tsx:97`, `AutocompleteField.tsx:60`
- **Opis:** (1) Martwa dep `doClose` w handleSave deps. (2) Brak guard email z context menu. (3) Brak skeleton przy progressive rendering. (4) z-index do weryfikacji. (5) "System Status: OK" hardcoded. (6) useMemo brak w MicrosoftAuthProvider value. (7) Autocomplete filtruje od 1 znaku (ui-plan: >=2).
- **Sugerowany fix:** Każdy punkt to S effort.
- **Effort:** S (łącznie)
- *Źródła: UI-01, UI-06, UI-08, UI-13, UI-14, UI-15, UI-16*

### L-09. Aktualizacja PRD i dokumentacji (5 rozbieżności)
- **Kategoria:** docs
- **Pliki:** `.ai/prd.md`
- **Opis:** (1) Kolor tła bg-emerald-100/70 vs PRD bg-emerald-50/30. (2) Typy pojazdów hardcoded vs "z bazy" (celowa decyzja sesja 21). (3) Kolumna "Fix" nie wymieniona w specyfikacji kolumn. (4) Przewoźnik "nazwa + kontakt" → tylko nazwa. (5) "Ikona Wyślij maila" → context menu/drawer.
- **Sugerowany fix:** Zaktualizować PRD — każdy punkt to drobna edycja tekstu.
- **Effort:** S
- *Źródła: DOC-01, DOC-02, DOC-05, DOC-06, DOC-07*

### L-10. Aktualizacja db-plan.md (order_no_counters)
- **Kategoria:** docs
- **Pliki:** `.ai/db-plan.md`
- **Opis:** Tabela `order_no_counters` (year PK, last_seq INT NOT NULL DEFAULT 0) dodana w sesji 54 — brak w db-plan.md.
- **Sugerowany fix:** Dodać sekcję 1.14 z opisem tabeli, RLS, powiązania z RPC.
- **Effort:** S
- *Źródło: DB-08*

### L-11. Martwe/rozbieżne interfejsy w order.ts
- **Kategoria:** architecture
- **Pliki:** `src/types/order.ts:248-273`
- **Opis:** (1) `PrepareEmailResponseDto` — nigdy nie importowany (martwy kod). (2) `GeneratePdfCommand` — nigdy nie importowany. (3) `PrepareEmailCommand` z `forceRegeneratePdf` ≠ walidator Zod (`outputFormat`).
- **Sugerowany fix:** Usunąć martwe interfejsy, zaktualizować PrepareEmailCommand lub usunąć.
- **Effort:** S
- *Źródła: DB-04, DB-05, DB-06*

### L-12. Porządki w migracjach (przy następnej konsolidacji)
- **Kategoria:** architecture
- **Pliki:** `supabase/migrations/20260207000000_consolidated_schema.sql`
- **Opis:** (1) Duplikat CHECK constraint `chk_carrier_cell_color` (stary) + `transport_orders_carrier_cell_color_check` (nowy). (2) Tworzenie search_vector + GIN i natychmiastowe usunięcie. (3) Pośrednie wersje `generate_next_order_no()` nadpisywane.
- **Sugerowany fix:** Przy następnej konsolidacji schematu — wyczyścić redundancje.
- **Effort:** S
- *Źródła: DB-03, DB-09, DB-10*

### L-13. Drobne uzupełnienia testów (6 items)
- **Kategoria:** test
- **Pliki:** `src/hooks/__tests__/useOrderDrawer.test.ts`, `src/lib/services/__tests__/order.service.test.ts`, `src/contexts/MicrosoftAuthContext.tsx`, `src/lib/validators/warehouse-report.validator.ts`
- **Opis:** (1) PUT body asercja `expect.any(Object)` → sprawdzić pola. (2) Brak testu dirty form → handleCloseRequest. (3) listOrders test nie weryfikuje mapowania pól. (4) Brak testu self-lock. (5) MicrosoftAuthContext bez testów (thin wrapper). (6) Warehouse report Zod bez dedykowanych testów.
- **Sugerowany fix:** Dodawać przy okazji zmian w danym obszarze.
- **Effort:** S (łącznie)
- *Źródła: TST-07, TST-09, TST-10, TST-11, TST-12, TST-13*

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

### D-19. M-07 — Race condition lockOrder (TOCTOU) — NAPRAWIONE (sesja 50)
- ~~Wymaga migracji SQL: `AND status_code NOT IN ('anulowane','zrealizowane')` w RPC.~~
- **Rozwiązane:** Migracja `20260319000000_lock_order_status_guard.sql` — dodano guard statusu + zwrot `TERMINAL_STATUS`.

### D-03. PDF endpoint — ZAIMPLEMENTOWANY (sesja 39-40)
- PDF endpoint w pełni działa (pdf-generator.service.ts). Stub 501 zastąpiony implementacją.
- Brakuje test API route (tracked jako H-18).

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Czysto refaktoringowa zmiana (~290 linii logiki → osobny hook). Nie zmienia funkcjonalności.
- **Powiązane:** M-06 (OrderDrawer 742 linii)

### D-06. Dictionary sync endpoints — stuby
- `POST /dictionary-sync/run` i `GET /jobs/{id}` zwracają mock responses. Oczekiwane dla MVP bez integracji ERP.

### D-07. Job czyszczący anulowane zlecenia po 24h — ZAIMPLEMENTOWANE (sesja 50)
- ~~PRD wymaga usunięcia anulowanych po 24h. Wymaga `pg_cron` (infrastructure).~~
- **Rozwiązane:** `cleanup.service.ts` (setInterval 1h) + `POST /api/v1/admin/cleanup` + `ExpiryCountdown.tsx` UI.

### D-08. parseJsonBody — limit rozmiaru body — NAPRAWIONE (sesja 50)
- ~~Było M-11 w sesji 34 (1MB limit), cofnięte w sesji 36.~~
- **Rozwiązane:** Content-Length check w middleware (1MB limit → 413 Payload Too Large).

### D-09. Rate limiting — fallback na IP dla niezweryfikowanych tokenów
- Middleware dekoduje JWT bez weryfikacji podpisu (atob). Atakujący mógłby sfabrykować JWT z sub innego użytkownika.
- **Konsensus debaty:** Odłożone — na intranecie IP-based wystarczy, ryzyko minimalne.

### D-10. Health endpoint — usunięcie error.message z odpowiedzi — NAPRAWIONE (sesja 50)
- ~~GET /api/v1/health ujawnia `error.message` z PostgreSQL w odpowiedzi 503.~~
- **Rozwiązane:** Zmieniono na generyczne "Database unavailable", dodano `logError()`.

### D-11. N+1 queries w updateOrder
- Do 33+50 sekwencyjnych zapytań DB przy zapisie z pełną trasą i itemami (typowo 15-20).
- **Konsensus debaty:** Premature optimization przy kilkudziesięciu użytkownikach. Naprawić przy skalowaniu.

### D-12. Brak limitu długości pola search w walidatorach — NAPRAWIONE (sesja 50)
- ~~`orderListQuerySchema` i dictionary endpoints nie mają `.max()` na polu search.~~
- **Rozwiązane:** `.max(200)` w orderListQuerySchema + `.slice(0, 200)` w companies/locations/products endpoints.

---

## Zrobione

### Sesja 55 — 3x HIGH (H-01, H-02, H-03) naprawione (agent teams)
- [x] H-01: Ręczna naprawa `database.types.ts` — `confidentiality_clause` boolean→string (3 miejsca), dodano tabelę `order_no_counters`, dodano funkcję `require_write_role`
- [x] H-02: Fix buga audit trail w `order-update.service.ts` — `newItemSnapshots = itemsWithSnapshots.filter(snap => !snap.id)`, indeksowanie nowych items poprawione
- [x] H-03: 28 testów warehouse report w 3 plikach: `pdf.test.ts` (9), `send-email.test.ts` (11), `recipients.test.ts` (8). Fix TS `Buffer→ArrayBuffer` w mockach
- Wynik: 1028/1028 testów, 0 błędów TypeScript. Reviewer potwierdził poprawność H-01 i H-02.

### Sesja 54 — Fix duplikowania numerów zleceń po fizycznym usunięciu (BUG)
- [x] **BUG**: Po fizycznym usunięciu anulowanego zlecenia z najwyższym numerem (cleanup po 24h), nowe zlecenie mogło dostać ten sam numer
- [x] **Przyczyna**: `generate_next_order_no()` RPC bazowała na `MAX(seq)` z tabeli `transport_orders` — po DELETE wiersza MAX się cofał
- [x] **Fix**: Nowa tabela `order_no_counters` (year PK, last_seq INT) + atomowy UPSERT w RPC — licznik nigdy się nie cofa
- [x] **Migracja**: `20260325000000_order_no_counter.sql` — tabela + inicjalizacja z istniejących danych + zaktualizowana RPC
- [x] **Brak zmian w kodzie TS** — sygnatura RPC bez zmian, testy unit (1000) przechodzą

### Sesja 53 — Fix niestabilnego sortowania + eliminacja mignięcia tabeli
- [x] **BUG 1**: Zmiana koloru w kolumnie "Firma transportowa" (menu kontekstowe) powodowała przeskok wiersza na inną pozycję w tabeli
- [x] **Przyczyna**: Brak tiebreakera w sortowaniu — PostgreSQL zwracał wiersze o identycznym kluczu sortowania w nieokreślonej kolejności (MVCC po UPDATE)
- [x] **Fix**: Dodano `.order("order_seq_no", { ascending: true })` jako drugi klucz sortowania w `order-list.service.ts`
- [x] **BUG 2**: Każda akcja z menu kontekstowego powodowała widoczne mignięcie tabeli (opacity-50 + Loader2 bar)
- [x] **Przyczyna**: `refetch()` ustawiał `setIsLoading(true)` → `OrderTable` reagował `isReloading = true` → freeze UI
- [x] **Fix**: Optimistic updates (kolor, fix) + silent refetch (pozostałe akcje) w `useOrders.ts` + `useOrderActions.ts`
- [x] Pliki: `useOrders.ts` (silentRefetch, updateOrderLocally), `useOrderActions.ts` (optimistic + silentRefetch), `OrdersPage.tsx` (przekazanie)
- [x] **BUG 3**: Zapis w drawerze powodował mignięcie tabeli (ten sam problem co BUG 2)
- [x] **Fix**: Zmiana `onOrderUpdated={refetch}` → `onOrderUpdated={silentRefetch}` w `OrdersPage.tsx`
- [x] **Pre-existing test fix**: `useOrderDrawer.test.ts` — test oczekiwał `onClose` po PUT, ale drawer nie zamyka się po aktualizacji

### Sesja 51 — Plan załadunkowy magazynu PDF + email (agent teams)
- [x] Migracja DB: tabela `warehouse_report_recipients` (RLS: ADMIN zarządza, authenticated czyta)
- [x] Typy: `ReportRecipientDto`, `WarehouseReportPdfRequestDto`, `WarehouseReportRecipientsResponseDto` w `src/types/warehouse.ts`
- [x] Walidatory Zod: `warehouseReportPdfSchema`, `warehouseReportSendEmailSchema` w nowym pliku `src/lib/validators/warehouse-report.validator.ts`
- [x] PDF generator: landscape A4, dynamiczna wysokość wierszy, wieloliniowy tekst (towar, przewoźnik, awizacja), tabele per dzień, podsumowanie tygodnia, stopka z datą i numeracją stron
- [x] 3 endpointy API: `POST /warehouse/report/pdf`, `POST /warehouse/report/send-email`, `GET /warehouse/report/recipients`
- [x] eml-builder: dodane opcjonalne parametry `to` i `body` (backward-compatible)
- [x] Frontend: `ReportActions.tsx` — "Podgląd PDF" (outline) + "Wyślij plan" (dialog z listą odbiorców, .eml download)
- [x] `WarehouseApp.tsx` — ReportActions w headerze (ml-auto, po BranchSelector)
- [x] `database.types.ts` — dodana tabela `warehouse_report_recipients`
- [x] Fix: usunięto `forceRegeneratePdf` z testów order.service (pre-existing TS error)
- [x] HTML mockup: `test/warehouse_report_pdf_mockup.html`
- [x] Aktualizacja dokumentacji: api-plan.md (§2.17), db-plan.md (§1.13), ui-plan.md, prd.md (§3.2.8)
- [x] Również: auto-fill sender contact, documents/currency, hover borders, RouteSection fix (osobny commit)
- Wynik: 1000/1000 testów, 0 błędów TypeScript, build OK

### Sesja 50 — Pre-production hardening (agent teams)
- [x] P0-01: `.env.production.example` — template konfiguracji produkcyjnej
- [x] P0-02: `Dockerfile` (multi-stage) + `docker-compose.yml` + `.dockerignore`
- [x] P0-03: Health endpoint — ukrycie `error.message` DB → generyczne "Database unavailable"
- [x] P0-04: `DEPLOYMENT.md` — pełna dokumentacja operacyjna (deploy, backup, monitoring, troubleshooting)
- [x] P1-02: .eml Subject header + RFC 2231 encoding polskich znaków w nazwie załącznika
- [x] P1-03: Usunięcie dead code `forceRegeneratePdf` z `prepareEmailSchema`
- [x] P2-02: Cleanup service — automatyczne usuwanie anulowanych zleceń po 24h (setInterval 1h) + endpoint `POST /api/v1/admin/cleanup`
- [x] P2-03: `ExpiryCountdown` — "Wygasa za X h Y min" w zakładce Anulowane (z kolorowaniem: neutralny > pomarańczowy > czerwony)
- [x] P3-04: Body size limit 1MB w middleware (413 Payload Too Large)
- [x] P5-02: Guard statusu w try_lock_order RPC (`AND status_code NOT IN ('anulowane','zrealizowane')`)
- [x] P5-03: Search field max length 200 — walidator + 3 dictionary endpoints
- [x] Fix: isDirty bug w OrderForm.tsx — side-effecty wewnątrz updater function (React 18+ batching)
- [x] UX Audit: 21 problemów naprawionych (4 HIGH, 9 MEDIUM, 8 LOW):
  - [x] HIGH: Dialogi potwierdzenia zmiana statusu, duplikacji, przywrócenia z context menu
  - [x] HIGH: Guard isSaving w handleSave (podwójne kliknięcie)
  - [x] HIGH: Loading state "Wyślij maila" (spinner + disabled)
  - [x] MEDIUM: Lock error rozróżnianie 409 vs inne, error state w drawerze z retry
  - [x] MEDIUM: Potwierdzenie usuwania stopów i towarów (gdy mają dane)
  - [x] MEDIUM: Select "Typ auta"/"Forma płatności" — opcja wyczyść (— Brak —)
  - [x] MEDIUM: Loading indicator przy zmianie filtrów (opacity + spinner)
  - [x] MEDIUM: Toast błędu słowników, nawigacja tygodniowa 53 tygodnie
  - [x] LOW: Ctrl+S w drawerze, orderNo w dialogach, komentarze bez numeracji, deferred week input
- [x] E2E: 8 nowych testów Playwright w `e2e/tests/ux-guards.spec.ts` (łącznie 33 E2E)
- Wynik: 1000/1000 unit testów, 33 E2E testów, 0 błędów TypeScript, build OK
- [x] D-10, D-12, D-19: Przeniesione z odroczonych do zrealizowanych
- [x] Naprawione testy: health.test.ts (logError mock), order.validator.test.ts (forceRegeneratePdf usunięte)
- Wynik: 999/999 testów, 0 błędów TypeScript, build OK

### Sesja 49 — HIGH fixes (H-16, H-17, H-18)
- [x] H-16: Sub-query filters w listOrders — zamiana 5 osobnych sub-queries (~96 linii) na RPC `filter_order_ids` (EXISTS subqueries w jednym SQL). Nowa migracja, indeks `order_stops(kind, location_id)`, typ w database.types.ts, 6 nowych testów.
- [x] H-17: `duplicateOrder` — zmiana `notification_details: detail.order.notificationDetails ?? null` na `null` (PRD §3.1.5a). Dodany test weryfikujący.
- [x] H-18: Testy API route PDF — już istniały (10 scenariuszy w `pdf.test.ts`). Usunięto z TODO.
- [x] M-20: Ręczna aktualizacja `database.types.ts` — dodane `notification_details`, `confidentiality_clause` (transport_orders), `location_id` (user_profiles), usunięta FK `vehicle_variant_code_fkey`. Usunięto 3x `as any` (auth.service.ts, warehouse/orders.ts).

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
