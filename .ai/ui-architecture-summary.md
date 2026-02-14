# Podsumowanie planowania architektury UI – MVP

## <conversation_summary>

### <decisions>

1. **Widoki listy a API** – Trzy zakładki (Aktualne, Zrealizowane, Anulowane) mapują się 1:1 na parametr `view` (CURRENT | COMPLETED | CANCELLED) w GET `/api/v1/orders`. **Statusy w UI to pełne nazwy** (Robocze, Wysłane, Korekta, Korekta wysłane, Zrealizowane, Reklamacja, Anulowane). **Mapowanie widoków:** Aktualne = Robocze, Wysłane, Korekta, Korekta wysłane, Reklamacja; Zrealizowane = tylko Zrealizowane; Anulowane = tylko Anulowane. Filtry i sortowanie współdzielone między zakładkami.

2. **Blokada edycji** – Przed wejściem w formularz szczegółowy wywołanie POST `/orders/{orderId}/lock`. Przy zapisie lub anulowaniu edycji – POST `/unlock`. Przy 409 (zlecenie zablokowane przez innego) komunikat z `lockedByUserName`, brak wejścia w edycję. Na liście ikona blokady + tooltip z imieniem.

3. **Wyślij maila** – Jedna akcja = POST `/orders/{orderId}/prepare-email`. Przy 200: użycie `emailOpenUrl`, aktualizacja statusu. Przy 422: wyświetlenie listy brakujących pól z body API, bez otwierania Outlooka.

4. **Słowniki** – Ładowanie po logowaniu (lub przy pierwszym wejściu w formularz), przechowywanie w stanie globalnym. Po „Aktualizuj dane” (POST `/dictionary-sync/run`) – polling GET `/dictionary-sync/jobs/{jobId}`, po zakończeniu odświeżenie słowników.

5. **Obsługa błędów API** – 401 → wylogowanie i przekierowanie na logowanie; 403 → komunikat bez szczegółów; 404 → komunikat + powrót do listy; 409 → kontekst (np. kto edytuje); 422 → lista błędów z body. Spójny komponent (toast/alert).

6. **Brak paginacji w UI** – Jedno żądanie GET z `pageSize` (np. 50/100/200, wybór przez użytkownika). Brak „stron”; przy przekroczeniu limitu komunikat „Zawęź filtry”. Wirtualizacja listy przy dużej liczbie wierszy.

7. **Widok szczegółowy** – Jedna trasa/drawer; przy wejściu GET zlecenia + lock. Tryb tylko do odczytu przy cudzej blokadzie. Zapisz = PUT; status nie edytowany przez PUT (automatyczne przejście wysłane / korekta wysłane → korekta po stronie serwera przy zapisie zmian).

8. **Generowanie PDF** – Osobny przepływ: POST `/orders/{id}/pdf` → pobieranie pliku; bez zmiany statusu. „Wyślij maila” = prepare-email (walidacja + ewentualna zmiana statusu).

9. **Responsywność** – Lekka: jeden breakpoint, przewijanie tabeli w poziomie na wąskich ekranach. Priorytet: laptopy; dark mode nie w MVP.

10. **Widok wiersza – trasa** – Ikony dla sposobu załadunku (BigBag, paleta, luzem itd.) z tooltipem. Dwa widoki listy wybierane ustawieniami nad tabelą: (1) jedna kolumna trasy w formacie L1/L2/U1 z firmą (miasto), datą, wizualnym rozróżnieniem załadunek/rozładunek, ewentualne łamanie na kolejną linię przy >3 punktach; (2) dwie kolumny: Miejsca załadunków | Miejsca rozładunków (z datami). Przełącznik widoku trasy w ustawieniach nad tabelą (nie prawy klik na nagłówek).

11. **Interakcja z wierszem** – Lewy klik = otwarcie panelu edycji. Prawy klik = menu kontekstowe: Wyślij maila, Historia zmian, Zmień status, Skopiuj zlecenie, inne. W wierszu widoczna tylko ikona „Wyślij maila”.

12. **Sortowanie** – Domyślnie FIRST_LOADING_DATETIME ASC (najbliższe wyjazdy na górze). Sortowanie także po dacie pierwszego rozładunku. Klik w nagłówek = zmiana sortBy/sortDirection.

13. **Dodawanie / kopiowanie** – Przycisk „Dodaj nowy wiersz” dodaje puste zlecenie (POST `/orders`) na końcu listy. „Skopiuj zlecenie” w menu kontekstowym (docelowo POST `/orders/{id}/duplicate` w etapie 2).

14. **Status w liście** – Osobna kolumna; wyświetlana pełna nazwa statusu (Robocze, Wysłane, Korekta, Korekta wysłane, Zrealizowane, Reklamacja, Anulowane); badge w ciemniejszym kolorze, wiersz w jaśniejszym odcieniu tego samego koloru.

