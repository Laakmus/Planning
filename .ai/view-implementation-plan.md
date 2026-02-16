# Plan implementacji REST API — wszystkie endpointy

**Dokumenty źródłowe:** `.ai/api-plan.md` (specyfikacja REST API), `.ai/db-plan.md` (schemat bazy danych), `src/types.ts` (typy DTO i Command), `src/db/database.types.ts` (typy Supabase).

---

## 1. Przegląd architektury

### 1.1 Stos technologiczny

- **Runtime:** Astro 5 SSR (Server Endpoints) — pliki `src/pages/api/v1/**/*.ts`
- **Baza danych:** Supabase (PostgreSQL) przez `@supabase/supabase-js`
- **Walidacja:** Zod (do zainstalowania: `npm install zod`)
- **Język:** TypeScript (strict)
- **Autentykacja:** Supabase Auth (JWT), profil z `user_profiles`

### 1.2 Konwencje struktury plików

```
src/
├── pages/api/v1/
│   ├── auth/
│   │   └── me.ts                          GET /api/v1/auth/me
│   ├── orders/
│   │   ├── index.ts                       GET, POST /api/v1/orders
│   │   └── [orderId]/
│   │       ├── index.ts                   GET, PUT, DELETE /api/v1/orders/{id}
│   │       ├── status.ts                  POST /api/v1/orders/{id}/status
│   │       ├── restore.ts                 POST /api/v1/orders/{id}/restore
│   │       ├── lock.ts                    POST /api/v1/orders/{id}/lock
│   │       ├── unlock.ts                  POST /api/v1/orders/{id}/unlock
│   │       ├── duplicate.ts               POST /api/v1/orders/{id}/duplicate
│   │       ├── pdf.ts                     POST /api/v1/orders/{id}/pdf
│   │       ├── prepare-email.ts           POST /api/v1/orders/{id}/prepare-email
│   │       ├── stops/
│   │       │   └── [stopId].ts            PATCH /api/v1/orders/{id}/stops/{stopId}
│   │       └── history/
│   │           ├── status.ts              GET /api/v1/orders/{id}/history/status
│   │           └── changes.ts             GET /api/v1/orders/{id}/history/changes
│   ├── companies.ts                       GET /api/v1/companies
│   ├── locations.ts                       GET /api/v1/locations
│   ├── products.ts                        GET /api/v1/products
│   ├── transport-types.ts                 GET /api/v1/transport-types
│   ├── order-statuses.ts                  GET /api/v1/order-statuses
│   ├── vehicle-variants.ts                GET /api/v1/vehicle-variants
│   └── dictionary-sync/
│       ├── run.ts                         POST /api/v1/dictionary-sync/run
│       └── jobs/
│           └── [jobId].ts                 GET /api/v1/dictionary-sync/jobs/{id}
├── lib/
│   ├── services/
│   │   ├── order.service.ts               Logika CRUD zleceń
│   │   ├── order-status.service.ts        Zmiana statusów, przywracanie
│   │   ├── order-lock.service.ts          Blokada współbieżna
│   │   ├── dictionary.service.ts          Słowniki (companies, locations, etc.)
│   │   └── auth.service.ts               Autentykacja, profil użytkownika
│   ├── validators/
│   │   ├── order.validator.ts             Schematy Zod dla zleceń
│   │   └── common.validator.ts            Wspólne schematy (UUID, paginacja)
│   └── api-helpers.ts                     Helpery: parsowanie, odpowiedzi błędów, auth guard
└── db/
    ├── supabase.client.ts                 (istniejący) klient Supabase
    └── database.types.ts                  (istniejący) typy auto-generowane
```

### 1.3 Konwencja handlera Astro API

Każdy plik endpointa eksportuje funkcje odpowiadające metodom HTTP (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). Struktura handlera:

```typescript
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals, request, params }) => {
  // 1. Autentykacja — getAuthenticatedUser(locals.supabase)
  // 2. Walidacja wejścia (query params / body / path params)
  // 3. Wywołanie serwisu
  // 4. Zwrócenie Response z JSON
};
```

---

## 2. Warstwa pomocnicza (`src/lib/api-helpers.ts`)

### 2.1 Funkcje do implementacji

```typescript
// Wyciąga i weryfikuje zalogowanego użytkownika z Supabase Auth
// Zwraca AuthMeDto lub rzuca 401
async function getAuthenticatedUser(supabase: SupabaseClient): Promise<AuthMeDto>

// Sprawdza, czy użytkownik ma rolę ADMIN lub PLANNER; rzuca 403 jeśli nie
function requireWriteAccess(user: AuthMeDto): void

// Sprawdza, czy użytkownik jest ADMIN; rzuca 403 jeśli nie
function requireAdmin(user: AuthMeDto): void

// Zwraca JSON Response ze statusem i body
function jsonResponse(data: unknown, status?: number): Response

// Zwraca JSON error Response
function errorResponse(statusCode: number, error: string, message: string, details?: Record<string, string | string[]>): Response

// Parsuje query parametry z URL
function parseQueryParams(url: URL): Record<string, string | string[]>

// Parsuje body JSON z Request
async function parseJsonBody<T>(request: Request): Promise<T>

// Waliduje UUID format
function isValidUUID(value: string): boolean
```

### 2.2 Kody statusów

| Kod | Użycie |
|-----|--------|
| 200 | Pomyślny odczyt, aktualizacja, usunięcie |
| 201 | Pomyślne utworzenie zasobu |
| 400 | Nieprawidłowe dane wejściowe (walidacja Zod, niedozwolone przejście statusu) |
| 401 | Brak lub nieważny token JWT |
| 403 | Brak uprawnień (rola READ_ONLY przy operacji zapisu) |
| 404 | Zasób nie znaleziony |
| 409 | Konflikt (blokada przez innego użytkownika, duplikat) |
| 410 | Gone (anulowane zlecenie po 24h) |
| 422 | Walidacja biznesowa (np. brak complaintReason przy reklamacji) |
| 500 | Nieoczekiwany błąd serwera |

---

## 3. Endpointy — szczegółowe specyfikacje

---

### 3.1 GET /api/v1/auth/me

**Plik:** `src/pages/api/v1/auth/me.ts`

**Cel:** Zwraca profil zalogowanego użytkownika (id, email, fullName, phone, role).

**Typ odpowiedzi:** `AuthMeDto`

**Przepływ:**
1. Pobierz sesję z `supabase.auth.getUser()`.
2. Jeśli brak sesji → 401.
3. Pobierz profil z `user_profiles` po `id = auth.uid()`.
4. Zmapuj na `AuthMeDto` (camelCase).
5. Zwróć 200 z obiektem.

**Serwis:** `auth.service.ts` → `getCurrentUser(supabase): Promise<AuthMeDto>`

**Błędy:**
- 401 — brak sesji / nieważny token

---

### 3.2 GET /api/v1/orders

**Plik:** `src/pages/api/v1/orders/index.ts`

