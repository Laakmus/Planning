# Architektura UI dla Drawer Edycji Zlecenia Transportowego

## 1. Przegląd struktury UI

Drawer edycji zlecenia to główny interfejs do tworzenia i modyfikacji szczegółowych danych zlecenia transportowego. Jest to panel boczny (sheet) wysuwany z prawej strony ekranu, który zapewnia kompleksowy dostęp do wszystkich danych zlecenia w jednym, przewijalnym formularzu.

### Główne cele
- **Centralne miejsce edycji**: Wszystkie dane zlecenia edytowane w jednym miejscu
- **Bezpieczeństwo współbieżności**: Mechanizm blokad zapobiega konfliktom przy równoczesnej edycji
- **Elastyczność zapisu**: Możliwość zapisania wersji roboczej (draft) z niekompletnymi danymi
- **Walidacja dwupoziomowa**: Walidacja techniczna przy zapisie, biznesowa przy wysyłce
- **Audytowalność**: Pełna historia zmian i metadane edycji

### Kluczowe cechy architektoniczne
- **Tryb edycji vs readonly**: Automatyczne przełączanie w zależności od blokady i roli użytkownika
- **7 sekcji tematycznych (0–6)**: Logiczne grupowanie pól formularza
- **Sticky header i footer**: Nawigacja i akcje zawsze widoczne
- **Dynamiczne zależności**: Auto-aktualizacja pól zależnych (waluta, oddział, sposób załadunku)
- **Graceful degradation**: Obsługa stanów błędów i konfliktów blokad

---

## 2. Przepływ użytkownika i stany drawera

### 2.1 Otwarcie drawera (Lock Flow)

```
Użytkownik klika wiersz w tabeli zleceń
    ↓
System wywołuje POST /api/v1/orders/{id}/lock
    ↓
    ├─→ Sukces (200)
    │   ├─ Drawer otwiera się w trybie EDYCJI
    │   ├─ Pobieranie danych: GET /api/v1/orders/{id}
    │   ├─ Wszystkie pola edytowalne (zgodnie z rolą)
    │   └─ Przyciski akcji: Zapisz, Generuj PDF, Wyślij maila
    │
    └─→ Konflikt (409) - zlecenie zablokowane przez innego użytkownika
        ├─ Drawer otwiera się w trybie READONLY
        ├─ Komunikat: "Zlecenie edytowane przez [imię użytkownika]"
        ├─ Wszystkie pola disabled/grayed out
        ├─ Brak przycisków: Zapisz, Generuj PDF, Wyślij maila
        └─ Aktywne: Historia zmian, Zamknij
```

### 2.2 Zamknięcie drawera (Unlock Flow)

```
Użytkownik zamyka drawer (X / Escape / backdrop / Zamknij)
    ↓
System sprawdza: Czy są niezapisane zmiany?
    ↓
    ├─→ NIE (brak zmian)
    │   ├─ POST /api/v1/orders/{id}/unlock
    │   └─ Drawer zamyka się natychmiast
    │
    └─→ TAK (są niezapisane zmiany)
        ├─ Wyświetlenie modala z 3 opcjami:
        │   ├─ "Zapisz i zamknij" → PUT /orders/{id} → unlock → zamknij
        │   ├─ "Odrzuć i zamknij" → unlock → zamknij (bez zapisu)
        │   └─ "Zostań" → modal zamyka się, drawer pozostaje otwarty
        └─ Kliknięcie w backdrop → ten sam modal
```

### 2.3 Tryby drawera

| Tryb | Warunek wejścia | Dostępne akcje | Stan pól |
|------|----------------|----------------|----------|
| **EDYCJA** | Lock sukces (200) + rola ADMIN/PLANNER | Zapisz, Generuj PDF, Wyślij maila, Historia zmian, Zamknij | Wszystkie pola edytowalne |
| **READONLY (blokada)** | Lock konflikt (409) | Historia zmian, Zamknij | Wszystkie pola disabled |
| **READONLY (rola)** | Lock sukces + rola READ_ONLY | Historia zmian, Zamknij | Wszystkie pola disabled |

---

## 3. Struktura komponentów drawera

### 3.1 Hierarchia komponentów

```
OrderDrawer (główny kontener)
│
├─ DrawerHeader (sticky top)
│  ├─ OrderNumber (readonly)
│  ├─ HistoryLink
│  └─ CloseButton (X)
│
├─ DrawerContent (scrollable)
│  │
│  ├─ Section0_Header
│  │  ├─ OrderNumberField (readonly)
│  │  ├─ CreatedDateField (readonly)
│  │  ├─ CreatedByField (readonly)
│  │  └─ HistoryLinkField
│  │
│  ├─ Section1_Route
│  │  ├─ TransportTypeSelect (wymagane)
│  │  ├─ StopsList
│  │  │  └─ StopItem[] (LOADING / UNLOADING)
│  │  │     ├─ CompanyAutocomplete
│  │  │     ├─ BranchSelect (zależny od firmy)
│  │  │     ├─ AddressField (readonly, auto z oddziału)
│  │  │     ├─ TaxIdField (readonly, auto z firmy)
│  │  │     ├─ DatePicker
│  │  │     ├─ TimePicker
│  │  │     ├─ NotesField
│  │  │     └─ DeleteButton
│  │  ├─ AddLoadingStopButton (max 8)
│  │  └─ AddUnloadingStopButton (max 3)
│  │
│  ├─ Section2_Cargo
│  │  ├─ CargoItemsList
│  │  │  └─ CargoItem[]
│  │  │     ├─ ProductAutocomplete (wymagane)
│  │  │     ├─ QuantityInput (wymagane, tony)
│  │  │     ├─ LoadingMethodSelect (domyślnie z produktu, nadpisywalne)
│  │  │     ├─ NotesField
│  │  │     └─ DeleteButton
│  │  └─ AddCargoItemButton
│  │
│  ├─ Section3_Carrier
│  │  ├─ CarrierAutocomplete (wymagane)
│  │  ├─ TaxIdField (readonly, auto z firmy)
│  │  ├─ VehicleTypeSelect (wymagane)
│  │  ├─ VehicleVolumeCombobox (wymagane, 10-100 m³)
│  │  └─ RequiredDocumentsSelect (2 opcje)
│  │
│  ├─ Section4_Finance
│  │  ├─ PriceInput (wymagane do wysyłki)
│  │  ├─ CurrencySelect (wymagane, auto z typu transportu)
│  │  ├─ PaymentTermInput (domyślnie 21 dni)
│  │  └─ PaymentMethodSelect (domyślnie "Przelew")
│  │
│  ├─ Section5_Notes
│  │  └─ GeneralNotesTextarea (max 500 znaków)
│  │
│  └─ Section6_Status
│     ├─ CurrentStatusBadge (readonly)
│     ├─ NewStatusSelect (tylko dozwolone przejścia)
│     ├─ ChangeStatusButton (zmienia przy "Zapisz")
│     └─ ComplaintReasonField (widoczne tylko dla Reklamacja)
│
└─ DrawerFooter (sticky bottom)
   ├─ SaveButton (primary, PUT /orders/{id})
   ├─ CloseButton (obsługa niezapisanych zmian)
   ├─ GeneratePdfButton (POST /orders/{id}/pdf)
   ├─ SendEmailButton (POST /orders/{id}/prepare-email)
   └─ HistoryLink (opcjonalnie)
```

