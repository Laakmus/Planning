# Plan REST API

## 1. Zasoby

- **Zlecenia transportowe** → tabela `transport_orders`
- **Punkty trasy (załadunki/rozładunki)** → tabela `order_stops`
- **Pozycje towarowe zlecenia** → tabela `order_items`
- **Historia statusów zlecenia** → tabela `order_status_history`
- **Log zmian pól zlecenia** → tabela `order_change_log`
- **Firmy (przewoźnicy, nadawcy, odbiorcy)** → tabela `companies`
- **Lokalizacje / oddziały firm** → tabela `locations`
- **Produkty / towary** → tabela `products`
- **Typy transportu** → tabela `transport_types`
- **Statusy zleceń** → tabela `order_statuses`
- **Warianty pojazdów** → tabela `vehicle_variants`
- **Profile użytkowników** → tabela `user_profiles` (nad Supabase `auth.users`)
- **Synchronizacja słowników (logiczny zasób)** → integracja z ERP
- **Dokumenty PDF (logiczny zasób)** → generowane z danych zlecenia

---

## 2. Punkty końcowe

> Wszystkie ścieżki są zagnieżdżone pod prefiksem `/api/v1`.
> Wszystkie odpowiedzi są w formacie JSON, chyba że zaznaczono inaczej (PDF).

### 2.1 Uwierzytelnianie / sesja

- **GET** `/api/v1/auth/me`
  - **Opis**: Zwraca aktualnie zalogowanego użytkownika (profil + rola).
  - **Parametry zapytania**: brak
  - **Body żądania**: brak
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "string | null",
      "phone": "string | null",
      "role": "ADMIN | PLANNER | READ_ONLY"
    }
    ```
  - **Sukces**: `200 OK`
  - **Błędy**: `401 Unauthorized`

---

### 2.2 Zlecenia – lista, filtrowanie, sortowanie

- **GET** `/api/v1/orders`
  - **Opis**: Zwraca listę zleceń do widoku planistycznego (zakładki „Aktualne", „Zrealizowane", „Anulowane") z filtrami, sortowaniem i paginacją.
  - **Parametry zapytania**:
    - `view` (opcjonalny): `CURRENT | COMPLETED | CANCELLED` (domyślnie `CURRENT`, mapowane na `order_statuses.view_group`)
    - `status` (opcjonalny, wielokrotny): np. `ROB`, `WYS`, `KOR`, `KOR_WYS`, `ZRE`, `ANL`, `REK`
    - `transportType` (opcjonalny): kod typu transportu (`transport_types.code`)
    - `carrierId` (opcjonalny, UUID)
    - `productId` (opcjonalny, UUID)
    - `loadingLocationId` (opcjonalny, UUID)
    - `unloadingLocationId` (opcjonalny, UUID)
    - `search` (opcjonalny, string): wyszukiwanie po `search_text`
    - `dateFrom` / `dateTo` (opcjonalne, ISO date): zakres dat załadunku/rozładunku
    - `sortBy` (opcjonalny): `FIRST_LOADING_DATETIME | FIRST_UNLOADING_DATETIME | ORDER_NO | CARRIER_NAME`
    - `sortDirection` (opcjonalny): `ASC | DESC`
    - `page` (opcjonalny): numer strony (domyślnie `1`)
    - `pageSize` (opcjonalny): rozmiar strony (domyślnie `50`, maks. `200`)
  - **Struktura odpowiedzi**:
    ```json
    {
      "items": [
        {
          "id": "uuid",
          "orderNo": "string",
          "statusCode": "ROB | WYS | KOR | KOR_WYS | ZRE | ANL | REK",
          "statusName": "string",
          "viewGroup": "CURRENT | COMPLETED | CANCELLED",
          "transportTypeCode": "PL | EXP | EXP_K | IMP",
          "transportTypeName": "string",
          "summaryRoute": "string",
          "firstLoadingDate": "YYYY-MM-DD | null",
          "firstLoadingTime": "HH:MM:SS | null",
          "firstUnloadingDate": "YYYY-MM-DD | null",
          "firstUnloadingTime": "HH:MM:SS | null",
          "carrierCompanyId": "uuid | null",
          "carrierName": "string | null",
          "mainProductName": "string | null",
          "priceAmount": "number | null",
          "currencyCode": "PLN | EUR | USD",
          "vehicleVariantCode": "string",
          "vehicleVariantName": "string",
          "requiredDocumentsText": "string | null",
          "generalNotes": "string | null",
          "lockedByUserId": "uuid | null",
          "lockedByUserName": "string | null",
          "lockedAt": "timestamp | null",
          "createdAt": "timestamp",
          "createdByUserId": "uuid",
          "createdByUserName": "string | null",
          "updatedAt": "timestamp",
          "updatedByUserId": "uuid | null",
          "updatedByUserName": "string | null"
        }
      ],
      "page": 1,
      "pageSize": 50,
      "totalItems": 123,
      "totalPages": 3
    }
    ```
  - **Sukces**: `200 OK`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`

