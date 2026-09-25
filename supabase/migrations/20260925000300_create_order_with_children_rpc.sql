-- =============================================================================
-- RPC create_order_with_children — atomowe utworzenie zlecenia (jedna transakcja)
-- =============================================================================
-- Problem: createOrder / duplicateOrder robiły INSERT zlecenia, potem osobno stopy,
-- towary, historię i log. Przy błędzie próbowały „kompensującego" DELETE, który też
-- mógł się nie udać (osierocone zlecenie), a błąd zapisu logu PO utworzeniu zlecenia
-- zwracał użytkownikowi błąd mimo zapisanego zlecenia (ryzyko duplikatów przy ponowieniu).
--
-- Rozwiązanie: jeden INSERT wszystkiego w jednej transakcji plpgsql.
--
-- Bezpieczeństwo: SECURITY INVOKER (RLS użytkownika) + require_write_role();
-- created_by_user_id i changed_by_user_id zawsze = auth.uid(); kolumny z białej listy.
--
-- Zwraca: {"id": uuid, "created_at": timestamptz}
-- =============================================================================

create or replace function public.create_order_with_children(
  p_order jsonb,
  p_stops jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_change_log jsonb default '[]'::jsonb,
  p_status_history jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  c_order_columns constant text[] := array[
    'order_no', 'status_code',
    'transport_type_code', 'currency_code', 'vehicle_type_text', 'vehicle_capacity_volume_m3',
    'carrier_company_id', 'carrier_name_snapshot', 'carrier_address_snapshot',
    'carrier_location_name_snapshot', 'shipper_location_id', 'shipper_name_snapshot',
    'shipper_address_snapshot', 'receiver_location_id', 'receiver_name_snapshot',
    'receiver_address_snapshot', 'price_amount', 'payment_term_days', 'payment_method',
    'total_load_tons', 'total_load_volume_m3', 'special_requirements', 'required_documents_text',
    'general_notes', 'notification_details', 'confidentiality_clause', 'complaint_reason',
    'sender_contact_name', 'sender_contact_phone', 'sender_contact_email',
    'first_loading_date', 'first_loading_time', 'first_unloading_date', 'first_unloading_time',
    'last_loading_date', 'last_loading_time', 'last_unloading_date', 'last_unloading_time',
    'first_loading_country', 'first_unloading_country', 'main_product_name', 'summary_route',
    'transport_year', 'search_text'
  ];
  v_uid uuid := auth.uid();
  v_key text;
  v_cols text := '';
  v_vals text := '';
  v_order_id uuid;
  v_created_at timestamptz;
begin
  perform public.require_write_role();

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'create_order_with_children: p_order must be a JSON object' using errcode = '22023';
  end if;

  -- 1. INSERT zlecenia (kolumny z białej listy; created_by = auth.uid())
  for v_key in select jsonb_object_keys(p_order) loop
    if v_key = 'created_by_user_id' then
      continue; -- zawsze auth.uid()
    end if;
    if not (v_key = any (c_order_columns)) then
      raise exception 'create_order_with_children: column % is not allowed', v_key using errcode = '42501';
    end if;
    v_cols := v_cols || format('%I, ', v_key);
    v_vals := v_vals || format('r.%I, ', v_key);
  end loop;

  execute format(
    'insert into public.transport_orders (%s created_by_user_id)
     select %s $1
       from jsonb_populate_record(null::public.transport_orders, $2) r
     returning id, created_at',
    v_cols, v_vals
  ) into v_order_id, v_created_at using v_uid, p_order;

  -- 2. Stopy
  insert into public.order_stops (
    order_id, kind, sequence_no, date_local, time_local, location_id,
    location_name_snapshot, company_name_snapshot, address_snapshot, notes
  )
  select v_order_id, r.kind, r.sequence_no, r.date_local, r.time_local, r.location_id,
         r.location_name_snapshot, r.company_name_snapshot, r.address_snapshot, r.notes
    from jsonb_populate_recordset(null::public.order_stops, coalesce(p_stops, '[]'::jsonb)) r;

  -- 3. Towary
  insert into public.order_items (
    order_id, product_id, product_name_snapshot, default_loading_method_snapshot,
    loading_method_code, quantity_tons, notes
  )
  select v_order_id, r.product_id, r.product_name_snapshot, r.default_loading_method_snapshot,
         r.loading_method_code, r.quantity_tons, r.notes
    from jsonb_populate_recordset(null::public.order_items, coalesce(p_items, '[]'::jsonb)) r;

  -- 4. Historia statusów
  if p_status_history is not null then
    insert into public.order_status_history (order_id, old_status_code, new_status_code, changed_by_user_id)
    values (v_order_id, p_status_history ->> 'old_status_code', p_status_history ->> 'new_status_code', v_uid);
  end if;

  -- 5. Audit log
  insert into public.order_change_log (order_id, field_name, old_value, new_value, changed_by_user_id)
  select v_order_id, x.elem ->> 'field_name', x.elem ->> 'old_value', x.elem ->> 'new_value', v_uid
    from jsonb_array_elements(coalesce(p_change_log, '[]'::jsonb)) with ordinality as x(elem, ord)
   order by x.ord;

  return jsonb_build_object('id', v_order_id, 'created_at', v_created_at);
end;
$$;

comment on function public.create_order_with_children(jsonb, jsonb, jsonb, jsonb, jsonb) is
  'Atomowe utworzenie zlecenia ze stopami, towarami, historią statusu i audit logiem. SECURITY INVOKER + require_write_role.';

revoke all on function public.create_order_with_children(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_order_with_children(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
