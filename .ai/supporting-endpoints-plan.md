# API Endpoint Implementation Plan: Supporting Endpoints

Plik obejmuje endpointy pomocnicze:
- Historia zleceń (2 endpointy)
- Słowniki (6 endpointów)
- Synchronizacja słowników z ERP (2 endpointy)
- Generowanie PDF (1 endpoint)
- Przygotowanie wysyłki e-mail (1 endpoint)

---

## 1. Historia zleceń

### 1.1 GET /api/v1/orders/{orderId}/history/status — Historia statusów

#### Przegląd
Zwraca chronologiczną listę zmian statusu zlecenia z tabeli `order_status_history`.

#### Szczegóły żądania
- **Metoda HTTP:** GET
- **URL:** `/api/v1/orders/[orderId]/history/status`
- **Parametry ścieżki:** `orderId` (UUID)

#### Wykorzystywane typy
- **Response:** `ListResponse<StatusHistoryItemDto>`

#### Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "items": [
    {
      "id": 1,
      "oldStatusCode": "ROB",
      "newStatusCode": "WYS",
      "changedAt": "2026-02-08T10:00:00Z",
      "changedByUserId": "uuid",
      "changedByUserName": "Jan Kowalski"
    }
  ]
}
```

#### Przepływ danych
1. Autentykacja (wymagana).
2. Walidacja UUID.
3. Sprawdzenie istnienia zlecenia (opcjonalnie — jeśli brak historii, zwróć pustą listę lub 404).
4. Zapytanie:
   ```typescript
   supabase
     .from('order_status_history')
     .select('id, old_status_code, new_status_code, changed_at, changed_by_user_id, user_profiles!changed_by_user_id(full_name)')
     .eq('order_id', orderId)
     .order('changed_at', { ascending: true });
   ```
5. Mapowanie na `StatusHistoryItemDto[]` (resolve `changedByUserName` z joinu).

#### Etapy wdrożenia
1. **Route** `src/pages/api/v1/orders/[orderId]/history/status.ts` — `export const GET`.
2. **Service** — `getStatusHistory(supabase, orderId)` w `order.service.ts`.
3. **Mapper** — `mapStatusHistoryItem()`.

---

### 1.2 GET /api/v1/orders/{orderId}/history/changes — Log zmian pól

#### Przegląd
Zwraca log zmian kluczowych pól zlecenia z tabeli `order_change_log`.

#### Szczegóły żądania
- **Metoda HTTP:** GET
- **URL:** `/api/v1/orders/[orderId]/history/changes`
- **Parametry ścieżki:** `orderId` (UUID)

#### Wykorzystywane typy
- **Response:** `ListResponse<ChangeLogItemDto>`

#### Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "items": [
    {
      "id": 1,
      "fieldName": "price_amount",
      "oldValue": "1500.00",
      "newValue": "1800.00",
      "changedAt": "2026-02-08T12:00:00Z",
      "changedByUserId": "uuid",
      "changedByUserName": "Anna Nowak"
    }
  ]
}
```

#### Przepływ danych
Analogiczny do historii statusów — zapytanie do `order_change_log` z joinem na `user_profiles`.

#### Etapy wdrożenia
1. **Route** `src/pages/api/v1/orders/[orderId]/history/changes.ts` — `export const GET`.
2. **Service** — `getChangeLog(supabase, orderId)`.
3. **Mapper** — `mapChangeLogItem()`.

#### Wspólne dla obu endpointów historii
- Brak paginacji (typowo kilka/kilkadziesiąt rekordów na zlecenie).
- Brak parametrów query (oprócz `orderId`).
- Obsługa błędów: 401 (brak auth), 404 (zlecenie nie istnieje — opcjonalne).

---

## 2. Słowniki — 6 endpointów GET

Wszystkie endpointy słownikowe mają identyczną strukturę: prosty SELECT z tabeli, zwrócony jako `ListResponse<XxxDto>`.

### 2.1 Wspólny wzorzec

