# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-24 (sesja 11)
> Kontekst: Audyt API wykazal 37 problemow. Naprawiono 3 CRITICAL + 10 HIGH + 7 dodatkowych fixow. Sesje 5-8: naprawa rozbieznosci UI/docs, kolory statusow (C-01/C-02/C-03), dark mode (kompletny). Sesja 9: refaktoring stopow w Order View (A4) — unified stops[] z DnD i autocomplete. Sesja 10: context menu fix (Radix pointerup race), auto-scroll duplicate, AlertDialog cancel, system agentów. Sesja 11: unit testy — 9 nowych plików testowych + 2 helpery, łącznie 241 testów (z 35 → 241).

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

---

## CRITICAL — kolory statusów (odkryte sesja 5, do decyzji)

### ~~C-01/C-03. Tło wierszy — zmienione wymaganie~~ ✅ NAPRAWIONE (sesja 5)
- ROW_BG teraz: tylko `wysłane` i `korekta wysłane` → `bg-emerald-50/30` (zielone). Reszta = białe.
- Docs (PRD + ui-plan) zaktualizowane.

### ~~C-02. Korekta wysłane: yellow zamiast amber w StatusBadge~~ ✅ NAPRAWIONE (sesja 5)
- Zmieniono `yellow-*` → `amber-*` w StatusBadge.tsx. Dodatkowo naprawiono zamienione kolory Wysłane↔Zrealizowane (blue↔emerald).
- Naprawiono 500 na PUT — UNIQUE constraint `(order_id, sequence_no)` w order_stops. Zmieniono na 3-fazowe przetwarzanie (delete → temp offset → update/insert).

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

### M-04. patchStop nie sprawdza statusu zlecenia (readonly)
- **Plik:** `order.service.ts:1655-1765`
- **Problem:** Mozna zmodyfikowac stop zlecenia "zrealizowane" lub "anulowane".
- **Rozwiazanie:** Dodac check `if (order.status_code === "zrealizowane" || "anulowane") throw`.

### M-05. patchStop nie triggeruje auto-korekta
- **Plik:** `order.service.ts:1655-1765`
- **Problem:** Zmiana stop w zleceniu "wyslane" nie zmienia statusu na "korekta".
- **Rozwiazanie:** Dodac logike auto-korekta jak w updateOrder.

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

### M-10. Idempotency cache bez limitu wielkosci (memory DoS)
- **Plik:** `middleware.ts:57-59`
- **Problem:** In-memory Map bez max size, TTL 24h. Atakujacy moze wyczerpac pamiec.
- **Rozwiazanie:** Dodac maxSize (np. 10000 entries) z LRU eviction.

### M-11. Rate limiting — slaba identyfikacja klienta
- **Plik:** `middleware.ts:121`
- **Problem:** Bazuje na ostatnich 16 znakach tokena. Mozna obejsc roznymi tokenami.
- **Rozwiazanie:** Uzyc user ID z zwalidowanego tokena lub IP + fingerprint.

### M-12. Brak limitu tablicy stops/items w Zod
- **Plik:** `order.validator.ts:105-106`
- **Problem:** `z.array(...)` bez `.max()` — mozna wyslac tysiace elementow.
- **Rozwiazanie:** Dodac `.max(11)` dla stops (8+3) i `.max(50)` dla items.

### M-13. Deprecjonowany X-XSS-Protection + brak CSP
- **Plik:** `api-helpers.ts:23`
- **Problem:** `X-XSS-Protection: 1; mode=block` jest przestarzaly. Brak CSP, Referrer-Policy.
- **Rozwiazanie:** Usunac X-XSS-Protection, dodac `Content-Security-Policy: default-src 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`.

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

### L-06. restoreOrder nie ustawia updated_by_user_id
- **Plik:** `order-status.service.ts:196-200`
- Trigger aktualizuje updated_at, ale nie widac kto przywrocil.

### L-07. statusName brak w odpowiedziach API
- **Pliki:** OrderDetailDto, CreateOrderResponseDto
- api-plan wymienia statusName, ale nie jest zwracany. Frontend mapuje sam.

### L-08. Duplikacja format-utils (martwy kod)
- `src/lib/utils/format.ts` — 0 importow, identyczny z `src/lib/format-utils.ts`.
- Usunac `utils/format.ts`.

### L-09. Duplikacja week-utils (martwy kod getWeekDateRange)
- `src/lib/utils/format.ts:getWeekDateRange` — 0 importow.
- Usunac razem z L-08.

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
