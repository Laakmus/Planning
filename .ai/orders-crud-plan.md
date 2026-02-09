# API Endpoint Implementation Plan: Orders CRUD

Plik obejmuje 5 endpointów:
- `GET /api/v1/orders` — lista zleceń
- `GET /api/v1/orders/{orderId}` — szczegóły zlecenia
- `POST /api/v1/orders` — tworzenie zlecenia (wersja robocza)
- `PUT /api/v1/orders/{orderId}` — pełna aktualizacja zlecenia
- `DELETE /api/v1/orders/{orderId}` — anulowanie zlecenia

---

## 1. GET /api/v1/orders — Lista zleceń

### 1.1 Przegląd

Zwraca paginowaną listę zleceń transportowych z filtrami, sortowaniem i wyszukiwaniem. Obsługuje trzy zakładki widoku: „Aktualne", „Zrealizowane", „Anulowane".

### 1.2 Szczegóły żądania

- **Metoda HTTP:** GET
- **URL:** `/api/v1/orders`
- **Parametry query (wszystkie opcjonalne):**

  | Parametr | Typ | Domyślnie | Opis |
  |----------|-----|-----------|------|
  | `view` | `CURRENT \| COMPLETED \| CANCELLED` | `CURRENT` | Zakładka widoku (mapowana na `order_statuses.view_group`) |
  | `status` | `string` (wielokrotny) | — | Filtr po kodach statusu, np. `?status=ROB&status=WYS` |
  | `transportType` | `string` | — | Kod typu transportu |
  | `carrierId` | `uuid` | — | ID firmy przewoźnika |
  | `productId` | `uuid` | — | ID produktu (filtruje przez `order_items`) |
  | `loadingLocationId` | `uuid` | — | ID lokalizacji załadunku (filtruje przez `order_stops` z `kind=LOADING`) |
  | `unloadingLocationId` | `uuid` | — | ID lokalizacji rozładunku (filtruje przez `order_stops` z `kind=UNLOADING`) |
  | `search` | `string` | — | Wyszukiwanie po `search_text` (ILIKE) |
  | `dateFrom` | `YYYY-MM-DD` | — | Początek zakresu dat |
  | `dateTo` | `YYYY-MM-DD` | — | Koniec zakresu dat |
  | `sortBy` | `FIRST_LOADING_DATETIME \| FIRST_UNLOADING_DATETIME \| ORDER_NO \| CARRIER_NAME` | `FIRST_LOADING_DATETIME` | Pole sortowania |
  | `sortDirection` | `ASC \| DESC` | `ASC` | Kierunek sortowania |
  | `page` | `number` | `1` | Numer strony |
  | `pageSize` | `number` | `50` | Rozmiar strony (maks. 200) |

### 1.3 Wykorzystywane typy

- **Query Params:** `OrderListQueryParams`
- **Response DTO:** `OrderListResponseDto` = `PaginatedResponse<OrderListItemDto>`

