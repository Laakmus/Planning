# Audyt bezpieczeństwa — Raport i plan napraw

> Data audytu: 2026-02-25
> Zespół: 5 agentów (API, Database, Frontend, Auth/Middleware, Infra)
> Przeanalizowano: 23 endpointy, 9 migracji SQL, 64+ komponentów React, middleware, konfiguracja

---

## Podsumowanie

| Priorytet | Ilość | Status |
|-----------|-------|--------|
| CRITICAL | 4 | Do natychmiastowej naprawy |
| HIGH | 8 | Do naprawy przed produkcją |
| MEDIUM | 10+ | Może poczekać (hardening) |
| LOW | 15+ | Nice to have |

---

## MUSISZ NAPRAWIĆ (przed produkcją)

### Faza 1 — CRITICAL (natychmiast)

#### C-01: `SECURITY DEFINER` bez `SET search_path`
- **Gdzie:** `supabase/migrations/20260207000000_consolidated_schema.sql` (sekcja 7 — RPC functions; uwaga: migracje skonsolidowane 2026-02-25)
- **Funkcje:** `try_lock_order()`, `generate_next_order_no()`
- **Problem:** Bez `SET search_path = public` atakujący może stworzyć obiekt w `pg_temp` schema i przejąć wykonanie z uprawnieniami superusera.
- **Scenariusz ataku:** Użytkownik z uprawnieniami `CREATE` w dowolnym schemacie (np. `pg_temp`, który jest dostępny domyślnie) tworzy funkcję lub tabelę o nazwie `transport_orders` w tym schemacie. Gdy `try_lock_order()` się wykonuje, PostgreSQL szuka obiektów po `search_path` — jeśli `pg_temp` jest wcześniej niż `public`, znajdzie fałszywy obiekt. Ponieważ funkcja jest `SECURITY DEFINER` (działa jako `postgres` superuser), atakujący uzyskuje pełne uprawnienia.
- **Co się zmieni po naprawie:** Funkcje będą miały wymuszony `search_path = public` — PostgreSQL ZAWSZE będzie szukać obiektów tylko w schemacie `public`, ignorując `pg_temp` i inne schematy. Atak search_path hijacking staje się niemożliwy. Żadna zmiana w działaniu aplikacji — wszystkie obiekty już są w `public`.
- **Fix:** Dodaj `SET search_path = public` do obu funkcji SECURITY DEFINER.
- **Trudność:** Prosta migracja SQL, ~5 min.

#### C-02: RPC wywoływalne przez READ_ONLY
- **Gdzie:** Ta sama migracja, `GRANT EXECUTE TO authenticated`
- **Problem:** Każdy zalogowany (nawet READ_ONLY) może wywoływać `generate_next_order_no()` (luki w numeracji) i `try_lock_order()` (blokowanie zleceń innym).
- **Scenariusz ataku:** Użytkownik READ_ONLY (np. kierowca, księgowa — ktoś kto ma tylko podgląd) otwiera konsolę przeglądarki i wywołuje `supabase.rpc('generate_next_order_no')` wielokrotnie. Każde wywołanie inkrementuje sekwencję numerów zleceń. Po 100 wywołaniach: ZT2026/0047, ZT2026/0148 — brakuje 100 numerów w środku. Podobnie: `supabase.rpc('try_lock_order', { p_order_id: '...' })` — READ_ONLY blokuje zlecenie na 15 minut, planista nie może edytować.
- **Co się zmieni po naprawie:** Funkcje RPC na samym początku sprawdzą rolę użytkownika. READ_ONLY dostanie błąd `insufficient privileges` i nie będzie mógł ani generować numerów, ani blokować zleceń. Planiści i admini — bez zmian, wszystko działa jak dotychczas. API endpoints mają już ten guard (`requireWriteAccess`), ale RPC jest dostępne bezpośrednio przez Supabase client, omijając middleware.
- **Fix:** Dodaj sprawdzenie roli wewnątrz funkcji: `IF NOT current_user_is_admin_or_planner() THEN RAISE EXCEPTION`.
- **Trudność:** Prosta migracja SQL, ~10 min.

#### C-03: Prawdziwe klucze w `.env.example`
- **Gdzie:** `.env.example:3-4`
- **Problem:** Plik commitowany do repo zawiera pełne klucze `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` (nawet jeśli lokalne). Ktoś może je skopiować na produkcję.
- **Scenariusz ataku:** Nowy developer klonuje repo, kopiuje `.env.example` → `.env` i uruchamia aplikację. Jeśli te same klucze trafią na produkcję (bo "działało lokalnie"), `SERVICE_ROLE_KEY` daje pełny dostęp do bazy z pominięciem RLS — odczyt/zapis wszystkich danych, usuwanie użytkowników, zmiana ról. Nawet jeśli klucze są lokalne: ktoś kto ma dostęp do repo (np. publiczny GitHub) zna Twoje lokalne klucze i może się połączyć z Twoim lokalnym Supabase.
- **Co się zmieni po naprawie:** `.env.example` będzie zawierał czytelne placeholdery (`your-anon-key-here`). Nowy developer wie, że musi wygenerować własne klucze. Żadna zmiana w działaniu — Twój `.env` (który NIE jest commitowany) nadal ma prawdziwe klucze. Warto też zrotować klucze lokalne (`supabase stop && supabase start` generuje nowe).
- **Fix:** Zamień na placeholdery: `SUPABASE_ANON_KEY=your-anon-key-here`.
- **Trudność:** 1 min edycji.