---

### 2.3 Zlecenia – widok szczegółowy

- **GET** `/api/v1/orders/{orderId}`
  - **Opis**: Zwraca pełne dane zlecenia do formularza szczegółowego (nagłówek + punkty + pozycje).
  - **Parametry ścieżki**: `orderId` (UUID)
  - **Struktura odpowiedzi**:
    ```json
    {
      "order": {
        "id": "uuid",
        "orderNo": "string",
        "statusCode": "ROB | WYS | KOR | KOR_WYS | ZRE | ANL | REK",
        "transportTypeCode": "PL | EXP | EXP_K | IMP",
        "currencyCode": "PLN | EUR | USD",
        "priceAmount": "number | null",
        "paymentTermDays": "number | null",
        "paymentMethod": "string | null",
        "totalLoadTons": "number | null",
        "totalLoadVolumeM3": "number | null",
        "summaryRoute": "string | null",
        "firstLoadingDate": "YYYY-MM-DD | null",
        "firstLoadingTime": "HH:MM:SS | null",
        "firstUnloadingDate": "YYYY-MM-DD | null",
        "firstUnloadingTime": "HH:MM:SS | null",
        "transportYear": 2026,
        "firstLoadingCountry": "string | null",
        "firstUnloadingCountry": "string | null",
        "carrierCompanyId": "uuid | null",
        "carrierNameSnapshot": "string | null",
        "shipperLocationId": "uuid | null",
        "shipperNameSnapshot": "string | null",
        "receiverLocationId": "uuid | null",
        "receiverNameSnapshot": "string | null",
        "vehicleVariantCode": "string",
        "specialRequirements": "string | null",
        "requiredDocumentsText": "string | null",
        "generalNotes": "string | null",
        "complaintReason": "string | null",
        "senderContactName": "string | null",
        "senderContactPhone": "string | null",
        "senderContactEmail": "string | null",
        "createdAt": "timestamp",
        "createdByUserId": "uuid",
        "updatedAt": "timestamp",
        "updatedByUserId": "uuid | null",
        "lockedByUserId": "uuid | null",
        "lockedAt": "timestamp | null"
      },
      "stops": [
        {
          "id": "uuid",
          "kind": "LOADING | UNLOADING",
          "sequenceNo": 1,
          "dateLocal": "YYYY-MM-DD | null",
          "timeLocal": "HH:MM:SS | null",
          "locationId": "uuid | null",
          "locationNameSnapshot": "string | null",
          "companyNameSnapshot": "string | null",
          "addressSnapshot": "string | null",
          "notes": "string | null"
        }
      ],
      "items": [
        {
          "id": "uuid",
          "productId": "uuid | null",
          "productNameSnapshot": "string | null",
          "defaultLoadingMethodSnapshot": "string | null",
          "quantityTons": "number | null",
          "notes": "string | null"
        }
      ]
    }
    ```
  - **Sukces**: `200 OK`
  - **Błędy**: `401 Unauthorized`, `404 Not Found`

