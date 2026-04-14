### 1. Lista tabel z kolumnami, typami danych i ograniczeniami

#### 1.1 `transport_orders` – zlecenia transportowe (nagłówek)

Tabela główna, centralna dla całego systemu.

- **id**: `uuid`  
  - PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **order_no**: `text`  
  - biznesowy numer zlecenia (np. `ZT2026/0001`), `NOT NULL`, `UNIQUE`  
  - **nigdy niezmieniany** po utworzeniu (blokowane triggerem)
- **status_code**: `text`  
  - aktualny status zlecenia, `NOT NULL`  
  - FK → `order_statuses.code`
- **transport_type_code**: `text`  
  - typ transportu (kraj, eksport, eksport kontenerowy, import), `NOT NULL`  
  - FK → `transport_types.code`
- **currency_code**: `text`  
  - kod waluty (`PLN`, `EUR`, `USD`), `NOT NULL`  
  - `CHECK (currency_code IN ('PLN','EUR','USD'))`
- **price_amount**: `numeric(12,2)`
  - globalna cena transportu; może być `NULL` dla wierszy roboczych
- **payment_term_days**: `smallint`
  - termin płatności w dniach (np. 14, 30, 60); może być `NULL`
- **payment_method**: `varchar(100)`
  - forma płatności (np. „przelew", „gotówka"); może być `NULL`
- **total_load_tons**: `numeric(12,3)`
  - łączna ilość ładunku w tonach; może być `NULL` na etapie planowania
- **total_load_volume_m3**: `numeric(12,3)`
  - łączna objętość ładunku w m³; może być `NULL`
- **summary_route**: `varchar(500)`  
  - skrótowy opis trasy do widoku planistycznego (np. `PL: Kęty → DE: Hamburg`)
- **first_loading_date**: `date`  
  - data pierwszego punktu załadunku (denormalizacja z `order_stops`)
- **first_loading_time**: `time without time zone`  
  - godzina pierwszego załadunku
- **first_unloading_date**: `date`  
  - data pierwszego rozładunku
- **first_unloading_time**: `time without time zone`
  - godzina pierwszego rozładunku
- **last_loading_date**: `date`
  - data ostatniego załadunku (denormalizacja z `order_stops`)
- **last_loading_time**: `time without time zone`
  - godzina ostatniego załadunku
- **last_unloading_date**: `date`
  - data ostatniego rozładunku (denormalizacja z `order_stops`)
- **last_unloading_time**: `time without time zone`
  - godzina ostatniego rozładunku
- **transport_year**: `integer`
  - rok transportu (np. z `first_loading_date`) – pomoc do raportów
- **week_number**: `integer`
  - numer tygodnia ISO 8601 wyliczony automatycznie z `first_loading_date`; aktualizowany triggerem przy każdej zmianie `first_loading_date`; może być `NULL` gdy `first_loading_date` jest `NULL`
- **first_loading_country**: `text`
  - kraj pierwszego załadunku (snapshot)
- **first_unloading_country**: `text`  
  - kraj pierwszego rozładunku (snapshot)
- **carrier_company_id**: `uuid`
  - przewoźnik; FK → `companies.id`, może być `NULL` na etapie roboczym
- **carrier_name_snapshot**: `varchar(500)`
  - nazwa przewoźnika użyta w zleceniu (zabezpieczenie względem zmian w słowniku); **immutable** – ustawiana raz przy wyborze przewoźnika, nigdy nie aktualizowana automatycznie
- **carrier_location_name_snapshot**: `varchar(500)`
  - nazwa lokalizacji przewoźnika (jeśli używana); **immutable**
- **carrier_address_snapshot**: `varchar(500)`
  - adres przewoźnika (jeśli potrzebny na dokumencie); **immutable**
- **shipper_location_id**: `uuid`
  - główna lokalizacja nadawcy (opcjonalnie), FK → `locations.id`
- **shipper_name_snapshot**: `varchar(500)`
  - snapshot nazwy nadawcy; **immutable** – ustawiana raz, nigdy nie aktualizowana automatycznie
- **shipper_address_snapshot**: `varchar(500)`
  - snapshot adresu nadawcy; **immutable**
- **receiver_location_id**: `uuid`
  - główna lokalizacja odbiorcy (opcjonalnie), FK → `locations.id`
- **receiver_name_snapshot**: `varchar(500)`
  - snapshot nazwy odbiorcy; **immutable** – ustawiana raz, nigdy nie aktualizowana automatycznie
- **receiver_address_snapshot**: `varchar(500)`
  - snapshot adresu odbiorcy; **immutable**
- **vehicle_variant_code**: `text`
  - dawny wariant pojazdu (typ + pojemność); kolumna zachowana w bazie, ale **nieużywana przez aplikację** od sesji 21. Ograniczenie FK do `vehicle_variants.code` zostało usunięte migracją `20260301000000_decouple_vehicle_fields.sql`. Może być `NULL`
- **special_requirements**: `varchar(500)`
  - wymagania specjalne (np. ADR, chłodnia); może być `NULL`
- **required_documents_text**: `varchar(500)`
  - wymagane dokumenty dla kierowcy (np. `CMR, WZ, BDO`)
- **general_notes**: `varchar(500)`
  - ogólne uwagi do zlecenia
- **notification_details**: `text`
  - dane do awizacji — informacje przekazywane przewoźnikowi o planowanym załadunku/rozładunku; opcjonalne, nullable; max 500 znaków (walidacja w aplikacji); nie kopiowane przy duplikowaniu zlecenia
