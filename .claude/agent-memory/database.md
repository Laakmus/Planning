# Database Agent — Pamięć

## Sesja 46 (2026-03-08) — Backfill shipper/receiver z stops

### Wykonane
- Migracja `20260308000000_backfill_shipper_receiver_from_stops.sql`:
  - Uzupełnia `shipper_location_id` z pierwszego LOADING stop (`location_id`, `DISTINCT ON`, najniższy `sequence_no`)
  - Uzupełnia `receiver_location_id` z ostatniego UNLOADING stop (`location_id`, `DISTINCT ON`, najwyższy `sequence_no`)
  - Snapshoty (`name_snapshot`, `address_snapshot`) pobierane z `locations JOIN companies`
  - Idempotentna: aktualizuje TYLKO rekordy z `IS NULL`
- Dodano ten sam SQL na koniec `supabase/seed.sql` (przed `COMMIT`)

### Learningi
- **Migracje uruchamiają się PRZED seedem** — migracja backfillująca dane testowe nie zadziała na pustej bazie. Trzeba duplikować SQL w `seed.sql` na koniec
- Migracja jest nadal potrzebna dla produkcji (gdzie dane już istnieją w momencie migracji)
- `concat_ws(', ', nullif(..., ''))` — bezpieczny format adresu (pomija puste segmenty)
- `DISTINCT ON (os.order_id) ... ORDER BY os.order_id, os.sequence_no ASC/DESC` — postgres idiom na "pierwszy/ostatni rekord w grupie"


## Sesja 24 (2026-03-03) — RPC role guard

### Wykonane
- Migracja `20260303120000_rpc_role_guard.sql`:
  - `require_write_role()` — reusable helper, sprawdza `user_profiles.role` via `auth.uid()`, errcode `42501`
  - `try_lock_order` — dodany guard roli + guard anti-spoofing (`p_user_id != auth.uid()`)
  - `generate_next_order_no` — dodany guard roli
- NIE zmieniano GRANT — funkcje nadal `GRANT EXECUTE TO authenticated`, guard jest wewnątrz

### Learningi
- Kolumna w `user_profiles` to `role` (nie `role_code`) — typ TEXT, wartości: ADMIN, PLANNER, READ_ONLY
- errcode `42501` (insufficient_privilege) → PostgREST automatycznie mapuje na HTTP 403
- REVOKE na `generate_next_order_no` złamałoby app — `order-snapshot.service.ts` (via `order-create`) wywołuje RPC z klienta użytkownika (authenticated), nie service_role
- Pattern: `PERFORM public.require_write_role()` na początku każdej chronionej funkcji
- `SECURITY DEFINER` + `SET search_path = public` — wymagane przy dostępie do `auth.uid()`
