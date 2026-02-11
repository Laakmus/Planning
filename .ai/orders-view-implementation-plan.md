# Plan implementacji widoku Zleceń Transportowych

## 1. Przegląd

Widok zleceń transportowych to główny ekran aplikacji, dostępny po zalogowaniu. Obejmuje pełną funkcjonalność planistyczną: przeglądanie listy zleceń w trzech zakładkach (Aktualne, Zrealizowane, Anulowane), filtrowanie, sortowanie, tworzenie nowych zleceń, edycję w panelu bocznym (drawer), generowanie PDF, wspomaganie wysyłki maila, zmianę statusów, przeglądanie historii zmian oraz synchronizację danych słownikowych z ERP.

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
│       │   └── UserMenu
│       └── OrdersPage
│           ├── (OrderTabs przeniesione do AppHeader)
│           ├── FilterBar
│           │   ├── TransportTypeFilter
│           │   ├── AutocompleteFilter (×4: przewoźnik, towar, załadunek, rozładunek)
│           │   ├── DateRangeFilter (×2: daty załadunku, daty rozładunku)
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

- **Opis**: Sticky nagłówek aplikacji (`h-14`) z logo, tytułem (UPPERCASE), zakładkami widoków, przyciskiem synchronizacji i informacjami o użytkowniku. Wzorowany na mockupie `test/main_view.html`.
- **Główne elementy**: `<header class="bg-white dark:bg-slate-900 border-b h-14 sticky top-0 z-50">`, `<OrderTabs />` (w środku nagłówka), `<SyncButton />`, `<UserMenu />`
- **Styl nagłówka**:
  - Logo: `w-8 h-8 bg-primary rounded` z białą ikoną Material Symbols `precision_manufacturing`
  - Tytuł: `font-bold tracking-tight text-slate-800 uppercase text-sm`
  - Zakładki: `bg-slate-100 rounded-lg p-1`, aktywna: `bg-white shadow-sm text-primary`, nieaktywna: `text-slate-500`
  - Po prawej: ikony `search`, `notifications` + avatar `h-8 w-8 rounded-full bg-slate-200` z inicjałami
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

- **Opis**: Pasek filtrów pod nagłówkiem, oddzielony `border-t`, tło `bg-slate-50`. Zawiera filtry po typie transportu, przewoźniku, towarze, lokalizacjach załadunku/rozładunku, zakresach dat i wyszukiwanie pełnotekstowe.
- **Główne elementy**: `<div class="px-4 py-2 border-t bg-slate-50 flex flex-wrap items-center gap-2">` z polami: ikona Material + input (`h-8 pl-8 pr-3 bg-white border rounded text-xs`), composite „Trasa" (dwa inputy rozdzielone `→` w jednym borderze), datepicker (`h-8`), przyciski „Filtruj" (primary) i „Wyczyść" (ghost). Z prawej (`ml-auto`): „Nowe Zlecenie" (`bg-emerald-600 text-white`).
- **Obsługiwane interakcje**:
  - Zmiana wartości filtra → debounce 300ms → aktualizacja stanu filtrów → nowe zapytanie GET
  - Klik „Wyczyść filtry" → reset wszystkich filtrów do wartości domyślnych
- **Walidacja**:
  - `dateFrom` ≤ `dateTo` (jeśli oba podane)
  - Wartości autocomplete muszą być z listy słownikowej (UUID)
