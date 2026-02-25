# Lista rzeczy do zrobienia (TODO)

> Ostatnia aktualizacja: 2026-02-25 (sesja 16, audyt)

---

## CRITICAL

### C-01. `SUPABASE_KEY` w middleware — ryzyko użycia service_role key
- **Pliki:** `middleware.ts:122`, `src/env.d.ts:16`, `.env.example`
- `.env.example` definiuje `SUPABASE_ANON_KEY`, ale kod używa `SUPABASE_KEY`. Jeśli `.env` ma service_role key → omija RLS.
- **Fix:** Ujednolicić na `SUPABASE_ANON_KEY` w middleware, env.d.ts, supabase.client.ts.

### C-02. `patchStop` — błędy READONLY/FORBIDDEN_EDIT → HTTP 500
- **Plik:** `src/pages/api/v1/orders/[orderId]/stops/[stopId].ts:76-87`
- Serwis rzuca `READONLY` i `FORBIDDEN_EDIT`, endpoint obsługuje tylko `LOCKED` → catch-all 500.
- **Fix:** Dodać obsługę obu błędów (400/409).

### C-03. Unlock po zapisie — race condition
- **Plik:** `src/components/orders/drawer/OrderDrawer.tsx:190-202, 313-323`
- `doClose()` (unlock) wywoływane **po** `onOrderUpdated()` (refetch) → okno na zablokowanie zlecenia.
- **Fix:** Wywołać unlock przed refetch.

---

## HIGH

### H-01. Idempotency cache sprawdzany przed auth — replay z fałszywym JWT
- **Plik:** `middleware.ts:170-210`
- Cache sprawdzany przed Supabase auth → fałszywy JWT z poprawnym `sub` odtwarza odpowiedź.
- **Fix:** Przenieść idempotency check po autentykacji.

### H-02. `unlockOrder` — TOCTOU, UPDATE bez warunku `locked_by_user_id`
- **Plik:** `order-lock.service.ts:101-104`
- SELECT → sprawdzenie → UPDATE bez `.eq("locked_by_user_id", userId)` → może usunąć cudzą blokadę.

### H-03. `prepareEmailForOrder` — UPDATE bez warunku na status (TOCTOU)
- **Plik:** `order.service.ts:1787-1792`
- Brak `.eq("status_code", ...)` → równoległa zmiana statusu (np. anulowanie) może zostać nadpisana.

### H-04. `Cache-Control: public` na endpointach z RLS
- **Pliki:** `companies.ts`, `locations.ts`, `products.ts` (~linia 25)
- `public` pozwala proxy cache'ować odpowiedź z sesji A dla użytkownika B.
- **Fix:** Zmienić na `private, max-age=3600`.

### H-05. `duplicateOrder` nie zapisuje do `order_status_history`
- **Plik:** `order.service.ts:869-1019`
- Nowe zlecenie z duplikacji nie ma wpisu w historii statusów.

### H-06. `vehicleVariantCode` = `""` zamiast `null` → fałszywy dirty state
- **Plik:** `CarrierSection.tsx:92-106`
- `onChange({ vehicleVariantCode: match?.code ?? "" })` — powinno być `?? null`.

### H-07. Formularz nie resetuje się po zmianie danych tego samego zlecenia
- **Plik:** `OrderForm.tsx:149`
- `useEffect` zależy tylko od `order.id` — po prepare-email (zmiana statusu) formularz nie odświeża danych.

### H-08. Brak `SheetTitle`/`SheetDescription` w HistoryPanel
- **Plik:** `src/components/orders/history/HistoryPanel.tsx:101-107`
- Naruszenie Radix a11y — screen reader nie ogłasza tytułu.

### H-09. Nowy `api` przy każdym odświeżeniu tokenu → kaskadowe re-rendery
- **Plik:** `AuthContext.tsx:92-99`
- `useMemo` z `[currentToken]` dep → nowa referencja co ~55 min → re-render całej aplikacji.
- **Fix:** `useRef` dla tokenu, getter w `createApiClient`.

### H-10. `carrier_cell_color` brakuje w `database.types.ts`
- Migracja `20260222000000` dodała kolumnę, ale typy TS nie mają tego pola.
- **Fix:** Dodać `carrier_cell_color: string | null` do Row/Insert/Update.

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