**Cel:** Lista zleceń z paginacją, filtrami, sortowaniem.

**Typ odpowiedzi:** `OrderListResponseDto` (= `PaginatedResponse<OrderListItemDto>`)

**Parametry zapytania (z `OrderListQueryParams`):**

| Parametr | Typ | Wymagany | Domyślna |
|----------|-----|----------|----------|
| view | CURRENT / COMPLETED / CANCELLED | nie | CURRENT |
| status | string / string[] | nie | — |
| transportType | TransportTypeCode | nie | — |
| carrierId | UUID | nie | — |
| productId | UUID | nie | — |
| loadingLocationId | UUID | nie | — |
| loadingCompanyId | UUID | nie | — |
| unloadingLocationId | UUID | nie | — |
| unloadingCompanyId | UUID | nie | — |
| search | string | nie | — |
| dateFrom | YYYY-MM-DD | nie | — |
| dateTo | YYYY-MM-DD | nie | — |
| sortBy | OrderSortBy | nie | FIRST_LOADING_DATETIME |
| sortDirection | ASC / DESC | nie | ASC |
| page | number | nie | 1 |
| pageSize | number | nie | 50 (max 200) |

**Walidacja Zod:**
- `view` ∈ {CURRENT, COMPLETED, CANCELLED}
- `status` — jeśli podany, musi być prawidłowym kodem statusu
- `transportType` ∈ {PL, EXP, EXP_K, IMP}
- UUID-y — poprawny format
- `dateFrom`, `dateTo` — format ISO date
- `page` >= 1, `pageSize` ∈ [1, 200]

**Przepływ (serwis `order.service.ts` → `listOrders`):**
1. Auth guard (getAuthenticatedUser).
2. Parsuj i waliduj query params.
3. Buduj zapytanie Supabase:
   - SELECT z `transport_orders` z joinami:
     - `order_statuses` (na `status_code`) — pobierz `name` jako `statusName`, `view_group` jako `viewGroup`
     - `transport_types` (na `transport_type_code`) — pobierz `name` jako `transportTypeName`
     - `vehicle_variants` (na `vehicle_variant_code`) — pobierz `name`, `capacity_volume_m3`
     - `order_stops` (1:N) — uproszczone pola
     - `order_items` (1:N) — uproszczone pola
     - `user_profiles` (×4: created_by, updated_by, sent_by, locked_by) — pobierz `full_name`
   - Filtr po `view_group` (z tabeli `order_statuses`)
   - Filtry opcjonalne (status, transportType, carrierId, search, daty, etc.)
   - Filtr `productId` — sub-query: zlecenia posiadające item z danym `product_id`
   - Filtry `loadingLocationId` / `loadingCompanyId` — sub-query: zlecenia z odpowiednim stopem
   - Sortowanie wg `sortBy` + `sortDirection`
   - Paginacja: `.range((page-1)*pageSize, page*pageSize - 1)`
4. Policz total: osobne zapytanie z `.count()` lub `.count('exact')`.
5. Zmapuj wyniki na `OrderListItemDto[]`.
6. Zwróć `PaginatedResponse<OrderListItemDto>`.

**Uwagi wydajnościowe:**
- Użycie `.select('..., order_stops(...), order_items(...)')` — Supabase pozwala na zagnieżdżone selecty.
- Indeksy w DB: `(status_code)`, `(first_loading_date, order_no)`, `(carrier_company_id)`.
- Filtry `loadingCompanyId` i `unloadingCompanyId` wymagają sub-query przez `order_stops` + `locations`.

**Filtry wymagające sub-query:**
- `productId` → `order_items.product_id = ?`
- `loadingLocationId` → `order_stops.location_id = ? AND kind = 'LOADING'`
- `loadingCompanyId` → `order_stops.location_id IN (SELECT id FROM locations WHERE company_id = ?) AND kind = 'LOADING'`
- `unloadingLocationId` → analogicznie z `kind = 'UNLOADING'`
- `unloadingCompanyId` → analogicznie

**Implementacja filtrów sub-query:** Supabase JS client nie wspiera bezpośrednio sub-query. Rozwiązanie: użycie `.rpc()` z funkcją PostgreSQL lub dwuetapowe zapytanie (najpierw pobierz order_ids pasujące do filtra, potem filtruj transport_orders). Alternatywnie: widok bazodanowy lub Supabase PostgREST embedded filters.

**Rekomendacja:** Dla złożonych filtrów (productId, loadingCompanyId, unloadingCompanyId) — utworzyć funkcję PostgreSQL (`rpc`) `get_filtered_order_ids(params)` zwracającą listę UUID.

**Błędy:**
- 400 — nieprawidłowe parametry
- 401 — brak autentykacji

---

### 3.3 POST /api/v1/orders

**Plik:** `src/pages/api/v1/orders/index.ts`

**Cel:** Tworzenie nowego zlecenia (status: robocze).

**Typ żądania:** `CreateOrderCommand`
**Typ odpowiedzi:** `CreateOrderResponseDto`

**Walidacja Zod:**
- `transportTypeCode` — wymagane, ∈ {PL, EXP, EXP_K, IMP}
- `currencyCode` — wymagane, ∈ {PLN, EUR, USD}
- `vehicleVariantCode` — wymagane, niepusty string
- `carrierCompanyId` — opcjonalne, UUID lub null
- `shipperLocationId` — opcjonalne, UUID lub null
- `receiverLocationId` — opcjonalne, UUID lub null
- `priceAmount` — opcjonalne, number >= 0 lub null
- `paymentTermDays` — opcjonalne, integer >= 0 lub null
- `paymentMethod` — opcjonalne, string lub null
- `totalLoadTons` — opcjonalne, number >= 0 lub null
- `totalLoadVolumeM3` — opcjonalne, number >= 0 lub null
- `specialRequirements`, `requiredDocumentsText`, `generalNotes` — opcjonalne, string max 500 lub null
- `senderContactName` — opcjonalne, string max 200 lub null
- `senderContactPhone` — opcjonalne, string max 100 lub null
- `senderContactEmail` — opcjonalne, string max 320, format email lub null
- `stops` — tablica `CreateOrderStopInput[]`:
  - `kind` ∈ {LOADING, UNLOADING}, wymagane
  - `dateLocal` — format YYYY-MM-DD lub null
  - `timeLocal` — format HH:MM:SS lub null
  - `locationId` — UUID lub null
  - `notes` — string max 500 lub null
- `items` — tablica `CreateOrderItemInput[]`:
  - `productId` — UUID lub null
  - `productNameSnapshot` — string lub null
  - `loadingMethodCode` ∈ {PALETA, PALETA_BIGBAG, LUZEM, KOSZE} lub null
  - `quantityTons` — number >= 0 lub null
  - `notes` — string max 500 lub null