### 1.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "items": [ /* OrderListItemDto[] */ ],
  "page": 1,
  "pageSize": 50,
  "totalItems": 123,
  "totalPages": 3
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400 Bad Request` | Nieprawidłowe parametry (np. `page=abc`, `pageSize=500`) |
| `401 Unauthorized` | Brak/niepoprawny token |

### 1.5 Przepływ danych

1. Walidacja parametrów query (Zod schema).
2. Budowa zapytania Supabase:
   a. Bazowe zapytanie do `transport_orders` z joinem/podzapytaniami:
      - `order_statuses` → `statusName`, `viewGroup`
      - `transport_types` → `transportTypeName`
      - `vehicle_variants` → `vehicleVariantName`
      - `user_profiles` (3× join) → `createdByUserName`, `updatedByUserName`, `lockedByUserName`
      - Pierwszy `order_items.product_name_snapshot` → `mainProductName`
   b. Filtr `view` → WHERE na `order_statuses.view_group`.
   c. Filtry opcjonalne (status, transportType, carrierId, dateFrom/dateTo).
   d. Filtry wymagające sub-zapytań: `productId` → EXISTS w `order_items`, `loadingLocationId`/`unloadingLocationId` → EXISTS w `order_stops`.
   e. Wyszukiwanie: `search_text ILIKE '%..%'` (z `unaccent` jeśli dostępne).
   f. Sortowanie wg `sortBy` + `sortDirection`.
   g. Paginacja: `.range(offset, offset + pageSize - 1)`.
3. Osobne zapytanie `COUNT(*)` dla `totalItems` (lub użycie `{ count: 'exact' }` w Supabase).
4. Mapowanie wyników na `OrderListItemDto[]`.
5. Zwrócenie `PaginatedResponse<OrderListItemDto>`.

### 1.6 Względy bezpieczeństwa

- Wymagane uwierzytelnienie (JWT).
- Odczyty dostępne dla wszystkich zalogowanych (RLS: `USING (true)` na SELECT).
- Parametr `search` — sanityzacja znaków specjalnych ILIKE (`%`, `_`, `\`).
- `pageSize` ograniczony do maks. 200.

### 1.7 Obsługa błędów

| Scenariusz | Kod | Odpowiedź |
|------------|-----|-----------|
| Niepoprawny format parametrów | 400 | Szczegóły walidacji Zod |
| Brak autentykacji | 401 | `UNAUTHORIZED` |
| Błąd DB | 500 | `INTERNAL_ERROR` |

### 1.8 Rozważania dotyczące wydajności

- Indeksy na `transport_orders`: `status_code`, `transport_type_code`, `carrier_company_id`, `(first_loading_date, order_no)`.
- Paginacja `.range()` zapobiega zwracaniu zbyt dużych zbiorów.
- Rozważyć GIN index na `search_vector` dla FTS (docelowo zamienić ILIKE na `@@`).
- Joiny do tabel słownikowych (małe tabele, cache'owane przez PG).

### 1.9 Etapy wdrożenia

1. **Zod schema** walidacji query params → `src/lib/schemas/order-list.schema.ts`.
2. **Service** `src/lib/services/order.service.ts` — metoda `listOrders(supabase, params): Promise<OrderListResponseDto>`.
3. **Route** `src/pages/api/v1/orders/index.ts` — `export const GET: APIRoute`.
4. **Mapowanie** wyników Supabase → `OrderListItemDto` (helper `mapOrderListItem()`).
5. **Testy manualne:** domyślna lista, filtry, paginacja, sortowanie, wyszukiwanie.

---

## 2. GET /api/v1/orders/{orderId} — Szczegóły zlecenia

### 2.1 Przegląd

Zwraca pełne dane zlecenia (nagłówek + punkty trasy + pozycje towarowe) do formularza szczegółowego.

### 2.2 Szczegóły żądania

- **Metoda HTTP:** GET
- **URL:** `/api/v1/orders/[orderId]`
- **Parametry ścieżki:**
  - `orderId` (UUID, wymagany)
- **Request Body:** brak

### 2.3 Wykorzystywane typy

- **Response DTO:** `OrderDetailResponseDto` = `{ order: OrderDetailDto, stops: OrderDetailStopDto[], items: OrderDetailItemDto[] }`

### 2.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "order": { /* OrderDetailDto */ },
  "stops": [ /* OrderDetailStopDto[] */ ],
  "items": [ /* OrderDetailItemDto[] */ ]
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401 Unauthorized` | Brak autentykacji |
| `404 Not Found` | Zlecenie nie istnieje |

### 2.5 Przepływ danych

1. Walidacja UUID `orderId`.
2. Trzy równoległe zapytania (lub jedno z zagnieżdżonymi selectami Supabase):
   a. `transport_orders` WHERE `id = orderId` → `.single()`
   b. `order_stops` WHERE `order_id = orderId` ORDER BY `sequence_no`
   c. `order_items` WHERE `order_id = orderId`
3. Jeśli zlecenie nie istnieje → `404`.
4. Mapowanie `snake_case` → `camelCase` i zwrot `OrderDetailResponseDto`.

### 2.6 Względy bezpieczeństwa

- Uwierzytelnienie wymagane.
- RLS zapewnia dostęp SELECT dla wszystkich zalogowanych.
- UUID walidowany przed użyciem w zapytaniu.

### 2.7 Obsługa błędów

| Scenariusz | Kod |
|------------|-----|
| Niepoprawny UUID | 400 |
| Zlecenie nie istnieje | 404 |
| Brak autentykacji | 401 |
| Błąd DB | 500 |

### 2.8 Rozważania dotyczące wydajności

- Zapytanie po PK (`id`) — O(1).
- `order_stops` i `order_items` mają indeks na `order_id`.
- Zagnieżdżony select Supabase pozwala pobrać wszystko w jednym HTTP:
  ```typescript
  supabase.from('transport_orders')
    .select('*, order_stops(*), order_items(*)')
    .eq('id', orderId)
    .single()
  ```

