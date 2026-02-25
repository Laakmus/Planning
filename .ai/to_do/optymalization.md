# Plan Optymalizacji Wydajności — Planning App

> Utworzono: 2026-02-25 | Audyt przeprowadzony przez 3 agentów: Frontend Perf, Backend/DB Perf, Build/Astro
> Kontekst: 50-200 wierszy w tabeli, 4-10 równoczesnych użytkowników, prewencyjny audyt

---

## Legenda

- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Effort**: Niski (< 1h) / Średni (1-4h) / Wysoki (> 4h)
- **Impact**: wpływ na płynność / czas ładowania / skalowalność
- **Zgodność z docs**: Czy problem jest opisany / zgodny z dokumentacją `.ai/`

---

## SEKCJA A — FRONTEND (React / UI)

### A-01. [HIGH] Brak `React.memo` na `OrderRow` — zbędne re-rendery

- **Pliki**: `src/components/orders/OrderRow.tsx:48`
- **Problem**: `OrderRow` jest zwykłym komponentem funkcyjnym. Każda zmiana stanu w `OrdersPage` (otwarcie drawera, zmiana filtra, dialog anulowania) powoduje re-render WSZYSTKICH wierszy — nawet tych, których props się nie zmieniły.
- **Wpływ**: Przy 200 wierszach: setki komponentów re-renderowanych niepotrzebnie + `.filter()/.sort()/.reduce()` na `stops/items` przy każdym renderze.
- **Fix**: Zawinąć `OrderRow` w `React.memo()`. Shallow compare wystarczy — pod warunkiem stabilności callbacków (patrz A-02).
- **Effort**: Niski | **Impact**: Najwyższy zysk
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — dokumentacja nie opisuje wzorców optymalizacji React (memo, useCallback)
  - **Referencje**: `orders-view-implementation-plan.md §3` — definiuje strukturę komponentów (OrderRow w hierarchii), ale nie opisuje strategii memoizacji
  - **Docs do aktualizacji po fix**: `orders-view-implementation-plan.md §3` — dodać notatkę o wzorcach memoizacji komponentów tabeli

### A-02. [HIGH] Niestabilne callbacki w `OrdersPage`

- **Plik**: `src/components/orders/OrdersPage.tsx:110-190`
- **Problem**: Handlery `handleFiltersChange`, `handleClearFilters`, `handleSort`, `handleRowClick`, `handleShowHistory` NIE są opakowane w `useCallback`. Tworzą się na nowo przy każdym renderze → nawet z `React.memo` na `OrderRow`, porównanie props ZAWSZE wykryje zmianę.
- **Wpływ**: Uniemożliwia działanie `React.memo` na dzieciach.
- **Fix**: Owinąć w `useCallback` (analogicznie do istniejących `handleAddOrder`, `handleSendEmail` itd.).
- **Effort**: Niski | **Impact**: Wymagane aby A-01 działało
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — brak wytycznych dot. stabilności callbacków
  - **Referencje**: `orders-view-implementation-plan.md §5.2` — opisuje handlery OrdersPage (filtrowanie, sortowanie, paginacja), ale bez wytycznych implementacyjnych
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna (implementacja istniejącej logiki)

### A-03. [MEDIUM] Brak `React.memo` na komponentach komórek tabeli

- **Pliki**: `src/components/orders/RouteSummaryCell.tsx:19`, `LocationsCell.tsx:17,82`
- **Problem**: Wykonują kosztowne operacje (`.sort()`, `.filter()`, `.map()`) przy KAŻDYM renderze. Przy 200 wierszach × 2-4 komórki = 400-800 niepotrzebnych sortowań.
- **Fix**: Dodać `React.memo` na `RouteSummaryCell`, `LocationsCell`, `DatesCell`, `StatusBadge`.
- **Effort**: Niski | **Impact**: Uzupełnia A-01
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs
  - **Referencje**: `ui-plan.md §2.2` — definiuje widoki Trasa/Kolumny i ich komórki, ale nie opisuje optymalizacji renderowania; `orders-view-implementation-plan.md §3` — wymienia RouteSummaryCell, LocationsCell w hierarchii
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### A-04. [MEDIUM] Brak `AbortController` w `useOrders`