15. **Filtry dat** – Osobne pary: Data załadunku od/do oraz Data rozładunku od/do (dla pytań „ile załadowań dziś/jutro”).

16. **Dwa „klasyczne” widoki listy** – Widok 1: Blokada | Nr | Rodzaj | Trasa | Data załad. | Data rozład. | Przewoźnik | Towar | Koszt | Status | Uwagi | Wyślij maila. Widok 2: Nr | Miejsca załadunków | Miejsca rozładunków | Daty załadunków | Daty rozładunków | Towar | Przewoźnik | Cena | Status | Akcje. Wybór w ustawieniach nad tabelą.

17. **Wiersze listy** – Zmienna wysokość; sticky nagłówek tabeli; tylko hover (bez dodatkowej animacji).

18. **Widok szczegółowy (drawer)** – Panel z prawej, ~720–800px; sekcje rozwinięte; blokada od razu po otwarciu; zmiana kolejności punktów: drag-and-drop + przyciski góra/dół; przy zamknięciu z niezapisanymi zmianami – modal „Odrzucić zmiany?” + beforeunload; Zapisz, Anuluj, Generuj PDF, Wyślij maila w stopce; Historia zmian i Zmiana statusu dostępne w panelu i z listy; autocomplete z debounce i uzupełnianiem pól; walidacja przy zapisie inline, przy 422 lista brakujących pól.

19. **Układ formularza szczegółowego** – Siatka 2–4 kolumn, etykiety nad polami; krótkie pola grupowane; textarea 3–4 wiersze + resize; dwa wiersze na punkt trasy (data/godzina/lokalizacja, potem adres); pola readonly wizualnie odróżnione; odstępy i opcjonalna linia między sekcjami; pola wymagane do wysłania oznaczone (*); stopka: Zapisz (primary), Anuluj, Generuj PDF, Wyślij maila.

20. **Panel historii zmian** – Wzorowany na test/code.html: panel z prawej ~450px, backdrop; nagłówek „Historia zmian”, podtytuł tylko numer zlecenia; jedna oś czasu z wpisami z /history/status i /history/changes scalonymi chronologicznie; użytkownik = imię i nazwisko (inicjały w kółku lub ikona); grupowanie po dacie (Dzisiaj, Wczoraj, data) + godzina przy wpisie; zmiana statusu = dwa badge’e ze strzałką; zmiana pola = Stara/Nowa lub lista pól; wpis „Zlecenie utworzone” z ikoną systemu; bez przycisku eksportu; bez dark mode.

21. **Ekran logowania** – Minimalistyczny: wyśrodkowana karta, tytuł, Login, Hasło, Zaloguj; jeden komunikat błędu bez wskazywania pola; stan ładowania na przycisku; integracja z Supabase Auth; brak „Zapomniałem hasła” i dark mode.

22. **Nagłówek aplikacji** – Tytuł, przycisk „Aktualizuj dane”, nazwa użytkownika (fullName lub email), Wyloguj; sticky; ta sama max-width co treść; podczas synchronizacji przycisk disabled + „Synchronizacja…” + po zakończeniu toast; nagłówek tylko po zalogowaniu.

</decisions>

### <matched_recommendations>

1. Mapowanie zakładek listy na parametr `view` API i współdzielenie filtrów/sortowania.

2. Jawne wywołania `/lock` i `/unlock` w przepływie edycji; obsługa 409 z informacją o blokującym użytkowniku.

3. Jedna akcja „Wyślij maila” = jeden wywołanie `prepare-email`; przy 422 wyświetlenie listy braków z API.

4. Słowniki w stanie globalnym, odświeżanie po synchronizacji; opcjonalnie debounce i autocomplete z API.

5. Spójna obsługa błędów HTTP (401, 403, 404, 409, 422) z jednym wzorcem UI.

6. Lista bez paginacji stron; jeden request z wybieralnym `pageSize`; wirtualizacja przy dużej liczbie wierszy.

7. Jeden widok szczegółowy (drawer) z lock przy wejściu; spójny kontrakt PUT/GET.

8. Rozdzielenie przepływu PDF (POST pdf → download) i „Wyślij maila” (prepare-email).

9. Lekka responsywność (jeden breakpoint, przewijanie w poziomie); bez dark mode w MVP.

10. Dwa warianty widoku trasy (sekwencja L1/U1 vs dwie kolumny) z przełącznikiem w ustawieniach; ikony sposobu załadunku z tooltipem.

11. Lewy klik = edycja; prawy klik = menu kontekstowe; w wierszu tylko ikona „Wyślij maila”.

12. Sortowanie domyślne FIRST_LOADING_DATETIME ASC; sortowanie także po dacie rozładunku; osobne filtry dat załadunku i rozładunku.

