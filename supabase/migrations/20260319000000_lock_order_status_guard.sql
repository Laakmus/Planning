-- ============================================================
-- MIGRACJA: Guard statusu w try_lock_order
-- ============================================================
-- Dodanie warunku AND status_code NOT IN ('anulowane','zrealizowane')
-- do UPDATE w try_lock_order. Zapobiega race condition TOCTOU:
-- użytkownik A sprawdza status → użytkownik B zmienia na anulowane →
-- użytkownik A blokuje anulowane zlecenie.
-- ============================================================

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
  -- + guard: nie blokuj zleceń w statusach terminalnych
  update public.transport_orders
  set locked_by_user_id = p_user_id,
      locked_at = v_now
  where id = p_order_id
    and status_code not in ('anulowane', 'zrealizowane')
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

  -- sprawdź czy zlecenie jest w statusie terminalnym
  if exists (
    select 1 from public.transport_orders
    where id = p_order_id and status_code in ('anulowane', 'zrealizowane')
  ) then
    return jsonb_build_object('status', 'TERMINAL_STATUS');
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