- **Plik**: `src/hooks/useOrders.ts:35-85`
- **Problem**: Szybkie zmiany filtrów generują wiele równoległych requestów. `staleRef` chroni przed ustawianiem starego stanu, ale stary request dalej leci po sieci — marnuje bandwidth i obciąża backend. Brak też cache'owania (przejście CURRENT→COMPLETED→CURRENT = ponowny fetch).
- **Fix**: Dodać `AbortController` do `fetchData` — cancel poprzedniego requestu przy nowym. Opcjonalnie: rozważyć TanStack Query / SWR dla cache + deduplication.
- **Effort**: Średni | **Impact**: Eliminuje race conditions + redundantne requesty
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — api-plan nie opisuje strategii cancel/retry po stronie frontendu
  - **Referencje**: `api-plan.md §2.2` — definiuje parametry GET /orders (filtry, paginacja), ale nie opisuje wzorca client-side request management; `orders-view-implementation-plan.md §5.1` — opisuje hook useOrders bez wzmianki o cancellation
  - **Docs do aktualizacji po fix**: `orders-view-implementation-plan.md §5.1` — dodać notatkę o AbortController / strategii cache

### A-05. [MEDIUM] `JSON.stringify` do isDirty na każdym keystroke

- **Plik**: `src/components/orders/drawer/OrderForm.tsx:158`
- **Problem**: `computeDirty()` wywołuje `JSON.stringify()` na CAŁYM `OrderFormData` (ze stops/items) przy każdym uderzeniu klawisza w input. O(n) stringifikacja na każdym keystroke.
- **Fix**: Ustawić `isDirty = true` po PIERWSZEJ zmianie (bez porównania). Resetować na `false` po save/reset. Alternatywnie — porównywać pole-po-polu zamiast stringify.
- **Effort**: Niski | **Impact**: Istotne w drawerze przy dużych formularzach
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — mechanizm isDirty nie jest opisany w dokumentacji
  - **Referencje**: `ui-plan.md §2.3.1` — opisuje dialog "Niezapisane zmiany" (UnsavedChangesDialog), ale nie precyzuje metody detekcji zmian; `orders-view-implementation-plan.md §4.3` — opisuje DrawerFooter z beforeunload guard
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### A-06. [MEDIUM] Wielokrotne `.filter()/.sort()` na stops w `OrderRow`

- **Plik**: `src/components/orders/OrderRow.tsx:83-90`
- **Problem**: Przy KAŻDYM renderze: 2× filter + 2× sort na tablicy `stops` (firstLoading, firstUnloading). Dodatkowo te same operacje powtarzane w `RouteSummaryCell` i `LocationsCell`.
- **Fix**: Z `React.memo` (A-01) problem znika automatycznie (obliczanie tylko raz, gdy `order` prop się zmieni). Opcjonalnie: jeden przebieg po tablicy zamiast 4 osobnych.
- **Effort**: Niski | **Impact**: ~4000 operacji tablicowych mniej na render
- **Zgodność z dokumentacją**:
  - **Status**: Zgodne z docs — API zwraca stops nieposortowane, frontend musi sortować
  - **Referencje**: `api-plan.md §2.2` — odpowiedź listy zawiera `stops[]` z `sequenceNo`; `ui-plan.md §2.2` — "Widok Trasa: node-string L1→L2→U1" wymaga sortowania po sequenceNo
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### A-07. [LOW] `TooltipProvider` per `LockIndicator` (×200)

- **Plik**: `src/components/orders/LockIndicator.tsx:24`
- **Problem**: Każdy `LockIndicator` tworzy własny `<TooltipProvider>`. Przy 200 wierszach = 200 instancji Radix Context Provider.
- **Fix**: Przenieść jeden `<TooltipProvider>` na poziom `OrdersApp.tsx` i usunąć z `LockIndicator`.
- **Effort**: Niski | **Impact**: Czystość + mniejsze narzuty
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — architektura providerów Radix nie jest opisana
  - **Referencje**: `ui-plan.md §2.2` — "ikona blokady (jeśli zlecenie edytowane przez innego użytkownika)" — definiuje LockIndicator funkcjonalnie, nie technicznie
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### A-08. [LOW] Nowe tablice w `FilterBar` na każdym renderze

- **Plik**: `src/components/orders/FilterBar.tsx:90-91`
- **Problem**: `companies.map(...)` i `products.map(...)` tworzą nowe referencje tablic na każdym renderze.
- **Fix**: Owinąć w `useMemo(() => ..., [companies])`.
- **Effort**: Niski | **Impact**: Drobna optymalizacja
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs
  - **Referencje**: `ui-plan.md §2.2` — opisuje FilterBar z autocomplete filtrami
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### A-09. [LOW] Inline function w `HistoryPanel.onClose`