**Przepływ (serwis `order.service.ts` → `createOrder`):**
1. Auth guard + requireWriteAccess.
2. Parsuj i waliduj body (Zod).
3. Walidacja FK:
   - `vehicleVariantCode` istnieje w `vehicle_variants` i `is_active = true`
   - `transportTypeCode` istnieje w `transport_types` i `is_active = true`
   - `carrierCompanyId` (jeśli podany) istnieje w `companies` i `is_active = true`
   - Każdy `locationId` w stops (jeśli podany) istnieje w `locations` i `is_active = true`
   - Każdy `productId` w items (jeśli podany) istnieje w `products` i `is_active = true`
4. Generuj `order_no` — format `ZT{year}/{seqNo}` (np. `ZT2026/0001`):
   - Pobierz najwyższy `order_no` z tego roku lub użyj sekwencji DB.
   - **Rekomendacja:** Funkcja PostgreSQL (`rpc`) `generate_order_no()` z sekwencją.
   - **Uwaga:** PRD używa formatu `ZT-2026-0042` (z myślnikami). Przyjęto format z db-plan.md (`ZT2026/0001`) jako źródło prawdy dla bazy — do uzgodnienia z właścicielem produktu.
5. Automatyczne uzupełnienie pól:
   - `required_documents_text` wg `transport_type_code` (sekcja 5.1 db-plan)
   - `currency_code` wg `transport_type_code` (sekcja 5.2 db-plan) — nadpisz tylko jeśli user nie podał innej
   - Snapshoty: `carrier_name_snapshot`, `carrier_address_snapshot` itd. — pobierz z słowników na podstawie podanych ID
   - `first_loading_date/time`, `first_unloading_date/time`, `last_loading_date/time`, `last_unloading_date/time` — oblicz z podanych stops
   - `first_loading_country`, `first_unloading_country` — z lokalizacji pierwszego LOADING / UNLOADING stopu
   - `summary_route` — wygeneruj z stops (np. "PL: Kęty → DE: Hamburg")
   - `main_product_name` — nazwa pierwszego itemu
   - `search_text` — zdenormalizowany tekst (numer, firmy, lokalizacje, towary, uwagi)
   - `week_number` — trigger bazodanowy (nie ustawiaj ręcznie)
   - `transport_year` — z `first_loading_date` lub bieżący rok
6. INSERT do `transport_orders` z `status_code = 'robocze'`, `created_by_user_id = auth.uid()`.
7. INSERT do `order_stops` — z `sequence_no` przydzielonym sekwencyjnie, snapshoty z lokalizacji.
8. INSERT do `order_items` — snapshoty z produktów.
9. INSERT do `order_status_history` — pierwsze wejście (old: 'robocze', new: 'robocze' lub pominięte — do decyzji).
10. Zwróć 201 z `CreateOrderResponseDto`.

**Limity:**
- Max 8 stops LOADING, max 3 UNLOADING.

**Błędy:**
- 400 — nieprawidłowe dane
- 401 — brak autentykacji
- 403 — rola READ_ONLY
- 409 — konflikt (np. order_no collision, choć mało prawdopodobne)

---

### 3.4 GET /api/v1/orders/{orderId}

**Plik:** `src/pages/api/v1/orders/[orderId]/index.ts`

**Cel:** Pełne dane zlecenia (nagłówek + stops + items).

**Typ odpowiedzi:** `OrderDetailResponseDto`

**Przepływ (serwis `order.service.ts` → `getOrderDetail`):**
1. Auth guard.
2. Waliduj `orderId` (UUID).
3. SELECT `transport_orders` z joinami na słowniki + user_profiles.
4. SELECT `order_stops` WHERE `order_id = orderId` ORDER BY `sequence_no`.
5. SELECT `order_items` WHERE `order_id = orderId`.
6. Jeśli brak rekordu → 404.
7. Zmapuj na `OrderDetailResponseDto`.
8. Zwróć 200.

**Błędy:**
- 401, 404

---

### 3.5 PUT /api/v1/orders/{orderId}

**Plik:** `src/pages/api/v1/orders/[orderId]/index.ts`

**Cel:** Pełna aktualizacja zlecenia (nagłówek + stops + items).

**Typ żądania:** `UpdateOrderCommand`
**Typ odpowiedzi:** `UpdateOrderResponseDto`

**Walidacja Zod:** Podobna do POST, plus:
- `stops[].id` — UUID lub null (null = nowy stop)
- `stops[].sequenceNo` — wymagane, integer >= 1
- `stops[]._deleted` — boolean
- `items[].id` — UUID lub null
- `items[]._deleted` — boolean
- `complaintReason` — string max 500 lub null

**Przepływ (serwis `order.service.ts` → `updateOrder`):**
1. Auth guard + requireWriteAccess.
2. Waliduj `orderId` (UUID) + body (Zod).
3. Pobierz bieżące zlecenie — jeśli nie istnieje → 404.
4. Sprawdź blokadę — jeśli `locked_by_user_id` ≠ null i ≠ current user → 409.
5. Sprawdź status — jeśli `status_code` ∈ {zrealizowane, anulowane} → 400 (chyba że dozwolona modyfikacja).
6. Walidacja FK (analogicznie do POST).
7. Limity stops: po usunięciu `_deleted` — max 8 LOADING, max 3 UNLOADING.
8. Automatyczne uzupełnienie pól:
   - Przelicz `first/last_loading/unloading_date/time` z nowych stops.
   - Przelicz `summary_route`, `main_product_name`, `search_text`.
   - Snapshoty — **nie** nadpisuj automatycznie istniejących snapshotów (są immutable). Nowe snapshoty tylko dla nowych stops/items (z `id = null`).
   - Jeśli `transport_type_code` się zmienił → ustaw `required_documents_text` i `currency_code` automatycznie (sekcja 5 db-plan), chyba że user jawnie podał inną wartość.
9. UPDATE `transport_orders`.
10. Obsługa stops:
    - `_deleted = true` + `id` podane → DELETE.
    - `id = null` → INSERT nowy stop.
    - `id` podane + `_deleted = false` → UPDATE.
11. Obsługa items — analogicznie.
12. **Automatyczne przejście statusu:**
    - Jeśli `status_code` ∈ {wysłane, korekta wysłane} i zmieniono pola biznesowe → ustaw `status_code = 'korekta'`.
    - Pola biznesowe = wszystkie poza technicznymi (locked_by, updated_at, etc.).
13. Log zmian: INSERT do `order_change_log` dla zmienionych pól kluczowych.
14. Log statusu (jeśli zmieniony automatycznie): INSERT do `order_status_history`.
15. Zwróć 200 z `UpdateOrderResponseDto`.

**Pole `weekNumber` ignorowane** — trigger bazodanowy oblicza automatycznie.

**Błędy:**
- 400 — nieprawidłowe dane / niedozwolona edycja
- 401, 403, 404, 409

---

### 3.6 DELETE /api/v1/orders/{orderId}

**Plik:** `src/pages/api/v1/orders/[orderId]/index.ts`

