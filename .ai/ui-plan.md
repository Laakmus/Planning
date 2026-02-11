# Architektura UI dla Systemu Zleceń Transportowych

## 1. Przegląd struktury UI

Aplikacja to wewnętrzne narzędzie webowe do planowania i wystawiania zleceń transportowych, przeznaczone do pracy w przeglądarce Chrome na laptopach. Stos technologiczny: Astro 5 (SSR) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (styl New York, ikony Lucide).

### Struktura aplikacji

Aplikacja składa się z dwóch głównych stanów: niezalogowany (ekran logowania) i zalogowany (widok planistyczny z nagłówkiem). Nie ma tradycyjnej wielostronicowej nawigacji — po zalogowaniu użytkownik pracuje w jednym widoku listy zleceń, z otwieraniem paneli bocznych (drawer) dla edycji zlecenia i historii zmian.

### Hierarchia widoków

```
[Ekran logowania]
    ↓ (po zalogowaniu)
[Nagłówek aplikacji — sticky, z zakładkami]
[Pasek filtrów — pod nagłówkiem]
[Widok główny — Lista zleceń]
    ├── Tabela zleceń (sticky nagłówek, sticky kolumna Akcje)
    │   ├── (lewy klik wiersza) → [Drawer edycji zlecenia]
    │   │                              └── (link) → [Panel historii zmian]
    │   └── (prawy klik wiersza) → [Menu kontekstowe]
    │                                   ├── Wyślij maila
    │                                   ├── Historia zmian → [Panel historii zmian]
    │                                   ├── Zmień status
    │                                   └── Skopiuj zlecenie
    └── [+ Dodaj nowy wiersz]
[Pasek stopki ze statystykami — sticky bottom]
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
- **Główny cel**: Prezentacja i zarządzanie listą zleceń transportowych w trzech zakładkach (Aktualne, Zrealizowane, Anulowane) z filtrowaniem, sortowaniem i akcjami.
- **Powiązane API**: `GET /api/v1/orders` (z parametrami `view`, filtrów, sortowania, `pageSize`), `POST /api/v1/orders` (dodanie wiersza), `DELETE /api/v1/orders/{id}` (szybkie anulowanie), `POST /api/v1/orders/{id}/prepare-email`, `POST /api/v1/orders/{id}/status`, `POST /api/v1/orders/{id}/restore`.
- **Historyjki użytkownika**: US-010, US-011, US-012, US-013, US-020, US-023, US-024, US-025, US-026, US-027, US-028, US-050, US-051

#### Kluczowe informacje do wyświetlenia

Każdy wiersz zlecenia w widoku skróconym zawiera:
- Ikona blokady (jeśli edytowane przez innego użytkownika) z tooltipem (imię).
- Numer zlecenia (`orderNo`).
- Rodzaj transportu (`transportTypeName`) — badge.
- Trasa (dwa warianty widoku — patrz niżej).
- Data/godzina pierwszego i ostatniego załadunku.
- Data/godzina pierwszego i ostatniego rozładunku.
- Przewoźnik (`carrierName`).
- Towar (`mainProductName`).
- Koszt (`priceAmount` + `currencyCode`).
- Status (`statusCode`/`statusName`) — ciemny badge kolorowy; wiersz w jaśniejszym odcieniu tego koloru.
- Uwagi (`generalNotes`) — skrócone.
- Ikona „Wyślij maila" (jedyna akcja bezpośrednio w wierszu).

#### Kluczowe komponenty widoku

1. **OrderTabs** — trzy zakładki (Aktualne, Zrealizowane, Anulowane) umieszczone w nagłówku aplikacji (nie nad tabelą).
   - Mapowanie na parametr API `view`: `CURRENT` | `COMPLETED` | `CANCELLED`.
   - Wizualnie: `bg-slate-100 rounded-lg p-1`, aktywna zakładka: `bg-white shadow-sm text-primary font-semibold`, nieaktywna: `text-slate-500`.
   - Przełączanie zakładki resetuje filtry (lub zachowuje — do decyzji implementacyjnej) i wywołuje nowe zapytanie GET.

2. **FilterBar** — pasek filtrów nad tabelą.
   - Filtr rodzaju transportu (select/multiselect: krajowy, eksport drogowy, kontener morski, import).
   - Filtr przewoźnika (autocomplete z danych słownikowych).
   - Filtr towaru (autocomplete).
   - Filtr miejsca załadunku (autocomplete po lokalizacjach).
   - Filtr miejsca rozładunku (autocomplete po lokalizacjach).
   - Filtr daty załadunku od/do (datepicker).
   - Filtr daty rozładunku od/do (datepicker).
   - Pole wyszukiwania pełnotekstowego (`search`).
   - Przycisk „Wyczyść filtry".

3. **ListSettings** — ustawienia nad tabelą (obok filtrów lub w osobnym wierszu).
   - Wybór rozmiaru strony: 50 / 100 / 200.
   - Przełącznik wariantu widoku listy:
     - **Widok 1 (Trasa)**: Blokada | Nr | Rodzaj | Trasa (L1/L2→U1 w jednej kolumnie) | Data załad. | Data rozład. | Przewoźnik | Towar | Koszt | Status | Uwagi | Wyślij maila.
     - **Widok 2 (Kolumny)**: Nr | Miejsca załadunków | Miejsca rozładunków | Daty załadunków | Daty rozładunków | Towar | Przewoźnik | Cena | Status | Akcje.

4. **OrderTable** — tabela z listą zleceń.
   - Kontener: `min-w-[1280px]` z ukrytym scrollbarem (`.scrollbar-hide`).
   - Sticky nagłówek tabeli: `sticky top-0 bg-slate-50 border-b z-10`, nagłówki `text-[11px] font-bold uppercase tracking-wider`.
   - Sticky kolumna Akcje z prawej: `sticky right-0` z cieniem `shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]`.
   - Kompaktowe wiersze: `py-1 px-4`, tekst `text-[12px]`.
   - Tło wiersza: jaśniejszy odcień koloru statusu (np. `bg-blue-50/30` dla WYS).
   - Hover: `rgba(19, 127, 236, 0.04)` na całym wierszu.
   - Sortowanie: klik w nagłówek kolumny → zmiana `sortBy`/`sortDirection` (strzałka wskazująca kierunek). Domyślnie: `FIRST_LOADING_DATETIME ASC`.
   - Lewy klik na wiersz → otwarcie draweru edycji.
   - Prawy klik na wiersz → menu kontekstowe (`ContextMenu`).
   - Trasa wyświetlana jako node-string z linią łączącą (patrz sekcja 6.2).
   - Wirtualizacja listy (np. `@tanstack/react-virtual`) przy dużej liczbie wierszy.

5. **OrderRowContextMenu** — menu kontekstowe (prawy klik na wierszu).
   - Opcje:
     - „Wyślij maila" → akcja `prepare-email`.
     - „Historia zmian" → otwarcie panelu historii.
     - „Zmień status" → podmenu z dozwolonymi przejściami statusu.
     - „Skopiuj zlecenie" → tworzenie kopii (etap 2: `POST /orders/{id}/duplicate`).
     - „Anuluj zlecenie" → z potwierdzeniem.
   - Opcje zależne od roli: READ_ONLY widzi tylko „Historia zmian".
   - Opcje zależne od statusu: np. „Przywróć do aktualnych" widoczne w zakładkach Zrealizowane/Anulowane.

6. **AddOrderButton** — przycisk „Dodaj nowy wiersz" (widoczny tylko w zakładce Aktualne).
   - Wywołuje `POST /api/v1/orders` z minimalnymi danymi (domyślny `transportTypeCode`, `currencyCode`, `vehicleVariantCode`).
   - Po sukcesie nowy wiersz pojawia się na końcu listy; opcjonalnie automatyczne otwarcie draweru edycji.

7. **EmptyState** — komunikaty przy pustej liście.
   - „Brak zleceń" — gdy zakładka jest pusta (z przyciskiem „Dodaj nowy wiersz" w Aktualne).
   - „Brak wyników dla zastosowanych filtrów" — z przyciskiem „Wyczyść filtry".
   - „Przekroczono limit wyników — zawęź filtry" — gdy `totalItems` > `pageSize`.

8. **StatusBadge** — komponent badge'a statusu z mapowaniem koloru:
   - ROB (Robocze): szary/neutralny.
   - WYS (Wysłane): niebieski.
   - KOR (Korekta): pomarańczowy.
   - KOR_WYS (Korekta wysłane): zielono-niebieski.
   - ZRE (Zrealizowane): zielony.
   - ANL (Anulowane): ciemnoszary.
   - REK (Reklamacja): czerwony.

#### UX, dostępność i bezpieczeństwo

- Filtry z debounce (300ms) na polach tekstowych i autocomplete.
- Tabela z `role="table"`, nagłówki z `scope="col"`, wiersze z `role="row"`.
- Sortowanie z `aria-sort` na nagłówkach.
- Menu kontekstowe dostępne z klawiatury (Shift+F10 lub dedykowany klawisz).
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

Formularz w siatce 2–4 kolumn, etykiety nad polami, pola wymagane do wysłania oznaczone gwiazdką (*).

**Sekcja 1: Nagłówek**
- Numer zlecenia (readonly, generowany przez serwer).
- Data wystawienia (readonly, `createdAt`).
- Rodzaj transportu (select: krajowy, eksport drogowy, kontener morski, import) — wymagane.
- Waluta (select: PLN, EUR, USD) — wymagane.
- Status (badge, readonly — zmiana przez dedykowaną akcję lub automatyczną logikę).
- Informacje o autorze: „Utworzone przez [imię], [data]" / „Ostatnia zmiana: [imię], [data]".

**Sekcja 2: Strony (uczestnicy)**
- Przewoźnik (autocomplete z `companies` typu carrier) — wymagane*.
- Nadawca — firma + lokalizacja (autocomplete z `locations`) — wymagane*.
- Odbiorca — firma + lokalizacja (autocomplete z `locations`) — wymagane*.
- Osoba kontaktowa: imię, telefon, e-mail (pola tekstowe).

Autocomplete: po wpisaniu ≥ 2 znaków, debounce 300ms, lista podpowiedzi z danych słownikowych. Wybór z listy uzupełnia powiązane pola (adres, NIP itp.).

**Sekcja 3: Ładunek**
- Pozycje towarowe (`items`) — lista edytowalna:
  - Towar (autocomplete z `products`) — wymagany*.
  - Ilość ton (`quantityTons`) — wymagana*.
  - Uwagi do pozycji.
  - Przycisk „Dodaj pozycję" / „Usuń pozycję".
- Typ pojazdu (select z `vehicle_variants`) — wymagany.
- Sposób załadunku (wypełniany automatycznie z `defaultLoadingMethodCode` wybranego produktu, możliwość nadpisania).
- Masa całkowita (`totalLoadTons`) — obliczana lub ręczna.
- Objętość (`totalLoadVolumeM3`) — opcjonalna.
- Wymagania specjalne (textarea, np. ADR, chłodnia).

**Sekcja 4: Trasa**
- Lista punktów załadunku (max 8) i rozładunku (max 3).
- Każdy punkt:
  - Typ: badge ZAŁADUNEK / ROZŁADUNEK.
  - Data (datepicker + ręczne wpisanie).
  - Godzina (timepicker + ręczne wpisanie).
  - Firma/lokalizacja (autocomplete z `locations`).
  - Adres (wypełniany automatycznie po wyborze lokalizacji, readonly lub edytowalny).
  - Uwagi do punktu.
- Przyciski „Dodaj miejsce załadunku" / „Dodaj miejsce rozładunku" (z walidacją limitów 8/3).
- Zmiana kolejności: drag-and-drop + przyciski góra/dół (dla dostępności klawiatury).
- Przycisk „Usuń punkt" przy każdym punkcie (z potwierdzeniem jeśli punkt ma dane).

**Sekcja 5: Warunki finansowe**
- Cena za transport (`priceAmount`) — wymagana*.
- Termin płatności (`paymentTermDays`).
- Forma płatności (`paymentMethod`).

**Sekcja 6: Dokumenty i uwagi**
- Wymagane dokumenty dla kierowcy (`requiredDocumentsText`) — textarea.
- Uwagi do zlecenia (`generalNotes`) — textarea, 3–4 wiersze z resize.
- Powód reklamacji (`complaintReason`) — widoczne tylko przy statusie REK.

**Sekcja 7: Zmiana statusu** (w panelu lub w stopce)
- Dostępne przejścia statusu zależne od aktualnego statusu:
  - ROB → ZRE, REK, ANL (ręczne).
  - WYS → ZRE, REK, ANL (ręczne).
  - KOR → ZRE, REK, ANL (ręczne).
  - KOR_WYS → ZRE, REK, ANL (ręczne).
  - Przejścia WYS, KOR_WYS — tylko automatycznie (prepare-email).
- Przy wyborze REK → wymagane pole `complaintReason`.
- W zakładkach Zrealizowane/Anulowane: przycisk „Przywróć do aktualnych" (`POST /restore`).

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

- **Cel**: Stały element nawigacyjny widoczny na wszystkich stronach po zalogowaniu.
- **Powiązane API**: `GET /api/v1/auth/me`, `POST /api/v1/dictionary-sync/run`, `GET /api/v1/dictionary-sync/jobs/{jobId}`.

#### Kluczowe komponenty

1. **AppHeader** — sticky na górze, ta sama `max-width` co treść (np. 1440px).
   - Tytuł aplikacji (po lewej): „Zlecenia Transportowe" (lub nazwa firmy).
   - **SyncButton** — przycisk „Aktualizuj dane" (po środku/prawej).
     - Stan normalny: „Aktualizuj dane" + ikona odświeżania.
     - Stan ładowania: disabled + „Synchronizacja..." + spinner.
     - Po zakończeniu: toast z komunikatem sukcesu lub błędu.
     - Wywołuje `POST /dictionary-sync/run`, następnie polling `GET /dictionary-sync/jobs/{jobId}` co 2s.
     - Po sukcesie: odświeżenie danych słownikowych w globalnym stanie.
   - **UserInfo** — nazwa użytkownika (`fullName` lub `email`) + przycisk „Wyloguj" (po prawej).

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
    ↓ (200 → status zmienia się na WYS → Outlook otwiera się z załączonym PDF)
    ↓
11. Użytkownik wysyła mail z Outlooka
    ↓
12. Zamknięcie draweru (POST /unlock → odblokowanie)
    ↓
13. Wiersz na liście odzwierciedla nowy status (WYS, badge niebieski)
```

