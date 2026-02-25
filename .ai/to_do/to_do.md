# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-25 (sesja 16)

---

## Zrobione (sesja 16)

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
- [x] M-07: `order_seq_no INT` + trigger + indeks (sortowanie numeryczne)
- [x] M-09: won't fix — filtr tygodniowy po dacie załadunku by design

---

## MEDIUM

### M-01. `changeStatus` nie czyści `complaint_reason` przy wyjściu ze statusu reklamacja
- **Plik:** `order-status.service.ts:124-129`

### M-02. `updatedAt` w odpowiedzi PUT pochodzi z `Date.now()`, nie z DB
- **Plik:** `order.service.ts:1692`

### M-03. Brak walidacji `dateFrom <= dateTo`
- **Plik:** `order.validator.ts:33-34`

### M-04. `patchStop` pozwala zmienić `kind` bez walidacji kolejności trasy
- **Plik:** `[stopId].ts:60-63`

### M-05. `/duplicate` nie obsługuje błędu `FK_VALIDATION` → HTTP 500
- **Plik:** `duplicate.ts:57-64`

### M-06. In-memory rate limiter/idempotency nie skaluje się (OK dla MVP)
- **Plik:** `middleware.ts:18-64`

### M-07. Stale closure `sortableIds` w `handleDragEnd`
- **Plik:** `RouteSection.tsx:168-169`

### M-08. Lokalny stan pojazdu w CarrierSection nie synchronizuje się przy zmianie zlecenia
- **Plik:** `CarrierSection.tsx:50-58`

### M-09. Fallback `"Przelew"` dla null maskuje faktyczną wartość
- **Plik:** `FinanceSection.tsx:105`

### M-10. RouteSummaryCell sortuje stopy po `kind` zamiast `sequenceNo`
- **Plik:** `RouteSummaryCell.tsx:25-26`

### M-11. Pole "Powód reklamacji" wyświetlane jako wymagane bez zmiany statusu
- **Plik:** `StatusSection.tsx:72-73`

### M-12. `vehicle_variant_code` nullable po migracji, `database.types.ts` mówi `string`
- **Plik:** `database.types.ts:416`

### M-13. `UpdateOrderResponseDto` zawiera `orderNo` — nieudokumentowane w api-plan §2.5
- **Plik:** `types.ts:311-317`

### M-14. Auto-waluta przy zmianie transportType — tylko frontend, backend nie egzekwuje
- **Plik:** `order.service.ts:734-751`

### M-15. `prepare-email` nie aktualizuje `main_product_name` (opisane w api-plan §2.15)
- **Plik:** `order.service.ts:1727+`

### M-16. FilterBar — brak filtra po lokalizacji (tylko po firmie)
- **Plik:** `FilterBar.tsx`

### M-17. Brak jobu czyszczącego anulowane zlecenia po 24h (opisane w PRD/api-plan)
- Wymaga implementacji `pg_cron` lub scheduled function.

---

## LOW

### L-01. Lock możliwy na anulowanych/zrealizowanych
- **Plik:** `order-lock.service.ts`

### L-02. Brak paginacji w endpointach słownikowych
- **Pliki:** companies, locations, products

### L-04. buildSnapshotsForCarrier nie pobiera address/location name
- **Plik:** `order.service.ts:524-543`

### L-10. unsafe type casts w api-client.ts

### L-11. week-utils.ts regex fałszywie akceptuje format

### L-15. Brak testów: postRaw Accept header + AbortController timeout

### L-16. listOrders 5 filtrów niezaimplementowanych

### L-17. JWT bez weryfikacji podpisu w `extractSubFromJwt`
- **Plik:** `middleware.ts:92-103`

### L-18. Brak `dark:` na etykietach w CarrierSection i EmptyState

### L-19. `span[role=button]` bez obsługi Space w AutocompleteField

### L-20. `order_seq_no` i `carrier_cell_color` nieudokumentowane w db-plan

---

## Otwarte decyzje (pending user)

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook istnieje ale nieużywany — usunąć lub refaktoryzować.