---

## 4. Szczegółowa specyfikacja sekcji formularza

### Sekcja 0: Nagłówek

**Cel**: Wyświetlenie metadanych zlecenia (kto, kiedy, identyfikator)

| Pole | Typ | Źródło danych (API) | Logika |
|------|-----|---------------------|--------|
| Nr zlecenia | Text (readonly) | `order.orderNo` | Generowany przez serwer, niezmienny |
| Data utworzenia | Date (readonly) | `order.createdAt` | Format: DD.MM.YYYY |
| Przez kogo utworzone | Text (readonly) | `order.createdByUserName` | Imię i nazwisko |
| Historia zmian | Link | - | Otwiera panel historii obok drawera |

**Layout**: 2-kolumnowa siatka, kompaktowy układ

---

### Sekcja 1: Trasa

**Cel**: Definicja rodzaju transportu i pełnej trasy (załadunki + rozładunki)

#### Pola globalne sekcji

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Rodzaj transportu* | Select | `order.transportTypeCode` | Wymagane | Wartości: krajowy, eksport drogowy, kontener morski, import. **Auto-aktualizuje walutę w Sekcji 5** (kraj→PLN, eksport/import→EUR/USD) |

#### Punkty trasy (Stops)

**Źródło**: `stops[]` z API, każdy punkt:
```typescript
{
  id: string | null,
  kind: "LOADING" | "UNLOADING",
  sequenceNo: number,
  dateLocal: string | null,      // YYYY-MM-DD
  timeLocal: string | null,      // HH:MM:SS
  locationId: string | null,
  locationNameSnapshot: string | null,
  companyNameSnapshot: string | null,
  addressSnapshot: string | null,
  notes: string | null
}
```

**Layout punktu trasy**: Grid `grid-cols-2 md:grid-cols-route` gdzie `grid-cols-route: "11fr 6fr 3fr 3fr"` (Tailwind config):
- Kolumna 1 (11fr): Firma (z ikoną `business`)
- Kolumna 2 (6fr): Oddział (z ikoną `location_on`)
- Kolumna 3 (3fr): Data (z ikoną `calendar_today`)
- Kolumna 4 (3fr): Godzina

**Pola na punkt trasy**:

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Firma | Input text + ikona | - | - | Wyszukiwanie w `GET /api/v1/companies`. **Przy zmianie firmy: zerowanie Oddziału, Adresu, NIP**. Ikona Material: `business` |
| Oddział firmy | Select + ikona | - | - | **Zależne od Firmy**: `GET /api/v1/locations?companyId={id}`. **Przy wyborze: auto-wypełnienie Adresu i NIP**. Ikona Material: `location_on` |
| Adres | Text (readonly, pod grid) | `stop.addressSnapshot` | - | Auto z wybranego oddziału. Format: "ulica, kod, miasto, kraj". Ikona Material: `home`, styl: `text-xs text-slate-500 dark:text-slate-400` |
| Data załadunku/rozładunku | Input text + ikona | `stop.dateLocal` | Format dd.mm | Ręczny wpis format dd.mm (frontend konwertuje na YYYY-MM-DD). Ikona Material: `calendar_today` jako overlay (absolute right) |
| Godzina | Combobox (Popover + Command) | `stop.timeLocal` | Format HH:MM | Lista slotów co 30 min (04:00–22:00) z możliwością wpisania niestandardowego czasu. Auto-scroll do wybranej/najbliższej wartości. Przycisk X do wyczyszczenia. Wzorzec identyczny z `AutocompleteField`. Implementacja: prywatny `TimeCombobox` w `RoutePointCard.tsx` |
| Uwagi do punktu | Input text + ikona (pod grid) | `stop.notes` | Max 500 znaków | Opcjonalne. Ikona Material: `comment`, styl: `text-xs` |

**Przyciski akcji**:
- **"Dodaj załadunek"**: Dodaje punkt `kind: "LOADING"` wstawiany za ostatnim istniejącym LOADING, limit: **max 8 załadunków**
- **"Dodaj rozładunek"**: Dodaje punkt `kind: "UNLOADING"` wstawiany przed ostatnim istniejącym UNLOADING, limit: **max 3 rozładunki**
- **Drag-and-drop / przyciski góra-dół**: Zmiana kolejności punktów (aktualizacja `sequenceNo`); upuszczenie UNLOADING na pierwszą pozycję jest zablokowane (element wraca na poprzednią pozycję), upuszczenie LOADING na ostatnią pozycję jest zablokowane
- **Usuń punkt**: Oznacza punkt jako `_deleted: true` w payloadzie PUT

**Reguła kolejności przystanków**:
- Pierwszy przystanek: zawsze LOADING (załadunek)
- Ostatni przystanek: zawsze UNLOADING (rozładunek)
- Środkowe przystanki: dowolny mix LOADING/UNLOADING
- `renumberAndBuild()` tylko renumeruje `sequenceNo` w miejscu — NIE sortuje przystanków wg rodzaju

**Minimalna trasa**: 1 załadunek + 1 rozładunek (walidacja biznesowa przy wysyłce, nie blokuje zapisu draftu)

---

### Sekcja 2: Towar

**Cel**: Lista pozycji towarowych (produkty, ilości, sposób załadunku)

**Źródło**: `items[]` z API:
```typescript
{
  id: string | null,
  productId: string | null,
  productNameSnapshot: string | null,
  defaultLoadingMethodSnapshot: string | null,
  loadingMethodCode: string | null,
  quantityTons: number | null,
  notes: string | null
}
```

**Layout pozycji towarowej**: Grid `grid-cols-12 gap-2`:
- Kolumna 1 (col-span-12 md:col-span-6): Nazwa towaru (z ikoną `label`)
- Kolumna 2 (col-span-6 md:col-span-2): Ilość w t (z ikoną `scale`)
- Kolumna 3 (col-span-6 md:col-span-4): Sposób załadunku (z ikoną `widgets`)

**Pola na pozycję towarową**:

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Nazwa towaru* | Input text + ikona | `item.productId` | Wymagane do wysyłki | Wyszukiwanie w `GET /api/v1/products`. **Przy wyborze towaru: auto-ustawienie Sposobu załadunku** (z `defaultLoadingMethodSnapshot`), ale nadpisywalne. Ikona Material: `label` |
| Ilość w t* | Number input + ikona | `item.quantityTons` | Wymagane do wysyłki, ≥0 | Jednostka: tony (t), styl: `text-sm`, step="0.1", min="0". Ikona Material: `scale` |
| Sposób załadunku | Select + ikona | `item.loadingMethodCode` | - | Wartości: paleta, paleta + BigBag, luzem, kosze. **Domyślnie z produktu, ale użytkownik może nadpisać**. Ikona Material: `widgets` |
| Komentarz | Input text + ikona (pod grid) | `item.notes` | Max 500 znaków | Uwagi do pozycji, styl: `text-xs`. Ikona Material: `comment` |

**Przyciski akcji**:
- **"Dodaj kolejny asortyment"**: Dodaje nowy `CargoItem` (brak limitu). Styl: `bg-amber-500/10 text-amber-500 border border-amber-500/30`
- **"Usuń pozycję"**: Oznacza pozycję jako `_deleted: true`. Ikona `close`, hover: `text-red-500`

