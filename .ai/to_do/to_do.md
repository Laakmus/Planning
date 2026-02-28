# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-28 (sesja 17 — sync docs z PRD + READ_ONLY audit)

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
- [x] M-01: `changeStatus` czyści `complaint_reason` przy wyjściu ze statusu reklamacja
- [x] M-02: `updatedAt` w odpowiedzi PUT teraz z DB (SELECT po UPDATE)
- [x] M-03: Walidacja `dateFrom <= dateTo` w `orderListQuerySchema` (.refine)
- [x] M-04: `patchStop` waliduje kolejność trasy przy zmianie kind (INVALID_ROUTE_ORDER)
- [x] M-05: `/duplicate` obsługuje `FK_VALIDATION` → HTTP 422
- [x] M-06: won't fix — in-memory rate limiter OK dla MVP
- [x] M-07 (sort): `order_seq_no INT` + trigger + indeks (sortowanie numeryczne)
- [x] M-07 (DnD): `sortableIds`/`activeStops` → `useMemo` + pełne deps w `handleDragEnd`
- [x] M-08: CarrierSection `useEffect` synchronizuje stan pojazdu przy zmianie zlecenia
- [x] M-09 (filter): won't fix — filtr tygodniowy po dacie załadunku by design
- [x] M-09 (finance): Fallback `"Przelew"` usunięty — null → pusty placeholder
- [x] M-10: RouteSummaryCell sortuje po `sequenceNo` (obsługuje mieszane trasy)
- [x] M-11: StatusSection — powód reklamacji readonly gdy aktualny status=reklamacja, wymagany tylko przy pendingStatus=reklamacja
- [x] M-12: `vehicle_variant_code: string | null` w database.types.ts (Row/Insert/Update)
- [x] M-13: won't fix — `orderNo` w UpdateOrderResponseDto jest przydatne, docs update minor
- [x] M-14: won't fix — auto-waluta frontend-only OK dla MVP
- [x] M-15: już naprawione — `prepare-email` aktualizuje `main_product_name` (kod weryfikuje)
- [x] M-16: deferred — FilterBar filtr po lokalizacji to feature work
- [x] M-17: deferred — job czyszczący anulowane wymaga pg_cron (infrastructure)

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

### L-20. ~~`order_seq_no` i `carrier_cell_color` nieudokumentowane w db-plan~~ — DONE (sesja 17)

---

## Zrobione (sesja 17 — sync docs + audit)

- [x] Sync dokumentacji .ai/ z PRD jako źródłem prawdy (6 plików naprawionych, 1 usunięty)
  - drawer-ui-architecture.md: renumeracja sekcji 1-7 → 0-6, generalNotes 1000→500
  - orders-view-implementation-plan.md: tła wierszy, daty DD.MM, generalNotes, vehicle 2 pola, StatusBadge lowercase + display names
  - view-implementation-plan.md: reklamacja dozwolona z korekta
  - order.md: packagingType → loading_method_code
  - db-plan.md: dodano order_seq_no + carrier_cell_color
  - ui-architecture-summary.md: usunięty (przestarzały)
- [x] READ_ONLY audit: 58 komponentów sprawdzonych, wszystkie akcje chronione
  - StatusSection.tsx: dodano defensywny prop isReadOnly
- [x] L-20: order_seq_no i carrier_cell_color udokumentowane w db-plan

## Otwarte decyzje (pending user)

### D-03. PDF endpoint — stub 501 po stronie serwera
- Wymaga generatora PDF (np. Puppeteer, jsPDF, Reportlab).
- W przyszłości będzie powiązany z widokiem z order.md.

### D-05. hooks/useOrderDetail.ts — logika wbudowana w OrderDrawer
- Hook istnieje ale nieużywany — usunąć lub refaktoryzować.
- User: do decyzji (refaktoring, nie zmienia funkcjonalności).
