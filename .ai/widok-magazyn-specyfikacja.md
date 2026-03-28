# Specyfikacja widoku tygodniowego dla magazynu
## Projekt: Odylion Sp. z o.o. Sp. k. – Aplikacja planowania transportów

---

## 1. Cel widoku

Nowy widok tygodniowy dedykowany pracownikom magazynu poszczególnych oddziałów firmy Odylion. Zastępuje konieczność korzystania z głównego widoku planistycznego — prezentuje wyłącznie dane istotne dla magazynu: zaplanowane załadunki i rozładunki dla konkretnego oddziału w danym tygodniu.

---

## 2. Dostęp i role

- Widok dostępny dla ról: **ADMIN**, **PLANNER**, **READ_ONLY**
- Widok jest **tylko do odczytu** — brak możliwości edycji, zmiany statusów ani żadnych interakcji ze zleceniami
- Domyślnie użytkownik widzi **dane swojego oddziału** — oddział przypisany jest do konta użytkownika w polu `user_profiles.location_id` (FK → `locations`)
- **Selektor oddziałów** (BranchSelector) — dropdown w nagłówku widoku, pozwala przełączać się między oddziałami tej samej firmy
  - Wyświetla tylko lokalizacje firmy użytkownika (na podstawie `companyId` lokalizacji użytkownika)
  - Ukryty gdy firma ma tylko 1 oddział
  - Domyślna wartość: oddział użytkownika z profilu
- Oddział przekazywany do API jako opcjonalny query param `locationId` — walidowany server-side (musi należeć do firmy INTERNAL)

---

## 3. Ścieżka URL

```
/warehouse?week=12&year=2026
```

- Parametry query: `week` (1–53) i `year` (YYYY) — opcjonalne, domyślnie bieżący tydzień
- Opcjonalny query param `locationId` — UUID oddziału (override domyślnego z profilu)
- Strona Astro: `src/pages/warehouse.astro` + React island (analogicznie do `/orders`)
- Parametry query parsowane client-side w hooku `useWarehouseWeek`

---

## 4. Nawigacja i nagłówek widoku

### 4.1 Nagłówek tygodnia
Nagłówek wyświetla aktualnie przeglądany tydzień w formacie:
```
Tydzień 12 | 17.03 – 21.03.2026
```

Nagłówek umieszczony jest **NAD scroll containerem** (sticky, nie scrolluje się z zawartością).

### 4.2 Nawigacja między tygodniami
- Strzałka **◀ wstecz** – przejście do poprzedniego tygodnia
- Strzałka **▶ dalej** – przejście do następnego tygodnia
- **Pole numeryczne** – użytkownik może wpisać numer tygodnia bezpośrednio, aby przejść do wybranego tygodnia (np. wpisanie `15` przenosi do tygodnia 15 bieżącego roku)
- **Brak selektora miesiąca** — nawigacja wyłącznie przez strzałki i pole nr tygodnia

---

## 5. Struktura widoku

### 5.1 Zakres tygodnia
- Widok obejmuje wyłącznie **dni robocze: Poniedziałek – Piątek** (5 kart)
- Stopy przypadające na **weekend (sobota/niedziela)** przypisywane są do **piątku** z adnotacją tekstową `"(sob. DD.MM)"` lub `"(niedz. DD.MM)"` przy godzinie

### 5.2 Layout — karty per dzień z jedną tabelą chronologiczną
Widok składa się z **5 kart** (jedna per dzień roboczy), ułożonych pionowo. Każda karta zawiera:
- **Nagłówek dnia** — nazwa dnia + data, format: `Poniedziałek 17.03.2026`
  - Brak licznika operacji w nagłówku
  - Brak wyróżnienia wizualnego bieżącego dnia — wszystkie dni wyglądają identycznie
- **Jedną tabelę chronologiczną** — mieszanka załadunków i rozładunków posortowanych wg godziny
  - Rozróżnienie przez badge **Zał** (załadunek) / **Roz** (rozładunek) w kolumnie Typ
  - **Brak podziału na lewą/prawą stronę** — jedna tabela, wspólna chronologia
  - **Brak kolorowego tła wierszy** per typ operacji — badge Zał/Roz jest wystarczającym rozróżnieniem

