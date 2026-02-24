# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-24 (sesja 13)
> Kontekst: Sesje 3-12: audyt API (37 problemów), naprawa 3 CRITICAL + 10 HIGH + liczne MEDIUM/LOW. Sesja 13: Faza 3 (M-06, M-08, M-14, M-15, M-17, M-19) + pełny re-audyt (8 agentów: PRD↔kod, api-plan↔kod, ui-plan↔kod, db-plan↔kod, nowe bugi). Wynik: 5 naruszeń PRD, 8 rozbieżności api-plan, 12 nowych problemów.

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

## HIGH — naruszenia PRD / krytyczne rozbieżności

### P-01. patchStop brak logowania zmian w order_change_log
- **Plik:** `order.service.ts:1718-1840`
- **PRD §3.1.8:** "logować zmiany kluczowych danych (daty, miejsca załadunku/rozładunku)"
- **Problem:** patchStop edytuje stopy i denormalizację, ale NIE wstawia do `order_change_log`.
- **Rozwiązanie:** INSERT do `order_change_log` dla każdego zmienionego pola stopu.

### P-02. patchStop auto-korekta brak wpisu w order_status_history
- **Plik:** `order.service.ts:1816`
- **PRD §3.1.7:** Automatyczne przejście wysłane→korekta powinno być śledzone.
- **Problem:** Ustawia `status_code='korekta'` ale NIE tworzy wpisu w `order_status_history`.
- **Rozwiązanie:** Dodać INSERT `order_status_history` gdy `shouldAutoKorekta=true`.

### P-03. complaintReason nadpisane null w updateOrder (awans z L-05)
- **Plik:** `order.service.ts:1406`
- **PRD §3.1.7:** complaintReason obowiązkowe przy statusie reklamacja.
- **Problem:** `complaint_reason: params.complaintReason ?? null` — gdy frontend nie wysyła pola (undefined), powód reklamacji znika.
- **Rozwiązanie:** Nie ustawiać pola w payload gdy `params.complaintReason === undefined`.

### P-04. patchStop race condition na READONLY_STATUSES
- **Plik:** `order.service.ts:1738-1802`
- **Problem:** Między SELECT (sprawdzenie statusu) a UPDATE brak guardu na status. Równoległa zmiana na "zrealizowane" nie jest blokowana.
- **Rozwiązanie:** Dodać `.not("status_code", "in", "(zrealizowane,anulowane)")` do UPDATE.

## MEDIUM — do zrobienia

### M-01. Brak transakcji w operacjach wielokrokowych
- **Pliki:** `order.service.ts` (createOrder, updateOrder, duplicateOrder)
- **Problem:** INSERT transport_orders + INSERT stops + INSERT items to 3 osobne zapytania. Jeśli jedno padnie, dane są niespójne.
- **Rozwiązanie:** Użyć RPC (stored procedure) lub Supabase Edge Function z transakcją.

### M-02. Brak logu zmian pól biznesowych (order_change_log) w updateOrder
- **Plik:** `order.service.ts:1495-1512`
- **Problem:** PRD §3.1.8 wymaga logowania zmian: daty, miejsca, ilości, przewoźnik, cena. Obecnie logowane są tylko zmiany statusu.
- **Rozwiązanie:** Porównać stary i nowy stan pól, wstawić różnice do `order_change_log`.

### M-03. Brak logowania do order_change_log w cancel, restore, prepare-email
- **Pliki:** `order-status.service.ts` (cancelOrder, restoreOrder), `order.service.ts` (prepareEmailForOrder)
- **Problem:** Te operacje logują do `order_status_history`, ale NIE do `order_change_log`. `changeStatus()` robi oba — niespójność.
- **Rozwiązanie:** Dodać INSERT do `order_change_log` z field_name="status_code".

### M-07. Sortowanie po order_no (tekst) — problem po >9999 zleceń
- **Plik:** `order.service.ts:47`
- **Problem:** `ZT2026/10000` < `ZT2026/9999` w sortowaniu tekstowym.
- **Rozwiązanie:** Sortować po extracted numeric part lub dodać kolumnę `order_seq_no INT`.

### M-09. dateFrom/dateTo filtruje tylko first_loading_date
- **Plik:** `order.service.ts:285-289`
- **Problem:** PRD mówi "zakres dat (np. data załadunku, data rozładunku)" — sugeruje filtrowanie po obu.
- **Rozwiązanie:** Dodać OR z first_unloading_date lub zmienić spec.