#### C-04: Rate limiter omijany przez fałszywe JWT
- **Gdzie:** `src/middleware.ts:92-103`
- **Problem:** `extractSubFromJwt()` dekoduje JWT bez weryfikacji podpisu. Atakujący rotuje fałszywe `sub` → każdy request ma osobny bucket → rate limit bezużyteczny.
- **Scenariusz ataku:** Atakujący pisze prosty skrypt: generuje JWT z losowym `sub` (np. `{"sub":"aaaa-0001"}`, `{"sub":"aaaa-0002"}`, ...) — base64-encode, dowolna sygnatura. Każdy request trafia do osobnego rate-limit bucketa (`user:aaaa-0001`, `user:aaaa-0002`...). Limit 100 write/min staje się 100 × N write/min (gdzie N = ilość fałszywych sub). Efektywnie: brak limitu. Atakujący może bombardować API tysiącami requestów (które i tak dostaną 401 od Supabase Auth, ale obciążają serwer, bazę i mogą wyczerpać połączenia).
- **Dodatkowy atak:** Atakujący ustawia `sub` na UUID prawdziwego użytkownika → wyczerpuje MU rate limit → prawdziwy user dostaje 429 Too Many Requests. DoS na konkretnego usera.
- **Co się zmieni po naprawie:** Rate limiter będzie używał adresu IP jako klucza bucketa. Jeden IP = jeden bucket, niezależnie od JWT. Atakujący z jednego IP jest ograniczony do 100 write/min i 1000 read/min — tak jak powinno być. Legalni użytkownicy za tym samym NAT-em dzielą limit (akceptowalne dla wewnętrznej aplikacji). Nie wpływa to na autentykację — ta nadal działa przez `supabase.auth.getUser()`.
- **Fix:** Używaj IP jako primary key rate limitera (zamiast JWT sub). Prosta zmiana — fallback na IP always.
- **Trudność:** ~15 min, zmiana w middleware.
- **Uwaga:** L-17 z poprzedniego TODO — powinien być CRITICAL, nie LOW.

---

### Faza 2 — HIGH (przed produkcją)

#### H-01: Brak walidacji `p_lock_expiry_minutes`
- **Gdzie:** `try_lock_order()` w migracji SQL
- **Problem:** Użytkownik może podać 999999999 (lock na 1900 lat) lub 0 (natychmiastowe wygaśnięcie → kradzież locka).
- **Scenariusz:** Planista (lub atakujący z kontem PLANNER) wysyła RPC z `p_lock_expiry_minutes = 999999999`. Zlecenie jest zablokowane na ~1900 lat. Nikt inny nie może go edytować. Jedyny sposób odblokowania: ręczna interwencja w bazie. Odwrotnie: `= 0` oznacza lock wygasający natychmiast — inna osoba może go "ukraść" w tym samym momencie.
- **Co się zmieni po naprawie:** Parametr będzie ograniczony do 1–60 minut. Backend hardcoded wysyła 15 min, więc normalne użytkowanie się nie zmieni. Próba podania wartości spoza zakresu (przez konsolę lub bezpośredni RPC) zwróci błąd.
- **Fix:** `IF p_lock_expiry_minutes < 1 OR p_lock_expiry_minutes > 60 THEN RAISE EXCEPTION`.

#### H-02: READ_ONLY może blokować zlecenia
- **Gdzie:** `try_lock_order()` — rozwiązane razem z C-02 (ten sam fix: role check).
- **Co się zmieni:** READ_ONLY nie będzie mógł wywoływać `try_lock_order` bezpośrednio przez RPC. UI i tak nie pokazuje mu przycisków edycji, ale teraz baza danych też go odrzuci.

#### H-03: Tabele audytowe modyfikowalne
- **Gdzie:** `order_status_history`, `order_change_log` (migracja główna)
- **Problem:** Mają polityki UPDATE/DELETE — ADMIN/PLANNER mogą kasować/edytować logi audytu.
- **Scenariusz:** Admin przypadkowo (lub celowo) modyfikuje wpis w historii zmian statusu. Lub: skrypt czyszczący wywołuje DELETE na starej historii. Ścieżka audytu jest zniszczona — nie ma dowodu kto i kiedy zmienił status. W przypadku reklamacji, sporów z przewoźnikiem lub audytu — brak danych.
- **Co się zmieni po naprawie:** Nikt — nawet superadmin przez UI — nie może usunąć ani zmodyfikować wpisu w historii. Próba `UPDATE` lub `DELETE` na tych tabelach zwraca błąd "audit records are immutable". Jedynie `INSERT` jest dozwolony (dodawanie nowych wpisów). Jeśli kiedyś potrzebujesz usunąć stare dane (np. RODO), musisz jawnie wyłączyć trigger — to świadoma, udokumentowana akcja.
- **Fix:** Usunąć polityki UPDATE/DELETE + dodać trigger `BEFORE UPDATE OR DELETE → RAISE EXCEPTION 'audit records are immutable'`.

