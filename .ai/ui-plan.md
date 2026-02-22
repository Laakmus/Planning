# Architektura UI dla Systemu Zleceń Transportowych

## 1. Przegląd struktury UI

Aplikacja to wewnętrzne narzędzie webowe do planowania i wystawiania zleceń transportowych, przeznaczone do pracy w przeglądarce Chrome na laptopach. Stos technologiczny: Astro 5 (SSR) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (styl New York, ikony Lucide).

### Struktura aplikacji

Aplikacja składa się z dwóch głównych stanów: niezalogowany (ekran logowania) i zalogowany (widok planistyczny z nagłówkiem). Nie ma tradycyjnej wielostronicowej nawigacji — po zalogowaniu użytkownik pracuje w jednym widoku listy zleceń, z otwieraniem paneli bocznych (drawer) dla edycji zlecenia i historii zmian.

### Hierarchia widoków

**Sticky:** Nagłówek aplikacji, pasek filtrów oraz nagłówek tabeli (nazwy kolumn) są sticky; przewija się **wyłącznie lista wierszy** (ciało tabeli). Na wąskich ekranach tabela przewija się w poziomie z **widocznym** paskiem przewijania u dołu.

```
[Ekran logowania]
    ↓ (po zalogowaniu)
[Nagłówek aplikacji — sticky, z zakładkami; blok użytkownika: imię i nazwisko + rola (tekst), przycisk Wyloguj; bez avatara]
[Pasek filtrów + ustawienia listy — sticky; przycisk „Nowe zlecenie" z prawej (tylko zakładka Aktualne, tylko Admin/Planner)]
[Widok główny — Lista zleceń]
    ├── Tabela zleceń (sticky nagłówek tabeli; min-width 1280px)
    │   ├── (lewy klik wiersza) → [Drawer edycji zlecenia]
    │   │                              └── (link) → [Panel historii zmian]
    │   └── (prawy klik wiersza) → [Menu kontekstowe]
    │                                   ├── Wyślij maila
    │                                   ├── Historia zmian → [Panel historii zmian]
    │                                   ├── Zmień status
    │                                   ├── Skopiuj zlecenie
    │                                   ├── Anuluj zlecenie
    │                                   └── Przywróć do aktualnych (w Zrealizowane/Anulowane)
    └── EmptyState (Brak zleceń / Brak wyników dla filtrów — tylko te dwa warianty)
[Pasek stopki — sticky bottom; liczniki bez „W trasie"/„Załadunek"/„Opóźnione"; po prawej: System Status, Ostatnia aktualizacja]
```

### Mapowanie tras Astro

| Ścieżka | Typ | Opis |
|---|---|---|
| `/` | Strona Astro | Logowanie lub przekierowanie do listy |
| `/orders` | Strona Astro + wyspy React | Widok główny z listą zleceń |
| `/api/v1/*` | Endpointy API | Backend REST (istniejący) |

Nawigacja między logowaniem a widokiem głównym realizowana jest przez standardowe przekierowania HTTP/Astro. Wewnątrz widoku głównego całość obsługiwana jest przez React (zakładki, filtry, drawer, panele) bez przeładowywania strony.

---

## 2. Lista widoków

### 2.1 Ekran logowania

- **Ścieżka**: `/` (lub `/login`)
- **Główny cel**: Uwierzytelnienie użytkownika wewnętrznego firmy za pomocą loginu i hasła.
- **Kluczowe informacje**: Formularz logowania, komunikat o błędzie.
- **Powiązane API**: Supabase Auth (`signInWithPassword`), następnie `GET /api/v1/auth/me` dla pobrania profilu.
- **Historyjki użytkownika**: US-001

#### Kluczowe komponenty widoku

