## Widok Order — Podgląd zlecenia transportowego (format PDF)

### 1. Przegląd

Widok Order to interaktywny panel podglądu zlecenia transportowego w formacie przypominającym dokument PDF (układ A4). Służy do weryfikacji i korekty danych wprowadzonych w drawerze edycji zlecenia — użytkownik widzi wszystkie dane zlecenia w ostatecznym layoucie dokumentu i może je edytować bezpośrednio w tym widoku.

**Cel**: umożliwienie użytkownikowi sprawdzenia poprawności wszystkich danych zlecenia w formacie zbliżonym do finalnego dokumentu PDF, z możliwością edycji pól bez konieczności powrotu do formularza drawera.

**Referencja wizualna**: `test/order_2.html` — statyczny mockup HTML/CSS odwzorowujący docelowy układ A4 dokumentu.

---

### 2. Lokalizacja w UI i sposób otwarcia

- **Przycisk**: „Podgląd" — umieszczony w **stopce drawera** (obok przycisków „Zapisz zmiany" i „Zamknij").
- **Widoczność przycisku**: tylko dla ról **ADMIN** i **PLANNER**. Rola READ_ONLY nie ma dostępu do widoku Order.
- **Zachowanie**: po kliknięciu „Podgląd" drawer chowa się, a w jego miejsce pojawia się widok Order.
- **Rozmiar panelu**: szerszy niż drawer — ok. **60–70% szerokości ekranu**, wysuwany z prawej strony.
- **Wygląd**: dokładne odwzorowanie kartki A4 — białe tło kartki na szarym tle, skalowanie jak w mockupie (`transform: scale(1.3345)`, `width: 595px`, `min-height: 842px`).

---

### 3. Przepływ danych i synchronizacja

#### 3.1 Otwarcie widoku Order

1. Użytkownik wypełnia formularz w drawerze.
2. Klika przycisk „Podgląd" w stopce drawera.
3. Drawer chowa się. Widok Order otwiera się z **kopią aktualnego stanu danych z drawera**.
4. Dane pre-wypełniają odpowiednie pola w layoucie A4.

#### 3.2 Edycja w widoku Order

- Użytkownik może edytować pola bezpośrednio w widoku Order.
- Zmiany są **lokalne** — NIE wpływają natychmiast na stan drawera.
- Zmiany nie trafiają do API do momentu kliknięcia „Zapisz".

#### 3.3 Zapis zmian

- Przycisk **„Zapisz zmiany"**: wysyła PUT do API, aktualizuje stan drawera zaktualizowanymi danymi → widok Order zamyka się → drawer wraca z nowymi danymi.
- Komunikaty sukcesu/błędu: takie same jak w drawerze.

#### 3.4 Anulowanie