- **complaint_reason**: `varchar(500)`  
  - powód reklamacji (gdy status = reklamacja), opcjonalne
- **sender_contact_name**: `varchar(200)`
  - imię i nazwisko osoby wysyłającej zlecenie; **immutable snapshot** – ustawiane przy wysyłce zlecenia
- **sender_contact_phone**: `varchar(100)`
  - numer telefonu osoby wysyłającej; **immutable snapshot** – ustawiane przy wysyłce zlecenia
- **sender_contact_email**: `varchar(320)`
  - email osoby wysyłającej; **immutable snapshot** – ustawiane przy wysyłce zlecenia
- **main_product_name**: `varchar(500)`
  - nazwa głównego towaru (denormalizacja z `order_items` — pierwszy aktywny item); aktualizowana triggerem lub logiką serwisową przy zapisie pozycji
- **sent_by_user_id**: `uuid`
  - użytkownik, który wysłał zlecenie (ustawiane automatycznie przy `prepare-email`), może być `NULL`
- **sent_at**: `timestamptz`
  - data i godzina wysłania zlecenia (ustawiane automatycznie przy `prepare-email`), może być `NULL`
  - przy ponownym wysłaniu (korekta wysłane) wartość jest **nadpisywana** na aktualną datę i użytkownika
- **search_text**: `text`
  - zdenormalizowany tekst do globalnego wyszukiwania (numer, firmy, lokalizacje, uwagi itd.)
- ~~**search_vector**~~: *USUNIĘTA* (migracja `20260306000001_drop_search_vector.sql`)
  - kolumna `tsvector` i indeks GIN były martwe (nigdy nie populowane); `search_text` z ILIKE wystarczy dla MVP
- **created_at**: `timestamptz`  
  - `DEFAULT now()`, `NOT NULL`
- **created_by_user_id**: `uuid`  
  - identyfikator użytkownika (z Supabase Auth), `NOT NULL`
- **updated_at**: `timestamptz`  
  - `DEFAULT now()`, `NOT NULL`
- **updated_by_user_id**: `uuid`  
  - ostatni modyfikujący użytkownik, może być `NULL` przy tworzeniu
- **locked_by_user_id**: `uuid`  
  - kto aktualnie edytuje zlecenie (blokada współbieżna), może być `NULL`
- **locked_at**: `timestamptz`
  - kiedy blokada została ustawiona, może być `NULL`
- **carrier_cell_color**: `varchar(7)`
  - kolor tła komórki „Firma transportowa" w widoku listy; jeden z 4 predefiniowanych hex-ów lub `NULL` (brak koloru)
  - `CHECK (carrier_cell_color IS NULL OR carrier_cell_color IN ('#34d399','#047857','#fde047','#f97316'))`
  - ustawiany z menu kontekstowego (prawy klik); ukryty gdy status = wysłane/korekta wysłane (wiersz ma zielone tło)
  - NIE kopiowany przy duplikacji zlecenia
  - edytowalny przez ADMIN i PLANNER; READ_ONLY widzi kolor, ale nie może zmieniać
- **order_seq_no**: `integer`
  - sekwencyjny numer porządkowy zlecenia (do sortowania numerycznego w widoku listy), nullable
  - wypełniany automatycznie przez trigger `trg_set_order_seq_no` przy INSERT/UPDATE — wyciąga część numeryczną z `order_no` (np. `ZT2026/0010` → `10`)
  - używany w ORDER BY zamiast sortowania tekstowego po `order_no`
- **vehicle_type_text**: `varchar(100)`
  - typ pojazdu jako tekst (np. "FIRANKA", "HAKOWIEC"); niezależne od `vehicle_variants`, opcjonalne
  - zastępuje FK do `vehicle_variants.code` (pole `vehicle_variant_code` zachowane w bazie, ale nieużywane przez aplikację)
- **vehicle_capacity_volume_m3**: `numeric(12,1)`
  - objętość ładunkowa pojazdu w m³ jako wolne pole numeryczne; opcjonalne
  - niezależne od `vehicle_type_text` (dwa osobne pola w UI)
- **is_entry_fixed**: `boolean`
  - flaga „zafiksowany wjazd" — czysto informacyjna dla planistów; `DEFAULT NULL`
  - dodana migracją `20260228000001_add_is_entry_fixed.sql`
- **confidentiality_clause**: `text`
  - klauzula poufności wyświetlana na podglądzie A4 / PDF zlecenia; opcjonalna, `DEFAULT NULL`
  - dodana migracją `20260302000000_add_confidentiality_clause.sql`

Klucz główny:  
- PK(`id`)

Najważniejsze ograniczenia:  
- `order_no` – `UNIQUE`, trigger blokujący zmianę tej kolumny po utworzeniu.  
- Spójność `status_code` z logiką biznesową egzekwowana dodatkowo w triggerach (np. brak edycji pól biznesowych, gdy status w zbiorze {zrealizowane, anulowane}).

---

#### 1.2 `order_stops` – punkty trasy (załadunki / rozładunki)

- **id**: `uuid`  
  - PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **order_id**: `uuid`  
  - FK → `transport_orders.id`, `NOT NULL`, `ON DELETE CASCADE`
- **kind**: `text`  
  - typ punktu: `LOADING` lub `UNLOADING`, `NOT NULL`  
  - `CHECK (kind IN ('LOADING','UNLOADING'))`
- **sequence_no**: `smallint`  
  - pozycja na trasie (1,2,3,...) w ramach danego zlecenia, `NOT NULL`
- **date_local**: `date`  
  - data załadunku/rozładunku (lokalna), może być `NULL` w wersji roboczej