1. **LoginCard** — wyśrodkowana karta na neutralnym tle.
   - Nagłówek z tytułem aplikacji (np. „System Zleceń Transportowych").
   - Pole „Login" (typ email lub text).
   - Pole „Hasło" (typ password).
   - Przycisk „Zaloguj" z obsługą stanu ładowania (spinner / disabled).
   - Jeden ogólny komunikat błędu pod formularzem — bez wskazywania, które pole jest niepoprawne (zgodnie z US-001).

#### UX, dostępność i bezpieczeństwo

- Etykiety powiązane z polami przez `htmlFor`/`id`.
- Submit formularza przez `Enter`.
- Przycisk disabled podczas ładowania, aby uniknąć wielokrotnego wysłania.
- Token JWT przechowywany w HTTP-only cookie (zarządzany przez Supabase Auth / middleware Astro).
- Po zalogowaniu przekierowanie na `/orders`.
- Brak opcji „Zapomniałem hasła" w MVP.

---

### 2.2 Widok główny — Lista zleceń

- **Ścieżka**: `/orders`
- **Uwaga o statusach:** W UI używane są wyłącznie **pełne nazwy** statusów (bez skrótów): Robocze, Wysłane, Korekta, Korekta wysłane, Zrealizowane, Reklamacja, Anulowane. Kolumna status w tabeli i badge wyświetlają `statusName` (pełna nazwa). **Wyjątek:** W tabeli status „Korekta wysłane" wyświetlany jest w skróconej formie **„Korekta_w"** ze względu na ograniczone miejsce w kolumnie. **Mapowanie widoków:** zakładka **Aktualne** = Robocze, Wysłane, Korekta, Korekta wysłane, Reklamacja; zakładka **Zrealizowane** = tylko status Zrealizowane; zakładka **Anulowane** = tylko status Anulowane. Zlecenia zrealizowane i anulowane nie pojawiają się na głównym ekranie (tabela Aktualne).
- **Główny cel**: Prezentacja i zarządzanie listą zleceń transportowych w trzech zakładkach (Aktualne, Zrealizowane, Anulowane) z filtrowaniem, sortowaniem i akcjami.
- **Powiązane API**: `GET /api/v1/orders` (z parametrami `view`, filtrów, sortowania, `pageSize`), `POST /api/v1/orders` (dodanie wiersza), `DELETE /api/v1/orders/{id}` (szybkie anulowanie), `POST /api/v1/orders/{id}/prepare-email`, `POST /api/v1/orders/{id}/status`, `POST /api/v1/orders/{id}/restore`.
- **Historyjki użytkownika**: US-010, US-011, US-012, US-013, US-020, US-023, US-024, US-025, US-026, US-027, US-028, US-050, US-051

#### Kluczowe informacje do wyświetlenia

Zależnie od wybranego widoku (Trasa | Kolumny) tabela wyświetla odpowiedni zestaw kolumn. Pełna definicja kolumn, kolejności i formatu wyświetlania — **PRD sekcja 3.1.2a**. Skrót:
- **Widok Kolumny:** Blokada (ikona) | Nr zlecenia | Status | **Tydzień** | Rodzaj transportu | Miejsce załadunku | Data załadunku | Miejsce rozładunku | Data rozładunku | Towar | Komentarz | Firma transportowa | Typ auta (rodzaj + objętość) | Stawka | Data wysłania zlecenia (imię i nazwisko + data). Tydzień — auto-obliczany z daty załadunku (ISO 8601), liczba całkowita, nie edytowalny. Miejsca zał./rozł. — każdy punkt w nowej linii; daty w formacie **DD.MM** (backend zwraca YYYY-MM-DD, frontend formatuje); **tylko pierwsza data** załadunku/rozładunku z godziną (format DD.MM HH:MM). Data wysłania — linia 1: osoba, linia 2: data (DD.MM).
- **Widok Trasa:** Zamiast czterech kolumn (Miejsce załadunku, Data załadunku, Miejsce rozładunku, Data rozładunku) — jedna kolumna Trasa (node-string L1→L2→U1) oraz dwie osobne kolumny Data załadunku i Data rozładunku (**tylko pierwsza data** z godziną, format DD.MM HH:MM); pozostałe kolumny (Lock, Nr zlecenia, Status, Tydzień, Rodzaj transportu, Towar, Komentarz, Firma transportowa, Typ auta, Stawka, Data wysłania) analogicznie.
- Tło wiersza: tylko statusy Wysłane i Korekta wysłane mają zielone tło (`bg-emerald-50/30`), pozostałe wiersze — białe. Pełne nazwy statusów w UI.

#### Kluczowe komponenty widoku

1. **OrderTabs** — trzy zakładki (Aktualne, Zrealizowane, Anulowane) umieszczone w nagłówku aplikacji (nie nad tabelą).
   - Mapowanie na parametr API `view`: `CURRENT` | `COMPLETED` | `CANCELLED`.
   - Wizualnie: `bg-slate-100 rounded-lg p-1`, aktywna zakładka: `bg-white shadow-sm text-primary font-semibold`, nieaktywna: `text-slate-500`.
   - Przełączanie zakładki resetuje filtry (lub zachowuje — do decyzji implementacyjnej) i wywołuje nowe zapytanie GET.

2. **FilterBar** — pasek filtrów (sticky razem z nagłówkiem tabeli). Kolejność filtrów: rodzaj transportu | status | firma załadunku | firma rozładunku | Firma transportowa | towar | numer tygodnia | wyszukiwanie pełnotekstowe. Z prawej: przycisk „Nowe zlecenie".
   - **Rodzaj transportu:** select (lista zamknięta).
   - **Status:** select (lista zamknięta; jeden status).
   - **Firma załadunku / Firma rozładunku:** autocomplete; użytkownik może wybrać **firmę** (company) lub **konkretną lokalizację** (oddział). Jeśli wybrana firma → API parametr `loadingCompanyId` / `unloadingCompanyId`; jeśli wybrana lokalizacja → `loadingLocationId` / `unloadingLocationId`. Filtr zwraca zlecenia, gdzie firma/lokalizacja występuje na **dowolnym** miejscu załadunku (L1…L8) lub rozładunku (U1…U3).
   - **Firma transportowa:** autocomplete (przewoźnik).
   - **Towar:** autocomplete.
   - **Numer tygodnia:** pole tekstowe (wpis ręczny, np. „07" lub „2026-07"); frontend mapuje na zakres dat `dateFrom`/`dateTo` (ISO week → poniedziałek–niedziela) przed wysłaniem do API.
   - **Wyszukiwanie pełnotekstowe:** słowo lub kilka słów; tylko wiersze zawierające tę kombinację.
   - Przycisk „Wyczyść filtry".
   - Filtry w jednym wierszu; na wąskim ekranie zawijanie na drugi wiersz (flex-wrap). Nazwy filtrów spójne z nazwami kolumn tabeli.

3. **ListSettings** — w tym samym wierszu co pasek filtrów (np. z prawej).
   - Wybór rozmiaru strony: 50 / 100 / 200.
   - Przełącznik widoku listy: **Trasa** | **Kolumny**. Pełna definicja kolumn dla obu widoków — PRD 3.1.2a.

4. **OrderTable** — tabela z listą zleceń.
   - Kontener: `min-w-[1280px]`. Na wąskich ekranach: poziome przewijanie z **widocznym** paskiem przewijania u dołu (użytkownik ma widzieć, że są kolejne kolumny). Na szerokich ekranach scrollbar może być ukryty (`.scrollbar-hide`) — do decyzji implementacyjnej.
   - Sticky nagłówek tabeli: `sticky top-0 bg-slate-50 border-b z-10`, nagłówki `text-[11px] font-bold uppercase tracking-wider`.
   - ~~Sticky kolumna Akcje~~ — **usunięta**; akcje dostępne wyłącznie przez menu kontekstowe (prawy klik) i drawer..
   - Kompaktowe wiersze: `py-1 px-4`, tekst `text-[12px]`.
   - Tło wiersza: tylko Wysłane i Korekta wysłane mają zielone tło (`bg-emerald-50/30`), pozostałe białe.
   - Hover: `rgba(19, 127, 236, 0.04)` na całym wierszu.
   - Sortowanie: klik w nagłówek kolumny → zmiana `sortBy`/`sortDirection`. Domyślnie: `FIRST_LOADING_DATETIME ASC`. Sortowalne kolumny: data załadunku, data rozładunku, numer zlecenia, Firma transportowa.
   - Lewy klik na wiersz → otwarcie draweru edycji.
   - Prawy klik na wiersz → menu kontekstowe (`ContextMenu`).
   - Widok Trasa: kolumna Trasa jako node-string z linią łączącą (patrz sekcja 6.2). Widok Kolumny: osobne kolumny Miejsce załadunku, Miejsce rozładunku, Data załadunku, Data rozładunku — format i kolejność kolumn według PRD 3.1.2a.
   - Typ auta w tabeli: rodzaj + objętość (wybierane w formularzu oddzielnie, wyświetlane łącznie np. „firanka (90m³)").
   - Wirtualizacja listy (np. `@tanstack/react-virtual`) przy dużej liczbie wierszy.

5. **OrderRowContextMenu** — menu kontekstowe (prawy klik na wierszu; na razie **tylko prawy klik**, bez skrótu klawiaturowego).
   - Opcje: „Wyślij maila", „Zmień status" (podmenu), „Kolor" (podmenu z 4 kolorami + „Usuń kolor"), „Skopiuj zlecenie", „Anuluj zlecenie"; w zakładkach Zrealizowane/Anulowane: „Przywróć do aktualnych"; „Historia zmian" (na dole, widoczna dla wszystkich).
   - Podmenu „Kolor": trigger z kolorowymi kwadracikami (`w-2.5 h-2.5 rounded-sm`) + tekst "Kolor"; podmenu z 4 pozycjami (hex + label + checkmark przy wybranym) + separator + „Usuń kolor" (disabled gdy brak koloru).
   - Opcje zależne od roli: READ_ONLY widzi tylko „Otwórz" i „Historia zmian" (brak opcji edycyjnych w tym „Kolor").
   - **Reklamacja:** Przy zmianie statusu na Reklamacja wymagane pole „Powód reklamacji" — zarówno z menu kontekstowego (lista), jak i z draweru. Jeśli użytkownik zamknie okienko/panel bez wpisania powodu, status **nie** zmienia się na Reklamacja (zmiana anulowana).

6. **AddOrderButton** — przycisk „Nowe zlecenie" (lub „Dodaj nowy wiersz"). **Tylko** w zakładce Aktualne, **tylko** dla ról ADMIN i PLANNER, w **jednym miejscu**: w pasie filtrów z prawej strony.
   - Wywołuje `POST /api/v1/orders` z minimalnymi danymi.
   - Po sukcesie nowy wiersz na końcu listy; opcjonalnie automatyczne otwarcie draweru edycji.

7. **EmptyState** — tylko dwa warianty:
   - „Brak zleceń" — gdy zakładka jest pusta (w Aktualne: z przyciskiem „Dodaj nowy wiersz").
   - „Brak wyników dla zastosowanych filtrów" — z przyciskiem „Wyczyść filtry".
   - Wariant „Przekroczono limit wyników — zawęź filtry" **nie jest używany**.

8. **StatusBadge** — komponent badge'a statusu z mapowaniem koloru **bez animacji pulse**:
   - Robocze: szary/neutralny (`bg-slate-100 text-slate-700`).
   - Wysłane: niebieski (`bg-blue-50 text-blue-600 border border-blue-200`).
   - Korekta: pomarańczowy (`bg-orange-50 text-orange-600 border border-orange-200`).
   - Korekta wysłane: bursztynowy (`bg-amber-50 text-amber-700 border border-amber-200`).
   - Zrealizowane: szmaragdowy (`bg-emerald-50 text-emerald-700 border border-emerald-200`).
   - Anulowane: ciemnoszary (`bg-slate-100 text-slate-500 border border-slate-200`).
   - Reklamacja: czerwony (`bg-red-50 text-red-600 border border-red-200`).

