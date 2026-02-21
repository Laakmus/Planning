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

**Nagłówek tabeli:**

| Kolumna | Opis | Szerokość (przybliżona) |
|---------|------|-------------------------|
| Lp. + Nazwa towaru | Numer pozycji + nazwa produktu | ~235px |
| Uwagi do towaru | Komentarz/uwagi per pozycja (textarea) | ~178px (połączone 2 kolumny z mockupu) |
| Typ opakowania | Select: LUZEM / BIGBAG / PALETA / INNA | ~114px |

**Wiersze danych:**

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Nazwa towaru | Autocomplete | Sekcja 2 drawera → Nazwa towaru | **Edytowalne** |
| 2 | Uwagi do towaru | Input tekstowy (max 500 znaków) | Sekcja 2 drawera → Komentarz (pole „Uwagi do towaru…") | **Edytowalne** |
| 3 | Typ opakowania | Select (dropdown) | Sekcja 2 drawera → Sposób załadunku | **Edytowalne** |

- Każdy wiersz = jedna pozycja towarowa z `items[]` modelu Order.
- **Pełna edycja**: użytkownik może dodawać i usuwać wiersze bezpośrednio w widoku Order.
- Dynamiczna ilość wierszy (w mockupie przewidziano 8 slotów wizualnych, ale lista jest dynamiczna).
- Opcje selecta: LUZEM, BIGBAG, PALETA, INNA (mapowanie na `packagingType` / `loadingMethod`).
- Kolumna „NR ZAMÓWIENIA" z mockupu zastąpiona jedną kolumną „Uwagi do towaru".

---

#### Sekcja 7 — Trasa: Załadunek

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Data załadunku | Datepicker | Sekcja 1 drawera → pierwszy stop LOADING → data | **Edytowalne** |
| 2 | Godzina załadunku | Timepicker | Sekcja 1 drawera → pierwszy stop LOADING → godzina | **Edytowalne** |
| 3 | Miejsce załadunku (firma + adres) | Autocomplete / tekst | Sekcja 1 drawera → pierwszy stop LOADING → firma + oddział + adres | **Edytowalne** |
| 4 | Kraj | Tekst (2-literowy kod) | Sekcja 1 drawera → pierwszy stop LOADING → kraj | **Edytowalne** |

- Tło: standardowe (białe/szare jak nagłówki).
- Mapowanie: pierwszy stop z `stops[]` o typie LOADING.

---

#### Sekcja 8 — Trasa: Doładunki (dynamiczna ilość)

Dla każdego **środkowego** stopu z `stops[]` (wszystkie stopy pomiędzy pierwszym LOADING a ostatnim UNLOADING):

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Data doładunku N | Datepicker | Środkowy stop N → data | **Edytowalne** |
| 2 | Godzina doładunku N | Timepicker | Środkowy stop N → godzina | **Edytowalne** |
| 3 | Miejsce doładunku N (firma + adres) | Autocomplete / tekst | Środkowy stop N → firma + oddział + adres | **Edytowalne** |
| 4 | Kraj | Tekst (2-literowy kod) | Środkowy stop N → kraj | **Edytowalne** |

- Tło: jasnoszare (#F8F8F8) — odróżnienie od załadunku i rozładunku.
- **Dynamiczna ilość**: tyle wierszy doładunku, ile środkowych stopów w `stops[]`. Brak limitu 3 (mockup pokazuje 3 sloty, ale widok obsługuje dowolną liczbę).
- **Pełna edycja**: można dodawać i usuwać doładunki.
- Każdy doładunek to 2 wiersze: data+godzina oraz miejsce+kraj.
- Etykieta: „DATA DOŁADUNKU N:" / „MIEJSCE DOŁADUNKU N:" (N = numer kolejny).

---

#### Sekcja 9 — Trasa: Rozładunek

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Data rozładunku | Datepicker | Sekcja 1 drawera → ostatni stop UNLOADING → data | **Edytowalne** |
| 2 | Godzina rozładunku | Timepicker | Sekcja 1 drawera → ostatni stop UNLOADING → godzina | **Edytowalne** |
| 3 | Miejsce rozładunku (firma + adres) | Autocomplete / tekst | Sekcja 1 drawera → ostatni stop UNLOADING → firma + oddział + adres | **Edytowalne** |
| 4 | Kraj | Tekst (2-literowy kod) | Sekcja 1 drawera → ostatni stop UNLOADING → kraj | **Edytowalne** |

- Tło: **pomarańczowe** — etykiety: #F59444 (bg-orange), pola danych: #FAD1A5 (bg-peach).
- Mapowanie: ostatni stop z `stops[]` o typie UNLOADING.

---

#### Sekcja 10 — Cena za fraht (finanse)

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Kwota | Input liczbowy | Sekcja 4 drawera → Stawka | **Edytowalne** |
| 2 | Waluta (EUR / USD / PLN) | Radio/toggle (3-kolumnowy layout) | Sekcja 4 drawera → Waluta | **Edytowalne** |
| 3 | Termin płatności | Input (tekst/liczbowy, np. „21 DNI") | Sekcja 4 drawera → Termin płatności | **Edytowalne** |
| 4 | Forma płatności | Select/tekst (np. „PRZELEW") | Sekcja 4 drawera → Forma płatności | **Edytowalne** |

- Layout waluty: 3 opcje (EUR, USD, PLN) wyświetlane obok siebie z oznaczeniem „X" przy wybranej — układ identyczny z mockupem, ale klikalny (radio/toggle).
- Kliknięcie na „X" przy innej walucie zmienia wybór.

---

#### Sekcja 11 — Dokumenty dla kierowcy

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Dokumenty | Select (2 opcje) | Sekcja 3 drawera → Wymagane dokumenty | **Edytowalne** |

- Opcje: „WZ, KPO, kwit wagowy" lub „WZE, Aneks VII, CMR".
- Automatyczny wybór na podstawie rodzaju transportu (zależność z Sekcji 1 drawera), ale nadpisywalny ręcznie.

---

#### Sekcja 12 — Uwagi dodatkowe

| Lp. | Pole | Typ pola | Źródło danych (drawer) | Edytowalność |
|-----|------|----------|------------------------|--------------|
| 1 | Uwagi dodatkowe | Textarea (wielowierszowe) | Sekcja 5 drawera → generalNotes (max 500 znaków) | **Edytowalne** |

- Mapowanie: pole `generalNotes` z modelu Order.
- Przy otwarciu widoku Order: do treści `generalNotes` **automatycznie dopisywany jest tekst podpisu/stopki** (stały tekst firmowy). Treść tego auto-tekstu — do uzupełnienia później (TBD). Na razie pole wyświetla tylko zawartość `generalNotes`.
- Max 500 znaków.

---

#### Sekcja 13 — Klauzula o zachowaniu poufności

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

#### Sekcja 14 — Osoba zlecająca

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

---

### 10. Mapowanie sekcji widoku Order ↔ Sekcje drawera

| Sekcja widoku Order | Sekcja drawera | Pola |
|---------------------|----------------|------|
| Sek. 1 (Nagłówek zlecenia) | Sekcja 0 drawera | Nr zlecenia, data utworzenia |
| Sek. 2 (Zlecający) | — (hardcoded) | Firma ODYLION |
| Sek. 4 (Spedycja) | Sekcja 3 drawera | Firma transportowa, NIP |
| Sek. 5 (Typ auta) | Sekcja 3 drawera | vehicleVariantCode (typ + m³) |
| Sek. 6 (Asortyment) | Sekcja 2 drawera | items[] (nazwa, uwagi, opakowanie) |
| Sek. 7 (Załadunek) | Sekcja 1 drawera | stops[0] (pierwszy LOADING) |
| Sek. 8 (Doładunki) | Sekcja 1 drawera | stops[1..N-1] (środkowe) |
| Sek. 9 (Rozładunek) | Sekcja 1 drawera | stops[last] (ostatni UNLOADING) |
| Sek. 10 (Cena za fraht) | Sekcja 4 drawera | Stawka, waluta, termin, forma płatności |
| Sek. 11 (Dokumenty) | Sekcja 3 drawera | Wymagane dokumenty |
| Sek. 12 (Uwagi dodatkowe) | Sekcja 5 drawera | generalNotes |
| Sek. 13 (Klauzula) | — (nowe pole) | confidentialityClause |
| Sek. 14 (Osoba zlecająca) | — (z sesji) | Zalogowany użytkownik |