### M-20. JOIN FK syntax niespójny między listOrders a getOrderDetail
- **Plik:** `order.service.ts:265-267 vs 405-409`
- **Problem:** listOrders używa jawnych constraint names (`!transport_orders_created_by_user_id_fkey`), getOrderDetail używa krótszej formy (`!created_by_user_id`). Może crashnąć na niektórych wersjach PostgREST.
- **Rozwiązanie:** Ujednolicić do jednej składni (preferowana: constraint name).

### M-21. Brak sent_by JOIN w listOrders
- **Plik:** `order.service.ts:260-268`
- **Problem:** `sentByUserName` w liście zleceń zawsze = null, bo brak JOINu (a w getOrderDetail jest).
- **Rozwiązanie:** Dodać `sent_by_user:user_profiles!transport_orders_sent_by_user_id_fkey(full_name)` do listOrders SELECT.

### M-22. statusName brak w CreateOrderResponseDto i DuplicateOrderResponseDto (awans z L-07)
- **Pliki:** `types.ts`, `order.service.ts:991, 1218`
- **Problem:** api-plan §2.4 i §2.9 wymagają `statusName` w odpowiedzi. Kod go nie zwraca.
- **Rozwiązanie:** Dodać `statusName: string` do obu DTO + zwracać w serwisie.

### M-23. FK_VALIDATION type casting niespójny
- **Plik:** `order.service.ts:890, 1045, 1286`
- **Problem:** duplicateOrder używa `as any`, createOrder/updateOrder używa `as Error & { details }`.
- **Rozwiązanie:** Ujednolicić do jednej formy.

### M-24. isoDateSchema/isoTimeSchema bez walidacji zakresu (awans z L-03)
- **Plik:** `common.validator.ts:15-18`
- **PRD §3.1.9:** ISO 8601. Regex akceptuje `2026-13-45`, `25:99`.
- **Rozwiązanie:** Dodać `.refine()` z walidacją zakresu lub użyć `z.coerce.date()`.

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

### L-12. formatDateShort crash na niepełnej dacie
- **Plik:** `format-utils.ts:19-21`
- `"2026-02".split("-")` → `parts[2]` = undefined → wyświetli `"undefined.02"`.
- **Rozwiązanie:** Dodać `if (parts.length !== 3) return date;`.

### L-13. getInitials() crash na pustym imieniu
- **Plik:** `TimelineEntry.tsx:23-24`
- `"".split(/\s+/)` → `[""]` → `[0][0]` = undefined.
- **Rozwiązanie:** Dodać guard na pusty string.

### L-14. senderContactEmail empty string vs null w walidatorze
- **Plik:** `order.validator.ts:104`
- Pusty string (`""`) failuje `.email()` zamiast być traktowany jak null.
- **Rozwiązanie:** `.transform(v => v === "" ? null : v)` przed `.email()`.

### L-15. Brak testów: postRaw Accept header + AbortController timeout
- **Plik:** `api-client.test.ts`
- Dwie nowe ścieżki kodu bez pokrycia testami.

### L-16. listOrders 5 filtrów niezaimplementowanych
- **Plik:** `order.service.ts:118-119`
- productId, loadingLocationId, loadingCompanyId, unloadingLocationId, unloadingCompanyId — walidowane ale ignorowane.
- Komentarz w kodzie: "na razie nie stosowane".

---

## DOCS — dokumentacja do aktualizacji

### DOC-01. api-plan.md §2.3 — brakuje 5 nowych pól OrderDetailDto
- statusName, weekNumber, createdByUserName, updatedByUserName, lockedByUserName

### DOC-02. api-plan.md §4 — brak przejścia korekta→reklamacja w ALLOWED_TRANSITIONS

### DOC-03. api-plan.md — brak dokumentacji PATCH /orders/{id}/carrier-color

### DOC-04. api-plan.md — uściślić politykę order_change_log (kiedy logować)

---

## Otwarte decyzje (pending user)

### D-01. READ_ONLY — weryfikacja ukrycia akcji we wszystkich komponentach
- Pkt 59 z planu implementacji.

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).

### D-04. history/UserAvatar.tsx — inicjały inline w TimelineEntry
- Komponent nie wyekstrahowany.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook nie wydzielony — OrderDrawer robi fetch + lock + unlock wewnętrznie.