- **time_local**: `time without time zone`  
  - godzina lokalna, może być `NULL`
- **location_id**: `uuid`
  - FK → `locations.id`, może być `NULL` (puste planistyczne)
- **location_name_snapshot**: `varchar(500)`
  - snapshot nazwy lokalizacji; **immutable** – ustawiana raz przy wyborze lokalizacji
- **company_name_snapshot**: `varchar(500)`
  - snapshot nazwy firmy; **immutable** – ustawiana raz przy wyborze lokalizacji
- **address_snapshot**: `varchar(500)`
  - snapshot pełnego adresu (kraj, miasto, ulica, numer, kod); **immutable**
- **notes**: `varchar(500)`  
  - uwagi do punktu trasy

Klucze i ograniczenia:  
- PK(`id`)  
- `UNIQUE(order_id, sequence_no)` – każdy numer sekwencji w ramach zlecenia jest unikalny.  
- (opcjonalnie w przyszłości) trigger ograniczający maksymalnie 8 punktów załadunku i 3 rozładunku na zlecenie.

---

#### 1.3 `order_items` – pozycje towarowe w zleceniu

- **id**: `uuid`  
  - PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **order_id**: `uuid`  
  - FK → `transport_orders.id`, `NOT NULL`, `ON DELETE CASCADE`
- **product_id**: `uuid`
  - FK → `products.id`, może być `NULL` (np. pozycja wprowadzona tylko tekstowo)
- **product_name_snapshot**: `varchar(500)`
  - snapshot nazwy towaru; **immutable** – ustawiana raz przy wyborze produktu
- **default_loading_method_snapshot**: `varchar(100)`
  - snapshot domyślnego sposobu załadunku z produktu (np. `PALETA`, `LUZEM`); **immutable** – wypełniany automatycznie przy wyborze produktu
- **loading_method_code**: `varchar(100)`
  - aktualny sposób załadunku dla tej pozycji; domyślnie kopiowany z `default_loading_method_snapshot`, ale **nadpisywalny** przez użytkownika w formularzu
  - `CHECK (loading_method_code IS NULL OR loading_method_code IN ('PALETA','PALETA_BIGBAG','LUZEM','KOSZE'))`
- **quantity_tons**: `numeric(12,3)`
  - ilość w tonach, może być `NULL` dla wierszy czysto planistycznych
- **notes**: `varchar(500)`  
  - uwagi do towaru (np. informacja o paletach/sztukach)

Klucze i ograniczenia:  
- PK(`id`)  
- `CHECK (quantity_tons IS NULL OR quantity_tons >= 0)`

---

#### 1.4 `order_status_history` – historia zmian statusów

- **id**: `bigserial`  
  - PK, `NOT NULL`
- **order_id**: `uuid`  
  - FK → `transport_orders.id`, `NOT NULL`, `ON DELETE CASCADE`
- **old_status_code**: `text`  
  - poprzedni status, `NOT NULL`, FK → `order_statuses.code`
- **new_status_code**: `text`  
  - nowy status, `NOT NULL`, FK → `order_statuses.code`
- **changed_by_user_id**: `uuid`  
  - użytkownik zmieniający status, `NOT NULL`
- **changed_at**: `timestamptz`  
  - `DEFAULT now()`, `NOT NULL`

PK:  
- PK(`id`)

---

#### 1.5 `order_change_log` – log zmian pól zlecenia

- **id**: `bigserial`  
  - PK, `NOT NULL`
- **order_id**: `uuid`  
  - FK → `transport_orders.id`, `NOT NULL`, `ON DELETE CASCADE`
- **field_name**: `varchar(100)`  
  - nazwa zmienionego pola (np. `price_amount`, `first_loading_date`), `NOT NULL`
- **old_value**: `text`  
  - poprzednia wartość w formie tekstowej/JSON
- **new_value**: `text`  
  - nowa wartość
- **changed_by_user_id**: `uuid`  
  - użytkownik wykonujący zmianę, `NOT NULL`
- **changed_at**: `timestamptz`  
  - `DEFAULT now()`, `NOT NULL`

PK:  
- PK(`id`)

---

#### 1.6 `companies` – firmy (przewoźnicy, nadawcy, odbiorcy)

- **id**: `uuid`  
  - PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **erp_id**: `text`  
  - identyfikator firmy w ERP, może być `NULL`, `UNIQUE` gdy nie-NULL
- **name**: `varchar(500)`  
  - nazwa firmy, `NOT NULL`
- **type**: `text`  
  - rola firmy (np. `CARRIER`, `SHIPPER`, `RECEIVER`, `INTERNAL`), opcjonalne
- **tax_id**: `varchar(50)`  
  - NIP lub inny identyfikator podatkowy, opcjonalne
- **notes**: `varchar(500)`  
  - uwagi do firmy
- **is_active**: `boolean`  
  - czy firma jest aktywna i powinna być dostępna w słownikach, `NOT NULL`, `DEFAULT true`

PK:  
- PK(`id`)  
Unikalność:  
- częściowy indeks unikalny na `erp_id` (`WHERE erp_id IS NOT NULL`)

---

#### 1.7 `locations` – lokalizacje / oddziały firm

- **id**: `uuid`  
  - PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **erp_id**: `text`  
  - identyfikator lokalizacji w ERP, może być `NULL`, `UNIQUE` gdy nie-NULL
- **company_id**: `uuid`  
  - FK → `companies.id`, `NOT NULL`