### 2.9 Etapy wdrożenia

1. **Service** — metoda `getOrderById(supabase, orderId): Promise<OrderDetailResponseDto | null>` w `order.service.ts`.
2. **Route** `src/pages/api/v1/orders/[orderId].ts` — `export const GET: APIRoute`.
3. **Mapper** `mapOrderDetail()` — konwersja snake_case → camelCase dla order, stops, items.
4. Testy: poprawne ID → 200, niepoprawne UUID → 400, nieistniejące → 404.

---

## 3. POST /api/v1/orders — Tworzenie zlecenia

### 3.1 Przegląd

Tworzy nowe zlecenie transportowe w statusie roboczym (`ROB`). Zlecenie może być niekompletne — pełna walidacja biznesowa następuje dopiero przy próbie wysyłki maila (`prepare-email`).

### 3.2 Szczegóły żądania

- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders`
- **Request Body:** `CreateOrderCommand`

  | Pole | Typ | Wymagane | Opis |
  |------|-----|----------|------|
  | `transportTypeCode` | `TransportTypeCode` | Tak | Kod typu transportu |
  | `currencyCode` | `CurrencyCode` | Tak | Waluta |
  | `vehicleVariantCode` | `string` | Tak | Wariant pojazdu |
  | `carrierCompanyId` | `uuid \| null` | Nie | Przewoźnik |
  | `shipperLocationId` | `uuid \| null` | Nie | Lokalizacja nadawcy |
  | `receiverLocationId` | `uuid \| null` | Nie | Lokalizacja odbiorcy |
  | `priceAmount` | `number \| null` | Nie | Cena |
  | `paymentTermDays` | `number \| null` | Nie | Termin płatności |
  | `paymentMethod` | `string \| null` | Nie | Forma płatności |
  | `totalLoadTons` | `number \| null` | Nie | Masa |
  | `totalLoadVolumeM3` | `number \| null` | Nie | Objętość |
  | `specialRequirements` | `string \| null` | Nie | Wymagania specjalne |
  | `requiredDocumentsText` | `string \| null` | Nie | Wymagane dokumenty |
  | `generalNotes` | `string \| null` | Nie | Uwagi |
  | `senderContactName` | `string \| null` | Nie | Kontakt nadawcy |
  | `senderContactPhone` | `string \| null` | Nie | Telefon nadawcy |
  | `senderContactEmail` | `string \| null` | Nie | Email nadawcy |
  | `stops` | `CreateOrderStopInput[]` | Nie | Punkty trasy |
  | `items` | `CreateOrderItemInput[]` | Nie | Pozycje towarowe |

### 3.3 Wykorzystywane typy

- **Command:** `CreateOrderCommand`, `CreateOrderStopInput`, `CreateOrderItemInput`
- **Response DTO:** `CreateOrderResponseDto`

### 3.4 Szczegóły odpowiedzi

**Sukces — `201 Created`**
```json
{
  "id": "uuid",
  "orderNo": "ZT2026/0001",
  "statusCode": "ROB",
  "createdAt": "2026-02-08T12:00:00Z"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400 Bad Request` | Błędy walidacji technicznej |
| `401 Unauthorized` | Brak autentykacji |
| `403 Forbidden` | Rola `READ_ONLY` |
| `409 Conflict` | Kolizja (np. duplikat `order_no`) |

### 3.5 Przepływ danych

1. **Autentykacja i autoryzacja:** JWT + rola ∈ {ADMIN, PLANNER}.
2. **Walidacja wejścia** (Zod):
   - `transportTypeCode` ∈ {PL, EXP, EXP_K, IMP} — wymagane.
   - `currencyCode` ∈ {PLN, EUR, USD} — wymagane.
   - `vehicleVariantCode` — wymagane, niepusty string.
   - `quantityTons` — null lub >= 0.
   - Stops: `kind` ∈ {LOADING, UNLOADING}.
3. **Generowanie `order_no`:** Serwer generuje unikalny numer (np. `ZT{rok}/{seq}`) — logika w service lub trigger bazodanowy.
4. **Resolve snapshotów:** Jeśli podano `carrierCompanyId` → pobranie nazwy i adresu z `companies`/`locations` → zapisanie w `carrier_name_snapshot`, `carrier_address_snapshot` itd. Analogicznie dla `shipperLocationId`, `receiverLocationId`. Dla stops z `locationId` → pobranie snapshotu z `locations`.
5. **Insert transakcyjny:**
   a. INSERT `transport_orders` z `status_code = 'ROB'`, `created_by_user_id = auth.uid()`.
   b. INSERT `order_stops[]` (z `order_id` = nowe zlecenie).
   c. INSERT `order_items[]` (z `order_id` = nowe zlecenie).
   d. INSERT `order_status_history` (initial: `old_status_code = 'ROB'`, `new_status_code = 'ROB'`).
6. **Aktualizacja pól denormalizowanych:** `first_loading_date/time`, `first_unloading_date/time`, `last_loading_date/time`, `last_unloading_date/time`, `first_loading_country`, `first_unloading_country`, `summary_route`, `search_text`, `transport_year` — najlepiej wyliczać w triggerze lub service.
7. Zwrócenie `CreateOrderResponseDto`.

### 3.6 Względy bezpieczeństwa

- **Autoryzacja:** Tylko `ADMIN`/`PLANNER` mogą tworzyć zlecenia. Sprawdzenie roli w middleware lub w endpoincie.
- **RLS:** Polityka INSERT wymaga `role IN ('ADMIN','PLANNER')`.
- **FK walidacja:** Supabase rzuci błąd jeśli `carrierCompanyId`, `vehicleVariantCode`, `transportTypeCode` nie istnieją — obsłużyć jako 400.
- **Sanityzacja:** Wszystkie stringi ograniczone przez DB (varchar(500)), ale warto trimować i ograniczać długość w Zod.

### 3.7 Obsługa błędów

| Scenariusz | Kod | Odpowiedź |
|------------|-----|-----------|
| Brak wymaganych pól | 400 | Lista brakujących pól |
| Niepoprawne wartości enum | 400 | Szczegóły |
| `quantityTons < 0` | 400 | Walidacja |
| FK nie istnieje (np. `carrierCompanyId`) | 400 | „Przewoźnik nie istnieje" |
| Rola READ_ONLY | 403 | „Brak uprawnień" |
| Duplikat `order_no` | 409 | Conflict (powtórka — retry z nowym numerem) |
| Błąd DB | 500 | `INTERNAL_ERROR` |

### 3.8 Rozważania dotyczące wydajności

- Resolve snapshotów wymaga dodatkowych zapytań SELECT (companies, locations, products) — batch jeśli możliwe.
- Transakcja: Supabase JS Client nie obsługuje natywnych transakcji SQL — rozwiązanie to RPC (funkcja PostgreSQL) lub sekwencyjne inserty z obsługą rollbacku manualnego (delete na błąd).
- Alternatywnie: Supabase edge function z `pg` do prawdziwych transakcji.
- Na MVP: sekwencyjne inserty — jeśli stops/items failują, usunąć zlecenie (CASCADE).

### 3.9 Etapy wdrożenia

1. **Zod schema** `createOrderSchema` → `src/lib/schemas/create-order.schema.ts`.
2. **Service** — metoda `createOrder(supabase, userId, command): Promise<CreateOrderResponseDto>` w `order.service.ts`.
3. **Helper** `generateOrderNo(supabase, year)` — generowanie numeru zlecenia.
4. **Helper** `resolveSnapshots(supabase, command)` — pobranie nazw/adresów.
5. **Route** `src/pages/api/v1/orders/index.ts` — `export const POST: APIRoute`.
6. **Middleware/guard** — sprawdzenie roli (ADMIN/PLANNER).
7. Testy: tworzenie z minimalnym body, z pełnym body, brak wymaganego pola → 400, READ_ONLY → 403.

---

## 4. PUT /api/v1/orders/{orderId} — Pełna aktualizacja

### 4.1 Przegląd

Zapis zmian z formularza szczegółowego: nagłówek zlecenia + punkty trasy + pozycje towarowe. Status **nie** jest modyfikowany bezpośrednio — automatyczne przejście `WYS`/`KOR_WYS` → `KOR` następuje po stronie serwera, gdy wykryje zmianę pól biznesowych.

### 4.2 Szczegóły żądania

- **Metoda HTTP:** PUT
- **URL:** `/api/v1/orders/[orderId]`
- **Parametry ścieżki:** `orderId` (UUID)
- **Request Body:** `UpdateOrderCommand`

  Pola nagłówka — identyczne jak w `CreateOrderCommand` + `complaintReason`.
  Stops i items zawierają `id` (null = nowy) i `_deleted` (true = do usunięcia).

### 4.3 Wykorzystywane typy

- **Command:** `UpdateOrderCommand`, `UpdateOrderStopInput`, `UpdateOrderItemInput`
- **Response DTO:** `UpdateOrderResponseDto`

### 4.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "id": "uuid",
  "statusCode": "ROB",
  "updatedAt": "2026-02-08T14:30:00Z"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400 Bad Request` | Błędy walidacji |
| `401 Unauthorized` | Brak autentykacji |
| `403 Forbidden` | READ_ONLY lub status nieedytowalny |
| `404 Not Found` | Zlecenie nie istnieje |
| `409 Conflict` | Zlecenie zablokowane przez innego użytkownika |

### 4.5 Przepływ danych

1. **Autentykacja i autoryzacja:** JWT + rola ∈ {ADMIN, PLANNER}.
2. **Walidacja wejścia** (Zod) — analogiczna do `CreateOrderCommand` + limity stops (maks. 8 LOADING, 3 UNLOADING).
3. **Pobranie istniejącego zlecenia** z `transport_orders`.
4. **Sprawdzenie blokady:**
   - Jeśli `locked_by_user_id` ≠ null i ≠ current user i blokada nie wygasła → `409 Conflict`.
5. **Sprawdzenie edytowalności statusu:**
   - Jeśli `order_statuses.is_editable = false` dla bieżącego statusu → `403 Forbidden`.
6. **Detekcja zmian pól biznesowych** (porównanie starych i nowych wartości):
   - Jeśli status ∈ {WYS, KOR_WYS} i zmieniono pola biznesowe → automatyczne przejście na `KOR`.
   - Logowanie zmian do `order_change_log`.
7. **Update nagłówka** `transport_orders`:
   - SET zmienione pola + `updated_at = now()`, `updated_by_user_id = auth.uid()`.
8. **Sync stops:**
   - `_deleted: true` + `id` → DELETE.
   - `id: null` → INSERT nowy stop.
   - `id: uuid` → UPDATE.
9. **Sync items:**
   - Analogicznie jak stops.
10. **Re-resolve snapshotów** jeśli zmienił się `carrierCompanyId`, `shipperLocationId`, `receiverLocationId` lub stops z nowym `locationId`.
11. **Aktualizacja pól denormalizowanych** (daty, trasa, search_text).
12. Zwrócenie `UpdateOrderResponseDto`.

### 4.6 Względy bezpieczeństwa

- Autoryzacja: rola ADMIN/PLANNER.
- Blokada współbieżna: sprawdzenie `locked_by_user_id`.
- Trigger DB blokuje edycję pól biznesowych dla statusów nieedytowalnych — dodatkowe zabezpieczenie na wypadek pominięcia walidacji w kodzie.
- `_deleted` — nie może usunąć cudzych stops/items (FK gwarantuje `order_id`).

### 4.7 Obsługa błędów

| Scenariusz | Kod |
|------------|-----|
| Niepoprawne dane | 400 |
| Przekroczony limit stops (8 LOADING / 3 UNLOADING) | 400 |
| Brak autentykacji | 401 |
| Status nieedytowalny | 403 |
| Zlecenie nie istnieje | 404 |
| Blokada innego użytkownika | 409 |
| Błąd DB | 500 |

### 4.8 Rozważania dotyczące wydajności

- Porównanie pól (detekcja zmian) — w pamięci, lekkie.
- Wiele operacji DML (update + insert/delete stops/items + change_log) — najlepiej w transakcji (RPC).
- Re-resolve snapshotów — dodatkowe SELECTy, ale małe tabele.

### 4.9 Etapy wdrożenia

1. **Zod schema** `updateOrderSchema` → `src/lib/schemas/update-order.schema.ts`.
2. **Service** — metoda `updateOrder(supabase, userId, orderId, command): Promise<UpdateOrderResponseDto>`.
3. **Helper** `detectChanges(oldOrder, newData): FieldChange[]` — porównanie pól.
4. **Helper** `syncStops(supabase, orderId, stops[])` — CRUD na stops.
5. **Helper** `syncItems(supabase, orderId, items[])` — CRUD na items.
6. **Route** `src/pages/api/v1/orders/[orderId].ts` — `export const PUT: APIRoute`.
7. Testy: aktualizacja pól, dodawanie/usuwanie stops, zmiana statusu WYS→KOR, blokada → 409.

---

## 5. DELETE /api/v1/orders/{orderId} — Anulowanie

### 5.1 Przegląd

Ustawia status zlecenia na `ANL` (anulowane). Jest aliasem dla `POST /orders/{orderId}/status` z `newStatusCode: "ANL"`. Fizyczne usunięcie po 24h realizuje job w tle.

### 5.2 Szczegóły żądania

- **Metoda HTTP:** DELETE
- **URL:** `/api/v1/orders/[orderId]`
- **Parametry ścieżki:** `orderId` (UUID)
- **Request Body:** brak

### 5.3 Wykorzystywane typy

- **Response DTO:** `DeleteOrderResponseDto`

### 5.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "id": "uuid",
  "statusCode": "ANL"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401 Unauthorized` | Brak autentykacji |
| `403 Forbidden` | Rola READ_ONLY |
| `404 Not Found` | Zlecenie nie istnieje |

### 5.5 Przepływ danych

1. Autentykacja + autoryzacja (ADMIN/PLANNER).
2. Walidacja UUID.
3. Pobranie zlecenia — sprawdzenie istnienia.
4. UPDATE `status_code = 'ANL'` + `updated_at`, `updated_by_user_id`.
5. INSERT do `order_status_history`.
6. Zwolnienie blokady (`locked_by_user_id = null`, `locked_at = null`).
7. Zwrócenie `DeleteOrderResponseDto`.

### 5.6 Względy bezpieczeństwa

- Rola ADMIN/PLANNER wymagana.
- RLS chroni dodatkowo.
- Idempotentność: ponowne DELETE na już anulowanym zleceniu może zwrócić 200 (bez efektu) lub 400.

### 5.7 Obsługa błędów

| Scenariusz | Kod |
|------------|-----|
| Niepoprawny UUID | 400 |
| Brak autentykacji | 401 |
| READ_ONLY | 403 |
| Zlecenie nie istnieje | 404 |
| Błąd DB | 500 |

### 5.8 Etapy wdrożenia

1. **Service** — metoda `cancelOrder(supabase, userId, orderId): Promise<DeleteOrderResponseDto>` (re-use logiki z `changeStatus`).
2. **Route** `src/pages/api/v1/orders/[orderId].ts` — `export const DELETE: APIRoute`.
3. Testy: anulowanie istniejącego zlecenia → 200, nieistniejące → 404, READ_ONLY → 403.

---

## Wspólne elementy implementacji (dla wszystkich endpointów Orders)

### Struktura plików

```
src/
├── lib/
│   ├── schemas/
│   │   ├── order-list.schema.ts      # Zod: query params listy
│   │   ├── create-order.schema.ts    # Zod: CreateOrderCommand
│   │   └── update-order.schema.ts    # Zod: UpdateOrderCommand
│   ├── services/
│   │   └── order.service.ts          # Logika biznesowa zleceń
│   ├── helpers/
│   │   ├── resolve-snapshots.ts      # Resolve nazw/adresów z FK
│   │   ├── order-no-generator.ts     # Generowanie order_no
│   │   └── map-order.ts             # Mapery snake→camel
│   └── utils/
│       ├── api-response.ts           # Helpery jsonResponse(), errorResponse()
│       └── auth-guard.ts             # Sprawdzenie autentykacji + roli
├── pages/
│   └── api/
│       └── v1/
│           └── orders/
│               ├── index.ts          # GET (lista) + POST (tworzenie)
│               └── [orderId].ts      # GET (szczegóły) + PUT (update) + DELETE (anulowanie)
```

### Wspólna obsługa autentykacji

Stworzyć helper `requireAuth(context)`:
1. Pobiera `supabase` z `context.locals`.
2. Wywołuje `supabase.auth.getUser()`.
3. Jeśli brak usera → rzuca/zwraca 401.
4. Pobiera profil z `user_profiles`.
5. Zwraca `{ user, profile, supabase }`.

Stworzyć helper `requireRole(profile, ...allowedRoles)`:
1. Sprawdza `profile.role ∈ allowedRoles`.
2. Jeśli nie → rzuca/zwraca 403.

### Wspólna obsługa odpowiedzi

Helper `jsonResponse(data, status)` i `errorResponse(code, message, details?, status)` generujące `new Response(JSON.stringify(...), { status, headers: { 'Content-Type': 'application/json' } })`.