#### H-04: Brak security headers na stronach HTML
- **Gdzie:** `src/layouts/Layout.astro` lub middleware
- **Problem:** CSP, X-Frame-Options, HSTS, X-Content-Type-Options są TYLKO na API responses. Strony HTML (`/`, `/orders`) nie mają żadnych.
- **Scenariusz:** Atakujący osadza Twoją stronę `/orders` w `<iframe>` na fałszywej stronie (clickjacking) — użytkownik myśli że klika w swoją stronę, ale interakcja jest przechwytywana. Bez CSP: jeśli kiedykolwiek pojawi się XSS, przeglądarka pozwoli załadować dowolny zewnętrzny skrypt (crypto miner, keylogger). Bez HSTS: man-in-the-middle może przekierować HTTP → fałszywy serwer.
- **Co się zmieni po naprawie:** Przeglądarka będzie blokować: osadzanie w iframe (`X-Frame-Options: DENY`), ładowanie skryptów z obcych domen (CSP), sniffing typów MIME, połączenia HTTP (wymuszenie HTTPS przez HSTS). Aplikacja działa dokładnie tak samo — headery to instrukcje dla przeglądarki, nie zmieniają logiki. Jedyny potencjalny problem: inline script (anti-flash theme) wymaga `'unsafe-inline'` w CSP albo `nonce` — do przetestowania.
- **Fix:** Dodać middleware w Astro lub `<meta>` tagi w Layout.astro:
  - `Content-Security-Policy` (uwaga: `is:inline` script wymaga `'unsafe-inline'`)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000`
  - `Referrer-Policy: strict-origin-when-cross-origin`

#### H-05: Token JWT w localStorage
- **Gdzie:** `src/contexts/AuthContext.tsx` (Supabase SDK default)
- **Problem:** Supabase SDK zapisuje tokeny do `localStorage`. Przy XSS → kradzież tokena.
- **Scenariusz:** Jeśli kiedykolwiek pojawi się XSS (np. przez bibliotekę 3rd-party, błąd w przyszłym kodzie), atakujący uruchamia `localStorage.getItem('sb-...-auth-token')` i wysyła token na swój serwer. Z tym tokenem może wykonywać API calls jako zalogowany użytkownik — edytować zlecenia, zmieniać statusy — przez cały czas życia tokena (do 1h).
- **Co się zmieni po naprawie:**
  - **Opcja A** (`persistSession: false`): Token przechowywany TYLKO w pamięci JS (zmiennej). XSS nadal może go odczytać (bo jest w tej samej przestrzeni JS), ale nie przetrwa zamknięcia karty. **Konsekwencja**: po odświeżeniu strony (F5) użytkownik musi się zalogować ponownie — sesja nie przetrwa refreshu.
  - **Opcja B** (`@supabase/ssr` + cookies): Token w cookie `HttpOnly` — JavaScript w ogóle nie ma do niego dostępu (`document.cookie` go nie widzi). XSS nie może ukraść tokena. Sesja przetrwa refresh. **Konsekwencja**: większa przebudowa AuthContext, potrzeba SSR middleware do obsługi cookies.
- **Decyzja:** Opcja A = szybka ale user musi się logować po refresh. Opcja B = pełne rozwiązanie ale więcej pracy. Dla wewnętrznej aplikacji opcja A jest akceptowalna.

#### H-06: `/orders` bez server-side auth guard
- **Gdzie:** `src/middleware.ts:114-116`
- **Problem:** Middleware pomija non-API routes → `/orders` renderuje HTML każdemu. Auth jest client-side (redirect na `/`).
- **Scenariusz:** Niezalogowany użytkownik (lub bot/skaner) wchodzi na `/orders`. Serwer renderuje pełny HTML z bundlowanym JavaScript — widać strukturę komponentów, nazwy API endpointów, logikę biznesową w bundlu. Dane z API nie wyciekają (endpointy wymagają JWT), ale struktura aplikacji jest ujawniona. Client-side redirect na `/` działa po załadowaniu JS — jest opóźniony i widoczny w network tab.
- **Co się zmieni po naprawie:** Niezalogowany użytkownik dostanie natychmiastowy redirect (HTTP 302) na `/` jeszcze ZANIM serwer wyrenderuje HTML. Zero informacji o strukturze aplikacji. Zalogowani użytkownicy — bez zmian, strona ładuje się normalnie.
- **Fix:** Dodać w middleware: jeśli `pathname === "/orders"` i brak ważnej sesji → redirect na `/`.

#### H-07: `getSession()` zamiast `getUser()`
- **Gdzie:** `src/contexts/AuthContext.tsx:119,196`
- **Problem:** `getSession()` czyta z localStorage BEZ walidacji z serwerem. Stale/revoked token → chwilowy dostęp do UI.
- **Scenariusz:** Admin usuwa konto użytkownika lub zmienia mu hasło. Użytkownik ma otwartą kartę z aplikacją. `getSession()` czyta stary token z localStorage i mówi "zalogowany" — użytkownik widzi interfejs (ale każde API call dostanie 401 i go wyloguje). Jest chwilowe okno (~sekundy) gdy widzi dane których nie powinien.
- **Co się zmieni po naprawie:** `getUser()` robi roundtrip do serwera Supabase Auth. Jeśli token jest wygasły/unieważniony, natychmiast zwraca błąd → redirect na login. Żadnego chwilowego okna. **Koszt**: dodatkowy HTTP request przy każdym sprawdzeniu sesji (~50-100ms). Warto.
- **Fix:** Zamienić `getSession()` na `getUser()` w `checkSession()` i `refreshUser()`.

#### H-08: Publiczna rejestracja włączona
- **Gdzie:** `supabase/config.toml:163`
- **Problem:** `enable_signup = true` — każdy może utworzyć konto. To zamknięta aplikacja wewnętrzna.
- **Scenariusz:** Atakujący odkrywa URL Twojego Supabase (widoczny w kodzie frontendowym jako `PUBLIC_SUPABASE_URL`). Wywołuje `supabase.auth.signUp({ email: '...', password: '...' })` tysiące razy — tworzy masę kont. Konta nie mają profili w `user_profiles` więc API zwraca 401, ale zaśmiecają tabelę `auth.users`, generują emaile potwierdzające (jeśli włączone), i mogą być użyte do ataków brute-force na inne endpointy.
- **Co się zmieni po naprawie:** Endpoint rejestracji Supabase Auth zwraca błąd. Nowe konta może tworzyć TYLKO admin (przez Supabase Dashboard lub service_role API). Istniejący użytkownicy — bez zmian, logowanie działa normalnie. **Uwaga**: jeśli masz flow rejestracji w UI, musisz go usunąć lub zamienić na "poproś admina o konto".
- **Fix:** Ustawić `enable_signup = false`. Nowe konta tworzy admin.

---

## MOŻE POCZEKAĆ (hardening / nice-to-have)

### MEDIUM — warto zrobić przed produkcją, ale nie blokuje

#### M-01: In-memory rate limiter
- **Gdzie:** `middleware.ts`
- **Problem:** Rate limit buckety trzymane w `Map()` w pamięci procesu.
- **Co grozi:** Restart serwera (deploy, crash) zeruje wszystkie limity. W architekturze z load balancerem — każda instancja ma osobny counter, efektywny limit × N instancji.
- **Co się zmieni po naprawie:** Redis-backed limiter jest współdzielony między instancjami i przetrwa restart. **Dla MVP single-server: obecne rozwiązanie jest OK.** Redis potrzebny dopiero przy skalowaniu.

#### M-02: Idempotency cache bez scope na endpoint
- **Gdzie:** `middleware.ts:173`
- **Problem:** Cache keyed jako `${clientId}:${idempotencyKey}` — brak pathname.
- **Co grozi:** Ten sam `Idempotency-Key` wysłany na `POST /orders` i `POST /orders/{id}/status` zwróci cached response z pierwszego wywołania. Niezamierzone zachowanie — klient dostaje odpowiedź z innego endpointu.
- **Co się zmieni po naprawie:** Klucz będzie zawierał pathname → każdy endpoint ma osobny namespace. Normalne użytkowanie się nie zmieni (klienci i tak generują unikalne klucze per request).

#### M-03: Brak body size limit
- **Gdzie:** `api-helpers.ts:158`
- **Problem:** `request.text()` czyta cały body bez limitu rozmiaru.
- **Co grozi:** Atakujący wysyła POST z 100MB body → serwer próbuje sparsować → zużywa pamięć → potencjalny crash (OOM). Zod waliduje dane PO parsowaniu — więc ogromny JSON jest już w pamięci.
- **Co się zmieni po naprawie:** Przed parsowaniem sprawdzamy `Content-Length` i odrzucamy requesty > 1MB (lub dowolny sensowny limit). Normalne zlecenie to ~2-5KB — limit 1MB to 200× zapas.

#### M-04: `window.open(emailOpenUrl)` bez walidacji
- **Gdzie:** `OrdersPage.tsx:201`
- **Problem:** Frontend otwiera URL z odpowiedzi serwera bez sprawdzenia schematu.
- **Co grozi:** Jeśli backend kiedykolwiek zwróci inny URL niż `mailto:` (np. po modyfikacji, bug, skompromitowany serwer) — `javascript:alert(1)` lub `https://evil.com` zostanie otwarty.
- **Co się zmieni po naprawie:** Jeden `if (url.startsWith("mailto:"))` — przeglądarka otworzy TYLKO linki mailto. Inne schematy zostaną zignorowane. Backend i tak generuje `mailto:`, więc nic się nie zmieni w działaniu.