#### UX, dostępność i bezpieczeństwo

- Filtry z debounce (300ms) na polach tekstowych i autocomplete.
- Tabela z `role="table"`, nagłówki z `scope="col"`, wiersze z `role="row"`.
- Sortowanie z `aria-sort` na nagłówkach.
- Menu kontekstowe: na razie tylko prawy klik myszy (bez skrótu klawiaturowego).
- Ukrycie/wyłączenie akcji edycyjnych dla roli READ_ONLY.
- Przy błędzie 401 z dowolnego żądania → wylogowanie i przekierowanie na logowanie.
- Zakładka Anulowane: wyświetlanie „Wygasa za X h" (obliczane po stronie klienta na podstawie `createdAt` lub `updatedAt` zlecenia).

---

### 2.3 Drawer edycji zlecenia

- **Cel**: Szczegółowy widok i edycja danych zlecenia transportowego.
- **Typ**: Panel boczny (drawer/sheet) wysuwany z prawej strony, szerokość ~720–800px.
- **Powiązane API**: `GET /api/v1/orders/{id}`, `POST /api/v1/orders/{id}/lock`, `POST /api/v1/orders/{id}/unlock`, `PUT /api/v1/orders/{id}`, `POST /api/v1/orders/{id}/pdf`, `POST /api/v1/orders/{id}/prepare-email`, `POST /api/v1/orders/{id}/status`.
- **Historyjki użytkownika**: US-021, US-022, US-023, US-024, US-030, US-031, US-032, US-040, US-041, US-050, US-051, US-070, US-071, US-080, US-081

#### Przepływ otwarcia

1. Użytkownik klika (lewy klik) wiersz na liście.
2. System wywołuje `POST /api/v1/orders/{id}/lock`.
   - Sukces (200) → drawer otwiera się w trybie edycji; pobierane są dane `GET /api/v1/orders/{id}`.
   - Konflikt (409) → komunikat „Zlecenie edytowane przez [imię]"; drawer otwiera się w **trybie tylko do odczytu** (pola disabled, brak przycisku Zapisz).
3. Przy zamknięciu draweru → `POST /api/v1/orders/{id}/unlock`.

#### Sekcje formularza

Formularz w siatce 2–4 kolumn, etykiety nad polami, pola wymagane do wysłania oznaczone gwiazdką (*). Sekcje numerowane od 0. Zgodność z PRD §3.1.5a (dokument autorytatywny).

**Sekcja 0: Nagłówek** *(tylko do odczytu — metadane zlecenia)*
- Numer zlecenia (readonly, generowany przez serwer, niezmienny).
- Data wystawienia (readonly, `createdAt`).
- Przez kogo utworzone (readonly, imię i nazwisko z API).
- Aktualny status (badge readonly — zmiana przez Sekcję 6).
- Link „Historia zmian" — otwiera panel historii obok drawera.
- Opcjonalnie: „Ostatnia zmiana: [imię], [data]".

**Sekcja 1: Trasa** *(Rodzaj transportu + punkty trasy)*
- **Rodzaj transportu*** (select: krajowy, eksport drogowy, kontener morski, import) — jedno pole na całe zlecenie, na górze sekcji. Zmiana Rodzaju transportu automatycznie aktualizuje Wymagane dokumenty (Sekcja 3) i Walutę (Sekcja 4).
- **Na każdy punkt trasy** (załadunek L1…L8 / rozładunek U1…U3):
  - Typ punktu: badge ZAŁADUNEK / ROZŁADUNEK.
  - Firma (autocomplete z `companies`) — podpowiedź z bazy.
  - Oddział firmy (select — zależny od wybranej firmy; nie autocomplete). Przy zmianie firmy: zerowanie oddziału, adresu, NIP.
  - Adres (readonly, wypełniany automatycznie po wyborze oddziału).
  - NIP (readonly, auto po wyborze firmy/oddziału).
  - Data załadunku/rozładunku (datepicker + ręczne wpisanie).
  - Godzina załadunku/rozładunku (timepicker + ręczne wpisanie).
  - Uwagi do punktu (opcjonalnie).
- Przyciski „Dodaj załadunek" / „Dodaj rozładunek" (z walidacją limitów: max 8 załadunków, 3 rozładunki).
- Zmiana kolejności: drag-and-drop + przyciski góra/dół (dostępność klawiaturowa). Reguła kolejności: pierwszy przystanek zawsze LOADING, ostatni zawsze UNLOADING; środkowe dowolny mix. DnD blokuje: upuszczenie UNLOADING na pozycję pierwszą i upuszczenie LOADING na pozycję ostatnią (element wraca na miejsce). Przycisk „Dodaj załadunek" wstawia po ostatnim istniejącym załadunku; „Dodaj rozładunek" wstawia przed ostatnim istniejącym rozładunkiem.
- Przycisk „Usuń punkt" przy każdym punkcie (z potwierdzeniem jeśli punkt ma dane).
- **Osoba kontaktowa po stronie nadawcy** (pola tekstowe na dole sekcji): imię i nazwisko (`senderContactName`), telefon (`senderContactPhone`), e-mail (`senderContactEmail`).
- Minimalna trasa: 1 załadunek + 1 rozładunek (walidacja biznesowa przy wysyłce maila).

Autocomplete: po wpisaniu ≥ 2 znaków, debounce 300ms, lista podpowiedzi z danych słownikowych. Wybór uzupełnia powiązane pola.

**Sekcja 2: Towar** *(pozycje towarowe)*
- Pozycje towarowe (`items`) — lista edytowalna, każda pozycja zawiera:
  - Nazwa towaru* (autocomplete z `products`) — wybór ustawia domyślny sposób załadunku.
  - Ilość w tonach* (`quantityTons`) — pole liczbowe ≥ 0.
  - Sposób załadunku (`loadingMethodCode`) — select (PALETA, PALETA_BIGBAG, LUZEM, KOSZE); domyślnie z wybranego produktu, **nadpisywalny** per pozycja.
  - Komentarz do pozycji (`notes`) — pole tekstowe.
  - Przycisk „Usuń pozycję".
- Przycisk „Dodaj pozycję".
- Masa całkowita (`totalLoadTons`) — obliczana lub ręczna.
- Objętość (`totalLoadVolumeM3`) — opcjonalna.
- Wymagania specjalne (`specialRequirements`) — textarea (np. ADR, chłodnia).