- **name**: `varchar(500)`  
  - nazwa lokalizacji (np. `NORD Główny`, `NORD oddział w Kętach`), `NOT NULL`
- **country**: `varchar(100)`  
  - kraj (tekst z danych słownikowych/ERP), `NOT NULL`
- **city**: `varchar(200)`  
  - miasto, `NOT NULL`
- **street_and_number**: `varchar(200)`  
  - ulica + numer budynku/lokalu, `NOT NULL`
- **postal_code**: `varchar(20)`  
  - kod pocztowy, `NOT NULL`
- **notes**: `varchar(500)`  
  - dodatkowe informacje o lokalizacji
- **is_active**: `boolean`  
  - czy lokalizacja jest aktywna, `NOT NULL`, `DEFAULT true`

PK:  
- PK(`id`)  
Unikalność:  
- częściowy indeks unikalny na `erp_id` (`WHERE erp_id IS NOT NULL`)

---

#### 1.8 `products` – towary z domyślnym typem załadunku

(połączenie słowników towarów i typów załadunku)

- **id**: `uuid`  
  - PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **erp_id**: `text`  
  - identyfikator towaru w ERP, może być `NULL`, `UNIQUE` gdy nie-NULL
- **name**: `varchar(500)`  
  - nazwa towaru, `NOT NULL`
- **description**: `varchar(500)`  
  - krótki opis/kategoria, opcjonalne
- **default_loading_method_code**: `text`  
  - domyślny sposób załadunku (np. `PALETA`, `PALETA_BIGBAG`, `LUZEM`, `KOSZE`), `NOT NULL`  
  - `CHECK (default_loading_method_code IN ('PALETA','PALETA_BIGBAG','LUZEM','KOSZE'))` – lista może być rozszerzana przy zmianie schematu
- **is_active**: `boolean`  
  - czy towar jest aktywny, `NOT NULL`, `DEFAULT true`

PK:  
- PK(`id`)  
Unikalność:  
- częściowy indeks unikalny na `erp_id` (`WHERE erp_id IS NOT NULL`)

---

#### 1.9 `transport_types` – typy transportu

- **code**: `text`  
  - kod typu (`PL`, `EXP`, `EXP_K`, `IMP`), `PRIMARY KEY`
- **name**: `varchar(200)`  
  - nazwa opisowa, `NOT NULL`
- **description**: `varchar(500)`  
  - opis pomocniczy, opcjonalne
- **is_active**: `boolean`  
  - flaga aktywności, `NOT NULL`, `DEFAULT true`

PK:  
- PK(`code`)

---

#### 1.10 `order_statuses` – statusy zleceń

W systemie używane są **pełne nazwy statusów** (bez skrótów). Kolumna `code` jest jednocześnie kluczem technicznym **i** pełną nazwą statusu (pisaną małymi literami). Dzięki temu `code` = `name` — nie ma osobnego mapowania.

**Dane referencyjne (seed):**

| code | name | view_group | is_editable | sort_order |
|---|---|---|---|---|
| `robocze` | Robocze | CURRENT | true | 1 |
| `wysłane` | Wysłane | CURRENT | false | 2 |
| `korekta` | Korekta | CURRENT | true | 3 |
| `korekta wysłane` | Korekta wysłane | CURRENT | false | 4 |
| `reklamacja` | Reklamacja | CURRENT | false | 5 |
| `zrealizowane` | Zrealizowane | COMPLETED | false | 6 |
| `anulowane` | Anulowane | CANCELLED | false | 7 |

- **code**: `text`
  - kod statusu = pełna nazwa małymi literami (np. `robocze`, `wysłane`, `korekta wysłane`), `PRIMARY KEY`
- **name**: `varchar(200)`
  - pełna nazwa statusu do wyświetlania w UI (z wielką literą: `Robocze`, `Wysłane` itd.), `NOT NULL`
- **view_group**: `text`  
  - do której zakładki/widoku należy: `CURRENT` (aktualne) = robocze, wysłane, korekta, korekta wysłane, reklamacja; `COMPLETED` (zrealizowane) = zrealizowane; `CANCELLED` (anulowane) = anulowane, `NOT NULL`
- **is_editable**: `boolean`  
  - czy w tym statusie wolno edytować dane zlecenia, `NOT NULL`
- **sort_order**: `smallint`  
  - kolejność wyświetlania, opcjonalna

PK:  
- PK(`code`)

---

#### 1.11 `vehicle_variants` – typy pojazdów + pojemności

(połączenie typów pojazdów i pojemności)

- **code**: `text`  
  - techniczny kod wariantu (np. `HAK_24T`, `FIRANKA_24T`), `PRIMARY KEY`
- **name**: `varchar(200)`  
  - nazwa opisowa wariantu (np. `hakowiec 24t`), `NOT NULL`
- **vehicle_type**: `varchar(100)`  
  - ogólny typ pojazdu (np. `HAKOWIEC`, `FIRANKA`, `RUCHOMA_PODLOGA`), `NOT NULL`
- **capacity_tons**: `numeric(12,3)`
  - nośność w tonach, `NOT NULL`, `CHECK (capacity_tons > 0)`
- **capacity_volume_m3**: `numeric(12,1)`
  - objętość ładunkowa w m³ (np. 90, 30); może być `NULL` jeśli nieistotna dla danego wariantu
  - używana w UI do wyświetlania „firanka (90m³)" w kolumnie „Typ auta"
- **description**: `varchar(500)`
  - dodatkowe parametry (np. długość naczepy), opcjonalne
- **is_active**: `boolean`  
  - flaga aktywności, `NOT NULL`, `DEFAULT true`

