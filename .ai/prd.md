## 1. Przegląd produktu

Produkt: wewnętrzna aplikacja webowa do planowania i wystawiania zleceń transportowych dla firmy zajmującej się hurtowym skupem złomu metali kolorowych oraz papieru.

Głównym celem produktu jest zastąpienie obecnego, rozbudowanego arkusza Excel używanego do planowania transportów i generowania zleceń transportowych na rzecz:

- wygodnego widoku planistycznego zleceń (wierszy),
- szybkiego wprowadzania i aktualizacji danych o transportach,
- integracji słownikowej z firmową bazą danych (ERP),
- generowania plików PDF ze zleceniami transportowymi,
- przechowywania historii zrealizowanych/anulowanych zleceń.

Docelowa technologia (informacyjnie, dla zespołu technicznego):

- frontend: Astro + React + TypeScript + Tailwind CSS, przeglądarka: Chrome na laptopach,
- backend/API: środowisko Node/TypeScript, integracja z PostgreSQL (testowo Supabase),
- dane słownikowe: pobierane z firmowej bazy ERP (transportujący, nadawcy, odbiorcy, towary),
- hosting: pipeline GitHub Actions, deployment na wybraną infrastrukturę (np. hosting statyczny + backend).

Zakres tego PRD dotyczy głównie funkcjonalności MVP (planowanie i podstawowe generowanie PDF), z zaznaczeniem funkcji przewidzianych na etap 2.

## 2. Problem użytkownika

Obecnie planowanie i zlecanie transportów odbywa się w rozbudowanym arkuszu Excel, co generuje następujące problemy:

2.1 Problemy z użytecznością i czytelnością

- Arkusz zawiera bardzo długie wiersze (do ok. 120 kolumn), co utrudnia pracę planistom.
- Trudno jest szybko ocenić kluczowe informacje o zleceniu z poziomu jednego ekranu.
- Brakuje przejrzystego widoku skróconego (podsumowania) z możliwością wejścia w szczegóły w osobnym, wygodnym widoku.

  2.2 Problemy ze skalą i współdzieleniem

- Plik Excel jest ciężki i przy pracy kilku osób jednocześnie zacina się.
- Przy równoczesnej edycji przez wielu użytkowników dane mogą zostać nadpisane lub zapisane w niewłaściwym miejscu.
- Brakuje mechanizmu blokady edycji jednego wiersza, co prowadzi do konfliktów.

  2.3 Problemy z aktualnością danych słownikowych

- Dane o firmach transportowych, nadawcach, odbiorcach i towarach są w głównej bazie ERP, ale Excel wymaga ręcznego aktualizowania tych danych.
- Po dodaniu nowej firmy lub lokalizacji w ERP arkusz musi być ręcznie aktualizowany, co jest czasochłonne i podatne na błędy.

  2.4 Ograniczenia w planowaniu i analizie

- Planowanie opiera się na jednym pliku, który nie zapewnia wygodnego filtrowania i podziału odpowiedzialności (kraj/eksport/kontenery).
- Trudno jest szybko sprawdzić, gdzie jedzie konkretny towar, ile transportów zostało zaplanowanych lub zrealizowanych dla danej relacji czy przewoźnika.
- Choć dane można raportować z Excela, nie jest to zoptymalizowane pod długoterminowe przechowywanie i filtrowanie dużej liczby zleceń.

  2.5 Problemy w procesie generowania i wysyłki zleceń

- Generowanie zlecenia i dodawanie go do Outlooka jest dziś ściśle związane z Excelem.
- Chociaż PDF i wysyłka działają, brakuje lepszego, stabilniejszego środowiska do planowania, które następnie generuje zlecenia PDF.

Nowy produkt ma przede wszystkim poprawić:

- szybkość i wygodę planowania,
- jakość i spójność danych,
- stabilność i bezpieczeństwo współdzielonej pracy wielu planistów,
  przy zachowaniu możliwości generowania zleceń transportowych w formacie PDF.

## 3. Wymagania funkcjonalne

3.1 Zakres MVP (etap 1)

3.1.1 Dostęp, uwierzytelnianie i role

- Proste logowanie użytkownika (login/hasło) dla pracowników wewnętrznych firmy.
- Dostęp do aplikacji z poziomu przeglądarki Chrome na laptopach.
- Aplikacja przeznaczona do użycia głównie z sieci firmowej lub przez VPN (konfiguracja po stronie IT).
- System definiuje trzy role użytkowników:
  - ADMIN: pełny dostęp do wszystkich funkcji, w tym synchronizacji słowników i zarządzania użytkownikami,
  - PLANNER: pełny dostęp do planowania zleceń (tworzenie, edycja, wysyłka, zmiana statusów) oraz synchronizacji słowników,
  - READ_ONLY: podgląd listy zleceń, szczegółów, historii zmian i generowanie PDF — bez możliwości edycji, tworzenia ani zmiany statusów.
- Rola przypisywana jest na poziomie konta użytkownika w systemie.

  3.1.2 Widok planistyczny aktualnych zleceń

- Główny ekran aplikacji prezentuje listę wierszy reprezentujących zlecenia transportowe w zakładce aktualne.
- Każdy wiersz (zlecenie) w widoku skróconym prezentuje m.in.:
  - ikonę blokady (jeśli zlecenie edytowane przez innego użytkownika),
  - numer zlecenia,
  - rodzaj transportu (krajowy, eksport drogowy, kontener morski, import) — jako kolorowy badge,
  - sekwencję punktów trasy w formie wizualnej (node-string): skrócone kody miejsc załadunku (zielone) i rozładunku (niebieskie) połączone strzałkami i linią, np. L1:KRK → L2:KAT → U1:BER,
  - datę i godzinę pierwszego i ostatniego załadunku i rozładunku (w formie czytelnego skrótu),
  - przewoźnika (nazwa firmy + skrócona informacja o kontakcie),
  - opis towaru (nazwa produktu + typ opakowania, np. luzem, bigbag, paleta, inne),
  - koszt transportu (cena globalna za transport z walutą),
  - status zlecenia (np. robocze, wysłane, korekta, korekta wysłane, zrealizowane, anulowane, reklamacja) — jako kolorowy badge,
  - podstawowe uwagi do zlecenia (skrócone),
  - ikonę „Wyślij maila" jako bezpośrednią akcję.
- Wiersze statusów Wysłane i Korekta wysłane mają zielone tło (`bg-emerald-50/30`). Pozostałe wiersze mają domyślne białe tło.
- Na dole widoku wyświetlany jest pasek statystyk z liczbą zleceń w poszczególnych statusach oraz informacją o ostatniej aktualizacji danych.
- Widok oferuje dwa warianty prezentacji listy (wdrożone):
  - widok trasy: trasa w jednej kolumnie (node-string), daty załadunku i daty rozładunku w osobnych kolumnach,
  - widok kolumn: miejsca załadunków i rozładunków w osobnych kolumnach, data załadunku i data rozładunku jako dwie osobne kolumny; typ auta = rodzaj auta + objętość (wybierane oddzielnie, wyświetlane łącznie np. „firanka (90m³)”); szczegóły kolumn widoku „Kolumny” — patrz plan implementacji widoku głównego.
- Trzeci wariant (widok logiczny) — do wyboru w przyszłości, **na razie nie wdrażany**; kolejność kolumn grupująca logicznie elementy:
  - **Tożsamość i stan:** Blokada (tylko ikona, bez etykiety), Nr zlecenia, Status, Rodzaj transportu.
  - **Trasa:** Miejsce załadunku (każdy punkt w nowej linii), Data załadunku (lista dat z godzinami), Miejsce rozładunku (każdy punkt w nowej linii), Data rozładunku (lista dat z godzinami).
  - **Ładunek:** Towar (pozycje numerowane + „Razem: Xt”), Komentarz (lista ponumerowana, powiązana z pozycjami towaru).
  - **Wykonawca i warunki:** Firma transportowa, Typ auta (rodzaj + objętość wybierane oddzielnie, wyświetlane np. „firanka (90m³)”), Stawka (kwota + waluta).
  - **Wysłanie:** Data wysłania zlecenia (linia 1: imię i nazwisko osoby wysyłającej, linia 2: data bez godziny).

  3.1.2a Szczegółowa specyfikacja widoku głównego (ekran listy zleceń)

Poniższa sekcja definiuje układ, kolejność elementów, zawartość kolumn tabeli oraz sposób wyświetlania z przykładami. Dotyczy ekranu `/orders` po zalogowaniu. Nagłówek strony, pasek filtrów oraz nagłówek tabeli (nazwy kolumn) są sticky; przewija się wyłącznie lista wierszy (ciało tabeli). Na wąskich ekranach tabela przewija się w poziomie z widocznym paskiem przewijania u dołu.

**1. Nawigacja (sidebar + header)**

- **Sidebar (lewy panel)**: Collapsible sidebar (shadcn/ui Sidebar) z elementami:
  - Nagłówek: logo aplikacji (ikona Truck) + tytuł „Zlecenia Transportowe”
  - Nawigacja: 3 pozycje — Aktualne, Zrealizowane, Anulowane (ikony Lucide: ClipboardList, CheckCircle2, XCircle)
  - Stopka: przycisk „Aktualizuj dane” (SyncButton), przełącznik motywu (ThemeToggle), blok użytkownika (UserInfo)
  - Collapsible: Cmd+B / Ctrl+B. Na mobile: Sheet overlay.
- **Blok użytkownika** (w stopce sidebara):
  - Wiersz 1: imię i nazwisko zalogowanego użytkownika (np. „Jan Kowalski”).
  - Wiersz 2: rola zwykłym tekstem — „Admin”, „Planner” lub „Read only” (bez badge’a).
  - Przycisk „Wyloguj” obok bloku imienia i roli.
- Bez avatara i zdjęcia użytkownika.
- **Inline header** (w main content area): SidebarTrigger (hamburger) + separator + tytuł aktywnego widoku (np. „Aktualne zlecenia”).

**2. Pasek filtrów (sticky pod nagłówkiem)**

- Kolejność filtrów (od lewej): rodzaj transportu, status, firma załadunku, firma rozładunku, Firma transportowa, towar, numer tygodnia, wyszukiwanie pełnotekstowe. Z prawej strony pasa: przycisk „Nowe zlecenie” (widoczny tylko w zakładce Aktualne i tylko dla ról Admin oraz Planner).
- Typy filtrów i sposób wyświetlania:
  - **Rodzaj transportu:** lista zamknięta (select); użytkownik wybiera np. kraj, eksport, import itd. Przykład wyświetlania w polu po wyborze: „kraj”.
  - **Status:** lista zamknięta; wybór jednego statusu z listy (robocze, wysłane, korekta, korekta wysłane, zrealizowane, reklamacja, anulowane). Przykład: „wysłane”.
  - **Firma załadunku:** pole z podpowiedziami (autocomplete); wyszukiwanie po firmie lub konkretnej lokalizacji; filtr zwraca wszystkie zlecenia, gdzie wybrana firma/lokalizacja występuje na **dowolnym** miejscu załadunku (L1, L2, … do L8). Przykład wpisu: „Nord” → wybór „Nord Sp. z o.o.: oddział Gorzyce”.
  - **Firma rozładunku:** jak wyżej; zwraca zlecenia, gdzie firma/lokalizacja występuje na **dowolnym** miejscu rozładunku (U1, U2, U3). Przykład: „Berlina” → „Berlina Logistik: oddział Berlin”.
  - **Firma transportowa:** pole z podpowiedziami; wybór firmy przewoźnika. Przykład: „Trans” → „Transport Express Sp. z o.o.”.
  - **Towar:** pole z podpowiedziami; wybór z słownika towarów. Przykład: „miedź” → „miedź wire rod”.
  - **Numer tygodnia:** pole tekstowe — użytkownik wpisuje ręcznie numer tygodnia (np. „07” lub „2026-07”). Format do ustalenia (np. ISO numer tygodnia).
  - **Wyszukiwanie pełnotekstowe:** pole tekstowe; użytkownik wpisuje słowo lub kilka słów; wyszukiwane są tylko wiersze zawierające tę kombinację. Przykład: „Gorzyce 15t” — tylko zlecenia zawierające oba wyrazy w wyszukiwanym tekście.