### 3.2 Przepływ: Korekta wysłanego zlecenia

```
1. Użytkownik klika wiersz zlecenia w statusie WYS/KOR_WYS → [Drawer]
   ↓ (POST /lock)
2. Modyfikuje dane (np. zmiana daty, ceny, trasy)
   ↓
3. Klika „Zapisz" (PUT /orders/{id})
   ↓ → Serwer automatycznie zmienia status na KOR
4. Klika „Wyślij maila" (POST /prepare-email)
   ↓ → Status zmienia się na KOR_WYS → Outlook z nowym PDF
5. Zamknięcie draweru (POST /unlock)
```

### 3.3 Przepływ: Zmiana statusu z listy

```
1. Użytkownik klika prawym na wiersz → menu kontekstowe → „Zmień status"
   ↓
2. Podmenu z dozwolonymi statusami (np. Zrealizowane, Reklamacja, Anulowane)
   ↓ (wybór Reklamacja → modal z polem „Powód reklamacji")
3. POST /orders/{id}/status → aktualizacja wiersza na liście
   ↓ (np. ZRE → wiersz znika z Aktualne, pojawia się w Zrealizowane)
```

### 3.4 Przepływ: Przywracanie zlecenia

```
1. Użytkownik przechodzi do zakładki Zrealizowane lub Anulowane
   ↓
2. Prawy klik na wiersz → „Przywróć do aktualnych"
   ↓ (Anulowane: sprawdzenie czy < 24h od anulowania)
3. POST /orders/{id}/restore → wiersz wraca do zakładki Aktualne
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
│ [Logo+Ikona] LOGISTICS V1 │[Akt.|Zreal.|Anul.]│ [JD]   │
├─────────────────────────────────────────────────────────┤
│ [Pasek filtrów — bg-slate-50, border-t]                 │
│ [Przewoźnik] [Produkt] [Trasa:Zał→Rozł] [Data] [Filtr] │
│                           [ml-auto] [+ Nowe Zlecenie]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Tabela — sticky nagłówek, min-w-1280px]                │
│ │ ID    │ Status │ Trasa (Node-String)    │ Przew. │ ...│Akcje│
│ │───────│────────│───────────────────────│────────│ ...│─────│
│ │#ZT-01 │ ●WYS  │ L1:KRK→L2:KAT→U1:BER│ TRANS  │ ...│ ✎ ✗│
│ │#ZT-02 │ ROB   │ L1:WRO→U1:HAM        │ LOG-M  │ ...│ ✎ ✗│
│ │#ZT-03 │ ●KOR  │ L1:GDA→L2:SZC→U1:FRA │ EURO   │ ...│ ✎ ✗│
│ │                                                       │
│ [+ Dodaj nowy wiersz]                                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Footer — sticky h-10]                                  │
│ ● Aktywne: 24 │ ● W trasie: 12 │    System OK │ 14:32  │
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
│                      │              │ │   ROB → WYS  │  │
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
| **Przekroczony limit wyników** | Komunikat: „Zbyt wiele wyników — zawęź filtry." |
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

Kluczowy element wizualny widoku listy. Trasa prezentowana jako ciąg kolorowych węzłów połączonych strzałkami na tle poziomej linii łączącej.

**Struktura:**
```
[L1:KRK] → [L2:KAT] → [U1:BER]
```

**CSS linia łącząca (pseudo-element `::after`):**
```css
.node-line {
  position: relative;
}
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