**Suma automatyczna**: Wyświetlana pod listą pozycji w osobnym bloku `bg-slate-50 dark:bg-slate-800/30`:
- Tekst: "Razem: {suma}t"
- Ikona Material: `summarize`
- Styl: `text-sm font-bold text-slate-400`

---

### Sekcja 3: Firma transportowa

**Cel**: Wybór przewoźnika i specyfikacja pojazdu

**Layout sekcji**: Pola w osobnych wierszach z ikonami, tło `bg-slate-50 dark:bg-slate-900/20`, padding `p-4`, rounded `rounded-xl`.

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Nazwa firmy (przewoźnik)* | Input text + ikona | `order.carrierCompanyId` | Wymagane do wysyłki | Firmy typu przewoźnik: `GET /api/v1/companies?type=carrier`. **Przy wyborze: auto-wypełnienie NIP**. Ikona Material: `local_shipping` |
| NIP | Input text readonly + ikona | `order.carrierNameSnapshot` (lub z companies) | - | Auto z wybranej firmy, disabled. Ikona Material: `badge` |
| Typ auta* | Select + ikona | `order.vehicleVariantCode` (część) | Wymagane | Wartości: Firanka, Hakowiec, Wywrotka, Bus, Hakowiec z HDS. Mapowanie na `vehicle_type` w `vehicle_variants`. Ikona Material: `directions_car`. Grid: `col-span-12 md:col-span-7` |
| Objętość w m³* | Select + ikona | `order.vehicleCapacityVolumeM3` | Wymagane | Lista: 10 m³, 20 m³, 30 m³, ..., 100 m³ (co 10 m³). **Na MVP: select z wartościami z listy** (nie combobox z wpisem). Ikona Material: `straighten`. Grid: `col-span-12 md:col-span-5` |
| Wymagane dokumenty | Select + ikona | `order.requiredDocumentsText` | - | **2 opcje**: (1) "WZ, KPO, kwit wagowy", (2) "WZE, Aneks VII, CMR". Użytkownik wybiera **jedną** opcję z listy (select, **nie checkboxes**). Ikona Material: `description` |

**Uwaga o `vehicleVariantCode`**:
- PRD mówi o "wariancie pojazdu" łączącym typ + objętość (np. `FIRANKA_90M3`)
- API `/vehicle-variants` zwraca strukturę:
  ```json
  {
    "code": "FIRANKA_90M3",
    "name": "firanka 90m³",
    "vehicleType": "FIRANKA",
    "capacityVolumeM3": 90.0
  }
  ```
- **Logika UI**: Użytkownik wybiera **Typ auta** (select) i **Objętość** (select) **oddzielnie** w grid `grid-cols-12 gap-3`, frontend mapuje na odpowiedni `code` przy zapisie

**Style wizualne**:
- Etykiety: `text-xs font-semibold text-slate-400 block mb-1`
- Inputy/selecty: `w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg focus:ring-primary focus:border-primary text-sm py-1.5 px-2`
- NIP readonly: `bg-slate-100 dark:bg-slate-800` z `readonly disabled`

---

### Sekcja 4: Finanse

**Cel**: Warunki finansowe transportu

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Stawka* | Number | `order.priceAmount` | Wymagane do wysyłki, ≥0 | Kwota za cały transport. Przy nowym zleceniu: puste |
| Waluta* | Select | `order.currencyCode` | Wymagane | PLN, EUR, USD. **Auto-ustawiana z Rodzaju transportu** (Sekcja 1): kraj→PLN, eksport/import→EUR lub USD. **Auto-aktualizacja przy każdej zmianie rodzaju transportu**, ale użytkownik może ręcznie wybrać inną |
| Termin płatności | Number | `order.paymentTermDays` | - | Dni. Domyślnie: 21 |
| Forma płatności | Select | `order.paymentMethod` | - | Domyślnie: "Przelew" |

**Zależność z Sekcją 1**:
- Zmiana `Rodzaj transportu` → auto-aktualizacja `Waluta` (ale nie nadpisuje ręcznej zmiany użytkownika w tej samej sesji edycji)
- Logika: przy zmianie `transportTypeCode` sprawdzamy, czy użytkownik ręcznie zmienił walutę; jeśli nie → aktualizujemy

---

### Sekcja 5: Uwagi

**Cel**: Uwagi ogólne do zlecenia

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Uwagi ogólne do zlecenia | Textarea | `order.generalNotes` | Max 500 znaków | Wielowierszowe pole tekstowe |

**Układ**: Jedno pole na całą szerokość drawera

---

### Sekcja 6: Sekcja zmian (Status)

**Cel**: Zarządzanie statusem zlecenia i powodem reklamacji

**Layout sekcji**: Tło `bg-slate-50 dark:bg-slate-900/20`, padding `p-4`, rounded `rounded-xl`.

| Pole | Typ | Źródło | Walidacja | Logika |
|------|-----|--------|-----------|--------|
| Aktualny status | Badge readonly + ikona | `order.statusCode` / `order.statusName` | - | Wyświetlanie pełnej nazwy: Robocze, Wysłane, Korekta, Korekta wysłane, Zrealizowane, Reklamacja, Anulowane. Badge z odpowiednim kolorem (patrz StatusBadge). Ikona Material: `label` |
| Wybór nowego statusu | Przyciski (button group) + ikona | - | Tylko dozwolone przejścia | **Przyciski zamiast select**: `flex flex-wrap gap-2`, każdy przycisk z ikoną i tekstem. Kliknięty przycisk ma `ring-2 ring-offset-2 ring-{color}-500`. Ikona Material: `sync_alt` |
| Powód reklamacji | Textarea + ikona (conditional) | `order.complaintReason` | **Wymagane przy Reklamacja** | **Widoczne tylko gdy**: aktualny status = Reklamacja **LUB** użytkownik kliknie przycisk Reklamacja. Tło `bg-red-500/5 border border-red-500/20`. **Bez wypełnienia: zapis zablokowany**. Ikona Material: `report_problem`, alert `⚠️` |

**Przyciski statusów** (przykłady):
- **Zrealizowane**: `bg-green-500/10 text-green-500 border-2 border-green-500/30`, ikona `check_circle`
- **Reklamacja**: `bg-red-500/10 text-red-500 border-2 border-red-500/30`, ikona `report_problem`
- **Anulowane**: `bg-slate-500/10 text-slate-500 border-2 border-slate-500/30`, ikona `cancel`
- Wybrany przycisk dodatkowo: `ring-2 ring-offset-2 ring-{color}-500`

**Informacja dla użytkownika** (pod sekcją):
- Komunikat: "Zmiana statusu zostanie zapisana razem z całym formularzem przy kliknięciu \"Zapisz\" w stopce"
- Ikona Material: `info`, styl: `text-xs text-slate-500`

**Dozwolone przejścia ręczne** (zgodnie z PRD 3.1.7):

