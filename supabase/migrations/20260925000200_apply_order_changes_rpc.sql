-- =============================================================================
-- RPC apply_order_changes — atomowy zapis zmian zlecenia (jedna transakcja)
-- =============================================================================
-- Problem: updateOrder / patchStop zapisywały zlecenie w wielu osobnych requestach
-- (UPDATE zlecenia, DELETE/UPDATE/INSERT stopów i towarów, logi). Błąd w połowie
-- zostawiał zlecenie w stanie częściowo zapisanym (np. usunięte stopy bez nowych).
--
-- Rozwiązanie: backend liczy wszystko (snapshoty, denormalizację, audit log) jak dotąd,
-- a zapis wykonuje jednym wywołaniem tej funkcji. Funkcja plpgsql działa w jednej
-- transakcji — każdy błąd wycofuje całość.
--
-- Bezpieczeństwo:
--   - SECURITY INVOKER — obowiązuje RLS zalogowanego użytkownika (jak przy zapisie z backendu),
--   - require_write_role() — tylko ADMIN / PLANNER,
--   - blokada i status sprawdzane w WHERE (auth.uid(), p_expected_status) — brak TOCTOU;
--     p_ignore_lock = true tylko dla zmian statusu, które celowo nie wymagają blokady
--     (anulowanie, zmiana statusu, przywrócenie, wysyłka maila),
--   - kolumny dynamicznego UPDATE ograniczone białą listą (format %I).
--
-- Stopy/towary z "id" aktualizują tylko kolumny obecne w JSON; bez "id" — INSERT.
--
-- Zwraca: {"status": "OK", "updated_at": ...} lub {"status": "CONFLICT"}
-- (blokada innego użytkownika lub status zmieniony równolegle).
-- =============================================================================