```
GET /api/v1/{resource}
→ Autentykacja (wymagana)
→ SELECT * FROM {table} WHERE is_active = true (opcjonalnie) ORDER BY {default_sort}
→ Mapowanie snake_case → camelCase
→ 200 OK z { items: [...] }
```

### 2.2 Poszczególne endpointy

| # | URL | Tabela | DTO | Sortowanie | Filtr autocomplete |
|---|-----|--------|-----|------------|-------------------|
| 1 | `/api/v1/companies` | `companies` | `CompanyDto` | `name ASC` | `?search=` po `name` (ILIKE) |
| 2 | `/api/v1/locations` | `locations` | `LocationDto` | `name ASC` | `?search=` po `name`, `?companyId=` |
| 3 | `/api/v1/products` | `products` | `ProductDto` | `name ASC` | `?search=` po `name` |
| 4 | `/api/v1/transport-types` | `transport_types` | `TransportTypeDto` | `code ASC` | — |
| 5 | `/api/v1/order-statuses` | `order_statuses` | `OrderStatusDto` | `sort_order ASC` | — |
| 6 | `/api/v1/vehicle-variants` | `vehicle_variants` | `VehicleVariantDto` | `name ASC` | — |

### 2.3 Szczegóły żądania (wspólne)

- **Metoda HTTP:** GET
- **Parametry query (opcjonalne, dla autocomplete):**

  | Parametr | Typ | Opis | Dotyczy |
  |----------|-----|------|---------|
  | `search` | `string` | Wyszukiwanie po nazwie (ILIKE) | companies, locations, products |
  | `companyId` | `uuid` | Filtr lokalizacji po firmie | locations |
  | `activeOnly` | `boolean` | Tylko aktywne (domyślnie `true`) | companies, locations, products, vehicle-variants, transport-types |

### 2.4 Wykorzystywane typy

- `CompanyDto`, `LocationDto`, `ProductDto`, `TransportTypeDto`, `OrderStatusDto`, `VehicleVariantDto`
- `ListResponse<T>`