| Z statusu | Na status | Uwagi |
|-----------|-----------|-------|
| robocze | zrealizowane, anulowane | Reklamacja NIE jest dostępna z robocze |
| wysłane | zrealizowane, reklamacja*, anulowane | * Reklamacja wymaga `complaintReason` |
| korekta | zrealizowane, reklamacja*, anulowane | |
| korekta wysłane | zrealizowane, reklamacja*, anulowane | |
| reklamacja | zrealizowane, anulowane | |
| zrealizowane | - | Bezpośrednia zmiana niemożliwa; najpierw przywrócić (endpoint `/restore`), potem zmienić |
| anulowane | - | Bezpośrednia zmiana niemożliwa; najpierw przywrócić (endpoint `/restore`), potem zmienić |

**Statusy ustawiane automatycznie** (nie przez Select, tylko przez akcje):
- **wysłane** ← robocze: automatycznie przy `POST /prepare-email`
- **korekta wysłane** ← korekta: automatycznie przy `POST /prepare-email`
- **korekta** ← wysłane/korekta wysłane: automatycznie przy `PUT /orders/{id}` z wykryciem zmian pól biznesowych

**Widoczność Sekcji 7**: Zawsze widoczna, także przy nowym zleceniu (status: robocze)

---

## 5. Stopka drawera (Sticky Footer)

**Przyciski akcji**:

| Przycisk | Styl | Endpoint | Logika | Widoczność |
|----------|------|----------|--------|-----------|
| **Zapisz** | Primary | `PUT /api/v1/orders/{id}` | Zapisuje wszystkie zmiany (nagłówek + stops + items + ewentualna zmiana statusu z Sekcji 7). Po zapisie: odświeżenie danych (GET), toast sukcesu. **Nie wymusza kompletności pól wymaganych do wysyłki** | Tryb edycji |
| **Zamknij** | Secondary | - | Zamyka drawer. Przy niezapisanych zmianach: modal „Zapisać?" | Zawsze |
| **Generuj PDF** | Secondary | `POST /api/v1/orders/{id}/pdf` | Pobiera plik PDF zlecenia | Tryb edycji |
| **Wyślij maila** | Secondary | `POST /api/v1/orders/{id}/prepare-email` | **Walidacja biznesowa** (422): sprawdza kompletność pól wymaganych. Przy brakach: alert na górze formularza z listą, Outlook nie otwiera się. Przy sukcesie: otwarcie Outlooka z PDF, **automatyczna zmiana statusu** (robocze→wysłane, korekta→korekta wysłane) | Tryb edycji |
| **Historia zmian** | Link (opcjonalnie) | - | Otwiera panel historii. Alternatywnie dostępne z nagłówka | Zawsze (readonly: tylko odczyt) |

**Zachowanie "Zapisz"**:
1. Wywołanie `PUT /orders/{id}` z całym formularzem (wszystkie sekcje 0–6)
2. Payload zawiera:
   - Pola nagłówkowe (transportTypeCode, currencyCode, priceAmount, etc.)
   - `stops[]` z flagą `_deleted` dla usuniętych punktów
   - `items[]` z flagą `_deleted` dla usuniętych pozycji
   - Ewentualnie zmiana statusu (jeśli użytkownik użył Sekcji 6)
3. Po sukcesie (200):
   - Odświeżenie danych drawera (`GET /orders/{id}` lub wykorzystanie odpowiedzi)
   - Toast: "Zmiany zapisane"
   - Status może się zmienić na "korekta" jeśli zlecenie było wysłane
4. Po błędzie (400, 422):
   - Wyświetlenie komunikatów walidacji inline pod polami

**Zachowanie "Wyślij maila"**:
1. Wywołanie `POST /orders/{id}/prepare-email`
2. Serwer sprawdza kompletność:
   - Typ transportu, przewoźnik, nadawca, odbiorca
   - Min. 1 załadunek + 1 rozładunek z datą i godziną
   - Min. 1 pozycja towarowa z ilością
   - Stawka (jeśli wymagana)
3. Przy brakach (422):
   - Alert na górze formularza: "Brak wymaganych pól: [lista]"
   - Outlook nie jest otwierany
4. Przy sukcesie (200):
   - Otwarcie Outlooka z nowym mailem + załączony PDF
   - Status automatycznie zmienia się: robocze→wysłane, korekta→korekta wysłane
   - Aktualizacja `sentByUserName`, `sentAt` w bazie

---

## 6. Walidacja i obsługa błędów

### 6.1 Walidacja techniczna (przy "Zapisz")

**Kiedy**: Inline po próbie zapisu, opcjonalnie przy blur dla pól wymaganych

**Sprawdzane**:
- Formaty dat (YYYY-MM-DD), godzin (HH:MM:SS), liczb
- Limity punktów trasy (8 załadunków, 3 rozładunki)
- Limity znaków (uwagi max 500)
- `quantityTons ≥ 0`

**Prezentacja błędów**:
- Komunikat inline pod polem (czerwony tekst, ikona)
- Przykład: "Data musi być w formacie DD.MM.YYYY"
- Toast na górze: "Nie udało się zapisać. Popraw błędy w formularzu."

**Logika**: Zlecenie można zapisać jako draft z nieuzupełnionymi polami wymaganymi do wysyłki (biznesowa walidacja dopiero przy "Wyślij maila")

---

### 6.2 Walidacja biznesowa (przy "Wyślij maila")

**Kiedy**: Tylko przy `POST /prepare-email`

**Sprawdzane** (zgodnie z API Plan sekcja 2.15):
- Typ transportu (wymagane)
- Przewoźnik (wymagane)
- Nadawca (shipper, wymagane)
- Odbiorca (receiver, wymagane)
- Min. 1 załadunek + 1 rozładunek z datą i godziną
- Min. 1 pozycja towarowa + ilość w t
- Stawka (priceAmount, jeśli wymagana przed wysyłką)

**Pola opcjonalne** (nie blokują wysyłki):
- `paymentTermDays`, `paymentMethod`
- `generalNotes`, `requiredDocumentsText`

**Prezentacja błędów** (422):
- Alert na górze formularza (sticky, nad Sekcją 1)
- Treść: "Nie można wysłać zlecenia. Uzupełnij wymagane pola:"
  - Lista brakujących pól (np. "Przewoźnik", "Data załadunku w punkcie L1")
- Outlook **nie** jest otwierany
- Formularz pozostaje w trybie edycji

---

### 6.3 Obsługa konfliktów blokady

**Scenariusz 1: Blokada przy otwarciu (409)**
- Drawer otwiera się w trybie readonly
- Komunikat: "Zlecenie edytowane przez [imię użytkownika]"
- Wszystkie pola disabled
- Brak przycisków akcji (poza Historia zmian, Zamknij)

**Scenariusz 2: Utrata blokady podczas edycji**
- Próba zapisu (`PUT /orders/{id}`) zwraca 409
- Modal: "Blokada wygasła lub przejął ją inny użytkownik. Drawer zostanie zamknięty. Zapisz swoje zmiany lokalnie (jeśli to możliwe)."
- Drawer zamyka się, lista zleceń odświeża się

**MVP**: Brak okresowego sprawdzania blokady (ping). W przyszłości: co 30s `GET /orders/{id}` sprawdza `lockedByUserId`

---

### 6.4 Stany puste i błędy ładowania

**Błąd ładowania danych (`GET /orders/{id}` fail)**:
- Drawer wyświetla komunikat: "Nie udało się załadować zlecenia. Spróbuj ponownie."
- Przycisk "Odśwież" lub "Zamknij"