#### M-05: Migracje bez transakcji
- **Gdzie:** 6 z 9 migracji SQL
- **Problem:** Brak `BEGIN/COMMIT` opakowującego DDL.
- **Co grozi:** Jeśli migracja z wieloma `ALTER TABLE` zawiedzie w połowie, baza może zostać w niespójnym stanie (np. kolumna dodana, ale constraint nie).
- **Co się zmieni po naprawie:** Migracja albo wykona się w całości, albo zostanie rollback'owana. **Uwaga**: dotyczy przyszłych uruchomień/migracji. Istniejące migracje już się wykonały poprawnie.

#### M-06: `secure_password_change = false`
- **Gdzie:** `supabase/config.toml:204`
- **Problem:** Zmiana hasła nie wymaga podania starego hasła ani niedawnego logowania.
- **Co grozi:** Atakujący z wykradzionym tokenem sesji może zmienić hasło użytkownika → przejęcie konta (stare hasło przestaje działać, nowe zna atakujący).
- **Co się zmieni po naprawie:** Supabase wymaga podania aktualnego hasła przy zmianie. Atakujący z tokenem nie zna hasła → nie może go zmienić. Użytkownik musi znać aktualne hasło żeby ustawić nowe.

#### M-07: Hasło min 6 znaków
- **Gdzie:** `supabase/config.toml:169`
- **Problem:** `minimum_password_length = 6`. Standard (NIST SP 800-63B) to 8+.
- **Co grozi:** Hasła typu `abc123`, `qwerty` przechodzą walidację. Brute-force 6-znakowego hasła jest szybszy.
- **Co się zmieni po naprawie:** Nowe hasła muszą mieć 8+ znaków. Istniejące hasła 6-7 znakowe nadal działają (Supabase nie wymusza retroaktywnie).

