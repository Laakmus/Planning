# Specyfikacja pól do pobrania z Comarch ERP

> **Cel**: Firma programistyczna obsługująca Comarch ERP przygotuje API REST udostępniające poniższe dane słownikowe do systemu Planning (zarządzanie zleceniami transportowymi).
>
> **Data**: 2026-03-28
>
> **Format integracji**: API REST (JSON)

---

## Podsumowanie

Z Comarch ERP pobierane są **wyłącznie dane słownikowe** (firmy, lokalizacje, produkty). Zlecenia transportowe, trasy, pozycje towarowe, finanse, pojazdy i wszelkie dane operacyjne — tworzone i zarządzane są ręcznie w aplikacji Planning.

| Co | Źródło | Uwagi |
|----|--------|-------|
| Słownik firm (kontrahenci) | **Comarch ERP** | 3 pola: ID, nazwa, NIP |
| Słownik lokalizacji (adresy) | **Comarch ERP** | 8 pól: pełne dane adresowe |
| Słownik produktów (towary) | **Comarch ERP** | 2 pola: ID, nazwa |
| Zlecenia transportowe | Planning | Tworzone ręcznie przez planistę |
| Punkty trasy (załadunki/rozładunki) | Planning | Budowane ręcznie, lokalizacje wybierane ze słownika ERP |
| Pozycje towarowe | Planning | Dodawane ręcznie, produkty wybierane ze słownika ERP |
| Finanse (stawki, waluty, płatności) | Planning | Wpisywane ręcznie przez planistę |
| Typy pojazdów | Planning | Prowadzone ręcznie — nie istnieją w Comarch ERP |
| Daty, godziny, kraje | Planning | Ustawiane ręcznie przez planistę |
| Kontakt wysyłającego | Planning | Wpisywany ręcznie |

---

## 1. Slownik: Firmy / Kontrahenci (companies)

Słownik wszystkich firm: przewoźnicy, nadawcy, odbiorcy, podmioty wewnętrzne.

Planning używa `erp_id` jako klucz łączący — np. gdy planista wybiera przewoźnika w zleceniu, system zapisuje referencję do firmy po jej `erp_id`.

| # | Pole | Typ danych | Wymagane | Opis biznesowy | Przykład wartości |
|---|------|-----------|----------|----------------|-------------------|
| 1 | `erp_id` | string | TAK | Unikalny identyfikator firmy w Comarch ERP. Musi być stabilny i niezmienny. | `"KNT-00451"` |
| 2 | `name` | string (max 500) | TAK | Pełna nazwa firmy (jak w rejestrze / KRS) | `"Trans-Pol Sp. z o.o."` |
| 3 | `tax_id` | string (max 50) | NIE | NIP (Polska) lub zagraniczny identyfikator podatkowy | `"PL5213000011"` |

**Pola zarządzane w Planning (NIE z ERP):**
- `type` — typ firmy (CARRIER/SHIPPER/RECEIVER/INTERNAL) — przypisywany ręcznie w Planning
- `notes` — uwagi — wpisywane ręcznie w Planning
- `is_active` — aktywność — zarządzana w Planning

---

## 2. Slownik: Lokalizacje (locations)

Słownik lokalizacji: oddziały firm, magazyny, punkty załadunku/rozładunku. Każda lokalizacja należy do firmy (powiązanie przez `company_erp_id`).

Planning używa `erp_id` jako klucz łączący — np. gdy planista dodaje punkt załadunku w trasie, wybiera lokalizację ze słownika (po `erp_id`).