- Przycisk „Wyczyść filtry” (np. obok ostatniego filtra lub na końcu wiersza).
- Filtry w jednym wierszu; na wąskim ekranie dopuszczalne zawinięcie na drugi wiersz.
- Nazwy filtrów w UI są spójne z nazwami kolumn w tabeli (np. „Firma transportowa” w filtrze i w nagłówku kolumny).

**3. Ustawienia listy**

- W tym samym wierszu co pasek filtrów (np. z prawej): wybór rozmiaru strony (50 / 100 / 200) oraz przełącznik widoku tabeli: **Trasa** | **Kolumny**.

**4. Tabela zleceń — kolumny i sposób wyświetlania**

Minimalna szerokość tabeli (np. 1280px); nagłówek tabeli jest sticky. Sortowanie: klik w nagłówek kolumny (np. data załadunku, data rozładunku, numer zlecenia, Firma transportowa). Tło wiersza: tylko Wysłane i Korekta wysłane mają zielone tło, pozostałe białe. Akcja „Wyślij maila" dostępna z menu kontekstowego (prawy klik) oraz z drawer footer.

**4.1. Widok „Kolumny” — kolejność kolumn od lewej do prawej**

| Lp | Nazwa kolumny | Zawartość i format wyświetlania | Przykład |
|----|----------------|----------------------------------|----------|
| 1 | (bez etykiety) | Ikona blokady (np. kłódka), tylko gdy zlecenie jest zablokowane przez innego użytkownika; brak etykiety w nagłówku. | 🔒 lub puste |
| 2 | Nr zlecenia | Numer zlecenia (np. generowany przez system). | ZT2026/0042 |
| 3 | Status | Nazwa statusu jako badge; wyświetlana jest skrócona nazwa w UI: robocze, wysłane, korekta, **Korekta_w** (dla „korekta wysłane"), zrealizowane, reklamacja, anulowane. | wysłane |
| 4 | Tydzień | Numer tygodnia ISO 8601 **obliczany automatycznie** z daty pierwszego załadunku; wyświetlany jako liczba całkowita (np. 7); **nie edytowalny** przez użytkownika. | 7 |
| 5 | Rodzaj transportu | Nazwa rodzaju (kraj, eksport drogowy, kontener morski, import itd.). | kraj |
| 6 | Miejsce załadunku | Lista wszystkich punktów załadunku; **każdy punkt w nowej linii**. Format: numer/oznaczenie punktu + nazwa firmy + oddział, np. „L1 NazwaFirmy: oddział X". | L1 Nord: oddział Gorzyce<br>L2 Metalex: oddział Katowice |
| 7 | Data załadunku | **Tylko pierwsza data** załadunku z godziną. Format daty: **DD.MM** (bez roku; baza przechowuje YYYY-MM-DD, formatowanie w UI). | 12.02 08:00 |
| 8 | Miejsce rozładunku | Jak wyżej, dla punktów rozładunku; każdy punkt w nowej linii. Format np. „U1 NazwaFirmy: oddział Y". | U1 Berlina: oddział Berlin |
| 9 | Data rozładunku | **Tylko pierwsza data** rozładunku z godziną. Format daty: **DD.MM** (bez roku; baza przechowuje YYYY-MM-DD, formatowanie w UI). | 13.02 09:00 |
| 10 | Towar | Pozycje towarowe numerowane; dla każdej: nazwa, ilość, jednostka/opakowanie; w ostatniej linii suma: „Razem: Xt". | 1. miedź (5t, big bag)<br>2. miedź milbera (10t, paleta)<br>Razem: 15t |
| 11 | Komentarz | Lista komentarzy ponumerowana (powiązana z pozycjami towaru lub zleceniem); każdy wpis w nowej linii. | 1. ładujemy na końcu naczepy<br>2. ładuje tylko Otwock |
| 12 | Firma transportowa | Nazwa firmy przewoźnika (z słownika). | Transport Express Sp. z o.o. |
| 13 | Typ auta | Rodzaj auta + objętość w nawiasie; **rodzaj i objętość wybierane w formularzu oddzielnie**, w tabeli wyświetlane łącznie. | firanka (90m³) |
| 14 | Stawka | Kwota + waluta, bez separatorów tysięcy lub z separatorem (spójnie w całej aplikacji). | 1450 PLN |
| 15 | Data wysłania zlecenia | **Linia 1:** imię i nazwisko osoby, która wysłała zlecenie.<br>**Linia 2:** data (bez godziny, format DD.MM.YYYY). | Jan Kowalski<br>11.02.2026 |

Uwaga: kolejność kolumn oraz lista kolumn mogą być w przyszłości korygowane; powyższa tabela stanowi wersję referencyjną dla widoku „Kolumny”.

**4.2. Widok „Trasa" — różnica względem „Kolumny"**

- Zamiast czterech osobnych kolumn **Miejsce załadunku**, **Data załadunku**, **Miejsce rozładunku** i **Data rozładunku** w widoku „Trasa" stosuje się:
  - jedną kolumnę **Trasa** (node-string): sekwencja punktów załadunku i rozładunku w jednej linii wizualnej, np. L1:KRK → L2:KAT → U1:BER (załadunki np. zielone, rozładunki np. niebieskie),
  - oraz kolumny **Data załadunku** i **Data rozładunku** (każda osobno — wyświetlana jest **wyłącznie pierwsza data** załadunku / pierwsza data rozładunku; format DD.MM HH:MM; jeśli brak daty — „—").
- Pozostałe kolumny (Blokada, Nr zlecenia, Status, Tydzień, Rodzaj transportu, Towar, Komentarz, Firma transportowa, Typ auta, Stawka, Data wysłania zlecenia, Akcje) pozostają jak w tabeli powyżej; kolejność może być dostosowana tak, aby kolumna Trasa była w logicznym miejscu (np. po Tydzień i Rodzaj transportu).

**5. Akcje i stany puste**

- Przycisk „Nowe zlecenie” (lub „Dodaj nowy wiersz”): **tylko** w zakładce Aktualne, **tylko** dla ról Admin i Planner, w **jednym miejscu** — w pasie filtrów z prawej strony.
- Stany puste (EmptyState):
  - **Brak zleceń** — gdy w danej zakładce nie ma żadnych zleceń; w zakładce Aktualne: przycisk „Dodaj nowy wiersz”. Przykład komunikatu: „Brak zleceń w tej zakładce.”.
  - **Brak wyników dla zastosowanych filtrów** — gdy filtry zwracają pusty zestaw; przycisk „Wyczyść filtry”. Przykład: „Brak zleceń spełniających kryteria. Zmień filtry lub wyczyść je.”.
- Trzeci wariant („Zbyt wiele wyników — zawęź filtry”) nie jest używany.

**6. Menu kontekstowe (prawy klik na wierszu)**

- Opcje: Wyślij maila, Historia zmian, Zmień status (podmenu z dozwolonymi przejściami), Skopiuj zlecenie, Anuluj zlecenie; w zakładkach Zrealizowane i Anulowane dodatkowo: Przywróć do aktualnych. Opcje zależne od roli (np. Read only — tylko Historia zmian).
- **Reklamacja:** Przy zmianie statusu na reklamacja wymagane jest pole „Powód reklamacji” — zarówno z menu kontekstowego (lista), jak i z draweru edycji. Jeśli użytkownik zamknie okienko/panel bez wpisania powodu, status **nie** zmienia się na reklamacja (zmiana jest anulowana).
- Otwieranie menu: na razie **tylko prawy klik myszy** (bez skrótu klawiaturowego).

**7. Stopka (sticky na dole ekranu)**

- Wysokość np. 40px (h-10); zawsze widoczna, także przy pustej liście.
- **Lewa strona:** liczniki zleceń (np. tylko „Aktywne: X” dla bieżącej zakładki lub liczniki per status — bez „W trasie”, „Załadunek”, „Opóźnione”).
- **Prawa strona:** tekst „System Status: OK” oraz „Ostatnia aktualizacja: HH:MM” (czas ostatniego pobrania listy).

---

  3.1.3 Filtrowanie i sortowanie w widoku planistycznym

- Możliwość filtrowania listy wierszy po co najmniej:
  - rodzaju transportu (krajowy, eksport, kontener),
  - przewoźniku,
  - towarze,
  - miejscu załadunku,
  - miejscu rozładunku,
  - zakresie dat (np. data załadunku, data rozładunku).
- Możliwość sortowania m.in. po:
  - dacie i godzinie załadunku,
  - dacie i godzinie rozładunku,
  - numerze zlecenia,
  - przewoźniku.
- Możliwość filtrowania także po:
  - miejscach załadunku,
  - miejscach rozładunku.

  3.1.4 Zakładki widoków

- Trzy główne widoki (zakładki):
  - aktualne: zlecenia w toku, planowane, wysłane, w korekcie lub z reklamacją, które nie są ostatecznie zakończone,
  - zrealizowane: zlecenia zakończone (transport się odbył) i przeniesione do archiwum,
  - anulowane: zlecenia anulowane, przechowywane tymczasowo (24 godziny), po czym usuwane z bazy.
- Różnice między widokami:
  - aktualne: neutralne tło w jasnoniebieskim lub białym kolorze,
  - zrealizowane (archiwum): odrębna zakładka, np. lekko żółta kolorystyka (informacyjna),
  - anulowane: odrębna zakładka, np. ciemniejszy szary kolor.

  3.1.5 Dodawanie nowego zlecenia (wiersza)

- Użytkownik może dodać nowy wiersz zlecenia poprzez przycisk Dodaj nowy wiersz w widoku planistycznym.
- Po kliknięciu przycisku na samym dole listy w zakładce aktualne pojawia się nowy, pusty wiersz, w którym użytkownik może stopniowo uzupełniać dane (także częściowo).
- Szczegółowy formularz edycji zlecenia jest dostępny po kliknięciu w dany wiersz na liście.
- Formularz zlecenia zawiera:
  - dane nagłówka:
    - numer zlecenia (generowany wg logiki biznesowej),
    - data wystawienia,
    - rodzaj transportu (krajowy, eksport drogowy, kontener morski i inne),
    - waluta,
  - dane stron:
    - zlecający (firma użytkownika, może być pobierana jako domyślna),
    - przewoźnik (firma transportowa),
    - firma nadawcy (od której odbieramy towar) wraz z lokalizacją (oddział),
    - firma odbiorcy (gdzie dostarczamy towar) wraz z lokalizacją (oddział),
    - osoba kontaktowa po stronie nadawcy z danymi (imię, telefon, e-mail),
  - informacje o ładunku (pozycje towarowe per zlecenie + parametry globalne):
    - pozycje towarowe (1…N): każda zawiera towar (z autocomplete), ilość (tony), oraz sposób załadunku (domyślnie z produktu, nadpisywalny przez użytkownika: luzem, bigbag, paleta, inne),
    - masa całkowita, objętość (opcjonalne parametry globalne),
    - typ auta (rodzaj auta — select z listy typów pojazdów z bazy, np. „Firanka", „Hakowiec", „Wywrotka", „Bus") + objętość w m³ (osobne pole liczbowe, dowolna wartość) — dwa niezależne pola, nie powiązane FK z tabelą wariantów pojazdów,
    - wymagania specjalne (np. ADR, chłodnia),
  - trasa:
    - **do wysłania zlecenia (email/PDF)** wymagane minimalnie 1 punkt załadunku i 1 punkt rozładunku,
    - **w trakcie planowania** (status robocze/korekta) zlecenie może mieć dowolną liczbę stopów (0, tylko załadunki, tylko rozładunki) — planista może nie znać jeszcze wszystkich punktów trasy (np. wie kto kupuje towar, ale nie wie z którego magazynu wyśle),
    - przyciski dodaj miejsce załadunku i dodaj miejsce rozładunku,
    - maksymalnie 8 punktów załadunku i 3 punkty rozładunku,
    - każdy punkt zawiera:
      - typ (załadunek/rozładunek),
      - datę (kalendarz + możliwość ręcznego wpisania),
      - godzinę (timepicker + możliwość ręcznego wpisania),
      - nazwę firmy / lokalizacji (z podpowiedzi bazy),
      - adres (ulica, kod, miasto, kraj),
      - uwagi do punktu (opcjonalnie),
    - możliwość zmiany kolejności punktów (np. przez przeciąganie),
  - warunki finansowe (globalne dla transportu):
    - cena za cały transport,
    - termin płatności,
    - forma płatności,
  - dokumenty dla kierowcy i uwagi:
    - lista wymaganych dokumentów dla kierowcy,
    - uwagi do zlecenia (tekst wielowierszowy),
  - klauzula poufności (`confidentialityClause`): edytowalny tekst zapisywany per zlecenie w bazie danych; nowe zlecenia inicjalizowane domyślnym tekstem. Edytowalna wyłącznie w widoku OrderView (podgląd A4), nie w drawerze.

  3.1.5a Szczegółowa specyfikacja widoku Drawer edycji zlecenia

Poniższa sekcja definiuje układ, zawartość i zachowanie panelu bocznego (drawer / sheet) edycji zlecenia transportowego. Drawer jest głównym miejscem edycji szczegółowych danych zlecenia. Alternatywny widok edycji: OrderView (podgląd A4 z edycją inline) — patrz sekcja 3.1.5b. Jest to autorytatywna specyfikacja — w razie rozbieżności z innymi dokumentami obowiązuje ta sekcja.

**1. Ogólne cechy drawera**

- Typ: panel boczny (sheet) wysuwany z prawej strony ekranu.
- Szerokość: ~720–800 px na dużych ekranach; na wąskich ekranach drawer zajmuje całą dostępną szerokość.
- Otwarcie: lewy klik na wiersz w tabeli zleceń.
- Zamknięcie: przycisk X w nagłówku, klawisz Escape, klik na backdrop lub przycisk „Zamknij" w stopce.
- Przy zamknięciu z niezapisanymi zmianami: modal z trzema opcjami — „Zapisz i zamknij", „Odrzuć i zamknij", „Zostań".
- Kliknięcie w backdrop przy niezapisanych zmianach — modal jak wyżej; przy braku zmian — zamknięcie.
- Powiązane API: `GET /api/v1/orders/{id}`, `POST /api/v1/orders/{id}/lock`, `POST /api/v1/orders/{id}/unlock`, `PUT /api/v1/orders/{id}`, `POST /api/v1/orders/{id}/status`, `POST /api/v1/orders/{id}/pdf`, `POST /api/v1/orders/{id}/prepare-email`.

**2. Przepływ otwarcia i blokada**

1. Użytkownik klika wiersz → system wywołuje `POST /orders/{id}/lock`.
2. Sukces (200): drawer otwiera się w **trybie edycji**; pobierane są dane `GET /orders/{id}`.
3. Konflikt (409): komunikat „Zlecenie edytowane przez [imię]"; drawer otwiera się w **trybie tylko do odczytu** — wszystkie pola disabled, brak przycisków Zapisz, Generuj PDF, Wyślij maila. Aktywne pozostają: podgląd danych, link „Historia zmian", przycisk Zamknij.
4. Przy zamknięciu draweru → `POST /orders/{id}/unlock`.
5. W MVP brak okresowego sprawdzania blokady. Przy próbie zapisu, gdy blokada wygasła lub przejął ją inny użytkownik (409), wyświetlany jest komunikat i drawer przechodzi w tryb tylko do odczytu lub zamyka się z odświeżeniem listy.

**3. Nagłówek drawera**

Nagłówek jest stałym (sticky) elementem na górze drawera. Nie zawiera tytułu „Edycja zlecenia". Elementy:

- **Numer zlecenia** (np. „Zlecenie #ZT2026/0042") — readonly, generowany przez serwer.
- **Link „Historia zmian"** — otwiera panel historii zmian obok drawera. Aktywny także w trybie readonly.
- **Przycisk X** — zamknięcie drawera (z obsługą niezapisanych zmian).
- Opcjonalna linia metadanych: „Utworzone przez [imię], [data] | Ostatnia zmiana: [imię], [data]".

**4. Treść drawera — 7 sekcji formularza**

Formularz jest przewijalną częścią drawera między nagłówkiem a stopką. Sekcje są zawsze rozwinięte (bez accordionu). Pola wymagane do wysłania zlecenia mailem oznaczone gwiazdką (*). Formularz w siatce 2–4 kolumn, etykiety nad polami. Firma zlecająca (nasza firma) nie występuje w formularzu — jest domyślna.

**Sekcja 0 — Nagłówek**

| Lp. | Pole | Typ pola | Uwagi |
|-----|------|----------|-------|
| 1 | Nr zlecenia | Tylko do odczytu (tekst) | Generowany przez serwer, niezmienny |
| 2 | Data utworzenia | Tylko do odczytu (data) | Z API (`createdAt`) |
| 3 | Przez kogo utworzone | Tylko do odczytu (tekst — imię i nazwisko) | Z logowania / API |
| 4 | Historia zmian | Link / przycisk | Otwiera panel historii zmian |

Ewentualna linia „Ostatnia zmiana: [imię], [data]" do doprecyzowania w implementacji.

**Sekcja 1 — Trasa**

| Lp. | Pole | Typ pola | Uwagi |
|-----|------|----------|-------|
| 1 | Rodzaj transportu* | Lista zamknięta (select) | Jedno pole na całe zlecenie (na górze sekcji); wartości: krajowy, eksport drogowy, kontener morski, import |
| **Na każdy punkt trasy (załadunek / rozładunek):** | | | |
| 2 | Firma | Autocomplete | Podpowiedź z bazy firm |
| 3 | Oddział firmy | Lista zamknięta (select) | Zależna od wybranej firmy; lista oddziałów z bazy dla tej firmy (nie autocomplete) |
| 4 | Adres | Tylko do odczytu (tekst) | Auto po wyborze oddziału; bez możliwości edycji |
| 5 | NIP | Tylko do odczytu (tekst) | Auto po wyborze firmy/oddziału |
| 6 | Data załadunku/rozładunku | Pole daty (datepicker + ręczne wpisanie) | Na punkt |
| 7 | Godzina załadunku/rozładunku | Pole godziny (timepicker + ręczne wpisanie) | Na punkt |
| — | Przyciski „Dodaj załadunek" / „Dodaj rozładunek" | Przyciski | Dodają kolejny punkt (max 8 załadunków, 3 rozładunki) |

Zmiana kolejności: drag-and-drop + przyciski góra/dół. Reguła kolejności przystanków: pierwszy przystanek musi być zawsze załadunkiem (L1), ostatni musi być zawsze rozładunkiem. Przystanki środkowe mogą być w dowolnej kolejności (załadunek lub rozładunek). Drag-and-drop respektuje tę regułę — nie można upuścić rozładunku na pierwszą pozycję ani załadunku na ostatnią. Dodawanie załadunku wstawia punkt po ostatnim istniejącym załadunku; dodawanie rozładunku wstawia punkt przed ostatnim istniejącym rozładunkiem. Przy zmianie firmy w punkcie: zerowanie oddziału, adresu i NIP; użytkownik wybiera oddział z nowej listy. Minimalna trasa: 1 załadunek + 1 rozładunek (walidacja biznesowa — przy wysyłce maila).

**Sekcja 2 — Towar**

| Lp. | Pole | Typ pola | Uwagi |
|-----|------|----------|-------|
| **Na każdą pozycję towarową:** | | | |
| 1 | Nazwa towaru* | Autocomplete | Z słownika towarów (`products`) |
| 2 | Ilość w t* | Pole liczbowe | Tony; ≥ 0 |
| 3 | Sposób załadunku | Lista zamknięta (select) | Wartości: luzem, bigbag, paleta, inne; domyślnie ustawiany z produktu po wyborze towaru, ale nadpisywalny przez użytkownika per pozycja |
| 4 | Komentarz | Pole tekstowe (input lub textarea) | Uwagi do pozycji |
| — | Przycisk dodania kolejnego asortymentu | Przycisk | Dodaje kolejny zestaw pól |

Przycisk „Usuń pozycję" przy każdej pozycji towarowej.

**Sekcja 3 — Firma transportowa**

| Lp. | Pole | Typ pola | Uwagi |
|-----|------|----------|-------|
| 1 | Nazwa firmy (przewoźnik)* | Autocomplete | Firmy typu przewoźnik z bazy (`companies`) |
| 2 | NIP | Tylko do odczytu (tekst) | Auto po wyborze firmy przewoźnika |
| 3 | Typ auta | Lista zamknięta (select) | Z unikalnych typów pojazdów z bazy (np. Firanka, Hakowiec, Wywrotka, Bus). Pole `vehicleTypeText` — niezależne od tabeli wariantów pojazdów |
| 4 | Objętość w m³ | Pole liczbowe (input) | Dowolna wartość liczbowa (np. 30, 90). Pole `vehicleCapacityVolumeM3` — niezależne od typu auta |
| 5 | Wymagane dokumenty | Lista zamknięta (select, **2 opcje**) | **1.** „WZ, KPO, kwit wagowy" **2.** „WZE, Aneks VII, CMR". Użytkownik wybiera **jedną** z dwóch opcji (select, nie checkboxy). **Automatyczny wybór** przy zmianie rodzaju transportu (Sekcja 1): jeśli eksport / eksport kontener / import → „WZE, Aneks VII, CMR"; jeśli kraj → „WZ, KPO, kwit wagowy". Użytkownik może ręcznie zmienić automatycznie wybraną wartość |
| 6 | Dane do awizacji | Pole tekstowe (textarea, max 500 znaków) | Informacje do awizacji przekazywane przewoźnikowi (planowany załadunek/rozładunek). Opcjonalne, nullable. Licznik znaków (x/500). **Nie kopiowane** przy duplikowaniu zlecenia. **Nie wyświetlane** na podglądzie A4 / PDF |

**Sekcja 4 — Finanse**

| Lp. | Pole | Typ pola | Uwagi |
|-----|------|----------|-------|
| 1 | Stawka* | Pole liczbowe (kwota) | ≥ 0; przy nowym zleceniu puste |
| 2 | Waluta* | Lista zamknięta (select) | PLN, EUR, USD. **Automatyczny wybór** przy zmianie rodzaju transportu (Sekcja 1): jeśli kraj → PLN; jeśli eksport / eksport kontener / import → EUR. Auto-aktualizacja przy każdej zmianie rodzaju transportu (także przy edycji), ale użytkownik może ręcznie wybrać inną walutę z listy |
| 3 | Termin płatności | Pole liczbowe (dni) | Domyślnie 21 |
| 4 | Forma płatności | Lista zamknięta (select) | Domyślnie „Przelew" |

**Sekcja 5 — Uwagi**

| Lp. | Pole | Typ pola | Uwagi |
|-----|------|----------|-------|
| 1 | Uwagi ogólne do zlecenia | Pole tekstowe wielowierszowe (textarea) | Jedno pole na całe zlecenie; max 500 znaków |

Sekcja 5 zawiera tylko jedno pole. „Wymagane dokumenty" znajdują się w Sekcji 3.

**Sekcja 6 — Sekcja zmian (status)**

| Lp. | Element | Typ pola | Uwagi |
|-----|---------|----------|-------|
| 1 | Aktualny status | Tylko do odczytu (badge / tekst) | Pełne nazwy statusów |
| 2 | Wybór nowego statusu | Lista zamknięta (select) | Tylko dozwolone przejścia ręczne (zgodnie z 3.1.7); wyświetlane pełne nazwy |
| 3 | Przycisk „Zmień status" | Przycisk (akcja) | Zmiana zapisywana przy ogólnym „Zapisz" |
| 4 | Powód reklamacji | Pole tekstowe wielowierszowe (textarea) | Widoczne **tylko** gdy aktualny status = Reklamacja lub gdy użytkownik wybierze przejście na Reklamację. Wymagane przy zmianie na Reklamację — bez wypełnienia zapis jest zablokowany. Dowolny tekst (textarea), max 500 znaków |

Sekcja 6 widoczna od razu (także przy nowym zleceniu). Zmiana statusu zapisywana dopiero przy kliknięciu ogólnego „Zapisz" w stopce — żadna zmiana (dane ani status) nie zapisuje się automatycznie.

**5. Stopka drawera (sticky na dole)**

Stopka jest stałym elementem na dole drawera z przyciskami akcji:

- **Zapisz** (primary) — zapisuje wszystkie zmiany (dane formularza + ewentualną zmianę statusu) → `PUT /orders/{id}`. Po zapisie odświeżenie danych zlecenia (GET lub z odpowiedzi), żeby status (np. Korekta) i Sekcja 6 były aktualne. Toast sukcesu.
- **Zamknij** — zamyka drawer; przy niezapisanych zmianach: modal „Zapisać?" z opcjami (Zapisz i zamknij / Odrzuć i zamknij / Zostań).
- **Podgląd** (ikona Eye) — otwiera widok OrderView (podgląd A4 z edycją inline) wewnątrz tego samego panelu Sheet. Zastępuje dawny przycisk „Generuj PDF". Widoczny tylko dla istniejących zleceń w trybie edycji (nie przy nowym zleceniu, nie w readonly). Szczegóły: patrz sekcja 3.1.5b.
- **Wyślij maila** — `POST /orders/{id}/prepare-email`. Przed wysyłką system sprawdza kompletność pól wymaganych. Przy brakach (422) — alert na górze formularza z listą brakujących pól; Outlook nie jest otwierany. Przy sukcesie — otwarcie Outlooka z załączonym PDF; status zmienia się automatycznie (robocze→wysłane, korekta→korekta wysłane). **Ponowna wysyłka:** opcja dostępna także dla zleceń w statusie wysłane/korekta wysłane (w zakładce Aktualne) — status nie zmienia się, aktualizowana jest data wysyłki (`sent_at`).
- **Historia zmian** (link) — otwiera panel historii zmian obok drawera. Alternatywnie dostępne z nagłówka drawera.

Stopka nie zawiera przycisku „Zmień status" — zmiana statusu jest w Sekcji 6 formularza i zapisywana razem z innymi zmianami przez „Zapisz".

**6. Zależności między sekcjami**

- **Sekcja 1 → Sekcja 3:** Rodzaj transportu (z Sekcji 1) określa automatyczny wybór wymaganych dokumentów w Sekcji 3: jeśli eksport / eksport kontener / import → „WZE, Aneks VII, CMR"; jeśli kraj → „WZ, KPO, kwit wagowy". Auto-aktualizacja przy każdej zmianie rodzaju transportu (także przy edycji), ale użytkownik może ręcznie zmienić wartość.
- **Sekcja 1 → Sekcja 4:** Rodzaj transportu (z Sekcji 1) określa domyślną walutę w Sekcji 4: kraj → PLN, eksport / eksport kontener / import → EUR. Auto-aktualizacja waluty przy każdej zmianie rodzaju transportu (także przy edycji istniejącego zlecenia), ale użytkownik może ręcznie wybrać inną walutę.
- **Sekcja 1 (punkty trasy):** Firma → lista oddziałów (select); oddział → adres i NIP (readonly). Przy zmianie firmy — zerowanie oddziału, adresu, NIP.
- **Sekcja 2:** Wybór towaru → domyślny sposób załadunku (nadpisywalny per pozycja).
- **Sekcja 6:** Pole „Powód reklamacji" widoczne tylko przy statusie Reklamacja lub wyborze przejścia na Reklamację.

**7. Tryb tylko do odczytu**

Drawer w trybie readonly (blokada przez innego użytkownika lub rola READ_ONLY):
- Wszystkie pola formularza disabled / grayed out.
- Brak przycisków: Zapisz, Wyślij maila, Podgląd. Sekcja 6 (Zmiana statusu) niewidoczna. (Sekcja 5 Uwagi pozostaje widoczna — tylko do odczytu.)
- Aktywne: link „Historia zmian" (tylko odczyt), przycisk „Zamknij".
- Nad formularzem wyświetlany jest bursztynowy (amber) banner informujący o tym, kto aktualnie blokuje zlecenie (np. „Zlecenie edytowane przez Anna Nowak").

**8. Walidacja w drawerze**

- **Walidacja techniczna (przy „Zapisz"):** inline pod polami po próbie zapisu; opcjonalnie przy blur dla pól wymaganych. Sprawdzenie formatów dat, liczb, limitów znaków, limitów punktów trasy.
- **Walidacja biznesowa (przy „Wyślij maila"):** realizowana przez API (422); frontend wyświetla alert na górze formularza z listą brakujących pól.
- Zlecenie można zapisać jako wersję roboczą z nieuzupełnionymi polami — pełna kompletność sprawdzana dopiero przy wysyłce maila.

---

  3.1.5b Widok OrderView — podgląd A4 z edycją inline

OrderView to alternatywny widok zlecenia transportowego, renderowany wewnątrz tego samego panelu Sheet co drawer. Wygląda jak drukowany dokument A4, ale pola są edytowalne inline. Otwiera się z drawera przyciskiem „Podgląd".

**1. Ogólne cechy**

- Wyświetlany wewnątrz tego samego panelu Sheet — drawer zamienia swoją zawartość na OrderView (bez drugiego nakładki/overlaya).
- Szerokość Sheet powiększa się do ~80% ekranu (`80vw`) gdy OrderView jest aktywny; po powrocie do drawera wraca do standardowej szerokości (~800px).
- Dostępny tylko dla istniejących zleceń w trybie edycji (nie dla nowych zleceń, nie w trybie readonly).
- Blokada zlecenia pozostaje aktywna przez cały czas (drawer + OrderView).
- Dark mode: dokument A4 zawsze biały, toolbar obsługuje dark mode.

**2. Toolbar (nad dokumentem A4)**

Sticky pasek narzędzi nad dokumentem:
- **Lewo**: tytuł „Podgląd zlecenia {orderNo}" + badge „Niezapisane zmiany" (bursztynowy, gdy isDirty).
- **Prawo**: „Generuj PDF" (outline) + „Anuluj" (secondary) + „Zapisz zmiany" (primary, disabled gdy brak zmian).
- Keyboard shortcuts: Ctrl+S (zapisz), Escape (anuluj).
- Ukryty przy druku (`print:hidden`).

**3. Dokument A4 — sekcje**

Dokument A4 zawiera ~14 sekcji wizualnych odzwierciedlających dane zlecenia:
- Nagłówek z logo firmy, numerem zlecenia, datą, danymi osoby zlecającej.
- Trasa: lista punktów załadunku i rozładunku z datami, godzinami, firmami, lokalizacjami i adresami. Drag-and-drop reordering (zasady jak w drawerze: pierwszy punkt = załadunek, ostatni = rozładunek, środkowe dowolna mieszanka).
- Pozycje towarowe: tabela z nazwą, sposobem załadunku, uwagami. Minimalna wizualna ilość wierszy = 8, maksymalna = 15.
- Firma transportowa: nazwa firmy (autocomplete), NIP (readonly), typ auta (select), objętość m³ (input), wymagane dokumenty (select).
- Finanse: stawka, waluta, termin płatności, forma płatności.
- Uwagi: pole tekstowe wielowierszowe (max 500 znaków).
- Klauzula poufności: edytowalne pole tekstowe (`confidentialityClause`), zapisywane per zlecenie w bazie danych. Nowe zlecenia inicjalizowane domyślnym tekstem klauzuli.
- Warunki realizacji zlecenia (tekst stały, nieedytowalny).

**4. Model danych i synchronizacja**

- Kopia formData z drawera → OrderView edytuje kopię → zapis = PUT API → powrót do drawera z odświeżonymi danymi.
- OrderView wysyła WSZYSTKIE pola (nawet ukryte: transportTypeCode, senderContact, itp.) — pełny PUT.
- Bez zmiany statusu — status zmienia się tylko w drawerze (Sekcja 6).

**5. Przepływy**

- **Otwarcie z dirty drawerem**: Dialog 3-opcyjny (Zapisz i przejdź / Odrzuć zmiany i przejdź / Anuluj).
- **Zapisz w OrderView**: PUT API → toast sukcesu → powrót do drawera.
- **Anuluj**: jeśli niezapisane zmiany → dialog potwierdzenia; jeśli czyste → powrót do drawera.
- **Generuj PDF**: przycisk w toolbarze → blob download (POST /orders/{id}/pdf).

**6. Druk**

- @media print: toolbar ukryty, sam dokument A4 na wydruku.
- Ukryte elementy: ikony edycji, drag handles, przyciski usuwania, dropdowny.
- Przeglądarka automatycznie dzieli na strony A4.

**7. Pole isEntryFixed**

Pole „Fix" (is_entry_fixed) NIE jest widoczne w OrderView — jest dostępne tylko w tabeli zleceń jako inline dropdown.

---

  3.1.6 Edycja zlecenia i blokada współbieżna

- Po kliknięciu w wiersz na liście użytkownik przechodzi do szczegółowego widoku edycji zlecenia.
- Przy wejściu w edycję zlecenia system:
  - oznacza wiersz jako zablokowany do edycji przez danego użytkownika,
  - uniemożliwia innym użytkownikom wykonywanie równoczesnych zapisów na tym samym wierszu (np. wyświetla komunikat, że zlecenie jest w edycji przez innego użytkownika).
- Blokada zostaje zwolniona po:
  - zapisaniu zmian,
  - lub wyjściu z edycji (anulowaniu zmian) po określonym czasie bezczynności lub zamknięciu widoku (szczegółowe reguły do ustalenia technicznie).

  3.1.7 Statusy zlecenia i cykl życia

- **Uwaga o nazewnictwie:** W systemie używane są wyłącznie pełne nazwy statusów (bez skrótów). Nazwy statusów to: **robocze**, **wysłane**, **korekta**, **korekta wysłane**, **zrealizowane**, **reklamacja**, **anulowane**. W UI i w dokumentacji wymagań stosuje się te pełne nazwy; ewentualne kody techniczne w API lub bazie (np. dla `status_code`) mapują się na te nazwy przy prezentacji użytkownikowi.

- Każde zlecenie posiada status, który opisuje etap cyklu życia:
  - **robocze** — nowe zlecenie lub w trakcie wypełniania; status ten występuje tylko od utworzenia zlecenia do momentu pierwszego wysłania lub anulowania; po wysłaniu lub anulowaniu zlecenie nigdy nie wraca do statusu robocze,
  - **wysłane** — zlecenie wysłano do przewoźnika mailem (po raz pierwszy); status ustawiany wyłącznie automatycznie po akcji „Wyślij maila” ze statusu robocze,
  - **korekta** — zlecenie było wysłane, ale ma zmiany nieprzesłane ponownie; pojawia się automatycznie w sytuacjach: (1) użytkownik zmodyfikował i zapisał zlecenie w statusie wysłane, (2) użytkownik przywrócił zlecenie z zakładki zrealizowane do głównego ekranu, (3) użytkownik przywrócił zlecenie z zakładki anulowane do głównego ekranu, (4) zlecenie w statusie korekta wysłane zostało zmodyfikowane i zapisane lub przywrócone z widoku zrealizowane/anulowane,
  - **korekta wysłane** — zlecenie skorygowane i ponownie wysłane przewoźnikowi; status ustawiany wyłącznie automatycznie po akcji „Wyślij maila” ze statusu korekta,
  - **zrealizowane** — transport się odbył, bez reklamacji; ustawiane wyłącznie ręcznie; zlecenia zrealizowane widoczne tylko w zakładce zrealizowane (nie na głównym ekranie),
  - **reklamacja** — transport z reklamacją; ustawiane wyłącznie ręcznie i tylko ze statusu wysłane, korekta lub korekta wysłane; zlecenia w statusie reklamacja należą do widoku aktualne (główny ekran),
  - **anulowane** — zlecenie anulowane; ustawiane wyłącznie ręcznie z statusu robocze, wysłane, korekta lub korekta wysłane; z widoku zrealizowane nie można bezpośrednio anulować — należy najpierw przywrócić zlecenie do aktualnych (wówczas otrzyma status korekta), a dopiero potem ustawić anulowane; zlecenia anulowane widoczne tylko w zakładce anulowane.

- Przejścia automatyczne:
  - robocze → wysłane: po poprawnym uruchomieniu akcji „Wyślij maila” (otwarcie Outlooka z PDF); użytkownik nie ustawia wysłane ręcznie,
  - wysłane / korekta wysłane → korekta: gdy użytkownik edytuje i zapisuje zlecenie (wykrycie zmiany pól biznesowych),
  - przywrócenie z zakładki zrealizowane lub anulowane → korekta (zlecenie wraca na główny ekran),
  - korekta → korekta wysłane: po poprawnym uruchomieniu akcji „Wyślij maila” (ponowna wysyłka z zaktualizowanym PDF).

- Przejścia ręczne (użytkownik wybiera nowy status):
  - robocze → zrealizowane, anulowane (reklamacja nie jest dostępna z robocze),
  - wysłane → zrealizowane, reklamacja, anulowane,
  - korekta → zrealizowane, reklamacja, anulowane,
  - korekta wysłane → zrealizowane, reklamacja, anulowane,
  - reklamacja → zrealizowane, anulowane.

- Zlecenia zrealizowane:
  - po ustawieniu statusu zrealizowane zlecenie znika z głównego widoku i jest wyświetlane wyłącznie w zakładce zrealizowane,
  - pozostają w systemie i w widoku zrealizowane bez limitu czasu (historia transportu i wysłanych zleceń),
  - można je przywrócić do aktualnych (status zmienia się na korekta); nie ma limitu czasowego na przywrócenie.

- Zlecenia anulowane:
  - po ustawieniu statusu anulowane zlecenie znika z głównego widoku i jest wyświetlane wyłącznie w zakładce anulowane,
  - przywrócenie do aktualnych (→ korekta) możliwe tylko w ciągu 24 godzin od anulowania,
  - jeśli użytkownik nie przywróci zlecenia w ciągu 24 godzin, zlecenie zostaje fizycznie usunięte z bazy (job w tle); takie zlecenia uznaje się za utworzone błędnie i nie są one wykorzystywane w raportach.

- Powód reklamacji: przy zmianie statusu na reklamacja wymagane jest pole „powód reklamacji". W UI wyświetlane jest okienko lub panel na dole widoku z danymi zlecenia; zapis zmiany statusu na reklamacja jest zablokowany, dopóki pole nie zostanie wypełnione.

  3.1.8 Historia zmian (audyt)

- Dla każdego zlecenia system przechowuje uproszczoną historię zmian kluczowych pól:
  - kto stworzył zlecenie i kiedy,
  - kto i kiedy zmienił status,
  - kto i kiedy zmienił kluczowe dane (daty, miejsca załadunku/rozładunku, ilości, przewoźnika, cenę).
- Użytkownik może kliknąć prawym przyciskiem myszy (lub równoważną akcją) na wierszu i wybrać opcję wyświetl historię zmian.
- Historia wyświetlana jest w prostym panelu (lista wpisów: data/godzina, użytkownik, opis zmiany).

  3.1.9 Integracja z danymi słownikowymi z ERP

- Dane słownikowe, takie jak:
  - firmy transportowe (przewoźnicy),
  - firmy nadawcze (dostawcy),
  - firmy odbiorcze (odbiorcy),
  - ich lokalizacje (oddziały, adresy),
  - lista towarów,
    nie są wprowadzane w tej aplikacji, lecz pochodzą z firmowego systemu ERP.
- Aplikacja posiada mechanizm:
  - ręcznej aktualizacji danych słownikowych przyciskiem aktualizuj dane,
  - pobierając aktualne dane z firmowej bazy (szczegóły techniczne integracji zostaną doprecyzowane z działem IT).
- W formularzu zlecenia:
  - firmy, lokalizacje, towary i spedycje wybierane są poprzez pola z podpowiedzią (autocomplete),
  - użytkownik wpisuje kilka pierwszych liter nazwy lub miasta, a system wyświetla dopasowania z bazy,
  - typ auta, sposób załadunku i pojemność auta wybierane są z krótkich list rozwijanych.
- **Snapshoty (immutable) danych słownikowych:**
  - Przy wyborze firmy, lokalizacji lub towaru w formularzu system zapisuje nazwę i adres z tego momentu jako „snapshot" (migawkę) — tzw. pola snapshot w bazie danych.
  - Snapshoty służą do zachowania dokładnych nazw, które były użyte w zleceniu, nawet jeśli później dane w słowniku ulegną zmianie (np. firma zmieni nazwę, oddział zmieni adres).
  - Snapshoty są **immutable** (niezmienne automatycznie) — system **nie aktualizuje** ich automatycznie, gdy zmienią się dane w słowniku.
  - Użytkownik może edytować snapshoty **ręcznie** bezpośrednio w formularzu (np. poprawić literówkę w nazwie firmy), ale system nigdy nie nadpisuje ich automatycznie.
- **Format dat:**
  - Baza danych i API przechowują i przekazują daty w formacie **ISO 8601** (YYYY-MM-DD) oraz godziny w formacie HH:MM:SS.
  - Frontend (UI) wyświetla daty w **polskim formacie wizualnym** (DD.MM.YYYY) poprzez funkcję formatowania.
  - Użytkownik wprowadza daty w formularzu w dowolnym akceptowanym formacie (datepicker pomaga w poprawnym wprowadzeniu).
- **Numer tygodnia:**
  - Numer tygodnia (ISO 8601) jest obliczany **automatycznie** przez system na podstawie daty pierwszego załadunku.
  - **Nie jest edytowalny** przez użytkownika — zmienia się tylko przy zmianie daty pierwszego załadunku.
  - W widoku listy zleceń wyświetlany jest jako osobna kolumna (Tydzień); w filtrze użytkownik może wpisać numer tygodnia, który jest następnie mapowany na zakres dat po stronie frontendu.

  3.1.10 Generowanie PDF zlecenia (MVP)

- Aplikacja generuje plik PDF na podstawie danych zlecenia:
  - PDF zawiera wszystkie kluczowe informacje potrzebne przewoźnikowi (strony, trasa, towar, daty, koszt, uwagi, dokumenty dla kierowcy),
  - układ może być w MVP uproszczony (czytelny układ tabelaryczny, niekoniecznie już w 100 procentach zgodny z docelowym sztywnym wzorem firmowym),
  - w dalszym etapie PDF zostanie dopracowany do pełnej zgodności z istniejącym wzorem (patrz granice produktu).
- Użytkownik może:
  - wygenerować PDF z poziomu zlecenia,
  - pobrać PDF lokalnie i ręcznie załączyć go do wiadomości w Outlooku.

  3.1.11 Wspomaganie wysyłki maila

- W widoku planistycznym, obok każdego wiersza zlecenia, dostępny jest przycisk typu wyślij maila / otwórz w Outlooku.
- Po kliknięciu tego przycisku:
  - aplikacja korzysta z aktualnego pliku PDF danego zlecenia (w razie potrzeby generując go na nowo),
  - system w pierwszej kolejności sprawdza kompletność pól wymaganych (zgodnie z sekcją o walidacji danych); w przypadku braków wyświetlany jest komunikat z listą brakujących pól, a Outlook nie jest otwierany,
  - jeśli wszystkie pola wymagane są uzupełnione, otwierany jest domyślny klient poczty (np. Outlook) z nową wiadomością, do której automatycznie dodany jest wyłącznie ten plik PDF jako załącznik,
  - użytkownik samodzielnie uzupełnia adresy e-mail, temat oraz treść wiadomości i wysyła ją z poziomu Outlooka,
  - po poprawnym uruchomieniu akcji wysyłki (otwarciu Outlooka z przygotowaną wiadomością i załączonym PDF):
    - jeśli zlecenie miało status robocze, status zlecenia w systemie zmienia się automatycznie na wysłane,
    - jeśli zlecenie miało status korekta, status zlecenia w systemie zmienia się automatycznie na korekta wysłane.
- Sam proces wysyłki maila oraz zapis wysłanych maili pozostaje w Outlooku (brak wysyłki bezpośrednio z aplikacji w MVP).

  3.1.12 Widok zrealizowanych i anulowanych zleceń

- Zlecenia w statusie zrealizowane są widoczne wyłącznie w zakładce zrealizowane; zlecenia w statusie anulowane wyłącznie w zakładce anulowane. Status reklamacja należy do widoku aktualne (główny ekran).

- Zakładka zrealizowane:
  - prezentuje listę wszystkich zleceń zrealizowanych (historia transportu i wysłanych zleceń),
  - zlecenia pozostają w systemie bez limitu czasu,
  - posiada takie same możliwości filtrowania jak widok aktualne,
  - umożliwia podgląd szczegółów zlecenia, ponowne wygenerowanie PDF oraz przywrócenie zlecenia do aktualnych (bez limitu czasowego).
- Zakładka anulowane:
  - prezentuje zlecenia anulowane przez maksymalnie 24 godziny,
  - umożliwia przywrócenie zlecenia do aktualnych (status → korekta) tylko w ciągu 24 h od anulowania,
  - po upływie 24 godzin zlecenia są fizycznie usuwane z bazy (job w tle).

  3.1.13 Walidacja danych

- Formularz zlecenia posiada jasno określone pola wymagane, m.in.:
  - rodzaj transportu,
  - główne strony (przewoźnik, nadawca, odbiorca),
  - minimalny zestaw informacji o ładunku (opis, ilość),
  - co najmniej 1 punkt załadunku i 1 punkt rozładunku z datą i godziną,
  - cena za transport (jeśli wymagana do wysłania zlecenia).
- Przy próbie wysłania zlecenia mailem (przycisk wyślij maila / otwórz w Outlooku), jeśli któreś z pól wymaganych nie jest wypełnione:
  - użytkownik otrzymuje komunikat z wyszczególnieniem niewypełnionych pól,
  - Outlook nie jest otwierany, plik PDF nie jest przygotowywany do wysyłki, a status zlecenia pozostaje robocze.

  3.1.14 Zapis danych

- MVP:
  - przycisk zapisz w formularzu, który:
    - wysyła wszystkie zmiany na serwer,
    - wykonuje walidację techniczną (np. poprawność formatów dat, zakresów liczbowych) i komunikuje ewentualne błędy krytyczne uniemożliwiające zapis,
    - nie wymusza uzupełnienia wszystkich pól wymaganych do wysłania zlecenia; ich kompletność jest sprawdzana dopiero przy próbie wysłania zlecenia mailem (patrz sekcja o walidacji danych),
    - pokazuje jasny komunikat o powodzeniu zapisu.
  - ostrzeżenie przy próbie opuszczenia strony z niezapisanymi zmianami.
- Autozapis (zapis w tle) jest przewidziany na późniejszy etap i opisany w granicach produktu.

  3.1.15 Środowiska

- Środowisko testowe:
  - wykorzystuje Supabase (PostgreSQL) i przykładowe dane słownikowe,
  - służy do testów i porównań z obecną pracą w Excelu,
  - może być czyszczone i modyfikowane w trakcie rozwoju.
- Środowisko produkcyjne:
  - po akceptacji MVP przez menedżera logistyki,
  - korzysta z danych z firmowej bazy ERP,
  - startuje z pustą listą zleceń (realnych).

  3.2 Widok magazynowy (tygodniowy)

Dedykowany widok read-only dla pracowników magazynów poszczególnych oddziałów Odylion. Prezentuje zaplanowane załadunki i rozładunki dla oddziału użytkownika w danym tygodniu.

**Pełna specyfikacja**: `.ai/widok-magazyn-specyfikacja.md`

3.2.1 Dostęp i routing

- URL: `/warehouse?week=12&year=2026` — parametry opcjonalne, domyślnie bieżący tydzień
- Dostępny dla ról: ADMIN, PLANNER, READ_ONLY — wszyscy jako read-only
- Oddział użytkownika domyślnie pobierany z `user_profiles.location_id` (server-side)
- **BranchSelector** (dropdown w nagłówku widoku) — pozwala przełączać się między oddziałami tej samej firmy; ukryty gdy firma ma tylko 1 oddział; walidacja server-side (oddział musi należeć do firmy INTERNAL)

3.2.2 Layout i nawigacja

- Nawigacja: strzałki ◀▶ + pole numeryczne nr tygodnia (bez selektora miesiąca)
- Nagłówek tygodnia: „Tydzień 12 | 17.03 – 21.03.2026" (sticky, nad scroll containerem)
- 5 kart dniowych (Pon–Pt), każda z jedną tabelą chronologiczną
- Stopy weekendowe dołączane do piątku z adnotacją „(sob. DD.MM)"
- Bez paginacji — scroll pionowy + sticky thead per karta
- Sekcja „Bez przypisanej daty" na dole (ukryta gdy pusta)
- Footer tygodniowy (sticky na dole): łączna masa, liczba załadunków/rozładunków

3.2.3 Kolumny tabeli

| # | Kolumna | Opis |
|---|---------|------|
| 1 | Typ | Badge: „Zał" (niebieski) / „Roz" (zielony) |
| 2 | Godzina | HH:MM, bold, kolor typu |
| 3 | Nr zlecenia | ZT2026/0042, font-medium |
| 4 | Towar / Masa | Nazwa + opakowanie + „Razem: XX,X t" |
| 5 | Przewoźnik | Nazwa firmy + typ pojazdu pod spodem |
| 6 | Awizacja | 5 linii bez etykiet: kierowca, ciągnik, przyczepa, telefon, BDO |

3.2.4 Filtrowanie danych

- Widoczne statusy: robocze, wysłane, korekta, korekta wysłane, reklamacja
- Niewidoczne: zrealizowane, anulowane
- Filtrowanie po oddziale: zlecenia z stopem w `location_id` użytkownika
- Oddział jako L i U w tym samym zleceniu → dwa osobne wiersze
- Zlecenie z wieloma stopami w różnych dniach → wiersz w każdym dniu

3.2.5 Dane awizacji

Dane awizacji przechowywane są w polu `notification_details` (textarea, max 500 znaków) w Sekcji 3 formularza zlecenia (Firma transportowa). W widoku magazynowym wyświetlane jako tekst wieloliniowy w kolumnie Awizacja.

3.2.6 Druk

- Obsługa `Ctrl+P` / `Cmd+P` — layout A4 landscape
- Ukryte: nawigacja, sidebar, footer
- Zachowane kolory badge'ów (`print-color-adjust: exact`)

3.2.7 API

- Dedykowany endpoint: `GET /api/v1/warehouse/orders?week=12&year=2026`
- Zwraca dane pogrupowane per dzień + sekcja „bez daty" + podsumowanie tygodnia

  3.3 Funkcje planowane na etap 2 (poza MVP)

- Dokładne odwzorowanie PDF zlecenia transportowego w 100 procentach zgodne z istniejącym sztywnym formularzem firmowym (układ, czcionki, współrzędne).
- Autozapis w tle:
  - zapis po 2–3 sekundach bezczynności od ostatniej zmiany,
  - okresowe zapisy co określony interwał (np. 60 sekund),
  - komunikaty o powodzeniu/porażce autozapisu.
- Zaawansowana wysyłka maili z poziomu aplikacji (integracja z Outlook/Exchange/SMTP).
- Zaawansowane raporty (koszty, ilości towarów, liczba transportów per przewoźnik i kierunek).
- Granularne role i ograniczenia dostępu do danych finansowych lub raportów (w MVP dostępne są trzy podstawowe role: ADMIN, PLANNER, READ_ONLY; rozbudowa ról planowana na etap 2).

## 4. Granice produktu

4.1 Zakres MVP

Do zakresu MVP należą:

- logowanie użytkownika (proste konta wewnętrzne),
- główny widok planistyczny aktualnych zleceń z filtrowaniem i sortowaniem,
- dodawanie, edycja i usuwanie zleceń,
- zarządzanie trasą (wiele punktów załadunku/rozładunku, limity 8/3, zmiana kolejności),
- statusy zleceń wraz z logiką przenoszenia między zakładkami,
- uproszczona historia zmian (kto/kiedy, kluczowe pola i status),
- integracja z danymi słownikowymi z ERP poprzez ręczną aktualizację danych,
- generowanie funkcjonalnego PDF (pełne dane, prosty układ),
- trzy zakładki: aktualne, zrealizowane, anulowane, wraz z logiką retencji anulacji (24 h),
- prosty mechanizm blokady edycji wiersza przez wielu użytkowników jednocześnie,
- dwa środowiska: testowe (Supabase) i produkcyjne (ERP),
- widok magazynowy — tygodniowy widok read-only załadunków/rozładunków per oddział (§3.2).

  4.2 Poza zakresem MVP (etap 2 i kolejne)

Poza zakresem pierwszej wersji znajdują się:

- pełne odwzorowanie układu PDF 1:1 z firmowym szablonem (sztywne współrzędne wszystkich pól),
- automatyczny harmonogram synchronizacji słowników (np. nocne integracje),
- rozbudowane raporty i dashboardy (w tym eksporty, wykresy, analizy),
- zaawansowane mechanizmy bezpieczeństwa (SSO, 2FA, granularne ograniczenia w ramach ról),
- wysyłanie maili bezpośrednio z aplikacji z dołączonym PDF,
- automatyczne czyszczenie/anonymizacja danych historycznych wg polityk prawnych (poza usuwaniem anulacji po 24 h),
- praca mobilna (optymalizacja pod telefony) – priorytet stanowi wygoda na laptopach.

## 5. Historyjki użytkowników

Poniżej zdefiniowano kluczowe historyjki użytkowników. Każda historia posiada unikalny identyfikator oraz kryteria akceptacji.

### 5.1 Uwierzytelnianie i dostęp

ID: US-001  
Tytuł: Logowanie do systemu  
Opis:  
Jako pracownik firmy chcę logować się do systemu za pomocą loginu i hasła, aby mieć dostęp do planowania i podglądu zleceń transportowych.  
Kryteria akceptacji:

- Użytkownik może wprowadzić login i hasło na ekranie logowania.
- Po poprawnym wprowadzeniu danych użytkownik jest przekierowany do głównego widoku planistycznego.
- Przy błędnych danych logowania wyświetlany jest czytelny komunikat o błędzie bez ujawniania, które pole jest niepoprawne.
- Po wylogowaniu użytkownik nie ma dostępu do żadnych widoków zleceń bez ponownego logowania.
- Dostępne funkcje w widoku zależą od roli użytkownika (ADMIN, PLANNER, READ_ONLY) — użytkownik READ_ONLY nie widzi przycisków tworzenia, edycji, zmiany statusu ani synchronizacji danych.

### 5.2 Widok planistyczny i filtrowanie

ID: US-010  
Tytuł: Podgląd listy aktualnych zleceń  
Opis:  
Jako planista chcę widzieć listę aktualnych zleceń w skróconej formie, aby szybko ocenić bieżący plan transportów.  
Kryteria akceptacji:

- Po zalogowaniu użytkownik widzi listę zleceń w zakładce aktualne.
- Każdy wiersz wyświetla co najmniej: numer zlecenia, rodzaj transportu, skróconą trasę (załadunki/rozładunki), przewoźnika, główny towar, koszt, status i uwagi.
- Widok jest czytelny na ekranie laptopa bez konieczności przewijania w poziomie (lub z minimalnym przewijaniem).
- Kliknięcie w wiersz przenosi do szczegółowego widoku zlecenia.

ID: US-011  
Tytuł: Filtrowanie po rodzaju transportu  
Opis:  
Jako planista odpowiedzialny za konkretny typ transportu (np. tylko krajowy) chcę móc filtrować listę zleceń po rodzaju transportu, aby widzieć wyłącznie zlecenia z mojego obszaru.  
Kryteria akceptacji:

- Użytkownik ma dostępny filtr rodzaju transportu w widoku aktualne.
- Wybranie wartości krajowy powoduje wyświetlenie tylko zleceń krajowych.
- Wybranie eksport drogowy powoduje wyświetlenie tylko zleceń eksportowych drogowych.
- Wybranie kontener morski powoduje wyświetlenie tylko zleceń kontenerowych.
- Odznaczenie filtra przywraca widok wszystkich zleceń.

ID: US-012  
Tytuł: Filtrowanie po przewoźniku, towarze i miejscach  
Opis:  
Jako planista chcę filtrować zlecenia po przewoźniku, towarze oraz miejscach załadunku i rozładunku, aby szybko znaleźć interesujące mnie zlecenia.  
Kryteria akceptacji:

- Użytkownik ma dostępne pola filtrów: przewoźnik, towar, miejsce załadunku, miejsce rozładunku, zakres dat.
- Wpisanie fragmentu nazwy przewoźnika filtruje listę zleceń do tych z dopasowanym przewoźnikiem.
- Wpisanie fragmentu nazwy towaru filtruje listę zleceń do tych, gdzie opis towaru zawiera dany tekst.
- Filtrowanie po miejscu załadunku/rozładunku uwzględnia co najmniej miasto i nazwę lokalizacji.
- Filtry można łączyć (np. przewoźnik + zakres dat).

ID: US-013  
Tytuł: Sortowanie listy zleceń  
Opis:  
Jako planista chcę sortować listę zleceń po wybranych kolumnach (np. data załadunku, data rozładunku, przewoźnik), aby móc lepiej planować kolejność transportów.  
Kryteria akceptacji:

- Użytkownik może zmienić kolejność sortowania według co najmniej daty załadunku, daty rozładunku i przewoźnika.
- Sortowanie jest stabilne i jasno oznaczone (np. strzałką w nagłówku kolumny).
- Po zmianie sortowania lista zleceń odświeża się natychmiast.

### 5.3 Dodawanie i edycja zlecenia

ID: US-020  
Tytuł: Dodanie nowego wiersza zlecenia  
Opis:  
Jako planista chcę jednym przyciskiem dodać na dole listy nowy, pusty wiersz zlecenia, aby móc stopniowo uzupełniać dane o planowanym transporcie.  
Kryteria akceptacji:

- Z widoku planistycznego dostępny jest przycisk Dodaj nowy wiersz.
- Kliknięcie przycisku dodaje na końcu listy w zakładce aktualne nowy, pusty wiersz, od razu gotowy do edycji.
- Użytkownik może zapisać wiersz z częściowo uzupełnionymi danymi; dopiero przy próbie wysłania zlecenia mailem system sprawdza kompletność pól wymaganych zgodnie z zasadami walidacji i w razie braków wyświetla komunikat zamiast otworzyć Outlooka.
- Po zapisaniu wiersz pozostaje widoczny na liście w zakładce aktualne.

ID: US-021  
Tytuł: Edycja zlecenia w widoku szczegółowym  
Opis:  
Jako planista chcę po kliknięciu w wiersz przejść do szczegółowego widoku zlecenia, aby komfortowo wprowadzać i edytować dane.  
Kryteria akceptacji:

- Kliknięcie w wiersz na liście otwiera formularz szczegółowy.
- Formularz prezentuje wszystkie pola zlecenia w logicznych sekcjach (nagłówek, strony, ładunek, trasa, finanse, uwagi).
- Użytkownik może modyfikować dane i zapisać zmiany.
- Po zapisaniu zmiany są widoczne zarówno w widoku szczegółowym, jak i skróconym wierszu.

ID: US-022  
Tytuł: Blokada edycji zlecenia przez wielu użytkowników  
Opis:  
Jako planista chcę mieć pewność, że kiedy edytuję zlecenie, inni użytkownicy nie nadpiszą moich zmian, aby uniknąć konfliktów danych.  
Kryteria akceptacji:

- Gdy użytkownik otwiera zlecenie do edycji, system oznacza je jako zablokowane.
- Próba edycji tego samego zlecenia przez innego użytkownika skutkuje komunikatem, że zlecenie jest obecnie edytowane.
- Po zapisaniu lub zamknięciu edycji blokada jest zwalniana.
- Mechanizm blokady jest widoczny w widoku planistycznym (np. ikona, status).

ID: US-023  
Tytuł: Zmiana statusu zlecenia  
Opis:  
Jako planista chcę ręcznie zmieniać status zlecenia (np. robocze, zrealizowane, reklamacja, anulowane), przy czym statusy wysłane oraz korekta wysłane mają być nadawane automatycznie po wysłaniu zlecenia mailem (pierwszym lub ponownym), aby stan w systemie odzwierciedlał rzeczywisty etap realizacji transportu.  
Kryteria akceptacji:

- Użytkownik może zmienić status zlecenia z poziomu formularza szczegółowego lub wybranego elementu w wierszu, z wyjątkiem statusów wysłane i korekta wysłane, które są ustawiane automatycznie po akcji wysyłki maila (zgodnie z wymaganiami funkcjonalnymi wysyłki).
- Zmiana statusu nie jest blokowana przez brak uzupełnienia wszystkich pól wymaganych; kompletność danych wymaganych do wysłania jest weryfikowana na etapie próby wysłania zlecenia mailem (patrz sekcja o walidacji danych i US-051).
- Po zmianie statusu kolor wiersza i jego położenie (zakładka) aktualizują się zgodnie z regułami cyklu życia.
- Historia zmian odnotowuje zmianę statusu (kto i kiedy).

ID: US-024  
Tytuł: Status korekta i korekta wysłane dla zlecenia wysłanego  
Opis:  
Jako planista chcę, aby zlecenie, które zostało już wysłane, a następnie zmodyfikowane, automatycznie otrzymywało status korekta, a po ponownym wysłaniu skorygowanego zlecenia automatycznie otrzymywało status korekta wysłane, aby było jasne (także w archiwum), że treść zlecenia została zmieniona po wysyłce i ponownie przesłana przewoźnikowi.  
Kryteria akceptacji:

- Zlecenie w statusie wysłane lub korekta wysłane, po wprowadzeniu i zapisaniu zmian, otrzymuje automatycznie status korekta.
- Zlecenie w statusie korekta, po poprawnym uruchomieniu akcji wysyłki maila (otwarcie Outlooka z przygotowaną wiadomością i zaktualizowanym załączonym PDF zlecenia), otrzymuje automatycznie status korekta wysłane.
- Zmiany statusów na korekta oraz korekta wysłane są zapisywane w historii zmian.
- W widoku planistycznym oraz w zakładce zrealizowane (archiwum) widoczne jest, czy zlecenie zakończyło się statusem wysłane, czy korekta wysłane.

ID: US-025  
Tytuł: Przeniesienie zlecenia do zrealizowanych  
Opis:  
Jako planista chcę oznaczyć zlecenie jako zrealizowane, aby przenieść je z bieżącej listy do archiwum.  
Kryteria akceptacji:

- Użytkownik może ustawić status zrealizowane dla zlecenia.
- Po zapisaniu zlecenie znika z zakładki aktualne i pojawia się w zakładce zrealizowane.
- Dane zlecenia nie są usuwane i mogą być później filtrowane i przeglądane.
- Historia zmian odnotowuje moment oznaczenia zlecenia jako zrealizowane.

ID: US-026  
Tytuł: Obsługa zleceń anulowanych z retencją 24 h  
Opis:  
Jako planista chcę móc anulować zlecenie, a jednocześnie mieć krótką możliwość cofnięcia tej decyzji, aby uniknąć trwałej utraty danych przy pomyłkach.  
Kryteria akceptacji:

- Użytkownik może ustawić status anulowane dla zlecenia.
- Zlecenie znika z zakładki aktualne i pojawia się w zakładce anulowane.
- Zlecenie pozostaje widoczne w zakładce anulowane przez maksymalnie 24 godziny.
- W tym czasie użytkownik może przywrócić zlecenie do aktualnych (np. ustawiając odpowiedni status).
- Po upływie 24 godzin zlecenie jest usuwane lub oznaczane jako nieaktywne zgodnie z przyjętą polityką.

ID: US-027  
Tytuł: Przywrócenie błędnie zakończonego zlecenia  
Opis:  
Jako planista chcę mieć możliwość przywrócenia zlecenia z zakładki zrealizowane do aktualnych, jeśli zostało oznaczone jako zrealizowane przez pomyłkę.  
Kryteria akceptacji:

- Użytkownik może w zakładce zrealizowane wybrać zlecenie i przywrócić je do aktualnych.
- Po przywróceniu zlecenie pojawia się w zakładce aktualne ze statusem korekta.
- Historia zmian odnotowuje fakt przywrócenia zlecenia.

ID: US-028  
Tytuł: Kopiowanie istniejącego zlecenia jako wzorca  
Opis:  
Jako planista chcę móc skopiować istniejące zlecenie jako wzorzec nowego zlecenia, aby przyspieszyć wprowadzanie podobnych transportów.  
Kryteria akceptacji:

- Użytkownik może w widoku zlecenia wybrać akcję skopiuj zlecenie.
- System tworzy nowe zlecenie z nowym numerem, kopiując dane z wybranego zlecenia (oprócz pól, które nie powinny być przenoszone według ustalonej logiki).
- Użytkownik może edytować dane w nowym zleceniu przed zapisaniem.
- Funkcja może zostać zaimplementowana w etapie 2, ale wymaganie jest znane i opisane.

### 5.4 Trasa i punkty załadunku/rozładunku

ID: US-030  
Tytuł: Dodanie minimalnej trasy (1 załadunek, 1 rozładunek)  
Opis:  
Jako planista chcę dodać co najmniej jeden punkt załadunku i jeden punkt rozładunku do zlecenia, aby transport miał zdefiniowaną podstawową trasę.  
Kryteria akceptacji:

- Formularz zlecenia domyślnie zawiera 1 pusty punkt załadunku i 1 pusty punkt rozładunku.
- Użytkownik może zapisać zlecenie jako wersję roboczą bez uzupełnienia tych punktów, ale przed wysłaniem zlecenia mailem musi wypełnić dane dla co najmniej jednego punktu załadunku i jednego punktu rozładunku (wraz z datą i godziną), zgodnie z zasadami walidacji danych.
- Brak tych punktów uniemożliwia wysłanie zlecenia mailem (system wyświetla komunikat i nie otwiera Outlooka).

ID: US-031  
Tytuł: Dodanie wielu miejsc załadunku i rozładunku  
Opis:  
Jako planista chcę dodawać dodatkowe miejsca załadunku i rozładunku, aby odwzorować złożone trasy logistyczne.  
Kryteria akceptacji:

- W formularzu dostępne są przyciski dodaj miejsce załadunku i dodaj miejsce rozładunku.
- System pozwala dodać maksymalnie 8 punktów załadunku i 3 punkty rozładunku.
- Próba dodania kolejnego punktu ponad limit skutkuje komunikatem o osiągnięciu maksymalnej liczby punktów.
- Wszystkie dodane punkty są prezentowane w logicznej kolejności.

ID: US-032
Tytuł: Zmiana kolejności punktów trasy
Opis:
Jako planista chcę zmieniać kolejność punktów załadunku i rozładunku, aby łatwo korygować plan trasy bez ponownego wpisywania danych.
Kryteria akceptacji:

- Użytkownik może przeciągnąć punkt załadunku/rozładunku na inne miejsce na liście.
- Po zmianie kolejności numery/sekwencja punktów aktualizują się automatycznie.
- Widok skrócony zlecenia odzwierciedla aktualną kolejność punktów.
- System egzekwuje regułę kolejności: pierwszy przystanek zawsze załadunek, ostatni zawsze rozładunek; drag-and-drop blokuje upuszczenie rozładunku na pierwszą pozycję oraz załadunku na ostatnią pozycję.

### 5.5 Integracja ze słownikami i podpowiedzi

ID: US-040  
Tytuł: Podpowiedź firm i lokalizacji z bazy ERP  
Opis:  
Jako planista chcę wybierać przewoźników, nadawców, odbiorców i ich lokalizacje z listy podpowiedzi opartej na danych z ERP, aby uniknąć literówek i niespójności nazw.  
Kryteria akceptacji:

- W polach przewoźnik, nadawca, odbiorca i lokalizacja dostępne są pola typu autocomplete.
- Po wpisaniu kilku liter system pokazuje dopasowane firmy/lokalizacje z bazy.
- Użytkownik może wybrać odpowiednią pozycję z listy.
- Wybór zapisywany jest w zleceniu w sposób powiązany z identyfikatorami z bazy (nie tylko jako wolny tekst).

ID: US-041  
Tytuł: Podpowiedź towarów i spedycji  
Opis:  
Jako planista chcę wybierać towary i spedycje z listy podpowiedzi, aby dane były spójne z firmową bazą.  
Kryteria akceptacji:

- W polach towar i spedycja dostępne są pola typu autocomplete.
- System pobiera listę towarów i spedycji z danych słownikowych.
- Użytkownik może szybko znaleźć pozycję wpisując kilka liter nazwy.
- Wybrana wartość jest zapisywana w zleceniu.

ID: US-042  
Tytuł: Ręczna aktualizacja danych słownikowych  
Opis:  
Jako planista chcę mieć możliwość ręcznej aktualizacji danych słownikowych z ERP, aby w razie potrzeby od razu skorzystać z nowych firm lub lokalizacji.  
Kryteria akceptacji:

- W aplikacji dostępny jest przycisk aktualizuj dane (np. w menu lub dedykowanej sekcji).
- Po uruchomieniu aktualizacji system pobiera aktualne dane słownikowe z ERP.
- Po zakończeniu aktualizacji użytkownik otrzymuje informację o powodzeniu lub błędzie.
- Do czasu zakończenia aktualizacji aplikacja pozostaje stabilna (bez utraty wprowadzonych danych).

### 5.6 Generowanie PDF i wysyłka

ID: US-050  
Tytuł: Generowanie PDF zlecenia  
Opis:  
Jako planista chcę wygenerować plik PDF zlecenia transportowego, aby móc go wysłać do przewoźnika jako formalne zlecenie.  
Kryteria akceptacji:

- Z poziomu zlecenia dostępny jest przycisk generuj PDF.
- System tworzy plik PDF zawierający wszystkie kluczowe dane zlecenia (strony, trasa, towar, daty, warunki finansowe, uwagi, dokumenty dla kierowcy).
- Użytkownik może pobrać plik PDF na komputer.
- Generowanie nie wymaga żadnej ręcznej edycji układu po stronie użytkownika.
- W etapie 1 układ może być uproszczony; docelowe odwzorowanie 1:1 zostanie zrealizowane w kolejnym etapie.

ID: US-051  
Tytuł: Otwarcie Outlooka z załączonym PDF zlecenia  
Opis:  
Jako planista chcę z poziomu listy zleceń jednym kliknięciem otworzyć w Outlooku nową wiadomość z automatycznie dołączonym PDF danego zlecenia, aby szybko wysłać je przewoźnikowi.  
Kryteria akceptacji:

- W widoku planistycznym, obok każdego wiersza zlecenia, dostępny jest przycisk wyślij maila / otwórz w Outlooku.
- Po kliknięciu przycisku system w pierwszej kolejności sprawdza, czy wszystkie pola wymagane do wysłania zlecenia (zgodnie z sekcją o walidacji danych) są uzupełnione; w przypadku braków wyświetla komunikat z listą brakujących pól i nie otwiera Outlooka.
- Jeżeli wszystkie pola wymagane są uzupełnione, przeglądarka otwiera domyślny klient poczty (np. Outlook) z nową, pustą wiadomością (bez wypełnionego tematu i treści), do której automatycznie dodany jest PDF danego zlecenia jako załącznik.
- Użytkownik ręcznie uzupełnia adresy e-mail, temat i treść wiadomości, po czym wysyła ją z poziomu Outlooka; w tym momencie z perspektywy systemu:
  - jeżeli zlecenie miało status robocze, status automatycznie zmienia się na wysłane,
  - jeżeli zlecenie miało status korekta, status automatycznie zmienia się na korekta wysłane.
- Aplikacja nie wysyła maili samodzielnie w MVP.

### 5.7 Historia zmian

ID: US-070  
Tytuł: Podgląd historii zmian zlecenia  
Opis:  
Jako planista lub menedżer chcę móc zobaczyć historię zmian zlecenia, aby wiedzieć, kto i kiedy zmieniał kluczowe informacje.  
Kryteria akceptacji:

- Po kliknięciu prawym przyciskiem myszy (lub z menu) na wierszu zlecenia dostępna jest opcja pokaż historię zmian.
- System wyświetla listę wpisów obejmujących co najmniej: datę/godzinę, użytkownika, rodzaj zmiany (status, daty, miejsca, ilości, przewoźnik, cena).
- Historia obejmuje zmiany od momentu utworzenia zlecenia.
- Dane historii są tylko do odczytu (brak możliwości edycji).

ID: US-071  
Tytuł: Rejestrowanie autora i daty utworzenia oraz modyfikacji  
Opis:  
Jako menedżer chcę mieć informację, kto utworzył zlecenie i kto je ostatnio modyfikował, aby móc szybko zidentyfikować odpowiedzialną osobę.  
Kryteria akceptacji:

- Dla każdego zlecenia przechowywane są pola utworzone przez, utworzone o, ostatnio zmienione przez, ostatnio zmienione o.
- Informacje te są widoczne w widoku szczegółowym zlecenia.
- Wprowadzenie zmian aktualizuje odpowiednie pola.

### 5.8 Zapis i bezpieczeństwo danych

ID: US-080  
Tytuł: Ręczny zapis zmian zlecenia  
Opis:  
Jako planista chcę mieć wyraźny przycisk zapisz podczas edycji zlecenia, aby świadomie utrwalać wprowadzone zmiany.  
Kryteria akceptacji:

- W formularzu edycji zlecenia dostępny jest przycisk zapisz.
- Kliknięcie przycisku zapisuje wszystkie zmiany w bazie, o ile przechodzą one walidację techniczną (np. poprawne formaty dat i liczb); możliwe jest zapisanie zlecenia jako wersji roboczej z nieuzupełnionymi wszystkimi polami wymaganymi do wysłania.
- W przypadku błędów walidacji technicznej użytkownik otrzymuje czytelny komunikat, które pola należy poprawić.
- Sprawdzenie kompletności pól wymaganych do wysłania zlecenia następuje dopiero przy próbie wysłania zlecenia mailem (zgodnie z sekcją o walidacji danych i US-051), a nie przy samym zapisie czy ręcznej zmianie statusu.
- Po udanym zapisie użytkownik widzi potwierdzenie (np. komunikat informacyjny).

ID: US-081  
Tytuł: Ostrzeżenie przed utratą niezapisanych zmian  
Opis:  
Jako planista chcę otrzymać ostrzeżenie przy próbie zamknięcia lub opuszczenia formularza z niezapisanymi zmianami, aby przypadkowo ich nie utracić.  
Kryteria akceptacji:

- Jeśli w formularzu są niezapisane zmiany, a użytkownik próbuje opuścić stronę lub zamknąć kartę, pojawia się ostrzeżenie.
- Użytkownik może anulować opuszczenie strony, aby wrócić i zapisać zmiany.
- Jeśli użytkownik zdecyduje się kontynuować opuszczenie strony, zmiany nie są zapisywane.

ID: US-082  
Tytuł: Autozapis zmian (etap 2)  
Opis:  
Jako planista chcę, aby zmiany były okresowo zapisywane automatycznie w tle, aby zminimalizować ryzyko utraty danych w razie problemów technicznych.  
Kryteria akceptacji:

- Po wprowadzeniu zmian w formularzu system wykonuje autozapis co ustalony interwał czasu lub po okresie bezczynności.
- Użytkownik widzi informację o czasie ostatniego autozapisu.
- W przypadku niepowodzenia autozapisu użytkownik jest o tym informowany.
- Funkcjonalność może być zaimplementowana w kolejnym etapie, poza MVP, ale jest uwzględniona w wymaganiach.

### 5.9 Widok magazynowy

ID: US-090
Tytuł: Podgląd tygodniowych załadunków i rozładunków dla oddziału
Opis:
Jako pracownik magazynu chcę widzieć tygodniowy widok zaplanowanych załadunków i rozładunków w moim oddziale, aby sprawnie przygotować się do obsługi transportów.
Kryteria akceptacji:

- Widok dostępny pod `/warehouse` dla ról ADMIN, PLANNER, READ_ONLY (read-only dla wszystkich).
- Wyświetla 5 kart dniowych (Pon–Pt) z jedną tabelą chronologiczną per dzień.
- Kolumny: Typ (badge Zał/Roz), Godzina, Nr zlecenia, Towar/Masa, Przewoźnik, Awizacja.
- Widoczne statusy: robocze, wysłane, korekta, korekta wysłane, reklamacja.
- Dane filtrowane po oddziale użytkownika (`user_profiles.location_id`).
- Stopy weekendowe wyświetlane w piątku z adnotacją (sob./niedz.).
- Footer tygodniowy z łączną masą załadunków/rozładunków.

ID: US-091
Tytuł: Nawigacja między tygodniami w widoku magazynowym
Opis:
Jako pracownik magazynu chcę przełączać się między tygodniami, aby przeglądać plan na kolejne lub poprzednie tygodnie.
Kryteria akceptacji:

- Strzałki ◀▶ przechodzą do poprzedniego/następnego tygodnia.
- Pole numeryczne pozwala wpisać nr tygodnia i przejść bezpośrednio.
- Nagłówek wyświetla „Tydzień X | DD.MM – DD.MM.YYYY".
- URL aktualizuje się z parametrami `?week=X&year=YYYY`.

ID: US-092
Tytuł: Dane awizacji w zleceniu transportowym
Opis:
Jako planista chcę wprowadzać dane awizacji w zleceniu, aby magazyn mógł je widzieć w widoku tygodniowym.
Kryteria akceptacji:

- Dane awizacji przechowywane w polu `notificationDetails` (textarea, max 500 znaków) w Sekcji 3 formularza.
- Pole edytowalne przez ADMIN i PLANNER; READ_ONLY widzi je jako read-only.
- Dane wyświetlane w kolumnie Awizacja widoku magazynowego jako tekst wieloliniowy.

ID: US-093
Tytuł: Drukowanie widoku magazynowego
Opis:
Jako pracownik magazynu chcę wydrukować widok tygodniowy, aby mieć papierową kopię planu na hali.
Kryteria akceptacji:

- `Ctrl+P` / `Cmd+P` otwiera podgląd druku w formacie A4 landscape.
- Nawigacja, sidebar i footer są ukryte na wydruku.
- Kolory badge'ów zachowane na wydruku.

## 6. Metryki sukcesu

6.1 Metryki operacyjne

- Skrócenie średniego czasu potrzebnego na przygotowanie i wysłanie zlecenia transportowego w porównaniu z obecnym procesem w Excelu (mierzone po okresie pilotażowym).
- Zmniejszenie liczby błędów wynikających z nadpisywania danych przy równoczesnej pracy wielu użytkowników (mniej konfliktów i pomyłek zgłaszanych przez zespół).
- Zwiększenie liczby zleceń planowanych dziennie na osobę przy zachowaniu jakości danych.
- Stabilność pracy systemu przy równoczesnym korzystaniu przez wielu użytkowników (np. do 10 osób jednocześnie bez zauważalnych spowolnień).

  6.2 Metryki jakości danych

- Udział zleceń z kompletem wymaganych danych (brak pól pustych tam, gdzie wymagane).
- Spójność nazw firm, lokalizacji i towarów z danymi z ERP (brak ręcznych duplikatów/niespójności).
- Liczba przypadków korekty zleceń wynikających wyłącznie z błędów wprowadzania (do monitorowania i sukcesywnie zmniejszania).

  6.3 Metryki adopcji i satysfakcji

- Odsetek planistów i menedżerów regularnie korzystających z aplikacji po okresie pilotażowym (np. > 80 procent użytkowników docelowych).
- Subiektywna ocena wygody planowania w nowej aplikacji vs Excel (np. ankieta po 1 i 3 miesiącach użycia).
- Liczba zgłoszeń dotyczących nieintuicyjnego interfejsu lub brakujących podstawowych funkcji (cel: redukcja z iteracji na iterację).

  6.4 Metryki rozwoju produktu

- Zrealizowanie w zakładanym czasie MVP (ok. 1 miesiąca i 50 godzin pracy) z pełnym pokryciem kluczowych funkcji planistycznych i prostego generowania PDF.
- Gotowość architektury i modelu danych do rozbudowy o etap 2 (pełny PDF 1:1, autozapis, raporty, integracje zaawansowane), bez konieczności gruntownej przebudowy.
