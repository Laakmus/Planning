# Resilience MVP — Plan implementacji

> Status: **Do zrobienia** | Priorytet: HIGH | Data utworzenia: 2026-03-04

## Cel

Dodanie mechanizmów odporności na błędy: rollback danych, offline detection z blokadą zapisu, przygotowanie architektury na przyszłą integrację ERP.

---

## Fazy implementacji

### Faza 1: Typy i interfejsy
- **Agent:** Types
- **Plik:** `src/types/`
- **Zakres:**
  - `OfflineError` — klasa błędu braku połączenia (`isOffline = true`)
  - `DataSourceAdapter` — interfejs adaptera źródła danych (6 metod: companies, locations, products, transportTypes, orderStatuses, vehicleVariants)
  - `DataSourceType` — `"internal" | "erp"`
- **Status:** [ ] Do zrobienia

### Faza 2: Offline detection + blokada zapisu
- **Agent:** Frontend
- **Równolegle z:** Fazą 3

#### 2a. Hook `useOnlineStatus`
- **Nowy plik:** `src/hooks/useOnlineStatus.ts`
- `navigator.onLine` + event listeners `online`/`offline`
- Zwraca `isOnline: boolean`

#### 2b. Komponent `OfflineBanner`
- **Nowy plik:** `src/components/ui/OfflineBanner.tsx`
- Banner `role="alert"` z ikoną `WifiOff` (lucide-react)
- Tailwind: `bg-amber-50 border-b border-amber-200 text-amber-800` + dark mode warianty
- Tekst: "Jesteś offline. Odczyt danych dostępny, zapis zablokowany."

#### 2c. Guard offline + retry w api-client
- **Plik:** `src/lib/api-client.ts`
- Guard: przed `fetch()` sprawdzaj `navigator.onLine` dla POST/PUT/PATCH/DELETE → throw `OfflineError`
- Retry: exponential backoff + jitter, max 3 próby, **tylko GET i PUT** (idempotentne), retry przy 5xx lub network error
- Delay: `min(1000 * 2^attempt + random(0,100), 10000)` ms

#### 2d. Banner w OrdersApp
- **Plik:** `src/components/orders/OrdersApp.tsx`
- `useOnlineStatus()` w `OrdersAppInner`
- `<OfflineBanner isVisible={!isOnline} />` nad `<header>` w `SidebarInset`

- **Status:** [ ] Do zrobienia

### Faza 3: Rollback danych przy błędach
- **Agent:** Frontend + Backend
- **Równolegle z:** Fazą 2

#### 3a. Frontend rollback w OrderDrawer
- **Plik:** `src/components/orders/drawer/OrderDrawer.tsx`
- `handleSave()`: snapshot `previousDetail = detail` przed API call
  - Sukces → aktualizuj detail, `isDirty = false`
  - Błąd → `setDetail(previousDetail)`, `isDirty = true`, toast z kontekstowym komunikatem
  - `OfflineError` → `toast.warning("Jesteś offline...")`
  - `ApiError 409` → `toast.error("Zlecenie zmodyfikowane przez innego użytkownika...")`
- `handleCreate()`: przy błędzie POST nie nawiguj, zostań w trybie tworzenia

#### 3b. Backend rollback — compensating cleanup
- **Pliki:** `src/lib/services/order-create.service.ts`, `src/lib/services/order-update.service.ts`
- `createOrder()`: try/catch wokół INSERT stops/items/history/changelog → DELETE order (CASCADE) przy błędzie
- `updateOrder()`: logowanie niespójności + 500 (pełny rollback = post-MVP via RPC PL/pgSQL)

#### 3c. Granularne ErrorBoundary
- **Plik:** `src/components/orders/OrdersPage.tsx`
- `<ErrorBoundary>` wokół OrderDrawer i HistoryPanel osobno

- **Status:** [ ] Do zrobienia

### Faza 4: ERP Adapter pattern
- **Agent:** Frontend + Backend

#### 4a. Nowe pliki adapterów
- `src/lib/adapters/internal-data-source.ts` — implementacja `DataSourceAdapter` opakowująca `api.get()`
- `src/lib/adapters/erp-data-source.ts` — stub z `throw new Error("ERP adapter nie zaimplementowany")`
- `src/lib/adapters/index.ts` — fabryka `createDataSourceAdapter(type, api)`