### 5.3 Nagłówek tabeli (thead)
- **Sticky** przy scrollowaniu (w ramach każdej karty dnia)
- Nazwy kolumn: Typ | Godzina | Nr zlecenia | Towar / Masa | Przewoźnik | Awizacja

### 5.4 Scroll i paginacja
- **Bez paginacji** — cały tydzień ładowany jednorazowo
- Scroll pionowy przez karty dnia
- Nagłówek tygodnia + nawigacja sticky na górze
- Na wąskich ekranach możliwy poziomy scroll z paskiem

### 5.5 Pusty dzień
Gdy brak operacji w danym dniu, karta wyświetla komunikat: *"Brak zaplanowanych operacji"*

### 5.6 Zlecenia bez przypisanej daty
Na dole widoku (pod kartami dni) — opcjonalna sekcja **"Bez przypisanej daty"**:
- Widoczna tylko gdy istnieją zlecenia z pustą datą stopu w oddziale użytkownika
- Ukryta gdy pusta (brak komunikatu o braku danych)
- Wyświetla te same kolumny co karty dniowe (bez kolumny Godzina — bo brak daty)

---

## 6. Kolumny tabeli (finalna struktura)

| # | Kolumna | Szerokość | Format |
|---|---------|-----------|--------|
| 1 | **Typ** | w-20, text-center | Badge: "Zał" (niebieski bg-blue-100 text-blue-700) / "Roz" (zielony bg-emerald-100 text-emerald-700) |
| 2 | **Godzina** | w-16 | HH:MM, font-bold, kolor odpowiadający typowi operacji (blue/emerald) |
| 3 | **Nr zlecenia** | w-24 | ZT2026/0042, font-medium |
| 4 | **Towar / Masa** | min-w-[140px], flex-1 | Nazwa bold + opakowanie text-xs text-muted-foreground + "Razem: XX,X t" font-bold (kolor typu) |
| 5 | **Przewoźnik** | w-48 | Nazwa firmy font-bold + typ pojazdu text-xs text-muted-foreground pod spodem |
| 6 | **Awizacja** | min-w-[160px] | 5 linii bez etykiet (szczegóły w §6.6) |

### 6.1 Kolumna „Typ"
- Badge z zaokrąglonymi rogami: `px-2 py-0.5 rounded text-xs font-semibold`
- **Zał** = załadunek (towar wyjeżdża z oddziału): `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`
- **Roz** = rozładunek (towar przyjeżdża do oddziału): `bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300`

### 6.2 Kolumna „Godzina"
- Format: `HH:MM` (24h)
- Font-bold, kolor tekstu odpowiada typowi operacji (blue dla załadunków, emerald dla rozładunków)
- Stopy weekendowe: godzina + adnotacja `(sob. DD.MM)` w text-xs poniżej

### 6.3 Kolumna „Nr zlecenia"
- Format: `ZT{YYYY}/{NNNN}` (np. ZT2026/0042)
- Font-medium, kliknięcie nie otwiera żadnej akcji (read-only)

### 6.4 Kolumna „Towar / Masa"
- Każdy asortyment w nowej linii:
  - **Nazwa towaru** — font-bold
  - **Opakowanie** — text-xs text-muted-foreground (luzem / bigbag / paleta / inne)
- Na końcu listy **podsumowanie łącznej masy**: `Razem: 24,5 t`
  - Font-bold, kolor tekstu = kolor typu operacji
- Wysokość komórki dynamiczna (max 15 pozycji)

### 6.5 Kolumna „Przewoźnik"
- **Linia 1**: Nazwa firmy transportowej — font-bold
- **Linia 2**: Typ pojazdu — text-xs text-muted-foreground (np. "Ciągnik z naczepą")
- Brak osoby kontaktowej i telefonu firmy (różnica vs główny widok planistyczny)

