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

**Uwaga o statusach zleceń:** W systemie używane są pełne nazwy statusów (bez skrótów): robocze, wysłane, korekta, korekta wysłane, zrealizowane, reklamacja, anulowane. W odpowiedziach API pole `statusName` zwraca pełną nazwę (do prezentacji w UI); pole `statusCode` może zawierać kod techniczny (np. w bazie) i jest mapowany na pełną nazwę. Reguły przejść statusów są egzekwowane po stronie serwera — nie ma możliwości obejścia ich przez API.

**Uwaga o formatach dat:** API **zawsze** używa formatu ISO 8601 (`YYYY-MM-DD`) dla dat i (`HH:MM:SS`) dla godzin (bez stref czasowych, dane lokalne). Frontend odpowiada za formatowanie dat do polskiego formatu wizualnego (`DD.MM.YYYY`) przy wyświetlaniu w UI. Backend nigdy nie zwraca ani nie przyjmuje dat w formacie DD.MM.YYYY.

**Uwaga o polu weekNumber:** Pole `weekNumber` jest **obliczane automatycznie** przez trigger w bazie danych na podstawie `firstLoadingDate`. API zwraca to pole w odpowiedziach GET, ale **nie przyjmuje go w żądaniach PUT/POST** — wszelkie próby ustawienia `weekNumber` w żądaniu będą zignorowane. Filtrowanie po numerze tygodnia odbywa się po stronie frontendu poprzez mapowanie numeru tygodnia na zakres dat (`dateFrom`/`dateTo`).

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
  - **Mapowanie widoków** (parametr `view` / `order_statuses.view_group`): **CURRENT** (aktualne) = robocze, wysłane, korekta, korekta wysłane, reklamacja; **COMPLETED** (zrealizowane) = zrealizowane; **CANCELLED** (anulowane) = anulowane. Zlecenia zrealizowane i anulowane nie występują w widoku CURRENT.
  - **Parametry zapytania**:
    - `view` (opcjonalny): `CURRENT | COMPLETED | CANCELLED` (domyślnie `CURRENT`)
    - `status` (opcjonalny, wielokrotny): filtry po statusie (kody techniczne zgodne z `order_statuses.code`); API przyjmuje tablicę, UI w MVP wysyła co najwyżej jeden
    - `transportType` (opcjonalny): kod typu transportu (`transport_types.code`)
    - `carrierId` (opcjonalny, UUID): filtr po przewoźniku (`carrier_company_id`)
    - `productId` (opcjonalny, UUID): filtr po towarze (zlecenia posiadające pozycję z danym `product_id`)
    - `loadingLocationId` (opcjonalny, UUID): filtr po lokalizacji załadunku — zwraca zlecenia, gdzie podana lokalizacja występuje w **dowolnym** punkcie załadunku (L1…L8)
    - `loadingCompanyId` (opcjonalny, UUID): filtr po firmie załadunku — zwraca zlecenia, gdzie **dowolna** lokalizacja danej firmy występuje w punkcie załadunku; stosowany gdy użytkownik wybierze firmę zamiast konkretnej lokalizacji
    - `unloadingLocationId` (opcjonalny, UUID): analogicznie dla rozładunku (U1…U3)
    - `unloadingCompanyId` (opcjonalny, UUID): filtr po firmie rozładunku
    - `search` (opcjonalny, string): wyszukiwanie po `search_text`
    - `dateFrom` / `dateTo` (opcjonalne, ISO date): zakres dat pierwszego załadunku (`first_loading_date`); używane wewnętrznie przez filtr tygodniowy (weekNumber → dateFrom/dateTo)
    - `sortBy` (opcjonalny): `FIRST_LOADING_DATETIME | FIRST_UNLOADING_DATETIME | ORDER_NO | CARRIER_NAME`
    - `sortDirection` (opcjonalny): `ASC | DESC`
    - `page` (opcjonalny): numer strony (domyślnie `1`)
    - `pageSize` (opcjonalny): rozmiar strony (domyślnie `50`, maks. `200`)
  - **Uwaga o filtrze „numer tygodnia"**: Filtr numeru tygodnia z UI (np. „07" lub „2026-07") jest mapowany na zakres dat `dateFrom`/`dateTo` **po stronie frontendu** (ISO week → poniedziałek–niedziela). API nie posiada dedykowanego parametru `weekNumber`.
  - **Struktura odpowiedzi**:
    ```json
    {
      "items": [
        {
          "id": "uuid",
          "orderNo": "string",
          "statusCode": "string (kod techniczny = pełna nazwa małymi literami)",
          "statusName": "string (pełna nazwa z wielką literą: Robocze | Wysłane | Korekta | Korekta wysłane | Zrealizowane | Reklamacja | Anulowane)",
          "viewGroup": "CURRENT | COMPLETED | CANCELLED",
          "transportTypeCode": "PL | EXP | EXP_K | IMP",
          "transportTypeName": "string",
          "summaryRoute": "string (skrótowy opis trasy, np. PL: Kęty → DE: Hamburg)",
          "stops": [
            {
              "kind": "LOADING | UNLOADING",
              "sequenceNo": 1,
              "companyNameSnapshot": "string | null",
              "locationNameSnapshot": "string | null",
              "dateLocal": "YYYY-MM-DD | null",
              "timeLocal": "HH:MM:SS | null"
            }
          ],
          "firstLoadingDate": "YYYY-MM-DD | null",
          "firstLoadingTime": "HH:MM:SS | null",
          "firstUnloadingDate": "YYYY-MM-DD | null",
          "firstUnloadingTime": "HH:MM:SS | null",
          "lastLoadingDate": "YYYY-MM-DD | null",
          "lastLoadingTime": "HH:MM:SS | null",
          "lastUnloadingDate": "YYYY-MM-DD | null",
          "lastUnloadingTime": "HH:MM:SS | null",
          "weekNumber": "integer | null (numer tygodnia ISO 8601 wyliczony automatycznie z firstLoadingDate)",
          "carrierCompanyId": "uuid | null",
          "carrierName": "string | null",
          "mainProductName": "string | null",
          "items": [
            {
              "productNameSnapshot": "string | null",
              "quantityTons": "number | null",
              "loadingMethodCode": "string | null",
              "notes": "string | null"
            }
          ],
          "priceAmount": "number | null",
          "currencyCode": "PLN | EUR | USD",
          "vehicleTypeText": "string | null",
          "vehicleCapacityVolumeM3": "number | null",
          "requiredDocumentsText": "string | null",
          "generalNotes": "string | null",
          "sentByUserName": "string | null",
          "sentAt": "timestamp | null",
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
  - **Uwaga o wydajności**: Tablice `stops` i `items` w odpowiedzi listy są **uproszczone** (brak `id`, `locationId`, `productId`, `addressSnapshot`). Zawierają tylko dane potrzebne do renderowania tabeli. Pełne dane dostępne przez `GET /orders/{id}`.
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
        "statusCode": "string (kod techniczny)",
        "statusName": "string (pełna nazwa statusu)",
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
        "lastLoadingDate": "YYYY-MM-DD | null",
        "lastLoadingTime": "HH:MM:SS | null",
        "lastUnloadingDate": "YYYY-MM-DD | null",
        "lastUnloadingTime": "HH:MM:SS | null",
        "weekNumber": "integer | null (numer tygodnia ISO 8601 wyliczony automatycznie z firstLoadingDate)",
        "transportYear": 2026,
        "firstLoadingCountry": "string | null",
        "firstUnloadingCountry": "string | null",
        "carrierCompanyId": "uuid | null",
        "carrierNameSnapshot": "string | null",
        "carrierLocationNameSnapshot": "string | null",
        "carrierAddressSnapshot": "string | null",
        "shipperLocationId": "uuid | null",
        "shipperNameSnapshot": "string | null",
        "shipperAddressSnapshot": "string | null",
        "receiverLocationId": "uuid | null",
        "receiverNameSnapshot": "string | null",
        "receiverAddressSnapshot": "string | null",
        "vehicleTypeText": "string | null",
        "vehicleCapacityVolumeM3": "number | null",
        "specialRequirements": "string | null",
        "requiredDocumentsText": "string | null",
        "generalNotes": "string | null",
        "notificationDetails": "string | null",
        "complaintReason": "string | null",
        "confidentialityClause": "string | null",
        "senderContactName": "string | null",
        "senderContactPhone": "string | null",
        "senderContactEmail": "string | null",
        "sentByUserId": "uuid | null",
        "sentByUserName": "string | null",
        "sentAt": "timestamp | null",
        "createdAt": "timestamp",
        "createdByUserId": "uuid",
        "createdByUserName": "string | null",
        "updatedAt": "timestamp",
        "updatedByUserId": "uuid | null",
        "updatedByUserName": "string | null",
        "lockedByUserId": "uuid | null",
        "lockedByUserName": "string | null",
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
          "loadingMethodCode": "string | null",
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
  - **Opis**: Tworzy nowe zlecenie w statusie **robocze**. Zlecenie może być niekompletne – pełna walidacja biznesowa następuje dopiero przy próbie wysyłki maila.
  - **Body żądania** (nagłówek + prosty agregat):
    ```json
    {
      "transportTypeCode": "PL | EXP | EXP_K | IMP",
      "currencyCode": "PLN | EUR | USD",
      "carrierCompanyId": "uuid | null",
      "shipperLocationId": "uuid | null",
      "receiverLocationId": "uuid | null",
      "vehicleTypeText": "string | null",
      "vehicleCapacityVolumeM3": "number | null",
      "priceAmount": "number | null",
      "paymentTermDays": "number | null",
      "paymentMethod": "string | null",
      "totalLoadTons": "number | null",
      "totalLoadVolumeM3": "number | null",
      "specialRequirements": "string | null",
      "requiredDocumentsText": "string | null",
      "generalNotes": "string | null",
      "notificationDetails": "string | null",
      "confidentialityClause": "string | null",
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
          "loadingMethodCode": "string | null",
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
      "statusCode": "string",
      "statusName": "robocze",
      "createdAt": "timestamp"
    }
    ```
  - **Walidacja techniczna**:
    - `transportTypeCode`, `currencyCode` – wymagane. `vehicleTypeText`, `vehicleCapacityVolumeM3` – opcjonalne.
    - `currencyCode ∈ {PLN, EUR, USD}`.
    - `quantityTons` `NULL` lub `>= 0`.
    - Pole `weekNumber` **nie jest przyjmowane** — jest obliczane automatycznie przez trigger bazodanowy po zapisie na podstawie `firstLoadingDate`.
    - Status ustawiany po stronie serwera na robocze.
    - `orderNo` generowany na serwerze, później niezmienny.
  - **Sukces**: `201 Created`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`, `409 Conflict`