#### 4b. Refaktor DictionaryContext
- **Plik:** `src/contexts/DictionaryContext.tsx`
- Zastąpić 6× bezpośrednie `api.get()` wywołaniem przez `DataSourceAdapter`
- Korzyść: zmiana źródła danych (ERP) = nowa implementacja adaptera, zero zmian w komponentach

- **Status:** [ ] Do zrobienia

### Faza 5: Testy
- **Agent:** Tester
- Testy:
  - `useOnlineStatus` — mock `navigator.onLine` + events
  - `api-client` retry — mock fetch 500→500→200
  - `api-client` offline guard — `navigator.onLine = false` → `OfflineError`
  - `OrderDrawer` rollback — mock `api.put` error → verify `detail === previousDetail`
  - `InternalDataSource` — mock `api.get` → verify mapowanie
- **Status:** [ ] Do zrobienia

### Faza 6: Code review (opcjonalnie)
- **Agent:** Reviewer
- **Status:** [ ] Do zrobienia

---

## Kluczowe decyzje architektoniczne (z debaty agentów)

### Transakcje DB
- **MVP:** Compensating cleanup (wzorzec z `duplicateOrder`) — rozszerzenie na `createOrder`
- **Docelowo (post-MVP):** RPC PL/pgSQL (`create_order_transaction`, `update_order_transaction`) — prawdziwe ACID. Precedensy w projekcie: `try_lock_order`, `generate_next_order_no`
- **Odrzucone:** Edge Functions (zmiana architektury), raw pg client (rozbija RLS), DB triggers (nie rozwiązują multi-statement atomicity)

### Offline detection
- **MVP:** `navigator.onLine` + event listeners — wystarczające dla środowiska biurowego
- **Odrzucone:** Service Workers (conflict resolution zbyt kosztowny dla multi-user), heartbeat ping (overkill)

### Retry
- **MVP:** Exponential backoff + jitter, tylko GET/PUT (idempotentne), max 3 próby
- **Odrzucone:** Circuit breaker (overkill, rozważyć przy ERP), retry POST (ryzyko duplikatów)

### ERP
- **MVP:** Adapter pattern + stub `ErpDataSource`
- **Odrzucone:** Event-driven sync, Anti-corruption layer (nie znamy struktury ERP)

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/types/` | +OfflineError, +DataSourceAdapter, +DataSourceType |
| `src/lib/api-client.ts` | +offline guard, +retry z backoff (GET/PUT) |
| `src/lib/services/order-create.service.ts` | +compensating DELETE w createOrder |
| `src/lib/services/order-update.service.ts` | +logging w updateOrder |
| `src/components/orders/OrdersApp.tsx` | +useOnlineStatus, +OfflineBanner |
| `src/components/orders/drawer/OrderDrawer.tsx` | +snapshot/rollback w handleSave/handleCreate |
| `src/components/orders/OrdersPage.tsx` | +ErrorBoundary wokół OrderDrawer |
| `src/contexts/DictionaryContext.tsx` | +DataSourceAdapter zamiast bezpośrednich api.get |

## Nowe pliki

| Plik | Opis |
|------|------|
| `src/hooks/useOnlineStatus.ts` | Hook navigator.onLine + events |
| `src/components/ui/OfflineBanner.tsx` | Banner offline z WifiOff |
| `src/lib/adapters/internal-data-source.ts` | Adapter wewnętrzny (opakowanie api.get) |
| `src/lib/adapters/erp-data-source.ts` | Stub ERP |
| `src/lib/adapters/index.ts` | Fabryka adapterów |

---

## Weryfikacja

1. `npm run build` — zero błędów TypeScript
2. `npm run test` — testy przechodzą (nowe + istniejące)
3. Manual: wyłącz sieć w DevTools → banner offline widoczny, przyciski zapisu → toast warning
4. Manual: edytuj zlecenie → symuluj błąd serwera → formularz wraca do poprzedniego stanu
5. Manual: utwórz zlecenie → przy błędzie INSERT stops sprawdź brak osieroconego nagłówka