13. Status: pełne nazwy (Robocze, Wysłane, Korekta, Korekta wysłane, Zrealizowane, Reklamacja, Anulowane); osobna kolumna, ciemny badge, jasne tło wiersza.

14. Historia zmian: panel jak code.html, scalenie status + changes, grupowanie po dacie, bez eksportu, bez dark mode.

15. Logowanie: minimalistyczna karta, jeden komunikat błędu, stan ładowania.

16. Nagłówek: sticky, ta sama szerokość co treść, stan synchronizacji na przycisku + toast, widoczny tylko po zalogowaniu.

</matched_recommendations>

### <ui_architecture_planning_summary>

#### a) Główne wymagania dotyczące architektury UI

- Aplikacja wewnętrzna do planowania zleceń transportowych (Astro + React + TypeScript + Tailwind + Shadcn), docelowo Chrome na laptopach.
- Główny ekran: lista zleceń w trzech zakładkach (Aktualne, Zrealizowane, Anulowane) z dwoma wariantami widoku wiersza („Trasa” w jednej kolumnie L1/U1 lub w dwóch kolumnach Załadunki | Rozładunki). Brak paginacji stron – jeden zestaw wyników z wybieralnym rozmiarem (50/100/200), z wirtualizacją przy dużej liczbie wierszy.
- Edycja zlecenia w drawerze z prawej; blokada współbieżna przez lock/unlock; jedna oś czasu historii zmian w osobnym panelu (wzorowanym na code.html). Logowanie minimalistyczne; nagłówek tylko po zalogowaniu ze stałymi elementami (tytuł, Aktualizuj dane, użytkownik, Wyloguj).

#### b) Kluczowe widoki, ekrany i przepływy użytkownika

- **Ekran logowania** – Karta z polem Login, Hasło, przycisk Zaloguj; jeden komunikat błędu; po sukcesie przekierowanie na listę.
- **Widok główny (lista)** – Zakładki nad tabelą; filtry (rodzaj transportu, przewoźnik, towar, miejsca, daty załadunku od/do, daty rozładunku od/do); wybór „Pokaż zleceń” (50/100/200) i wybór widoku listy (Widok 1 / Widok 2); tabela ze sticky header, zmienna wysokość wierszy; statusy w pełnych nazwach; lewy klik → drawer szczegółów; prawy klik → menu (Wyślij maila, Historia zmian, Zmień status, Skopiuj zlecenie); ikona „Wyślij maila” w wierszu; przycisk „Dodaj nowy wiersz” (tylko w Aktualne). **Reklamacja** należy do widoku Aktualne; zlecenia **Zrealizowane** tylko w zakładce Zrealizowane; zlecenia **Anulowane** tylko w zakładce Anulowane. Przywrócenie z Anulowane do Aktualne możliwe tylko w ciągu 24 h (po 24 h zlecenie usuwane z bazy); przywrócenie z Zrealizowane bez limitu; po przywróceniu status = Korekta. Stany puste: „Brak zleceń” / „Brak wyników dla filtrów” z przyciskiem wyczyść/dodaj.
- **Widok szczegółowy (drawer)** – Otwarcie po lewym kliku w wiersz; lock przy wejściu; sekcje: Nagłówek, Strony, Ładunek, Trasa (punkty z drag-and-drop i przyciskami góra/dół), Finanse, Dokumenty i uwagi, Zmiana statusu. Stopka: Zapisz, Anuluj, Generuj PDF, Wyślij maila. Przy niezapisanych zmianach przy zamknięciu – modal „Odrzucić zmiany?”; Historia zmian z linku w nagłówku.
- **Panel historii zmian** – Otwierany z draweru lub z menu kontekstowego wiersza; panel z prawej ~450px, oś czasu z wpisami scalonymi z /history/status i /history/changes; grupowanie po dacie; typy wpisów: zmiana statusu (badge → badge), zmiana pola (Stara/Nowa lub lista), utworzenie zlecenia.
- **Przepływy** – Logowanie → lista → (klik wiersza → drawer → Zapisz / Anuluj / Generuj PDF / Wyślij maila); z listy: prawy klik → Wyślij maila (prepare-email) / Historia / Status / Skopiuj; „Aktualizuj dane” z nagłówka → synchronizacja → toast.

#### c) Strategia integracji z API i zarządzania stanem