**Cel:** Anulowanie zlecenia (ustawienie status = anulowane).

**Typ odpowiedzi:** `DeleteOrderResponseDto`

**Przepływ (serwis `order-status.service.ts` → `cancelOrder`):**
1. Auth guard + requireWriteAccess.
2. Waliduj `orderId` (UUID).
3. Pobierz bieżący status.
4. Sprawdź dozwolone przejście: aktualny status ∈ {robocze, wysłane, korekta, korekta wysłane, reklamacja} → anulowane. NIE z `zrealizowane`.
5. UPDATE `status_code = 'anulowane'`.
6. INSERT do `order_status_history`.
7. Zwróć 200 z `DeleteOrderResponseDto`.

**Błędy:**
- 400 — niedozwolone przejście (np. z zrealizowane)
- 401, 403, 404

---

### 3.7 POST /api/v1/orders/{orderId}/status

**Plik:** `src/pages/api/v1/orders/[orderId]/status.ts`

**Cel:** Ręczna zmiana statusu.

**Typ żądania:** `ChangeStatusCommand`
**Typ odpowiedzi:** `ChangeStatusResponseDto`

**Walidacja Zod:**
- `newStatusCode` — wymagane, ∈ {zrealizowane, reklamacja, anulowane}
- `complaintReason` — wymagane gdy `newStatusCode = 'reklamacja'` (niepusty string)

**Przepływ (serwis `order-status.service.ts` → `changeStatus`):**
1. Auth guard + requireWriteAccess.
2. Waliduj body.
3. Pobierz bieżący status zlecenia.
4. Sprawdź dozwolone przejście wg `ALLOWED_MANUAL_STATUS_TRANSITIONS` z `src/types.ts`:
   - `zrealizowane` ← z: robocze, wysłane, korekta, korekta wysłane, reklamacja
   - `reklamacja` ← z: wysłane, korekta wysłane (+ wymagane `complaintReason`)
   - `anulowane` ← z: robocze, wysłane, korekta, korekta wysłane, reklamacja (nie z zrealizowane)
5. Jeśli przejście niedozwolone → 400.
6. Jeśli reklamacja i brak `complaintReason` → 422.
7. UPDATE `status_code`, ewentualnie `complaint_reason`.
8. INSERT do `order_status_history`.
9. INSERT do `order_change_log` (pole `status_code`).
10. Zwróć 200 z `ChangeStatusResponseDto`.

**Błędy:**
- 400 — niedozwolone przejście
- 401, 403, 404, 422

---

### 3.8 POST /api/v1/orders/{orderId}/restore

**Plik:** `src/pages/api/v1/orders/[orderId]/restore.ts`

**Cel:** Przywrócenie zlecenia z zrealizowane/anulowane do aktualnych (zawsze status = korekta).

**Typ odpowiedzi:** `RestoreOrderResponseDto`

**Przepływ (serwis `order-status.service.ts` → `restoreOrder`):**
1. Auth guard + requireWriteAccess.
2. Waliduj `orderId`.
3. Pobierz zlecenie z bieżącym statusem.
4. Jeśli status ∉ {zrealizowane, anulowane} → 400.
5. Jeśli status = anulowane:
   - Sprawdź czas od anulowania: pobierz `changed_at` z `order_status_history` WHERE `new_status_code = 'anulowane'` ORDER BY `changed_at DESC LIMIT 1`.
   - Jeśli > 24h → 410 Gone (zlecenie mogło być już usunięte przez job w tle).
6. UPDATE `status_code = 'korekta'`.
7. INSERT do `order_status_history`.
8. Zwróć 200 z `RestoreOrderResponseDto`.

**Błędy:**
- 400 — niedozwolone (status nie jest zrealizowane/anulowane)
- 401, 403, 404, 410

---

### 3.9 POST /api/v1/orders/{orderId}/lock

**Plik:** `src/pages/api/v1/orders/[orderId]/lock.ts`

**Cel:** Ustawienie blokady edycji zlecenia.

**Typ odpowiedzi:** `LockOrderResponseDto`

**Przepływ (serwis `order-lock.service.ts` → `lockOrder`):**
1. Auth guard + requireWriteAccess.
2. Waliduj `orderId`.
3. Pobierz zlecenie (only `locked_by_user_id`, `locked_at`).
4. Jeśli `locked_by_user_id` ≠ null i ≠ current_user i blokada nie wygasła → 409.
5. UPDATE `locked_by_user_id = current_user`, `locked_at = now()`.
6. Zwróć 200 z `LockOrderResponseDto`.

**Wygasanie blokady:** Np. 15 minut od `locked_at`. Konfiguracja stała w serwisie.

**Błędy:**
- 401, 403, 404, 409

---

### 3.10 POST /api/v1/orders/{orderId}/unlock

**Plik:** `src/pages/api/v1/orders/[orderId]/unlock.ts`

**Cel:** Zwolnienie blokady (po zapisie lub wyjściu z formularza).

**Typ odpowiedzi:** `UnlockOrderResponseDto`

**Przepływ (serwis `order-lock.service.ts` → `unlockOrder`):**
1. Auth guard.
2. Waliduj `orderId`.
3. Pobierz zlecenie.
4. Jeśli `locked_by_user_id` ≠ current_user i current_user.role ≠ ADMIN → 403.
5. UPDATE `locked_by_user_id = null`, `locked_at = null`.
6. Zwróć 200 z `UnlockOrderResponseDto`.

**Błędy:**
- 401, 403, 404

---

### 3.11 POST /api/v1/orders/{orderId}/duplicate

**Plik:** `src/pages/api/v1/orders/[orderId]/duplicate.ts`

**Cel:** Kopiowanie zlecenia (etap 2).

**Typ żądania:** `DuplicateOrderCommand`
**Typ odpowiedzi:** `DuplicateOrderResponseDto`

**Przepływ (serwis `order.service.ts` → `duplicateOrder`):**
1. Auth guard + requireWriteAccess.
2. Waliduj body.
3. Pobierz oryginalne zlecenie z stops i items.
4. Generuj nowy `order_no`.
5. INSERT nowe zlecenie z danymi z oryginału:
   - Status = robocze (jeśli `resetStatusToDraft = true`)
   - `sent_by_user_id = null`, `sent_at = null`
   - `locked_by_user_id = null`
   - Nowy `created_by_user_id`, `created_at`
6. Jeśli `includeStops = true` → INSERT kopie stops (nowe ID).
7. Jeśli `includeItems = true` → INSERT kopie items (nowe ID).
8. Zwróć 201 z `DuplicateOrderResponseDto`.

**Błędy:**
- 400, 401, 403, 404

---

### 3.12 PATCH /api/v1/orders/{orderId}/stops/{stopId}

**Plik:** `src/pages/api/v1/orders/[orderId]/stops/[stopId].ts`

**Cel:** Częściowa edycja pojedynczego punktu trasy.