---

### 2.4 Zlecenia – tworzenie (wersja robocza)

- **POST** `/api/v1/orders`
  - **Opis**: Tworzy nowe zlecenie w statusie roboczym (`ROB`). Zlecenie może być niekompletne – pełna walidacja biznesowa następuje dopiero przy próbie wysyłki maila.
  - **Body żądania** (nagłówek + prosty agregat):
    ```json
    {
      "transportTypeCode": "PL | EXP | EXP_K | IMP",
      "currencyCode": "PLN | EUR | USD",
      "carrierCompanyId": "uuid | null",
      "shipperLocationId": "uuid | null",
      "receiverLocationId": "uuid | null",
      "vehicleVariantCode": "string",
      "priceAmount": "number | null",
      "paymentTermDays": "number | null",
      "paymentMethod": "string | null",
      "totalLoadTons": "number | null",
      "totalLoadVolumeM3": "number | null",
      "specialRequirements": "string | null",
      "requiredDocumentsText": "string | null",
      "generalNotes": "string | null",
      "senderContactName": "string | null",
      "senderContactPhone": "string | null",
      "senderContactEmail": "string | null",
      "stops": [
        {
          "kind": "LOADING | UNLOADING",
          "dateLocal": "YYYY-MM-DD | null",
          "timeLocal": "HH:MM:SS | null",
          "locationId": "uuid | null",
          "notes": "string | null"
        }
      ],
      "items": [
        {
          "productId": "uuid | null",
          "productNameSnapshot": "string | null",
          "quantityTons": "number | null",
          "notes": "string | null"
        }
      ]
    }
    ```
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "orderNo": "string",
      "statusCode": "ROB",
      "createdAt": "timestamp"
    }
    ```
  - **Walidacja techniczna**:
    - `transportTypeCode`, `currencyCode`, `vehicleVariantCode` – wymagane.
    - `currencyCode ∈ {PLN, EUR, USD}`.
    - `quantityTons` `NULL` lub `>= 0`.
    - `statusCode` ustawiany po stronie serwera (`ROB`).
    - `orderNo` generowany na serwerze, później niezmienny.
  - **Sukces**: `201 Created`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`, `409 Conflict`

---

### 2.5 Zlecenia – pełna aktualizacja

- **PUT** `/api/v1/orders/{orderId}`
  - **Opis**: Zapis zmian z formularza szczegółowego (nagłówek, punkty, pozycje). Dopuszcza wersje robocze niekompletne. **Status zlecenia nie jest modyfikowany przez ten endpoint.** Automatyczne przejście `WYS`/`KOR_WYS` → `KOR` następuje po stronie serwera, gdy wykryje zmianę pól biznesowych w zleceniu wysłanym. Ręczne zmiany statusów realizowane są wyłącznie przez `/status`, `/restore` i `/prepare-email`.
  - **Parametry ścieżki**: `orderId` (UUID)
  - **Body żądania**:
    ```json
    {
      "transportTypeCode": "PL | EXP | EXP_K | IMP",
      "currencyCode": "PLN | EUR | USD",
      "priceAmount": "number | null",
      "paymentTermDays": "number | null",
      "paymentMethod": "string | null",
      "totalLoadTons": "number | null",
      "totalLoadVolumeM3": "number | null",
      "carrierCompanyId": "uuid | null",
      "shipperLocationId": "uuid | null",
      "receiverLocationId": "uuid | null",
      "vehicleVariantCode": "string",
      "specialRequirements": "string | null",
      "requiredDocumentsText": "string | null",
      "generalNotes": "string | null",
      "complaintReason": "string | null",
      "senderContactName": "string | null",
      "senderContactPhone": "string | null",
      "senderContactEmail": "string | null",
      "stops": [
        {
          "id": "uuid | null",
          "kind": "LOADING | UNLOADING",
          "sequenceNo": 1,
          "dateLocal": "YYYY-MM-DD | null",
          "timeLocal": "HH:MM:SS | null",
          "locationId": "uuid | null",
          "notes": "string | null",
          "_deleted": false
        }
      ],
      "items": [
        {
          "id": "uuid | null",
          "productId": "uuid | null",
          "productNameSnapshot": "string | null",
          "quantityTons": "number | null",
          "notes": "string | null",
          "_deleted": false
        }
      ]
    }
    ```
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "statusCode": "string",
      "updatedAt": "timestamp"
    }
    ```
  - **Reguły biznesowe**:
    - Jeśli zlecenie ma status `WYS` lub `KOR_WYS` i zapis zmienia pola biznesowe, serwer automatycznie ustawia status na `KOR`.
    - Statusy nieedytowalne (np. `ZRE`, `ANL`) – triggery blokują modyfikację pól biznesowych poza dozwolonymi przypadkami (np. przywrócenie).
    - `_deleted = true` → usunięcie wiersza; `id = null` → tworzenie nowego.
    - Limity: maks. 8 punktów `LOADING` i 3 `UNLOADING`.
  - **Sukces**: `200 OK`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict`