### 2.5 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "items": [
    { /* XxxDto */ }
  ]
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401` | Brak autentykacji |

### 2.6 Względy bezpieczeństwa

- Odczyt dostępny dla wszystkich zalogowanych.
- Brak RLS ograniczeń na słownikach (publiczne dane wewnętrzne).
- Parametr `search` — sanityzacja znaków specjalnych ILIKE.

### 2.7 Rozważania dotyczące wydajności

- Tabele słownikowe małe (kilkadziesiąt-kilkaset rekordów) — brak potrzeby paginacji.
- Indeksy na `name` w `companies`, `products`, `(company_id, name)` w `locations`.
- Rozważyć cache HTTP (`Cache-Control: max-age=60`) — dane rzadko się zmieniają.

### 2.8 Etapy wdrożenia

1. **Service** — generyczny `listDictionary<T>(supabase, table, options)` w `src/lib/services/dictionary.service.ts` lub osobne metody per słownik.
2. **Routes:**
   ```
   src/pages/api/v1/
   ├── companies.ts          # GET
   ├── locations.ts           # GET
   ├── products.ts            # GET
   ├── transport-types.ts     # GET
   ├── order-statuses.ts      # GET
   └── vehicle-variants.ts    # GET
   ```
3. **Mappery** — jeden per DTO: `mapCompany()`, `mapLocation()`, itd.
4. **Zod schema** — walidacja opcjonalnych query params (search, companyId, activeOnly).
5. Testy: lista bez filtrów, z `search`, z `activeOnly=false`, brak auth → 401.

---

## 3. Synchronizacja słowników z ERP

### 3.1 POST /api/v1/dictionary-sync/run — Uruchomienie synchronizacji

#### Przegląd
Ręczne wywołanie synchronizacji słowników z zewnętrznego systemu ERP. Uruchamia asynchroniczny job.

#### Szczegóły żądania
- **Metoda HTTP:** POST
- **URL:** `/api/v1/dictionary-sync/run`
- **Request Body:** `DictionarySyncCommand`

  | Pole | Typ | Wymagane | Opis |
  |------|-----|----------|------|
  | `resources` | `DictionarySyncResource[]` | Tak | Zasoby do synchronizacji: COMPANIES, LOCATIONS, PRODUCTS |

#### Wykorzystywane typy
- **Command:** `DictionarySyncCommand`
- **Response DTO:** `DictionarySyncResponseDto`

#### Szczegóły odpowiedzi

**Sukces — `202 Accepted`**
```json
{
  "jobId": "uuid",
  "status": "STARTED"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400` | Pusta lista `resources` lub niepoprawne wartości |
| `401` | Brak autentykacji |
| `403` | Rola nie ADMIN |

#### Przepływ danych
1. Autentykacja + rola ADMIN.
2. Walidacja Zod.
3. Utworzenie rekordu job w tabeli (lub w pamięci / Supabase Edge Function).
4. Uruchomienie asynchronicznego procesu synchronizacji (np. Supabase Edge Function, cron, lub bezpośrednie wywołanie API ERP w tle).
5. Zwrócenie `jobId` + status `STARTED`.

#### Uwagi implementacyjne
- **Etap MVP:** Synchronizacja może być synchroniczna (bezpośrednie wywołanie ERP i update) z timeout response. Asynchroniczny model (job queue) — docelowo.
- **Logika sync:** Dla każdego resource (companies/locations/products):
  1. Pobranie danych z ERP (format do ustalenia).
  2. Upsert po `erp_id`: jeśli istnieje → update, jeśli nie → insert.
  3. Rekordy obecne w DB ale nieobecne w ERP → `is_active = false`.
- **Rate limiting:** Maks. 1 sync na minutę (guard w endpoincie).

#### Etapy wdrożenia
1. **Zod schema** `dictionarySyncSchema`.
2. **Service** — `startDictionarySync(supabase, userId, command)` w `src/lib/services/dictionary-sync.service.ts`.
3. **ERP client** — `src/lib/services/erp-client.ts` (stub na MVP, potem implementacja).
4. **Route** `src/pages/api/v1/dictionary-sync/run.ts` — `export const POST`.
5. Testy: sync companies ✓, pusta lista → 400, READ_ONLY → 403.

---

### 3.2 GET /api/v1/dictionary-sync/jobs/{jobId} — Status synchronizacji

#### Przegląd
Sprawdzenie statusu zadania synchronizacji.

#### Szczegóły żądania
- **Metoda HTTP:** GET
- **URL:** `/api/v1/dictionary-sync/jobs/[jobId]`
- **Parametry ścieżki:** `jobId` (UUID)

#### Wykorzystywane typy
- **Response DTO:** `DictionarySyncJobDto`

#### Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "jobId": "uuid",
  "status": "COMPLETED"
}
```

#### Etapy wdrożenia
1. **Route** `src/pages/api/v1/dictionary-sync/jobs/[jobId].ts` — `export const GET`.
2. Na MVP: jeśli sync jest synchroniczny, ten endpoint może zwracać COMPLETED od razu lub nie być implementowany.

---

## 4. POST /api/v1/orders/{orderId}/pdf — Generowanie PDF

### 4.1 Przegląd
Generuje dokument PDF zlecenia transportowego i zwraca go jako dane binarne (`application/pdf`).

### 4.2 Szczegóły żądania
- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/pdf`
- **Parametry ścieżki:** `orderId` (UUID)
- **Request Body (opcjonalne):** `GeneratePdfCommand`

  | Pole | Typ | Wymagane | Domyślnie | Opis |
  |------|-----|----------|-----------|------|
  | `regenerate` | `boolean` | Nie | `false` | Wymuś regenerację |

### 4.3 Wykorzystywane typy
- **Command:** `GeneratePdfCommand`

### 4.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="ZT2026-0001.pdf"`
- Body: dane binarne PDF

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400` | Niepoprawne dane |
| `401` | Brak autentykacji |
| `404` | Zlecenie nie istnieje |

### 4.5 Przepływ danych

1. Autentykacja.
2. Pobranie pełnych danych zlecenia (jak GET /orders/{id} — order + stops + items).
3. Resolve dodatkowych danych: nazwy statusów, typów transportu, pojazdów.
4. **Generowanie PDF:**
   - Opcja A: Biblioteka JS (np. `pdfkit`, `jspdf`, `@react-pdf/renderer`).
   - Opcja B: Szablon HTML → konwersja do PDF (np. `puppeteer`, `playwright`).
   - Opcja C: Zewnętrzna usługa generowania PDF.
   - **Rekomendacja MVP:** `@react-pdf/renderer` — React-based, server-side, brak zależności od przeglądarki.
5. Jeśli `regenerate = false` — sprawdzenie cache (Supabase Storage). Jeśli istnieje → zwróć z cache.
6. Jeśli brak w cache lub `regenerate = true` → generuj nowy, zapisz w Supabase Storage.
7. Zwróć binarne dane PDF.

### 4.6 Rozważania dotyczące wydajności

- Generowanie PDF może trwać 1-3s — rozważyć timeout i progress indicator w UI.
- Cache w Supabase Storage — unikanie wielokrotnej regeneracji tego samego zlecenia.
- Invalidacja cache przy zmianach zlecenia (w PUT/status endpoints — usunięcie starego PDF).

### 4.7 Etapy wdrożenia

1. **Instalacja** biblioteki PDF (np. `npm install @react-pdf/renderer`).
2. **Szablon PDF** — `src/lib/pdf/order-pdf-template.tsx` (React component).
3. **Service** — `generateOrderPdf(supabase, orderId, regenerate)` w `src/lib/services/pdf.service.ts`.
4. **Route** `src/pages/api/v1/orders/[orderId]/pdf.ts` — `export const POST`.
5. **Cache** — helper do zapisu/odczytu z Supabase Storage (bucket `order-pdfs`).
6. Testy: generowanie PDF → 200 + content-type, zlecenie nie istnieje → 404.

---

## 5. POST /api/v1/orders/{orderId}/prepare-email — Przygotowanie wysyłki

### 5.1 Przegląd

Kluczowy endpoint dla workflow: sprawdza kompletność danych wymaganych do wysyłki zlecenia, generuje/odświeża PDF i zwraca dane potrzebne do otwarcia klienta email (Outlook) z załącznikiem. Automatycznie zmienia status: `ROB`/`KOR` → `WYS`/`KOR_WYS`.

### 5.2 Szczegóły żądania
- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/prepare-email`
- **Parametry ścieżki:** `orderId` (UUID)
- **Request Body:** `PrepareEmailCommand`

  | Pole | Typ | Wymagane | Domyślnie | Opis |
  |------|-----|----------|-----------|------|
  | `forceRegeneratePdf` | `boolean` | Nie | `false` | Wymuś regenerację PDF |

### 5.3 Wykorzystywane typy
- **Command:** `PrepareEmailCommand`
- **Response DTO:** `PrepareEmailResponseDto`

### 5.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "orderId": "uuid",
  "statusBefore": "ROB",
  "statusAfter": "WYS",
  "emailOpenUrl": "mailto:carrier@example.com?subject=...",
  "pdfFileName": "ZT2026-0001.pdf"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401` | Brak autentykacji |
| `403` | READ_ONLY |
| `404` | Zlecenie nie istnieje |
| `422 Unprocessable Entity` | Dane niekompletne do wysyłki (lista braków) |

### 5.5 Przepływ danych

1. Autentykacja + rola ADMIN/PLANNER.
2. Pobranie pełnych danych zlecenia (header + stops + items).
3. **Walidacja biznesowa — kompletność do wysyłki:**
   - `transportTypeCode` — wymagany (powinien być, ale sprawdzić).
   - `carrierCompanyId` — wymagany (przewoźnik musi być ustawiony).
   - `shipperLocationId` — wymagany (nadawca).
   - `receiverLocationId` — wymagany (odbiorca).
   - `items` — min. 1 pozycja z `productNameSnapshot` i `quantityTons`.
   - `stops` — min. 1 LOADING i min. 1 UNLOADING z `dateLocal` i `timeLocal`.
   - `priceAmount` — wymagane (cena przed wysyłką).
   - `vehicleVariantCode` — wymagany.
   - `paymentTermDays`, `paymentMethod` — **opcjonalne** (nie blokują wysyłki).
   - Każdy brak → dodać do listy `validationErrors`.
4. Jeśli lista braków niepusta → `422` z:
   ```json
   {
     "error": {
       "code": "VALIDATION_FAILED",
       "message": "Dane niekompletne do wysyłki zlecenia",
       "details": [
         { "field": "carrierCompanyId", "message": "Przewoźnik jest wymagany" },
         { "field": "stops", "message": "Wymagany min. 1 punkt załadunku z datą i godziną" }
       ]
     }
   }
   ```
5. **Zmiana statusu:**
   - Jeśli bieżący status = `ROB` → nowy status = `WYS`.
   - Jeśli bieżący status = `KOR` → nowy status = `KOR_WYS`.
   - Jeśli bieżący status ∈ {WYS, KOR_WYS} → bez zmiany (ponowna wysyłka).
   - Inne statusy (ZRE, ANL) → `403`.
6. UPDATE `transport_orders`: `status_code`, `updated_at`, `updated_by_user_id`.
7. INSERT `order_status_history` (jeśli status się zmienił).
8. **Generowanie/odświeżanie PDF** (re-use logiki z `/pdf`).
9. **Budowa emailOpenUrl:**
   - `mailto:` link z:
     - `to` = email kontaktowy przewoźnika (z `carrier_company`/`contact`).
     - `subject` = np. `Zlecenie transportowe {orderNo}`.
     - `body` = krótki opis.
   - Alternatywnie: URL do Supabase Storage z PDF do pobrania.
10. Zwrócenie `PrepareEmailResponseDto`.

### 5.6 Względy bezpieczeństwa

- Autoryzacja: ADMIN/PLANNER.
- Walidacja biznesowa — kluczowa: wysyłka niepełnego zlecenia mogłaby powodować problemy operacyjne.
- PDF generowany server-side — brak ryzyka XSS.

### 5.7 Obsługa błędów

| Scenariusz | Kod |
|------------|-----|
| Brak autentykacji | 401 |
| READ_ONLY | 403 |
| Status nie pozwala na wysyłkę (ZRE, ANL) | 403 |
| Zlecenie nie istnieje | 404 |
| Dane niekompletne | 422 (lista braków) |
| Błąd generowania PDF | 500 |

### 5.8 Rozważania dotyczące wydajności

- Walidacja + zmiana statusu — szybkie.
- Generowanie PDF — może trwać 1-3s (dominuje czas odpowiedzi).
- Rozważyć: walidację oddzielnie od generowania PDF (dwa kroki w UI).

### 5.9 Etapy wdrożenia

1. **Zod schema** `prepareEmailSchema`.
2. **Service** — `prepareOrderEmail(supabase, userId, orderId, command)` w `src/lib/services/email.service.ts`.
3. **Walidator biznesowy** — `validateOrderForSending(order, stops, items): ValidationError[]` w `src/lib/validators/order-send-validator.ts`.
4. **Route** `src/pages/api/v1/orders/[orderId]/prepare-email.ts` — `export const POST`.
5. Re-use `generateOrderPdf()` z PDF service.
6. **Helper** `buildEmailOpenUrl(order, pdfUrl)`.
7. Testy: zlecenie kompletne → 200 + WYS, zlecenie niekompletne → 422 z listą, ponowna wysyłka (WYS→WYS) → 200.

---

## Podsumowanie struktury plików

```
src/
├── lib/
│   ├── schemas/
│   │   ├── order-list.schema.ts
│   │   ├── create-order.schema.ts
│   │   ├── update-order.schema.ts
│   │   ├── change-status.schema.ts
│   │   ├── restore-order.schema.ts
│   │   ├── duplicate-order.schema.ts
│   │   ├── patch-stop.schema.ts
│   │   ├── prepare-email.schema.ts
│   │   └── dictionary-sync.schema.ts
│   ├── services/
│   │   ├── order.service.ts           # CRUD + akcje na zleceniach
│   │   ├── dictionary.service.ts      # Słowniki GET
│   │   ├── dictionary-sync.service.ts # Sync z ERP
│   │   ├── pdf.service.ts             # Generowanie PDF
│   │   └── email.service.ts           # Przygotowanie wysyłki
│   ├── validators/
│   │   └── order-send-validator.ts    # Walidacja kompletności do wysyłki
│   ├── helpers/
│   │   ├── resolve-snapshots.ts
│   │   ├── order-no-generator.ts
│   │   └── map-order.ts
│   ├── pdf/
│   │   └── order-pdf-template.tsx     # Szablon PDF
│   ├── config.ts                      # Stałe (LOCK_TIMEOUT, STATUS_TRANSITIONS)
│   └── utils/
│       ├── api-response.ts            # jsonResponse(), errorResponse()
│       └── auth-guard.ts              # requireAuth(), requireRole()
├── pages/
│   └── api/
│       └── v1/
│           ├── auth/
│           │   └── me.ts
│           ├── orders/
│           │   ├── index.ts                  # GET (list) + POST (create)
│           │   └── [orderId]/
│           │       ├── index.ts              # GET (detail) + PUT (update) + DELETE (cancel)
│           │       ├── status.ts             # POST
│           │       ├── restore.ts            # POST
│           │       ├── lock.ts               # POST
│           │       ├── unlock.ts             # POST
│           │       ├── duplicate.ts          # POST
│           │       ├── pdf.ts                # POST
│           │       ├── prepare-email.ts      # POST
│           │       ├── history/
│           │       │   ├── status.ts         # GET
│           │       │   └── changes.ts        # GET
│           │       └── stops/
│           │           └── [stopId].ts       # PATCH
│           ├── companies.ts
│           ├── locations.ts
│           ├── products.ts
│           ├── transport-types.ts
│           ├── order-statuses.ts
│           ├── vehicle-variants.ts
│           └── dictionary-sync/
│               ├── run.ts                    # POST
│               └── jobs/
│                   └── [jobId].ts            # GET
```

## Priorytet implementacji (rekomendacja)

| Faza | Endpointy | Uzasadnienie |
|------|-----------|-------------|
| **1** | Konfiguracja Astro (output: server, adapter node), middleware auth, utils (api-response, auth-guard) | Fundament — wymagane przez wszystkie endpointy |
| **2** | 6× GET słowników + GET /auth/me | Najprostsze, pozwalają zweryfikować stack |
| **3** | GET /orders (lista) + GET /orders/{id} (szczegóły) | Odczyty — podstawa widoku planistycznego |
| **4** | POST /orders (tworzenie) + PUT /orders/{id} (update) | Zapis — wymaga snapshotów, order_no, change detection |
| **5** | POST /status + DELETE + POST /restore + POST /lock + POST /unlock | Akcje statusowe i blokady |
| **6** | POST /duplicate + PATCH /stops/{id} | Uzupełniające |
| **7** | POST /pdf + POST /prepare-email | Generowanie PDF, walidacja biznesowa, email |
| **8** | POST /dictionary-sync/run + GET /jobs/{id} | Integracja z ERP (wymaga API ERP) |
| **9** | GET /history/status + GET /history/changes | Audyt — niska priorytetowość funkcjonalna |
