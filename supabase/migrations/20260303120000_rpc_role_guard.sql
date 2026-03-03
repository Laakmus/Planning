-- ============================================================
-- MIGRACJA: Walidacja roli wewnątrz funkcji RPC
-- ============================================================
-- cel: zabezpieczenie funkcji RPC try_lock_order i generate_next_order_no
--      przed wywołaniem przez użytkowników z rolą READ_ONLY.
--      dotychczas walidacja roli odbywała się wyłącznie w warstwie aplikacyjnej
--      (middleware requireWriteAccess), lecz Supabase JS client pozwalał
--      wywoływać RPC bezpośrednio z pominięciem tej warstwy.
--
-- dotknięte obiekty:
--   - nowa funkcja: public.require_write_role() — reusable helper
--   - zaktualizowana: public.try_lock_order(uuid, uuid, int)
--   - zaktualizowana: public.generate_next_order_no()
--
-- tabele odczytywane: user_profiles (kolumna: role)
--
-- uwagi:
--   - NIE zmieniamy GRANT — funkcje pozostają dostępne dla roli authenticated,
--     ale sam guard wewnątrz funkcji odrzuca wywołania od READ_ONLY
--   - errcode '42501' = insufficient_privilege (standardowy kod PG)
--   - dodano guard anti-spoofing w try_lock_order: p_user_id musi == auth.uid()
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: require_write_role()
-- ------------------------------------------------------------
-- Wielokrotnego użytku walidator roli. Sprawdza, czy bieżący
-- użytkownik (auth.uid()) ma rolę ADMIN lub PLANNER w user_profiles.
-- Rzuca wyjątek jeśli rola jest inna lub profil nie istnieje.

create or replace function public.require_write_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- pobierz rolę bieżącego użytkownika z profilu
  select role into v_role
  from public.user_profiles
  where id = auth.uid();

  -- brak profilu lub rola spoza dozwolonego zbioru → odmowa
  if v_role is null or v_role not in ('ADMIN', 'PLANNER') then
    raise exception 'Brak uprawnień — wymagana rola ADMIN lub PLANNER'
      using errcode = '42501'; -- insufficient_privilege
  end if;
end;
$$;

-- uprawnienia: authenticated mogą wywoływać helper (guard i tak sprawdzi rolę)
grant execute on function public.require_write_role() to authenticated;

-- ------------------------------------------------------------
-- 2. try_lock_order — zaktualizowana wersja z guardem roli
-- ------------------------------------------------------------
-- zmiany względem oryginału:
--   a) PERFORM public.require_write_role() na początku — blokuje READ_ONLY
--   b) guard anti-spoofing: p_user_id musi być równy auth.uid()
--   c) reszta logiki (atomic update, NOT_FOUND, CONFLICT) BEZ ZMIAN

create or replace function public.try_lock_order(
  p_order_id uuid,
  p_user_id uuid,
  p_lock_expiry_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_threshold timestamptz := v_now - (p_lock_expiry_minutes || ' minutes')::interval;
  v_rows_affected int;
  v_result jsonb;
begin
  -- guard: wymagana rola ADMIN lub PLANNER
  perform public.require_write_role();

  -- guard: anti-spoofing — p_user_id musi odpowiadać zalogowanemu użytkownikowi
  if p_user_id != auth.uid() then
    raise exception 'Podany p_user_id nie odpowiada zalogowanemu użytkownikowi'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  -- atomic: aktualizuj lock tylko jeśli dostępny (brak locka, własny lock lub wygasły lock)
  update public.transport_orders
  set locked_by_user_id = p_user_id,
      locked_at = v_now
  where id = p_order_id
    and (
      locked_by_user_id is null
      or locked_by_user_id = p_user_id
      or locked_at < v_threshold
    );

  get diagnostics v_rows_affected = row_count;

  if v_rows_affected > 0 then
    -- lock uzyskany pomyślnie
    return jsonb_build_object(
      'status', 'OK',
      'lockedByUserId', p_user_id::text,
      'lockedAt', v_now::text
    );
  end if;

  -- lock nie uzyskany — sprawdź dlaczego
  if not exists (select 1 from public.transport_orders where id = p_order_id) then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  -- zlecenie istnieje ale zablokowane przez innego użytkownika (niewygasłe)
  select jsonb_build_object(
    'status', 'CONFLICT',
    'lockedByUserId', t.locked_by_user_id::text,
    'lockedByUserName', coalesce(u.full_name, ''),
    'lockedAt', t.locked_at::text
  )
  into v_result
  from public.transport_orders t
  left join public.user_profiles u on u.id = t.locked_by_user_id
  where t.id = p_order_id;

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- 3. generate_next_order_no — zaktualizowana wersja z guardem roli
-- ------------------------------------------------------------
-- zmiany względem oryginału:
--   a) PERFORM public.require_write_role() na początku — blokuje READ_ONLY
--   b) reszta logiki (advisory lock, sequence generation) BEZ ZMIAN

create or replace function public.generate_next_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_prefix text := 'ZT' || v_year || '/';
  v_max_seq int;
  v_next_seq int;
  v_order_no text;
begin
  -- guard: wymagana rola ADMIN lub PLANNER
  perform public.require_write_role();

  -- advisory lock z kluczem na rok — serializuje równoczesne wywołania
  perform pg_advisory_xact_lock(hashtext('order_no_' || v_year::text));

  -- znajdź najwyższy istniejący numer sekwencji dla tego roku
  select coalesce(max(
    case
      when order_no ~ ('^ZT' || v_year || '/\d+$')
      then substring(order_no from '/(\d+)$')::int
    end
  ), 0)
  into v_max_seq
  from public.transport_orders
  where order_no like v_prefix || '%';

  v_next_seq := v_max_seq + 1;
  -- dynamiczny padding: min 4 cyfry, rośnie automatycznie powyżej 9999
  v_order_no := v_prefix || lpad(v_next_seq::text, greatest(4, length(v_next_seq::text)), '0');

  return v_order_no;
end;
$$;