**Sekcja 3: Firma transportowa** *(przewoźnik, pojazd, dokumenty)*
- Nazwa firmy (przewoźnik)* — autocomplete z `companies` (typ carrier).
- NIP — readonly, auto po wyborze firmy przewoźnika.
- Wariant pojazdu* — select z `vehicle_variants`; wyświetla `name` (typ + objętość, np. „firanka 90m³"). `vehicleVariantCode` przesyłany do API.
- Wymagane dokumenty — select (**2 opcje**): „WZ, KPO, kwit wagowy" / „WZE, Aneks VII, CMR". **Automatyczny wybór** przy zmianie Rodzaju transportu (Sekcja 1): eksport/eksport kontener/import → „WZE, Aneks VII, CMR"; kraj → „WZ, KPO, kwit wagowy". Użytkownik może ręcznie zmienić.

**Sekcja 4: Finanse**
- Stawka* (`priceAmount`) — pole liczbowe ≥ 0.
- Waluta* (`currencyCode`) — select (PLN, EUR, USD). **Automatyczny wybór** przy zmianie Rodzaju transportu (Sekcja 1): kraj → PLN; eksport/import → EUR. Użytkownik może ręcznie zmienić.
- Termin płatności (`paymentTermDays`) — domyślnie 21 dni.
- Forma płatności (`paymentMethod`) — select, domyślnie „Przelew".

**Sekcja 5: Uwagi**
- Uwagi ogólne do zlecenia (`generalNotes`) — textarea, max 500 znaków, 3–4 wiersze z resize.
- Sekcja 5 zawiera tylko to jedno pole. Wymagane dokumenty dla kierowcy znajdują się w Sekcji 3.

**Sekcja 6: Zmiana statusu**
- Aktualny status (badge readonly).
- Wybór nowego statusu — select (tylko dozwolone przejścia ręczne zgodnie z PRD §3.1.7 i `ALLOWED_MANUAL_STATUS_TRANSITIONS`):
  - **Robocze** → Zrealizowane, Anulowane. (Reklamacja niedostępna z Robocze.)
  - **Wysłane** → Zrealizowane, Reklamacja, Anulowane.
  - **Korekta** → Zrealizowane, Reklamacja, Anulowane.
  - **Korekta wysłane** → Zrealizowane, Reklamacja, Anulowane.
  - **Reklamacja** → Zrealizowane, Anulowane.
  - Statusy Wysłane i Korekta wysłane — ustawiane **wyłącznie automatycznie** przez prepare-email.
  - Z **Zrealizowane / Anulowane** — brak ręcznej zmiany; dostępne „Przywróć do aktualnych" (`POST /restore`, status → Korekta). Z Anulowane: tylko w ciągu 24 h.
- Przycisk „Zmień status" — zmiana zapisywana razem z danymi formularza przy kliknięciu „Zapisz" w stopce.
- **Powód reklamacji** (`complaintReason`) — pole textarea widoczne **tylko** gdy status = Reklamacja lub użytkownik wybiera przejście na Reklamację. Wymagane przy zmianie na Reklamację — zapis zablokowany bez wypełnienia. Max 500 znaków.
- Sekcja 6 widoczna od razu (także przy nowym zleceniu). Żadna zmiana nie zapisuje się automatycznie — tylko przy „Zapisz".

#### Stopka draweru

Przyciski akcji (sticky na dole draweru):
- **Zapisz** (primary) → `PUT /api/v1/orders/{id}`.
- **Anuluj** (secondary) → zamknięcie draweru (z ostrzeżeniem o niezapisanych zmianach).
- **Generuj PDF** → `POST /api/v1/orders/{id}/pdf` → pobranie pliku.
- **Wyślij maila** → `POST /api/v1/orders/{id}/prepare-email`.
- **Historia zmian** (link/ikona) → otwarcie panelu historii.

#### Kluczowe komponenty draweru

1. **OrderDrawer** — kontener (shadcn Sheet) z logiką lock/unlock.
2. **OrderForm** — formularz React z lokalnym stanem; walidacja techniczna przy zapisie (inline, pod polami); walidacja biznesowa przy wysyłce maila (lista braków z 422).
3. **AutocompleteField** — pole z podpowiedzią, debounce, uzupełnianie powiązanych pól.
4. **RoutePointList** — lista punktów trasy z drag-and-drop (np. `@dnd-kit/sortable`) i przyciskami góra/dół.
5. **RoutePointCard** — karta pojedynczego punktu (data, godzina, lokalizacja, adres, uwagi).
6. **ItemList** — lista pozycji towarowych (dodawanie, usuwanie, edycja inline).
7. **StatusChangeSection** — sekcja zmiany statusu z listą dozwolonych przejść.
8. **UnsavedChangesModal** — modal „Masz niezapisane zmiany. Odrzucić?" z obsługą `beforeunload`.

#### UX, dostępność i bezpieczeństwo

- Wszystkie pola formularza z etykietami (`<label>`).
- Walidacja inline: błędy pod polami po próbie zapisu.
- Pola readonly wizualnie odróżnione (szare tło, brak kursora edycji).
- Fokus trapu wewnątrz draweru (zamknięcie draweru przez Escape lub przycisk X).
- Nawigacja klawiaturą przez punkty trasy (Tab + przyciski góra/dół).
- Backdrop za drawerem (kliknięcie zamyka drawer z ostrzeżeniem o zmianach).
- Ochrona przed utratą danych: `beforeunload` + modal przy zamknięciu z niezapisanymi zmianami.
- Rola READ_ONLY: drawer w trybie pełnego podglądu (wszystkie pola disabled, brak Zapisz).

---

### 2.4 Panel historii zmian

- **Cel**: Wyświetlenie chronologicznej historii zmian zlecenia (statusy + pola kluczowe).
- **Typ**: Panel boczny (sheet) z prawej, ~450px, z backdrop.
- **Powiązane API**: `GET /api/v1/orders/{id}/history/status`, `GET /api/v1/orders/{id}/history/changes`.
- **Historyjki użytkownika**: US-070, US-071

#### Sposób otwarcia

- Z draweru edycji: kliknięcie linku „Historia zmian" w nagłówku draweru.
- Z listy: menu kontekstowe → „Historia zmian".
- Gdy otwarty z draweru — drawer pozostaje w tle; panel historii nakłada się na niego.

#### Kluczowe komponenty

1. **HistoryPanel** — kontener panelu (wzorowany na `test/code.html`).
   - Nagłówek: „Historia zmian" + numer zlecenia + przycisk zamknięcia (X).
   - Przewijalna oś czasu.
   - Brak przycisku eksportu w MVP (widoczny w referencyjnym HTML, ale pomijany).

2. **TimelineGroup** — grupowanie wpisów po dacie.
   - Sticky etykieta daty: „Dzisiaj", „Wczoraj", lub data (np. „8 lut 2026").
   - Linia osi czasu (pionowa linia po lewej).

3. **TimelineEntry** — pojedynczy wpis na osi czasu.
   - Typy wpisów:
     - **Zmiana statusu**: Awatar użytkownika + badge ikony „sync" → opis „Zmiana statusu" → dwa badge'e statusu ze strzałką (stary → nowy).
     - **Zmiana pola**: Awatar użytkownika + badge ikony „edit" → nazwa pola → siatka stara/nowa wartość.
     - **Zmiana wielu pól**: Awatar + badge „playlist_add_check" → lista par stara→nowa wartość.
     - **Utworzenie zlecenia**: Ikona systemu „rocket_launch" → „Zlecenie utworzone".
   - Każdy wpis: imię i nazwisko użytkownika, godzina, opis.

4. **UserAvatar** — inicjały w kółku lub ikona `person` (bez zdjęć w systemie wewnętrznym).

#### Logika scalania danych

- Pobieranie równoległe: `GET /history/status` i `GET /history/changes`.
- Normalizacja do jednego formatu: `{ type, changedAt, changedByUserName, ... }`.
- Sortowanie malejąco (najnowsze na górze).
- Grupowanie po dacie (`toLocaleDateString`).
- Wpisy z tego samego użytkownika i tej samej minuty mogą być grupowane (zmiana wielu pól jednocześnie).

#### UX, dostępność i bezpieczeństwo

- Panel tylko do odczytu — brak edycji historii.
- Przejrzyste etykiety i kontrasty kolorów.
- Zamknięcie przez Escape lub kliknięcie backdrop.
- Dane historii widoczne dla wszystkich zalogowanych (bez ograniczeń roli).

---

### 2.5 Nagłówek aplikacji (AppHeader)

- **Cel**: Stały element nawigacyjny widoczny na wszystkich stronach po zalogowaniu. Jeden blok: logo, tytuł, zakładki (OrderTabs), SyncButton, blok użytkownika.
- **Powiązane API**: `GET /api/v1/auth/me`, `POST /api/v1/dictionary-sync/run`, `GET /api/v1/dictionary-sync/jobs/{jobId}`.

#### Kluczowe komponenty

1. **AppHeader** — sticky na górze, ta sama `max-width` co treść (np. 1440px). Kolejność: logo, tytuł aplikacji, **OrderTabs** (Aktualne | Zrealizowane | Anulowane), **SyncButton**, **UserInfo**.
   - Tytuł aplikacji (po lewej): „Zlecenia Transportowe" (lub nazwa firmy).
   - **SyncButton** — przycisk „Aktualizuj dane" (po środku/prawej).
     - Stan normalny: „Aktualizuj dane" + ikona odświeżania.
     - Stan ładowania: disabled + „Synchronizacja..." + spinner.
     - Po zakończeniu: toast z komunikatem sukcesu lub błędu.
     - Wywołuje `POST /dictionary-sync/run`, następnie polling `GET /dictionary-sync/jobs/{jobId}` co 2s.
     - Po sukcesie: odświeżenie danych słownikowych w globalnym stanie.
   - **UserInfo** — **bez avatara i zdjęcia.** Wiersz 1: imię i nazwisko zalogowanego użytkownika (`fullName`). Wiersz 2: rola zwykłym tekstem — „Admin", „Planner" lub „Read only". Na prawo od bloku imienia i roli: przycisk „Wyloguj".

#### UX, dostępność i bezpieczeństwo

- Nagłówek widoczny **tylko** po zalogowaniu.
- `position: sticky; top: 0; z-index: 40`.
- Wylogowanie czyści sesję (Supabase `signOut`) i przekierowuje na logowanie.
- Przycisk synchronizacji dostępny dla ADMIN i PLANNER (ukryty dla READ_ONLY).

---

## 3. Mapa podróży użytkownika

### 3.1 Główny przepływ: Logowanie → Planowanie → Wysyłka zlecenia

```
1. Użytkownik otwiera aplikację w Chrome
   ↓
2. [Ekran logowania] — wpisuje login i hasło
   ↓ (błędne dane → komunikat błędu, ponowna próba)
   ↓ (poprawne dane → Supabase Auth → JWT)
3. Przekierowanie na /orders
   ↓
4. [Nagłówek] ładuje profil (GET /auth/me)
   [Lista zleceń] ładuje słowniki + pierwszą stronę zleceń (GET /orders?view=CURRENT)
   ↓
5. Użytkownik przegląda listę, filtruje, sortuje
   ↓
6. Użytkownik klika „Dodaj nowy wiersz" (POST /orders → nowy wiersz na liście)
   ↓
7. Użytkownik klika nowy wiersz → [Drawer edycji]
   ↓ (POST /lock → blokada)
   ↓
8. Uzupełnia dane zlecenia (strony, ładunek, trasa, finanse, uwagi)
   ↓
9. Klika „Zapisz" (PUT /orders/{id}) → potwierdzenie zapisu
   ↓
10. Klika „Wyślij maila" (POST /prepare-email)
    ↓ (422 → lista braków → użytkownik uzupełnia brakujące pola → ponowna próba)
    ↓ (200 → status zmienia się na Wysłane → Outlook otwiera się z załączonym PDF)
    ↓
11. Użytkownik wysyła mail z Outlooka
    ↓
12. Zamknięcie draweru (POST /unlock → odblokowanie)
    ↓
13. Wiersz na liście odzwierciedla nowy status (Wysłane, badge niebieski)
```

### 3.2 Przepływ: Korekta wysłanego zlecenia

```
1. Użytkownik klika wiersz zlecenia w statusie Wysłane/Korekta wysłane → [Drawer]
   ↓ (POST /lock)
2. Modyfikuje dane (np. zmiana daty, ceny, trasy)
   ↓
3. Klika „Zapisz" (PUT /orders/{id})
   ↓ → Serwer automatycznie zmienia status na Korekta
4. Klika „Wyślij maila" (POST /prepare-email)
   ↓ → Status zmienia się na Korekta wysłane → Outlook z nowym PDF
5. Zamknięcie draweru (POST /unlock)
```

### 3.3 Przepływ: Zmiana statusu z listy

```
1. Użytkownik klika prawym na wiersz → menu kontekstowe → „Zmień status"
   ↓
2. Podmenu z dozwolonymi przejściami (zależnie od statusu: Zrealizowane, Reklamacja tylko z Wysłane/Korekta wysłane, Anulowane z Robocze/Wysłane/Korekta/Korekta wysłane/Reklamacja; z Zrealizowane tylko „Przywróć do aktualnych", bez Anulowane)
   ↓ (wybór Reklamacja → okienko/panel z polem „Powód reklamacji"; zamknięcie bez wypełnienia = brak zmiany statusu)
3. POST /orders/{id}/status → aktualizacja wiersza na liście
   ↓ (np. Zrealizowane → wiersz znika z Aktualne, pojawia się w zakładce Zrealizowane)
```

### 3.4 Przepływ: Przywracanie zlecenia

```
1. Użytkownik przechodzi do zakładki Zrealizowane lub Anulowane
   ↓
2. Prawy klik na wiersz → „Przywróć do aktualnych"
   ↓ (Anulowane: dozwolone tylko gdy < 24h od anulowania; po 24h zlecenie jest usuwane z bazy)
3. POST /orders/{id}/restore → serwer ustawia status na Korekta → wiersz wraca do zakładki Aktualne
```

### 3.5 Przepływ: Podgląd historii zmian

```
1. Prawy klik na wiersz → „Historia zmian"
   ↓ (lub z draweru: link „Historia zmian")
2. [Panel historii] — pobiera GET /history/status + /history/changes
   ↓
3. Wyświetla scaloną oś czasu, grupowaną po dacie
   ↓
4. Użytkownik przegląda → zamyka panel (X lub Escape)
```

### 3.6 Przepływ: Synchronizacja słowników

```
1. Użytkownik klika „Aktualizuj dane" w nagłówku
   ↓
2. POST /dictionary-sync/run → przycisk disabled + „Synchronizacja..."
   ↓
3. Polling GET /dictionary-sync/jobs/{jobId} co 2s
   ↓ (COMPLETED → toast „Dane zaktualizowane" → odświeżenie słowników w stanie)
   ↓ (FAILED → toast „Błąd synchronizacji" → przycisk ponownie aktywny)
```

### 3.7 Przepływ: Generowanie PDF

```
1. Z draweru edycji: klika „Generuj PDF"
   ↓
2. POST /orders/{id}/pdf → otrzymuje blob PDF
   ↓
3. Przeglądarka pobiera plik (np. ZT2026-0001.pdf)
```

### 3.8 Przepływ: Blokada współbieżna

```
1. Użytkownik A klika wiersz → POST /lock → sukces → edycja
   ↓
2. Użytkownik B klika ten sam wiersz → POST /lock → 409 Conflict
   ↓ → Komunikat: „Zlecenie edytowane przez [imię A]"
   ↓ → Drawer otwiera się w trybie readonly
   ↓
3. Użytkownik A zapisuje i zamyka drawer → POST /unlock
   ↓
4. Użytkownik B może ponownie kliknąć wiersz → POST /lock → sukces
```

---

## 4. Układ i struktura nawigacji

### 4.1 Układ stron

```
┌─────────────────────────────────────────────────────────┐
│ [AppHeader - sticky h-14]                               │
│ [Logo] Tytuł │ [Akt.|Zreal.|Anul.] │ [Aktualizuj dane] │ Imię Nazwisko [Wyloguj] │
│                                               │ Admin   │
├─────────────────────────────────────────────────────────┤
│ [Pasek filtrów + ustawienia listy — sticky]             │
│ [Rodzaj] [Status] [Firma zał.] [Firma rozł.] [Firma transport.] [Towar] [Nr tyg.] [Szukaj] [50▼][Trasa|Kolumny] [+ Nowe zlecenie] │
├─────────────────────────────────────────────────────────┤
│ [Tabela — sticky nagłówek, min-w-1280px; scroll tylko wiersze] │
│ │ 🔒 │ Nr │ Status │ ... (kolumny według PRD 3.1.2a)          │
│ │────│────│────────│─────────────────────────────────────────│
│ │    │#01 │ Wysłane│ ...                                      │
│ │    │#02 │ Robocze│ ...                                      │
│ │                                                       │
│ [EmptyState jeśli brak wyników: Brak zleceń / Brak wyników dla filtrów] │
├─────────────────────────────────────────────────────────┤
│ [Footer — sticky h-10]                                   │
│ ● Aktywne: 24     System Status: OK │ Ostatnia aktualizacja: 14:32 │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Układ z otwartym drawerem edycji

```
┌────────────────────────────┬────────────────────────────┐
│ [AppHeader]                │                            │
├────────────────────────────┤   [Drawer edycji zlecenia] │
│ [Zakładki]                 │   ┌──────────────────────┐ │
├────────────────────────────┤   │ Nagłówek: ZT-0001    │ │
│ [Filtry]                   │   │ Historia zmian ↗     │ │
├────────────────────────────┤   ├──────────────────────┤ │
│                            │   │ Sekcja: Strony       │ │
│ [Tabela — zwężona]         │   │ Sekcja: Ładunek      │ │
│                            │   │ Sekcja: Trasa        │ │
│                            │   │ Sekcja: Finanse      │ │
│                            │   │ Sekcja: Uwagi        │ │
│                            │   │ Sekcja: Status       │ │
│                            │   ├──────────────────────┤ │
│                            │   │ [Zapisz][Anuluj]     │ │
│                            │   │ [PDF][Wyślij maila]  │ │
│                            │   └──────────────────────┘ │
└────────────────────────────┴────────────────────────────┘
```

### 4.3 Układ z panelem historii (nad drawerem)

```
┌──────────────────────┬──────────────┬──────────────────┐
│ [Tabela — w tle]     │ [Drawer —    │ [Panel historii]  │
│                      │  w tle]      │ ┌──────────────┐  │
│                      │              │ │ Historia zmian│  │
│                      │              │ │ ZT-0001      │  │
│                      │              │ ├──────────────┤  │
│                      │              │ │ Dzisiaj      │  │
│                      │              │ │ ● Status     │  │
│                      │              │ │   Robocze → Wysłane  │  │
│                      │              │ │ ● Cena       │  │
│                      │              │ │   500 → 550  │  │
│                      │              │ │ Wczoraj      │  │
│                      │              │ │ ● Utworzono   │  │
│                      │              │ └──────────────┘  │
└──────────────────────┴──────────────┴──────────────────┘
       ← backdrop (przyciemniony) →
```

### 4.4 Nawigacja

Aplikacja nie ma tradycyjnej nawigacji wielostronicowej. Struktura nawigacji:

| Element | Sposób nawigacji |
|---|---|
| Logowanie → Lista | Redirect po auth (`/` → `/orders`) |
| Między zakładkami | Klik na zakładkę (Aktualne / Zrealizowane / Anulowane) |
| Lista → Edycja zlecenia | Lewy klik na wiersz → drawer |
| Lista → Menu kontekstowe | Prawy klik na wiersz |
| Edycja → Historia | Link w nagłówku draweru |
| Lista → Historia | Menu kontekstowe → „Historia zmian" |
| Wylogowanie | Przycisk „Wyloguj" w nagłówku |
| Powrót do listy z draweru | Zamknięcie draweru (X, Escape, klik na backdrop) |

Wszystkie przejścia wewnątrz widoku głównego (`/orders`) odbywają się bez zmiany URL (stan React). Jedyna zmiana URL to logowanie ↔ lista.

---

## 5. Kluczowe komponenty

### 5.1 Komponenty współdzielone (używane w wielu widokach)

| Komponent | Opis | Użycie |
|---|---|---|
| **StatusBadge** | Badge statusu zlecenia z mapowaniem koloru i nazwy. | Lista, drawer, historia |
| **TransportTypeBadge** | Badge rodzaju transportu (PL, EXP, EXP_K, IMP). | Lista, drawer |
| **AutocompleteField** | Pole z podpowiedzią z danych słownikowych, debounce 300ms, uzupełnianie powiązanych pól. | Drawer (strony, lokalizacje, towary), filtry listy |
| **DatePickerField** | Pole daty z kalendarzem + ręczne wpisanie. | Drawer (trasa, daty), filtry listy |
| **TimePickerField** | Pole godziny z timePickerem + ręczne wpisanie. | Drawer (trasa, godziny) |
| **ConfirmDialog** | Modal potwierdzenia (np. anulowanie zlecenia, odrzucenie zmian). | Lista, drawer |
| **Toast / Notification** | Komunikat informacyjny (sukces, błąd, ostrzeżenie). | Globalny |
| **LoadingSpinner** | Wskaźnik ładowania (inline i overlay). | Globalny |
| **EmptyState** | Komunikat przy pustej liście z opcjonalnym CTA. | Lista |
| **ErrorAlert** | Wyświetlanie błędów API (422 — lista braków, ogólne błędy). | Drawer, lista |

### 5.2 Komponenty stanu globalnego

| Komponent / Hook | Opis |
|---|---|
| **AuthProvider / useAuth** | Kontekst sesji użytkownika (profil, rola, token). Obsługa 401 → wylogowanie. |
| **DictionaryProvider / useDictionaries** | Globalny cache słowników (companies, locations, products, transport-types, order-statuses, vehicle-variants). Ładowane raz po zalogowaniu, odświeżane po synchronizacji. |
| **useOrders** | Hook do pobierania listy zleceń z parametrami (view, filtry, sort, pageSize). Obsługa odświeżania po akcjach. |
| **useOrderDetail** | Hook do pobierania szczegółów zlecenia, lock/unlock, aktualizacji. |
| **useOrderHistory** | Hook do pobierania i scalania historii zmian (status + changes). |
| **useDictionarySync** | Hook do uruchamiania synchronizacji i pollingu statusu joba. |

### 5.3 Mapowanie komponentów na historyjki użytkownika

| Historyjka | Komponenty realizujące |
|---|---|
| US-001 (Logowanie) | LoginCard, AuthProvider |
| US-010 (Podgląd listy) | OrderTabs, OrderTable, OrderRow |
| US-011 (Filtr rodzaj transportu) | FilterBar (pole transportType) |
| US-012 (Filtr przewoźnik, towar, miejsca) | FilterBar (pola autocomplete) |
| US-013 (Sortowanie) | OrderTable (nagłówki kolumn z sortowaniem) |
| US-020 (Dodanie wiersza) | AddOrderButton |
| US-021 (Edycja w szczegółach) | OrderDrawer, OrderForm |
| US-022 (Blokada edycji) | OrderDrawer (logika lock/unlock), ikona blokady w OrderRow |
| US-023 (Zmiana statusu) | StatusChangeSection, OrderRowContextMenu |
| US-024 (Korekta/Korekta wysłane) | Automatyczna logika w PUT i prepare-email (serwer) |
| US-025 (Przeniesienie do zrealizowanych) | StatusChangeSection, OrderRowContextMenu |
| US-026 (Anulowanie z retencją) | OrderRowContextMenu, ConfirmDialog, zakładka Anulowane |
| US-027 (Przywrócenie zlecenia) | OrderRowContextMenu → „Przywróć do aktualnych" |
| US-028 (Kopiowanie zlecenia) | OrderRowContextMenu → „Skopiuj zlecenie" (etap 2) |
| US-030 (Min. trasa 1+1) | RoutePointList (domyślnie 1 załadunek + 1 rozładunek) |
| US-031 (Wiele miejsc) | RoutePointList (przyciski dodawania, limity 8/3) |
| US-032 (Zmiana kolejności) | RoutePointList (drag-and-drop + góra/dół) |
| US-040 (Podpowiedź firm) | AutocompleteField (companies, locations) |
| US-041 (Podpowiedź towarów) | AutocompleteField (products) |
| US-042 (Aktualizacja słowników) | SyncButton, useDictionarySync |
| US-050 (Generowanie PDF) | Przycisk „Generuj PDF" w stopce draweru |
| US-051 (Otwarcie Outlooka) | Przycisk „Wyślij maila" w stopce draweru i w wierszu listy |
| US-070 (Historia zmian) | HistoryPanel, TimelineEntry |
| US-071 (Autor i data) | OrderForm sekcja nagłówek (readonly) |
| US-080 (Ręczny zapis) | Przycisk „Zapisz" w stopce draweru |
| US-081 (Ostrzeżenie niezapisane) | UnsavedChangesModal, beforeunload |
| US-082 (Autozapis — etap 2) | Poza MVP |

### 5.4 Obsługa błędów i stanów brzegowych

| Scenariusz | Obsługa w UI |
|---|---|
| **401 Unauthorized** | Globalna obsługa: wylogowanie + redirect na logowanie. |
| **403 Forbidden** | Toast: „Brak uprawnień do wykonania tej operacji". |
| **404 Not Found** | Toast: „Zlecenie nie istnieje" + powrót do listy (zamknięcie draweru). |
| **409 Conflict (blokada)** | Komunikat: „Zlecenie edytowane przez [imię]" + tryb readonly w drawerze. |
| **409 Conflict (zapis)** | Komunikat: „Zlecenie zostało zmodyfikowane. Odśwież dane." |
| **422 Unprocessable (walidacja)** | Lista brakujących pól z body API, wyświetlona w alercie w drawerze. |
| **500 Server Error** | Toast: „Wystąpił błąd serwera. Spróbuj ponownie." |
| **Timeout / brak sieci** | Toast: „Brak połączenia z serwerem." |
| **Pusta lista** | EmptyState z kontekstowym komunikatem i CTA. |
| **Przekroczony limit wyników** | W EmptyState używane są tylko dwa warianty (Brak zleceń, Brak wyników dla filtrów); trzeci wariant „Zawęź filtry" nie jest używany. Ewentualna obsługa po stronie API/komunikatu — do decyzji. |
| **Wygaśnięcie blokady** | Serwer automatycznie zwalnia po ustalonym czasie; przy zapisie 409 → odświeżenie danych. |
| **Anulowane zlecenie > 24h** | Wiersz znika z listy (serwer usuwa); jeśli użytkownik miał otwarte — 404. |
| **Brak uprawnień (READ_ONLY)** | Ukrycie przycisków: Dodaj, Zapisz, Wyślij maila, Zmień status, Aktualizuj dane. Drawer w trybie readonly. |
| **Walidacja przy wysyłce maila** | 422 z prepare-email → lista braków → użytkownik wraca do formularza → uzupełnia → ponowna próba. |
| **Równoczesna zmiana statusu** | Po powrocie do listy dane odświeżane; wiersz może zmienić zakładkę. |

---

## 6. Specyfikacja wizualna (na podstawie mockupu `test/main_view.html`)

Poniższa sekcja definiuje szczegółowe wymagania wizualne, które stanowią referencję designu dla implementacji. Mockup HTML (`test/main_view.html`) jest wzorem do naśladowania.

### 6.1 Paleta kolorów i typografia

**Kolory główne:**
- Primary: `#137fec` (niebieski) — akcje, linki, ikona załadunku (rozładunki)
- Background light: `#f6f7f8` — tło strony
- Background dark: `#101922` — dark mode tło

**Typografia (Inter):**
- Nagłówki kolumn tabeli: `text-[11px] font-bold uppercase tracking-wider text-slate-500`
- Wiersze tabeli: `text-[12px]`
- Badge statusu: `text-[11px] font-semibold`
- Node-string (trasa): `text-[10px] font-bold`
- Podpisy / metadane: `text-[10px] text-slate-400`
- Badge opakowania: `text-[10px] uppercase`

### 6.2 Wizualizacja trasy (node-string)

Kluczowy element wizualny widoku Trasa. Trasa prezentowana jako ciąg kompaktowych kolorowych węzłów połączonych strzałkami.

**Struktura:**
```
[L1:Nord] → [L2:Recykling] → [L3:Metal] → [L4:Stahl]
[U1:BER] → [U2:HAM]
```

Format węzła: `{L|U}{sequenceNo}:{nazwa_lub_skrót}` — np. `L1:Nord`, `L2:Recykling`, `U1:CentralMet`

**Zawijanie:** **Maksymalnie 4 węzły w linii** (+ 3 strzałki = 7 elementów). Przy dłuższych trasach (np. 11 węzłów) kolejne węzły automatycznie zawijają się do następnej linii dzięki `flex-wrap gap-y-1`.

**Kolorystyka węzłów:**
- **Załadunki (L1, L2, ...):** `bg-emerald-100 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700`
- **Rozładunki (U1, U2, ...):** `bg-blue-100 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-700`
- **Strzałki:** `<span class="text-slate-300">→</span>` — między każdymi dwoma węzłami
- **Container:** `<div class="flex items-center space-x-1 flex-wrap gap-y-1">`

**Przykład długiej trasy z zawijaniem:**
```html
<div class="flex items-center space-x-1 flex-wrap gap-y-1">
  <span class="bg-emerald-100 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700">L1:Nord</span>
  <span class="text-slate-300">→</span>
  <span class="bg-emerald-100 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700">L2:Recykling</span>
  <span class="text-slate-300">→</span>
  <span class="bg-emerald-100 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700">L3:MetalWay</span>
  <span class="text-slate-300">→</span>
  <span class="bg-emerald-100 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700">L4:StalPol</span>
  <!-- Linia się zawija tutaj (4 węzły + 3 strzałki) -->
  <span class="text-slate-300">→</span>
  <span class="bg-blue-100 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-700">U1:BER</span>
  <span class="text-slate-300">→</span>
  <span class="bg-blue-100 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-700">U2:HAM</span>
</div>
```

**WAŻNE:** Linia w tle (pseudo-element `::after`) **NIE jest stosowana**, aby uniknąć problemów wizualnych przy zawijaniu na wiele linii. Zawijanie jest naturalne dzięki `flex-wrap`.

---

### 6.2a Kolumny miejsc (widok Kolumny)

W widoku Kolumny miejsca załadunku i rozładunku prezentowane są z okrągłymi badge'ami:

**Miejsce załadunku** — każdy punkt w osobnym bloku `<div class="space-y-2">`:
- **Wiersz 1**: `<div class="flex items-center gap-1.5">` z okrągłym badge'm `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">L{n}</span>` i nazwą firmy `<span class="font-medium">{companyName}</span>`
- **Wiersz 2**: `<div class="text-[11px] text-slate-500 pl-6">{locationName}</div>` (np. "oddział Kraków")

**Miejsce rozładunku** — analogicznie:
- Badge: `bg-blue-100 text-blue-700` z oznaczeniem `U{n}`
- Nazwa firmy i oddział jak wyżej

### 6.3 Tabela zleceń

**Layout:**
- Kontener: `min-w-[1280px]`
- Sticky nagłówek: `sticky top-0 bg-slate-50 border-b z-10`
- Kompaktowe wiersze: `py-1 px-4`
- Brak obramowania między kolumnami w treści — separator poziomy `divide-y divide-slate-100`

**Hover na wierszu:**
```css
tr:hover td {
  background-color: rgba(19, 127, 236, 0.04) !important;
}
```

**Tło wiersza wg statusu:**

Tylko dwa statusy mają kolorowe tło wiersza (zielone). Pozostałe wiersze mają domyślne białe tło.

| Status | Tło wiersza |
|---|---|
| Wysłane | `bg-emerald-50/30` |
| Korekta wysłane | `bg-emerald-50/30` |
| Pozostałe | `bg-white` (domyślne) |

**Scrollbar:** Na wąskich ekranach pasek przewijania poziomego **musi być widoczny** (użytkownik ma rozumieć, że są kolejne kolumny). Na szerokich ekranach dopuszczalne ukrycie scrollbara (`.scrollbar-hide`).

### 6.4 Badge statusu

Badge statusu **bez animacji pulse** — prosty badge z ramką (oprócz Robocze):

| Status | Styl badge |
|---|---|
| Robocze | `bg-slate-100 text-slate-700` **(bez border)** |
| Wysłane | `bg-blue-50 text-blue-600 border border-blue-200` |
| Korekta | `bg-orange-50 text-orange-600 border border-orange-200` |
| Korekta wysłane | `bg-amber-50 text-amber-700 border border-amber-200` |
| Zrealizowane | `bg-emerald-50 text-emerald-700 border border-emerald-200` |
| Anulowane | `bg-slate-100 text-slate-500 border border-slate-200` **(z borderem, inaczej niż Robocze)** |
| Reklamacja | `bg-red-50 text-red-600 border border-red-200` |

**Badge base class:** `inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full`

**UWAGA:** Status "Robocze" nie ma ramki (border), pozostałe statusy mają `border border-{color}-200`.

### 6.5 Kolumna Firma transportowa

Kolumna Firma transportowa wyświetla **tylko nazwę firmy** (bez osoby kontaktowej i telefonu):
- Nazwa firmy — `text-[12px]` (standardowa czcionka wiersza tabeli)
- Format: po prostu tekst z nazwą przewoźnika, np. "Mega Transport", "Transport Express Sp. z o.o."
- **Bez dodatkowych elementów**: brak imienia osoby kontaktowej, brak numeru telefonu, brak ikony

**Oznaczanie kolorem komórki (carrier cell color):**
- Użytkownik (ADMIN/PLANNER) może oznaczyć komórkę jednym z 4 kolorów poprzez menu kontekstowe (prawy klik → podmenu "Kolor" z kolorowymi kwadracikami)
- **Dozwolone kolory**: `#48A111` (zielony), `#25671E` (ciemnozielony), `#FFEF5F` (żółty), `#EEA727` (pomarańczowy)
- Kolor stosowany jako `backgroundColor` komórki (inline style); `#25671E` wymaga białego tekstu dla kontrastu
- **Status override**: gdy status = wysłane/korekta wysłane → kolor komórki ukryty (wiersz przejmuje zielone tło `bg-emerald-100/70`)
- Kolor zapisywany w DB (`carrier_cell_color` na `transport_orders`) i widoczny dla wszystkich użytkowników
- READ_ONLY widzi kolor, ale nie ma opcji zmiany w menu kontekstowym
- Kolor NIE jest kopiowany przy duplikacji zlecenia
- API: `PATCH /api/v1/orders/{orderId}/carrier-color` z body `{ color: "#48A111" | null }`

**Przykład w HTML:**
```html
<td class="py-1 px-4 text-[12px]">Mega Transport</td>
<!-- z kolorem: -->
<td class="py-1 px-4 text-[12px]" style="background-color: #48A111">Mega Transport</td>
<!-- ciemnozielony z białym tekstem: -->
<td class="py-1 px-4 text-[12px]" style="background-color: #25671E; color: #fff">Mega Transport</td>
```

### 6.6 Kolumna Towaru (ikona + badge)

Kolumna towaru zawiera:
- Ikonę (Material Symbols: `inventory`, `view_in_ar`, `recycling` itp.) — `text-sm text-slate-400`
- Nazwę produktu — `font-medium`
- Badge opakowania — `text-[10px] px-1 bg-slate-100 rounded text-slate-500 uppercase`

### 6.7 Nagłówek aplikacji

```
[Logo 8×8 bg-primary rounded + ikona] [Tytuł UPPERCASE tracking-tight] | [Zakładki w bg-slate-100 rounded-lg] | [Aktualizuj dane] | Imię Nazwisko  [Wyloguj]
                                                                                        Admin (lub Planner / Read only)
```

- Height: `h-14`
- Zakładki w nagłówku: `bg-slate-100 rounded-lg p-1`. Aktywna: `bg-white shadow-sm text-primary font-semibold`, nieaktywna: `text-slate-500 hover:text-slate-700`
- **Blok użytkownika:** bez avatara. Wiersz 1: imię i nazwisko (`fullName`). Wiersz 2: rola zwykłym tekstem (Admin / Planner / Read only). Po prawej od bloku: przycisk „Wyloguj"

### 6.8 Pasek filtrów

Pod nagłówkiem, sticky razem z nagłówkiem tabeli, oddzielony `border-t`, tło `bg-slate-50`. W tym samym wierszu: ustawienia listy (rozmiar strony 50/100/200, przełącznik Trasa | Kolumny) oraz przycisk „Nowe zlecenie" (z prawej; tylko zakładka Aktualne, tylko Admin/Planner).

- Kolejność filtrów: rodzaj transportu (select) | status (select) | firma załadunku (autocomplete) | firma rozładunku (autocomplete) | Firma transportowa (autocomplete) | towar (autocomplete) | numer tygodnia (wpis ręczny) | wyszukiwanie pełnotekstowe. Przycisk „Wyczyść filtry".
- Input: `h-8 pl-8 pr-3 bg-white border rounded text-xs`; debounce 300ms na polach tekstowych/autocomplete.
- Filtry w jednym wierszu; na wąskim ekranie zawijanie (flex-wrap). Nazwy filtrów = nazwy kolumn tabeli.
- Z prawej (`ml-auto`): „Nowe zlecenie" (bg-emerald-600)

### 6.9 Pasek stopki ze statystykami (StatusFooter)

Sticky na dole ekranu; widoczny także przy pustej liście.

```
[● Aktywne: 24]  (ew. inne liczniki per status)     System Status: OK | Ostatnia aktualizacja: 14:32:01
```

- Height: `h-10`
- Tło: `bg-slate-50 border-t border-slate-200`
- **Lewa strona:** liczniki zleceń (np. „Aktywne: X" dla bieżącej zakładki lub liczniki per status). **Bez** „W trasie", „Załadunek", „Opóźnione".
- Prawa strona: „System Status: OK" + separator + „Ostatnia aktualizacja: HH:MM" (czas ostatniego pobrania listy)

### 6.10 Dark mode

Aplikacja wspiera ciemny motyw (Tailwind `darkMode: "class"`). Kluczowe mapowania:

| Element | Light | Dark |
|---|---|---|
| Tło strony | `bg-background-light (#f6f7f8)` | `bg-background-dark (#101922)` |
| Nagłówek | `bg-white` | `bg-slate-900` |
| Tabela nagłówek | `bg-slate-50` | `bg-slate-800` |
| Tabela wiersz | `bg-white` | `bg-slate-900` |
| Tekst główny | `text-slate-900` | `text-slate-100` |
| Tekst podrzędny | `text-slate-500` | `text-slate-400` |
| Obramowanie | `border-slate-200` | `border-slate-700/800` |
| Inputy | `bg-white border-slate-200` | `bg-slate-800 border-slate-700` |

Wszystkie komponenty powinny mieć warianty `dark:` dla kluczowych właściwości (tło, tekst, obramowanie).

### 6.11 Spacing i sizing reference

| Element | Wartość |
|---|---|
| Nagłówek height | `h-14` (56px) |
| Pasek filtrów padding | `px-4 py-2` |
| Wiersz tabeli | `py-1 px-4` (kompaktowy) |
| Badge statusu | `px-2 py-0.5` |
| Node-string węzeł | `px-1.5 py-0.5` |
| Input filtra | `h-8 text-xs` |
| Przycisk filtra | `h-8 text-xs font-semibold` |
| Footer height | `h-10` (40px) |
| Drawer width | `~720–800px` |
| History panel width | `~450px` |
| Min tabela width | `1280px` |