**Brak punktów trasy**:
- Minimalna trasa przy pierwszym otwarciu: 1 pusty załadunek + 1 pusty rozładunek (domyślnie)

**Brak pozycji towarowych**:
- Minimalna lista: 1 pusta pozycja towarowa (domyślnie)

---

## 7. Dynamiczne zależności między sekcjami

### 7.1 Rodzaj transportu → Waluta (Sekcja 1 → Sekcja 4)

**Logika**:
1. Użytkownik zmienia `Rodzaj transportu` w Sekcji 1
2. Frontend sprawdza, czy użytkownik ręcznie zmienił walutę w **bieżącej sesji edycji**
3. Jeśli NIE (waluta nie była ręcznie modyfikowana):
   - Auto-aktualizacja `Waluta`:
     - kraj → PLN
     - eksport drogowy, kontener morski, import → EUR (lub USD, do ustalenia domyślną)
4. Jeśli TAK (użytkownik ręcznie wybrał walutę):
   - Brak auto-aktualizacji (zachowanie wyboru użytkownika)

**Implementacja**:
- State: `userModifiedCurrency: boolean` (inicjalnie `false`)
- Przy ręcznej zmianie waluty: `userModifiedCurrency = true`
- Przy zmianie rodzaju transportu: `if (!userModifiedCurrency) { updateCurrency() }`

---

### 7.2 Firma → Oddziały → Adres + NIP (Sekcja 1)

**Przepływ dla punktu trasy**:

```
Użytkownik wybiera Firmę (autocomplete)
    ↓
Frontend wywołuje GET /api/v1/locations?companyId={id}
    ↓
Lista oddziałów ładuje się do pola "Oddział firmy" (select)
    ↓
    ├─ Jeśli użytkownik zmienił firmę (nie pierwsza wartość):
    │  └─ Zerowanie: Oddział = null, Adres = "", NIP = ""
    │
    └─ Użytkownik wybiera Oddział
        ↓
        Auto-wypełnienie:
        - Adres (readonly): z location.street_and_number, postal_code, city, country
        - NIP (readonly): z company.tax_id
```

**Źródła danych**:
- `GET /api/v1/companies` (autocomplete firm)
- `GET /api/v1/locations?companyId={uuid}` (lista oddziałów)
- Adres: `location.street_and_number`, `postal_code`, `city`, `country`
- NIP: `company.tax_id`

---

### 7.3 Towar → Domyślny sposób załadunku (Sekcja 2)

**Przepływ**:

```
Użytkownik wybiera Towar (autocomplete)
    ↓
Frontend pobiera product.default_loading_method_code
    ↓
Auto-ustawienie pola "Sposób załadunku"
    ↓
    └─ Użytkownik może nadpisać wartość (select edytowalny)
```

**Źródła**:
- `GET /api/v1/products` (autocomplete towarów)
- `product.defaultLoadingMethodCode` → mapowanie na `item.loadingMethodCode`

---

### 7.4 Status → Powód reklamacji (Sekcja 6)

**Logika widoczności**:
- Pole "Powód reklamacji" widoczne **tylko gdy**:
  - Aktualny status = `reklamacja` **LUB**
  - Użytkownik wybiera przejście na `reklamacja` w Selectcie "Nowy status"

**Walidacja**:
- Przy zmianie statusu na `reklamacja` pole `complaintReason` jest **wymagane** (nie może być puste)
- Bez wypełnienia: zapis zablokowany, komunikat: "Powód reklamacji jest wymagany"

---

### 7.5 Snapshoty danych słownikowych (Immutable)

**Koncepcja**:
- Przy wyborze firmy, lokalizacji lub towaru system zapisuje nazwę, adres i inne dane z tego momentu jako „snapshot" (migawkę)
- Snapshoty służą do zachowania dokładnych danych, które były użyte w zleceniu, nawet jeśli później dane w słowniku ulegną zmianie (np. firma zmieni nazwę, oddział zmieni adres)
- Pola snapshot w bazie: `carrierNameSnapshot`, `locationNameSnapshot`, `companyNameSnapshot`, `addressSnapshot`, `productNameSnapshot`, `defaultLoadingMethodSnapshot`, `senderContactName`, `senderContactPhone`, `senderContactEmail`

**Zachowanie w UI**:
- Snapshoty są **immutable** (niezmienne automatycznie) — system **nie aktualizuje** ich automatycznie, gdy zmienią się dane w słowniku
- W drawerze pola snapshot **nie są wyświetlane jako osobne readonly pola** — dane są pokazywane jako część autocomplete/select results
- Użytkownik może **ręcznie edytować** snapshoty (np. poprawić literówkę w nazwie firmy) poprzez bezpośrednią edycję wartości w polach tekstowych (jeśli pole jest edytowalne)
- **Typowy przepływ**: użytkownik wybiera firmę z autocomplete → system zapisuje snapshot nazwy → jeśli użytkownik ręcznie zmieni nazwę w polu, zmienia snapshot
- W MVP: większość snapshotów jest wypełniana automatycznie z wyboru autocomplete/select i nie ma osobnych pól do edycji; ręczna edycja snapshotów może być dodana w przyszłości jako zaawansowana funkcja

**Przykład**:
```
1. Użytkownik wybiera "Transport Express Sp. z o.o." z autocomplete firm
   → Backend zapisuje: carrierNameSnapshot = "Transport Express Sp. z o.o."
2. Firma w słowniku zmienia nazwę na "Trans Express S.A."
3. W drawerze przy edycji tego zlecenia nadal widać: "Transport Express Sp. z o.o." (snapshot)
4. Przy tworzeniu NOWEGO zlecenia użytkownik zobaczy nową nazwę: "Trans Express S.A."
```

---

## 8. Mapowanie API endpoints do akcji UI

| Akcja UI | Metoda HTTP | Endpoint | Request Body | Response | Stan po sukcesie |
|----------|-------------|----------|--------------|----------|------------------|
| **Otwarcie drawera** | POST | `/api/v1/orders/{id}/lock` | `{}` | `{ id, lockedByUserId, lockedAt }` | Tryb edycji (200) lub readonly (409) |
| **Pobranie danych** | GET | `/api/v1/orders/{id}` | - | `{ order, stops[], items[] }` | Drawer wypełniony danymi |
| **Zapisz** | PUT | `/api/v1/orders/{id}` | `{ transportTypeCode, currencyCode, ..., stops[], items[] }` | `{ id, statusCode, updatedAt }` | Odświeżenie danych, toast sukcesu |
| **Zmień status** | POST | `/api/v1/orders/{id}/status` | `{ newStatusCode, complaintReason? }` | `{ id, oldStatusCode, newStatusCode }` | Status zaktualizowany, odświeżenie |
| **Generuj PDF** | POST | `/api/v1/orders/{id}/pdf` | `{ regenerate?: true }` | `application/pdf` (binary) | Pobranie pliku PDF |
| **Wyślij maila** | POST | `/api/v1/orders/{id}/prepare-email` | `{ forceRegeneratePdf?: false }` | `{ orderId, statusBefore, statusAfter, emailOpenUrl, pdfFileName }` | Otwarcie Outlooka, zmiana statusu (robocze→wysłane, korekta→korekta wysłane) |
| **Zamknięcie drawera** | POST | `/api/v1/orders/{id}/unlock` | `{}` | `{ id, lockedByUserId: null }` | Drawer zamknięty, blokada zwolniona |
| **Lista firm** | GET | `/api/v1/companies` | Query: `?type=carrier&search={text}` | `{ items: Company[] }` | Autocomplete wypełniony |
| **Lista lokalizacji** | GET | `/api/v1/locations` | Query: `?companyId={uuid}` | `{ items: Location[] }` | Select oddziałów wypełniony |
| **Lista produktów** | GET | `/api/v1/products` | Query: `?search={text}` | `{ items: Product[] }` | Autocomplete wypełniony |
| **Lista wariantów pojazdów** | GET | `/api/v1/vehicle-variants` | - | `{ items: VehicleVariant[] }` | Select typu auta + objętości |
| **Historia zmian** | GET | `/api/v1/orders/{id}/history/changes` | - | Historia zmian pól | Panel historii obok drawera |

