# API Endpoint Implementation Plan: Order Actions

Plik obejmuje 6 endpointów akcji na zleceniach:
- `POST /api/v1/orders/{orderId}/status` — ręczna zmiana statusu
- `POST /api/v1/orders/{orderId}/restore` — przywracanie zlecenia
- `POST /api/v1/orders/{orderId}/lock` — blokada edycji
- `POST /api/v1/orders/{orderId}/unlock` — zwolnienie blokady
- `POST /api/v1/orders/{orderId}/duplicate` — kopiowanie zlecenia
- `PATCH /api/v1/orders/{orderId}/stops/{stopId}` — częściowa edycja punktu trasy

---

## 1. POST /api/v1/orders/{orderId}/status — Zmiana statusu

### 1.1 Przegląd

Ręczna zmiana statusu zlecenia. Dozwolone ręczne przejścia to: `ROB`, `ZRE` (zrealizowane), `REK` (reklamacja), `ANL` (anulowane). Statusy `WYS`, `KOR`, `KOR_WYS` ustawiane są wyłącznie automatycznie przez endpoint `prepare-email`.

### 1.2 Szczegóły żądania

- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/status`
- **Parametry ścieżki:** `orderId` (UUID)
- **Request Body:** `ChangeStatusCommand`

  | Pole | Typ | Wymagane | Opis |
  |------|-----|----------|------|
  | `newStatusCode` | `"ROB" \| "ZRE" \| "REK" \| "ANL"` | Tak | Docelowy status |
  | `complaintReason` | `string \| null` | Warunkowo | Wymagane gdy `newStatusCode = "REK"` |

### 1.3 Wykorzystywane typy

- **Command:** `ChangeStatusCommand`
- **Response DTO:** `ChangeStatusResponseDto`

### 1.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "id": "uuid",
  "oldStatusCode": "WYS",
  "newStatusCode": "ZRE"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400 Bad Request` | Niepoprawne dane (np. brak `complaintReason` przy REK) |
| `401 Unauthorized` | Brak autentykacji |
| `403 Forbidden` | Brak uprawnień lub niedozwolone przejście statusu |
| `404 Not Found` | Zlecenie nie istnieje |
| `409 Conflict` | Przejście niedozwolone ze względu na bieżący status |

### 1.5 Przepływ danych

1. Autentykacja + rola ADMIN/PLANNER.
2. Walidacja Zod: `newStatusCode` ∈ {ROB, ZRE, REK, ANL}, `complaintReason` wymagane przy REK.
3. Pobranie zlecenia i bieżącego statusu.
4. **Walidacja przejścia statusu** — dozwolona mapa:
   - `ROB` → `ZRE`, `ANL`, `REK`
   - `WYS` → `ZRE`, `ANL`, `REK`
   - `KOR` → `ZRE`, `ANL`, `REK`
   - `KOR_WYS` → `ZRE`, `ANL`, `REK`
   - `REK` → `ROB`, `ZRE`, `ANL`
   - Inne przejścia → `409 Conflict`
5. UPDATE `transport_orders`: `status_code`, `complaint_reason` (jeśli REK), `updated_at`, `updated_by_user_id`.
6. INSERT `order_status_history`: `old_status_code`, `new_status_code`, `changed_by_user_id`.
7. INSERT `order_change_log` dla pola `status_code`.
8. Zwrócenie `ChangeStatusResponseDto`.

### 1.6 Względy bezpieczeństwa

- Mapa dozwolonych przejść chroniona server-side (nie polegać na froncie).
- Statusy WYS/KOR/KOR_WYS nie mogą być ustawione ręcznie — tylko przez `prepare-email`.
- Trigger DB jako druga linia obrony.

### 1.7 Etapy wdrożenia

1. **Zod schema** `changeStatusSchema` → `src/lib/schemas/change-status.schema.ts`.
2. **Service** — `changeOrderStatus(supabase, userId, orderId, command)` w `order.service.ts`.
3. **Mapa przejść** — stała `ALLOWED_STATUS_TRANSITIONS: Record<string, string[]>`.
4. **Route** `src/pages/api/v1/orders/[orderId]/status.ts` — `export const POST`.
5. Testy: ROB→ZRE ✓, ROB→WYS ✗ (409), REK bez reason → 400.

---