**Kolorystyka węzłów:**
- **Załadunki (L1, L2, ...):** `bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-500/30 text-emerald-700` — z-10
- **Rozładunki (U1, U2, ...):** `bg-primary/10 dark:bg-primary/10 border border-primary/30 text-primary` — z-10
- **Strzałki:** `text-slate-300 z-10`
- Każdy węzeł: `px-1.5 py-0.5 rounded text-[10px] font-bold`

### 6.3 Tabela zleceń

**Layout:**
- Kontener: `min-w-[1280px]`
- Sticky nagłówek: `sticky top-0 bg-slate-50 border-b z-10`
- Sticky kolumna Akcje (prawa): `sticky right-0` z cieniem `shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]`
- Kompaktowe wiersze: `py-1 px-4`
- Brak obramowania między kolumnami w treści — separator poziomy `divide-y divide-slate-100`

**Hover na wierszu:**
```css
tr:hover td {
  background-color: rgba(19, 127, 236, 0.04) !important;
}
```

**Tło wiersza wg statusu (jaśniejszy odcień):**

| Status | Tło wiersza |
|---|---|
| ROB (Robocze) | `bg-white` (domyślne) |
| WYS (Wysłane) | `bg-blue-50/30` |
| KOR (Korekta) | `bg-orange-50/30` |
| KOR_WYS (Korekta wysłane) | `bg-teal-50/30` |
| ZRE (Zrealizowane) | `bg-green-50/30` |
| ANL (Anulowane) | `bg-gray-50/50` |
| REK (Reklamacja) | `bg-red-50/30` |