### 6.6 Kolumna „Awizacja"
Zawiera **5 linii bez etykiet** (dokładnie jak wpisane w drawerze):
```
Jan Kowalski
WA 12345
WA 67890
+48 600 000 000
000123456
```

Dane awizacji wyświetlane z pola `notification_details` (textarea w Sekcji 3 formularza).
Tekst dzielony po newline na osobne linie.

- Font: text-xs (10px), text-muted-foreground
- Gdy pole puste — wyświetlamy myślnik (—)

> ⚠️ **BDO umieszczone w kolumnie Awizacja** (razem z danymi kierowcy), NIE jako osobna kolumna.

---

## 7. Filtrowanie danych

### 7.1 Widoczne statusy zleceń
W widoku magazynowym wyświetlane są zlecenia o następujących statusach:
- **Robocze**
- **Wysłane**
- **Korekta**
- **Korekta wysłane**
- **Reklamacja**

Zlecenia o statusach: *Zrealizowane*, *Anulowane* — **nie są wyświetlane**.

### 7.2 Filtrowanie po oddziale
- Wyświetlane są wyłącznie zlecenia, w których dany oddział (lokalizacja użytkownika) występuje jako **miejsce załadunku lub rozładunku** w przystankach trasy (`order_stops`)
- Oddział przypisany automatycznie na podstawie `user_profiles.location_id`
- Zlecenie widoczne w każdym dniu, w którym ma **stop w oddziale użytkownika**

### 7.3 Zlecenie z oddziałem jako załadunek I rozładunek
Gdy oddział użytkownika występuje jako miejsce załadunku ORAZ rozładunku w tym samym zleceniu:
- Zlecenie pojawia się jako **dwa osobne wiersze** w tabeli (jeden z badge "Zał", drugi z badge "Roz")
- Każdy wiersz z odpowiednią godziną stopu

### 7.4 Zlecenie z wieloma stopami w różnych dniach
Gdy zlecenie ma stopy w oddziale użytkownika w różnych dniach tygodnia:
- Zlecenie pojawia się **w każdym dniu**, w którym ma stop w oddziale
- Każdy wiersz = konkretny stop (z odpowiednim typem Zał/Roz i godziną)

---

## 8. Footer tygodniowy

Na dole widoku (pod kartami dniowymi i sekcją "Bez daty") — **sticky footer** z podsumowaniem tygodnia:

```
Tydzień 12: Załadunki: 23 (142,5 t) | Rozładunki: 18 (98,3 t) | Łącznie: 240,8 t
```

- Zlicza łączną liczbę operacji załadunkowych i rozładunkowych
- Sumuje masę towarów (tony) per typ operacji
- Łączna masa = załadunki + rozładunki
- Fixed na dole widoku (nie scrolluje się)

---

## 9. Dane awizacji — źródło

Dane awizacji przechowywane w polu `notification_details` (TEXT, max 500 znaków) na tabeli `transport_orders`.
Edytowane w Sekcji 3 (Firma transportowa) formularza zlecenia jako textarea.
Pole edytowalne przez ADMIN i PLANNER. READ_ONLY widzi je jako read-only.

---

## 10. API endpoint

### 10.1 Dedykowany endpoint
```
GET /api/v1/warehouse/orders?week=12&year=2026
```

- Zwraca dane pogrupowane per dzień (Pon–Pt) + sekcja "bez daty"
- Filtruje po `user_profiles.location_id` zalogowanego użytkownika
- Filtruje po statusach: robocze, wysłane, korekta, korekta_wysłane, reklamacja
- Sortuje chronologicznie po godzinie stopu w ramach każdego dnia
- Stopy weekendowe dołączane do piątku