PK:  
- PK(`code`)

---

#### 1.12 `user_profiles` – profile użytkowników (nad Supabase Auth)

Tabela rozszerzająca `auth.users` o dane aplikacyjne (rola, oddział) oraz mechanizm **username+hasło + invite flow** (AUTH-MIG A3, migracja `20260414120000_add_username_and_invite.sql`).

**Rozszerzenie CITEXT:** `CREATE EXTENSION IF NOT EXISTS citext;` — wymagane dla case-insensitive username.

- **id**: `uuid`
  - identyfikator użytkownika, zgodny z `auth.users.id`, `PRIMARY KEY`
- **email**: `varchar(320)`
  - adres e‑mail, `NOT NULL`, `UNIQUE`
  - używany wewnętrznie (integracja Outlook: `.eml` download, Microsoft Graph draft); **NIE** jest polem logowania po AUTH-MIG A3
- **username**: `citext`
  - login użytkownika, case-insensitive, `NOT NULL`, `UNIQUE` (indeks `user_profiles_username_key`)
  - `CHECK (username::text ~ '^[a-z0-9._-]{3,32}$')` (constraint `user_profiles_username_format_chk`)
  - używany w `POST /api/v1/auth/login` (mapping przez RPC `resolve_username_to_email`)
- **full_name**: `varchar(200)` — imię i nazwisko, opcjonalne
- **phone**: `varchar(100)` — numer telefonu, opcjonalne
- **role**: `text`
  - rola w systemie (`ADMIN`, `PLANNER`, `READ_ONLY`), `NOT NULL`
  - `CHECK (role IN ('ADMIN','PLANNER','READ_ONLY'))`
- **is_active**: `boolean`
  - `NOT NULL`, `DEFAULT false`
  - nowi użytkownicy = `false` (wymagają aktywacji przez invite link); po `POST /auth/activate` → `true`
  - deaktywacja przez admina: `false` + `auth.admin.signOut()` (natychmiastowe wylogowanie)
  - nieaktywne konto: `POST /auth/login` zwraca 403 „Konto nieaktywne"
- **invite_token_hash**: `text` NULL
  - SHA-256 hex hash invite tokenu (plaintext token NIGDY w DB — tylko hash)
  - `NULL` gdy konto aktywne lub brak aktualnego invite
- **invite_expires_at**: `timestamptz` NULL
  - moment wygaśnięcia tokenu (TTL 7 dni od `invited_at`)
- **invited_at**: `timestamptz` NULL
  - moment wystawienia ostatniego invite linka
- **activated_at**: `timestamptz` NULL
  - moment pierwszej aktywacji konta przez invite link
- **location_id**: `uuid`
  - FK → `locations.id`, może być `NULL`
  - identyfikator oddziału magazynowego użytkownika; wymagany do widoku `/warehouse`
  - dodane migracją `20260303200000_warehouse_view_fields.sql`
- **created_at**: `timestamptz` `DEFAULT now()`, `NOT NULL`
- **updated_at**: `timestamptz` `DEFAULT now()`, `NOT NULL` (trigger `set_user_profiles_updated_at`)

PK:
- PK(`id`)

Indeksy:
- `user_profiles_username_key` — UNIQUE INDEX na `username` (CITEXT = case-insensitive)

#### RPC `resolve_username_to_email(p_username CITEXT)` (AUTH-MIG A3)

Funkcja pomocnicza dla endpointu `POST /api/v1/auth/login`. Mapuje login na email + flagę aktywności, żeby backend mógł wywołać `signInWithPassword({ email, password })`.

```sql
CREATE OR REPLACE FUNCTION public.resolve_username_to_email(p_username citext)
RETURNS TABLE(email text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT up.email::text, up.is_active
    FROM public.user_profiles up
    WHERE up.username = p_username
    LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(citext) TO anon, authenticated;
```

- `SECURITY DEFINER` — funkcja omija RLS (anon nie ma jeszcze sesji w momencie logowania)
- 0 rows dla nieistniejącego username (nie rzuca błędu) — endpoint zwróci 401 z identycznym komunikatem jak przy złym haśle (anti-enumeration)

---

#### 1.13 `warehouse_report_recipients` – odbiorcy planu załadunkowego per oddział

Stała lista adresów email, na które wysyłany jest tygodniowy plan załadunkowy. Zmienia się raz na pół roku — zarządzanie przez ADMIN (brak UI w MVP, tylko SQL/Studio).

- **id**: `uuid` PK, `DEFAULT gen_random_uuid()`, `NOT NULL`
- **location_id**: `uuid` FK → `locations.id` (`ON DELETE CASCADE`), `NOT NULL`
- **email**: `varchar(320)`, `NOT NULL`
- **name**: `varchar(200)` — opcjonalna nazwa odbiorcy
- **created_at**: `timestamptz`, `DEFAULT now()`, `NOT NULL`

Indeksy:
- `wrr_location_email_uq` — UNIQUE INDEX na `(location_id, lower(email))` — case-insensitive unikalność
- `wrr_location_id_idx` — INDEX na `location_id`

RLS:
- `select_recipients` — SELECT dla authenticated
- `manage_recipients` — ALL (INSERT/UPDATE/DELETE) tylko dla ADMIN

---

### 2. Relacje między tabelami

1. **`transport_orders` → `order_stops`**  
   - relacja 1:N  
   - `order_stops.order_id` FK → `transport_orders.id` (`ON DELETE CASCADE`)

