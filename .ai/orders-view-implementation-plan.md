# Plan implementacji widoku Zleceń Transportowych

**Dokumenty źródłowe:** niniejszy plan jest zsynchronizowany z `.ai/prd.md` (wymagania funkcjonalne, sekcja 3.1.2a — widok główny), `.ai/ui-plan.md` (architektura UI, komponenty, przepływy) oraz `.ai/api-plan.md` (endpointy REST, parametry, struktury odpowiedzi).

---

## 1. Przegląd

Widok zleceń transportowych to główny ekran aplikacji, dostępny po zalogowaniu. Obejmuje pełną funkcjonalność planistyczną: przeglądanie listy zleceń w trzech zakładkach (Aktualne, Zrealizowane, Anulowane), filtrowanie, sortowanie, tworzenie nowych zleceń, edycję w panelu bocznym (drawer), generowanie PDF, wspomaganie wysyłki maila, zmianę statusów, przeglądanie historii zmian oraz synchronizację danych słownikowych z ERP.

**Statusy:** W UI używane są **pełne nazwy** statusów (bez skrótów): Robocze, Wysłane, Korekta, Korekta wysłane, Zrealizowane, Reklamacja, Anulowane. Wyświetlanie w tabeli i badge: `statusName` z API. **Mapowanie widoków:** zakładka Aktualne (CURRENT) = Robocze, Wysłane, Korekta, Korekta wysłane, Reklamacja; Zrealizowane (COMPLETED) = tylko Zrealizowane; Anulowane (CANCELLED) = tylko Anulowane. **Przywracanie:** POST `/restore` zawsze ustawia status na Korekta (serwer); z Anulowane dozwolone tylko gdy &lt; 24 h od anulowania.

Widok realizuje historyjki: US-001, US-010–US-013, US-020–US-028, US-030–US-032, US-040–US-042, US-050–US-051, US-070–US-071, US-080–US-081.

Stos: Astro 5 (SSR) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (styl New York, Lucide icons). Backend API jest już zaimplementowany — endpointy w `src/pages/api/v1/`, serwisy w `src/lib/services/`, typy w `src/types.ts`.

---

## 2. Routing widoku

| Ścieżka | Plik Astro | Opis |
|---|---|---|
| `/` | `src/pages/index.astro` | Ekran logowania (lub redirect na `/orders` jeśli zalogowany) |
| `/orders` | `src/pages/orders.astro` | Widok główny — lista zleceń z drawerem, filtrami i panelami |

Strona `/orders` renderuje pojedynczą wyspę React (`<OrdersApp client:load />`), która zarządza całym stanem UI (zakładki, filtry, drawer, historia) bez przeładowywania strony. Nawigacja `/` ↔ `/orders` przez przekierowania Astro na poziomie middleware/strony.

---

## 3. Struktura komponentów

```
OrdersApp (React island — korzenny komponent)
├── AuthProvider
│   └── DictionaryProvider
│       ├── AppHeader
│       │   ├── OrderTabs          ← zakładki w nagłówku
│       │   ├── SyncButton
│       │   └── UserInfo           ← bez avatara: imię i nazwisko, rola (tekst), Wyloguj
│       └── OrdersPage
│           ├── (OrderTabs przeniesione do AppHeader)
│           ├── FilterBar
│           │   ├── TransportTypeFilter
│           │   ├── AutocompleteFilter (×4: przewoźnik, towar, załadunek, rozładunek)
│           │   ├── WeekNumberFilter (pole tekstowe, mapowanie na dateFrom/dateTo)
│           │   ├── SearchInput
│           │   └── ClearFiltersButton
│           ├── ListSettings
│           │   ├── PageSizeSelector
│           │   └── ViewModeToggle
│           ├── OrderTable
│           │   ├── OrderTableHeader (sortowalne kolumny)
│           │   └── OrderRow (×N)
│           │       ├── StatusBadge
│           │       ├── TransportTypeBadge
│           │       ├── RouteSummaryCell
│           │       ├── LockIndicator
│           │       └── SendEmailButton
│           ├── AddOrderButton
│           ├── EmptyState
│           ├── OrderRowContextMenu
│           │   └── StatusChangeSubmenu
│           ├── OrderDrawer
│           │   ├── DrawerHeader
│           │   ├── OrderForm
│           │   │   ├── HeaderSection
│           │   │   ├── PartiesSection
│           │   │   │   └── AutocompleteField (×3)
│           │   │   ├── CargoSection
│           │   │   │   └── ItemList
│           │   │   │       └── ItemRow (×N)
│           │   │   ├── RouteSection
│           │   │   │   └── RoutePointList
│           │   │   │       └── RoutePointCard (×N)
│           │   │   ├── FinanceSection
│           │   │   ├── DocumentsSection
│           │   │   └── StatusChangeSection
│           │   └── DrawerFooter
│           ├── HistoryPanel
│           │   ├── HistoryHeader
│           │   ├── TimelineGroup (×N)
│           │   │   └── TimelineEntry (×N)
│           │   │       └── UserAvatar
│           │   └── HistoryFooter
│           ├── UnsavedChangesDialog
│           ├── ComplaintReasonDialog
│           ├── ConfirmDialog
│           ├── StatusFooter          ← pasek stopki ze statystykami
│           └── ToastContainer
```

---

## 4. Szczegóły komponentów

### 4.1 OrdersApp

- **Opis**: Komponent korzenny montowany jako wyspa React w stronie Astro `/orders`. Opakowuje całą aplikację w providery (Auth, Dictionary). Przekazuje token Supabase z cookie/localStorage do kontekstu.
- **Główne elementy**: `<AuthProvider>` → `<DictionaryProvider>` → `<AppHeader />` + `<OrdersPage />`
- **Obsługiwane interakcje**: Brak bezpośrednich — deleguje do dzieci.
- **Walidacja**: Brak.
- **Typy**: `AuthMeDto`, `DictionaryState`
- **Propsy**: `initialToken?: string` (opcjonalnie token JWT z Astro SSR)

### 4.2 AppHeader

