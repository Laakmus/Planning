# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-24 (sesja 12)
> Kontekst: Audyt API wykazal 37 problemow. Naprawiono 3 CRITICAL + 10 HIGH + 7 dodatkowych fixow. Sesje 5-8: naprawa rozbieznosci UI/docs, kolory statusow (C-01/C-02/C-03), dark mode (kompletny). Sesja 9: refaktoring stopow w Order View (A4) — unified stops[] z DnD i autocomplete. Sesja 10: context menu fix (Radix pointerup race), auto-scroll duplicate, AlertDialog cancel, system agentów. Sesja 11: unit testy — 9 nowych plików testowych + 2 helpery, łącznie 241 testów (z 35 → 241). Sesja 12: pełny audyt projektu (5 agentów równolegle) — weryfikacja TODO vs kod, spójność docs↔kod (~95%), znaleziono 1 nowy bug (isDirty + complaintReason).

---

## Zrobione (referencja)

- [x] CRITICAL: Race condition w lockOrder (atomic RPC `try_lock_order`)
- [x] CRITICAL: Race condition w generateOrderNo (atomic RPC `generate_next_order_no`)
- [x] CRITICAL: TOCTOU bypass blokady/statusu (conditional WHERE w UPDATE)
- [x] HIGH H-01: handleSendEmail w OrdersPage — emailOpenUrl
- [x] HIGH H-02: autoSetDocumentsAndCurrency — poprawne dokumenty wg PRD
- [x] HIGH H-03: generalNotes max 500 (PRD + validator + DB zgodne)
- [x] HIGH H-04: ALLOWED_TRANSITIONS — korekta -> reklamacja
- [x] HIGH H-05: Server-side stop ordering (first=LOADING, last=UNLOADING)
- [x] HIGH H-06: Sanityzacja LIKE wildcards (4 lokalizacje)
- [x] HIGH H-07: CORS default localhost zamiast *
- [x] HIGH H-08: unlock.ts requireWriteAccess
- [x] HIGH H-09: dictionary-sync requireWriteAccess (PLANNER moze sync)
- [x] HIGH H-10: Nowe zlecenie POST na frontendzie (OrderDrawer create mode)
- [x] FIX: Migracja RPC (try_lock_order + generate_next_order_no) zastosowana do lokalnej bazy — przyczyna 500 na lock i PUT
- [x] FIX: NotesSection MAX_NOTES zmieniony z 1000 na 500 (zgodnosc z backend max 500)
- [x] FIX M-16: Lock catch block w OrderDrawer ustawia lockedByUserName przy bledzie — drawer otwiera sie readonly
- [x] FIX: PUT stops body — usunieto zbedne snapshot pola (companyNameSnapshot, locationNameSnapshot, addressSnapshot) — backend je odbudowuje z DB
- [x] FIX: handleDrawerClose w OrdersPage opakowany w useCallback — eliminacja cascading re-renders
- [x] FIX: "Lost this" bug — `supabase.rpc` wyciągany do zmiennej tracił `this` context → TypeError na lock i create order. Zmienione na `(supabase as any).rpc(...)` w order-lock.service.ts i order.service.ts
- [x] FIX: PostgREST v14 bug — `.or()` + `.select()` na UPDATE generuje nieprawidłowe SQL (`column does not exist`). updateOrder zmieniony na `{ count: "exact" }` bez `.select()` do wykrywania TOCTOU
- [x] FIX: PostgREST schema cache — restart `supabase_rest_Planning` po dodaniu migracji z RPC functions
- [x] CLEANUP: Usunięto martwy kod `isLockExpired()` z order-lock.service.ts (logika przeniesiona do RPC)
- [x] CLEANUP: Usunięto martwy kod `buildSnapshotsForItem()` z order.service.ts (zastąpiony batch wersją)
- [x] FIX: Dodano `SheetDescription` (sr-only) w OrderDrawer — eliminacja ostrzeżenia Radix `aria-describedby`
- [x] DOCS: PRD §3.1.7 + api-plan §2.7 — poprawiono opis statusu `reklamacja`: dozwolone przejście z `korekta` (było pominięte w tekście opisowym, choć tabela przejść ręcznych była poprawna)
- [x] UI-H02: Badge'e unloading — finalnie blue (bg-blue-100 text-blue-700) po rewercie z primary/10
- [x] UI-H03: Daty w tabeli — format DD.MM (nie DD.MM.YYYY), tylko pierwsza data
- [x] UI-H05: "Skopiuj zlecenie" w menu kontekstowym + endpoint POST /duplicate + OrdersPage.handleDuplicate
- [x] UI-H06: Usunięto legacy transport codes (KRAJ, MIEDZY, EKSPRES) z FilterBar i OrderRow
- [x] UI-H08: "Wyślij maila" dostępne dla statusów wysłane/korekta wysłane (OrderDrawer + OrderRowContextMenu)
- [x] DOCS: PRD — "Korekta_w" jako skrócona forma "Korekta wysłane" w tabeli, format DD.MM, tylko pierwsza data
- [x] DOCS: ui-plan.md — usunięto sticky kolumnę Akcje, format DD.MM, "Korekta_w", generalNotes max 500
- [x] Order View (A4): Refaktoring stopów — unified stops[] z DnD, CompanyAutocomplete, LocationAutocomplete (sesja 9)
- [x] FIX: Context menu Radix pointerup race condition — menu na dolnych wierszach przypadkowo triggerowało akcje (np. "Skopiuj zlecenie"). Fix: time-based guard (300ms) w OrderRowContextMenu (sesja 10)
- [x] FIX: ContextMenuSubContent bez Portal — submenu przycinane w overflow-auto kontenerach. Dodano Portal wrapper (sesja 10)
- [x] FIX: collisionPadding={8} w ContextMenuContent — lepsze pozycjonowanie menu przy krawędziach ekranu (sesja 10)
- [x] FIX: Zamiana native confirm() na shadcn AlertDialog w OrdersPage.handleCancel (sesja 10)
- [x] FIX: Auto-scroll na dół po duplikacji zlecenia + null denormalizowane daty → kopia na końcu listy (sesja 10)
- [x] INFRA: System custom agents — 7 agentów (.claude/agents/), slash commands (.claude/commands/), pamięć agentów (.claude/agent-memory/), CLAUDE.md orchestrator (sesja 10)
- [x] TESTS: Unit testy warstwy logiki biznesowej — 9 nowych plików testowych + 2 helpery (fixtures.ts, supabase-mock.ts). Pokrycie: format-utils (29), week-utils (13), common.validator (17), order.validator (42), order-history.service (9), dictionary.service (14), order-lock.service (15), order-status.service (21), order.service (42). Łącznie 241 testów, 0 błędów TS. (sesja 11)
- [x] AUDIT: Pełny audyt projektu z 5 agentami równolegle (sesja 12): weryfikacja TODO MEDIUM (16/19 nadal istnieje, M-16 fixed, M-18 partial), TODO LOW (11/11 potwierdzone), spójność docs↔kod (~95%), 0 błędów TS, 241 testów OK, build OK. Znaleziono 1 nowy bug (NEW-01: isDirty + complaintReason) + 1 deprecation (NEW-02: MutableRefObject).
- [x] FIX NEW-01: isDirty nie śledził zmian complaintReason — dodano `computeDirty()` z `originalComplaintReasonRef` w OrderForm.tsx (sesja 12)
- [x] FIX NEW-02: Zamiana deprecated `React.MutableRefObject` na `React.RefObject` w OrderForm.tsx (sesja 12)
- [x] FIX M-12: Dodano `.min(1).max(11)` na stops i `.max(50)` na items w Zod walidatorach + 10 nowych testów (sesja 12)
- [x] FIX L-06: Dodano `updated_by_user_id` do `cancelOrder()` i `restoreOrder()` w order-status.service.ts + 2 nowe testy (sesja 12)
- [x] CLEANUP L-08/L-09: Usunięto martwy kod `src/lib/utils/format.ts` (183 linii, 0 importów) (sesja 12)
- [x] FIX M-10: Dodano MAX_CACHE_SIZE (10k) na idempotency cache z FIFO eviction + MAX_RATE_BUCKETS (50k) na rate limiter (sesja 12)
- [x] FIX M-11: Rate limiting — identyfikacja klienta po JWT sub claim zamiast slice(-16) tokena, fallback na IP (sesja 12)
- [x] FIX M-13: Usunięto deprecated X-XSS-Protection, dodano Content-Security-Policy i Referrer-Policy (sesja 12)
- [x] FIX M-04: patchStop — dodano guard READONLY_STATUSES (zrealizowane/anulowane) (sesja 12)
- [x] FIX M-05: patchStop — dodano auto-korekta gdy edycja stopu w zleceniu wysłanym (sesja 12)
- [x] FIX L-06 ext: changeStatus() — dodano brakujące updated_by_user_id w updatePayload (sesja 12)