**Scrollbar:**
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

### 6.4 Badge statusu z animacją

Badge statusu zawiera opcjonalną animowaną kropkę (pulse) dla statusów oznaczających aktywną akcję:

| Status | Styl badge | Pulse |
|---|---|---|
| ROB | `bg-slate-100 text-slate-700` | Nie |
| WYS | `bg-blue-50 text-blue-600 border-blue-200` | Tak (`animate-pulse`) |
| KOR | `bg-orange-50 text-orange-600` | Nie |
| KOR_WYS | `bg-teal-50 text-teal-600` | Nie |
| ZRE | `bg-green-50 text-green-600` | Nie |
| ANL | `bg-gray-100 text-gray-500` | Nie |
| REK | `bg-red-50 text-red-600` | Nie |

Badge: `flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full`
Kropka pulse: `w-1.5 h-1.5 rounded-full bg-{color}-600 animate-pulse`

### 6.5 Kolumna Przewoźnika (dwuwiersz)

Kolumna przewoźnika wyświetla dane w dwóch wierszach:
- **Wiersz 1:** Nazwa firmy — `font-semibold text-slate-700`
- **Wiersz 2:** Osoba kontaktowa + telefon — `text-[10px] text-slate-400`

### 6.6 Kolumna Towaru (ikona + badge)