- **Opis**: Sticky nagłówek aplikacji (`h-14`) z logo, tytułem (UPPERCASE), zakładkami widoków, przyciskiem synchronizacji i blokiem użytkownika. Zgodnie z PRD 3.1.2a i ui-plan: **BEZ avatara i zdjęcia użytkownika**.
- **Główne elementy**: `<header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 h-14 sticky top-0 z-50 flex items-center justify-between px-4">`, `<OrderTabs />` (w środku nagłówka), `<SyncButton />`, `<UserInfo />`
- **Styl nagłówka**:
  - **Logo**: `w-8 h-8 bg-primary rounded` z białą ikoną (np. Lucide `Truck` lub Material `local_shipping`)
  - **Tytuł**: `font-bold tracking-tight text-slate-800 dark:text-slate-100 uppercase text-sm` (np. „ZLECENIA TRANSPORTOWE")
  - **Zakładki** (w środku nagłówka): `bg-slate-100 dark:bg-slate-800 rounded-lg p-1`
    - Aktywna: `bg-white dark:bg-slate-900 shadow-sm text-primary font-semibold`
    - Nieaktywna: `text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300`
  - **UserInfo (prawa strona)**: **BEZ avatara**. Layout:
    ```html
    <div class="flex items-center gap-3">
      <div class="text-right">
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">{fullName}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">{role}</div>
      </div>
      <button class="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
        Wyloguj
      </button>
    </div>
    ```
    - **Wiersz 1**: imię i nazwisko (`fullName`)
    - **Wiersz 2**: rola zwykłym tekstem — „Admin", „Planner" lub „Read only"
    - **Przycisk Wyloguj**: po prawej od bloku imienia i roli
- **Obsługiwane interakcje**:
  - Klik „Aktualizuj dane" → `POST /api/v1/dictionary-sync/run`, polling `GET /dictionary-sync/jobs/{jobId}`
  - Klik „Wyloguj" → Supabase `signOut()`, redirect na `/`
- **Walidacja**: Brak.
- **Typy**: `AuthMeDto`, `DictionarySyncResponseDto`, `DictionarySyncJobDto`
- **Propsy**: Brak (korzysta z `useAuth()` i `useDictionarySync()`)

### 4.3 SyncButton

- **Opis**: Przycisk „Aktualizuj dane" z obsługą stanu ładowania. Widoczny tylko dla ról ADMIN i PLANNER.
- **Główne elementy**: shadcn `<Button>` z ikoną `RefreshCw` (Lucide), spinner podczas synchronizacji.
- **Obsługiwane interakcje**:
  - Klik → wywołuje `startSync()` z hooka `useDictionarySync`
  - Podczas synchronizacji: disabled + tekst „Synchronizacja..."
  - Po zakończeniu: toast sukcesu/błędu
- **Walidacja**: Brak.
- **Typy**: `DictionarySyncCommand`, `DictionarySyncResponseDto`, `DictionarySyncJobDto`
- **Propsy**: Brak (korzysta z hooków)

### 4.4 OrderTabs

- **Opis**: Trzy zakładki przełączające widok listy: Aktualne, Zrealizowane, Anulowane. Umieszczone wewnątrz `AppHeader` (nie nad tabelą).
- **Główne elementy**: `<nav class="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">` z przyciskami. Aktywna: `bg-white shadow-sm text-primary font-semibold`, nieaktywna: `text-slate-500 hover:text-slate-700`.
- **Obsługiwane interakcje**: Klik na zakładkę → zmiana `view` w stanie filtrów → nowe zapytanie GET `/orders`.
- **Walidacja**: Brak.
- **Typy**: `ViewGroup`
- **Propsy**:
  ```ts
  interface OrderTabsProps {
    activeView: ViewGroup;
    onViewChange: (view: ViewGroup) => void;
  }
  ```

### 4.5 FilterBar

- **Opis**: Pasek filtrów pod nagłówkiem (sticky razem z nagłówkiem tabeli), oddzielony `border-t`, tło `bg-slate-50 dark:bg-slate-900`. **Kolejność filtrów** zgodnie z PRD 3.1.2a i testowym HTML:
  1. Rodzaj transportu (select)
  2. Status (select)
  3. Firma załadunku (autocomplete)
  4. Firma rozładunku (autocomplete)
  5. Firma transportowa (autocomplete)
  6. Towar (autocomplete)
  7. Numer tygodnia (input text)
  8. Wyszukiwanie pełnotekstowe (input text)
  9. Przycisk „Wyczyść filtry"
  10. **Z prawej (`ml-auto`)**: Ustawienia listy (rozmiar strony, przełącznik Trasa|Kolumny) + przycisk „Nowe zlecenie"
- **Layout**: `<div class="px-4 py-2 border-t bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center gap-2">`
- **Przycisk "Nowe zlecenie"**: widoczny **tylko** w zakładce Aktualne, **tylko** dla ról Admin/Planner; styl: `bg-emerald-600 text-white hover:bg-emerald-700`
- **Nazwy filtrów**: spójne z nazwami kolumn tabeli (np. filtr "Firma załadunku" odpowiada kolumnie "Miejsce załadunku")
- **Główne elementy**: `<div class="px-4 py-2 border-t bg-slate-50 flex flex-wrap items-center gap-2">` z polami:
  - **Rodzaj transportu** — select (lista zamknięta); wyświetlanie np. „kraj".
  - **Status** — select (lista zamknięta); jeden status z listy (robocze, wysłane, korekta, korekta wysłane, zrealizowane, reklamacja, anulowane).
  - **Firma załadunku** — autocomplete; użytkownik może wybrać **firmę** (→ `loadingCompanyId`) lub **konkretną lokalizację** (→ `loadingLocationId`); zwraca zlecenia, gdzie firma/lokalizacja występuje na dowolnym miejscu załadunku (L1…L8).
  - **Firma rozładunku** — autocomplete; analogicznie → `unloadingCompanyId` lub `unloadingLocationId`; filtruje po dowolnym miejscu rozładunku (U1…U3).
  - **Firma transportowa** — autocomplete (przewoźnik → `carrierId`).
  - **Towar** — autocomplete ze słownika towarów (→ `productId`).
  - **Numer tygodnia** — pole tekstowe (wpis ręczny, np. „07" lub „2026-07"); frontend mapuje na `dateFrom`/`dateTo` (ISO week → poniedziałek–niedziela) przed wysłaniem zapytania do API.
  - **Wyszukiwanie pełnotekstowe** — pole tekstowe; wyszukiwane tylko wiersze zawierające podaną kombinację słów (np. „Gorzyce 15t").
  - Przycisk „Wyczyść filtry".
  - Z prawej (`ml-auto`): przycisk „Nowe zlecenie" (`bg-emerald-600 text-white`) — tylko w zakładce Aktualne, tylko dla Admin/Planner.
- **Obsługiwane interakcje**:
  - Zmiana wartości filtra → debounce 300ms na polach tekstowych/autocomplete → aktualizacja stanu filtrów → nowe zapytanie GET
  - Klik „Wyczyść filtry" → reset wszystkich filtrów do wartości domyślnych
- **Walidacja**:
  - `dateFrom` ≤ `dateTo` (jeśli API używa zakresu dat)
  - Wartości autocomplete muszą być z listy słownikowej (UUID)
- **Typy**: `OrderListFilters`, `CompanyDto`, `LocationDto`, `ProductDto`, `TransportTypeDto`, `OrderStatusDto`
- **Propsy**:
  ```ts
  interface FilterBarProps {
    filters: OrderListFilters;
    onFiltersChange: (filters: Partial<OrderListFilters>) => void;
    onClearFilters: () => void;
    showAddButton: boolean;  // tylko Aktualne + Admin/Planner
  }
  ```

### 4.6 AutocompleteFilter

- **Opis**: Pole filtra z podpowiedzią (autocomplete) oparte na danych słownikowych. Wyszukuje po wpisaniu ≥ 2 znaków z debounce 300ms.
- **Główne elementy**: shadcn `<Popover>` + `<Command>` (`<CommandInput>`, `<CommandList>`, `<CommandItem>`, `<CommandEmpty>`).
- **Obsługiwane interakcje**:
  - Wpisanie tekstu → filtrowanie listy słownikowej po stronie klienta (dane załadowane globalnie)
  - Wybór pozycji → ustawienie `id` (UUID) w filtrze
  - Klik X → wyczyszczenie filtra
- **Walidacja**: Wartość musi być UUID z listy słownikowej lub pusta.
- **Typy**: `CompanyDto | LocationDto | ProductDto` (generyczne)
- **Propsy**:
  ```ts
  interface AutocompleteFilterProps<T> {
    label: string;
    placeholder: string;
    items: T[];
    value: string | undefined;  // selected UUID
    displayField: keyof T;
    searchFields: (keyof T)[];
    onChange: (id: string | undefined) => void;
  }
  ```

### 4.7 ListSettings

- **Opis**: Ustawienia listy w **tym samym wierszu co pasek filtrów** (z prawej): rozmiar strony (50 / 100 / 200) oraz przełącznik widoku tabeli **Trasa | Kolumny**. Zgodnie z PRD 3.1.2a.
- **Główne elementy**: shadcn `<Select>` (pageSize: 50, 100, 200), shadcn `<ToggleGroup>` lub przyciski (viewMode: Trasa | Kolumny).
- **Obsługiwane interakcje**:
  - Zmiana pageSize → nowe zapytanie GET
  - Zmiana viewMode → przebudowa kolumn tabeli (bez nowego zapytania)
- **Walidacja**: pageSize ∈ {50, 100, 200}
- **Typy**: `ListViewMode`, `PageSize`
- **Propsy**:
  ```ts
  interface ListSettingsProps {
    pageSize: number;
    viewMode: ListViewMode;
    onPageSizeChange: (size: number) => void;
    onViewModeChange: (mode: ListViewMode) => void;
  }
  ```

### 4.8 OrderTable

- **Opis**: Tabela z listą zleceń. Pełna definicja kolumn, kolejności i formatu wyświetlania — **PRD sekcja 3.1.2a** oraz ui-plan. Minimalna szerokość tabeli 1280px; nagłówek tabeli oraz kolumna Akcje (z prawej) są sticky; przewija się wyłącznie ciało tabeli. Na wąskich ekranach tabela przewija się w poziomie z **widocznym** paskiem przewijania u dołu.
- **Główne elementy**:
  - **Kontener z przewijaniem**: `<div class="overflow-x-auto">` (wrapper)
  - **Tabela**: `<table class="w-full border-collapse text-left min-w-[1280px]" role="table">`
    - Min-width 1280px zapewnia, że tabela nie skurczy się zbyt mocno
    - Na wąskich ekranach (< 1280px) pojawi się poziomy scrollbar
  - **Nagłówek tabeli (sticky)**: `<thead class="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b z-10">`
    - Nagłówki: `text-[11px] font-bold uppercase tracking-wider text-slate-500`
    - Sortowanie z `aria-sort` (ascending/descending/none)
  - **Ciało tabeli**: `<tbody class="divide-y divide-slate-100 dark:divide-slate-800">`
    - Wiersze: `<OrderRow>` × N
    - Separator między wierszami: `divide-y divide-slate-100`
  - **Kolumna Akcje (sticky right)**:
    - `<th>/<td>` z klasami: `sticky right-0 bg-white dark:bg-slate-900`
    - Cień: `shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]` (cień po lewej stronie kolumny)
  - **Scrollbar**:
    - **Na wąskich ekranach** (< 1280px): scrollbar **musi być widoczny** (domyślne zachowanie, nie ukrywamy)
    - **Na szerokich ekranach** (≥ 1280px): scrollbar może być ukryty (`.scrollbar-hide` opcjonalnie, do decyzji implementacyjnej)
- **Widok Kolumny (PRD 3.1.2a)**: Blokada (ikona, bez etykiety) | Nr zlecenia | Status | Rodzaj transportu | Miejsce załadunku (każdy punkt w nowej linii: L1 NazwaFirmy: oddział X) | Miejsce rozładunku (U1…) | Data załadunku (lista dat z godzinami) | Data rozładunku | Towar (pozycje numerowane + „Razem: Xt") | Komentarz | Firma transportowa | Typ auta (rodzaj + objętość, np. „firanka (90m³)") | Stawka | Data wysłania zlecenia (linia 1: imię i nazwisko, linia 2: data bez godziny) | Akcje.
- **Widok Trasa**: Zamiast kolumn Miejsce załadunku i Miejsce rozładunku — jedna kolumna **Trasa** (node-string, np. L1:KRK → L2:KAT → U1:BER); osobne kolumny Data załadunku i Data rozładunku; pozostałe kolumny jak wyżej.
- **Sortowanie**: Domyślnie `sortBy: FIRST_LOADING_DATETIME`, `sortDirection: ASC`. Sortowalne kolumny: data załadunku, data rozładunku, numer zlecenia, Firma transportowa (api-plan: `sortBy`: FIRST_LOADING_DATETIME | FIRST_UNLOADING_DATETIME | ORDER_NO | CARRIER_NAME).
- **Styl hover**: `tr:hover td { background-color: rgba(19, 127, 236, 0.04) !important; }` (global CSS)
- **Obsługiwane interakcje**:
  - Klik na nagłówek kolumny → zmiana `sortBy`/`sortDirection` → nowe zapytanie GET
  - Lewy klik na wiersz → otwarcie draweru (z lockiem)
  - Prawy klik na wiersz → menu kontekstowe (na razie tylko prawy klik, bez skrótu klawiaturowego — PRD 3.1.2a)
- **Typy**: `OrderListItemDto[]`, `OrderSortBy`, `SortDirection`, `ListViewMode`
- **Propsy**:
  ```ts
  interface OrderTableProps {
    orders: OrderListItemDto[];
    sortBy: OrderSortBy;
    sortDirection: SortDirection;
    viewMode: ListViewMode;
    isLoading: boolean;
    onSort: (sortBy: OrderSortBy) => void;
    onRowClick: (orderId: string) => void;
    onRowContextMenu: (orderId: string, event: React.MouseEvent) => void;
  }
  ```

### 4.9 OrderRow

- **Opis**: Pojedynczy wiersz tabeli zleceń. Kompaktowy (`py-1 px-4 text-[12px]`), tło wg statusu (jaśniejszy odcień koloru statusu). Zawartość kolumn i format zgodnie z **PRD 3.1.2a**.
- **Główne elementy** (widok Kolumny): `<tr class={getRowBgClass(statusCode)} role="row">` z:
  - **(bez etykiety)** `<LockIndicator>` — ikona blokady tylko gdy zlecenie zablokowane przez innego użytkownika (`lockedByUserId !== null && lockedByUserId !== currentUserId`)
  - **Nr zlecenia** — np. ZT-2026-0042; styl: `text-[12px] font-medium`
  - **StatusBadge** — pełna nazwa statusu (`statusName` z API), np. "Wysłane", "Robocze"
  - **Tydzień** — numer tygodnia ISO 8601 (`order.weekNumber` z API), wyświetlany jako liczba całkowita (np. `7`); pole obliczane automatycznie przez backend, **nie edytowalne**; styl: `text-[12px]`
  - **Rodzaj transportu** — nazwa (np. "eksport drogowy"); styl: `text-[12px]`
  - **Miejsce załadunku** — każdy punkt w osobnym bloku `<div class="space-y-2">`:
    - `<div class="space-y-1">`:
      - **Wiersz 1**: `<div class="flex items-center gap-1.5">` z okrągłym badge'm:
        ```html
        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">L{n}</span>
        <span class="font-medium">{companyName}</span>
        ```
      - **Wiersz 2**: `<div class="text-[11px] text-slate-500 pl-6">{locationName}</div>` (np. "oddział Kraków")
  - **Data załadunku** — lista dat z godzinami dla każdego punktu załadunku (dane z `order.stops`):
    ```html
    <div class="flex items-center gap-1.5">
      <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">L{n}</span>
      <span class="whitespace-nowrap">{dateLocal} {timeLocal}</span>
    </div>
    ```
    **Format daty: DD.MM.YYYY HH:MM** (backend zwraca YYYY-MM-DD + HH:MM:SS, frontend formatuje przez `formatDate()` i `formatTime()`)
  - **Miejsce rozładunku** — każdy punkt w osobnym bloku `<div class="space-y-2">`:
    - `<div class="space-y-1">`:
      - **Wiersz 1**: `<div class="flex items-center gap-1.5">` z okrągłym badge'm:
        ```html
        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">U{n}</span>
        <span class="font-medium">{companyName}</span>
        ```
      - **Wiersz 2**: `<div class="text-[11px] text-slate-500 pl-6">{locationName}</div>` (np. "oddział Berlin")
  - **Data rozładunku** — lista dat z godzinami dla każdego punktu rozładunku (analogicznie do daty załadunku); **format: DD.MM.YYYY HH:MM**
  - **Towar** — pozycje numerowane z `order.items`:
    ```html
    <div class="space-y-0.5">
      <div class="text-[11px] whitespace-nowrap">1. {productNameSnapshot} ({quantityTons}t, {loadingMethodCode})</div>
      <div class="text-[11px] whitespace-nowrap">2. ...</div>
      <div class="text-[10px] text-slate-500 font-semibold">Razem: {sumaTon}t</div>
    </div>
    ```
  - **Komentarz** — lista ponumerowana uwag z `order.items[].notes` (powiązana z pozycjami towaru); jeśli brak — puste pole; styl: `text-[11px] text-slate-500`
  - **Firma transportowa** — **tylko nazwa firmy** (`carrierName` z API), **bez** osoby kontaktowej i telefonu; styl: `text-[12px]`
  - **Typ auta** — `vehicleVariantName` + objętość w nawiasie (`vehicleCapacityVolumeM3`), np. „firanka (90m³)"; styl: `text-[12px]`
  - **Stawka** — `priceAmount` + `currencyCode` (np. "1450 PLN"); styl: `text-[12px] font-medium`
  - **Data wysłania zlecenia** — dwulinijkowa:
    ```html
    <div class="space-y-0.5">
      <div class="text-[11px]">{sentByUserName}</div>
      <div class="text-[10px] text-slate-500">{sentAt formatted DD.MM.YYYY}</div>
    </div>
    ```
    **Format daty: DD.MM.YYYY** (bez godziny; backend zwraca timestamptz, frontend formatuje)
  - **Akcje** — sticky right, przycisk/ikona „Wyślij maila" (ikona Material: `mail_outline` lub Lucide `Mail`)
- **Widok Trasa**: zamiast czterech kolumn (Miejsce załadunku, Data załadunku, Miejsce rozładunku, Data rozładunku) używa:
  - **Kolumna "Trasa"** — `<RouteSummaryCell>` (node-string, np. `L1:Nord → L2:Recykling → U1:BER`; max 4 węzły w linii, kolejne węzły zawijają się do nowej linii w grupach po 4)
  - **Kolumna "Data załadunku"** — **tylko PIERWSZA** data załadunku (L1) z okrągłym badge'em `L1` (emerald, `w-5 h-5 rounded-full`), format DD.MM.YYYY HH:MM. Jeśli brak daty — `—`.
  - **Kolumna "Data rozładunku"** — **tylko PIERWSZA** data rozładunku (U1) z okrągłym badge'em `U1` (primary, `w-5 h-5 rounded-full`), format DD.MM.YYYY HH:MM. Jeśli brak daty — `—`.
  - Pozostałe kolumny (Lock, Nr zlecenia, Status, Tydzień, Rodzaj transportu, Towar, Komentarz, Firma transportowa, Typ auta, Stawka, Data wysłania, Akcje) — identyczne jak w widoku Kolumny
- **Mapowanie tła wiersza wg statusu** (statusCode/statusName z API; w UI pełna nazwa):
  - Robocze: `bg-white`, Wysłane: `bg-blue-50/30`, Korekta: `bg-orange-50/30`, Korekta wysłane: `bg-teal-50/30`, Zrealizowane: `bg-green-50/30`, Anulowane: `bg-gray-50/50`, Reklamacja: `bg-red-50/30`
- **Obsługiwane interakcje**:
  - Lewy klik → `onRowClick(orderId)`
  - Prawy klik → `onRowContextMenu(orderId, event)` (menu kontekstowe tylko prawy klik — PRD)
  - Klik ikony „Wyślij maila" → `onSendEmail(orderId)`
- **Typy**: `OrderListItemDto` (z tablicami `stops` i `items`, polami `sentByUserName`, `sentAt`, `vehicleCapacityVolumeM3`), `ListViewMode`
- **Propsy**:
  ```ts
  interface OrderRowProps {
    order: OrderListItemDto;
    viewMode: ListViewMode;
    onRowClick: (orderId: string) => void;
    onRowContextMenu: (orderId: string, event: React.MouseEvent) => void;
    onSendEmail: (orderId: string) => void;
  }
  ```

### 4.10 StatusBadge

- **Opis**: Badge statusu zlecenia z mapowaniem koloru. **BEZ animacji pulse**. Styl base: `inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full`.
- **Główne elementy**: `<span>` z pełną nazwą statusu (`statusName`), bez ikony pulsowania, bez klasy `animate-pulse`.
- **Mapowanie kolorów** (wyświetlana pełna nazwa z `statusName`):
  - **Robocze** → `bg-slate-100 text-slate-700` **(BEZ border)**
  - **Wysłane** → `bg-blue-50 text-blue-600 border border-blue-200`
  - **Korekta** → `bg-orange-50 text-orange-600 border border-orange-200`
  - **Korekta wysłane** → `bg-amber-50 text-amber-700 border border-amber-200`
  - **Zrealizowane** → `bg-emerald-50 text-emerald-700 border border-emerald-200`
  - **Anulowane** → `bg-slate-100 text-slate-500 border border-slate-200` **(z borderem, inaczej niż Robocze)**
  - **Reklamacja** → `bg-red-50 text-red-600 border border-red-200`
- **Implementacja**:
  ```tsx
  function StatusBadge({ statusCode, statusName }: StatusBadgeProps) {
    const baseClass = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full";
    const colorMap = {
      ROBOCZE: "bg-slate-100 text-slate-700",
      WYSLANE: "bg-blue-50 text-blue-600 border border-blue-200",
      KOREKTA: "bg-orange-50 text-orange-600 border border-orange-200",
      KOREKTA_WYSLANE: "bg-amber-50 text-amber-700 border border-amber-200",
      ZREALIZOWANE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      ANULOWANE: "bg-slate-100 text-slate-500 border border-slate-200",
      REKLAMACJA: "bg-red-50 text-red-600 border border-red-200",
    };
    return <span className={`${baseClass} ${colorMap[statusCode]}`}>{statusName}</span>;
  }
  ```
- **Propsy**:
  ```ts
  interface StatusBadgeProps {
    statusCode: OrderStatusCode;  // do mapowania koloru
    statusName: string;           // pełna nazwa do wyświetlenia (Robocze, Wysłane, …)
  }
  ```

### 4.11 OrderRowContextMenu

- **Opis**: Menu kontekstowe wyświetlane po prawym kliku na wierszu. Opcje zależą od statusu zlecenia i roli użytkownika.
- **Główne elementy**: shadcn `<ContextMenu>` (lub `<DropdownMenu>` pozycjonowane programatycznie) z `<ContextMenuItem>` i `<ContextMenuSub>` dla statusu.
- **Obsługiwane interakcje**:
  - „Wyślij maila" → `POST /orders/{id}/prepare-email`
  - „Historia zmian" → otwarcie `<HistoryPanel>`
  - „Zmień status" → podmenu z dozwolonymi przejściami (z `ALLOWED_MANUAL_STATUS_TRANSITIONS`)
  - „Skopiuj zlecenie" → `POST /orders/{id}/duplicate` (etap 2)
  - „Anuluj zlecenie" → modal potwierdzenia → `DELETE /orders/{id}`
  - „Przywróć do aktualnych" → `POST /orders/{id}/restore` (w zakładkach Zrealizowane/Anulowane; po przywróceniu status = Korekta; z Anulowane tylko gdy &lt; 24 h)
- **Walidacja**:
  - Opcje filtrowane na podstawie `statusCode` i dozwolonych przejść (api-plan 2.7)
  - Opcje edycyjne ukryte dla roli READ_ONLY (PRD 3.1.2a)
  - „Przywróć do aktualnych" widoczne tylko w zakładkach COMPLETED/CANCELLED
  - **Reklamacja:** Przy zmianie statusu na reklamacja wymagane pole „Powód reklamacji" (PRD 3.1.2a, api-plan: `complaintReason` przy POST /status). Jeśli użytkownik zamknie okienko/panel bez wpisania powodu, status **nie** zmienia się na reklamacja (zmiana anulowana).
- **Typy**: `OrderListItemDto`, `UserRole`, `ViewGroup`
- **Propsy**:
  ```ts
  interface OrderRowContextMenuProps {
    order: OrderListItemDto;
    activeView: ViewGroup;
    position: { x: number; y: number };
    isOpen: boolean;
    onClose: () => void;
    onSendEmail: (orderId: string) => void;
    onShowHistory: (orderId: string) => void;
    onChangeStatus: (orderId: string, newStatus: OrderStatusCode, complaintReason?: string) => void;
    onDuplicate: (orderId: string) => void;
    onCancel: (orderId: string) => void;
    onRestore: (orderId: string) => void;  // serwer zawsze ustawia status Korekta
  }
  ```

### 4.12 AddOrderButton

- **Opis**: Przycisk „+ Dodaj nowy wiersz" widoczny tylko w zakładce Aktualne i dla ról ADMIN/PLANNER.
- **Główne elementy**: shadcn `<Button>` z ikoną `Plus` (Lucide).
- **Obsługiwane interakcje**: Klik → `POST /api/v1/orders` z domyślnymi wartościami → po sukcesie otwarcie draweru z nowym zleceniem.
- **Walidacja**: Brak (minimalne dane wystarczą do utworzenia draftu).
- **Typy**: `CreateOrderCommand`, `CreateOrderResponseDto`
- **Propsy**:
  ```ts
  interface AddOrderButtonProps {
    onOrderCreated: (orderId: string) => void;
  }
  ```

### 4.13 OrderDrawer

- **Opis**: Panel boczny (sheet) wysuwany z prawej strony (~720–800px). Zawiera formularz edycji zlecenia z sekcjami, stopkę z akcjami oraz logikę lock/unlock.
- **Główne elementy**: shadcn `<Sheet>` z `<SheetContent>` (side="right"), `<OrderForm>`, `<DrawerFooter>`.
- **Obsługiwane interakcje**:
  - Otwarcie → `POST /orders/{id}/lock` → `GET /orders/{id}`
  - Zamknięcie → sprawdzenie niezapisanych zmian → `POST /orders/{id}/unlock`
  - Escape / klik backdrop → zamknięcie z ostrzeżeniem
- **Walidacja**: Brak bezpośrednio — deleguje do `<OrderForm>`.
- **Typy**: `OrderDetailResponseDto`, `LockOrderResponseDto`, `UnlockOrderResponseDto`
- **Propsy**:
  ```ts
  interface OrderDrawerProps {
    orderId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onOrderUpdated: () => void;  // odśwież listę po zapisie
  }
  ```

### 4.14 OrderForm

- **Opis**: Formularz edycji zlecenia z **6 sekcjami**: Trasa, Towar, Firma transportowa, Finanse, Uwagi, Zmiana statusu. Etykiety nad polami, siatka kolumn wewnątrz sekcji.
- **Struktura sekcji**:
  - **Sekcja 1 – Trasa**: punkty L1, U1, L2, U2 (i kolejne) w kolejności, każdy punkt to karta z polami: data, godzina, firma (select/autocomplete), lokalizacja (select), adres, uwagi; uchwyt drag-and-drop; przycisk usuń; na dole przyciski „+ Dodaj załadunek" i „+ Dodaj rozładunek".
  - **Sekcja 2 – Towar**: lista pozycji towarowych z polami: nazwa towaru, waga (t), typ załadunku, uwagi; na dole przycisk „+ Dodaj towar"; podsumowanie „Razem: Xt".
  - **Sekcja 3 – Firma transportowa**: nazwa firmy (autocomplete/select), NIP (Input `disabled` — uzupełniany automatycznie), typ pojazdu (Select `vehicleVariantCode`), objętość (Select), dokumenty (Select wielokrotny lub Input).
  - **Sekcja 4 – Finanse**: stawka (Input), waluta (Select PLN/EUR/USD), termin płatności (Input dni), forma płatności (Select).
  - **Sekcja 5 – Uwagi**: `<Textarea>` z licznikiem znaków (max 1000).
  - **Sekcja 6 – Zmiana statusu** (tylko tryb edycji, niewidoczna w trybie readonly): aktualny badge statusu + przyciski zmiany statusu: „Zrealizowane", „Reklamacja", „Anulowane"; nota informacyjna o konsekwencji zmiany.
- **Główne elementy**: `<form>` z sekcjami `<fieldset>`, pola shadcn (`<Input>`, `<Select>`, `<Textarea>`, `<AutocompleteField>`), sekcja trasy `<RouteSection>`, sekcja pozycji `<CargoSection>`.
- **Obsługiwane interakcje**:
  - Zmiana dowolnego pola → aktualizacja lokalnego stanu formularza → flaga `isDirty`
  - Wybór firmy w autocomplete → auto-uzupełnienie powiązanych pól (adres, NIP)
- **Walidacja techniczna** (przy zapisie):
  - `transportTypeCode` — wymagane (enum PL|EXP|EXP_K|IMP)
  - `currencyCode` — wymagane (enum PLN|EUR|USD)
  - `vehicleVariantCode` — wymagane (string min 1)
  - `priceAmount` — ≥ 0 (jeśli podane)
  - `quantityTons` — ≥ 0 (jeśli podane)
  - `paymentTermDays` — integer ≥ 0 (jeśli podane)
  - `senderContactEmail` — format email (jeśli podane)
  - Daty w formacie YYYY-MM-DD, czasy HH:MM lub HH:MM:SS
  - Max 8 punktów LOADING, max 3 punkty UNLOADING
  - Łańcuchy: `generalNotes` ≤ 1000, `requiredDocumentsText` ≤ 500, `specialRequirements` ≤ 1000, `notes` (na stop/item) ≤ 500
- **Walidacja biznesowa** (przy wysyłce maila — realizowana przez API 422):
  - Wszystkie pola oznaczone (*) w formularzu
- **Typy**: `OrderFormData` (ViewModel), `OrderDetailDto`, `OrderDetailStopDto[]`, `OrderDetailItemDto[]`, `UpdateOrderCommand`
- **Propsy**:
  ```ts
  interface OrderFormProps {
    order: OrderDetailDto;
    stops: OrderDetailStopDto[];
    items: OrderDetailItemDto[];
    isReadOnly: boolean;
    onSave: (data: UpdateOrderCommand) => Promise<void>;
    onDirtyChange: (isDirty: boolean) => void;
  }
  ```

### 4.15 AutocompleteField

- **Opis**: Pole formularza z podpowiedzią z danych słownikowych. Debounce 300ms, wyświetla dopasowania po ≥ 2 znakach. Wybór uzupełnia powiązane pola.
- **Główne elementy**: shadcn `<Popover>` + `<Command>` z `<CommandInput>`, `<CommandList>`, `<CommandItem>`.
- **Obsługiwane interakcje**:
  - Wpisanie ≥ 2 znaków → filtrowanie danych słownikowych (klient)
  - Wybór pozycji → ustawienie ID + auto-uzupełnienie powiązanych pól (callback)
  - Wyczyszczenie → reset ID i powiązanych pól
- **Walidacja**: Wybrana wartość musi mieć UUID z listy słownikowej.
- **Typy**: generyczny `T extends { id: string; name: string }`
- **Propsy**:
  ```ts
  interface AutocompleteFieldProps<T> {
    label: string;
    placeholder: string;
    items: T[];
    value: string | null;  // selected UUID
    displayValue: string | null;  // tekst wyświetlany
    searchFields: (keyof T)[];
    onSelect: (item: T | null) => void;
    required?: boolean;
    error?: string;
    disabled?: boolean;
  }
  ```

### 4.16 RoutePointList

- **Opis**: Lista punktów trasy z możliwością dodawania, usuwania i zmiany kolejności (drag-and-drop + przyciski góra/dół).
- **Główne elementy**: `<div>` z `<RoutePointCard>` × N, przycisk „Dodaj załadunek", przycisk „Dodaj rozładunek". Użycie `@dnd-kit/core` + `@dnd-kit/sortable` dla drag-and-drop.
- **Obsługiwane interakcje**:
  - „Dodaj miejsce załadunku" → nowy punkt LOADING (jeśli < 8)
  - „Dodaj miejsce rozładunku" → nowy punkt UNLOADING (jeśli < 3)
  - Drag-and-drop / góra/dół → zmiana `sequenceNo`
  - „Usuń punkt" → usunięcie (lub `_deleted: true` dla istniejących)
- **Walidacja**:
  - Max 8 punktów LOADING
  - Max 3 punkty UNLOADING
  - Min 1 LOADING + 1 UNLOADING (walidacja biznesowa — przy wysyłce)
- **Typy**: `OrderFormStop[]` (ViewModel), `StopKind`
- **Propsy**:
  ```ts
  interface RoutePointListProps {
    stops: OrderFormStop[];
    onChange: (stops: OrderFormStop[]) => void;
    disabled?: boolean;
    errors?: Record<string, string>;
  }
  ```

### 4.17 RoutePointCard

- **Opis**: Karta pojedynczego punktu trasy: badge typ (ZAŁADUNEK/ROZŁADUNEK), data, godzina, lokalizacja (autocomplete), adres (readonly po wyborze), uwagi.
- **Główne elementy**: `<div>` z badge typu, `<DatePickerField>`, `<TimePickerField>`, `<AutocompleteField>` (lokalizacja), `<Input>` (adres, readonly), `<Input>` (uwagi), przycisk „Usuń", uchwyty drag + przyciski góra/dół.
- **Obsługiwane interakcje**:
  - Zmiana daty/godziny → aktualizacja stanu
  - Wybór lokalizacji → auto-uzupełnienie adresu z `LocationDto`
  - Klik „Usuń" → usunięcie/zaznaczenie do usunięcia
  - Drag handle / góra/dół → zmiana kolejności
- **Walidacja**:
  - Data w formacie YYYY-MM-DD (jeśli podana)
  - Godzina w formacie HH:MM (jeśli podana)
- **Typy**: `OrderFormStop`, `LocationDto`
- **Propsy**:
  ```ts
  interface RoutePointCardProps {
    stop: OrderFormStop;
    index: number;
    totalCount: number;
    onChange: (stop: OrderFormStop) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    disabled?: boolean;
    errors?: Record<string, string>;
  }
  ```

### 4.18 ItemList (CargoSection)

- **Opis**: Lista edytowalnych pozycji towarowych (products) w zleceniu.
- **Główne elementy**: Lista `<ItemRow>` × N, przycisk „Dodaj pozycję".
- **Obsługiwane interakcje**:
  - „Dodaj pozycję" → nowy wiersz z pustymi polami
  - Zmiana towaru (autocomplete) → auto-uzupełnienie `defaultLoadingMethodSnapshot` i ustawienie `loadingMethodCode` na wartość domyślną z produktu
  - Zmiana sposobu załadunku (select `loadingMethodCode`) → nadpisanie domyślnej wartości
  - „Usuń pozycję" → usunięcie/zaznaczenie `_deleted`
- **Walidacja**:
  - `quantityTons` ≥ 0 (jeśli podane)
  - Min 1 pozycja z nazwą i ilością (walidacja biznesowa — przy wysyłce)
- **Typy**: `OrderFormItem[]`, `ProductDto`
- **Propsy**:
  ```ts
  interface ItemListProps {
    items: OrderFormItem[];
    onChange: (items: OrderFormItem[]) => void;
    disabled?: boolean;
    errors?: Record<string, string>;
  }
  ```

### 4.19 DrawerFooter

- **Opis**: Sticky stopka draweru z przyciskami akcji. Zawartość zależy od trybu (edycja vs. readonly).
- **Tryb edycji** (`isReadOnly: false`):
  - Lewa strona: Generuj PDF (ghost), Wyślij maila (ghost z ikoną Mail), Historia zmian (ghost)
  - Prawa strona: Zamknij (outline), Zapisz (primary)
- **Tryb readonly** (`isReadOnly: true`):
  - Lewa strona: Generuj PDF (ghost), Historia zmian (ghost)
  - Prawa strona: Zamknij (outline)
  - **BEZ** „Wyślij maila" i **BEZ** „Zapisz"
- **Banner lock (readonly)**: Nad stopką (lub na górze contentu) wyświetlany jest bursztynowy (amber) pasek: „Zlecenie edytowane przez {userName}" — informuje, że zlecenie jest zablokowane przez innego użytkownika.
- **Obsługiwane interakcje**:
  - „Zapisz" → walidacja techniczna → `PUT /orders/{id}` → toast sukcesu
  - „Zamknij" → zamknięcie draweru (z ostrzeżeniem jeśli dirty w trybie edycji)
  - „Generuj PDF" → `POST /orders/{id}/pdf` → pobranie pliku
  - „Wyślij maila" → `POST /orders/{id}/prepare-email` → otwarcie `mailto:` URL / wyświetlenie 422
  - „Historia zmian" → otwarcie panelu `<HistoryPanel>`
- **Walidacja**: Brak bezpośrednio — deleguje do handlera.
- **Propsy**:
  ```ts
  interface DrawerFooterProps {
    isReadOnly: boolean;
    isSaving: boolean;
    isDirty: boolean;
    lockedByUserName?: string;  // jeśli podane → wyświetl banner lock
    onSave: () => void;
    onClose: () => void;
    onGeneratePdf: () => void;
    onSendEmail: () => void;
    onShowHistory: () => void;
  }
  ```

### 4.20 HistoryPanel

- **Opis**: Panel z prawej strony (~450px) wyświetlający scaloną oś czasu zmian statusów i pól zlecenia. Wzorowany na `test/code.html`.
- **Główne elementy**: shadcn `<Sheet>` (side="right", width ~450px), `<ScrollArea>`, lista `<TimelineGroup>` z `<TimelineEntry>`.
- **Obsługiwane interakcje**:
  - Otwarcie → równoległe `GET /history/status` + `GET /history/changes` → scalenie i sortowanie
  - Zamknięcie → X / Escape / klik backdrop
- **Walidacja**: Brak (readonly).
- **Typy**: `TimelineEntryViewModel`, `StatusHistoryItemDto`, `ChangeLogItemDto`
- **Propsy**:
  ```ts
  interface HistoryPanelProps {
    orderId: string | null;
    orderNo: string;
    isOpen: boolean;
    onClose: () => void;
  }
  ```

### 4.21 TimelineEntry

- **Opis**: Pojedynczy wpis na osi czasu historii.
- **Główne elementy**: `<div>` z `<UserAvatar>`, etykieta czasu, opis zmiany. Warianty: zmiana statusu (dwa badge'e ze strzałką), zmiana pola (stara/nowa wartość), utworzenie zlecenia (ikona systemu).
- **Propsy**:
  ```ts
  interface TimelineEntryProps {
    entry: TimelineEntryViewModel;
  }
  ```

### 4.22 UnsavedChangesDialog

- **Opis**: Modal potwierdzenia przy próbie zamknięcia draweru z niezapisanymi zmianami.
- **Główne elementy**: shadcn `<AlertDialog>` z komunikatem „Masz niezapisane zmiany. Odrzucić?" i przyciskami „Odrzuć zmiany" / „Wróć do edycji".
- **Propsy**:
  ```ts
  interface UnsavedChangesDialogProps {
    isOpen: boolean;
    onConfirmDiscard: () => void;
    onCancel: () => void;
  }
  ```

### 4.23 Powód reklamacji (panel / modal)

- **Opis**: Przy zmianie statusu na **Reklamacja** wymagane jest podanie powodu reklamacji. Zgodnie z wymaganiami: **panel na dole widoku** z danymi zlecenia (w drawerze lub przy zmianie z listy) z polem „Powód reklamacji"; zapis zmiany statusu na Reklamacja jest zablokowany, dopóki pole nie zostanie wypełnione. W implementacji można użyć modalu (np. `ComplaintReasonDialog`) przy zmianie z menu kontekstowego lub panelu w stopce draweru przy zmianie w sekcji statusu.
- **Główne elementy**: Panel na dole widoku lub shadcn `<Dialog>` z `<Textarea>` i przyciskami „Potwierdź" / „Anuluj".
- **Walidacja**: `complaintReason` niepuste, max 1000 znaków; bez wypełnienia nie można zapisać zmiany na Reklamacja.
- **Propsy** (dla wariantu modalu):
  ```ts
  interface ComplaintReasonDialogProps {
    isOpen: boolean;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
  }
  ```

### 4.24 EmptyState

- **Opis**: Komunikat przy pustej liście wyników. Zgodnie z PRD 3.1.2a i ui-plan: **tylko dwa warianty**. Wariant „Zbyt wiele wyników — zawęź filtry" **nie jest używany**.
- **Główne elementy**: `<div>` z ikoną, tekstem i opcjonalnym przyciskiem CTA.
- **Warianty**:
  - **Brak zleceń** — gdy w danej zakładce nie ma żadnych zleceń; w zakładce Aktualne: przycisk „Dodaj nowy wiersz". Przykład komunikatu: „Brak zleceń w tej zakładce."
  - **Brak wyników dla zastosowanych filtrów** — gdy filtry zwracają pusty zestaw; przycisk „Wyczyść filtry". Przykład: „Brak zleceń spełniających kryteria. Zmień filtry lub wyczyść je."
- **Propsy**:
  ```ts
  interface EmptyStateProps {
    variant: "no_orders" | "no_results";
    activeView: ViewGroup;
    onAddOrder?: () => void;
    onClearFilters?: () => void;
  }
  ```

### 4.25 RouteSummaryCell (Node-String)

- **Opis**: Wizualizacja trasy jako ciągu kompaktowych węzłów połączonych strzałkami. Kluczowy element designu widoku Trasa. Format: `L1:Nord → L2:Recykling → U1:BER`. **Zawijanie**: **Maksymalnie 4 węzły w linii** — węzły grupowane są w chunk'i po 4, każda grupa renderowana w osobnym `<div>` (nie `flex-wrap`).
- **Główne elementy**: `<div class="space-y-1">` z wierszami `<div class="flex items-center space-x-1">` (jeden wiersz = jeden chunk 4 węzłów).
- **Kolorystyka węzłów:**
  - **LOADING (L1, L2, ...)**: `bg-emerald-100 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700`
  - **UNLOADING (U1, U2, ...)**: `bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-primary`
- **Format węzła**: `{L|U}{sequenceNo}:{nazwa_lub_skrót}` — np. `L1:Nord`, `L2:Recykling`, `U1:CentralMet`
- **Layout**: Chunking po 4 węzły — każdy chunk to osobny wiersz `<div class="flex items-center space-x-1">`. **Przykład**: przy 6 węzłach (4L + 2U) układ będzie:
  - Linia 1: L1 → L2 → L3 → L4
  - Linia 2: U1 → U2
- **WAŻNE**: Linia w tle (pseudo-element `::after`) **NIE jest stosowana**. **NIE używamy `flex-wrap`** na jednym kontenerze — zamiast tego jawne chunki w osobnych `<div>`.
- **Implementacja**:
  ```tsx
  function RouteSummaryCell({ stops }: RouteSummaryCellProps) {
    const NODES_PER_LINE = 4;
    const chunks: typeof stops[] = [];
    for (let i = 0; i < stops.length; i += NODES_PER_LINE) {
      chunks.push(stops.slice(i, i + NODES_PER_LINE));
    }
    return (
      <div className="space-y-1">
        {chunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="flex items-center space-x-1">
            {chunk.map((stop, idx) => {
              const globalIndex = chunkIndex * NODES_PER_LINE + idx;
              return (
                <React.Fragment key={globalIndex}>
                  {globalIndex > 0 && <span className="text-slate-300">→</span>}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      stop.kind === "LOADING"
                        ? "bg-emerald-100 border border-emerald-500/30 text-emerald-700"
                        : "bg-primary/10 border border-primary/30 text-primary"
                    }`}
                  >
                    {stop.kind === "LOADING" ? "L" : "U"}
                    {stop.sequenceNo}:{stop.companyNameShort}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  ```
- **Propsy**:
  ```ts
  interface RouteSummaryCellProps {
    stops: Array<{
      kind: StopKind;
      sequenceNo: number;
      companyNameShort: string;  // skrócona nazwa firmy lub skrót miasta (3+ znaków)
    }>;
  }
  ```

### 4.26 StatusFooter

- **Opis**: Pasek stopki sticky na dole ekranu (`h-10`); **zawsze widoczny**, także przy pustej liście. Zgodnie z PRD 3.1.2a i ui-plan: **BEZ** „W trasie", „Załadunek", „Opóźnione" — te liczniki **nie są wyświetlane**.
- **Główne elementy**:
  ```html
  <footer class="h-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 z-50 sticky bottom-0">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-primary"></span>
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">Aktywne: {totalItems}</span>
      </div>
      <!-- Opcjonalnie: liczniki per status -->
    </div>
    <div class="flex items-center gap-4 text-xs text-slate-500">
      <span>System Status: OK</span>
      <span class="border-l border-slate-300 pl-4">Ostatnia aktualizacja: {lastUpdateTime}</span>
    </div>
  </footer>
  ```
- **Lewa strona**: liczniki zleceń:
  - **Podstawowy**: „Aktywne: X" dla bieżącej zakładki (wartość `totalItems` z API)
  - **Opcjonalnie** (do decyzji implementacyjnej): liczniki per status (Robocze: X, Wysłane: Y, Korekta: Z itd.)
  - **WAŻNE**: **NIE wyświetlamy** „W trasie", „Załadunek", „Opóźnione" — te liczniki zostały usunięte z projektu
- **Prawa strona**:
  - „System Status: OK" — stała wartość (w przyszłości może być dynamiczna)
  - „Ostatnia aktualizacja: HH:MM:SS" — czas ostatniego pobrania listy (format `formatTime()`)
- **Dane**: Obliczane z bieżącej listy zleceń (`totalItems` dla zakładki lub zliczanie per status z `statusCounts`).
- **Propsy**:
  ```ts
  interface StatusFooterProps {
    activeView: ViewGroup;
    totalItems: number;        // liczba zleceń w bieżącej zakładce
    statusCounts?: Record<OrderStatusCode, number>;  // opcjonalne liczniki per status
    lastUpdateTime: string | null;  // ISO timestamp lub null
  }
  ```

---

## 5. Typy

### 5.1 Istniejące typy DTO (z `src/types.ts`)

Wszystkie typy DTO są już zdefiniowane i gotowe do użycia:

- **Auth**: `AuthMeDto`, `UserRole`
- **Lista**: `OrderListItemDto`, `OrderListResponseDto` (= `PaginatedResponse<OrderListItemDto>`), `OrderListQueryParams`
- **Szczegóły**: `OrderDetailDto`, `OrderDetailStopDto`, `OrderDetailItemDto`, `OrderDetailResponseDto`
- **Tworzenie**: `CreateOrderCommand`, `CreateOrderResponseDto`
- **Aktualizacja**: `UpdateOrderCommand`, `UpdateOrderStopInput`, `UpdateOrderItemInput`, `UpdateOrderResponseDto`
- **Status**: `ChangeStatusCommand`, `ChangeStatusResponseDto`, `RestoreOrderCommand`
- **Blokada**: `LockOrderResponseDto`, `UnlockOrderResponseDto`
- **Duplikacja**: `DuplicateOrderCommand`, `DuplicateOrderResponseDto`
- **PDF**: `GeneratePdfCommand`
- **Email**: `PrepareEmailCommand`, `PrepareEmailResponseDto`
- **Historia**: `StatusHistoryItemDto`, `ChangeLogItemDto`
- **Słowniki**: `CompanyDto`, `LocationDto`, `ProductDto`, `TransportTypeDto`, `OrderStatusDto`, `VehicleVariantDto`
- **Sync**: `DictionarySyncCommand`, `DictionarySyncResponseDto`, `DictionarySyncJobDto`
- **Błędy**: `ApiErrorResponse`
- **Enumeracje**: `OrderStatusCode`, `ViewGroup`, `TransportTypeCode`, `CurrencyCode`, `StopKind`, `OrderSortBy`, `SortDirection`, `DictionarySyncResource`

### 5.2 Nowe typy ViewModel (do utworzenia)

```ts
/** Tryb widoku listy */
type ListViewMode = "route" | "columns";

/** Stan filtrów listy zleceń (kolejność pól zgodna z PRD 3.1.2a) */
interface OrderListFilters {
  view: ViewGroup;
  transportType?: TransportTypeCode;
  status?: string;             // kod statusu (order_statuses.code) — filtr po jednym statusie; API przyjmuje tablicę, UI wysyła max 1
  carrierId?: string;
  productId?: string;
  loadingLocationId?: string;  // UUID lokalizacji załadunku (L1…L8)
  loadingCompanyId?: string;   // UUID firmy załadunku (gdy użytkownik wybrał firmę bez konkretnej lokalizacji)
  unloadingLocationId?: string; // UUID lokalizacji rozładunku (U1…U3)
  unloadingCompanyId?: string;  // UUID firmy rozładunku
  weekNumber?: string;         // numer tygodnia (np. "07" lub "2026-07") — wpis ręczny; frontend mapuje na dateFrom/dateTo (ISO week → pon–ndz)
  dateFrom?: string;           // YYYY-MM-DD — obliczany z weekNumber lub ustawiany bezpośrednio
  dateTo?: string;
  search?: string;             // wyszukiwanie pełnotekstowe
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  pageSize: number;
}

/** Stan formularza punktu trasy */
interface OrderFormStop {
  id: string | null;           // null = nowy
  kind: StopKind;
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  notes: string | null;
  _deleted: boolean;
}

/** Stan formularza pozycji towarowej */
interface OrderFormItem {
  id: string | null;           // null = nowy
  productId: string | null;
  productNameSnapshot: string | null;
  defaultLoadingMethodSnapshot: string | null;  // snapshot z produktu (readonly, informacyjny)
  loadingMethodCode: string | null;             // aktualny sposób załadunku (nadpisywalny; domyślnie = default z produktu)
  quantityTons: number | null;
  notes: string | null;
  _deleted: boolean;
}

/** Dane formularza zlecenia (lokalny stan draweru) */
interface OrderFormData {
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  priceAmount: number | null;
  paymentTermDays: number | null;
  paymentMethod: string | null;
  totalLoadTons: number | null;
  totalLoadVolumeM3: number | null;
  carrierCompanyId: string | null;
  shipperLocationId: string | null;
  receiverLocationId: string | null;
  vehicleVariantCode: string;
  specialRequirements: string | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  complaintReason: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  stops: OrderFormStop[];
  items: OrderFormItem[];
}

/** Wpis osi czasu historii (scalony ze status + changes) */
interface TimelineEntryViewModel {
  id: string;
  type: "status_change" | "field_change" | "order_created";
  changedAt: string;           // ISO timestamp
  changedByUserName: string | null;
  changedByUserId: string;
  // Dla status_change:
  oldStatusCode?: string | null;
  newStatusCode?: string | null;
  // Dla field_change:
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

/** Stan globalny słowników */
interface DictionaryState {
  companies: CompanyDto[];
  locations: LocationDto[];
  products: ProductDto[];
  transportTypes: TransportTypeDto[];
  orderStatuses: OrderStatusDto[];
  vehicleVariants: VehicleVariantDto[];
  isLoading: boolean;
  error: string | null;
}

/** Stan kontekstowego menu */
interface ContextMenuState {
  orderId: string | null;
  order: OrderListItemDto | null;
  position: { x: number; y: number };
  isOpen: boolean;
}
```

---

## 6. Zarządzanie stanem

### 6.1 Providery (Context)

#### AuthProvider / useAuth
- **Cel**: Przechowywanie sesji użytkownika (profil, rola, token Supabase).
- **Stan**: `{ user: AuthMeDto | null; isLoading: boolean; supabaseClient: SupabaseClient }`
- **Akcje**: `login(email, password)`, `logout()`, `refreshUser()`
- **Efekty**: Przy mountowaniu pobiera `GET /auth/me`. Przy 401 z dowolnego żądania — automatyczny `logout()`.

#### DictionaryProvider / useDictionaries
- **Cel**: Globalny cache danych słownikowych.
- **Stan**: `DictionaryState`
- **Akcje**: `loadDictionaries()`, `refreshDictionaries()`
- **Efekty**: Ładowanie po zalogowaniu (6 równoległych GET). Odświeżanie po zakończeniu synchronizacji ERP.

### 6.2 Custom hooki

#### useOrders
- **Cel**: Zarządzanie stanem listy zleceń (dane, filtry, sortowanie, ładowanie).
- **Stan**: `{ orders: OrderListItemDto[]; totalItems: number; totalPages: number; page: number; isLoading: boolean; error: string | null; filters: OrderListFilters }`
- **Akcje**: `setFilters(partial)`, `setSort(sortBy)`, `refresh()`
- **Efekty**: Przy zmianie filtrów/sortowania/zakładki → `GET /api/v1/orders` z parametrami z api-plan 2.2 (`view`, `status`, `transportType`, `carrierId`, `productId`, `loadingLocationId`, `loadingCompanyId`, `unloadingLocationId`, `unloadingCompanyId`, `search`, `dateFrom`, `dateTo`, `sortBy`, `sortDirection`, `page`, `pageSize`). Domyślne sortowanie: `sortBy: FIRST_LOADING_DATETIME`, `sortDirection: ASC` (ui-plan). Debounce 300ms na filtrach tekstowych. Filtr „numer tygodnia" mapowany na `dateFrom`/`dateTo` po stronie frontendu (ISO week → poniedziałek–niedziela).
- **Odświeżanie**: Po operacjach zmiany statusu, tworzenia, usuwania, przywracania, wysyłki maila.

#### useOrderDetail
- **Cel**: Pobieranie i zarządzanie szczegółami zlecenia w drawerze + lock/unlock.
- **Stan**: `{ orderData: OrderDetailResponseDto | null; isLoading: boolean; isLocked: boolean; isReadOnly: boolean; lockError: string | null }`
- **Akcje**: `openOrder(id)`, `closeOrder()`, `saveOrder(data)`, `generatePdf()`, `sendEmail()`
- **Przepływ**: `openOrder` → POST lock → GET detail. `closeOrder` → POST unlock. `saveOrder` → PUT.

#### useOrderHistory
- **Cel**: Pobieranie i scalanie historii zmian zlecenia.
- **Stan**: `{ entries: TimelineEntryViewModel[]; isLoading: boolean }`
- **Akcje**: `loadHistory(orderId)`
- **Logika scalania**: Pobranie równoległe `/history/status` + `/history/changes` → normalizacja do `TimelineEntryViewModel[]` → sortowanie malejąco po `changedAt` → grupowanie po dacie.

#### useDictionarySync
- **Cel**: Zarządzanie procesem synchronizacji słowników ERP.
- **Stan**: `{ isSyncing: boolean; jobId: string | null; jobStatus: string | null }`
- **Akcje**: `startSync()`, `checkStatus()`
- **Przepływ**: POST `/dictionary-sync/run` → polling GET `/dictionary-sync/jobs/{jobId}` co 2s → po COMPLETED: toast + `refreshDictionaries()` → po FAILED: toast błędu.

### 6.3 Strategia zarządzania stanem

- **React Context** dla Auth i Dictionaries (dane współdzielone globalnie).
- **useState + useEffect** w hookach dla stanu komponentów (filtry, lista, drawer, historia).
- **Brak zewnętrznej biblioteki stanu** (np. Redux/Zustand) — wystarczą hooki i context dla MVP.
- **Optimistic UI**: nie stosujemy w MVP — czekamy na odpowiedź serwera i odświeżamy.

---

## 7. Integracja API

### 7.1 Klient HTTP

Wewnętrzny moduł `src/lib/api-client.ts` opakowujący `fetch` z:
- Automatycznym dodawaniem nagłówka `Authorization: Bearer {token}` z kontekstu Auth.
- Parsowaniem odpowiedzi JSON.
- Obsługą błędów: 401 → wylogowanie, 4xx/5xx → throw z `ApiErrorResponse`.
- Metodami: `get<T>(url, params?)`, `post<T>(url, body?)`, `put<T>(url, body?)`, `delete<T>(url)`, `patch<T>(url, body?)`.

### 7.2 Mapowanie endpointów na akcje frontendowe

Parametry zapytań zgodne z **api-plan** sekcja 2.2. GET `/api/v1/orders`: `view`, `status` (opcjonalny, wielokrotny), `transportType`, `carrierId`, `productId`, `loadingLocationId`, `loadingCompanyId`, `unloadingLocationId`, `unloadingCompanyId`, `search`, `dateFrom`, `dateTo`, `sortBy` (FIRST_LOADING_DATETIME | FIRST_UNLOADING_DATETIME | ORDER_NO | CARRIER_NAME), `sortDirection` (ASC | DESC), `page`, `pageSize`. Filtr „numer tygodnia" — mapowany na `dateFrom`/`dateTo` po stronie frontendu (ISO week → poniedziałek–niedziela).

| Akcja UI | Metoda | Endpoint | Request | Response | Trigger |
|---|---|---|---|---|---|
| Pobierz profil | GET | `/api/v1/auth/me` | — | `AuthMeDto` | Mount AuthProvider |
| Lista zleceń | GET | `/api/v1/orders` | Query: `view`, `status`, `transportType`, `carrierId`, `productId`, `loadingLocationId`, `loadingCompanyId`, `unloadingLocationId`, `unloadingCompanyId`, `search`, `dateFrom`, `dateTo`, `sortBy`, `sortDirection`, `page`, `pageSize` | `PaginatedResponse<OrderListItemDto>` (api-plan 2.2) | Mount, zmiana filtrów/zakładki/sortowania |
| Szczegóły zlecenia | GET | `/api/v1/orders/{id}` | — | `OrderDetailResponseDto` | Otwarcie draweru |
| Utwórz zlecenie | POST | `/api/v1/orders` | Body: `CreateOrderCommand` | `CreateOrderResponseDto` | Klik „Dodaj nowy wiersz" |
| Aktualizuj zlecenie | PUT | `/api/v1/orders/{id}` | Body: `UpdateOrderCommand` | `UpdateOrderResponseDto` | Klik „Zapisz" w drawerze |
| Anuluj zlecenie | DELETE | `/api/v1/orders/{id}` | — | `DeleteOrderResponseDto` | Menu → „Anuluj" |
| Zmień status | POST | `/api/v1/orders/{id}/status` | Body: `ChangeStatusCommand` | `ChangeStatusResponseDto` | Menu → „Zmień status" |
| Przywróć zlecenie | POST | `/api/v1/orders/{id}/restore` | Body: brak (opcjonalnie `{}`) — serwer ustawia status Korekta | — | Menu → „Przywróć" |
| Zablokuj | POST | `/api/v1/orders/{id}/lock` | — | `LockOrderResponseDto` | Otwarcie draweru |
| Odblokuj | POST | `/api/v1/orders/{id}/unlock` | — | `UnlockOrderResponseDto` | Zamknięcie draweru |
| Duplikuj | POST | `/api/v1/orders/{id}/duplicate` | Body: `DuplicateOrderCommand` | `DuplicateOrderResponseDto` | Menu → „Skopiuj" (etap 2) |
| Generuj PDF | POST | `/api/v1/orders/{id}/pdf` | Body?: `{ regenerate }` | Blob (application/pdf) | Klik „Generuj PDF" |
| Przygotuj email | POST | `/api/v1/orders/{id}/prepare-email` | Body?: `PrepareEmailCommand` | `PrepareEmailResponseDto` | Klik „Wyślij maila" |
| Historia statusów | GET | `/api/v1/orders/{id}/history/status` | — | `ListResponse<StatusHistoryItemDto>` | Otwarcie panelu historii |
| Historia zmian | GET | `/api/v1/orders/{id}/history/changes` | — | `ListResponse<ChangeLogItemDto>` | Otwarcie panelu historii |
| Firmy | GET | `/api/v1/companies` | Query?: `search`, `activeOnly` | `ListResponse<CompanyDto>` | Load dictionaries |
| Lokalizacje | GET | `/api/v1/locations` | Query?: `search`, `companyId`, `activeOnly` | `ListResponse<LocationDto>` | Load dictionaries |
| Produkty | GET | `/api/v1/products` | Query?: `search`, `activeOnly` | `ListResponse<ProductDto>` | Load dictionaries |
| Typy transportu | GET | `/api/v1/transport-types` | Query?: `activeOnly` | `ListResponse<TransportTypeDto>` | Load dictionaries |
| Statusy | GET | `/api/v1/order-statuses` | — | `ListResponse<OrderStatusDto>` | Load dictionaries |
| Warianty pojazdów | GET | `/api/v1/vehicle-variants` | Query?: `activeOnly` | `ListResponse<VehicleVariantDto>` | Load dictionaries |
| Synchronizacja | POST | `/api/v1/dictionary-sync/run` | Body: `DictionarySyncCommand` | `DictionarySyncResponseDto` | Klik „Aktualizuj dane" |
| Status synchro. | GET | `/api/v1/dictionary-sync/jobs/{id}` | — | `DictionarySyncJobDto` | Polling co 2s |

---

## 8. Interakcje użytkownika

### 8.1 Lista zleceń

| Interakcja | Wynik |
|---|---|
| Klik na zakładkę (Aktualne/Zrealizowane/Anulowane) | Zmiana `view`, nowe zapytanie GET, odświeżenie tabeli |
| Zmiana filtra (typ transportu, przewoźnik, towar, lokalizacja, data) | Debounce 300ms → nowe zapytanie GET |
| Klik „Wyczyść filtry" | Reset filtrów do domyślnych → nowe zapytanie GET |
| Klik w nagłówek kolumny | Toggle sortBy/sortDirection → nowe zapytanie GET |
| Zmiana rozmiaru strony (50/100/200) | Nowe zapytanie GET z nowym pageSize |
| Przełączenie widoku listy (Trasa/Kolumny) | Zmiana kolumn tabeli (bez nowego zapytania) |
| Lewy klik na wiersz | POST lock → GET detail → otwarcie draweru edycji |
| Prawy klik na wiersz | Otwarcie menu kontekstowego |
| Klik ikony „Wyślij maila" w wierszu | POST prepare-email → otwarcie mailto: lub 422 z listą braków |
| Klik „+ Dodaj nowy wiersz" | POST create → nowy wiersz na liście → otwarcie draweru |

### 8.2 Menu kontekstowe

| Interakcja | Wynik |
|---|---|
| „Wyślij maila" | POST prepare-email → otwarcie mailto: lub 422 |
| „Historia zmian" | Otwarcie panelu historii |
| „Zmień status" → wybór statusu | POST status → odświeżenie listy (wiersz może zmienić zakładkę) |
| „Zmień status" → Reklamacja | Panel na dole widoku lub modal z polem „Powód reklamacji" (wymagane) → POST status |
| „Skopiuj zlecenie" | POST duplicate → nowy wiersz na liście → otwarcie draweru |
| „Anuluj zlecenie" | Modal potwierdzenia → DELETE → odświeżenie listy |
| „Przywróć do aktualnych" | POST restore → serwer ustawia status Korekta → wiersz wraca do zakładki Aktualne (z Anulowane tylko gdy &lt; 24 h) |

### 8.3 Drawer edycji

| Interakcja | Wynik |
|---|---|
| Otwarcie (klik na wiersz) | POST lock → przy 409: tryb readonly z komunikatem |
| Zmiana pola formularza | Aktualizacja stanu lokalnego, flaga isDirty=true |
| Wybór w autocomplete | Uzupełnienie powiązanych pól (adres, NIP) |
| „Dodaj miejsce załadunku/rozładunku" | Nowy punkt trasy (max 8/3) |
| Drag-and-drop / góra/dół punkt trasy | Zmiana sequenceNo |
| „Usuń punkt" | Usunięcie punktu (_deleted=true) |
| „Dodaj pozycję" (towar) | Nowy wiersz pozycji |
| Klik „Zapisz" | Walidacja techniczna → PUT → toast sukcesu → isDirty=false |
| Klik „Anuluj" / X / Escape | Sprawdzenie isDirty → modal „Odrzucić?" lub zamknięcie + unlock |
| Klik „Generuj PDF" | POST pdf → pobranie pliku |
| Klik „Wyślij maila" | POST prepare-email → mailto: URL lub 422 alert |
| Klik „Historia zmian" | Otwarcie panelu historii obok draweru |
| Zmiana statusu w sekcji | POST status → aktualizacja badge'a statusu |
| Klik backdrop | Jak „Anuluj" (z ostrzeżeniem o zmianach) |

### 8.4 Nagłówek

| Interakcja | Wynik |
|---|---|
| Klik „Aktualizuj dane" | POST sync/run → polling → toast → odświeżenie słowników |
| Klik „Wyloguj" | signOut → redirect na `/` |

---

## 9. Warunki i walidacja

### 9.1 Walidacja techniczna (przy zapisie — PUT)

Realizowana na froncie (inline pod polami) i potwierdzana przez API (400):

| Pole | Warunek | Komponent |
|---|---|---|
| `transportTypeCode` | Wymagane, ∈ {PL, EXP, EXP_K, IMP} | HeaderSection |
| `currencyCode` | Wymagane, ∈ {PLN, EUR, USD} | HeaderSection |
| `vehicleVariantCode` | Wymagane, niepusty | CargoSection |
| `priceAmount` | ≥ 0 (jeśli podane) | FinanceSection |
| `paymentTermDays` | Integer ≥ 0 (jeśli podane) | FinanceSection |
| `quantityTons` | ≥ 0 (jeśli podane) | ItemRow |
| `senderContactEmail` | Format email (jeśli podane) | PartiesSection |
| `dateLocal` (stop) | Format YYYY-MM-DD (jeśli podane) | RoutePointCard |
| `timeLocal` (stop) | Format HH:MM lub HH:MM:SS (jeśli podane) | RoutePointCard |
| `generalNotes` | Max 1000 znaków | DocumentsSection |
| `requiredDocumentsText` | Max 500 znaków | DocumentsSection |
| `specialRequirements` | Max 1000 znaków | CargoSection |
| `notes` (stop/item) | Max 500 znaków | RoutePointCard / ItemRow |
| Punkty trasy | Max 8 LOADING, max 3 UNLOADING | RoutePointList |

### 9.2 Walidacja biznesowa (przy wysyłce maila — POST prepare-email)

Realizowana wyłącznie przez API (422). Frontend wyświetla listę braków:

| Pole | Warunek | Komunikat API |
|---|---|---|
| `transportTypeCode` | Niepuste | „Typ transportu jest wymagany" |
| `carrierCompanyId` | Niepuste | „Przewoźnik jest wymagany" |
| `shipperLocationId` | Niepuste | „Nadawca (lokalizacja) jest wymagany" |
| `receiverLocationId` | Niepuste | „Odbiorca (lokalizacja) jest wymagany" |
| `priceAmount` | Niepuste | „Cena frachtu jest wymagana" |
| `vehicleVariantCode` | Niepuste | „Wariant pojazdu jest wymagany" |
| `items` | Min 1 z nazwą + ilością | „Wymagana min. 1 pozycja z nazwą towaru i ilością" |
| `stops` (LOADING) | Min 1 z datą i godziną | „Wymagany min. 1 punkt załadunku z datą i godziną" |
| `stops` (UNLOADING) | Min 1 z datą i godziną | „Wymagany min. 1 punkt rozładunku z datą i godziną" |

### 9.3 Walidacja zmiany statusu

| Warunek | Realizacja |
|---|---|
| Dozwolone przejścia ręczne | Frontend filtruje opcje wg `ALLOWED_MANUAL_STATUS_TRANSITIONS`: Zrealizowane z Robocze, Wysłane, Korekta, Korekta wysłane, Reklamacja; Reklamacja tylko z Wysłane, Korekta wysłane; Anulowane z Robocze, Wysłane, Korekta, Korekta wysłane, Reklamacja (nie z Zrealizowane — tam tylko „Przywróć") |
| Reklamacja wymaga complaintReason | Panel na dole widoku lub modal z polem „Powód reklamacji"; zapis zmiany na Reklamacja zablokowany bez wypełnienia |
| Przywracanie z Anulowane &lt; 24 h | API sprawdza; frontend wyświetla błąd 400/410 gdy minęło ≥ 24 h |
| Statusy Wysłane, Korekta wysłane ustawiane tylko automatycznie | Brak opcji ręcznej w UI — realizowane przez prepare-email |

**Matryca dozwolonych przejść** (dla `ALLOWED_MANUAL_STATUS_TRANSITIONS` lub równoważnego configu): Z **Robocze** → Zrealizowane, Anulowane. Z **Wysłane** → Zrealizowane, Reklamacja, Anulowane. Z **Korekta** → Zrealizowane, Reklamacja, Anulowane. Z **Korekta wysłane** → Zrealizowane, Reklamacja, Anulowane. Z **Reklamacja** → Zrealizowane, Anulowane. Z **Zrealizowane** i **Anulowane** nie oferować „Zmień status" na inny status — tylko „Przywróć do aktualnych" (Zrealizowane bez limitu, Anulowane tylko &lt; 24 h). Wyświetlanie w UI: pełne nazwy statusów (`statusName`).

### 9.4 Walidacja blokady

| Warunek | Realizacja |
|---|---|
| Zlecenie zablokowane przez innego | POST lock → 409 → drawer w trybie readonly + komunikat z `lockedByUserName` |
| Zapis przy cudzej blokadzie | PUT → 409 → toast „Zlecenie zmodyfikowane. Odśwież dane." |
| Lock timeout (30 min) | Serwer wygasza; frontend nie monitoruje (przy kolejnym lock sukces) |

---

## 10. Obsługa błędów

| Kod HTTP | Scenariusz | Obsługa w UI |
|---|---|---|
| **401** | Token wygasł / brak sesji | Globalny interceptor: wylogowanie + redirect na `/` |
| **403** | Brak uprawnień (rola) | Toast: „Brak uprawnień do tej operacji" |
| **404** | Zlecenie nie istnieje (usunięte/wygasłe) | Toast: „Zlecenie nie istnieje" + zamknięcie draweru + odświeżenie listy |
| **400** | Błąd walidacji technicznej | Wyświetlenie `error.details[]` jako inline errors pod polami formularza |
| **409 (lock)** | Zlecenie zablokowane | Komunikat „Zlecenie edytowane przez [imię]" + drawer readonly |
| **409 (save)** | Dane zmienione przez innego | Toast „Zlecenie zostało zmodyfikowane. Odśwież dane." + ponowne GET |
| **422** | Niekompletne dane do wysyłki | Alert w drawerze z listą brakujących pól z `error.details[]` |
| **500** | Błąd serwera | Toast „Wystąpił błąd serwera. Spróbuj ponownie." |
| **Network error** | Brak połączenia | Toast „Brak połączenia z serwerem" |
| **PDF generation fail** | Błąd generowania PDF | Toast „Nie udało się wygenerować PDF" |
| **Sync fail** | Błąd synchronizacji ERP | Toast „Błąd synchronizacji danych" + przycisk ponownie aktywny |
| **Pusta lista** | Brak wyników | EmptyState z kontekstowym komunikatem |
| **Wiele wyników (paginacja)** | Lista paginowana; trzeci wariant EmptyState „Zawęź filtry" **nie jest używany** (PRD 3.1.2a) |

---

## 11. Kroki implementacji

### Faza 0: Przygotowanie infrastruktury

1. **Zainstalować wymagane zależności npm**:
   - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (drag-and-drop trasy)
   - `@tanstack/react-virtual` (opcjonalnie — wirtualizacja listy)
   - `date-fns` (formatowanie dat)

2. **Zainstalować wymagane komponenty shadcn/ui**:
   - `npx shadcn@latest add button input label select textarea badge tabs sheet dialog alert-dialog popover command calendar context-menu dropdown-menu scroll-area toggle-group separator tooltip sonner table`

3. **Utworzyć strukturę katalogów**:
   ```
   src/
   ├── components/
   │   ├── ui/           ← shadcn (auto-generowane)
   │   ├── auth/
   │   │   └── LoginCard.tsx
│   ├── layout/
│   │   ├── AppHeader.tsx
│   │   ├── SyncButton.tsx
│   │   └── UserInfo.tsx
   │   ├── orders/
   │   │   ├── OrdersPage.tsx
   │   │   ├── OrderTabs.tsx
   │   │   ├── FilterBar.tsx
   │   │   ├── ListSettings.tsx
   │   │   ├── OrderTable.tsx
   │   │   ├── OrderRow.tsx
   │   │   ├── OrderRowContextMenu.tsx
   │   │   ├── AddOrderButton.tsx
   │   │   ├── EmptyState.tsx
   │   │   ├── StatusBadge.tsx
   │   │   ├── TransportTypeBadge.tsx
   │   │   ├── RouteSummaryCell.tsx
   │   │   ├── LockIndicator.tsx
   │   │   └── StatusFooter.tsx
   │   ├── drawer/
   │   │   ├── OrderDrawer.tsx
   │   │   ├── OrderForm.tsx
   │   │   ├── DrawerFooter.tsx
   │   │   ├── HeaderSection.tsx
   │   │   ├── PartiesSection.tsx
   │   │   ├── CargoSection.tsx
   │   │   ├── ItemList.tsx
   │   │   ├── ItemRow.tsx
   │   │   ├── RouteSection.tsx
   │   │   ├── RoutePointList.tsx
   │   │   ├── RoutePointCard.tsx
   │   │   ├── FinanceSection.tsx
   │   │   ├── DocumentsSection.tsx
   │   │   ├── StatusChangeSection.tsx
   │   │   └── AutocompleteField.tsx
   │   ├── history/
   │   │   ├── HistoryPanel.tsx
   │   │   ├── TimelineGroup.tsx
   │   │   ├── TimelineEntry.tsx
   │   │   └── UserAvatar.tsx
   │   └── shared/
   │       ├── ConfirmDialog.tsx
   │       ├── UnsavedChangesDialog.tsx
   │       ├── ComplaintReasonDialog.tsx
   │       ├── DatePickerField.tsx
   │       └── TimePickerField.tsx
   ├── hooks/
   │   ├── useOrders.ts
   │   ├── useOrderDetail.ts
   │   ├── useOrderHistory.ts
   │   └── useDictionarySync.ts
   ├── contexts/
   │   ├── AuthContext.tsx
   │   └── DictionaryContext.tsx
   ├── lib/
   │   ├── api-client.ts
   │   └── view-models.ts      ← nowe typy ViewModel
   └── pages/
       ├── index.astro          ← ekran logowania
       └── orders.astro         ← główny widok
   ```

### Faza 1: Fundamenty (Auth + API Client + Layout)

4. **Utworzyć moduł `api-client.ts`** — wrapper fetch z obsługą JWT, typami i interceptorem 401.
5. **Utworzyć `view-models.ts`** — nowe typy ViewModel (`OrderListFilters`, `OrderFormData`, `OrderFormStop`, `OrderFormItem`, `TimelineEntryViewModel`, `ListViewMode`, `DictionaryState`, `ContextMenuState`).
5a. **Utworzyć moduł `src/lib/utils/format.ts`** — funkcje formatowania dat:
   ```typescript
   /**
    * Formatuje datę z ISO 8601 (YYYY-MM-DD) do polskiego formatu (DD.MM.YYYY)
    * @param isoDate - Data w formacie YYYY-MM-DD lub null/undefined
    * @returns Data w formacie DD.MM.YYYY lub pusty string jeśli brak daty
    */
   export function formatDate(isoDate: string | null | undefined): string {
     if (!isoDate) return '';
     const [year, month, day] = isoDate.split('-');
     return `${day}.${month}.${year}`;
   }

   /**
    * Formatuje timestamp do polskiego formatu daty (DD.MM.YYYY) bez godziny
    * @param timestamp - Timestamp w formacie ISO 8601 lub null/undefined
    * @returns Data w formacie DD.MM.YYYY lub pusty string jeśli brak daty
    */
   export function formatDateFromTimestamp(timestamp: string | null | undefined): string {
     if (!timestamp) return '';
     const date = timestamp.split('T')[0]; // Wyciąga część YYYY-MM-DD z timestampu
     return formatDate(date);
   }
   ```
6. **Zaimplementować `AuthContext.tsx`** — provider + hook `useAuth()` z `login()`, `logout()`, `refreshUser()`.
7. **Zaimplementować `DictionaryContext.tsx`** — provider + hook `useDictionaries()` z ładowaniem 6 słowników po zalogowaniu.
8. **Zaimplementować stronę logowania** (`src/pages/index.astro` + `LoginCard.tsx`) — formularz, Supabase Auth, redirect.
9. **Zaimplementować `Layout.astro`** — aktualizacja tytułu, meta, font Inter.
10. **Zaimplementować `AppHeader.tsx`** — sticky header (`h-14`) z logo (primary ikona), tytułem (UPPERCASE), zakładkami OrderTabs (w środku), SyncButton, **UserInfo** (bez avatara: wiersz 1 — imię i nazwisko, wiersz 2 — rola zwykłym tekstem „Admin" / „Planner" / „Read only", przycisk „Wyloguj"). Zgodnie z PRD 3.1.2a i ui-plan.

### Faza 2: Lista zleceń

11. **Zaimplementować stronę `/orders`** (`src/pages/orders.astro`) — wyspa React `<OrdersApp>` z providerami.
12. **Zaimplementować hook `useOrders.ts`** — stan filtrów, pobieranie listy, debounce, odświeżanie.
13. **Zaimplementować `OrdersPage.tsx`** — główny kontener: FilterBar + ListSettings + OrderTable + EmptyState + StatusFooter (zakładki przeniesione do AppHeader).
14. **Zaimplementować `OrderTabs.tsx`** — trzy zakładki w nagłówku: `bg-slate-100 rounded-lg p-1`, aktywna: `bg-white shadow-sm text-primary`.
15. **Zaimplementować `FilterBar.tsx`** — kolejność filtrów zgodna z PRD 3.1.2a: rodzaj transportu, status (select), firma załadunku, firma rozładunku, Firma transportowa, towar, numer tygodnia (pole tekstowe), wyszukiwanie pełnotekstowe; przycisk „Wyczyść filtry"; z prawej przycisk „Nowe zlecenie" (tylko Aktualne + Admin/Planner). Debounce 300ms na polach tekstowych/autocomplete.
16. **Zaimplementować `AutocompleteFilter`** — generyczny komponent filtra z autocomplete (shadcn Command).
17. **Zaimplementować `ListSettings.tsx`** — pageSize + viewMode toggle.
18. **Zaimplementować komponenty badge'ów** — `StatusBadge.tsx` (wyświetlanie `statusName`, bez animacji pulse), `TransportTypeBadge.tsx`.
19. **Zaimplementować `OrderTable.tsx`** — tabela z `min-w-[1280px]`, sticky nagłówkiem (`bg-slate-50, text-[11px] uppercase`), sticky kolumną Akcje z prawej (shadow), hover na wierszach. Wzór: `test/main_view.html`.
20. **Zaimplementować `OrderRow.tsx`** — kompaktowy wiersz (`py-1 px-4 text-[12px]`) z tłem wg statusu, dwuwiersz przewoźnika, towar z ikoną + badge, dwa warianty kolumn.
21. **Zaimplementować `RouteSummaryCell.tsx`** — wizualizacja trasy node-string z kompaktowymi węzłami (emerald załadunki, primary rozładunki) rozdzielonymi strzałkami. Format: `L1:Nord → L2:Recykling → U1:BER`. Opcjonalnie linia łącząca (pseudo-element `::after`) z `z-10` na węzłach i strzałkach.
22. **Zaimplementować `LockIndicator.tsx`** — ikona blokady z tooltipem.
23. **Zaimplementować `AddOrderButton.tsx`** — przycisk tworzenia zlecenia.
24. **Zaimplementować `EmptyState.tsx`** — tylko dwa warianty (PRD 3.1.2a): „Brak zleceń" (z przyciskiem „Dodaj nowy wiersz" w Aktualne) oraz „Brak wyników dla zastosowanych filtrów" (z przyciskiem „Wyczyść filtry").

### Faza 3: Menu kontekstowe i akcje z listy

25. **Zaimplementować `OrderRowContextMenu.tsx`** — menu z opcjami zależnymi od statusu/roli.
26. **Zaimplementować `ComplaintReasonDialog.tsx`** — modal powodu reklamacji.
27. **Zaimplementować `ConfirmDialog.tsx`** — modal potwierdzenia anulowania.
28. **Zintegrować akcje menu** — zmiana statusu (POST /status), anulowanie (DELETE), przywracanie (POST /restore), wysyłka maila (POST /prepare-email).

### Faza 4: Drawer edycji zlecenia

29. **Zaimplementować hook `useOrderDetail.ts`** — lock/unlock, GET detail, PUT update, PDF, email.
30. **Zaimplementować `OrderDrawer.tsx`** — Sheet z logiką lock/unlock i trybu readonly.
31. **Zaimplementować `AutocompleteField.tsx`** — generyczny autocomplete formularza z debounce i auto-uzupełnianiem.
32. **Zaimplementować `HeaderSection.tsx`** — nr zlecenia, data, typ transportu, waluta, status.
33. **Zaimplementować `PartiesSection.tsx`** — przewoźnik, nadawca, odbiorca (autocomplete), kontakt.
34. **Zaimplementować `CargoSection.tsx`** + `ItemList.tsx` + `ItemRow.tsx` — pozycje towarowe.
35. **Zaimplementować `RouteSection.tsx`** + `RoutePointList.tsx` + `RoutePointCard.tsx` — trasa z drag-and-drop i limitami.
36. **Zaimplementować `FinanceSection.tsx`** — cena, termin, forma płatności.
37. **Zaimplementować `DocumentsSection.tsx`** — dokumenty, uwagi, powód reklamacji.
38. **Zaimplementować `StatusChangeSection.tsx`** — zmiana statusu z dozwolonymi przejściami.
39. **Zaimplementować `DrawerFooter.tsx`** — Zapisz, Anuluj, PDF, Wyślij maila.
40. **Zaimplementować `OrderForm.tsx`** — połączenie sekcji, lokalny stan, walidacja techniczna, mapowanie na `UpdateOrderCommand`.
41. **Zaimplementować `UnsavedChangesDialog.tsx`** — modal + obsługa `beforeunload`.

### Faza 5: Panel historii zmian

42. **Zaimplementować hook `useOrderHistory.ts`** — pobieranie, scalanie, grupowanie.
43. **Zaimplementować `HistoryPanel.tsx`** — Sheet z osią czasu.
44. **Zaimplementować `TimelineGroup.tsx`** — grupowanie po dacie z sticky etykietą.
45. **Zaimplementować `TimelineEntry.tsx`** — wpisy: zmiana statusu, zmiana pola, utworzenie.
46. **Zaimplementować `UserAvatar.tsx`** — inicjały w kółku.

### Faza 6: Synchronizacja słowników i PDF

47. **Zaimplementować hook `useDictionarySync.ts`** — start, polling, callback.
48. **Zaimplementować `SyncButton.tsx`** — przycisk z obsługą stanu synchronizacji.
49. **Zaimplementować pobieranie PDF** — POST `/orders/{id}/pdf` → blob → download file.
50. **Zaimplementować wysyłkę maila** — POST `/orders/{id}/prepare-email` → otwarcie `mailto:` URL lub wyświetlenie 422.

### Faza 7: Polerowanie wizualne i przypadki brzegowe

51. **Dodać globalne style CSS** — do `src/styles/global.css`:
    ```css
    /* Node-string route visualization */
    .node-line { position: relative; }
    .node-line::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: #e2e8f0;
      z-index: 0;
    }
    /* Table row hover */
    tr:hover td {
      background-color: rgba(19, 127, 236, 0.04) !important;
    }
    /* Hidden scrollbar */
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    ```
52. **Dodać globalne toasty** — shadcn `<Sonner>` dla komunikatów sukcesu/błędu.
53. **Dodać obsługę `beforeunload`** — ostrzeżenie przy niezapisanych zmianach (zamykanie karty/refresh).
54. **Dodać kolorystykę wierszy wg statusu** — jaśniejszy odcień koloru statusu jako tło wiersza (Robocze: white, Wysłane: blue-50/30, Korekta: orange-50/30, itd.); mapowanie po `statusCode` lub `statusName`.
55. **Zaimplementować `StatusFooter.tsx`** — pasek stopki sticky na dole (`h-10 bg-slate-50 border-t`): lewa strona — liczniki (np. „Aktywne: X" dla bieżącej zakładki lub per status); **bez** „W trasie", „Załadunek", „Opóźnione" (PRD 3.1.2a, ui-plan). Prawa strona: „System Status: OK", „Ostatnia aktualizacja: HH:MM".
56. **Sprawdzić spójność stylów** — StatusBadge bez animacji pulse, kolory zgodne z dokumentacją (emerald dla Zrealizowane, amber dla Korekta wysłane, border dla wszystkich poza Robocze).
57. **Dodać dark mode** — warianty `dark:` dla wszystkich komponentów. Tło: `#101922`, nagłówek: `bg-slate-900`, tabela: `bg-slate-800`/`bg-slate-900`.
58. **Dodać responsywność** — jeden breakpoint, tabela z `min-w-[1280px]` i scrollbar-hide.
59. **Dodać ukrywanie akcji dla READ_ONLY** — sprawdzanie roli we wszystkich komponentach z akcjami.
60. **Testować przepływy end-to-end** — logowanie, CRUD, wysyłka, historia, synchronizacja, blokada, przywracanie.
