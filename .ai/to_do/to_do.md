# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-25 (sesja 16)
> Kontekst: Sesja 16: M-07 (order_seq_no sortowanie numeryczne), M-09 zamknięte (won't fix).

---

## Zrobione (referencja)

### CRITICAL (sesje 3-5)
- [x] Race condition w lockOrder (atomic RPC `try_lock_order`)
- [x] Race condition w generateOrderNo (atomic RPC `generate_next_order_no`)
- [x] TOCTOU bypass blokady/statusu (conditional WHERE w UPDATE)
- [x] C-01/C-03: ROW_BG — tylko `wysłane` i `korekta wysłane` → `bg-emerald-50/30` (sesja 5)
- [x] C-02: Korekta wysłane — `yellow-*` → `amber-*` w StatusBadge + fix zamienione kolory Wysłane↔Zrealizowane (sesja 5)

### HIGH (sesje 3-12)
- [x] H-01: handleSendEmail w OrdersPage — emailOpenUrl
- [x] H-02: autoSetDocumentsAndCurrency — poprawne dokumenty wg PRD
- [x] H-03: generalNotes max 500 (PRD + validator + DB zgodne)
- [x] H-04: ALLOWED_TRANSITIONS — korekta -> reklamacja
- [x] H-05: Server-side stop ordering (first=LOADING, last=UNLOADING)
- [x] H-06: Sanityzacja LIKE wildcards (4 lokalizacje)
- [x] H-07: CORS default localhost zamiast *
- [x] H-08: unlock.ts requireWriteAccess
- [x] H-09: dictionary-sync requireWriteAccess (PLANNER moze sync)
- [x] H-10: Nowe zlecenie POST na frontendzie (OrderDrawer create mode)
- [x] NEW-01: isDirty nie śledził zmian complaintReason — dodano `computeDirty()` z `originalComplaintReasonRef` w OrderForm.tsx (sesja 12)
- [x] NEW-02: Zamiana deprecated `React.MutableRefObject` na `React.RefObject` w OrderForm.tsx (sesja 12)

### MEDIUM (sesje 3-13)
- [x] M-04: patchStop — dodano guard READONLY_STATUSES (zrealizowane/anulowane) (sesja 12)
- [x] M-05: patchStop — dodano auto-korekta gdy edycja stopu w zleceniu wysłanym (sesja 12)
- [x] M-06: OrderDetailDto — dodano 7 pól (statusName, weekNumber, sentAt, sentByUserName, createdByUserName, updatedByUserName, lockedByUserName) + JOINy z order_statuses i user_profiles w getOrderDetail (sesja 13)
- [x] M-08: autoSetDocumentsAndCurrency — usunięto martwy kod `if (!userCurrency)` (sesja 13)
- [x] M-10: Dodano MAX_CACHE_SIZE (10k) na idempotency cache z FIFO eviction + MAX_RATE_BUCKETS (50k) na rate limiter (sesja 12)
- [x] M-11: Rate limiting — identyfikacja klienta po JWT sub claim zamiast slice(-16) tokena, fallback na IP (sesja 12)
- [x] M-12: Dodano `.min(1).max(11)` na stops i `.max(50)` na items w Zod walidatorach + 10 nowych testów (sesja 12)
- [x] M-13: Usunięto X-XSS-Protection, dodano CSP (`default-src 'none'; frame-ancestors 'none'`) i Referrer-Policy (sesja 12)
- [x] M-14: duplicateOrder — dodano walidację FK (vehicle_variants, transport_types, companies, locations, products) + fix testów (sesja 13)
- [x] M-15: AbortController z timeout 30s na fetch() w api-client.ts (sesja 13)
- [x] M-16: Lock catch block w OrderDrawer ustawia lockedByUserName przy bledzie — drawer otwiera sie readonly (sesja 4)
- [x] M-17: lockedByUserName — JOIN z user_profiles w getOrderDetail + pole w OrderDetailDto (sesja 13)
- [x] M-18 (częściowo): POST /duplicate teraz wywolywany z context menu. PATCH /stops/{stopId} — nadal nieuzywany (sesja 5)
- [x] M-19: Accept header — `raw: true` → `Accept: */*` zamiast `application/json` w api-client.ts (sesja 13)

### LOW (sesja 12)
- [x] L-06: Dodano `updated_by_user_id` do `cancelOrder()`, `restoreOrder()` i `changeStatus()` + 2 nowe testy (sesja 12)
- [x] L-08: Usunięto `src/lib/utils/format.ts` (183 linii, 0 importów) + pusty katalog `utils/` (sesja 12)
- [x] L-09: Usunięte razem z L-08 (sesja 12)

### FIXy i CLEANUP (sesje 3-11)
- [x] Migracja RPC zastosowana do lokalnej bazy — przyczyna 500 na lock i PUT
- [x] NotesSection MAX_NOTES zmieniony z 1000 na 500
- [x] PUT stops body — usunieto zbedne snapshot pola
- [x] handleDrawerClose w OrdersPage opakowany w useCallback
- [x] "Lost this" bug — `supabase.rpc` kontekst `this` (sesja 4)
- [x] PostgREST v14 bug — `.or()` + `.select()` (sesja 4)
- [x] PostgREST schema cache — restart po migracji (sesja 4)
- [x] Usunięto martwy kod `isLockExpired()` i `buildSnapshotsForItem()`
- [x] Dodano `SheetDescription` (sr-only) w OrderDrawer
- [x] Context menu Radix pointerup race condition — time-based guard 300ms (sesja 10)
- [x] ContextMenuSubContent Portal + collisionPadding (sesja 10)
- [x] Zamiana native confirm() na shadcn AlertDialog (sesja 10)
- [x] Auto-scroll po duplikacji zlecenia (sesja 10)
- [x] 500 na PUT — UNIQUE constraint fix (3-fazowe przetwarzanie stops)

### UI (sesje 5-9)
- [x] Badge'e unloading — blue (bg-blue-100 text-blue-700)
- [x] Daty w tabeli — format DD.MM, tylko pierwsza data
- [x] "Skopiuj zlecenie" w menu kontekstowym + POST /duplicate
- [x] Usunięto legacy transport codes (KRAJ, MIEDZY, EKSPRES)
- [x] "Wyślij maila" dostępne dla statusów wysłane/korekta wysłane
- [x] Order View (A4): Refaktoring stopów — unified stops[] z DnD (sesja 9)

### DOCS (sesje 5-8)
- [x] PRD §3.1.7 + api-plan §2.7 — poprawiono opis statusu `reklamacja`
- [x] PRD — "Korekta_w", format DD.MM, tylko pierwsza data
- [x] ui-plan.md — usunięto sticky kolumnę Akcje, format DD.MM, generalNotes max 500

### HIGH — naruszenia PRD (sesja 14)
- [x] P-01: patchStop — logowanie zmian do order_change_log (daty, lokalizacje, notatki) (sesja 14)
- [x] P-02: patchStop auto-korekta — wpis do order_status_history gdy shouldAutoKorekta=true (sesja 14)
- [x] P-03: complaintReason — spread warunkowy zamiast `?? null`, nie nadpisuje undefined (sesja 14)
- [x] P-04: patchStop — race condition guard `.not("status_code", "in", "(zrealizowane,anulowane)")` na UPDATE (sesja 14)

### MEDIUM (sesja 14)
- [x] M-03: order_change_log w cancelOrder, restoreOrder, prepareEmailForOrder — spójność z changeStatus() (sesja 14)

### MEDIUM — transakcje + logowanie (sesja 15)
- [x] M-01: Compensating cleanup w createOrder/duplicateOrder — try/catch + DELETE osierconego nagłówka (sesja 15)
- [x] M-02: Logowanie zmian 18 pól biznesowych w updateOrder do order_change_log (PRD §3.1.8) (sesja 15)

### MEDIUM + LOW — Faza 6 walidatory + defensive (sesja 14)
- [x] M-24: isoDateSchema/isoTimeSchema — .refine() z walidacją zakresu + 3 nowe testy (sesja 14)
- [x] L-12: formatDateShort — guard `parts.length !== 3` (już istniał w kodzie, nie wymagał zmian)
- [x] L-13: getInitials() — guard na whitespace-only string via `name?.trim()` (sesja 14)
- [x] L-14: senderContactEmail — `z.preprocess(v => v === "" ? null : v, ...)` (sesja 14)

### DOCS — Faza 7 dokumentacja (sesja 14)
- [x] DOC-01: api-plan.md §2.3 — dodano `lockedByUserName` do OrderDetailDto (sesja 14)
- [x] DOC-02: api-plan.md §4 — dodano przejście korekta→reklamacja w opisie ALLOWED_TRANSITIONS (sesja 14)
- [x] DOC-03: api-plan.md §2.10a — dodano dokumentację PATCH /orders/{id}/carrier-color (sesja 14)
- [x] DOC-04: api-plan.md §4 — uściślono politykę logowania order_change_log i order_status_history (sesja 14)

### MEDIUM — API consistency (sesja 14)
- [x] M-20: Ujednolicenie JOIN FK syntax — getOrderDetail na pełne constraint names (sesja 14)
- [x] M-21: Dodano sent_by_user JOIN w listOrders + fix mappera (sesja 14)
- [x] M-22: statusName w CreateOrderResponseDto i DuplicateOrderResponseDto + query order_statuses (sesja 14)
- [x] M-23: FK_VALIDATION casting — ujednolicenie `as Error & { details }` w duplicateOrder (sesja 14)

### INFRA (sesje 10-12)
- [x] System custom agents — 7 agentów (.claude/agents/), slash commands, pamięć agentów, CLAUDE.md orchestrator (sesja 10)
- [x] Unit testy — 9 nowych plików testowych + 2 helpery. Łącznie 253 testów (z 35→241→253), 0 błędów TS (sesje 11-12)
- [x] Pełny audyt projektu z 5 agentami równolegle — spójność docs↔kod ~95% (sesja 12)
- [x] Dark mode — kompletny: anti-flash script, ThemeProvider, ThemeToggle, 40 komponentów z `dark:` klasami (sesje 6-8)

### MEDIUM — sortowanie + docs (sesja 16)
- [x] M-07: Sortowanie order_no — dodano kolumnę `order_seq_no INT` + trigger auto-extract + indeks + SORT_COLUMN zmieniony na `order_seq_no` (sesja 16)
- [x] M-09: dateFrom/dateTo filtruje only first_loading_date — won't fix: UI nie ma osobnych inputów dat, filtr tygodniowy działa po dacie załadunku by design; uściślono api-plan.md (sesja 16)

---

## LOW — nice to have

### L-01. Lock możliwy na anulowanych/zrealizowanych
- **Plik:** `order-lock.service.ts`
- Niespójność logiki — nie stanowi zagrożenia.

### L-02. Brak paginacji w endpointach słownikowych
- **Pliki:** companies, locations, products
- Przy dużych zbiorach może być problemem wydajnościowym.

### L-04. buildSnapshotsForCarrier nie pobiera address/location name
- **Plik:** `order.service.ts:502-521`
- Snapshoty adresu i lokalizacji przewoźnika są zawsze null.

### L-10. unsafe type casts w api-client.ts
- `undefined as T`, `JSON.parse(text) as T`, `response as unknown as T`.
- Standardowe w TS, ale brak runtime walidacji.

### L-11. week-utils.ts regex fałszywie akceptuje format
- Regex `[W-]?` jest opcjonalny, więc `"202607"` matchuje.


### L-15. Brak testów: postRaw Accept header + AbortController timeout
- **Plik:** `api-client.test.ts`
- Dwie nowe ścieżki kodu bez pokrycia testami.

### L-16. listOrders 5 filtrów niezaimplementowanych
- **Plik:** `order.service.ts:118-119`
- productId, loadingLocationId, loadingCompanyId, unloadingLocationId, unloadingCompanyId — walidowane ale ignorowane.
- Komentarz w kodzie: "na razie nie stosowane".

---

---

## Otwarte decyzje (pending user)

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook istnieje ale nieużywany — OrderDrawer robi fetch + lock + unlock wewnętrznie.
- Opcja: usunąć martwy plik lub refaktoryzować OrderDrawer.

### Zamknięte decyzje (sesja 16)
- [x] D-01: READ_ONLY — weryfikacja kompletna: 8 komponentów poprawnie ukrywa akcje (OrdersPage, FilterBar, SyncButton, OrderRowContextMenu, OrderDrawer, DrawerFooter, OrderForm sections, RoutePointCard)
- [x] D-04: UserAvatar — komponent wbudowany w TimelineEntry.tsx, działa prawidłowo; ekstrakcja do osobnego pliku opcjonalna
