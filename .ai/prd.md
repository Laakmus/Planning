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

3.1.1 Dostęp i uwierzytelnianie

- Proste logowanie użytkownika (login/hasło) dla pracowników wewnętrznych firmy.
- Dostęp do aplikacji z poziomu przeglądarki Chrome na laptopach.
- Aplikacja przeznaczona do użycia głównie z sieci firmowej lub przez VPN (konfiguracja po stronie IT).

  3.1.2 Widok planistyczny aktualnych zleceń

- Główny ekran aplikacji prezentuje listę wierszy reprezentujących zlecenia transportowe w zakładce aktualne.
- Każdy wiersz (zlecenie) w widoku skróconym prezentuje m.in.:
  - numer zlecenia,
  - rodzaj transportu (krajowy, eksport drogowy, kontener morski),
  - sekwencję miejsc rozładunku (np. w skróconej formie),
  - sekwencję miejsc załadunku,
  - datę i godzinę pierwszego i ostatniego załadunku i rozładunku (w formie czytelnego skrótu),
  - przewoźnika (firma transportowa),
  - opis towaru (skrócony),
  - koszt transportu (cena globalna za transport),
  - status zlecenia (np. robocze, wysłane, korekta, korekta wysłane, zrealizowane, anulowane, reklamacja),
  - podstawowe uwagi do zlecenia.
- Wiersze mają wyraźne oznaczenia kolorystyczne zależne od  ui kontekstu widoku (np. neutralny kolor dla aktualnych roboczych, inne kolory dla zrealizowanych i anulowanych).

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
    - osoba kontaktowa z danymi (imię, nazwisko, telefon, e-mail),
  - informacje o ładunku (globalne dla zlecenia, nie per pozycja towaru):
    - opis towaru,
    - ilość (np. liczba ton, liczba palet),
    - masa, objętość (opcjonalne parametry),
    - typ pojazdu (wybór z listy, np. hakowiec, firanka, ruchoma podłoga, wywrotka, bus, hakowiec z HDS),
    - sposób załadunku (wybór z listy, np. paleta, paleta + BigBag, BigBag, luzem, kosze),
    - pojemność auta (wybór z listy),
    - wymagania specjalne (np. ADR, chłodnia),
  - trasa:
    - minimalnie 1 punkt załadunku i 1 punkt rozładunku,
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
    - uwagi do zlecenia (tekst wielowierszowy).

  3.1.6 Edycja zlecenia i blokada współbieżna

- Po kliknięciu w wiersz na liście użytkownik przechodzi do szczegółowego widoku edycji zlecenia.
- Przy wejściu w edycję zlecenia system:
  - oznacza wiersz jako zablokowany do edycji przez danego użytkownika,
  - uniemożliwia innym użytkownikom wykonywanie równoczesnych zapisów na tym samym wierszu (np. wyświetla komunikat, że zlecenie jest w edycji przez innego użytkownika).
- Blokada zostaje zwolniona po:
  - zapisaniu zmian,
  - lub wyjściu z edycji (anulowaniu zmian) po określonym czasie bezczynności lub zamknięciu widoku (szczegółowe reguły do ustalenia technicznie).

  3.1.7 Statusy zlecenia i cykl życia

- Każde zlecenie posiada status, który opisuje etap cyklu życia:
  - robocze (nowe / w trakcie wypełniania),
  - wysłane (zlecenie wysłano do przewoźnika),
  - korekta (zlecenie wysłane, ale wprowadzone zostały zmiany po wysyłce, które nie zostały jeszcze ponownie wysłane do przewoźnika),
  - korekta wysłane (zlecenie zostało skorygowane i ponownie wysłane przewoźnikowi),
  - zrealizowane (transport się odbył, bez reklamacji),
  - reklamacja (transport z reklamacją, wymagane dalsze działania),
  - anulowane (zlecenie anulowane, nie będzie realizowane).