create or replace function public.apply_order_changes(
  p_order_id uuid,
  p_expected_status text,
  p_order jsonb,
  p_stop_delete_ids uuid[] default '{}',
  p_stops jsonb default '[]'::jsonb,
  p_item_delete_ids uuid[] default '{}',
  p_items jsonb default '[]'::jsonb,
  p_change_log jsonb default '[]'::jsonb,
  p_status_history jsonb default null,
  p_ignore_lock boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  -- Kolumny transport_orders, które backend może aktualizować
  c_order_columns constant text[] := array[
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
    'transport_year', 'search_text', 'status_code', 'sent_at', 'sent_by_user_id'
  ];
  v_uid uuid := auth.uid();
  v_key text;
  v_set text := '';
  v_updated int;
  v_updated_at timestamptz;
begin
  perform public.require_write_role();

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'apply_order_changes: p_order must be a JSON object' using errcode = '22023';
  end if;

  -- 1. UPDATE zlecenia (dynamiczna lista kolumn z białej listy) + guard blokady i statusu
  for v_key in select jsonb_object_keys(p_order) loop
    if not (v_key = any (c_order_columns)) then
      raise exception 'apply_order_changes: column % is not allowed', v_key using errcode = '42501';
    end if;
    v_set := v_set || format('%I = r.%I, ', v_key, v_key);
  end loop;

  execute format(
    'update public.transport_orders t
        set %s updated_by_user_id = $1
       from jsonb_populate_record(null::public.transport_orders, $2) r
      where t.id = $3
        and ($5 or t.locked_by_user_id is null or t.locked_by_user_id = $1)
        and t.status_code = $4',
    v_set
  ) using v_uid, p_order, p_order_id, p_expected_status, coalesce(p_ignore_lock, false);

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('status', 'CONFLICT');
  end if;

  -- 2. Stopy: usunięcia
  delete from public.order_stops
   where order_id = p_order_id
     and id = any (coalesce(p_stop_delete_ids, '{}'));

  -- 3. Stopy: tymczasowe przesunięcie sequence_no istniejących, którym zmieniamy numer
  --    (UNIQUE (order_id, sequence_no) nie jest DEFERRABLE)
  update public.order_stops s
     set sequence_no = 10000 + x.ord
    from jsonb_array_elements(coalesce(p_stops, '[]'::jsonb)) with ordinality as x(elem, ord)
   where x.elem ->> 'id' is not null
     and x.elem ? 'sequence_no'
     and s.id = (x.elem ->> 'id')::uuid
     and s.order_id = p_order_id;

  -- 4. Stopy: wartości docelowe istniejących (tylko kolumny obecne w JSON — reszta bez zmian)
  update public.order_stops s
     set kind = case when x.elem ? 'kind' then r.kind else s.kind end,
         sequence_no = case when x.elem ? 'sequence_no' then r.sequence_no else s.sequence_no end,
         date_local = case when x.elem ? 'date_local' then r.date_local else s.date_local end,
         time_local = case when x.elem ? 'time_local' then r.time_local else s.time_local end,
         location_id = case when x.elem ? 'location_id' then r.location_id else s.location_id end,
         location_name_snapshot = case when x.elem ? 'location_name_snapshot' then r.location_name_snapshot else s.location_name_snapshot end,
         company_name_snapshot = case when x.elem ? 'company_name_snapshot' then r.company_name_snapshot else s.company_name_snapshot end,
         address_snapshot = case when x.elem ? 'address_snapshot' then r.address_snapshot else s.address_snapshot end,
         notes = case when x.elem ? 'notes' then r.notes else s.notes end
    from jsonb_array_elements(coalesce(p_stops, '[]'::jsonb)) as x(elem)
   cross join lateral jsonb_populate_record(null::public.order_stops, x.elem) r
   where r.id is not null
     and s.id = r.id
     and s.order_id = p_order_id;

  -- 5. Stopy: nowe
  insert into public.order_stops (
    order_id, kind, sequence_no, date_local, time_local, location_id,
    location_name_snapshot, company_name_snapshot, address_snapshot, notes
  )
  select p_order_id, r.kind, r.sequence_no, r.date_local, r.time_local, r.location_id,
         r.location_name_snapshot, r.company_name_snapshot, r.address_snapshot, r.notes
    from jsonb_populate_recordset(null::public.order_stops, coalesce(p_stops, '[]'::jsonb)) r
   where r.id is null;

  -- 6. Towary: usunięcia, aktualizacje, nowe
  delete from public.order_items
   where order_id = p_order_id
     and id = any (coalesce(p_item_delete_ids, '{}'));

  update public.order_items i
     set product_id = case when x.elem ? 'product_id' then r.product_id else i.product_id end,
         product_name_snapshot = case when x.elem ? 'product_name_snapshot' then r.product_name_snapshot else i.product_name_snapshot end,
         default_loading_method_snapshot = case when x.elem ? 'default_loading_method_snapshot' then r.default_loading_method_snapshot else i.default_loading_method_snapshot end,
         loading_method_code = case when x.elem ? 'loading_method_code' then r.loading_method_code else i.loading_method_code end,
         quantity_tons = case when x.elem ? 'quantity_tons' then r.quantity_tons else i.quantity_tons end,
         notes = case when x.elem ? 'notes' then r.notes else i.notes end
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as x(elem)
   cross join lateral jsonb_populate_record(null::public.order_items, x.elem) r
   where r.id is not null
     and i.id = r.id
     and i.order_id = p_order_id;

  insert into public.order_items (
    order_id, product_id, product_name_snapshot, default_loading_method_snapshot,
    loading_method_code, quantity_tons, notes
  )
  select p_order_id, r.product_id, r.product_name_snapshot, r.default_loading_method_snapshot,
         r.loading_method_code, r.quantity_tons, r.notes
    from jsonb_populate_recordset(null::public.order_items, coalesce(p_items, '[]'::jsonb)) r
   where r.id is null;

  -- 7. Historia statusów (auto-korekta)
  if p_status_history is not null then
    insert into public.order_status_history (order_id, old_status_code, new_status_code, changed_by_user_id)
    values (
      p_order_id,
      p_status_history ->> 'old_status_code',
      p_status_history ->> 'new_status_code',
      v_uid
    );
  end if;

  -- 8. Audit log (kolejność jak w tablicy)
  insert into public.order_change_log (order_id, field_name, old_value, new_value, changed_by_user_id)
  select p_order_id, x.elem ->> 'field_name', x.elem ->> 'old_value', x.elem ->> 'new_value', v_uid
    from jsonb_array_elements(coalesce(p_change_log, '[]'::jsonb)) with ordinality as x(elem, ord)
   order by x.ord;

  select updated_at into v_updated_at from public.transport_orders where id = p_order_id;

  return jsonb_build_object('status', 'OK', 'updated_at', v_updated_at);
end;
$$;

comment on function public.apply_order_changes(uuid, text, jsonb, uuid[], jsonb, uuid[], jsonb, jsonb, jsonb, boolean) is
  'Atomowy zapis zmian zlecenia (zlecenie, stopy, towary, historia statusu, audit log) w jednej transakcji. SECURITY INVOKER + require_write_role.';

revoke all on function public.apply_order_changes(uuid, text, jsonb, uuid[], jsonb, uuid[], jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.apply_order_changes(uuid, text, jsonb, uuid[], jsonb, uuid[], jsonb, jsonb, jsonb, boolean) to authenticated;