## 2. POST /api/v1/orders/{orderId}/restore — Przywracanie

### 2.1 Przegląd

Przywraca zlecenie z zakładek „Zrealizowane" lub „Anulowane" do „Aktualnych". Dla `ANL` — tylko jeśli minęło < 24h od anulowania.

### 2.2 Szczegóły żądania

- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/restore`
- **Request Body:** `RestoreOrderCommand`

  | Pole | Typ | Wymagane | Opis |
  |------|-----|----------|------|
  | `targetStatusCode` | `"ROB" \| "WYS"` | Tak | Status docelowy |

### 2.3 Wykorzystywane typy

- **Command:** `RestoreOrderCommand`
- **Response DTO:** `ChangeStatusResponseDto` (ta sama struktura)

### 2.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "id": "uuid",
  "oldStatusCode": "ANL",
  "newStatusCode": "ROB"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400` | Niepoprawny `targetStatusCode` |
| `401` | Brak autentykacji |
| `403` | Brak uprawnień |
| `404` | Zlecenie nie istnieje |
| `409` | Status nie pozwala na przywrócenie (np. ROB → restore) lub ANL > 24h |

### 2.5 Przepływ danych

1. Autentykacja + rola ADMIN/PLANNER.
2. Walidacja Zod.
3. Pobranie zlecenia.
4. **Walidacja:**
   - Bieżący status ∈ {ZRE, ANL} — inaczej → 409.
   - Jeśli ANL: sprawdzić `updated_at` — czy od anulowania minęło < 24h. Jeśli nie → 409 „Okres przywrócenia wygasł".
5. UPDATE `status_code = targetStatusCode`, wyczyszczenie `complaint_reason` (jeśli było).
6. INSERT `order_status_history` i `order_change_log`.
7. Zwrócenie odpowiedzi.

### 2.6 Etapy wdrożenia

1. **Zod schema** `restoreOrderSchema`.
2. **Service** — `restoreOrder(supabase, userId, orderId, command)`.
3. **Route** `src/pages/api/v1/orders/[orderId]/restore.ts` — `export const POST`.
4. Testy: restore ZRE→ROB ✓, ANL→ROB <24h ✓, ANL→ROB >24h → 409, ROB→restore → 409.

---

## 3. POST /api/v1/orders/{orderId}/lock — Blokada edycji

### 3.1 Przegląd

Ustawia blokadę edycji zlecenia dla bieżącego użytkownika. Zapobiega równoczesnej edycji przez wielu planistów.

### 3.2 Szczegóły żądania

- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/lock`
- **Request Body:** brak

### 3.3 Wykorzystywane typy

- **Response DTO:** `LockOrderResponseDto`

### 3.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "id": "uuid",
  "lockedByUserId": "uuid",
  "lockedAt": "2026-02-08T14:30:00Z"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401` | Brak autentykacji |
| `403` | READ_ONLY |
| `404` | Zlecenie nie istnieje |
| `409` | Zlecenie już zablokowane przez innego użytkownika (i blokada nie wygasła) |

### 3.5 Przepływ danych

1. Autentykacja + rola ADMIN/PLANNER.
2. Pobranie zlecenia.
3. **Sprawdzenie blokady:**
   - Jeśli `locked_by_user_id = current_user` → odśwież `locked_at`, zwróć 200 (idempotentność).
   - Jeśli `locked_by_user_id ≠ null` i ≠ current_user:
     - Sprawdź wygaśnięcie (np. `locked_at + LOCK_TIMEOUT > now()`).
     - Jeśli nie wygasła → 409 Conflict z informacją kto blokuje.
     - Jeśli wygasła → przejęcie blokady (nadpisanie).
   - Jeśli `locked_by_user_id = null` → ustaw blokadę.
4. UPDATE `locked_by_user_id`, `locked_at`.
5. Zwrócenie `LockOrderResponseDto`.

### 3.6 Stała konfiguracyjna

- `LOCK_TIMEOUT_MINUTES = 30` (lub konfigurowana) — czas wygaśnięcia blokady.

### 3.7 Etapy wdrożenia

1. **Service** — `lockOrder(supabase, userId, orderId)`.
2. **Route** `src/pages/api/v1/orders/[orderId]/lock.ts` — `export const POST`.
3. **Stała** `LOCK_TIMEOUT_MINUTES` w `src/lib/config.ts`.
4. Testy: lock wolnego zlecenia ✓, lock własnego (refresh) ✓, lock cudzego aktywnego → 409, lock cudzego wygasłego ✓.