---

### 2.6 Zlecenia – anulowanie

- **DELETE** `/api/v1/orders/{orderId}`
  - **Opis**: Ustawia status `ANL` (anulowane). Fizyczne usunięcie po 24h realizuje job w tle. Działanie jest aliasem `POST /orders/{orderId}/status` z `newStatusCode: "ANL"` – DELETE służy jako szybka akcja z widoku listy, `/status` jako pełna zmiana statusu z formularza.
  - **Parametry ścieżki**: `orderId` (UUID)
  - **Body odpowiedzi**:
    ```json
    { "id": "uuid", "statusCode": "ANL" }
    ```
  - **Reguły**:
    - Dostępne dla `ADMIN` i `PLANNER`.
  - **Sukces**: `200 OK`
  - **Błędy**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

---

### 2.7 Zlecenia – zmiana statusu i przywracanie

- **POST** `/api/v1/orders/{orderId}/status`
  - **Opis**: Ręczna zmiana statusu (np. `ZRE`, `REK`, `ANL`, `ROB`).
  - **Body żądania**:
    ```json
    {
      "newStatusCode": "ROB | ZRE | REK | ANL",
      "complaintReason": "string | null"
    }
    ```
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "oldStatusCode": "string",
      "newStatusCode": "string"
    }
    ```
  - **Reguły biznesowe**:
    - Statusy `WYS`, `KOR`, `KOR_WYS` ustawiane tylko automatycznie przy wysyłce.
    - Przy `REK` wymagane `complaintReason`.
    - Zmiany logowane w `order_status_history` i `order_change_log`.

- **POST** `/api/v1/orders/{orderId}/restore`
  - **Opis**: Przywraca zlecenie z zakładek „Zrealizowane" lub „Anulowane" do „Aktualnych".
  - **Body żądania**:
    ```json
    { "targetStatusCode": "ROB | WYS" }
    ```
  - **Reguły**:
    - Z `ANL` – tylko jeśli minęło < 24h od anulowania.

---

### 2.8 Zlecenia – blokada współbieżnej edycji

- **POST** `/api/v1/orders/{orderId}/lock`
  - **Opis**: Ustawia blokadę edycji zlecenia dla bieżącego użytkownika.
  - **Odpowiedź**:
    ```json
    {
      "id": "uuid",
      "lockedByUserId": "uuid",
      "lockedAt": "timestamp"
    }
    ```
  - **Reguły**:
    - Jeśli zlecenie już zablokowane przez innego użytkownika (i blokada nie wygasła) → `409 Conflict`.

- **POST** `/api/v1/orders/{orderId}/unlock`
  - **Opis**: Zwalnia blokadę (po zapisie lub wyjściu z formularza).
  - **Odpowiedź**:
    ```json
    { "id": "uuid", "lockedByUserId": null, "lockedAt": null }
    ```

---

### 2.9 Zlecenia – kopiowanie (etap 2)

- **POST** `/api/v1/orders/{orderId}/duplicate`
  - **Opis**: Tworzy nowe zlecenie na podstawie istniejącego (wzorzec).
  - **Body żądania**:
    ```json
    {
      "includeStops": true,
      "includeItems": true,
      "resetStatusToDraft": true
    }
    ```
  - **Odpowiedź**:
    ```json
    { "id": "uuid", "orderNo": "string", "statusCode": "ROB" }
    ```

---

### 2.10 Punkty trasy – aktualizacje częściowe (opcjonalne)

- **PATCH** `/api/v1/orders/{orderId}/stops/{stopId}`
  - **Opis**: Częściowa edycja pojedynczego punktu (np. zmiana daty/godziny, lokalizacji).
  - **Body żądania**:
    ```json
    {
      "dateLocal": "YYYY-MM-DD",
      "timeLocal": "HH:MM:SS",
      "locationId": "uuid",
      "notes": "string"
    }
    ```

---

### 2.11 Historia zlecenia

- **GET** `/api/v1/orders/{orderId}/history/status`
  - **Opis**: Zwraca historię zmian statusu (`order_status_history`).

- **GET** `/api/v1/orders/{orderId}/history/changes`
  - **Opis**: Zwraca log zmian kluczowych pól (`order_change_log`).

---

### 2.12 Słowniki – firmy, lokalizacje, produkty, typy, statusy, pojazdy

- **GET** `/api/v1/companies` – autocomplete po firmach (`companies`)
- **GET** `/api/v1/locations` – autocomplete po lokalizacjach (`locations`)
- **GET** `/api/v1/products` – autocomplete po produktach (`products`)
- **GET** `/api/v1/transport-types` – lista typów transportu (`transport_types`)
- **GET** `/api/v1/order-statuses` – lista statusów zleceń (`order_statuses`)
- **GET** `/api/v1/vehicle-variants` – lista wariantów pojazdów (`vehicle_variants`)

Wszystkie te endpointy używają standardowego formatu:

```json
{
  "items": [
    { /* obiekt słownikowy */ }
  ]
}
```

---

### 2.13 Synchronizacja słowników z ERP

- **POST** `/api/v1/dictionary-sync/run`
  - **Opis**: Ręczne wywołanie synchronizacji słowników z ERP.
  - **Body żądania**:
    ```json
    {
      "resources": ["COMPANIES", "LOCATIONS", "PRODUCTS"]
    }
    ```
  - **Odpowiedź**:
    ```json
    {
      "jobId": "uuid",
      "status": "STARTED"
    }
    ```

- **GET** `/api/v1/dictionary-sync/jobs/{jobId}`
  - **Opis**: Sprawdzenie statusu zadania synchronizacji.

---

### 2.14 Generowanie PDF

- **POST** `/api/v1/orders/{orderId}/pdf`
  - **Opis**: Generuje PDF zlecenia; zwraca `application/pdf`.
  - **Body żądania** (opcjonalne):
    ```json
    { "regenerate": true }
    ```
  - **Sukces**: `200 OK` (binarne dane PDF)
  - **Błędy**: `400 Bad Request`, `404 Not Found`

---

### 2.15 Wspomaganie wysyłki maila

- **POST** `/api/v1/orders/{orderId}/prepare-email`
  - **Opis**: Sprawdza kompletność danych wymaganych do wysyłki zlecenia, generuje/odświeża PDF i zwraca dane potrzebne do otwarcia Outlooka. Ustawia status `WYS` lub `KOR_WYS`.
  - **Body żądania**:
    ```json
    { "forceRegeneratePdf": false }
    ```
  - **Walidacja biznesowa**:
    - wymagany typ transportu, przewoźnik, nadawca, odbiorca,
    - minimalny opis ładunku + ilość,
    - ≥ 1 punkt załadunku i ≥ 1 rozładunku z datą i godziną,
    - cena (jeśli wymagana przed wysyłką),
    - `paymentTermDays`, `paymentMethod` — opcjonalne (nie wymagane do wysyłki).
  - **Sukces (przykład)**:
    ```json
    {
      "orderId": "uuid",
      "statusBefore": "ROB | WYS | KOR",
      "statusAfter": "WYS | KOR_WYS",
      "emailOpenUrl": "string",
      "pdfFileName": "ZT2026-0001.pdf"
    }
    ```
  - **Błędy**: `401`, `403`, `404`, `422` (lista braków do wysyłki)

---

## 3. Uwierzytelnianie i autoryzacja

- **Uwierzytelnianie**:
  - Supabase Auth (JWT), backend weryfikuje token w nagłówku `Authorization`.
  - Endpoint `/auth/me` bazuje na `user_profiles` powiązanych z `auth.users`.
- **Role i uprawnienia**:
  - role: `ADMIN`, `PLANNER`, `READ_ONLY` w `user_profiles.role`,
  - RLS w PostgreSQL:
    - wszyscy zalogowani → `SELECT`,
    - `ADMIN`, `PLANNER` → `INSERT/UPDATE/DELETE`,
    - `READ_ONLY` → tylko `SELECT`.
- **Zasady na poziomie API**:
  - wszystkie endpointy `POST/PUT/PATCH/DELETE` sprawdzają rolę,
  - odczyty (`GET`) dostępne dla wszystkich zalogowanych,
  - wyjątki (np. nadpisanie blokady) tylko dla `ADMIN`.

---

## 4. Walidacja i logika biznesowa

- **Walidacja techniczna**:
  - typy danych i constrainty z bazy (`CHECK`, FK, unikalność),
  - błędy walidacji technicznej → kody 4xx z opisem.
- **Walidacja biznesowa**:
  - przy zwykłym zapisie (`POST/PUT`) – dopuszcza braki (zlecenie robocze),
  - przy wysyłce maila – pełna walidacja wymienionych wyżej warunków.
- **Cykl życia statusów**:
  - automatyczne przejścia (`ROB` → `WYS`, `KOR` → `KOR_WYS`) powiązane z `prepare-email`,
  - automatyczne przejście `WYS`/`KOR_WYS` → `KOR` przy zapisie zmian biznesowych w `PUT /orders/{id}`,
  - ręczne przejścia do `ZRE`, `REK`, `ANL` przez endpoint `/status`,
  - przywracanie z `ZRE` / `ANL` przez `/restore` z regułą 24h dla anulowanych.
- **Punkty trasy**:
  - `kind ∈ {'LOADING','UNLOADING'}`,
  - unikalność `(order_id, sequence_no)`,
  - limity: 8 załadunków, 3 rozładunki.
- **Blokady**:
  - pola `locked_by_user_id`, `locked_at`,
  - wygasanie blokady po ustalonym czasie,
  - próba zapisu przy cudzej blokadzie → `409 Conflict`.
- **Audyt**:
  - `order_status_history` – zmiany statusu,
  - `order_change_log` – zmiany kluczowych pól,
  - odczyt realizowany przez `/history/*`.

---

## 5. Wydajność i bezpieczeństwo

- **Indeksy**: wykorzystywane zgodnie z planem bazy (`transport_orders`, `order_stops`, słowniki).
- **Paginacja**: ograniczone `pageSize`, brak zwracania ogromnych list w jednym wywołaniu.
- **Rate limiting**: ograniczenia szczególnie na logowaniu, generowaniu PDF i synchronizacji słowników.
- **RLS i zasada najmniejszych uprawnień**: główne bezpieczeństwo danych egzekwowane w PostgreSQL.
- **HTTPS**: cały ruch po HTTPS, tokeny przechowywane bezpiecznie (np. HTTP-only cookies).
- **Retencja**:
  - anulowane – widoczne 24h, potem czyszczone/oznaczane,
  - zrealizowane – przechowywane długoterminowo do raportów.