#### M-08: User enumeration przez komunikaty logowania
- **Gdzie:** `AuthContext.tsx:149`
- **Problem:** Dwa różne komunikaty: "Nieprawidłowy login lub hasło" (auth fail) vs "Nie udało się pobrać profilu" (auth OK, brak profilu). Atakujący wie że konto istnieje.
- **Co grozi:** Atakujący testuje emaile → "Nie udało się pobrać profilu" = konto istnieje w Auth → celowany brute-force na to konto.
- **Co się zmieni po naprawie:** Jeden generyczny komunikat niezależnie od przyczyny. Atakujący nie wie czy email istnieje czy nie.

#### M-09: CASCADE na tabelach audytowych
- **Gdzie:** Migracja główna — `order_status_history`, `order_change_log`
- **Problem:** `ON DELETE CASCADE` — usunięcie zlecenia automatycznie kasuje całą jego historię.
- **Co grozi:** Jeśli dodasz kiedyś funkcję usuwania zleceń, cała ścieżka audytu znika. Przy audycie/sporze z przewoźnikiem — brak dowodów.
- **Co się zmieni po naprawie:** `ON DELETE RESTRICT` — próba usunięcia zlecenia z historią zwróci błąd. Musisz najpierw jawnie zarchiwizować/usunąć historię. **Alternatywa**: soft-delete (kolumna `deleted_at`) zamiast fizycznego usuwania zleceń.

#### M-10: `updateCarrierCellColor` bez sprawdzenia locka
- **Gdzie:** `order.service.ts:2072`
- **Problem:** Zmiana koloru tła komórki przewoźnika nie sprawdza czy zlecenie jest zablokowane przez innego użytkownika ani czy jest w statusie finalnym.
- **Co grozi:** Dwóch planistów jednocześnie zmienia kolor → ostatni wygrywa (no conflict detection). Ktoś zmienia kolor na zrealizowanym/anulowanym zleceniu.
- **Co się zmieni po naprawie:** Zmiana koloru respektuje lock (nie zmienisz jeśli ktoś edytuje) i status (nie zmienisz na anulowanym). **Uwaga**: kolor to meta-dane wizualne, nie dane biznesowe — można też świadomie zostawić bez locka (decyzja projektowa).

#### M-11: `site_url` port 3000 vs 4321
- **Gdzie:** `supabase/config.toml:148`
- **Problem:** `site_url = "http://127.0.0.1:3000"` ale aplikacja działa na porcie 4321.
- **Co grozi:** Linki w emailach auth (reset hasła, potwierdzenie) prowadzą na port 3000 → 404 / nic nie działa.
- **Co się zmieni po naprawie:** Emaile auth będą prowadzić na poprawny port (4321). Jeśli nie używasz emaili auth (logowanie bez email confirmation) — brak natychmiastowego efektu.

#### M-12: `enable_confirmations = false`
- **Gdzie:** `supabase/config.toml:203`
- **Problem:** Rejestracja nie wymaga potwierdzenia emaila.
- **Co grozi:** Ktoś rejestruje się na cudzy email → konto aktywne natychmiast. Jeśli signup jest wyłączony (H-08), ten punkt jest nieistotny.
- **Co się zmieni po naprawie:** Nowe konta wymagają kliknięcia linka w emailu. Aktywne dopiero po potwierdzeniu. **Zależność**: wymaga poprawnego `site_url` (M-11) żeby link w emailu działał.

### LOW — nice to have