- Przejścia:
  - robocze → wysłane: status automatycznie zmienia się na wysłane po poprawnym uruchomieniu akcji wysyłki maila (otwarcie Outlooka z przygotowaną wiadomością i załączonym PDF zlecenia); użytkownik nie ustawia tego statusu ręcznie,
  - wysłane / korekta wysłane → korekta: status automatycznie zmienia się na korekta, gdy użytkownik edytuje i zapisuje zlecenie wysłane lub korekta wysłane (pojawiają się nowe zmiany, które nie zostały jeszcze ponownie wysłane),
  - korekta → korekta wysłane: status automatycznie zmienia się na korekta wysłane po poprawnym uruchomieniu akcji ponownej wysyłki maila (otwarcie Outlooka z przygotowaną wiadomością i zaktualizowanym załączonym PDF zlecenia),
  - wysłane / korekta / korekta wysłane → zrealizowane: ustawiane ręcznie, gdy transport został zrealizowany bez reklamacji,
  - wysłane / korekta / korekta wysłane → reklamacja: ustawiane ręcznie, gdy występuje reklamacja co do transportu,
  - robocze / wysłane / korekta / korekta wysłane → anulowane: ustawiane ręcznie, gdy zlecenie nie będzie realizowane.
- Zlecenia zrealizowane:
  - po oznaczeniu jako zrealizowane są przenoszone z głównego widoku aktualne do zakładki zrealizowane (archiwum),
  - pozostają w systemie bez limitu czasu (z myślą o późniejszych raportach).
- Zlecenia anulowane:
  - po oznaczeniu jako anulowane są dostępne w zakładce anulowane przez maksymalnie 24 godziny,
  - po 24 godzinach mogą być trwale usuwane z bazy (szczegóły do potwierdzenia technicznie),
  - wyjątkowo zlecenie anulowane w ciągu 24 godzin może zostać przywrócone do aktualnych.
- Zlecenia zrealizowane mogą być przywracane do aktualnych w przypadku pomyłki (np. błędne oznaczenie jako zrealizowane).

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

- Zakładka zrealizowane:
  - prezentuje listę wszystkich zakończonych zleceń,
  - posiada takie same możliwości filtrowania jak widok aktualne,
  - umożliwia podgląd szczegółów zlecenia i ponowne wygenerowanie PDF.
- Zakładka anulowane:
  - prezentuje zlecenia anulowane (przez maksymalnie 24 godziny),
  - umożliwia w wyjątkowych sytuacjach przywrócenie zlecenia do aktualnych,
  - po upływie czasu retencji zlecenia mogą być usuwane z bazy (szczegóły techniczne do doprecyzowania).

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

  3.2 Funkcje planowane na etap 2 (poza MVP)

- Dokładne odwzorowanie PDF zlecenia transportowego w 100 procentach zgodne z istniejącym sztywnym formularzem firmowym (układ, czcionki, współrzędne).
- Autozapis w tle:
  - zapis po 2–3 sekundach bezczynności od ostatniej zmiany,
  - okresowe zapisy co określony interwał (np. 60 sekund),
  - komunikaty o powodzeniu/porażce autozapisu.
- Zaawansowana wysyłka maili z poziomu aplikacji (integracja z Outlook/Exchange/SMTP).
- Zaawansowane raporty (koszty, ilości towarów, liczba transportów per przewoźnik i kierunek).
- Ewentualne role i ograniczenia dostępu do danych finansowych lub raportów.

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
- dwa środowiska: testowe (Supabase) i produkcyjne (ERP).

  4.2 Poza zakresem MVP (etap 2 i kolejne)

Poza zakresem pierwszej wersji znajdują się:

- pełne odwzorowanie układu PDF 1:1 z firmowym szablonem (sztywne współrzędne wszystkich pól),
- automatyczny harmonogram synchronizacji słowników (np. nocne integracje),
- rozbudowane raporty i dashboardy (w tym eksporty, wykresy, analizy),
- zaawansowane mechanizmy bezpieczeństwa (SSO, 2FA, granularne role uprawnień),
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
- Po przywróceniu zlecenie pojawia się w zakładce aktualne z odpowiednim statusem (np. wysłane lub robocze).
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