---

### 2.5 Zlecenia – pełna aktualizacja

- **PUT** `/api/v1/orders/{orderId}`
  - **Opis**: Zapis zmian z formularza szczegółowego (nagłówek, punkty, pozycje). Dopuszcza wersje robocze niekompletne. **Status zlecenia nie jest modyfikowany przez ten endpoint.** Automatyczne przejście wysłane / korekta wysłane → korekta następuje po stronie serwera, gdy wykryje zmianę pól biznesowych w zleceniu wysłanym. Ręczne zmiany statusów realizowane są wyłącznie przez `/status`, `/restore` i `/prepare-email`.
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
      "vehicleTypeText": "string | null",
      "vehicleCapacityVolumeM3": "number | null",
      "specialRequirements": "string | null",
      "requiredDocumentsText": "string | null",
      "generalNotes": "string | null",
      "notificationDetails": "string | null",
      "complaintReason": "string | null",
      "confidentialityClause": "string | null",
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
          "loadingMethodCode": "string | null",
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
    - Pole `weekNumber` **nie jest przyjmowane** w żądaniu PUT — jest obliczane automatycznie przez trigger bazodanowy i ignorowane, jeśli zostanie przesłane. Frontend nie powinien wysyłać tego pola.
    - Jeśli zlecenie ma status wysłane lub korekta wysłane i zapis zmienia pola biznesowe, serwer automatycznie ustawia status na korekta.
    - Statusy zrealizowane i anulowane – triggery blokują modyfikację pól biznesowych poza dozwolonymi przypadkami (przywrócenie ustawia status na korekta). Nie ma możliwości obejścia reguł przez API.
    - `_deleted = true` → usunięcie wiersza; `id = null` → tworzenie nowego.
    - Limity: maks. 8 punktów `LOADING` i 3 `UNLOADING`.
  - **Sukces**: `200 OK`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict`

---

### 2.6 Zlecenia – anulowanie

- **DELETE** `/api/v1/orders/{orderId}`
  - **Opis**: Ustawia status anulowane. Zlecenie znika z głównego widoku i jest widoczne tylko w zakładce anulowane. **Fizyczne usunięcie z bazy** następuje po 24 godzinach (job w tle); zlecenia nieprzywrócone w ciągu 24 h są usuwane i nie są wykorzystywane w raportach. Działanie jest aliasem `POST /orders/{orderId}/status` z nowym statusem anulowane – DELETE służy jako szybka akcja z widoku listy.
  - **Parametry ścieżki**: `orderId` (UUID)
  - **Body odpowiedzi**:
    ```json
    { "id": "uuid", "statusCode": "anulowane" }
    ```
  - **Reguły**:
    - Dozwolone tylko gdy aktualny status to robocze, wysłane, korekta, korekta wysłane lub reklamacja (nie z zrealizowane). Dostępne dla `ADMIN` i `PLANNER`.
  - **Sukces**: `200 OK`
  - **Błędy**: `400 Bad Request` (niedozwolone przejście), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

---

### 2.7 Zlecenia – zmiana statusu i przywracanie

- **POST** `/api/v1/orders/{orderId}/status`
  - **Opis**: Ręczna zmiana statusu. Serwer **weryfikuje dozwolone przejścia**; niedozwolone przejście zwraca `400` lub `422`.
  - **Body żądania**:
    ```json
    {
      "newStatusCode": "zrealizowane | reklamacja | anulowane",
      "complaintReason": "string | null"
    }
    ```
  - **Dozwolone przejścia** (tylko te są akceptowane; brak obejścia w API):
    - **zrealizowane** — tylko z: robocze, wysłane, korekta, korekta wysłane, reklamacja; nie z anulowane.
    - **reklamacja** — tylko z: wysłane, korekta, korekta wysłane; przy tym przejściu pole `complaintReason` jest **wymagane** (niepuste), inaczej `422`.
    - **anulowane** — tylko z: robocze, wysłane, korekta, korekta wysłane, reklamacja; **nie** z zrealizowane (z zrealizowane należy najpierw wywołać `/restore`, potem zmienić status na anulowane).
  - **Reguły**: Statusy wysłane i korekta wysłane ustawiane wyłącznie automatycznie (prepare-email). Zmiany logowane w `order_status_history` i `order_change_log`.
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "oldStatusCode": "string",
      "newStatusCode": "string"
    }
    ```
  - **Błędy**: `400` / `422` przy niedozwolonym przejściu lub braku `complaintReason` przy reklamacja.