| # | Pole | Typ danych | Wymagane | Opis biznesowy | Przykład wartości |
|---|------|-----------|----------|----------------|-------------------|
| 4 | `erp_id` | string | TAK | Unikalny identyfikator lokalizacji w Comarch ERP. Musi być stabilny i niezmienny. | `"LOK-00012"` |
| 5 | `company_erp_id` | string | TAK | ID firmy nadrzędnej w ERP — klucz łączący z tabelą Firmy (pole #1) | `"KNT-00100"` |
| 6 | `name` | string (max 500) | TAK | Nazwa lokalizacji (np. "Magazyn Centralny", "Oddział Wrocław") | `"Magazyn Centralny Poznań"` |
| 7 | `country` | string (max 100) | TAK | Kod kraju (ISO 3166-1 alpha-2) lub pełna nazwa | `"PL"` |
| 8 | `city` | string (max 200) | TAK | Nazwa miasta | `"Poznań"` |
| 9 | `postal_code` | string (max 20) | TAK | Kod pocztowy | `"61-001"` |
| 10 | `street_and_number` | string (max 200) | TAK | Ulica i numer budynku/lokalu | `"ul. Przemysłowa 15"` |
| 11 | `is_active` | boolean | TAK | Czy lokalizacja jest aktywna (true/false). Nieaktywne nie pojawiają się w listach wyboru. | `true` |

**Pola zarządzane w Planning (NIE z ERP):**
- `notes` — uwagi/instrukcje dojazdu — wpisywane ręcznie w Planning

---

## 3. Slownik: Produkty / Towary (products)

Słownik towarów przewożonych w zleceniach transportowych.

Planning używa `erp_id` jako klucz łączący — np. gdy planista dodaje pozycję towarową w zleceniu, wybiera produkt ze słownika (po `erp_id`).

| # | Pole | Typ danych | Wymagane | Opis biznesowy | Przykład wartości |
|---|------|-----------|----------|----------------|-------------------|
| 12 | `erp_id` | string | TAK | Unikalny identyfikator produktu w Comarch ERP. Musi być stabilny i niezmienny. | `"PRD-00023"` |
| 13 | `name` | string (max 500) | TAK | Nazwa produktu/towaru | `"Granulat PP czarny"` |

**Pola zarządzane w Planning (NIE z ERP):**
- `description` — opis produktu — wpisywany ręcznie w Planning
- `default_loading_method_code` — domyślny sposób załadunku (PALETA/PALETA_BIGBAG/LUZEM/KOSZE) — ustawiany ręcznie w Planning
- `is_active` — aktywność — zarządzana w Planning

---

## Jak Planning uzywa danych z ERP

### Referencje w zleceniach
Gdy planista tworzy zlecenie transportowe w Planning, wybiera kontrahentów i lokalizacje z list (dropdown/autocomplete). Te listy są zasilane danymi ze słowników pobranych z ERP:

| Pole w zleceniu | Co planista wybiera | Słownik ERP |
|-----------------|--------------------|----|
| Przewoźnik (`carrier`) | Firma transportowa | Firmy (#1-3) |
| Nadawca (`shipper`) | Lokalizacja wysyłki | Lokalizacje (#4-11) |
| Odbiorca (`receiver`) | Lokalizacja docelowa | Lokalizacje (#4-11) |
| Punkt trasy (`stop.location`) | Lokalizacja załadunku/rozładunku | Lokalizacje (#4-11) |
| Produkt (`item.product`) | Towar w pozycji | Produkty (#12-13) |

### Synchronizacja
- Słowniki powinny być synchronizowane **regularnie** (np. co 15 minut lub na żądanie)
- Planning ma endpoint do triggerowania synchronizacji: `POST /api/v1/dictionary-sync/run`
- Obsługiwane zasoby: `COMPANIES`, `LOCATIONS`, `PRODUCTS`

---

## Podsumowanie pol

| Sekcja | Liczba pól z ERP | Pola |
|--------|-----------------|------|
| Firmy | 3 | erp_id, name, tax_id |
| Lokalizacje | 8 | erp_id, company_erp_id, name, country, city, postal_code, street_and_number, is_active |
| Produkty | 2 | erp_id, name |
| **RAZEM** | **13 pól** | |

## Uwagi techniczne dla firmy programistycznej

1. **Klucze `erp_id`**: Muszą być stabilne, unikalne i niezmienne w czasie. Planning używa ich jako klucz łączący między systemami. Zmiana `erp_id` oznacza utratę powiązań.

2. **Format API**: JSON, REST, UTF-8. Endpoint powinien zwracać listę rekordów z powyższymi polami.

3. **Null vs puste**: Pola opcjonalne (tax_id) mogą być `null`. Puste stringi `""` traktowane są jako `null`.

4. **Pola boolean**: `is_active` — `true` lub `false` (nie 0/1, nie "T"/"N").

5. **Aktualizacje**: API powinno umożliwiać pobranie pełnej listy (initial sync) oraz zmian od ostatniej synchronizacji (delta sync, opcjonalnie).

6. **Encoding**: UTF-8 (polskie znaki: ą, ć, ę, ł, ń, ó, ś, ź, ż).
