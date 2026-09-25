-- =============================================================================
-- Ograniczenie dostępu do resolve_username_to_email
-- =============================================================================
-- Problem: funkcja była dostępna dla anon/authenticated, a anon key jest publiczny
-- (PUBLIC_SUPABASE_ANON_KEY w przeglądarce). Pozwalało to na enumerację
-- username → email + is_active z pominięciem rate limitu /api/v1/auth/login.
--
-- Endpoint /api/v1/auth/login woła RPC klientem service_role, więc wystarczy
-- uprawnienie dla service_role.
-- =============================================================================

revoke all on function public.resolve_username_to_email(citext) from public, anon, authenticated;
grant execute on function public.resolve_username_to_email(citext) to service_role;