---

## 9. Stan lokalny formularza (React State)

### 9.1 Główny state drawera

```typescript
interface OrderDrawerState {
  // Metadane
  mode: 'EDIT' | 'READONLY_LOCK' | 'READONLY_ROLE';
  isOpen: boolean;
  orderId: string | null;
  isLoading: boolean;
  hasUnsavedChanges: boolean;

  // Dane zlecenia (źródło: GET /orders/{id})
  order: OrderDetail | null;
  stops: OrderStop[];
  items: OrderItem[];

  // Śledzenie zmian użytkownika
  userModifiedFields: Set<string>; // np. 'currency', 'stops.0.company'

  // Błędy walidacji
  validationErrors: Record<string, string>; // key: ścieżka pola, value: komunikat
  businessValidationAlert: string | null; // alert na górze (przy błędzie wysyłki)

  // Autocomplete data (cache)
  companiesCache: Company[];
  locationsCache: Record<string, Location[]>; // key: companyId
  productsCache: Product[];
  vehicleVariantsCache: VehicleVariant[];
}
```

### 9.2 Dirty checking (wykrywanie zmian)

**Strategia**:
1. Przy otwarciu drawera: zapisz snapshot początkowy (`initialData`)
2. Przy każdej zmianie pola: porównaj aktualny state z `initialData`
3. Jeśli różne: `hasUnsavedChanges = true`
4. Przy zapisie (sukces): zaktualizuj `initialData = currentData`, `hasUnsavedChanges = false`

**Implementacja**: Deep comparison lub tracking zmian per pole

---

## 10. Accessibility i UX

### 10.1 Nawigacja klawiaturą

- **Tab**: Przechodzenie między polami (zgodnie z kolejnością w formularzu)
- **Escape**: Zamknięcie drawera (z obsługą niezapisanych zmian)
- **Ctrl/Cmd + S**: Zapis formularza (skrót)
- **Ctrl/Cmd + Enter**: Wyślij maila (skrót, po potwierdzeniu)

### 10.2 Screen readers

- Wszystkie pola z `<label>` i `aria-label`
- Komunikaty walidacji z `aria-live="polite"` dla inline errors
- Alert biznesowy (top) z `role="alert"` i `aria-live="assertive"`
- Tryb readonly: `aria-disabled="true"` na polach

### 10.3 Loading states

- **Otwarcie drawera**: Skeleton loader na nagłówku + sekcjach
- **Zapisywanie**: Przycisk "Zapisz" z spinnerem, disabled, tekst "Zapisywanie..."
- **Generowanie PDF**: Przycisk z spinnerem
- **Autocomplete**: Loading indicator w polu podczas ładowania opcji

### 10.4 Feedback użytkownika

| Akcja | Feedback |
|-------|----------|
| Zapis sukces | Toast (zielony): "Zmiany zapisane" (3s) |
| Zapis błąd | Toast (czerwony): "Nie udało się zapisać" + inline errors |
| Wysyłka sukces | Toast (zielony): "Zlecenie wysłane. Otwarto Outlooka." (5s) + zmiana statusu |
| Wysyłka błąd (422) | Alert sticky na górze: "Uzupełnij wymagane pola: [lista]" |
| Blokada konflikt | Modal: "Zlecenie edytowane przez [imię]" → drawer readonly |
| Utrata blokady | Modal: "Blokada wygasła" → drawer zamyka się |
| Zamknięcie z niezapisanymi | Modal: 3 opcje (Zapisz i zamknij / Odrzuć / Zostań) |

---

## 11. Responsywność

### Desktop (≥1280px)
- Drawer szerokości 720-800px
- Formularz w siatce 2-4 kolumn (zależnie od sekcji)
- Wszystkie akcje widoczne w stopce

### Tablet (768-1279px)
- Drawer szerokości 600-700px
- Formularz w siatce 2 kolumn
- Akcje w stopce mogą się zawijać

### Mobile (<768px)
- Drawer zajmuje 100% szerokości ekranu (pełny ekran)
- Formularz w 1 kolumnie
- Sticky header i footer zachowane
- Przyciski w stopce mogą być ułożone pionowo (pełna szerokość)

---

## 12. Przypadki brzegowe i edge cases

### 12.1 Nowe zlecenie (tworzenie)

**Przepływ**:
1. Użytkownik klika "Nowe zlecenie" w głównym widoku
2. Wywołanie `POST /api/v1/orders` z minimalnym payloadem:
   ```json
   {
     "transportTypeCode": "PL",
     "currencyCode": "PLN",
     "vehicleVariantCode": "FIRANKA_90M3",
     "stops": [],
     "items": []
   }
   ```
3. Serwer zwraca `{ id, orderNo, statusCode: "robocze" }`
4. Drawer otwiera się z nowym ID (bez lock, bo nowe)
5. Status początkowy: **robocze**
6. Sekcja 6 widoczna od razu

**Alternatywny przepływ** (bez POST, tylko local state):
- Drawer otwiera się w trybie "create" bez ID
- Wszystkie pola puste
- Przy pierwszym "Zapisz": wywołanie `POST /orders` (tworzenie), potem `PUT /orders/{id}` (aktualizacja)

**Decyzja**: Do ustalenia z PO; pierwszy przepływ (POST na start) jest prostszy dla MVP

---

### 12.2 Zlecenie zrealizowane/anulowane (przywracanie)

**Brak bezpośredniej edycji**:
- Zlecenia w statusie `zrealizowane` lub `anulowane` **nie mają przycisku edycji** w głównym widoku
- Opcja "Przywróć do aktualnych" w menu kontekstowym (prawy klik)
  - Wywołanie `POST /orders/{id}/restore`
  - Status zmienia się na `korekta`
  - Zlecenie wraca do widoku "Aktualne"
  - Dopiero wtedy można otworzyć drawer edycji

**Drawer dla zrealizowanych/anulowanych** (jeśli otwarty):
- Tryb readonly (bez blokady)
- Brak przycisków: Zapisz, Generuj PDF, Wyślij maila
- Aktywne: Historia zmian, Zamknij, Przywróć do aktualnych (nowy przycisk w stopce)

---

### 12.3 Limit punktów trasy przekroczony