---

## CRITICAL — kolory statusów (odkryte sesja 5, do decyzji)

### ~~C-01/C-03. Tło wierszy — zmienione wymaganie~~ ✅ NAPRAWIONE (sesja 5)
- ROW_BG teraz: tylko `wysłane` i `korekta wysłane` → `bg-emerald-50/30` (zielone). Reszta = białe.
- Docs (PRD + ui-plan) zaktualizowane.

### ~~C-02. Korekta wysłane: yellow zamiast amber w StatusBadge~~ ✅ NAPRAWIONE (sesja 5)
- Zmieniono `yellow-*` → `amber-*` w StatusBadge.tsx. Dodatkowo naprawiono zamienione kolory Wysłane↔Zrealizowane (blue↔emerald).
- Naprawiono 500 na PUT — UNIQUE constraint `(order_id, sequence_no)` w order_stops. Zmieniono na 3-fazowe przetwarzanie (delete → temp offset → update/insert).

---

## HIGH — nowe bugi (odkryte sesja 12)

### ~~NEW-01. isDirty nie śledzi zmian complaintReason — utrata danych~~ ✅ NAPRAWIONE (sesja 12)
- Dodano `computeDirty()` z `originalComplaintReasonRef` — centralna logika dirty check uwzględniająca formData + pendingStatusCode + complaintReason.