Kolumna towaru zawiera:
- Ikonę (Material Symbols: `inventory`, `view_in_ar`, `recycling` itp.) — `text-sm text-slate-400`
- Nazwę produktu — `font-medium`
- Badge opakowania — `text-[10px] px-1 bg-slate-100 rounded text-slate-500 uppercase`

### 6.7 Nagłówek aplikacji

```
[Logo 8×8 bg-primary rounded + ikona] [Tytuł UPPERCASE tracking-tight] | [Zakładki w bg-slate-100 rounded-lg] | [Ikony: search, notifications] [Avatar inicjały]
```

- Height: `h-14`
- Zakładki w nagłówku (nie nad tabelą): `bg-slate-100 rounded-lg p-1`
- Aktywna zakładka: `bg-white shadow-sm text-primary font-semibold`
- Nieaktywna: `text-slate-500 hover:text-slate-700`

### 6.8 Pasek filtrów

Pod nagłówkiem, oddzielony `border-t`, tło `bg-slate-50`:

- Pola wyszukiwania z ikoną Material po lewej w polu (absolute positioned)
- Input: `h-8 pl-8 pr-3 bg-white border rounded text-xs`
- Composite „Trasa": jedno pole z dwiema sekcjami rozdzielonymi `→`
- Datepicker: `h-8` z ikoną kalendarza
- Przyciski: „Filtruj" (primary bg), „Wyczyść" (ghost)
- Z prawej (`ml-auto`): „Nowe Zlecenie" (bg-emerald-600)

### 6.9 Pasek stopki ze statystykami (StatusFooter)

**Nowy komponent** — sticky na dole ekranu:

```
[Aktywne: 24 ●] [W trasie: 12 ●] [Załadunek: 6 ●] [Opóźnione: 2 ●]     System Status: OK | Ostatnia aktualizacja: 14:32:01
```

- Height: `h-10`
- Tło: `bg-slate-50 border-t border-slate-200`
- Lewa strona: `flex items-center space-x-6 text-[11px] font-medium text-slate-500`
- Każdy licznik: kolorowa kropka `w-2 h-2 rounded-full` + tekst
- Prawa strona: ikona monitor + „System Status: OK" + separator + czas aktualizacji

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