- **POST** `/api/v1/orders/{orderId}/restore`
  - **Opis**: Przywraca zlecenie z zakładki „Zrealizowane" lub „Anulowane" do widoku „Aktualne". Serwer **zawsze ustawia status na korekta** (nie przywraca do robocze ani wysłane).
  - **Body żądania**: brak (opcjonalnie puste `{}`) — wynik przywrócenia jest zawsze status korekta.
  - **Reguły**:
    - Z **zrealizowane** — przywrócenie dozwolone **bez limitu czasowego**; status → korekta.
    - Z **anulowane** — przywrócenie dozwolone **tylko w ciągu 24 h** od anulowania; po 24 h zlecenie może być już usunięte z bazy → `400` lub `410 Gone`.
  - **Błędy**: `400` / `410` gdy zlecenie anulowane i minęło ≥ 24 h.

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
    { "id": "uuid", "orderNo": "string", "statusCode": "string", "statusName": "robocze" }
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

### 2.10a Zlecenia – kolor komórki przewoźnika

- **PATCH** `/api/v1/orders/{orderId}/carrier-color`
  - **Opis**: Ustawia kolor tła komórki przewoźnika w widoku listy. Używany do wizualnego oznaczania zleceń.
  - **Body żądania**:
    ```json
    {
      "color": "#48A111 | #25671E | #FFEF5F | #EEA727 | null"
    }
    ```
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "carrierCellColor": "string | null"
    }
    ```
  - **Sukces**: `200 OK`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

---

### 2.10b Zlecenia – oznaczenie Fix (is_entry_fixed)

- **PATCH** `/api/v1/orders/{orderId}/entry-fixed`
  - **Opis**: Ustawia flagę "Fix" (zafiksowany wjazd) na zleceniu. Czysto informacyjna flaga dla planistów. Zmiana logowana w `order_change_log`.
  - **Body żądania**:
    ```json
    {
      "isEntryFixed": "boolean | null"
    }
    ```
  - **Body odpowiedzi**:
    ```json
    {
      "id": "uuid",
      "isEntryFixed": "boolean | null"
    }
    ```
  - **Sukces**: `200 OK`
  - **Błędy**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (READ_ONLY), `404 Not Found`

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

**Struktura `VehicleVariantDto`** (zwracana przez `/vehicle-variants`):
```json
{
  "code": "FIRANKA_90M3",
  "name": "firanka 90m³",
  "vehicleType": "FIRANKA",
  "capacityTons": 24.0,
  "capacityVolumeM3": 90.0,
  "description": "string | null",
  "isActive": true
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
  - **Opis**: Sprawdza kompletność danych wymaganych do wysyłki zlecenia, generuje/odświeża PDF i zwraca dane potrzebne do otwarcia Outlooka. Ustawia status **wysłane** (gdy poprzedni status to robocze) lub **korekta wysłane** (gdy poprzedni status to korekta).
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
  - **Efekty uboczne (przy sukcesie)**:
    - Ustawienie `sent_by_user_id` na bieżącego użytkownika i `sent_at` na `now()` (nadpisywane przy każdej wysyłce, w tym ponownej).
    - Zmiana statusu: robocze → wysłane, korekta → korekta wysłane.
    - Aktualizacja `main_product_name` (jeśli jeszcze puste).
  - **Sukces (przykład)**:
    ```json
    {
      "orderId": "uuid",
      "statusBefore": "robocze | korekta",
      "statusAfter": "wysłane | korekta wysłane",
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
- **Cykl życia statusów** (pełne nazwy: robocze, wysłane, korekta, korekta wysłane, zrealizowane, reklamacja, anulowane; reguły egzekwowane w API, brak obejścia):
  - automatyczne przejścia: robocze → wysłane oraz korekta → korekta wysłane (tylko przez `prepare-email`),
  - automatyczne przejście wysłane / korekta wysłane → korekta przy zapisie zmian biznesowych w `PUT /orders/{id}`; przywrócenie z zrealizowane lub anulowane → korekta (endpoint `/restore`),
  - ręczne przejścia przez `/status`: zrealizowane (z robocze, wysłane, korekta, korekta wysłane, reklamacja), reklamacja (z wysłane, korekta, korekta wysłane; wymagane `complaintReason`), anulowane (z robocze, wysłane, korekta, korekta wysłane, reklamacja; nie z zrealizowane),
  - przywracanie przez `/restore`: zawsze ustawia status korekta; z anulowane dozwolone tylko w ciągu 24 h; z zrealizowane bez limitu; po 24 h zlecenia anulowane są fizycznie usuwane z bazy (job w tle).
- **Punkty trasy**:
  - `kind ∈ {'LOADING','UNLOADING'}`,
  - unikalność `(order_id, sequence_no)`,
  - limity: 8 załadunków, 3 rozładunki.
- **Blokady**:
  - pola `locked_by_user_id`, `locked_at`,
  - wygasanie blokady po ustalonym czasie,
  - próba zapisu przy cudzej blokadzie → `409 Conflict`.
- **Audyt**:
  - `order_status_history` – zmiany statusu (tworzony przy: changeStatus, cancelOrder, restoreOrder, prepareEmail, auto-korekta w patchStop),
  - `order_change_log` – zmiany kluczowych pól. Polityka logowania: każda zmiana statusu (field_name=`status_code`), zmiany pól stopu w patchStop (field_name=`stop.{column}`). Logowanie realizowane we wszystkich operacjach zmieniających status: changeStatus, cancelOrder, restoreOrder, prepareEmail.
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