- **Plik**: `src/components/orders/OrdersPage.tsx:387-391`
- **Fix**: Wyciągnąć do `const handleHistoryClose = useCallback(...)`.
- **Effort**: Niski | **Impact**: Trywialne
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs
  - **Referencje**: `ui-plan.md §2.4` — opisuje HistoryPanel funkcjonalnie
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

---

## SEKCJA B — BACKEND / BAZA DANYCH

### B-01. [HIGH / BUG] RLS `user_profiles` blokuje JOINy — brak imion użytkowników

- **Plik**: `supabase/migrations/20260207000000_consolidated_schema.sql:60-64` (uwaga: migracje skonsolidowane 2026-02-25)
- **Problem**: Policy `user_profiles_select_own` pozwala czytać TYLKO swój profil (`id = auth.uid()`). Tymczasem `listOrders` wykonuje 4 LEFT JOINy do `user_profiles` (created_by, updated_by, sent_by, locked_by) — RLS odfiltruje profile INNYCH użytkowników. Pola `createdByUserName`, `sentByUserName`, `lockedByUserName` są `null` dla zleceń innych użytkowników. **To jest BUG FUNKCJONALNY, nie tylko wydajnościowy.**
- **Fix**: Dodać migrację:
  ```sql
  DROP POLICY IF EXISTS user_profiles_select_own ON user_profiles;
  CREATE POLICY user_profiles_select_all_authenticated
    ON user_profiles FOR SELECT TO authenticated USING (true);
  ```
- **Effort**: Niski (1 migracja) | **Impact**: Krytyczny — naprawia widoczność imion
- **Zgodność z dokumentacją**:
  - **Status**: **NIEZGODNE z docs** — db-plan.md mówi o odczycie "swoich i ewentualnie listy użytkowników", a migracja implementuje TYLKO odczyt swojego profilu
  - **Referencje**: `db-plan.md §4.2` — "SELECT: wszyscy uwierzytelnieni użytkownicy mogą odczytać swój własny rekord i **ewentualnie listę użytkowników** (do doprecyzowania)"; `api-plan.md §2.2` — odpowiedź listy zawiera `createdByUserName`, `sentByUserName`, `lockedByUserName` — co wymaga odczytu profili INNYCH użytkowników
  - **Docs do aktualizacji po fix**: `db-plan.md §4.2` — zmienić z "do doprecyzowania" na "wszyscy authenticated mogą czytać profil każdego (wymagane przez JOINy w listOrders/getOrderDetail)"

### B-02. [HIGH] Brak indeksu `pg_trgm` na `search_text` — seq scan przy ILIKE