**Typ żądania:** `PatchStopCommand` (partial)
**Typ odpowiedzi:** zaktualizowany stop lub potwierdzenie

**Przepływ:**
1. Auth guard + requireWriteAccess.
2. Waliduj `orderId`, `stopId`.
3. Pobierz stop i sprawdź, że należy do tego zlecenia.
4. Sprawdź blokadę zlecenia.
5. UPDATE podanych pól.
6. Przelicz denormalizowane pola zlecenia (daty, summary_route) jeśli zmienione.
7. Zwróć 200.

**Błędy:**
- 400, 401, 403, 404, 409

---

### 3.13 GET /api/v1/orders/{orderId}/history/status

**Plik:** `src/pages/api/v1/orders/[orderId]/history/status.ts`

**Cel:** Historia zmian statusów.

**Typ odpowiedzi:** `ListResponse<StatusHistoryItemDto>`

**Przepływ:**
1. Auth guard.
2. Waliduj `orderId`.
3. SELECT z `order_status_history` JOIN `user_profiles` ORDER BY `changed_at DESC`.
4. Zmapuj na `StatusHistoryItemDto[]`.
5. Zwróć 200.

**Błędy:**
- 401, 404

---

### 3.14 GET /api/v1/orders/{orderId}/history/changes

**Plik:** `src/pages/api/v1/orders/[orderId]/history/changes.ts`

**Cel:** Log zmian pól zlecenia.

**Typ odpowiedzi:** `ListResponse<ChangeLogItemDto>`

**Przepływ:**
1. Auth guard.
2. Waliduj `orderId`.
3. SELECT z `order_change_log` JOIN `user_profiles` ORDER BY `changed_at DESC`.
4. Zmapuj na `ChangeLogItemDto[]`.
5. Zwróć 200.

**Błędy:**
- 401, 404

---

### 3.15 Endpointy słownikowe (6 endpointów)

**Pliki:** `src/pages/api/v1/companies.ts`, `locations.ts`, `products.ts`, `transport-types.ts`, `order-statuses.ts`, `vehicle-variants.ts`

**Cel:** Autocomplete i listy wyboru w UI.

**Serwis:** `dictionary.service.ts`

**Wspólny przepływ:**
1. Auth guard (tylko GET, więc dostępne dla wszystkich zalogowanych).
2. SELECT z odpowiedniej tabeli WHERE `is_active = true` (jeśli ma takie pole).
3. Dla `locations` — opcjonalny join z `companies` (aby zwrócić `companyName`).
4. Zmapuj na odpowiednie DTO.
5. Zwróć 200 z `ListResponse<T>`.

**Specyfika:**
- `GET /companies` → `ListResponse<CompanyDto>` — filtr `is_active = true`
- `GET /locations` → `ListResponse<LocationDto>` — filtr `is_active = true`, join `companies.name` → `companyName`
- `GET /products` → `ListResponse<ProductDto>` — filtr `is_active = true`
- `GET /transport-types` → `ListResponse<TransportTypeDto>` — filtr `is_active = true`
- `GET /order-statuses` → `ListResponse<OrderStatusDto>` — wszystkie (bez filtra active), ORDER BY `sort_order`
- `GET /vehicle-variants` → `ListResponse<VehicleVariantDto>` — filtr `is_active = true`

**Błędy:**
- 401

---

### 3.16 POST /api/v1/orders/{orderId}/prepare-email

**Plik:** `src/pages/api/v1/orders/[orderId]/prepare-email.ts`

**Cel:** Walidacja biznesowa, generacja PDF, przygotowanie danych do otwarcia Outlooka, zmiana statusu.

**Typ żądania:** `PrepareEmailCommand`
**Typ odpowiedzi:** `PrepareEmailResponseDto`

**Walidacja biznesowa (422 jeśli niespełniona):**
- Wymagany `transport_type_code`
- Wymagany `carrier_company_id` (przewoźnik)
- Wymagany `shipper_location_id` (nadawca)
- Wymagany `receiver_location_id` (odbiorca)
- Minimum opis ładunku (przynajmniej 1 item z `product_name_snapshot` i `quantity_tons`)
- Minimum 1 stop LOADING i 1 UNLOADING z datą i godziną
- Wymagana cena (`price_amount`)

**Przepływ:**
1. Auth guard + requireWriteAccess.
2. Pobierz zlecenie z pełnymi danymi.
3. Sprawdź walidację biznesową — jeśli braki → 422 z listą brakujących pól.
4. Wygeneruj/odśwież PDF (jeśli `forceRegeneratePdf = true` lub brak pliku).
5. Zmiana statusu:
   - robocze → wysłane
   - korekta → korekta wysłane
   - wysłane → wysłane (ponowna wysyłka — status bez zmian, aktualizacja `sent_at` i `sent_by_user_id`)
   - korekta wysłane → korekta wysłane (ponowna wysyłka — status bez zmian, aktualizacja `sent_at` i `sent_by_user_id`)
   - Inne statusy (zrealizowane, anulowane, reklamacja) — 400 (nie można wysyłać z tego statusu).
6. Ustaw `sent_by_user_id = current_user`, `sent_at = now()` (nadpisywane przy każdej wysyłce, w tym ponownej).
7. Aktualizuj `main_product_name` jeśli puste.
8. INSERT do `order_status_history`.
9. Zwróć 200 z `PrepareEmailResponseDto` (w tym `emailOpenUrl` — mailto: link, `pdfFileName`).

**Błędy:**
- 400, 401, 403, 404, 422

---

### 3.17 POST /api/v1/orders/{orderId}/pdf

**Plik:** `src/pages/api/v1/orders/[orderId]/pdf.ts`

**Cel:** Generowanie PDF zlecenia.

**Typ żądania:** `GeneratePdfCommand`
**Odpowiedź:** Binarny PDF (`Content-Type: application/pdf`)

**Przepływ:**
1. Auth guard.
2. Pobierz pełne dane zlecenia.
3. Wygeneruj PDF (etap 2 — na razie stub zwracający 501 Not Implemented lub prosty PDF).
4. Zwróć 200 z `application/pdf`.

**Błędy:**
- 400, 401, 404

---

### 3.18 POST /api/v1/dictionary-sync/run

**Plik:** `src/pages/api/v1/dictionary-sync/run.ts`

**Cel:** Uruchomienie synchronizacji słowników z ERP.

**Typ żądania:** `DictionarySyncCommand`
**Typ odpowiedzi:** `DictionarySyncResponseDto`

**Przepływ:**
1. Auth guard + requireWriteAccess (ADMIN lub PLANNER).
2. Waliduj body (lista resources ∈ {COMPANIES, LOCATIONS, PRODUCTS}).
3. Uruchom job synchronizacji (stub na MVP — zwróć jobId + status STARTED).
4. Zwróć 200.

**Błędy:**
- 400, 401, 403

---

### 3.19 GET /api/v1/dictionary-sync/jobs/{jobId}

**Plik:** `src/pages/api/v1/dictionary-sync/jobs/[jobId].ts`