2. **`transport_orders` → `order_items`**  
   - relacja 1:N  
   - `order_items.order_id` FK → `transport_orders.id` (`ON DELETE CASCADE`)

3. **`transport_orders` → `order_status_history`**  
   - relacja 1:N  
   - `order_status_history.order_id` FK → `transport_orders.id` (`ON DELETE CASCADE`)

4. **`transport_orders` → `order_change_log`**  
   - relacja 1:N  
   - `order_change_log.order_id` FK → `transport_orders.id` (`ON DELETE CASCADE`)

5. **`companies` → `locations`**  
   - relacja 1:N  
   - `locations.company_id` FK → `companies.id` (`ON DELETE RESTRICT` / `NO ACTION`)

6. **`transport_orders` → `companies`**  
   - relacja N:1 (przewoźnik)  
   - `transport_orders.carrier_company_id` FK → `companies.id` (`ON DELETE RESTRICT`)

7. **`transport_orders` → `locations`**  
   - relacje N:1 (opcjonalne powiązania nagłówkowe):  
   - `transport_orders.shipper_location_id` FK → `locations.id` (`ON DELETE RESTRICT`)  
   - `transport_orders.receiver_location_id` FK → `locations.id` (`ON DELETE RESTRICT`)

8. **`order_stops` → `locations`**  
   - relacja N:1  
   - `order_stops.location_id` FK → `locations.id` (`ON DELETE RESTRICT`)

9. **`order_items` → `products`**  
   - relacja N:1  
   - `order_items.product_id` FK → `products.id` (`ON DELETE RESTRICT`)

10. **`transport_orders` → `transport_types`**  
    - relacja N:1  
    - `transport_orders.transport_type_code` FK → `transport_types.code`

11. **`transport_orders` / `order_status_history` → `order_statuses`**  
    - `transport_orders.status_code` FK → `order_statuses.code`  
    - `order_status_history.old_status_code` / `new_status_code` FK → `order_statuses.code`

12. **`transport_orders` → `vehicle_variants`** *(NIEAKTYWNA)*
    - kolumna `vehicle_variant_code` pozostaje w tabeli, ale ograniczenie FK zostało usunięte (sesja 21)
    - aplikacja używa teraz pól `vehicle_type_text` i `vehicle_capacity_volume_m3` (niezależnych od `vehicle_variants`)

13. **`user_profiles` → `locations`**
    - relacja N:1 (opcjonalna — oddział magazynowy)
    - `user_profiles.location_id` FK → `locations.id` (`ON DELETE RESTRICT`)
    - używane przez widok magazynowy do filtrowania operacji wg oddziału użytkownika

14. **`transport_orders` / logi → `user_profiles` / `auth.users`**
    - `transport_orders.created_by_user_id` / `updated_by_user_id` / `sent_by_user_id`,
      `order_status_history.changed_by_user_id`,
      `order_change_log.changed_by_user_id`
      – przechowują `uuid` zgodny z `user_profiles.id` (i Supabase `auth.users.id`).
    - formalne FK do `user_profiles.id` są opcjonalne (zależnie od konfiguracji Supabase).

---

### 3. Indeksy

#### 3.1 Indeksy na `transport_orders`

- PK indeks na `id` (automatyczny).  
- `UNIQUE INDEX` na `order_no`.  
- `INDEX` na `status_code`.  
- `INDEX` na `transport_type_code`.  
- `INDEX` na `carrier_company_id`.  
- `INDEX` na `(first_loading_date, order_no)` – domyślne sortowanie w widoku „aktualne”.  
- (opcjonalnie) `INDEX` na `(transport_type_code, first_loading_date)` – filtrowanie po typie transportu i dacie.  
- ~~`GIN INDEX` na `search_vector`~~ — *USUNIĘTY* (migracja `20260306000001_drop_search_vector.sql`; kolumna i indeks były martwe).
- (opcjonalnie) `INDEX` na `sent_at` – sortowanie / filtrowanie po dacie wysłania.
- `INDEX` na `order_seq_no` – sortowanie numeryczne w widoku listy.

#### 3.2 Indeksy na `order_stops`

- PK na `id`.  
- `UNIQUE INDEX` na `(order_id, sequence_no)`.  
- `INDEX` na `order_id`.  
- `INDEX` na `location_id`.  
- (opcjonalnie) `INDEX` na `(kind, date_local)` – jeśli często filtrujemy np. „załadunki w danym dniu”.
- `INDEX` na `(location_id, date_local)` — `idx_order_stops_location_date` — widok magazynowy filtruje stopy po lokalizacji i zakresie dat.

#### 3.3 Indeksy na `order_items`

- PK na `id`.  
- `INDEX` na `order_id`.  
- `INDEX` na `product_id`.

#### 3.4 Indeksy na logach

- `order_status_history`:  
  - PK na `id`  
  - `INDEX` na `(order_id, changed_at)`
- `order_change_log`:  
  - PK na `id`  
  - `INDEX` na `(order_id, changed_at)`

#### 3.5 Indeksy na słownikach

- `companies`:  
  - PK na `id`  
  - częściowy `UNIQUE INDEX` na `erp_id WHERE erp_id IS NOT NULL`  
  - `INDEX` na `name`
- `locations`:  
  - PK na `id`  
  - częściowy `UNIQUE INDEX` na `erp_id WHERE erp_id IS NOT NULL`  
  - `INDEX` na `(company_id, name)`  
  - `INDEX` na `(city, country)`
- `products`:  
  - PK na `id`  
  - częściowy `UNIQUE INDEX` na `erp_id WHERE erp_id IS NOT NULL`  
  - `INDEX` na `name`