**Scenariusz**: Użytkownik próbuje dodać 9. załadunek (limit: 8)

**Obsługa**:
1. Przycisk "Dodaj załadunek" staje się disabled
2. Tooltip: "Osiągnięto maksymalną liczbę punktów załadunku (8)"
3. Przy próbie zapisu z >8 załadunkami: błąd walidacji 400 od serwera
4. Komunikat: "Maksymalnie 8 punktów załadunku"

Analogicznie dla rozładunków (limit: 3)

---

### 12.4 Zmiana firmy z wypełnionym oddziałem

**Scenariusz**: Użytkownik wypełnił Firmę + Oddział + Adres, potem zmienia Firmę

**Obsługa**:
1. Przy zmianie pola "Firma":
   - Zerowanie: `Oddział = null`, `Adres = ""`, `NIP = ""`
   - Wczytanie nowej listy oddziałów dla nowej firmy
2. Użytkownik musi ponownie wybrać oddział
3. Komunikat (opcjonalnie): "Zmiana firmy wyzeruje oddział i adres"

---

### 12.5 Powód reklamacji (wymagany)

**Scenariusz 1**: Użytkownik zmienia status na "reklamacja" bez wypełnienia powodu

**Obsługa**:
1. Przy kliknięciu "Zapisz":
   - Walidacja frontendowa: `if (newStatus === 'reklamacja' && !complaintReason) { error }`
   - Komunikat inline: "Powód reklamacji jest wymagany"
   - Zapis zablokowany
2. Pole "Powód reklamacji" highlightowane (czerwona ramka)

**Scenariusz 2**: Użytkownik zamyka modal zmiany statusu bez wypełnienia powodu

**Obsługa**:
- Zmiana statusu **nie** jest zapisywana (anulowana)
- Aktualny status pozostaje bez zmian
- Komunikat: "Zmiana statusu anulowana"

---

## 13. Performance considerations

### 13.1 Lazy loading

- **Autocomplete**: Ładowanie opcji dopiero przy focus/input (nie przy otwarciu drawera)
- **Oddziały**: Ładowanie listy dopiero po wyborze firmy (nie wszystkie naraz)
- **Historia zmian**: Panel historii ładuje dane dopiero po kliknięciu linku (nie przy otwarciu drawera)

### 13.2 Debouncing

- **Autocomplete search**: Debounce 300ms dla wyszukiwania w `GET /companies`, `/products`, `/locations`
- **Dirty checking**: Debounce 100ms dla porównań deep equality

### 13.3 Caching

- **Słowniki**: Cache `companies`, `vehicleVariants` w pamięci (rzadko się zmieniają)
- **Lokalizacje per firma**: Cache `locations` z kluczem `companyId` (unikanie duplikacji requestów)
- **TTL**: 5 minut dla słowników, potem odświeżenie

### 13.4 Optimistic updates

- **Zmiana kolejności punktów trasy**: Optymistyczna aktualizacja `sequenceNo` w UI, potem zapis przy "Zapisz"
- **Dodawanie/usuwanie pozycji**: Natychmiastowa zmiana w UI (z `id: null` dla nowych, `_deleted: true` dla usuniętych)

---

## 14. Security considerations

### 14.1 Autoryzacja

- **Rola READ_ONLY**: Drawer zawsze w trybie readonly, brak przycisków akcji
- **Blokada**: Serwer weryfikuje `lockedByUserId` przy każdym `PUT /orders/{id}`
- **Zmiana statusu**: Dozwolone przejścia egzekwowane po stronie serwera (frontend tylko UI)

### 14.2 Sanitization

- **Pola tekstowe**: Wszystkie inputy sanitizowane przed wysłaniem (escape HTML)
- **XSS prevention**: React domyślnie escapuje treść, ale uwaga na `dangerouslySetInnerHTML` (nie używać)

### 14.3 CSRF

- **Tokens**: Supabase JWT w nagłówku `Authorization`
- **Cookies**: HTTP-only, Secure, SameSite=Strict

---

## 15. Testing strategy

### 15.1 Unit tests (komponenty)

- **DrawerHeader**: Renderowanie numeru zlecenia, zamknięcie
- **Section1_Route**: Dodawanie/usuwanie punktów, zmiana kolejności, limity (8/3)
- **Section2_Cargo**: Dodawanie/usuwanie pozycji, auto-ustawienie sposobu załadunku
- **Section4_Finance**: Auto-aktualizacja waluty przy zmianie rodzaju transportu
- **Section6_Status**: Widoczność powodu reklamacji, dozwolone przejścia

### 15.2 Integration tests

- **Lock flow**: Sukces (200) vs konflikt (409)
- **Save flow**: PUT sukces, walidacja techniczna (400), konflikt blokady (409)
- **Send email flow**: Sukces (200, Outlook), walidacja biznesowa (422, alert)
- **Unsaved changes modal**: Zamknięcie z niezapisanymi zmianami, 3 opcje

### 15.3 E2E tests (Playwright/Cypress)

- **Pełny przepływ tworzenia zlecenia**: Nowe zlecenie → wypełnienie wszystkich sekcji → zapis → wysyłka maila
- **Edycja istniejącego**: Otwarcie → zmiana pól → zapis → weryfikacja w liście
- **Blokada współbieżna**: Dwa użytkownicy próbują edytować to samo zlecenie
- **Zmiana statusu**: Przejścia ręczne (zrealizowane, reklamacja, anulowane)

---

## 16. Kluczowe komponenty do implementacji

### Priorytet 1 (MVP)
1. **OrderDrawer** (główny kontener + routing modów)
2. **DrawerHeader** + **DrawerFooter** (sticky)
3. **Section1_Route** (trasa + punkty + limity + zależności firma→oddział→adres)
4. **Section2_Cargo** (pozycje towarowe + auto sposób załadunku)
5. **Section3_Carrier** (przewoźnik + vehicle variant)
6. **Section4_Finance** (finanse + auto waluta)
7. **Section6_Status** (zmiana statusu + powód reklamacji)
8. **UnsavedChangesModal** (3 opcje przy zamknięciu)
9. **ValidationAlert** (sticky alert biznesowy na górze)

### Priorytet 2 (post-MVP)
1. **Section0_Header** (metadane readonly)
2. **Section5_Notes** (uwagi ogólne)
3. **HistoryPanel** (historia zmian obok drawera)
4. **DragAndDrop** dla punktów trasy (zmiana kolejności)
5. **Keyboard shortcuts** (Ctrl+S, Escape, Ctrl+Enter)

---

## 17. Mapowanie PRD do architektury UI

### Rozwiązania problemów użytkownika (z PRD sekcja 2)

| Problem z PRD | Rozwiązanie w Drawer UI |
|---------------|-------------------------|
| 2.1: Arkusz z ~120 kolumnami, trudna czytelnośćą | **7 sekcji tematycznych (0–6)** w logicznej kolejności; formularz przewijalny, sticky header/footer |
| 2.2: Konflikty przy równoczesnej edycji | **Mechanizm blokad** (lock/unlock); tryb readonly przy konflikcie (409) |
| 2.3: Nieaktualne dane słownikowe | **Autocomplete z live data** (GET /companies, /products, /locations) |
| 2.4: Trudne filtrowanie i analiza | (N/A dla drawera; rozwiązane w głównym widoku listy) |
| 2.5: Generowanie PDF i wysyłka ściśle z Excelem | **Przyciski "Generuj PDF" i "Wyślij maila"** w stopce drawera; integracja z Outlookiem |