### 10.2 Response DTO
```typescript
interface WarehouseWeekResponseDto {
  week: number;
  year: number;
  weekStart: string; // ISO date (poniedziałek)
  weekEnd: string;   // ISO date (piątek)
  locationName: string; // nazwa oddziału użytkownika
  days: WarehouseDayDto[];        // 5 elementów (Pon–Pt)
  noDateEntries: WarehouseOrderEntryDto[]; // stopy bez daty
  summary: {
    loadingCount: number;
    loadingTotalTons: number;
    unloadingCount: number;
    unloadingTotalTons: number;
  };
}

interface WarehouseDayDto {
  date: string;          // ISO date
  dayName: string;       // "Poniedziałek", "Wtorek", ...
  entries: WarehouseOrderEntryDto[];
}

interface WarehouseOrderEntryDto {
  orderId: string;
  orderNo: string;        // ZT2026/0042
  stopType: "LOADING" | "UNLOADING";
  timeLocal: string | null; // HH:MM
  isWeekend: boolean;       // true jeśli oryginalny dzień = sob/niedz
  originalDate: string | null; // oryginalna data (gdy isWeekend=true)
  items: {
    productName: string;
    loadingMethod: string | null;
    weightTons: number | null;
  }[];
  totalWeightTons: number | null;
  carrierName: string | null;
  vehicleType: string | null;
  notificationDetails: string | null;
}
```

---

## 11. Fonty i rozmiary

- **Font bazowy tabeli**: 13px (spójne z głównym widokiem planistycznym)
- **Awizacja**: 10px (text-xs), text-muted-foreground
- **Nagłówek dnia**: text-lg font-semibold
- **Nagłówek tygodnia**: text-xl font-bold
- **Podsumowanie masy**: font-bold, kolor typu operacji

---

## 12. Druk (Print CSS)

Widok obsługuje drukowanie przez `Ctrl+P` / `Cmd+P`:
- **Layout A4 landscape** (`@page { size: landscape }`)
- Nagłówek tygodnia drukowany na każdej stronie (`@media print` → fixed header)
- Karty dniowe: `break-inside: avoid` gdy możliwe (duże tabele mogą się łamać)
- Ukryte elementy: nawigacja (strzałki + pole tygodnia), sidebar, sticky footer
- Kolory badge'ów zachowane (`print-color-adjust: exact`)
- Tailwind: użycie variantu `print:` (np. `print:hidden`, `print:break-inside-avoid`)

---

## 13. Dark mode

Widok w pełni obsługuje dark mode (spójne z resztą aplikacji):
- Badge'y Zał/Roz: warianty `dark:bg-*-900/30 dark:text-*-300`
- Karty dniowe: `bg-card dark:bg-card` z border
- Nagłówki: `text-foreground`
- Tekst wtórny: `text-muted-foreground`
- Footer: `bg-background/95 backdrop-blur`

---

## 14. Komponenty React (plan)

```
src/pages/warehouse.astro           — strona Astro z React island
src/components/warehouse/
  WarehouseApp.tsx                  — główny kontener (SidebarProvider + AppProviders z src/components/providers/AppProviders.tsx — wspólny wrapper: ThemeProvider → ErrorBoundary → AuthProvider → DictionaryProvider → TooltipProvider)
  WeekNavigation.tsx                — strzałki + pole nr tygodnia + nagłówek tygodnia
  DayCard.tsx                       — karta jednego dnia (nagłówek + tabela)
  OperationsTable.tsx               — tabela operacji (thead + tbody)
  OperationRow.tsx                  — wiersz operacji (Typ, Godzina, Nr, Towar, Przewoźnik, Awizacja)
  OperationTypeBadge.tsx            — badge Zał/Roz
  CargoCell.tsx                     — komórka Towar / Masa
  DispatchInfoCell.tsx              — komórka Awizacja (5 linii)
  WeekSummaryFooter.tsx             — sticky footer z podsumowaniem
  EmptyDayMessage.tsx               — komunikat "Brak zaplanowanych operacji"
src/hooks/
  useWarehouseWeek.ts               — hook: fetch danych, nawigacja tygodniowa, query params
```

---

## 15. Wymagania techniczne