- **Typy**: `OrderListFilters` (nowy ViewModel), `CompanyDto`, `LocationDto`, `ProductDto`, `TransportTypeDto`
- **Propsy**:
  ```ts
  interface FilterBarProps {
    filters: OrderListFilters;
    onFiltersChange: (filters: Partial<OrderListFilters>) => void;
    onClearFilters: () => void;
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

- **Opis**: Ustawienia widoku listy: rozmiar strony (50/100/200) i przełącznik wariantu widoku (Trasa / Kolumny).
- **Główne elementy**: shadcn `<Select>` (pageSize), shadcn `<ToggleGroup>` lub `<Tabs>` (viewMode).
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

- **Opis**: Tabela z listą zleceń wzorowana na mockupie `test/main_view.html`. Kompaktowe wiersze, sticky nagłówek, sticky kolumna Akcje z prawej, wizualizacja trasy node-string.
- **Główne elementy**:
  - Kontener: `<div class="min-w-[1280px] scrollbar-hide">`
  - `<table class="w-full border-collapse text-left">`
  - `<thead class="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b z-10">` — nagłówki: `text-[11px] font-bold uppercase tracking-wider text-slate-500`
  - `<tbody class="divide-y divide-slate-100">` z `<OrderRow>` × N
  - Kolumna Akcje: `<th>/<td> sticky right-0 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]`
- **Styl hover**: `tr:hover td { background-color: rgba(19, 127, 236, 0.04) !important; }` (global CSS)
- **Styl scrollbar**: `.scrollbar-hide::-webkit-scrollbar { display: none; }` (global CSS)
- **Obsługiwane interakcje**:
  - Klik na nagłówek kolumny → zmiana `sortBy`/`sortDirection`
  - Lewy klik na wiersz → otwarcie draweru (z lockiem)
  - Prawy klik na wiersz → menu kontekstowe
- **Walidacja**: Brak.
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

- **Opis**: Pojedynczy wiersz tabeli zleceń. Kompaktowy (`py-1 px-4 text-[12px]`), tło kolorowane wg statusu. Zawiera kolumny zależne od wybranego widoku.
- **Główne elementy**: `<tr class={getRowBgClass(statusCode)}>` z:
  - `<LockIndicator>` — ikona kłódki
  - Numer zlecenia — `font-mono font-medium text-primary`
  - `<StatusBadge>` — badge z opcjonalnym pulsem
  - `<RouteSummaryCell>` — wizualizacja trasy node-string
  - Przewoźnik — dwuwiersz: `<span class="font-semibold">` + `<span class="text-[10px] text-slate-400">`
  - Towar — ikona Material + nazwa + badge opakowania (`text-[10px] px-1 bg-slate-100 rounded uppercase`)
  - Waga — `font-semibold`
  - Data — dwuwiersz: data + godzina w `text-[10px]`
  - Akcje — sticky right, ikony edit/delete
- **Mapowanie tła wiersza wg statusu:**
  - ROB: `bg-white`, WYS: `bg-blue-50/30`, KOR: `bg-orange-50/30`, KOR_WYS: `bg-teal-50/30`, ZRE: `bg-green-50/30`, ANL: `bg-gray-50/50`, REK: `bg-red-50/30`
- **Obsługiwane interakcje**:
  - Lewy klik → `onRowClick(orderId)`
  - Prawy klik → `onRowContextMenu(orderId, event)`
  - Klik ikony „Wyślij maila" → `onSendEmail(orderId)` (bezpośrednia akcja)
- **Walidacja**: Brak.
- **Typy**: `OrderListItemDto`, `ListViewMode`
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

- **Opis**: Badge statusu zlecenia z mapowaniem koloru i opcjonalną animacją pulsowania. Styl: `flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full`.
- **Główne elementy**: `<span>` z opcjonalną kropką `<span class="w-1.5 h-1.5 rounded-full bg-{color}-600 animate-pulse">` dla aktywnych statusów.
- **Mapowanie kolorów i animacji**:
  - ROB → `bg-slate-100 text-slate-700` — brak pulse
  - WYS → `bg-blue-50 text-blue-600` — **pulse** (aktywny)
  - KOR → `bg-orange-50 text-orange-600` — brak pulse
  - KOR_WYS → `bg-teal-50 text-teal-600` — brak pulse
  - ZRE → `bg-green-50 text-green-600` — brak pulse
  - ANL → `bg-gray-100 text-gray-500` — brak pulse
  - REK → `bg-red-50 text-red-600` — brak pulse
- **Propsy**:
  ```ts
  interface StatusBadgeProps {
    statusCode: OrderStatusCode;
    statusName: string;
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
  - „Przywróć do aktualnych" → `POST /orders/{id}/restore` (w zakładkach ZRE/ANL)
- **Walidacja**:
  - Opcje filtrowane na podstawie `statusCode` i `ALLOWED_MANUAL_STATUS_TRANSITIONS`
  - Opcje edycyjne ukryte dla roli READ_ONLY
  - „Przywróć do aktualnych" widoczne tylko w zakładkach COMPLETED/CANCELLED
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
    onRestore: (orderId: string, targetStatus: "ROB" | "WYS") => void;
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

- **Opis**: Formularz edycji zlecenia z sekcjami: Nagłówek, Strony, Ładunek, Trasa, Finanse, Dokumenty/Uwagi, Status. Siatka 2–4 kolumn, etykiety nad polami.
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
  - Zmiana towaru (autocomplete) → auto-uzupełnienie `defaultLoadingMethodSnapshot`
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

- **Opis**: Sticky stopka draweru z przyciskami akcji.
- **Główne elementy**: `<div>` sticky bottom z przyciskami: Zapisz (primary), Anuluj (outline), Generuj PDF (ghost), Wyślij maila (ghost z ikoną Mail).
- **Obsługiwane interakcje**:
  - „Zapisz" → walidacja techniczna → `PUT /orders/{id}` → toast sukcesu
  - „Anuluj" → zamknięcie draweru (z ostrzeżeniem jeśli dirty)
  - „Generuj PDF" → `POST /orders/{id}/pdf` → pobranie pliku
  - „Wyślij maila" → `POST /orders/{id}/prepare-email` → otwarcie `mailto:` URL / wyświetlenie 422
- **Walidacja**: Brak bezpośrednio — deleguje do handlera.
- **Propsy**:
  ```ts
  interface DrawerFooterProps {
    isReadOnly: boolean;
    isSaving: boolean;
    isDirty: boolean;
    onSave: () => void;
    onCancel: () => void;
    onGeneratePdf: () => void;
    onSendEmail: () => void;
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

### 4.23 ComplaintReasonDialog

- **Opis**: Modal wymagający podania powodu reklamacji przy zmianie statusu na REK.
- **Główne elementy**: shadcn `<Dialog>` z `<Textarea>` i przyciskami „Potwierdź" / „Anuluj".
- **Walidacja**: `complaintReason` niepuste, max 1000 znaków.
- **Propsy**:
  ```ts
  interface ComplaintReasonDialogProps {
    isOpen: boolean;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
  }
  ```

### 4.24 EmptyState

- **Opis**: Komunikat przy pustej liście wyników.
- **Główne elementy**: `<div>` z ikoną, tekstem i opcjonalnym przyciskiem CTA.
- **Warianty**:
  - „Brak zleceń" (pusta zakładka) — z przyciskiem „Dodaj nowy wiersz" (tylko Aktualne)
  - „Brak wyników dla zastosowanych filtrów" — z przyciskiem „Wyczyść filtry"
  - „Zbyt wiele wyników — zawęź filtry"
- **Propsy**:
  ```ts
  interface EmptyStateProps {
    variant: "no_orders" | "no_results" | "too_many_results";
    activeView: ViewGroup;
    onAddOrder?: () => void;
    onClearFilters?: () => void;
  }
  ```

### 4.25 RouteSummaryCell (Node-String)

- **Opis**: Wizualizacja trasy jako ciągu kolorowych węzłów połączonych strzałkami na tle linii. Kluczowy element designu z mockupu `test/main_view.html`.
- **Główne elementy**: `<div class="flex items-center space-x-1 node-line relative">` z `<RouteNode>` × N rozdzielonymi `<span class="z-10 text-slate-300">→</span>`.
- **CSS (global):**
  ```css
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
  ```
- **Kolorystyka węzłów:**
  - LOADING (L1, L2, ...): `z-10 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700`
  - UNLOADING (U1, U2, ...): `z-10 bg-primary/10 dark:bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-primary`
- **Format kodu**: `{L|U}{sequenceNo}:{skrót_miasta}` — np. `L1:KRK`, `U1:BER`
- **Propsy**:
  ```ts
  interface RouteSummaryCellProps {
    stops: Array<{
      kind: StopKind;
      sequenceNo: number;
      cityCode: string;  // skrót miasta (3 litery)
    }>;
  }
  ```

### 4.26 StatusFooter

- **Opis**: Pasek stopki na dole ekranu ze statystykami zleceń i informacjami o stanie systemu. Wzorowany na mockupie `test/main_view.html`.
- **Główne elementy**: `<footer class="h-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 flex items-center justify-between px-4 z-50">`.
- **Lewa strona** — liczniki zleceń wg statusu:
  ```html
  <div class="flex items-center space-x-6 text-[11px] font-medium text-slate-500">
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>Aktywne: {count}</span>
    </div>
    <!-- analogicznie: W trasie, Załadunek, Opóźnione -->
  </div>
  ```
- **Prawa strona**: ikona `monitor_heart` + „System Status: OK" + separator + „Ostatnia aktualizacja: {czas}"
- **Dane**: Obliczane z bieżącej listy zleceń (zliczanie statusów)
- **Propsy**:
  ```ts
  interface StatusFooterProps {
    statusCounts: Record<OrderStatusCode, number>;
    lastUpdateTime: string | null;
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

/** Stan filtrów listy zleceń */
interface OrderListFilters {
  view: ViewGroup;
  transportType?: TransportTypeCode;
  carrierId?: string;
  productId?: string;
  loadingLocationId?: string;
  unloadingLocationId?: string;
  loadingDateFrom?: string;    // YYYY-MM-DD
  loadingDateTo?: string;
  unloadingDateFrom?: string;
  unloadingDateTo?: string;
  search?: string;
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
  defaultLoadingMethodSnapshot: string | null;
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
- **Stan**: `{ orders: OrderListItemDto[]; totalItems: number; isLoading: boolean; error: string | null; filters: OrderListFilters }`
- **Akcje**: `setFilters(partial)`, `setSort(sortBy)`, `refresh()`
- **Efekty**: Przy zmianie filtrów/sortowania/zakładki → `GET /api/v1/orders` z odpowiednimi parametrami. Debounce 300ms na filtrach tekstowych.
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

| Akcja UI | Metoda | Endpoint | Request | Response | Trigger |
|---|---|---|---|---|---|
| Pobierz profil | GET | `/api/v1/auth/me` | — | `AuthMeDto` | Mount AuthProvider |
| Lista zleceń | GET | `/api/v1/orders` | Query: `OrderListQueryParams` | `PaginatedResponse<OrderListItemDto>` | Mount, zmiana filtrów/zakładki/sortowania |
| Szczegóły zlecenia | GET | `/api/v1/orders/{id}` | — | `OrderDetailResponseDto` | Otwarcie draweru |
| Utwórz zlecenie | POST | `/api/v1/orders` | Body: `CreateOrderCommand` | `CreateOrderResponseDto` | Klik „Dodaj nowy wiersz" |
| Aktualizuj zlecenie | PUT | `/api/v1/orders/{id}` | Body: `UpdateOrderCommand` | `UpdateOrderResponseDto` | Klik „Zapisz" w drawerze |
| Anuluj zlecenie | DELETE | `/api/v1/orders/{id}` | — | `DeleteOrderResponseDto` | Menu → „Anuluj" |
| Zmień status | POST | `/api/v1/orders/{id}/status` | Body: `ChangeStatusCommand` | `ChangeStatusResponseDto` | Menu → „Zmień status" |
| Przywróć zlecenie | POST | `/api/v1/orders/{id}/restore` | Body: `RestoreOrderCommand` | — | Menu → „Przywróć" |
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
| „Zmień status" → REK | Otwarcie modalu powodu reklamacji → POST status |
| „Skopiuj zlecenie" | POST duplicate → nowy wiersz na liście → otwarcie draweru |
| „Anuluj zlecenie" | Modal potwierdzenia → DELETE → odświeżenie listy |
| „Przywróć do aktualnych" | POST restore → wiersz wraca do zakładki Aktualne |

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
| Dozwolone przejścia ręczne | Frontend filtruje opcje wg `ALLOWED_MANUAL_STATUS_TRANSITIONS` (z config) |
| REK wymaga complaintReason | Frontend otwiera modal `ComplaintReasonDialog` przed wysłaniem |
| Przywracanie z ANL < 24h | API sprawdza; frontend wyświetla błąd 403/409 |
| Status WYS/KOR_WYS ustawiany automatycznie | Brak opcji ręcznej w UI — realizowane przez prepare-email |

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
| **totalItems > pageSize** | Za dużo wyników | Komunikat „Zbyt wiele wyników — zawęź filtry" |

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
   │   │   └── AppHeader.tsx
   │   │   └── SyncButton.tsx
   │   │   └── UserMenu.tsx
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
6. **Zaimplementować `AuthContext.tsx`** — provider + hook `useAuth()` z `login()`, `logout()`, `refreshUser()`.
7. **Zaimplementować `DictionaryContext.tsx`** — provider + hook `useDictionaries()` z ładowaniem 6 słowników po zalogowaniu.
8. **Zaimplementować stronę logowania** (`src/pages/index.astro` + `LoginCard.tsx`) — formularz, Supabase Auth, redirect.
9. **Zaimplementować `Layout.astro`** — aktualizacja tytułu, meta, font Inter.
10. **Zaimplementować `AppHeader.tsx`** — sticky header (`h-14`) z logo (primary ikona), tytułem (UPPERCASE), zakładkami OrderTabs (w środku), SyncButton, UserMenu + avatar z inicjałami. Wzór: `test/main_view.html`.

### Faza 2: Lista zleceń

11. **Zaimplementować stronę `/orders`** (`src/pages/orders.astro`) — wyspa React `<OrdersApp>` z providerami.
12. **Zaimplementować hook `useOrders.ts`** — stan filtrów, pobieranie listy, debounce, odświeżanie.
13. **Zaimplementować `OrdersPage.tsx`** — główny kontener: FilterBar + ListSettings + OrderTable + EmptyState + StatusFooter (zakładki przeniesione do AppHeader).
14. **Zaimplementować `OrderTabs.tsx`** — trzy zakładki w nagłówku: `bg-slate-100 rounded-lg p-1`, aktywna: `bg-white shadow-sm text-primary`.
15. **Zaimplementować `FilterBar.tsx`** — wszystkie pola filtrów z debounce.
16. **Zaimplementować `AutocompleteFilter`** — generyczny komponent filtra z autocomplete (shadcn Command).
17. **Zaimplementować `ListSettings.tsx`** — pageSize + viewMode toggle.
18. **Zaimplementować komponenty badge'ów** — `StatusBadge.tsx` (z pulsem dla WYS), `TransportTypeBadge.tsx`.
19. **Zaimplementować `OrderTable.tsx`** — tabela z `min-w-[1280px]`, sticky nagłówkiem (`bg-slate-50, text-[11px] uppercase`), sticky kolumną Akcje z prawej (shadow), hover na wierszach. Wzór: `test/main_view.html`.
20. **Zaimplementować `OrderRow.tsx`** — kompaktowy wiersz (`py-1 px-4 text-[12px]`) z tłem wg statusu, dwuwiersz przewoźnika, towar z ikoną + badge, dwa warianty kolumn.
21. **Zaimplementować `RouteSummaryCell.tsx`** — wizualizacja trasy node-string z kolorowymi węzłami (emerald załadunki, primary rozładunki), linią łączącą (pseudo-element `::after`) i strzałkami. Format: `L1:KRK → L2:KAT → U1:BER`.
22. **Zaimplementować `LockIndicator.tsx`** — ikona blokady z tooltipem.
23. **Zaimplementować `AddOrderButton.tsx`** — przycisk tworzenia zlecenia.
24. **Zaimplementować `EmptyState.tsx`** — trzy warianty pustego stanu.

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
54. **Dodać kolorystykę wierszy wg statusu** — jaśniejszy odcień koloru statusu jako tło wiersza (ROB: white, WYS: blue-50/30, KOR: orange-50/30, itd.).
55. **Zaimplementować `StatusFooter.tsx`** — pasek stopki ze statystykami: liczniki zleceń wg statusu (kolorowe kropki), status systemu, czas aktualizacji. Sticky na dole: `h-10 bg-slate-50 border-t`.
56. **Dodać animację pulsowania** do StatusBadge dla aktywnych statusów (WYS → `animate-pulse`).
57. **Dodać dark mode** — warianty `dark:` dla wszystkich komponentów. Tło: `#101922`, nagłówek: `bg-slate-900`, tabela: `bg-slate-800`/`bg-slate-900`.
58. **Dodać responsywność** — jeden breakpoint, tabela z `min-w-[1280px]` i scrollbar-hide.
59. **Dodać ukrywanie akcji dla READ_ONLY** — sprawdzanie roli we wszystkich komponentach z akcjami.
60. **Testować przepływy end-to-end** — logowanie, CRUD, wysyłka, historia, synchronizacja, blokada, przywracanie.