- **Plik**: `src/lib/services/order.service.ts:287`
- **Problem**: Wyszukiwanie używa `ILIKE '%pattern%'` na `search_text`. Indeks GIN istnieje na `search_vector` (tsvector), ale KOD używa `search_text` z ILIKE — indeks jest bezużyteczny. `ILIKE '%..%'` z wildcardem na początku = sequential scan.
- **Fix**: Dodać migrację:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_transport_orders_search_text_trgm
    ON transport_orders USING gin (search_text gin_trgm_ops);
  ```
- **Effort**: Niski (1 migracja) | **Impact**: Wyszukiwanie szybkie nawet przy 10k+ zleceń
- **Zgodność z dokumentacją**:
  - **Status**: **Częściowo zgodne** — db-plan wspomina o pg_trgm jako opcji, ale implementacja wybrała ILIKE bez indeksu trigramowego
  - **Referencje**: `db-plan.md §3.1` — "(opcjonalnie) GIN INDEX na search_vector — do pełnotekstowego wyszukiwania (wymaga rozszerzeń pg_trgm/unaccent/konfiguracji FTS)"; `db-plan.md §6` — "W MVP globalne wyszukiwanie może działać przez ILIKE/LOWER() na search_text, z wykorzystaniem rozszerzenia unaccent (...) Docelowo można zbudować search_vector jako tsvector i indeks GIN"
  - **Docs do aktualizacji po fix**: `db-plan.md §3.1` — zmienić "(opcjonalnie)" na "WYMAGANE" przy indeksie pg_trgm; `db-plan.md §6` — zaktualizować sekcję wyszukiwania tekstowego o wybraną strategię (pg_trgm GIN na search_text)

### B-03. [MEDIUM] Brak kompresji HTTP (gzip/brotli)

- **Pliki**: `astro.config.mjs`, `src/lib/api-helpers.ts`
- **Problem**: Astro z `@astrojs/node` standalone NIE dodaje automatycznie kompresji. Odpowiedzi JSON (50-100KB) transferowane jako plaintext.
- **Wpływ**: gzip redukuje JSON o 70-85%. Na VPN/wolnym łączu: ~500ms vs ~100ms.
- **Fix**: Dodać reverse proxy (nginx/Caddy) z kompresją lub middleware kompresji w Node.js.
- **Effort**: Średni | **Impact**: Znaczący dla transferu danych
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — kompresja HTTP nie jest nigdzie opisana
  - **Referencje**: `api-plan.md §5` — "HTTPS: cały ruch po HTTPS" — wspomina o bezpieczeństwie transportu, ale nie o kompresji; `prd.md §3.1.1` — "Aplikacja przeznaczona do użycia głównie z sieci firmowej lub przez VPN" — VPN zwiększa potrzebę kompresji
  - **Docs do aktualizacji po fix**: `api-plan.md §5` — dodać sekcję o kompresji HTTP (gzip/brotli, sposób realizacji: reverse proxy lub middleware)

### B-04. [MEDIUM] 2 zapytania auth na KAŻDY request API

- **Plik**: `src/lib/services/auth.service.ts:36-59`
- **Problem**: `supabase.auth.getUser()` (HTTP do GoTrue) + `SELECT user_profiles` = 2 zapytania PRZED logiką biznesową. +20-50ms do każdego API call.
- **Fix**: Użyć `supabase.auth.getSession()` (weryfikacja JWT lokalnie, bez round-tripu) + cachować `user_profiles` w in-memory Map z TTL 60s.
- **Effort**: Średni | **Impact**: -20-50ms na KAŻDY request
- **Zgodność z dokumentacją**:
  - **Status**: Zgodne z docs — api-plan opisuje autoryzację przez JWT + user_profiles, ale nie precyzuje metody (getUser vs getSession)
  - **Referencje**: `api-plan.md §3` — "Supabase Auth (JWT), backend weryfikuje token w nagłówku Authorization. Endpoint /auth/me bazuje na user_profiles powiązanych z auth.users"; `db-plan.md §4.1` — "Rola aplikacyjna (np. app_user): używana przez API/Supabase"
  - **Docs do aktualizacji po fix**: `api-plan.md §3` — dodać notatkę o strategii cachowania profilu (in-memory, TTL) i o użyciu getSession zamiast getUser

### B-05. [MEDIUM] `SELECT *` na `transport_orders` w listOrders

- **Plik**: `src/lib/services/order.service.ts:260-269`
- **Problem**: Pobiera WSZYSTKIE ~45 kolumn (w tym `search_text`, `search_vector`, snapshoty adresów). Mapper używa ~30 z nich. ~15 kolumn jest niepotrzebnie transferowanych.
- **Fix**: Zamienić `*` na jawną listę kolumn.
- **Effort**: Niski | **Impact**: ~30-50% mniej danych DB→API
- **Zgodność z dokumentacją**:
  - **Status**: **Niezgodne z duchem docs** — api-plan wyraźnie mówi o uproszczonej odpowiedzi listy
  - **Referencje**: `api-plan.md §2.2` — "Uwaga o wydajności: Tablice stops i items w odpowiedzi listy są **uproszczone** (brak id, locationId, productId, addressSnapshot). Zawierają tylko dane potrzebne do renderowania tabeli." — ta uwaga dotyczy stops/items, ale ten sam duch powinien dotyczyć też kolumn głównej tabeli
  - **Docs do aktualizacji po fix**: Brak — docs już sugerują minimalizację payloadu. Opcjonalnie dodać jawną listę kolumn pobieranych w liście do `api-plan.md §2.2`

### B-06. [MEDIUM] Zbędne zapytanie do `order_statuses` przy każdym listOrders

- **Plik**: `src/lib/services/order.service.ts:149-157`
- **Problem**: Tabela `order_statuses` ma 7 stałych wierszy (seed). Każdy call listOrders pobiera je na nowo.
- **Fix**: Hardcode mapa `view_group → statusCodes[]` lub cache z TTL.
- **Effort**: Niski | **Impact**: -1 round-trip per request
- **Zgodność z dokumentacją**:
  - **Status**: Zgodne z docs — dane seed z order_statuses są jawnie zdefiniowane w db-plan
  - **Referencje**: `db-plan.md §1.10` — tabela seed z 7 wierszami (robocze, wysłane, korekta, korekta wysłane, reklamacja, zrealizowane, anulowane) z jawnym mapowaniem view_group; `api-plan.md §2.2` — "Mapowanie widoków (parametr view / order_statuses.view_group): CURRENT = robocze, wysłane, korekta, korekta wysłane, reklamacja; COMPLETED = zrealizowane; CANCELLED = anulowane"
  - **Docs do aktualizacji po fix**: Brak — mapowanie jest już jawnie udokumentowane. Hardcode w kodzie jest zgodny z docs.

### B-07. [MEDIUM] Sub-query filtry — intersect w JS zamiast SQL

- **Plik**: `src/lib/services/order.service.ts:163-258`
- **Problem**: Do 5 oddzielnych zapytań + intersect w JS + `.in("id", [tysiące UUID-ów])`. Przy 50k zleceń transfer tysięcy UUID-ów.
- **Fix**: Stworzyć funkcję RPC w PostgreSQL, która filtruje w jednym zapytaniu z JOINami.
- **Effort**: Wysoki | **Impact**: Istotne dopiero przy dużej skali
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — api-plan definiuje PARAMETRY filtrów, ale nie strategię ich implementacji
  - **Referencje**: `api-plan.md §2.2` — definiuje filtry: `productId`, `loadingLocationId`, `loadingCompanyId`, `unloadingLocationId`, `unloadingCompanyId` z opisem semantyki (np. "zwraca zlecenia, gdzie podana lokalizacja występuje w dowolnym punkcie załadunku")
  - **Docs do aktualizacji po fix**: `db-plan.md` — dodać sekcję o funkcji RPC `filter_order_ids` (parametry, opis JOINów); `api-plan.md §5` — dodać notatkę o strategii filtrowania (RPC vs sub-query)

### B-08. [LOW] `getOrderDetail` — 3 sekwencyjne zapytania

- **Plik**: `src/lib/services/order.service.ts:397-517`
- **Problem**: Order, stops, items pobierane sekwencyjnie. W `listOrders` stops+items są już z `Promise.all`.
- **Fix**: `Promise.all([order, stops, items])`.
- **Effort**: Niski | **Impact**: -10-20ms na otwarcie drawera
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — strategia równoległych zapytań nie jest opisana
  - **Referencje**: `api-plan.md §2.3` — definiuje GET /orders/{orderId} z odpowiedzią {order, stops, items}
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### B-09. [LOW] `validateForeignKeys` — do 5 sekwencyjnych zapytań

- **Plik**: `src/lib/services/order.service.ts:757-833`
- **Fix**: Zamienić na `Promise.all` dla niezależnych walidacji FK.
- **Effort**: Niski | **Impact**: -15-25ms na save
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs
  - **Referencje**: `api-plan.md §4` — "typy danych i constrainty z bazy (CHECK, FK, unikalność)" — walidacja FK jest wymagana, ale metoda nie jest precyzowana
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

### B-10. [LOW] Słowniki bez paginacji

- **Pliki**: `src/lib/services/dictionary.service.ts`
- **Problem**: Przy 500+ firmach i 2000+ lokalizacjach odpowiedź locations może mieć 200-500KB JSON.
- **Status**: Już w TODO jako L-02. Narastający problem.
- **Fix**: Dodać `limit` + `search` param do endpointów słownikowych.
- **Effort**: Średni | **Impact**: Narastający z ilością danych ERP
- **Zgodność z dokumentacją**:
  - **Status**: Zgodne z docs — api-plan wymienia endpointy słownikowe bez paginacji (zgodnie z MVP)
  - **Referencje**: `api-plan.md §2.12` — "GET /companies, /locations, /products, /transport-types, /order-statuses, /vehicle-variants" — brak wzmianki o paginacji/limitach; `api-plan.md §5` — "Paginacja: ograniczone pageSize, brak zwracania ogromnych list" — dotyczy zleceń, nie słowników
  - **Docs do aktualizacji po fix**: `api-plan.md §2.12` — dodać parametry `search`, `limit`, `offset` do endpointów /companies, /locations, /products

---

## SEKCJA C — BUILD / ASTRO / BUNDLE

### C-01. [MEDIUM] `client:load` zamiast `client:idle` na React island

- **Plik**: `src/pages/orders.astro`
- **Problem**: `<OrdersApp client:load />` — hydration NATYCHMIAST po załadowaniu strony (blokująca). Przy ~254KB JS gzip to opóźnia FCP.
- **Fix**: Zmienić na `client:idle` — hydration po idle przeglądarki (~200-500ms później, ale bez blokowania).
- **Effort**: Niski | **Impact**: Szybsze FCP
- **Zgodność z dokumentacją**:
  - **Status**: **Zgodne z docs, ale docs nie precyzują dyrektywy hydration**
  - **Referencje**: `orders-view-implementation-plan.md §2` — "Strona /orders renderuje pojedynczą wyspę React (`<OrdersApp client:load />`)" — jawnie mówi o `client:load`; `ui-plan.md §1` — "Astro 5 (SSR) + React 19" — nie precyzuje strategii hydration
  - **Docs do aktualizacji po fix**: `orders-view-implementation-plan.md §2` — zmienić `client:load` na `client:idle` w opisie routingu

### C-02. [LOW] Lazy loading `OrderDrawer` (dnd-kit ~40KB gzip)

- **Pliki**: `src/components/orders/OrdersPage.tsx:31`
- **Problem**: `OrderDrawer` + dnd-kit ładowane eagerly w głównym bundle, mimo że drawer otwierany jest na klik.
- **Fix**: `React.lazy(() => import('./drawer/OrderDrawer'))` + `<Suspense>`.
- **Effort**: Średni | **Impact**: -40KB gzip z initial bundle
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — lazy loading nie jest opisany
  - **Referencje**: `orders-view-implementation-plan.md §3` — wymienia OrderDrawer w hierarchii komponentów: "OrdersPage → OrderDrawer (Sheet)"
  - **Docs do aktualizacji po fix**: `orders-view-implementation-plan.md §3` — dodać notatkę o lazy loading drawera (React.lazy + Suspense)

### C-03. [LOW] Brak `font-display: swap` w URL Google Fonts

- **Plik**: `src/layouts/Layout.astro`
- **Fix**: Dodać `&display=swap` do URL fontu.
- **Effort**: Niski | **Impact**: Zapobiega FOUT
- **Zgodność z dokumentacją**:
  - **Status**: Brak w docs — strategia ładowania fontów nie jest opisana
  - **Referencje**: `ui-plan.md §1` — wspomina o stacku technologicznym (Tailwind CSS), ale nie o fontach
  - **Docs do aktualizacji po fix**: Brak — zmiana czysto techniczna

---

## SEKCJA D — POZYTYWNE OBSERWACJE (co jest DOBRZE)

Audyt potwierdził prawidłowość wielu aspektów:

1. **Brak N+1 w listOrders** — poprawny wzorzec "1+2" z batch pobieraniem stops/items
2. **Cache-Control na słownikach** — `private/public, max-age=3600` poprawnie ustawione
3. **Indeksy DB** — 14/15 indeksów z db-plan.md zaimplementowanych w migracjach
4. **Dictionary loading** — 6 endpointów ładowanych równolegle (`Promise.all`)
5. **Tree-shaking** — lucide-react i radix-ui poprawnie importowane (named imports)
6. **Stabilne callbacki** — większość handlerów w `OrdersPage` JUŻ opakowana w `useCallback`
7. **Rate limiting** — in-memory Map z cleanup co 5 minut
8. **Anti-flash script** — `is:inline` w Layout.astro zapobiega FOUC dark mode
9. **Czas budowania** — <2.1s (doskonały)
10. **Bundle size ogólny** — ~254KB JS gzip + ~49KB CSS = ~303KB (w normie dla biz app)

---

## SEKCJA E — MAPA ZMIAN W DOKUMENTACJI

Poniższa tabela podsumowuje, KTÓRE dokumenty `.ai/` wymagają aktualizacji po wdrożeniu poszczególnych fixów:

| Plik `.ai/` | Findindi wymagające update docs | Sekcja do zmiany | Opis zmiany |
|---|---|---|---|
| `db-plan.md` | B-01 | §4.2 (RLS user_profiles) | Zmienić "do doprecyzowania" → "USING (true) dla authenticated" |
| `db-plan.md` | B-02 | §3.1 (Indeksy transport_orders) | Dodać indeks pg_trgm GIN na search_text (już nie opcjonalny) |
| `db-plan.md` | B-02 | §6 (Wyszukiwanie tekstowe) | Zaktualizować o wybraną strategię (pg_trgm + ILIKE) |
| `db-plan.md` | B-07 | nowa sekcja | Dodać opis funkcji RPC filter_order_ids (jeśli wdrożona) |
| `api-plan.md` | B-03 | §5 (Wydajność) | Dodać sekcję o kompresji HTTP |
| `api-plan.md` | B-04 | §3 (Uwierzytelnianie) | Dodać notatkę o getSession + cache profilu |
| `api-plan.md` | B-07 | §5 lub §2.2 | Dodać notatkę o strategii filtrowania (RPC) |
| `api-plan.md` | B-10 | §2.12 (Słowniki) | Dodać search/limit/offset do endpointów |
| `orders-view-implementation-plan.md` | A-01, C-01 | §2 (Routing), §3 (Struktura) | client:idle + notatka o memoizacji |
| `orders-view-implementation-plan.md` | A-04 | §5.1 (useOrders) | AbortController / cache |
| `orders-view-implementation-plan.md` | C-02 | §3 (Struktura) | Lazy loading drawera |

---

## PLAN WDROŻENIA — KOLEJNOŚĆ PRIORYTETÓW

### Faza 1: Quick Wins (1-2h, największy stosunek impact/effort)

| # | Zadanie | Domena | Docs do update |
|---|---------|--------|----------------|
| B-01 | Fix RLS user_profiles (BUG) | Database | `db-plan.md §4.2` |
| A-01 | `React.memo` na OrderRow | Frontend | `orders-view-impl-plan.md §3` |
| A-02 | `useCallback` na brakujących handlerach | Frontend | Brak |
| B-06 | Cache `order_statuses` w pamięci | Backend | Brak |
| C-01 | `client:load` → `client:idle` | Astro | `orders-view-impl-plan.md §2` |
| C-03 | Font-display swap | Astro | Brak |

### Faza 2: Średnie ulepszenia (2-4h)

| # | Zadanie | Domena | Docs do update |
|---|---------|--------|----------------|
| B-02 | Indeks pg_trgm na search_text | Database | `db-plan.md §3.1, §6` |
| A-03 | `React.memo` na komponentach komórek | Frontend | Brak |
| A-04 | AbortController w useOrders | Frontend | `orders-view-impl-plan.md §5.1` |
| A-05 | Fix isDirty — bez JSON.stringify | Frontend | Brak |
| B-05 | Jawna lista kolumn zamiast SELECT * | Backend | Opcjonalnie `api-plan.md §2.2` |
| B-08 | Promise.all w getOrderDetail | Backend | Brak |
| B-09 | Promise.all w validateForeignKeys | Backend | Brak |
| A-07 | Przenieść TooltipProvider na app level | Frontend | Brak |

### Faza 3: Większe refaktory (4h+, do rozważenia w przyszłości)

| # | Zadanie | Domena | Docs do update |
|---|---------|--------|----------------|
| B-03 | Kompresja HTTP (reverse proxy / middleware) | Infra | `api-plan.md §5` |
| B-04 | Auth optimization (getSession + profile cache) | Backend | `api-plan.md §3` |
| C-02 | Lazy loading OrderDrawer | Frontend | `orders-view-impl-plan.md §3` |
| B-07 | Sub-query filtry → RPC PostgreSQL | Database | `db-plan.md` + `api-plan.md §5` |
| B-10 | Paginacja słowników (L-02 z TODO) | Backend | `api-plan.md §2.12` |

---

## Szacowane zyski po Fazie 1+2

| Metryka | Przed | Po | Zysk |
|---------|-------|----|------|
| Re-rendery tabeli (200 wierszy) | ~1200 komponentów/render | ~50 (tylko zmienione) | -95% |
| Czas otwarcia drawera | ~150ms (lock+detail seq.) | ~80ms (parallel) | -47% |
| Transfer JSON (lista 50 zleceń) | ~100KB | ~65KB (bez SELECT *) | -35% |
| Wyszukiwanie przy 10k zleceń | seq scan ~200ms | GIN index ~5ms | -97% |
| Zbędne round-tripy auth | 2 per request | 0-1 (cached) | -50-100% |
| FCP (hydration) | blokujący (client:load) | deferred (client:idle) | -200-500ms |