**Cel:** Status zadania synchronizacji.

**Typ odpowiedzi:** `DictionarySyncJobDto`

**Przepływ:**
1. Auth guard.
2. Pobierz status jobu (stub na MVP).
3. Zwróć 200.

**Błędy:**
- 401, 404

---

## 4. Walidacja (warstwa `src/lib/validators/`)

### 4.1 common.validator.ts

```typescript
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoTimeSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);
```

### 4.2 order.validator.ts

```typescript
import { z } from "zod";

const orderStatusCodeEnum = z.enum(["robocze", "wysłane", "korekta", "korekta wysłane", "zrealizowane", "reklamacja", "anulowane"]);

export const orderListQuerySchema = z.object({
  view: z.enum(["CURRENT", "COMPLETED", "CANCELLED"]).default("CURRENT"),
  status: z.union([orderStatusCodeEnum, z.array(orderStatusCodeEnum)]).optional(),
  transportType: z.enum(["PL", "EXP", "EXP_K", "IMP"]).optional(),
  carrierId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  loadingLocationId: z.string().uuid().optional(),
  loadingCompanyId: z.string().uuid().optional(),
  unloadingLocationId: z.string().uuid().optional(),
  unloadingCompanyId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  sortBy: z.enum(["FIRST_LOADING_DATETIME", "FIRST_UNLOADING_DATETIME", "ORDER_NO", "CARRIER_NAME"]).optional(),
  sortDirection: z.enum(["ASC", "DESC"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const createOrderStopSchema = z.object({
  kind: z.enum(["LOADING", "UNLOADING"]),
  dateLocal: isoDateSchema.nullable(),
  timeLocal: isoTimeSchema.nullable(),
  locationId: z.string().uuid().nullable(),
  notes: z.string().max(500).nullable(),
});

export const createOrderItemSchema = z.object({
  productId: z.string().uuid().nullable(),
  productNameSnapshot: z.string().max(500).nullable(),
  loadingMethodCode: z.enum(["PALETA", "PALETA_BIGBAG", "LUZEM", "KOSZE"]).nullable(),
  quantityTons: z.number().nonnegative().nullable(),
  notes: z.string().max(500).nullable(),
});

export const createOrderSchema = z.object({
  transportTypeCode: z.enum(["PL", "EXP", "EXP_K", "IMP"]),
  currencyCode: z.enum(["PLN", "EUR", "USD"]),
  vehicleVariantCode: z.string().min(1),
  carrierCompanyId: z.string().uuid().nullable(),
  shipperLocationId: z.string().uuid().nullable(),
  receiverLocationId: z.string().uuid().nullable(),
  priceAmount: z.number().nonnegative().nullable(),
  paymentTermDays: z.number().int().nonnegative().nullable(),
  paymentMethod: z.string().max(100).nullable(),
  totalLoadTons: z.number().nonnegative().nullable(),
  totalLoadVolumeM3: z.number().nonnegative().nullable(),
  specialRequirements: z.string().max(500).nullable(),
  requiredDocumentsText: z.string().max(500).nullable(),
  generalNotes: z.string().max(500).nullable(),
  senderContactName: z.string().max(200).nullable(),
  senderContactPhone: z.string().max(100).nullable(),
  senderContactEmail: z.string().max(320).email().nullable(),
  stops: z.array(createOrderStopSchema),
  items: z.array(createOrderItemSchema),
});

export const updateOrderStopSchema = createOrderStopSchema.extend({
  id: z.string().uuid().nullable(),
  sequenceNo: z.number().int().min(1),
  _deleted: z.boolean(),
});

export const updateOrderItemSchema = createOrderItemSchema.extend({
  id: z.string().uuid().nullable(),
  _deleted: z.boolean(),
});

export const updateOrderSchema = createOrderSchema.extend({
    complaintReason: z.string().max(500).nullable(),
    stops: z.array(updateOrderStopSchema),
    items: z.array(updateOrderItemSchema),
  });

export const changeStatusSchema = z.object({
  newStatusCode: z.enum(["zrealizowane", "reklamacja", "anulowane"]),
  complaintReason: z.string().max(500).nullable(),
}).refine(
  (data) => data.newStatusCode !== "reklamacja" || (data.complaintReason && data.complaintReason.trim().length > 0),
  { message: "complaintReason jest wymagane dla statusu reklamacja", path: ["complaintReason"] }
);

export const duplicateOrderSchema = z.object({
  includeStops: z.boolean(),
  includeItems: z.boolean(),
  resetStatusToDraft: z.boolean(),
});

export const prepareEmailSchema = z.object({
  forceRegeneratePdf: z.boolean().optional().default(false),
});

export const generatePdfSchema = z.object({
  regenerate: z.boolean().optional().default(false),
});

export const dictionarySyncSchema = z.object({
  resources: z.array(z.enum(["COMPANIES", "LOCATIONS", "PRODUCTS"])).min(1),
});
```

---

## 5. Warstwa serwisowa (`src/lib/services/`)

### 5.1 auth.service.ts

| Metoda | Opis |
|--------|------|
| `getCurrentUser(supabase)` | Pobiera sesję i profil użytkownika → `AuthMeDto` |

### 5.2 order.service.ts

| Metoda | Opis |
|--------|------|
| `listOrders(supabase, params)` | Lista zleceń z filtrami, sortowaniem, paginacją → `OrderListResponseDto` |
| `getOrderDetail(supabase, orderId)` | Pełne dane zlecenia → `OrderDetailResponseDto` |
| `createOrder(supabase, userId, command)` | Tworzenie zlecenia → `CreateOrderResponseDto` |
| `updateOrder(supabase, userId, orderId, command)` | Aktualizacja zlecenia → `UpdateOrderResponseDto` |
| `duplicateOrder(supabase, userId, orderId, command)` | Kopiowanie zlecenia → `DuplicateOrderResponseDto` |

**Funkcje pomocnicze (prywatne):**
- `generateOrderNo(supabase)` — generowanie numeru zlecenia
- `computeDenormalizedFields(stops, items, locations)` — przeliczenie first/last dat, summary_route, search_text
- `buildSnapshotsForStop(supabase, locationId)` — pobranie snapshotu z lokalizacji
- `buildSnapshotsForItem(supabase, productId)` — pobranie snapshotu z produktu
- `buildSnapshotsForCarrier(supabase, companyId)` — pobranie snapshotu przewoźnika
- `autoSetDocumentsAndCurrency(transportTypeCode)` — logika sekcji 5 db-plan

### 5.3 order-status.service.ts

| Metoda | Opis |
|--------|------|
| `changeStatus(supabase, userId, orderId, command)` | Ręczna zmiana statusu → `ChangeStatusResponseDto` |
| `cancelOrder(supabase, userId, orderId)` | Anulowanie (alias DELETE) → `DeleteOrderResponseDto` |
| `restoreOrder(supabase, userId, orderId)` | Przywrócenie → `RestoreOrderResponseDto` |