- Frontend: **Astro 5 + React 19 + TypeScript strict + Tailwind CSS 4 + shadcn/ui**
- Widok dostępny w przeglądarce Chrome na laptopach
- Nagłówek tygodnia — sticky przy przewijaniu (NAD scroll containerem)
- Thead per karta dnia — sticky w ramach karty
- Indeks DB: `order_stops(location_id, date_local)` dla wydajnego filtrowania
- Widok tylko do odczytu — brak event handlerów edycji, brak modali
- Używa shadcn Card component do kart dniowych

---

## 16. Wymagania DB (migracja)

### 16.1 Tabela `user_profiles`
- Nowa kolumna: `location_id UUID REFERENCES locations(id)` (nullable)
- Umożliwia powiązanie użytkownika z oddziałem

### 16.2 Tabela `transport_orders`
- Kolumna `notification_details` (TEXT, max 500 znaków) — jedno pole textarea na dane awizacji (patrz §9)

### 16.3 Indeksy
- `CREATE INDEX idx_order_stops_location_date ON order_stops(location_id, date_local)`

### 16.4 RLS
- Endpoint warehouse korzysta z RLS — użytkownik widzi zlecenia tylko ze swoim oddziałem
- Alternatywnie: filtrowanie po `location_id` w service layer (jak obecne endpointy)

---

## 17. Podsumowanie decyzji projektowych

| Temat | Decyzja |
|-------|---------|
| Kto używa | ADMIN, PLANNER, READ_ONLY – wszyscy jako read-only |
| Wybór oddziału | Domyślnie z profilu, BranchSelector do przełączania oddziałów firmy |
| Zakres tygodnia | Pon–Pt (5 dni roboczych), weekend → piątek z adnotacją |
| Nawigacja | Strzałki ◀▶ + pole z nr tygodnia (bez selektora miesiąca) |
| URL | `/warehouse?week=12&year=2026&locationId=UUID` (locationId opcjonalny) |
| Layout dnia | Jedna tabela chronologiczna z badge Zał/Roz (nie L/P split) |
| Wyróżnienie dziś | Brak – wszystkie dni jednolite |
| Tło wierszy per typ | Brak – badge Zał/Roz wystarczy |
| Kolumny | Typ, Godzina, Nr zlecenia, Towar/Masa, Przewoźnik, Awizacja |
| Towar | Każdy asortyment w nowej linii + suma ton (kolor typu) |
| Przewoźnik | Nazwa firmy + typ pojazdu pod spodem |
| Dane awizacji | 5 linii bez etykiet: kierowca, ciągnik, przyczepa, telefon, BDO |
| BDO placement | W kolumnie Awizacja (razem z danymi kierowcy) |
| Fonty | 13px bazowy, 10px awizacja (spójne z mockupem) |
| Format awizacji | 5 linii bez etykiet (dokładnie jak wpisane w drawerze) |
| Nagłówek dnia | Dzień + data (bez licznika operacji) |
| Footer | Tygodniowy: łączna masa + załadunki/rozładunki, sticky na dole |
| Typ pojazdu | Pod nazwą firmy w kolumnie Przewoźnik |
| Nagłówek tygodnia | „Tydzień 12 \| 17.03 – 21.03.2026" |
| Statusy widoczne | Robocze, Wysłane, Korekta, Korekta wysłane, Reklamacja |
| Kolumna statusu | Brak – badge Zał/Roz jedyne rozróżnienie wizualne |
| Zlecenia bez dat | Sekcja "Bez przypisanej daty" na dole (ukryta gdy pusta) |
| Oddział L+U | Dwa osobne wiersze (Zał + Roz) w tej samej tabeli |
| Multi-day stops | Zlecenie w każdym dniu gdzie ma stop w oddziale |
| Paginacja | Bez paginacji – scroll + sticky headers |
| Formularz awizacji | Pole `notification_details` (textarea, max 500) w Sekcji 3 OrderDrawer (Firma transportowa) |
| Druk | Print CSS: A4 landscape, `@media print`, Tailwind `print:` |
| Kliknięcie wiersza | Brak akcji – tylko podgląd |
| API endpoint | Dedykowany `GET /api/v1/warehouse/orders` |