- Przycisk **„Anuluj"**: odrzuca wszystkie lokalne zmiany → widok Order zamyka się → drawer wraca z **oryginalnymi danymi** (sprzed otwarcia widoku Order).
- Jeśli są niezapisane zmiany: dialog potwierdzenia (analogiczny do drawera — „Czy na pewno chcesz odrzucić zmiany?").

---

### 4. Struktura sekcji widoku Order (układ A4, od góry do dołu)

Poniżej szczegółowy opis każdej sekcji widoku, z mapowaniem na pola modelu Order i formularza drawera.

---

#### Sekcja 0 — Logo firmy

| Element | Typ | Źródło | Edytowalność |
|---------|-----|--------|--------------|
| Logo ODYLION | Obraz (base64 PNG) | Hardcoded | Readonly — stały element szablonu |

- Pozycja: prawy górny róg dokumentu.
- Logo: okrągłe (border-radius 50%), 57×55px, zawsze to samo logo firmy ODYLION.

---

#### Sekcja 1 — Nagłówek zlecenia

| Lp. | Pole | Typ pola | Źródło danych | Edytowalność |
|-----|------|----------|---------------|--------------|
| 1 | Numer zlecenia | Tekst | `orderNo` z modelu Order | **Readonly** |
| 2 | Data wystawienia | Data | `createdAt` z modelu Order | **Readonly** |

- Layout: etykieta „ZLECENIE NR:" (szare tło) + pole NUMER + pole DATA WYST.
- Format daty: YYYY-MM-DD (jak w mockupie).

---

#### Sekcja 2 — Zlecający

| Lp. | Pole | Typ pola | Źródło danych | Edytowalność |
|-----|------|----------|---------------|--------------|
| 1 | Pełna nazwa firmy zlecającej | Tekst | Hardcoded: „ODYLION Sp. z o.o. Sp. k., ul. Syta 114z/1, 02-987 Warszawa PL 9512370578" | **Readonly** |

- Stały tekst — zawsze ta sama firma (właściciel systemu).

---

#### Sekcja 3 — Nagłówek warunków (stały tekst)

| Element | Typ | Edytowalność |
|---------|-----|--------------|
| „ZLECAMY PAŃSTWU TRANSPORT NA NASTĘPUJĄCYCH WARUNKACH:" | Tekst stały | **Readonly** — niezmienny element szablonu |

- Kolor tekstu: pomarańczowy (#F59444), pogrubiony.

---

#### Sekcja 4 — Spedycja (firma transportowa)

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Pełna nazwa + adres | Tekst / Autocomplete | Sekcja 3 drawera → Nazwa firmy (przewoźnik) + adres | **Edytowalne** |
| 2 | NIP | Tekst | Sekcja 3 drawera → NIP (auto po wyborze firmy) | **Readonly** (auto z firmy) |

- Mapowanie: SPEDYCJA = firma transportowa (carrier) z Sekcji 3 drawera.
- Wyświetla: pełna nazwa firmy + adres ulicy + kod pocztowy + miasto.

---

#### Sekcja 5 — Typ auta

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Opis typu auta | Select | Sekcja 3 drawera → `vehicleVariantCode` (typ auta) | **Edytowalne** |
| 2 | Objętość (m³) | Select/Combobox | Sekcja 3 drawera → `vehicleVariantCode` (objętość) | **Edytowalne** |

- Mapowanie: TYP AUTA = vehicleVariantCode z drawera.
- Wyświetla: opis wariantu (np. „ruchoma podłoga") + objętość (np. „90" m³).

---

#### Sekcja 6 — Asortyment (tabela towarów)

**Nagłówek tabeli** (526px, `ROW_526`):

| Kolumna | Opis | Szerokość |
|---------|------|-----------|
| ASORTYMENT (etykieta) | Szary label | 98px (shrink-0) |
| (pusta) | Początek nazwy produktu | 136px |
| UWAGI | Label kolumny uwag | 178px |
| LUZEM | Checkbox sposobu załadunku (loading_method_code=LUZEM) | 33px |
| PAL.+BB | Checkbox sposobu załadunku (loading_method_code=PALETA_BIGBAG) | 28px |
| PALETA | Checkbox sposobu załadunku (loading_method_code=PALETA) | 29px |
| KOSZE | Checkbox sposobu załadunku (loading_method_code=KOSZE) | 24px |

**Wiersze danych** (544px = 526px treści + 18px kolumna gutter):

| Kolumna | Opis | Szerokość |
|---------|------|-----------|
| Lp. + Nazwa towaru | Numer + ProductAutocomplete | 234px |
| Uwagi do towaru | Input tekstowy | 178px |
| LUZEM | Checkbox (klik = toggle „X", loading_method_code=LUZEM) | 33px |
| PAL.+BB | Checkbox (loading_method_code=PALETA_BIGBAG) | 28px |
| PALETA | Checkbox (loading_method_code=PALETA) | 29px |
| KOSZE | Checkbox (loading_method_code=KOSZE) | 24px |
| (gutter) | Niewidoczna kolumna — przycisk × na hover | 18px |

**Wyrównanie kolumn**: dzielnik BIGBAG|PALETA (234+178+33+28 = **473px**) wyrównany z dzielnikiem Content|GOD/KRAJ w stop rows.

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Nazwa towaru | Autocomplete (ProductAutocomplete) | Sekcja 2 drawera → Nazwa towaru | **Edytowalne** |
| 2 | Uwagi do towaru | Input tekstowy (max 500 znaków) | Sekcja 2 drawera → Komentarz (pole „Uwagi do towaru…") | **Edytowalne** |
| 3 | Sposób załadunku | Checkbox (klik na kolumnę = toggle) | Sekcja 2 drawera → `loading_method_code` (Sposób załadunku) | **Edytowalne** |

- Każdy wiersz = jedna pozycja towarowa z `items[]` modelu Order.
- **Pełna edycja**: użytkownik może dodawać i usuwać wiersze bezpośrednio w widoku Order.
- **Przycisk usuwania** (×): w kolumnie gutter 18px (poza widocznym obramowaniem tabeli), pojawia się na hover wiersza.
- Dynamiczna ilość wierszy (w mockupie przewidziano 8 slotów wizualnych, ale lista jest dynamiczna).
- Sposób załadunku: LUZEM, PAL.+BB (=PALETA_BIGBAG), PALETA, KOSZE (mapowanie na `loading_method_code`).

---

#### Sekcja 7 — Trasa: Stopy (unified stops[] z drag-and-drop)

Wszystkie stopy (LOADING + UNLOADING) renderowane jako jedna zunifikowana lista z obsługą przeciągania (DnD).

**Model stopu** (`OrderViewStop`):

| Pole | Typ | Opis |
|------|-----|------|
| `id` | string | Unikalny ID (generowany) |
| `kind` | `"LOADING"` \| `"UNLOADING"` | Typ stopu |
| `sequenceNo` | number | Numer kolejny (auto-renumeracja po DnD) |
| `date` | string \| null | Data (YYYY-MM-DD) |
| `time` | string \| null | Godzina (HH:MM) |
| `companyId` | string \| null | UUID firmy (z CompanyAutocomplete) |
| `companyName` | string \| null | Snapshot nazwy firmy |
| `locationId` | string \| null | UUID lokalizacji (z LocationAutocomplete) |
| `locationName` | string \| null | Snapshot nazwy lokalizacji |
| `address` | string \| null | Computed: ulica, kod, miasto (po wyborze lokalizacji) |
| `country` | string | Kod kraju (2-literowy, domyślnie „PL") |
| `place` | string | Fallback display text |

**Każdy stop = 2 wiersze A4** (526px, `ROW_526`):

| Wiersz | Kolumna etykiety (98px) | Kolumna treści (375px) | Kolumna prawa (53px) |
|--------|------------------------|------------------------|----------------------|
| DATA | „DATA ZAŁADUNKU N:" / „DATA ROZŁADUNKU N:" | Data (EditableText) | GOD. + godzina |
| MIEJSCE | „MIEJSCE ZAŁADUNKU N:" / „MIEJSCE ROZŁADUNKU N:" | Firma (CompanyAutocomplete, 120px) → Adres (LocationAutocomplete, flex-1) | KRAJ + kod |

**Wyrównanie kolumn**: dzielnik Content|GOD/KRAJ na **473px** od lewej = dzielnik BIGBAG|PALETA w items grid.

**Kolory tła zależne od `kind`:**

| Kind | Etykieta (bg) | Wartość (bg) |
|------|---------------|--------------|
| LOADING | `#E7E7E7` (szary) | biały |
| UNLOADING | `#F59444` (pomarańczowy) | `#FAD1A5` (jasnopomarańczowy) |

**Etykiety dynamiczne**: numer pojawia się tylko gdy >1 stop danego kind (np. „DATA ZAŁADUNKU 1:", „DATA ZAŁADUNKU 2:", ale „DATA ZAŁADUNKU:" gdy jest tylko 1).

**Drag-and-drop** (@dnd-kit):
- `DndContext` + `SortableContext` (verticalListSortingStrategy) owija listę stopów.
- `SortableStopWrapper` z uchwytem `GripVertical` (8px, pozycja absolute `left: -14px` w marginesie) — ukryty w trybie readOnly.
- **Reguły kolejności**: pierwszy stop MUSI być LOADING, ostatni MUSI być UNLOADING. Próba przeciągnięcia UNLOADING na pozycję 0 lub LOADING na ostatnią pozycję jest odrzucana.
- Po każdym drag: auto-renumeracja `sequenceNo` (1, 2, 3...).

**Autocomplete w wierszu MIEJSCE** (tryb edycji):
- **CompanyAutocomplete** (Popover + Command, 120px fixed, line-clamp-2): wybór firmy z listy, filtrowanie po nazwie.
- **LocationAutocomplete** (Popover + Command, flex-1): filtrowana po `companyId` wybranej firmy. Po wyborze lokalizacji automatycznie ustawia `address` (ulica + kod + miasto) i `country`.
- W trybie readOnly: tekst „firma, adres" inline (truncate).

**Dodawanie / usuwanie stopów:**
- „+ Załadunek" (emerald) — wstawia LOADING po ostatnim istniejącym LOADING. Disabled gdy ≥ 8 LOADING (`MAX_LOADING_STOPS`).
- „+ Rozładunek" (blue) — wstawia UNLOADING przed ostatnim istniejącym UNLOADING. Disabled gdy ≥ 3 UNLOADING (`MAX_UNLOADING_STOPS`).
- Przycisk × (na hover stopu, `right: 2px`) — usuwa stop. Widoczny gdy >2 stopy.

**Limity**: max 8 załadunków + max 3 rozładunki (stałe w `constants.ts`).

---

#### Sekcja 8 — Cena za fraht (finanse)

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Kwota | Input liczbowy | Sekcja 4 drawera → Stawka | **Edytowalne** |
| 2 | Waluta (EUR / USD / PLN) | Radio/toggle (3-kolumnowy layout) | Sekcja 4 drawera → Waluta | **Edytowalne** |
| 3 | Termin płatności | Input (tekst/liczbowy, np. „21 DNI") | Sekcja 4 drawera → Termin płatności | **Edytowalne** |
| 4 | Forma płatności | Select/tekst (np. „PRZELEW") | Sekcja 4 drawera → Forma płatności | **Edytowalne** |

- Layout waluty: 3 opcje (EUR, USD, PLN) wyświetlane obok siebie z oznaczeniem „X" przy wybranej — układ identyczny z mockupem, ale klikalny (radio/toggle).
- Kliknięcie na „X" przy innej walucie zmienia wybór.

---

#### Sekcja 9 — Dokumenty dla kierowcy

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Dokumenty | Select (2 opcje) | Sekcja 3 drawera → Wymagane dokumenty | **Edytowalne** |

- Opcje: „WZ, KPO, kwit wagowy" lub „WZE, Aneks VII, CMR".
- Automatyczny wybór na podstawie rodzaju transportu (zależność z Sekcji 1 drawera), ale nadpisywalny ręcznie.

---

#### Sekcja 10 — Uwagi dodatkowe

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Uwagi dodatkowe | Textarea (wielowierszowe) | Sekcja 5 drawera → generalNotes (max 500 znaków) | **Edytowalne** |

- Mapowanie: pole `generalNotes` z modelu Order.
- Przy otwarciu widoku Order: do treści `generalNotes` **automatycznie dopisywany jest tekst podpisu/stopki** (stały tekst firmowy). Treść tego auto-tekstu — do uzupełnienia później (TBD). Na razie pole wyświetla tylko zawartość `generalNotes`.
- Max 500 znaków.

---

#### Sekcja 11 — Klauzula o zachowaniu poufności

| Lp. | Pole | Typ pola | Źródło danych | Edytowalność |
|-----|------|----------|---------------|--------------|
| 1 | Klauzula poufności | Textarea (wielowierszowe) | Nowe pole w modelu Order (lub domyślny szablon) | **Edytowalne** |

- **Pre-wypełniona** domyślnym tekstem szablonu (tekst z mockupu, dotyczący ODYLION Sp. z o.o. Sp. k.).
- Użytkownik może edytować treść klauzuli — **zmiany zapisywane per zlecenie**.
- Jeśli użytkownik zmieni tekst klauzuli w jednym zleceniu, zmiana dotyczy tylko tego zlecenia.
- Przy nowym zleceniu: klauzula zaczyna od domyślnego szablonu.
- Wymaga **nowego pola w modelu Order** (np. `confidentialityClause`, typ: text, nullable, domyślna wartość = szablon).

**Domyślny tekst szablonu** (z mockupu):

> Wszelkie informacje przekazane przez ODYLION Sp. z o.o. Sp. k. z siedzibą w Warszawie, KRS nr 0000474035, NIP: 9512370578 (dalej „ODYLION") dla celów realizacji niniejszego zlecenia transportowego, stanowią, w rozumieniu właściwych przepisów prawa, informacje poufne oraz tajemnicę handlową przedsiębiorstwa ODYLION, i jako takie mogą być wykorzystywane jedynie dla celów wykonania niniejszego zlecenia transportowego oraz jedynie przez podmioty wykonujące to zlecenie, w szczególności nie mogą zostać bez wyraźnej zgody ODYLION, w jakikolwiek sposób ujawnione innym podmiotom aniżeli wykonującym niniejsze zlecenie transportowe. Naruszenie powyższych obowiązków każdorazowo skutkować będzie odpowiedzialnością odszkodowawczą osób w sposób nieuprawniony ujawniających informacje poufne i handlowe ODYLION.

---

#### Sekcja 12 — Osoba zlecająca

| Lp. | Pole | Typ pola | Źródło danych | Edytowalność |
|-----|------|----------|---------------|--------------|
| 1 | Imię i nazwisko | Tekst | Profil zalogowanego użytkownika | **Readonly** |
| 2 | E-mail | Tekst | Profil zalogowanego użytkownika | **Readonly** |
| 3 | Telefon | Tekst | Profil zalogowanego użytkownika | **Readonly** |

- Dane pobierane z profilu aktualnie zalogowanego użytkownika (tego, który wypełnia drawer).
- Pozycja: prawy dolny róg dokumentu A4.
- Layout: nagłówek „OSOBA ZLECAJĄCA:" + imię, poniżej E-MAIL i TELEFON z etykietami.

---

### 5. Przyciski akcji widoku Order

Widok Order posiada dwa przyciski akcji (umieszczone w stopce lub nagłówku panelu):

| Przycisk | Działanie |
|----------|-----------|
| **Zapisz zmiany** (primary) | Walidacja → PUT `/api/v1/orders/{id}` → aktualizacja stanu drawera → zamknięcie widoku Order → powrót do drawera z nowymi danymi |
| **Anuluj** | Odrzucenie zmian lokalnych → zamknięcie widoku Order → powrót do drawera z oryginalnymi danymi |

- Przy niezapisanych zmianach i kliknięciu „Anuluj": dialog potwierdzenia (analogiczny do drawera).
- Brak przycisku „Generuj PDF" ani „Wyślij maila" w tym widoku (te akcje są dostępne z drawera).

---

### 6. Uprawnienia

| Rola | Dostęp do widoku Order | Edycja pól | Przycisk „Podgląd" widoczny |
|------|------------------------|------------|----------------------------|
| ADMIN | Tak | Tak | Tak |
| PLANNER | Tak | Tak | Tak |
| READ_ONLY | Nie | Nie | Nie (przycisk ukryty) |

---

### 7. Elementy stałe szablonu (readonly, niezależne od danych)

Poniższe elementy są zawsze takie same — nie zależą od danych zlecenia:

1. **Logo ODYLION** — prawy górny róg, hardcoded base64 PNG.
2. **Tekst firmy zlecającej**: „ODYLION Sp. z o.o. Sp. k., ul. Syta 114z/1, 02-987 Warszawa PL 9512370578".
3. **Nagłówek warunków**: „ZLECAMY PAŃSTWU TRANSPORT NA NASTĘPUJĄCYCH WARUNKACH:" (pomarańczowy).
4. **Klauzula poufności** — pre-wypełniona domyślnym szablonem (ale edytowalna per zlecenie).

---

### 8. Nowe pola modelu (wymagane dla widoku Order)

Widok Order wymaga dodania następujących pól do modelu Order / bazy danych:

| Pole | Typ | Domyślna wartość | Opis |
|------|-----|-------------------|------|
| `confidentialityClause` | TEXT, nullable | Tekst szablonu klauzuli | Treść klauzuli poufności per zlecenie; jeśli NULL → używany szablon domyślny |

**Uwaga**: pole na auto-tekst podpisu/stopki w Uwagach dodatkowych — treść TBD (do uzupełnienia w przyszłości). Mechanizm: przy otwarciu widoku Order tekst podpisu dopisywany jest do `generalNotes`. Szczegóły implementacji do ustalenia po podaniu treści.

---

### 9. Zależności techniczne

- **Współdzielony stan React**: widok Order otrzymuje kopię stanu z drawera przy otwarciu. Po zapisie — aktualizacja stanu drawera.
- **API**: wykorzystuje istniejące endpointy (`GET /api/v1/orders/{id}`, `PUT /api/v1/orders/{id}`). Nie wymaga nowych endpointów.
- **Blokada**: widok Order działa w ramach istniejącej blokady drawera (użytkownik musi mieć aktywny lock na zleceniu).
- **Walidacja**: taka sama jak w drawerze (techniczna przy „Zapisz", biznesowa przy „Wyślij maila" — ale „Wyślij maila" nie jest dostępny z widoku Order).
- **@dnd-kit**: biblioteka drag-and-drop do reorderowania stopów (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`).
- **Shadcn/ui Popover + Command**: pattern autocomplete dla CompanyAutocomplete, LocationAutocomplete i ProductAutocomplete.

---

### 10. Mapowanie sekcji widoku Order ↔ Sekcje drawera

| Sekcja widoku Order | Sekcja drawera | Pola |
|---------------------|----------------|------|
| Sek. 1 (Nagłówek zlecenia) | Sekcja 0 drawera | Nr zlecenia, data utworzenia |
| Sek. 2 (Zlecający) | — (hardcoded) | Firma ODYLION |
| Sek. 4 (Spedycja) | Sekcja 3 drawera | Firma transportowa, NIP |
| Sek. 5 (Typ auta) | Sekcja 3 drawera | vehicleVariantCode (typ + m³) |
| Sek. 6 (Asortyment) | Sekcja 2 drawera | items[] (nazwa, uwagi, opakowanie) |
| Sek. 7 (Trasa — unified stops) | Sekcja 1 drawera | stops[] (unified LOADING + UNLOADING z DnD) |
| Sek. 8 (Cena za fraht) | Sekcja 4 drawera | Stawka, waluta, termin, forma płatności |
| Sek. 9 (Dokumenty) | Sekcja 3 drawera | Wymagane dokumenty |
| Sek. 10 (Uwagi dodatkowe) | Sekcja 5 drawera | generalNotes |
| Sek. 11 (Klauzula) | — (nowe pole) | confidentialityClause |
| Sek. 12 (Osoba zlecająca) | — (z sesji) | Zalogowany użytkownik |
