# Database Agent — Pamięć

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