- **Lista:** GET `/api/v1/orders` z parametrami `view`, `status`, `transportType`, `carrierId`, `productId`, `loadingLocationId`, `unloadingLocationId`, `search`, `dateFrom`/`dateTo` (osobne dla załadunku i rozładunku, jeśli API wspiera), `sortBy`, `sortDirection`, `page`, `pageSize`. Jedna odpowiedź na widok; brak przełączania stron.
- **Szczegóły:** GET `/api/v1/orders/{id}`, POST `/lock`, PUT `/api/v1/orders/{id}`, POST `/unlock`. Stan formularza lokalnie; przy zapisie pełny PUT; przy 409 nie wchodzić w edycję.
- **Historia:** GET `/orders/{id}/history/status` i GET `/orders/{id}/history/changes`; po stronie klienta scalenie i sortowanie chronologiczne.
- **Słowniki:** GET `/companies`, `/locations`, `/products`, `/transport-types`, `/order-statuses`, `/vehicle-variants` – ładowane raz (lub przy pierwszym użyciu), stan globalny; po POST `/dictionary-sync/run` polling `/dictionary-sync/jobs/{jobId}` i odświeżenie słowników.
- **Akcje:** POST `/orders/{id}/prepare-email` (Wyślij maila); POST `/orders/{id}/pdf` (Generuj PDF); POST `/orders/{id}/status` (zmiana statusu; dozwolone przejścia walidowane w API); POST `/orders/{id}/restore` (przywracanie → status Korekta; z Anulowane tylko gdy < 24 h). Sesja: Supabase Auth; GET `/auth/me` dla nazwy użytkownika w nagłówku.

#### d) Responsywność, dostępność i bezpieczeństwo

- **Responsywność:** Lekka; jeden breakpoint; tabela z przewijaniem w poziomie na wąskich ekranach; drawer na pełną szerokość przy wąskim viewport. Bez targetowania telefonów w MVP.
- **Dostępność:** Etykiety powiązane z polami; sensowne title strony; nawigacja klawiaturą (w tym przyciski góra/dół przy trasie). Kontrast i focus spójne z resztą aplikacji.
- **Bezpieczeństwo:** 401 → wylogowanie; 403 → brak ujawniania szczegółów; role (ADMIN, PLANNER, READ_ONLY) – ukrycie/disable akcji edycji i wysyłki dla READ_ONLY. Token w nagłówku Authorization; brak przechowywania wrażliwych danych w stanie klienta poza sesją.

#### e) Nierozwiązane kwestie / dalsze wyjaśnienia

- Doprecyzowanie w api-plan: osobne parametry filtrów `loadingDateFrom`/`loadingDateTo` i `unloadingDateFrom`/`unloadingDateTo` (jeśli jeszcze nie występują).
- Pole w odpowiedzi listy zleceń umożliwiające mapowanie ikony sposobu załadunku (np. `loadingMethodCode` lub potwierdzenie, że `vehicleVariantCode` jednoznacznie określa sposób załadunku).
- Dla zakładki Anulowane: pole `cancelledAt` (lub `expiresAt`) w odpowiedzi listy do wyświetlania „Wygasa za X h” (obliczenie 24h po stronie klienta).
- Dokładna struktura odpowiedzi GET `/history/status` i GET `/history/changes` (np. nazwy pól, format daty) w celu poprawnego scalenia i wyświetlenia w panelu historii.

</ui_architecture_planning_summary>

### <unresolved_issues>

1. **API – filtry dat** – Czy GET `/api/v1/orders` obsługuje osobne parametry dla zakresu dat załadunku i zakresu dat rozładunku (np. `loadingDateFrom`/`loadingDateTo`, `unloadingDateFrom`/`unloadingDateTo`)? W planie API widnieją `dateFrom`/`dateTo` – należy doprecyzować semantykę (oba zakresy vs jeden wspólny).

2. **API – ikona sposobu załadunku** – W odpowiedzi listy zleceń potrzebne jest pole pozwalające mapować ikonę (np. `loadingMethodCode` lub jednoznaczna interpretacja `vehicleVariantCode`). Jeśli brak – dopisać w api-plan.

3. **API – anulowane, countdown 24h** – Dla zakładki Anulowane wymagane jest wyświetlanie „Wygasa za X h”. Trzeba potwierdzić, czy w odpowiedzi listy dla `view=CANCELLED` jest zwracane `cancelledAt` (lub `expiresAt`), aby front mógł obliczyć pozostały czas.

4. **API – historia** – Struktura odpowiedzi GET `/orders/{id}/history/status` i GET `/orders/{id}/history/changes` (nazwy pól, format daty/czasu, opis zmiany) powinna być doprecyzowana pod kątem scalenia i wyświetlenia w jednej osi czasu (użytkownik, data/godzina, typ, stare/nowe wartości).

5. **Kopiowanie zlecenia** – W PRD/etap 2 jest POST `/orders/{id}/duplicate`. W UI pozycja „Skopiuj zlecenie” w menu kontekstowym jest ustalona; implementacja endpointu i zachowanie (np. co resetować) do doprecyzowania w fazie implementacji.

</unresolved_issues>

</conversation_summary>