| ID | Problem | Rezultat naprawy |
|----|---------|-----------------|
| L-01 | Lock na anulowanych/zrealizowanych | Nie można zablokować zlecenia w stanie końcowym. Zapobiega niespójności przy przywracaniu (`restore`). |
| L-02 | `console.error` loguje pełne Error objects | Logi produkcyjne nie zawierają stack traces, ścieżek plików ani nazw tabel DB. Mniej info dla atakującego z dostępem do logów. |
| L-03 | `Cache-Control: public` na słownikach | Proxy/CDN nie cachuje odpowiedzi wymagających autentykacji. Spójność z innymi endpointami (companies/locations już mają `private`). |
| L-04 | Brak `autocomplete="off"` na polach NIP/kwoty | Przeglądarka nie podpowiada firmowych NIP-ów i kwot z historii — ważne na współdzielonych komputerach (np. biuro spedycji). |
| L-05 | `pageSize` max 200 — duże response | Mniejsze max (np. 100) = szybsze odpowiedzi, mniejsze zużycie pamięci. Tabela i tak wyświetla max ~50 wierszy na ekranie. |
| L-06 | Astro `generator` meta tag ujawnia wersję | Atakujący nie wie jakiej wersji Astro używasz → trudniej szukać znanych CVE. Usunięcie jednego `<meta>` tagu. |
| L-07 | `.gitignore` nie obejmuje `.env.local`, `.env.staging` | Zapobiega przypadkowemu commitowi sekretów w wariantach `.env` rozpoznawanych przez Vite/Astro. |
| L-08 | `email.max_frequency = "1s"` | Na produkcji: 60s zapobiega email flooding. Lokalnie bez znaczenia. |
| L-09 | Martwy plik `src/db/supabase.client.ts` | Usunięcie eliminuje ryzyko że ktoś go użyje przez pomyłkę (Supabase client BEZ JWT użytkownika → zapytania jako anonimowy, potencjalnie omijając logikę auth). |
| L-10 | Brak 405 JSON response | Klient API dostaje spójny JSON error zamiast Astro HTML — łatwiejsze debugowanie i spójność z resztą API. |

---

## POZYTYWNE USTALENIA (co jest dobrze)