- `transport_types`:  
  - PK na `code`
- `order_statuses`:  
  - PK na `code`
- `vehicle_variants`:  
  - PK na `code`
- `user_profiles`:  
  - PK na `id`  
  - `UNIQUE INDEX` na `email`

---

### 4. Zasady PostgreSQL / RLS (wysoki poziom)

> Uwaga: poniższe zasady opisują koncepcję; dokładna implementacja w Supabase będzie wykorzystywać `auth.uid()` i funkcje pomocnicze mapujące użytkownika na rekord w `user_profiles`.

#### 4.1 Role bazy danych

- **Rola aplikacyjna** (np. `app_user`):  
  - używana przez API/Supabase; ma włączony RLS na tabelach domenowych.
- **Rola ETL/ELT** (np. `etl_user`):  
  - służy do integracji i raportów; ma pełny `SELECT` na wszystkich tabelach, może mieć wyłączone RLS (`ALTER ROLE etl_user SET row_security = off;`), bez uprawnień `INSERT/UPDATE/DELETE`.

#### 4.2 RLS – `user_profiles` (AUTH-MIG A3)

RLS **włączone** z granularnymi politykami (migracja `20260414120000_add_username_and_invite.sql`):

- **`user_profiles_select_own`** (istniejąca, bez zmian): `SELECT USING (id = auth.uid())` — user widzi własny profil.
- **`user_profiles_select_admin`**: `SELECT` gdy `EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')` — ADMIN widzi wszystkie profile (panel `/admin/users`).
- **`user_profiles_insert_admin`**: `INSERT WITH CHECK (EXISTS admin)` — tylko ADMIN tworzy konta (invite flow).
- **`user_profiles_update_admin`**: `UPDATE USING (EXISTS admin) WITH CHECK (EXISTS admin)` — ADMIN modyfikuje dowolny profil (email/fullName/phone/role/isActive). User NIE ma UPDATE — edycja przez dedykowany endpoint backendu (nieprzewidziane w A3).
- **`user_profiles_delete_admin`**: `DELETE USING (EXISTS admin)` — hard delete dostępny tylko dla ADMIN; preferujemy miękką deaktywację (`is_active=false`).

Operacje `auth.admin.createUser/updateUserById/deleteUser/signOut` wymagają klienta `service_role` (omija RLS) — używany w `src/lib/services/user-admin.service.ts`.

#### 4.3 RLS – tabele domenowe (`transport_orders`, `order_stops`, `order_items`, logi)

Przy założeniu, że wszyscy zalogowani widzą wszystkie zlecenia:

- **Polityka SELECT** (dla roli aplikacyjnej):  
  - `USING (true)` – wszyscy uwierzytelnieni użytkownicy mogą czytać wszystkie wiersze.

- **Polityka INSERT/UPDATE/DELETE**:  
  - dozwolona tylko dla użytkowników, których `user_profiles.role IN ('ADMIN','PLANNER')`.  
  - użytkownicy z rolą `READ_ONLY` mają tylko `SELECT`.

Przykładowo (pseudokodowo):

```sql
CREATE POLICY app_orders_select ON transport_orders
FOR SELECT
USING (true);

CREATE POLICY app_orders_write ON transport_orders
FOR INSERT, UPDATE, DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('ADMIN','PLANNER')
  )
);
```

Analogiczne polityki mogą zostać zastosowane do `order_stops`, `order_items`, `order_status_history`, `order_change_log`.

#### 4.4 Ograniczenie edycji statusów zrealizowane/anulowane

Ten aspekt lepiej zrealizować **triggerami biznesowymi** niż RLS:

- Trigger `BEFORE UPDATE` na `transport_orders`:
  - jeśli aktualny status to zrealizowane lub anulowane, a aktualizacja próbuje zmienić jakiekolwiek pola inne niż status i niewielki zestaw techniczny, rzuca błąd.  
  - dopuszcza specjalny przypadek zmiany statusu z zrealizowane/anulowane na korekta w operacji „przywróć do aktualnych” (endpoint `/restore`).

- **Zlecenia anulowane**: po upływie 24 godzin od anulowania zlecenia są **fizycznie usuwane z bazy** (job w tle, szczegóły w api-plan). Nie są wykorzystywane w raportach. Zlecenia zrealizowane pozostają w bazie bez limitu czasu.

#### 4.5 Trigger dla automatycznego obliczania numeru tygodnia

Kolumna `week_number` w tabeli `transport_orders` jest automatycznie aktualizowana przy każdej zmianie pola `first_loading_date`. Implementacja wymaga następującego triggera:

```sql
-- Funkcja triggera obliczająca numer tygodnia ISO 8601
CREATE OR REPLACE FUNCTION update_week_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_loading_date IS NOT NULL THEN
    NEW.week_number := EXTRACT(WEEK FROM NEW.first_loading_date)::integer;
  ELSE
    NEW.week_number := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger uruchamiany przed INSERT/UPDATE
CREATE TRIGGER set_week_number
  BEFORE INSERT OR UPDATE OF first_loading_date ON transport_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_week_number();
```

**Uwagi implementacyjne**:
- Trigger działa **przed** zapisem (`BEFORE INSERT OR UPDATE`), modyfikując wartość `week_number` przed zapisem do bazy
- Uruchamia się tylko przy zmianie `first_loading_date` (optymalizacja `UPDATE OF`)
- Używa standardu ISO 8601 dla numeracji tygodni (funkcja `EXTRACT(WEEK FROM ...)`)
- Pole `week_number` nie może być edytowane bezpośrednio przez użytkownika – wszelkie próby ręcznego ustawienia wartości będą nadpisane przez trigger
- W API endpoint PUT nie przyjmuje pola `weekNumber` – jest ono ignorowane, jeśli zostanie przesłane