### 5.4 order-lock.service.ts

| Metoda | Opis |
|--------|------|
| `lockOrder(supabase, userId, orderId)` | Blokada → `LockOrderResponseDto` |
| `unlockOrder(supabase, userId, orderId)` | Odblokowanie → `UnlockOrderResponseDto` |
| `isLockExpired(lockedAt)` | Sprawdzenie wygaśnięcia blokady |

### 5.5 dictionary.service.ts

| Metoda | Opis |
|--------|------|
| `getCompanies(supabase)` | Lista firm → `ListResponse<CompanyDto>` |
| `getLocations(supabase)` | Lista lokalizacji z companyName → `ListResponse<LocationDto>` |
| `getProducts(supabase)` | Lista produktów → `ListResponse<ProductDto>` |
| `getTransportTypes(supabase)` | Lista typów transportu → `ListResponse<TransportTypeDto>` |
| `getOrderStatuses(supabase)` | Lista statusów → `ListResponse<OrderStatusDto>` |
| `getVehicleVariants(supabase)` | Lista wariantów pojazdów → `ListResponse<VehicleVariantDto>` |

---

## 6. Względy bezpieczeństwa

### 6.1 Autentykacja
- Każdy endpoint wymaga ważnego tokenu JWT (Supabase Auth).
- Token weryfikowany w middleware Astro (`src/middleware/index.ts`).
- Funkcja `getAuthenticatedUser()` na początku każdego handlera.

### 6.2 Autoryzacja (role)
- **GET** — dostępne dla wszystkich zalogowanych (ADMIN, PLANNER, READ_ONLY).
- **POST/PUT/DELETE/PATCH** — wymagana rola ADMIN lub PLANNER (`requireWriteAccess`).
- Wyjątki:
  - Lock/Unlock — dostępne dla wszystkich zalogowanych (lock do ochrony sesji edycji).
  - Unlock cudzej blokady — tylko ADMIN.
  - Synchronizacja słowników — ADMIN lub PLANNER.

### 6.3 RLS (Row Level Security)
- RLS aktywne na wszystkich tabelach — Supabase egzekwuje polityki SELECT/INSERT/UPDATE/DELETE.
- API dodaje dodatkową warstwę sprawdzania ról (defense in depth).

### 6.4 Walidacja wejścia
- Wszystkie dane wejściowe walidowane schematami Zod.
- UUID-y weryfikowane formatem.
- Stringi ograniczone długością (max 500 znaków).
- Daty w formacie ISO 8601.
- Brak SQL injection — Supabase client automatycznie parametryzuje zapytania.

### 6.5 CSRF / XSS
- API REST bez cookies sesyjnych (JWT w nagłówku Authorization).
- Brak renderowania HTML z danych użytkownika w API.

### 6.6 Rate limiting
- Supabase zapewnia podstawowy rate limiting.
- Docelowo: dodatkowy rate limit na endpointy `prepare-email`, `pdf`, `dictionary-sync/run`.

---

## 7. Obsługa błędów

### 7.1 Format odpowiedzi błędu

Zgodny z `ApiErrorResponse` z `src/types.ts`:

```json
{
  "error": "BAD_REQUEST",
  "message": "Opis błędu po polsku lub angielsku",
  "statusCode": 400,
  "details": {
    "transportTypeCode": "Wymagane pole",
    "stops": "Minimum 1 punkt załadunku"
  }
}
```

### 7.2 Scenariusze błędów

| Scenariusz | Kod | Opis |
|------------|-----|------|
| Brak tokenu / token wygasł | 401 | "Unauthorized" |
| Rola READ_ONLY przy operacji zapisu | 403 | "Insufficient permissions" |
| Zlecenie nie znalezione | 404 | "Order not found" |
| Blokada przez innego użytkownika | 409 | "Order locked by {userName}" |
| Niedozwolone przejście statusu | 400 | "Transition from {old} to {new} is not allowed" |
| Brak complaintReason przy reklamacji | 422 | "complaintReason is required for reklamacja" |
| Anulowane > 24h — przywrócenie | 410 | "Order was permanently deleted" |
| Błąd walidacji Zod | 400 | Lista pól z błędami w `details` |
| Przekroczony limit stops | 400 | "Maximum 8 loading stops allowed" |
| Walidacja biznesowa prepare-email | 422 | Lista brakujących danych do wysyłki |
| Nieoczekiwany błąd serwera | 500 | "Internal server error" (bez ujawniania stacktrace) |

### 7.3 Logowanie błędów

- Błędy 500 → logowane do konsoli serwera (`console.error`) z pełnym stacktrace.
- Błędy 4xx → nie logowane (oczekiwane).
- W przyszłości: integracja z zewnętrznym systemem logów (np. Sentry).

---

## 8. Wydajność

### 8.1 Indeksy bazodanowe

Istniejące indeksy (z `db-plan.md`):
- `transport_orders`: PK(id), UNIQUE(order_no), idx(status_code), idx(transport_type_code), idx(carrier_company_id), idx(first_loading_date, order_no)
- `order_stops`: PK(id), UNIQUE(order_id, sequence_no), idx(order_id), idx(location_id)
- `order_items`: PK(id), idx(order_id), idx(product_id)
- Logi: idx(order_id, changed_at)
- Słowniki: PK, partial UNIQUE(erp_id), idx(name)

### 8.2 Optymalizacje zapytań

- **Lista zleceń:** Jedno zapytanie z zagnieżdżonymi selectami (Supabase embedded resources) zamiast N+1.
- **Filtry sub-query:** Użycie PostgreSQL `rpc()` lub filtrów PostgREST dla złożonych filtrów (productId, loadingCompanyId).
- **Paginacja:** `.range()` z server-side count.
- **Słowniki:** Cache na froncie (DictionaryProvider) — API nie cachuje, ale dane zmieniają się rzadko.

### 8.3 Rozmiar odpowiedzi

- `GET /orders` — uproszczone stops/items (bez id, locationId, addressSnapshot).
- `pageSize` max 200 — ograniczenie rozmiaru odpowiedzi.
- Pełne dane tylko w `GET /orders/{id}`.

---

## 9. Etapy wdrożenia

### Etap 0: Migracja schematu DB (priorytet: P0, blokujące)

0. **Migracja SQL:** Dodanie 8 brakujących kolumn do `transport_orders`: `payment_term_days`, `payment_method`, `total_load_volume_m3`, `special_requirements`, `last_loading_date`, `last_loading_time`, `last_unloading_date`, `last_unloading_time`.
1. **Regeneracja typów:** `npx supabase gen types typescript --project-id <id> > src/db/database.types.ts`

### Etap 1: Infrastruktura (priorytet: P0)

