# Strategia migracji bazy danych — Planning App

## 1. Tworzenie nowych migracji

### Format nazwy pliku
```
YYYYMMDDHHMMSS_opis_zmian.sql
```
- **Timestamp**: rok-miesiąc-dzień-godzina-minuta-sekunda (np. `20260306000001`)
- **Opis**: snake_case, krótki opis zmian (np. `drop_search_vector`, `add_notification_details`)
- **Lokalizacja**: `supabase/migrations/`

### Konwencje w pliku SQL
- **Komentarze**: po polsku
- **Nazwy tabel/kolumn/funkcji/indeksów**: po angielsku, `snake_case`
- **Zawsze używaj**: `IF NOT EXISTS` w CREATE, `IF EXISTS` w DROP
- **Triggery**: `BEFORE INSERT OR UPDATE`
- **Funkcje RPC**: `SECURITY DEFINER` z `SET search_path = public`
- **Indeksy**: na FK i kolumny filtrowane

### Przykład migracji
```sql
-- Dodanie kolumny xyz do tabeli transport_orders
ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS xyz text DEFAULT NULL;

-- Indeks na nowej kolumnie (jeśli filtrowana)
CREATE INDEX IF NOT EXISTS idx_transport_orders_xyz
  ON public.transport_orders (xyz);
```

---

## 2. Aplikowanie migracji

### Opcja A: Reset pełny (development)
```bash
supabase db reset
```
- Usuwa wszystkie dane, reaplikuje WSZYSTKIE migracje od zera + `seed.sql`
- **Użyj gdy**: zmieniłeś istniejącą migrację lub chcesz czyste środowisko

### Opcja B: Inkrementalna (nowa migracja)
```bash
supabase migration up
```
- Aplikuje tylko nowe (jeszcze niewykonane) migracje
- **Użyj gdy**: dodajesz nową migrację do istniejącej bazy

### WAŻNE: Po każdej migracji odśwież cache PostgREST
```bash
docker restart supabase_rest_Planning
```
Alternatywnie (bez restartu kontenera):
```sql
NOTIFY pgrst, 'reload schema';
```
Bez tego PostgREST może nie widzieć nowych kolumn/funkcji RPC.

---

## 3. Generowanie typów TypeScript po migracji

```bash
supabase gen types typescript --local > src/db/database.types.ts
```
- Generuje typy z lokalnej bazy Supabase
- Plik `src/db/database.types.ts` jest jedynym źródłem typów DB w projekcie
- **Zawsze uruchom po migracji**, aby typy odzwierciedlały aktualny schemat

---

## 4. Testowanie migracji lokalnie

### Krok po kroku
1. Napisz migrację w `supabase/migrations/`
2. Uruchom `supabase db reset` (pełny reset) lub `supabase migration up` (inkrementalnie)
3. Sprawdź wynik w Supabase Studio (`http://localhost:54333`)
4. Odśwież PostgREST: `docker restart supabase_rest_Planning`
5. Wygeneruj typy: `supabase gen types typescript --local > src/db/database.types.ts`
6. Uruchom testy: `npx vitest run`

### Sprawdzenie stanu bazy
```bash
# Status Supabase (porty, wersje)
supabase status

# Połączenie do bazy
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54332 -U postgres -d postgres

# Lista migracji
supabase migration list
```

### Porty lokalne Supabase
| Serwis | Port |
|--------|------|
| API Gateway | 54331 |
| PostgreSQL | 54332 |
| Studio | 54333 |

---

## 5. Konwencje nazewnictwa

| Element | Konwencja | Przykład |
|---------|-----------|---------|
| Tabele | snake_case, liczba mnoga | `transport_orders` |
| Kolumny | snake_case | `first_loading_date` |
| Indeksy | `idx_{tabela}_{kolumna}` | `idx_transport_orders_status_code` |
| FK constraints | `{tabela}_{kolumna}_fkey` | `order_stops_order_id_fkey` |
| Triggery | opisowa nazwa | `set_week_number`, `protect_order_no` |
| Funkcje RPC | opisowa nazwa | `try_lock_order`, `generate_next_order_no` |
| Migracje | `YYYYMMDDHHMMSS_opis.sql` | `20260306000001_drop_search_vector.sql` |

---

## 6. Backward compatibility

### Zasady
- **Nie usuwaj kolumn** używanych przez aktywny kod — najpierw usuń referencje w kodzie, potem kolumnę w kolejnej migracji
- **Nie zmieniaj typów kolumn** bez sprawdzenia wpływu na istniejące dane i kod
- **Dodawanie kolumn**: zawsze z `DEFAULT NULL` lub wartością domyślną, aby nie złamać istniejących INSERT-ów
- **Usuwanie FK**: bezpieczne jeśli kod nie zależy od constraint (np. `vehicle_variant_code` FK usunięte w sesji 21)
- **Migracje są idempotentne**: używaj `IF NOT EXISTS` / `IF EXISTS`

### Wzorzec bezpiecznego usuwania kolumny
1. Migracja 1: Usuń referencje w kodzie (typy, serwisy, walidatory)
2. Migracja 2: `ALTER TABLE ... DROP COLUMN IF EXISTS ...`

---

## 7. Cofanie migracji (rollback)

Supabase **nie ma natywnego mechanizmu rollback**. Workaroundy:

### Opcja A: Nowa migracja „cofająca"
```sql
-- Cofnięcie migracji 20260306000001_drop_search_vector.sql
ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS transport_orders_search_vector_gin_idx
  ON public.transport_orders USING gin (search_vector);
```

### Opcja B: Usunięcie pliku migracji + reset
1. Usuń plik migracji z `supabase/migrations/`
2. Uruchom `supabase db reset`
- **Uwaga**: to działa tylko lokalnie; na produkcji trzeba użyć Opcji A

### Opcja C: Przywrócenie z backupu (produkcja)
- Supabase Cloud oferuje Point-in-Time Recovery (PITR)
- Lokalnie: `pg_dump` / `pg_restore`

---

## 8. Skonsolidowany schemat

Plik `20260207000000_consolidated_schema.sql` zawiera skonsolidowany schemat (tabele, RLS, triggery, RPC). Został stworzony przez scalenie 9 wcześniejszych migracji. Kolejne migracje są inkrementalne i zależą od tego bazowego schematu.

### Lista migracji (chronologicznie)
1. `20260207000000_consolidated_schema.sql` — pełny schemat bazowy
2. `20260228000000_fix_order_no_dynamic_padding.sql` — fix generowania numeru zlecenia
3. `20260228000001_add_is_entry_fixed.sql` — flaga „zafiksowany wjazd"
4. `20260301000000_decouple_vehicle_fields.sql` — rozdzielenie pól pojazdu
5. `20260302000000_add_confidentiality_clause.sql` — klauzula poufności
6. `20260303120000_rpc_role_guard.sql` — guard ról w RPC
7. `20260303130000_add_notification_details.sql` — dane do awizacji
8. `20260303200000_warehouse_view_fields.sql` — pola widoku magazynowego
9. `20260306000001_drop_search_vector.sql` — usunięcie martwej kolumny search_vector