### ~~NEW-02. MutableRefObject deprecated (TS hint)~~ ✅ NAPRAWIONE (sesja 12)
- Zmieniono `React.MutableRefObject` → `React.RefObject` w OrderForm.tsx.

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

### ~~M-04. patchStop nie sprawdza statusu zlecenia (readonly)~~ ✅ NAPRAWIONE (sesja 12)
- Dodano guard `READONLY_STATUSES.has(order.status_code)` → throw Error("READONLY") w patchStop.

### ~~M-05. patchStop nie triggeruje auto-korekta~~ ✅ NAPRAWIONE (sesja 12)
- Dodano `shouldAutoKorekta` + zmiana status_code na "korekta" w denormalization UPDATE.

### M-06. OrderDetailDto brakuje pol z api-plan.md
- **Pliki:** `types.ts` (OrderDetailDto), `order.service.ts` (getOrderDetail)
- **Problem:** Brak: `statusName`, `weekNumber`, `vehicleCapacityVolumeM3`, `createdByUserName`, `updatedByUserName`, `sentByUserName`, `sentAt`.
- **Rozwiazanie:** Dodac pola do DTO, zrobic JOINy w getOrderDetail z user_profiles i order_statuses.

### M-07. Sortowanie po order_no (tekst) — problem po >9999 zlecen
- **Plik:** `order.service.ts:47`
- **Problem:** `ZT2026/10000` < `ZT2026/9999` w sortowaniu tekstowym.
- **Rozwiazanie:** Sortowac po extracted numeric part lub dodac kolumne `order_seq_no INT`.

### M-08. autoSetDocumentsAndCurrency — waluta auto-set nigdy nie dziala
- **Plik:** `order.service.ts:739,744`
- **Problem:** `if (!userCurrency)` — ale currencyCode jest wymagany w Zod (enum), wiec zawsze truthy.
- **Rozwiazanie:** Usunac dead code lub zmienic logike (np. ustawiac walute tylko jesli frontend nie wysle).

### M-09. dateFrom/dateTo filtruje tylko first_loading_date
- **Plik:** `order.service.ts:285-289`
- **Problem:** api-plan mowi "zakres dat zaladunku/rozladunku" — sugeruje filtrowanie po obu.
- **Rozwiazanie:** Dodac OR z first_unloading_date lub zmienic spec.

### ~~M-10. Idempotency cache bez limitu wielkosci (memory DoS)~~ ✅ NAPRAWIONE (sesja 12)
- MAX_CACHE_SIZE=10k z FIFO eviction + MAX_RATE_BUCKETS=50k.

### ~~M-11. Rate limiting — slaba identyfikacja klienta~~ ✅ NAPRAWIONE (sesja 12)
- Identyfikacja po JWT sub claim (extractSubFromJwt), fallback na IP.

### ~~M-12. Brak limitu tablicy stops/items w Zod~~ ✅ NAPRAWIONE (sesja 12)
- Dodano `.min(1).max(11)` na stops i `.max(50)` na items w createOrderSchema i updateOrderSchema + 10 nowych testów.

### ~~M-13. Deprecjonowany X-XSS-Protection + brak CSP~~ ✅ NAPRAWIONE (sesja 12)
- Usunięto X-XSS-Protection, dodano CSP (`default-src 'none'; frame-ancestors 'none'`) i Referrer-Policy.