---

### 5. Logika automatycznego wypełniania pól

#### 5.1 Automatyczny wybór wymaganych dokumentów (pole `required_documents_text`)

Przy zmianie pola `transport_type_code` w zleceniu system automatycznie ustawia wartość pola `required_documents_text` według następujących zasad:

- **Jeśli `transport_type_code` IN (`EXP`, `EXP_K`, `IMP`)** (eksport, eksport kontener, import):
  - `required_documents_text` ← `"WZE, Aneks VII, CMR"`

- **Jeśli `transport_type_code` = `PL`** (kraj):
  - `required_documents_text` ← `"WZ, KPO, kwit wagowy"`

**Uwagi implementacyjne:**
- Automatyczna aktualizacja następuje przy każdej zmianie rodzaju transportu (także przy edycji istniejącego zlecenia).
- Użytkownik może **ręcznie zmienić** automatycznie wybraną wartość — po ręcznym wpisie pole nie jest nadpisywane przy kolejnych zapisach (o ile rodzaj transportu nie zmieni się ponownie).
- Logika realizowana w warstwie API (endpoint `PUT /api/v1/orders/{id}`) lub przez trigger/funkcję bazodanową.

#### 5.2 Automatyczny wybór waluty (pole `currency_code`)

Przy zmianie pola `transport_type_code` system automatycznie ustawia wartość pola `currency_code` według następujących zasad:

- **Jeśli `transport_type_code` = `PL`** (kraj):
  - `currency_code` ← `PLN`

- **Jeśli `transport_type_code` IN (`EXP`, `EXP_K`, `IMP`)** (eksport, eksport kontener, import):
  - `currency_code` ← `EUR`

**Uwagi implementacyjne:**
- Automatyczna aktualizacja następuje przy każdej zmianie rodzaju transportu (także przy edycji istniejącego zlecenia).
- Użytkownik może **ręcznie wybrać inną walutę** z listy (PLN, EUR, USD) — wybór użytkownika jest respektowany do momentu ponownej zmiany rodzaju transportu.
- Logika realizowana w warstwie API (endpoint `PUT /api/v1/orders/{id}`).

---

### 6. Dodatkowe uwagi projektowe

- **Snapshoty (snapshot fields)**:
  - Wszystkie pola zawierające słowo „snapshot" w nazwie (np. `carrier_name_snapshot`, `location_name_snapshot`, `product_name_snapshot`, `sender_contact_name`) są **immutable** – ustawiane raz przy wyborze encji (przewoźnika, lokalizacji, towaru, wysyłce) i **nigdy nie są automatycznie aktualizowane**.
  - Celem snapshotów jest zachowanie nazw firm, lokalizacji i towarów dokładnie w takiej formie, jaka była użyta w momencie tworzenia zlecenia, nawet jeśli później dane w słownikach ulegną zmianie.
  - Snapshoty mogą być edytowane **ręcznie** przez użytkownika bezpośrednio w formularzu (np. poprawienie literówki w nazwie firmy), ale system nigdy nie aktualizuje ich automatycznie przy zmianach w słownikach.

- **Normalizacja**:
  - Schemat jest zasadniczo w 3NF dla głównych encji (zlecenia, punkty, pozycje, słowniki).
  - Wprowadzono świadome denormalizacje (np. `summary_route`, pierwsze daty załadunku/rozładunku, snapshoty tekstowe firm/lokalizacji/towarów, `search_text`) w celu uproszczenia zapytań i przyspieszenia widoku planistycznego oraz raportów.

- **Wyszukiwanie tekstowe**:
  - W MVP globalne wyszukiwanie działa przez `ILIKE`/`LOWER()` na `search_text`, z wykorzystaniem rozszerzenia `unaccent`, aby ignorować polskie znaki diakrytyczne.
  - Kolumna `search_vector` (tsvector) i indeks GIN zostały usunięte (nigdy nie były populowane). Docelowo, przy potrzebie wydajniejszego wyszukiwania, można je odtworzyć z triggerem populującym.

- **Integracja z ERP**:  
  - Kolumny `erp_id` w słownikach firm, lokalizacji i towarów pozwalają później powiązać rekordy z ERP bez zmiany lokalnych kluczy głównych.  
  - Rekordy użyte w zleceniach nie są fizycznie usuwane; zamiast tego używana jest flaga `is_active`, a UI nie pokazuje nieaktywnych pozycji w nowych zleceniach.

- **Środowisko testowe vs produkcyjne**:  
  - Testowy projekt Supabase powinien używać **identycznego schematu** jak produkcja, z innym zestawem danych słownikowych.  
  - Lokalne `id` w słownikach mogą różnić się między środowiskami; stabilną osią integracji pozostają `erp_id`.

- **Raportowanie i ETL**:  
  - Na start raporty mogą korzystać bezpośrednio z tabel operacyjnych (z użyciem roli `etl_user`).  
  - W przyszłości można dodać osobny schemat/bazę raportową zasilaną przez ETL/ELT, bez konieczności zmiany schematu operacyjnego.

- **Nazewnictwo**:  
  - Nazwy tabel i kolumn są po angielsku (`snake_case`), zgodnie z dobrymi praktykami w projektach TypeScript/Node + PostgreSQL; warstwa aplikacyjna może mapować je na etykiety w języku polskim w UI.

