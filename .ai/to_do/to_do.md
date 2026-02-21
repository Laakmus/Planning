# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-21 (sesja 4)
> Kontekst: Audyt API wykazal 37 problemow. Naprawiono 3 CRITICAL + 10 HIGH + 7 dodatkowych fixow. Ponizej pozostale.

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

### M-18. Endpointy duplicate i PATCH stops nieuzywane przez frontend
- **Problem:** Backend ma POST /duplicate i PATCH /stops/{stopId}, ale frontend ich nie wywoluje.
- **Rozwiazanie:** Zaimplementowac w UI (context menu "Duplikuj", inline edit stopu).

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

### D-02. Dark mode — pelna weryfikacja dark: klas w drawer i history
- Pkt 57 z planu implementacji.

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).

### D-04. history/UserAvatar.tsx — inicjaly inline w TimelineEntry
- Komponent nie wyekstrahowany.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook nie wydzielony — OrderDrawer robi fetch + lock + unlock wewnetrznie.