---

## 4. POST /api/v1/orders/{orderId}/unlock — Zwolnienie blokady

### 4.1 Przegląd

Zwalnia blokadę edycji zlecenia. Wywoływane po zapisie lub przy wyjściu z formularza.

### 4.2 Szczegóły żądania

- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/unlock`
- **Request Body:** brak

### 4.3 Wykorzystywane typy

- **Response DTO:** `UnlockOrderResponseDto`

### 4.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
```json
{
  "id": "uuid",
  "lockedByUserId": null,
  "lockedAt": null
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401` | Brak autentykacji |
| `403` | Próba odblokowania cudzej blokady (chyba że ADMIN) |
| `404` | Zlecenie nie istnieje |

### 4.5 Przepływ danych

1. Autentykacja.
2. Pobranie zlecenia.
3. **Sprawdzenie uprawnień do odblokowania:**
   - Jeśli `locked_by_user_id = current_user` → odblokuj.
   - Jeśli `locked_by_user_id ≠ current_user` i rola = ADMIN → odblokuj (nadpisanie administratora).
   - Jeśli `locked_by_user_id ≠ current_user` i rola ≠ ADMIN → 403.
   - Jeśli `locked_by_user_id = null` → 200 (już odblokowane, idempotentność).
4. UPDATE `locked_by_user_id = null`, `locked_at = null`.
5. Zwrócenie `UnlockOrderResponseDto`.

### 4.6 Etapy wdrożenia

1. **Service** — `unlockOrder(supabase, userId, userRole, orderId)`.
2. **Route** `src/pages/api/v1/orders/[orderId]/unlock.ts` — `export const POST`.
3. Testy: unlock własny ✓, unlock cudzy jako ADMIN ✓, unlock cudzy jako PLANNER → 403, unlock niezablokowanego → 200.

---

## 5. POST /api/v1/orders/{orderId}/duplicate — Kopiowanie

### 5.1 Przegląd

Tworzy nowe zlecenie na podstawie istniejącego (wzorzec). Nowe zlecenie dostaje status `ROB`, nowy `order_no` i nowe `id`. Opcjonalnie kopiuje stops i items.

### 5.2 Szczegóły żądania

- **Metoda HTTP:** POST
- **URL:** `/api/v1/orders/[orderId]/duplicate`
- **Request Body:** `DuplicateOrderCommand`

  | Pole | Typ | Wymagane | Domyślnie | Opis |
  |------|-----|----------|-----------|------|
  | `includeStops` | `boolean` | Nie | `true` | Kopiuj punkty trasy |
  | `includeItems` | `boolean` | Nie | `true` | Kopiuj pozycje towarowe |
  | `resetStatusToDraft` | `boolean` | Nie | `true` | Ustaw status ROB |

### 5.3 Wykorzystywane typy

- **Command:** `DuplicateOrderCommand`
- **Response DTO:** `DuplicateOrderResponseDto`

### 5.4 Szczegóły odpowiedzi

**Sukces — `201 Created`**
```json
{
  "id": "uuid",
  "orderNo": "ZT2026/0042",
  "statusCode": "ROB"
}
```

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `401` | Brak autentykacji |
| `403` | READ_ONLY |
| `404` | Zlecenie źródłowe nie istnieje |

### 5.5 Przepływ danych

1. Autentykacja + rola ADMIN/PLANNER.
2. Pobranie zlecenia źródłowego (+ stops, items jeśli potrzebne).
3. Generowanie nowego `order_no`.
4. INSERT nowe zlecenie:
   - Kopiowanie pól nagłówka (bez `id`, `order_no`, `status_code`, `created_at`, `locked_*`).
   - `status_code = 'ROB'`, `created_by_user_id = current_user`.
5. Jeśli `includeStops` → INSERT kopie stops (nowe `id`, powiązane z nowym `order_id`).
6. Jeśli `includeItems` → INSERT kopie items.
7. INSERT `order_status_history` (initial status).
8. Aktualizacja pól denormalizowanych nowego zlecenia.
9. Zwrócenie `DuplicateOrderResponseDto`.

### 5.6 Etapy wdrożenia

1. **Zod schema** `duplicateOrderSchema`.
2. **Service** — `duplicateOrder(supabase, userId, orderId, command)`.
3. **Route** `src/pages/api/v1/orders/[orderId]/duplicate.ts` — `export const POST`.
4. Re-use `generateOrderNo()` z tworzenia.
5. Testy: duplicate z stops+items ✓, duplicate bez stops ✓, źródło nie istnieje → 404.

---

## 6. PATCH /api/v1/orders/{orderId}/stops/{stopId} — Częściowa edycja stopu

### 6.1 Przegląd

Częściowa edycja pojedynczego punktu trasy (zmiana daty, godziny, lokalizacji, notatek). Opcjonalny endpoint — uzupełniający do pełnej aktualizacji przez PUT.

### 6.2 Szczegóły żądania

- **Metoda HTTP:** PATCH
- **URL:** `/api/v1/orders/[orderId]/stops/[stopId]`
- **Parametry ścieżki:** `orderId` (UUID), `stopId` (UUID)
- **Request Body:** `PatchStopCommand`

  | Pole | Typ | Wymagane | Opis |
  |------|-----|----------|------|
  | `dateLocal` | `string (YYYY-MM-DD)` | Nie | Data |
  | `timeLocal` | `string (HH:MM:SS)` | Nie | Godzina |
  | `locationId` | `uuid` | Nie | Lokalizacja |
  | `notes` | `string` | Nie | Uwagi |

### 6.3 Wykorzystywane typy

- **Command:** `PatchStopCommand`

### 6.4 Szczegóły odpowiedzi

**Sukces — `200 OK`**
Zwraca zaktualizowany stop jako `OrderDetailStopDto`.

**Błędy:**
| Kod | Warunek |
|-----|---------|
| `400` | Niepoprawne dane |
| `401` | Brak autentykacji |
| `403` | READ_ONLY lub status nieedytowalny |
| `404` | Zlecenie lub stop nie istnieje |
| `409` | Blokada innego użytkownika |

### 6.5 Przepływ danych

1. Autentykacja + rola ADMIN/PLANNER.
2. Walidacja Zod (partial — wszystkie pola opcjonalne, ale co najmniej jedno wymagane).
3. Pobranie zlecenia i stopu, weryfikacja `stop.order_id = orderId`.
4. Sprawdzenie blokady i edytowalności statusu (jak w PUT).
5. Jeśli zmieniono `locationId` → re-resolve snapshotów (location_name, company_name, address).
6. UPDATE `order_stops` + aktualizacja pól denormalizowanych zlecenia (daty first/last, summary_route).
7. Logowanie zmian w `order_change_log` (opcjonalnie).
8. Automatyczne przejście statusu WYS/KOR_WYS → KOR jeśli zmieniono pola biznesowe.

### 6.6 Etapy wdrożenia

1. **Zod schema** `patchStopSchema`.
2. **Service** — `patchStop(supabase, userId, orderId, stopId, command)`.
3. **Route** `src/pages/api/v1/orders/[orderId]/stops/[stopId].ts` — `export const PATCH`.
4. Testy: zmiana daty ✓, zmiana lokalizacji (snapshot update) ✓, stop nie należy do zlecenia → 404.

---

## Wspólna struktura plików (akcje)

```
src/pages/api/v1/orders/[orderId]/
├── status.ts        # POST — zmiana statusu
├── restore.ts       # POST — przywracanie
├── lock.ts          # POST — blokada
├── unlock.ts        # POST — odblokowanie
├── duplicate.ts     # POST — kopiowanie
└── stops/
    └── [stopId].ts  # PATCH — częściowa edycja stopu
```

## Wspólna logika — mapa przejść statusów

```typescript
// src/lib/config.ts
export const ALLOWED_MANUAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  ROB: ['ZRE', 'ANL', 'REK'],
  WYS: ['ZRE', 'ANL', 'REK'],
  KOR: ['ZRE', 'ANL', 'REK'],
  KOR_WYS: ['ZRE', 'ANL', 'REK'],
  REK: ['ROB', 'ZRE', 'ANL'],
  // ZRE i ANL — przywracanie wyłącznie przez /restore
};

export const LOCK_TIMEOUT_MINUTES = 30;
```