### M-14. duplicateOrder nie waliduje FK ani limitow stops
- **Plik:** `order.service.ts:866-979`
- **Problem:** Kopia zlecenia moze zawierac nieaktywne referencje (locations, products).
- **Rozwiazanie:** Dodac walidacje FK jak w createOrder.

### M-15. Brak timeout/abort na zapytaniach HTTP (frontend)
- **Plik:** `api-client.ts`
- **Problem:** `fetch()` bez `AbortController` — requesty moga wisiec w nieskonczonosc.
- **Rozwiazanie:** Dodac AbortController z timeout (np. 30s).

### ~~M-16. Brak obslugi 409 Conflict przy lock w drawer~~ ✅ NAPRAWIONE (2026-02-21)
- Catch block teraz ustawia `lockedByUserName` → drawer otwiera sie readonly.

### M-17. OrderDetailDto brak lockedByUserName
- **Pliki:** `types.ts:238-239`, `order.service.ts:406-454`
- **Problem:** Backend nie zwraca nazwy blokujacego. Drawer pokazuje "inny uzytkownik".
- **Rozwiazanie:** JOIN z user_profiles w getOrderDetail, dodac pole do DTO.

### ~~M-18. Endpointy duplicate i PATCH stops nieuzywane przez frontend~~ CZESCIOWO NAPRAWIONE (2026-02-21)
- POST /duplicate teraz wywolywany z context menu ("Skopiuj zlecenie") — OrderRowContextMenu + OrdersPage.handleDuplicate.
- PATCH /stops/{stopId} — nadal nieuzywany przez frontend (inline edit stopu do zaimplementowania).

### M-19. PDF Accept header ustawiony na application/json
- **Plik:** `api-client.ts:90-91`
- **Problem:** `postRaw` uzywa `Accept: application/json` zamiast `application/pdf`.
- **Rozwiazanie:** Przy `raw: true` ustawic `Accept: */*` lub `application/pdf`.

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

### ~~L-06. restoreOrder nie ustawia updated_by_user_id~~ ✅ NAPRAWIONE (sesja 12)
- Dodano `updated_by_user_id: userId` do `restoreOrder()` i `cancelOrder()` + 2 nowe testy.
- **UWAGA:** `changeStatus()` w tym samym pliku ma identyczny problem — do naprawy osobno.

### L-07. statusName brak w odpowiedziach API
- **Pliki:** OrderDetailDto, CreateOrderResponseDto
- api-plan wymienia statusName, ale nie jest zwracany. Frontend mapuje sam.

### ~~L-08. Duplikacja format-utils (martwy kod)~~ ✅ NAPRAWIONE (sesja 12)
- Usunięto `src/lib/utils/format.ts` (183 linii, 0 importów) + pusty katalog `utils/`.

### ~~L-09. Duplikacja week-utils (martwy kod getWeekDateRange)~~ ✅ NAPRAWIONE (sesja 12)
- Usunięte razem z L-08.

### L-10. unsafe type casts w api-client.ts
- `undefined as T`, `JSON.parse(text) as T`, `response as unknown as T`.
- Standardowe w TS, ale brak runtime walidacji.

### L-11. week-utils.ts regex falszywie akceptuje format
- Regex `[W-]?` jest opcjonalny, wiec `"202607"` matchuje.

---

## Otwarte decyzje (pending user)

### D-01. READ_ONLY — weryfikacja ukrycia akcji we wszystkich komponentach
- Pkt 59 z planu implementacji.

### ~~D-02. Dark mode — infrastruktura~~ ZROBIONE (sesja 6+7+8)
- [x] Anti-flash script w Layout.astro (inline, przed innymi skryptami)
- [x] ThemeProvider (next-themes) w OrdersApp.tsx (outermost) i LoginCard.tsx
- [x] ThemeToggle.tsx (Sun/Moon, mounted pattern) w AppHeader (miedzy SyncButton a UserInfo)
- [x] Dark mode classes w drawer i history components (sesja 7): NotesSection, CarrierSection, UnsavedChangesDialog, RoutePointCard, CargoSection, RouteSection, StatusSection, OrderForm, TimelineEntry, HistoryPanel, TimelineGroup
- [x] Dark mode classes w table/list components (sesja 8): LocationsCell, RouteSummaryCell, OrderRow, OrdersPage, OrderRowContextMenu, LockIndicator
- Pkt 57 z planu implementacji.

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).

### D-04. history/UserAvatar.tsx — inicjaly inline w TimelineEntry
- Komponent nie wyekstrahowany.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook nie wydzielony — OrderDrawer robi fetch + lock + unlock wewnetrznie.