- Zero `dangerouslySetInnerHTML` / `innerHTML` / `eval()` — brak XSS vectorów
- Autentykacja API poprawna — `supabase.auth.getUser()` waliduje JWT server-side
- RBAC działa — `requireWriteAccess()` blokuje READ_ONLY na mutujących endpointach
- RLS włączony na WSZYSTKICH 11 tabelach z poprawnymi politykami
- SQL Injection: BRAK ryzyka — parameterized queries, brak string concatenation
- TOCTOU race conditions naprawione (atomic UPDATE, advisory lock)
- Zod walidacja kompletna na wszystkich endpointach
- LIKE wildcard sanitization poprawna (`%`, `_`, `\`)
- `SUPABASE_SERVICE_ROLE_KEY` NIGDY nie importowany w kodzie aplikacji
- Security headers na API responses (HSTS, X-Frame-Options, CSP, nosniff)
- Idempotency-Key support z cache
- UUID validation na parametrach ścieżki
- `window.open` z `noopener,noreferrer`
- AbortController z 30s timeout na fetch

---

## Sugerowana kolejność pracy

```
Dzień 1: C-01, C-02, C-03, C-04         (4 CRITICAL — ~30 min łącznie)
Dzień 2: H-03, H-04, H-06, H-08         (łatwe HIGH — ~1h łącznie)
Dzień 3: H-01, H-05, H-07               (trudniejsze HIGH — ~1-2h)
Potem:   MEDIUM wg uznania przed deploy
```

---

## Mapowanie na dokumentację projektu

> Przy wdrażaniu każdej poprawki — zaktualizuj odpowiednie pliki instrukcji.
> "NIE OPISANE" = brakuje w docs, DODAĆ przy wdrożeniu.
> "NIEZGODNE" = docs mówią jedno, implementacja robi drugie — BUG.

### Tabela zbiorcza

| ID | Opisane w docs? | Pliki do aktualizacji |
|----|----------------|----------------------|
| **C-01** | NIE | `db-plan.md` — nowa sekcja 4.6 |
| **C-02** | CZĘŚCIOWO (role opisane w PRD/api-plan, ale RPC pominięte) | `db-plan.md` §4.6 + `api-plan.md` §3 |
| **C-03** | NIE | `.env.example` fix + `rules/tech-stack.md` nowa sekcja |
| **C-04** | CZĘŚCIOWO (1 zdanie w api-plan, brak detali) | `api-plan.md` §5 + `view-implementation-plan.md` §6.6 |
| **H-01** | CZĘŚCIOWO (czas locka wspomniony, brak walidacji zakresu) | `db-plan.md` §4.6 + `api-plan.md` §2.8 |
| **H-02** | CZĘŚCIOWO (rozwiązane z C-02) | j.w. |
| **H-03** | CZĘŚCIOWO (PRD: "read-only" w UI, db-plan traktuje jak zwykłe tabele) | `db-plan.md` §4.3 + `prd.md` §3.1.8 |
| **H-04** | NIE | `api-plan.md` §5 + `view-implementation-plan.md` §6 nowa sekcja 6.7 |
| **H-05** | **NIEZGODNE** — `ui-plan.md:71` mówi "HTTP-only cookie", implementacja używa localStorage | `orders-view-implementation-plan.md` §4.1 — doprecyzować wybraną opcję |
| **H-06** | CZĘŚCIOWO (PRD US-001 wymaga ochrony, ale nie precyzuje "server-side") | `orders-view-implementation-plan.md` §2 + `view-implementation-plan.md` §6.1 |
| **H-07** | NIE + **SPRZECZNOŚĆ** w `to_do/optymalization.md` (zaleca getSession!) | `orders-view-implementation-plan.md` §6.1 + adnotacja w `optymalization.md` |
| **H-08** | NIE (ale PRD mówi "konta wewnętrzne" i "admin zarządza") | `config.toml` fix + `api-plan.md` §3 nowa sekcja |
| **M-01** | CZĘŚCIOWO (ogólna wzmianka) | `api-plan.md` §5 + `view-implementation-plan.md` §6.6 |
| **M-02** | NIE | `api-plan.md` §5 nowa podsekcja "Idempotency" |
| **M-03** | NIE | `api-plan.md` §5 |
| **M-04** | NIE (URL opisany, bez walidacji) | `orders-view-implementation-plan.md` §4.11 lub §4.19 |
| **M-05** | NIE | `.ai/rules/db-supabase-migrations.mdc` sekcja "Wytyczne SQL" |
| **M-06** | NIE | `api-plan.md` §3 |
| **M-07** | NIE | `api-plan.md` §3 |
| **M-08** | **TAK — PRD US-001 (linia ~624) jawnie wymaga jednego komunikatu. Implementacja łamie wymóg = BUG** | Kod do poprawki, docs OK |
| **M-09** | TAK — CASCADE jawnie w `db-plan.md` §1.4, §1.5 | `db-plan.md` — dodać komentarz o konsekwencjach |
| **M-10** | CZĘŚCIOWO (endpoint opisany, brak wzmianki o locku) | `api-plan.md` §2.10a — decyzja projektowa |
| **M-11** | NIE | `config.toml` fix + `.env.example` komentarz |
| **M-12** | NIE | `api-plan.md` §3 |

---

### Szczegóły — co dokładnie dopisać w dokumentacji

#### C-01 → `db-plan.md` nowa sekcja 4.6
```
### 4.6 Bezpieczeństwo funkcji SQL (SECURITY DEFINER)

Wszystkie funkcje PL/pgSQL oznaczone jako `SECURITY DEFINER` MUSZĄ zawierać
`SET search_path = public` w definicji. Zapobiega to atakom search_path hijacking
przez schematy tymczasowe (`pg_temp`).

Dotyczy: `try_lock_order()`, `generate_next_order_no()` i każdej przyszłej
funkcji SECURITY DEFINER.
```

#### C-02 → `db-plan.md` §4.6 + `api-plan.md` §3
**db-plan.md** — dopisać do sekcji 4.6:
```
### 4.7 Kontrola dostępu do funkcji RPC

Funkcje RPC (wywoływane przez `supabase.rpc()`) NIE przechodzą przez middleware API.
Dlatego MUSZĄ implementować własną kontrolę roli:

- `generate_next_order_no()` — wymaga ADMIN lub PLANNER
- `try_lock_order()` — wymaga ADMIN lub PLANNER
- READ_ONLY dostaje błąd `insufficient privileges`

NIE używać `GRANT EXECUTE TO authenticated` bez wewnętrznego role-checka.
```

**api-plan.md** §3 — dopisać punkt:
```
- Funkcje RPC (PostgreSQL): kontrola dostępu wbudowana w ciało funkcji
  (sprawdzenie roli z user_profiles), ponieważ RPC omija middleware API.
```

#### C-03 → `.env.example` + `rules/tech-stack.md`
**`.env.example`** — zamienić wartości na placeholdery:
```
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**`rules/tech-stack.md`** — nowa sekcja:
```
### Zmienne środowiskowe
- `.env.example` MUSI zawierać placeholdery (nigdy prawdziwe klucze)
- `.env` NIE jest commitowany do repo (jest w .gitignore)
- Po sklonowaniu repo developer generuje własne klucze: `supabase start`
```

#### C-04 → `api-plan.md` §5 + `view-implementation-plan.md` §6.6
**api-plan.md** §5 — zastąpić jednozdaniową wzmiankę:
```
### Rate limiting
- Klucz bucketa: **adres IP** klienta (NIE JWT sub — JWT może być sfałszowany
  przed weryfikacją).
- Limity per IP: 100 write/min, 1000 read/min.
- In-memory Map (MVP). Docelowo: Redis dla multi-instance.
```

**view-implementation-plan.md** §6.6 — rozszerzyć analogicznie.

#### H-01 → `db-plan.md` + `api-plan.md` §2.8
**db-plan.md** §4.6/4.7 — dopisać:
```
Parametr `p_lock_expiry_minutes` w `try_lock_order()` jest walidowany: zakres 1–60.
Wartości poza zakresem powodują RAISE EXCEPTION.
```

**api-plan.md** §2.8 — dopisać: "Czas wygasania blokady walidowany w RPC (1–60 min)."

#### H-03 → `db-plan.md` §4.3 + `prd.md` §3.1.8
**db-plan.md** §4.3 — zmienić opis RLS dla tabel audytowych:
```
Tabele `order_status_history` i `order_change_log` są **append-only**:
- SELECT: wszyscy uwierzytelnieni
- INSERT: ADMIN/PLANNER
- UPDATE/DELETE: **BRAK** polityk
- Trigger `BEFORE UPDATE OR DELETE`: RAISE EXCEPTION 'audit records are immutable'
```

**prd.md** §3.1.8 — dopisać: "Wpisy w historii zmian są niemodyfikowalne (append-only)."

#### H-04 → `api-plan.md` §5 + `view-implementation-plan.md` nowa §6.7
```
### 6.7 Security headers na stronach HTML
Middleware Astro dodaje do odpowiedzi non-API:
- Content-Security-Policy (script-src 'self' 'unsafe-inline'; ...)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000
- Referrer-Policy: strict-origin-when-cross-origin
```

#### H-05 → `orders-view-implementation-plan.md` §4.1
Zmienić `cookie/localStorage` (linia ~98) na wybraną opcję:
- **Opcja A**: "Token w pamięci JS (`persistSession: false`). Sesja nie przetrwa refresh."
- **Opcja B**: "`@supabase/ssr` + cookies HttpOnly. Sesja przetrwa refresh."

**Uwaga**: `ui-plan.md:71` mówi "HTTP-only cookie" — obecna implementacja jest **niezgodna**.

#### H-06 → `orders-view-implementation-plan.md` §2 + `view-implementation-plan.md` §6.1
```
Middleware Astro (`src/middleware.ts`) sprawdza sesję dla `/orders`:
jeśli brak ważnej sesji → redirect 302 na `/`.
Strona `/orders` NIGDY nie jest renderowana bez server-side auth check.
```

#### H-07 → `orders-view-implementation-plan.md` §6.1 + `to_do/optymalization.md`
**orders-view-implementation-plan.md** §6.1:
```
`checkSession()` i `refreshUser()` używają `supabase.auth.getUser()` (NIE `getSession()`).
`getSession()` czyta z localStorage bez walidacji — nie wykrywa unieważnionych tokenów.
```

**to_do/optymalization.md** — przy B-04 dodać: "UWAGA: `getSession()` na frontendzie ma implikacje bezpieczeństwa (audyt H-07). Dopuszczalne TYLKO na backendzie gdzie token jest weryfikowany przez Supabase SDK."

#### H-08 → `config.toml` + `api-plan.md` §3
**config.toml** linia 163: `enable_signup = false`
**api-plan.md** §3 — nowa podsekcja:
```
### Zarządzanie użytkownikami
Rejestracja publiczna wyłączona (`enable_signup = false`).
Nowe konta tworzy ADMIN przez Supabase Dashboard lub service_role API.
```

#### M-02 → `api-plan.md` §5 nowa podsekcja
```
### Idempotency cache
Middleware obsługuje nagłówek `Idempotency-Key` dla POST.
Klucz cache: `${clientId}:${pathname}:${idempotencyKey}` (scope na endpoint).
```

#### M-03 → `api-plan.md` §5
Dopisać: "Body size limit: middleware odrzuca requesty z body > 1MB (Content-Length check)."

#### M-04 → `orders-view-implementation-plan.md` §4.11/§4.19
Dopisać: "Przed `window.open(emailOpenUrl)` sprawdzić `url.startsWith('mailto:')` — odrzucić inne schematy."

#### M-05 → `.ai/rules/db-supabase-migrations.mdc`
Dopisać do "Wytyczne SQL":
```
Każda migracja z wieloma instrukcjami DDL MUSI być opakowana w BEGIN; ... COMMIT;
```

#### M-08 → Kod do poprawki (docs OK — PRD US-001 linia ~624 już wymaga jednego komunikatu)
`AuthContext.tsx:149` — zamienić "Nie udało się pobrać profilu" na "Nieprawidłowy login lub hasło."

#### M-09 → `db-plan.md` §1.4, §1.5
Dopisać komentarz: "UWAGA: CASCADE kasuje historię przy usunięciu zlecenia. Jeśli wymagana retencja audytu — zmienić na RESTRICT."

#### M-10 → `api-plan.md` §2.10a
Dopisać decyzję projektową: "Zmiana koloru NIE wymaga locka (operacja wizualna z menu kontekstowego)" LUB "Wymaga locka — sprawdzić przed PATCH."

#### M-06, M-07, M-11, M-12 → `api-plan.md` §3 + `config.toml`
Dopisać do sekcji autentykacji:
```
Konfiguracja Supabase Auth (produkcja):
- minimum_password_length = 8
- secure_password_change = true
- enable_confirmations = true (wymaga poprawnego site_url)
- site_url = port aplikacji (4321 dev, domena prod)
```

---

> Ten raport uzupełnia istniejący `to_do.md`. Znaleziska pokrywają się częściowo z istniejącymi LOW (L-01, L-17) — ich priorytet został podwyższony.