### Zgodność z wymaganiami funkcjonalnymi (PRD sekcja 3)

| Wymaganie | Sekcja UI | Implementacja |
|-----------|-----------|---------------|
| 3.1.5: Formularz zlecenia (nagłówek, strony, ładunek, trasa, finanse, uwagi) | Wszystkie sekcje 0–6 | Pełne odwzorowanie struktury PRD |
| 3.1.6: Blokada współbieżna | Lock flow (sekcja 2.1) | POST /lock przy otwarciu, POST /unlock przy zamknięciu |
| 3.1.7: Statusy i cykl życia | Sekcja 6 | Dozwolone przejścia, auto-zmiana przy wysyłce |
| 3.1.9: Integracja z ERP (słowniki) | Autocomplete w Sekcjach 1, 2, 3 | GET /companies, /products, /locations |
| 3.1.10: Generowanie PDF | Przycisk w stopce | POST /orders/{id}/pdf |
| 3.1.11: Wysyłka maila | Przycisk w stopce | POST /orders/{id}/prepare-email + walidacja biznesowa |
| 3.1.13: Walidacja danych | Sekcje 6.1, 6.2 | Techniczna (inline), biznesowa (alert) |
| 3.1.14: Zapis danych | Przycisk "Zapisz" | PUT /orders/{id}, ostrzeżenie przy niezapisanych zmianach |

### Historyjki użytkowników (PRD sekcja 5)

| US ID | Tytuł | Realizacja w UI |
|-------|-------|-----------------|
| US-021 | Edycja zlecenia w widoku szczegółowym | **Cały drawer** = widok szczegółowy; sekcje 0–6 |
| US-022 | Blokada edycji przez wielu użytkowników | **Lock flow** (sekcja 2.1); tryb readonly przy konflikcie |
| US-023 | Zmiana statusu | **Sekcja 6** + przycisk "Zapisz"; dozwolone przejścia |
| US-024 | Status korekta i korekta wysłane | Auto-zmiana przy PUT (wykrycie zmian) + przy prepare-email |
| US-030-032 | Trasa: min 1L+1U, max 8L+3U, zmiana kolejności | **Sekcja 1**: limity, przyciski dodaj/usuń, drag-and-drop |
| US-040-042 | Autocomplete firm, lokalizacji, towarów | **Sekcje 1, 2, 3**: autocomplete z GET /api |
| US-050 | Generowanie PDF | **Przycisk "Generuj PDF"** w stopce |
| US-051 | Otwarcie Outlooka z PDF | **Przycisk "Wyślij maila"** w stopce; walidacja biznesowa (422) |
| US-080-081 | Ręczny zapis, ostrzeżenie przed utratą | **Przycisk "Zapisz"**; modal przy zamknięciu z niezapisanymi zmianami |

---

## 18. Kolejne kroki implementacji

### Faza 1: Infrastruktura (tydzień 1)
1. Stworzenie `OrderDrawer` komponentu (routing modów: EDIT/READONLY)
2. Implementacja lock/unlock flow (API calls + error handling)
3. Dirty checking (initial snapshot, porównanie, `hasUnsavedChanges`)
4. `UnsavedChangesModal` (3 opcje)

### Faza 2: Sekcje krytyczne (tydzień 2)
1. **Sekcja 1 (Trasa)**: Punkty, autocomplete firm, zależności oddział→adres, limity
2. **Sekcja 2 (Towar)**: Pozycje, autocomplete produktów, auto sposób załadunku
3. **Sekcja 3 (Przewoźnik)**: Autocomplete firm, vehicle variant
4. **Sekcja 4 (Finanse)**: Auto waluta z rodzaju transportu

### Faza 3: Walidacja i akcje (tydzień 3)
1. Walidacja techniczna (inline errors przy zapisie)
2. Walidacja biznesowa (alert przy wysyłce 422)
3. **Przycisk "Zapisz"**: PUT /orders/{id}, odświeżenie, toast
4. **Przycisk "Wyślij maila"**: POST /prepare-email, obsługa 422, otwarcie Outlooka

### Faza 4: Pozostałe sekcje i polish (tydzień 4)
1. **Sekcja 0 (Nagłówek)**: Metadane readonly
2. **Sekcja 5 (Uwagi)**: Textarea
3. **Sekcja 6 (Status)**: Select, powód reklamacji
4. **Historia zmian**: Panel obok drawera
5. Accessibility (keyboard nav, screen readers)
6. Responsywność (mobile, tablet)

### Faza 5: Testing i bugfixing (tydzień 5)
1. Unit tests (komponenty sekcji)
2. Integration tests (lock flow, save, send email)
3. E2E tests (Playwright: pełny przepływ)
4. Performance optimization (lazy loading, caching, debouncing)

---

## 19. Dokumentacja techniczna do przygotowania

1. **Component API**: Props, events, state dla każdej sekcji
2. **Type definitions**: TypeScript interfaces dla `OrderDetail`, `OrderStop`, `OrderItem`, etc.
3. **API client**: Wrapper dla wszystkich endpointów `/orders/*` z error handling
4. **Validation schemas**: Zod/Yup schemas dla walidacji technicznej
5. **Storybook**: Stories dla każdej sekcji w izolacji (EDIT/READONLY modes)

---

## 20. Podsumowanie kluczowych decyzji architektonicznych

| Decyzja | Uzasadnienie |
|---------|--------------|
| **7 sekcji tematycznych (0–6)** | Zgodność z PRD 3.1.5a; logiczne grupowanie pól |
| **Sticky header + footer** | Nawigacja i akcje zawsze widoczne przy przewijaniu długiego formularza |
| **Lock/unlock przy otwarciu/zamknięciu** | Bezpieczeństwo współbieżności; proste API (2 endpointy) |
| **Tryb readonly przy konflikcie** | Alternatywa: odrzucenie otwarcia; readonly pozwala na podgląd |
| **Modal przy niezapisanych zmianach** | Ochrona przed utratą danych; standardowy pattern UX |
| **Walidacja dwupoziomowa** (techniczna + biznesowa) | Elastyczność draftu; blokada wysyłki dopiero przy kompletnych danych |
| **Auto-aktualizacja zależnych pól** (waluta, oddział, sposób załadunku) | Redukcja błędów; zgodność z PRD (domyślne wartości) |
| **Zmiana statusu w Sekcji 6, zapis przy "Zapisz"** | Spójność: wszystkie zmiany (dane + status) zapisywane razem |
| **Powód reklamacji wymagany** | Egzekwowanie reguły biznesowej z PRD 3.1.7 |
| **Autocomplete z live data** | Integracja z ERP (PRD 3.1.9); zawsze aktualne dane |
| **Optimistic updates dla UI** (kolejność punktów, dodawanie pozycji) | Responsywność UI; rzeczywisty zapis przy "Zapisz" |

---

**Wersja dokumentu**: 1.0
**Data**: 2026-02-13
**Autor**: Architekt Frontend
**Status**: Do review przez Product Owner i Tech Lead
