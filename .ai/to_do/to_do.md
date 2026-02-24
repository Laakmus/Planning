# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-24 (sesja 13)
> Kontekst: Audyt API wykazal 37 problemow. Naprawiono 3 CRITICAL + 10 HIGH + 7 dodatkowych fixow. Sesje 5-8: naprawa rozbieznosci UI/docs, kolory statusow (C-01/C-02/C-03), dark mode (kompletny). Sesja 9: refaktoring stopow w Order View (A4) — unified stops[] z DnD i autocomplete. Sesja 10: context menu fix (Radix pointerup race), auto-scroll duplicate, AlertDialog cancel, system agentów. Sesja 11: unit testy — 9 nowych plików testowych + 2 helpery, łącznie 241 testów (z 35 → 241). Sesja 12: pełny audyt projektu (5 agentów równolegle) — weryfikacja TODO vs kod, spójność docs↔kod (~95%), Faza 1 + Faza 2 = 11 fixów, testy 241→253. Sesja 13: Faza 3 (Data Integrity) — 6 fixów (M-06, M-08, M-14, M-15, M-17, M-19).

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

### INFRA (sesje 10-12)
- [x] System custom agents — 7 agentów (.claude/agents/), slash commands, pamięć agentów, CLAUDE.md orchestrator (sesja 10)
- [x] Unit testy — 9 nowych plików testowych + 2 helpery. Łącznie 253 testów (z 35→241→253), 0 błędów TS (sesje 11-12)
- [x] Pełny audyt projektu z 5 agentami równolegle — spójność docs↔kod ~95% (sesja 12)
- [x] Dark mode — kompletny: anti-flash script, ThemeProvider, ThemeToggle, 40 komponentów z `dark:` klasami (sesje 6-8)

---

## MEDIUM — do zrobienia

### M-01. Brak transakcji w operacjach wielokrokowych
- **Pliki:** `order.service.ts` (createOrder, updateOrder, duplicateOrder)
- **Problem:** INSERT transport_orders + INSERT stops + INSERT items to 3 osobne zapytania. Jesli jedno padnie, dane sa niespojne.
- **Rozwiazanie:** Uzyc RPC (stored procedure) lub Supabase Edge Function z transakcja.

### M-02. Brak logu zmian pol biznesowych (order_change_log) w updateOrder
- **Plik:** `order.service.ts:1495-1512`
- **Problem:** PRD §3.1.8 wymaga logowania zmian: daty, miejsca, ilosci, przewoznik, cena. Obecnie logowane sa tylko zmiany statusu.
- **Rozwiazanie:** Porownac stary i nowy stan pol, wstawic roznice do `order_change_log`.

### M-03. Brak logowania do order_change_log w cancel, restore, prepare-email
- **Pliki:** `order-status.service.ts` (cancelOrder, restoreOrder), `order.service.ts` (prepareEmailForOrder)
- **Problem:** Te operacje loguja do `order_status_history`, ale NIE do `order_change_log`.
- **Rozwiazanie:** Dodac INSERT do `order_change_log` z field_name="status_code".

### M-07. Sortowanie po order_no (tekst) — problem po >9999 zlecen
- **Plik:** `order.service.ts:47`
- **Problem:** `ZT2026/10000` < `ZT2026/9999` w sortowaniu tekstowym.
- **Rozwiazanie:** Sortowac po extracted numeric part lub dodac kolumne `order_seq_no INT`.

### M-09. dateFrom/dateTo filtruje tylko first_loading_date
- **Plik:** `order.service.ts:285-289`
- **Problem:** api-plan mowi "zakres dat zaladunku/rozladunku" — sugeruje filtrowanie po obu.
- **Rozwiazanie:** Dodac OR z first_unloading_date lub zmienic spec.

---

## LOW — nice to have

### L-01. Lock mozliwy na anulowanych/zrealizowanych
- **Plik:** `order-lock.service.ts`
- Niespojnosc logiki — nie stanowi zagrożenia.

### L-02. Brak paginacji w endpointach slownikowych
- **Pliki:** companies, locations, products
- Przy duzych zbiorach moze byc problemem wydajnosciowym.

### L-03. isoDateSchema/isoTimeSchema bez walidacji zakresu
- Regex akceptuje `9999-99-99` i `99:99:99`.

### L-04. buildSnapshotsForCarrier nie pobiera address/location name
- **Plik:** `order.service.ts:502-521`
- Snapshoty adresu i lokalizacji przewoznika sa zawsze null.

### L-05. complaintReason moze zostac nadpisane null w updateOrder
- **Plik:** `order.service.ts:1367`
- Edycja zlecenia "reklamacja" bez complaintReason zeruje pole.

### L-07. statusName brak w CreateOrderResponseDto
- **Plik:** CreateOrderResponseDto
- api-plan wymienia statusName, ale nie jest zwracany w create response. OrderDetailDto już zawiera statusName (M-06).

### L-10. unsafe type casts w api-client.ts
- `undefined as T`, `JSON.parse(text) as T`, `response as unknown as T`.
- Standardowe w TS, ale brak runtime walidacji.

### L-11. week-utils.ts regex falszywie akceptuje format
- Regex `[W-]?` jest opcjonalny, wiec `"202607"` matchuje.

---

## Otwarte decyzje (pending user)

### D-01. READ_ONLY — weryfikacja ukrycia akcji we wszystkich komponentach
- Pkt 59 z planu implementacji.

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).

### D-04. history/UserAvatar.tsx — inicjaly inline w TimelineEntry
- Komponent nie wyekstrahowany.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook nie wydzielony — OrderDrawer robi fetch + lock + unlock wewnetrznie.