1. **Konfiguracja Astro SSR:** Dodać `output: 'server'` w `astro.config.mjs`, zainstalować adapter: `npm install @astrojs/node`, dodać do `integrations`.
2. **Zainstalować Zod:** `npm install zod`
3. **Utworzyć `src/lib/api-helpers.ts`** — funkcje `getAuthenticatedUser`, `requireWriteAccess`, `requireAdmin`, `jsonResponse`, `errorResponse`, `parseJsonBody`.
4. **Zaktualizować middleware** (`src/middleware/index.ts`) — dodanie obsługi tokenu JWT z nagłówka `Authorization` (oprócz cookie).
5. **Utworzyć `src/lib/validators/common.validator.ts`** — wspólne schematy Zod.
6. **Utworzyć `src/lib/validators/order.validator.ts`** — schematy Zod dla zleceń.

### Etap 2: Auth + Słowniki (priorytet: P0)

6. **Implementacja `auth.service.ts`** + endpoint `GET /api/v1/auth/me`.
7. **Implementacja `dictionary.service.ts`** + 6 endpointów słownikowych.
8. Testy manualne endpointów słownikowych (np. curl/Postman).

### Etap 3: CRUD zleceń — odczyt (priorytet: P0)

9. **Implementacja `order.service.ts` → `getOrderDetail`** + endpoint `GET /api/v1/orders/{id}`.
10. **Implementacja `order.service.ts` → `listOrders`** + endpoint `GET /api/v1/orders`.
    - Najpierw: podstawowe filtry (view, status, transportType, carrierId, dateFrom/dateTo, search).
    - Potem: złożone filtry (productId, loadingLocationId, loadingCompanyId, unloadingLocationId, unloadingCompanyId).

### Etap 4: CRUD zleceń — zapis (priorytet: P0)

11. **Implementacja `order.service.ts` → `createOrder`** + endpoint `POST /api/v1/orders`.
    - W tym: `generateOrderNo`, snapshoty, denormalizacja.
12. **Implementacja `order.service.ts` → `updateOrder`** + endpoint `PUT /api/v1/orders/{id}`.
    - W tym: obsługa `_deleted`, automatyczne przejście statusu, order_change_log.
13. **Implementacja endpointu `DELETE /api/v1/orders/{id}`** (anulowanie).

### Etap 5: Statusy i blokady (priorytet: P0)

14. **Implementacja `order-status.service.ts`** + endpointy `POST /status`, `POST /restore`.
15. **Implementacja `order-lock.service.ts`** + endpointy `POST /lock`, `POST /unlock`.

### Etap 6: Historia (priorytet: P1)

16. **Implementacja endpointów historii:** `GET /history/status`, `GET /history/changes`.

### Etap 7: Zaawansowane funkcje (priorytet: P1)

17. **Implementacja `POST /prepare-email`** — walidacja biznesowa + zmiana statusu.
18. **Implementacja `POST /pdf`** — generowanie PDF (stub lub prosta implementacja).
19. **Implementacja `PATCH /stops/{stopId}`** — częściowa edycja punktu trasy.

### Etap 8: Etap 2 — kopiowanie i synchronizacja (priorytet: P2)

20. **Implementacja `POST /duplicate`** — kopiowanie zlecenia.
21. **Implementacja `POST /dictionary-sync/run`** + `GET /jobs/{jobId}` — synchronizacja słowników.

### Etap 9: Funkcje PostgreSQL (priorytet: P1)

22. **Migracja SQL:** Funkcja `generate_order_no()` z sekwencją.
23. **Migracja SQL:** Funkcja `get_filtered_order_ids(params)` dla złożonych filtrów (opcjonalnie — jeśli Supabase PostgREST nie wystarcza).
24. **Weryfikacja triggera `set_week_number`** — potwierdzenie, że działa z migracją.

---

## 10. Zależności i kolejność implementacji

```
api-helpers.ts ←── Etap 1
  ├── auth.service.ts ←── Etap 2
  ├── dictionary.service.ts ←── Etap 2
  └── validators/ ←── Etap 1
        └── order.service.ts ←── Etap 3/4
              ├── order-status.service.ts ←── Etap 5
              └── order-lock.service.ts ←── Etap 5
```

**Wymagania wstępne:**
- Baza danych Supabase z pełnym schematem (tabele, indeksy, RLS, triggery) — migracje w `supabase/migrations/`.
- **UWAGA:** Schemat DB (`database.types.ts`) nie zawiera jeszcze 8 kolumn wymaganych przez `db-plan.md` i `types.ts`. Przed rozpoczęciem implementacji konieczna jest nowa migracja dodająca: `payment_term_days`, `payment_method`, `total_load_volume_m3`, `special_requirements`, `last_loading_date`, `last_loading_time`, `last_unloading_date`, `last_unloading_time` do tabeli `transport_orders`. Po migracji: `npx supabase gen types typescript` aby zregenerować `database.types.ts`.
- Konfiguracja Astro SSR: dodać `output: 'server'` w `astro.config.mjs` oraz zainstalować adapter SSR (np. `@astrojs/node`).
- Zainstalować Zod: `npm install zod`.
- Dane seedowe w tabelach słownikowych (`transport_types`, `order_statuses`, `vehicle_variants`).
- Zmienne środowiskowe `SUPABASE_URL` i `SUPABASE_KEY` w `.env`.

---

## 11. Mapowanie camelCase ↔ snake_case

Supabase zwraca dane w `snake_case`. Typy DTO w `src/types.ts` używają `camelCase`. Warstwa serwisowa jest odpowiedzialna za transformację.

**Przykład mapowania `transport_orders` → `OrderListItemDto`:**

| DB (snake_case) | DTO (camelCase) | Źródło |
|-----------------|-----------------|--------|
| id | id | transport_orders |
| order_no | orderNo | transport_orders |
| status_code | statusCode | transport_orders |
| — | statusName | JOIN order_statuses.name |
| — | viewGroup | JOIN order_statuses.view_group |
| transport_type_code | transportTypeCode | transport_orders |
| — | transportTypeName | JOIN transport_types.name |
| summary_route | summaryRoute | transport_orders |
| first_loading_date | firstLoadingDate | transport_orders |
| carrier_company_id | carrierCompanyId | transport_orders |
| carrier_name_snapshot | carrierName | transport_orders |
| main_product_name | mainProductName | transport_orders |
| vehicle_variant_code | vehicleVariantCode | transport_orders |
| — | vehicleVariantName | JOIN vehicle_variants.name |
| — | vehicleCapacityVolumeM3 | JOIN vehicle_variants.capacity_volume_m3 |
| — | sentByUserName | JOIN user_profiles.full_name (sent_by_user_id) |
| — | lockedByUserName | JOIN user_profiles.full_name (locked_by_user_id) |
| — | createdByUserName | JOIN user_profiles.full_name (created_by_user_id) |
| — | updatedByUserName | JOIN user_profiles.full_name (updated_by_user_id) |

**Rekomendacja:** Utworzyć pomocniczą funkcję `mapOrderRow(row)` w `order.service.ts` obsługującą pełne mapowanie.
