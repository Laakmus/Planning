-- =============================================================================
-- Testy integracyjne RPC zapisu zleceń (apply_order_changes, create_order_with_children)
-- =============================================================================
-- Uruchomienie (lokalny Supabase po `supabase db reset`):
--   docker exec -i supabase_db_Planning psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/order_rpc_test.sql
--
-- Całość w transakcji zakończonej ROLLBACK — nie zmienia danych.
-- Każdy test kończy się `assert`; błąd = przerwanie skryptu z komunikatem.
-- Wymaga danych z supabase/seed.sql (admin c94a20d0-..., zlecenie d0000000-...-0008 w statusie robocze, 4 stopy).
-- =============================================================================

begin;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c94a20d0-16ca-4f9d-873a-05f31be633ff","role":"authenticated"}',
  true
);

do $$
declare
  c_order constant uuid := 'd0000000-0000-0000-0000-000000000008';
  v_ids uuid[];
  v_item uuid;
  v_res jsonb;
  v_before_notes text;
  v_count int;
  v_new_id uuid;
begin
  select array_agg(id order by sequence_no) into v_ids from order_stops where order_id = c_order;
  select id into v_item from order_items where order_id = c_order limit 1;
  assert array_length(v_ids, 1) >= 4, 'seed: zlecenie 0008 powinno mieć min. 4 stopy';

  -- T1: zmiana kolejności + usunięcie + nowy stop + zmiana towaru + log
  v_res := public.apply_order_changes(
    c_order, 'robocze',
    '{"general_notes":"T1"}'::jsonb,
    array[v_ids[3]],
    jsonb_build_array(
      jsonb_build_object('id', v_ids[1], 'sequence_no', 1),
      jsonb_build_object('id', v_ids[2], 'sequence_no', 3),
      jsonb_build_object('id', null, 'kind', 'LOADING', 'sequence_no', 2, 'company_name_snapshot', 'NOWY'),
      jsonb_build_object('id', v_ids[4], 'sequence_no', 4)
    ),
    '{}',
    jsonb_build_array(jsonb_build_object('id', v_item, 'quantity_tons', 12.5)),
    '[{"field_name":"general_notes","old_value":null,"new_value":"T1"}]'::jsonb
  );
  assert v_res ->> 'status' = 'OK', 'T1: oczekiwano OK, jest ' || v_res::text;
  assert (select count(*) from order_stops where order_id = c_order) = 4, 'T1: liczba stopów';
  assert (select company_name_snapshot from order_stops where order_id = c_order and sequence_no = 2) = 'NOWY', 'T1: nowy stop';
  assert (select id from order_stops where order_id = c_order and sequence_no = 3) = v_ids[2], 'T1: przesunięty stop';
  assert (select company_name_snapshot from order_stops where id = v_ids[1]) is not null, 'T1: częściowy update nie może czyścić snapshotu';
  assert (select quantity_tons from order_items where id = v_item) = 12.5, 'T1: towar';
  assert (select changed_by_user_id from order_change_log where order_id = c_order and new_value = 'T1')
         = 'c94a20d0-16ca-4f9d-873a-05f31be633ff', 'T1: autor logu = auth.uid()';

  -- T2: błąd w połowie → nic się nie zapisuje
  select general_notes into v_before_notes from transport_orders where id = c_order;
  begin
    perform public.apply_order_changes(
      c_order, 'robocze', '{"general_notes":"T2"}'::jsonb,
      (select array_agg(id) from order_stops where order_id = c_order),
      '[]'::jsonb, '{}', '[{"product_name_snapshot":"X","loading_method_code":"ZLY"}]'::jsonb
    );
    assert false, 'T2: oczekiwano wyjątku';
  exception when check_violation then
    null;
  end;
  assert (select general_notes from transport_orders where id = c_order) = v_before_notes, 'T2: rollback zlecenia';
  assert (select count(*) from order_stops where order_id = c_order) = 4, 'T2: rollback stopów';

  -- T3: zły oczekiwany status → CONFLICT
  v_res := public.apply_order_changes(c_order, 'wysłane', '{"general_notes":"x"}'::jsonb);
  assert v_res ->> 'status' = 'CONFLICT', 'T3: oczekiwano CONFLICT';

  -- T4: kolumna spoza białej listy → wyjątek
  begin
    perform public.apply_order_changes(c_order, 'robocze', '{"order_no":"HACK"}'::jsonb);
    assert false, 'T4: oczekiwano wyjątku';
  exception when insufficient_privilege then
    null;
  end;

  -- T5: create_order_with_children — created_by = auth.uid(), dzieci w tej samej transakcji
  v_res := public.create_order_with_children(
    '{"order_no":"TEST/9999","status_code":"robocze","transport_type_code":"PL","currency_code":"PLN","created_by_user_id":"00000000-0000-0000-0000-000000000000"}'::jsonb,
    '[{"kind":"LOADING","sequence_no":1},{"kind":"UNLOADING","sequence_no":2}]'::jsonb,
    '[{"product_name_snapshot":"Złom","quantity_tons":3}]'::jsonb,
    '[{"field_name":"order_created","old_value":null,"new_value":"TEST/9999"}]'::jsonb
  );
  v_new_id := (v_res ->> 'id')::uuid;
  assert (select created_by_user_id from transport_orders where id = v_new_id)
         = 'c94a20d0-16ca-4f9d-873a-05f31be633ff', 'T5: created_by = auth.uid()';
  assert (select count(*) from order_stops where order_id = v_new_id) = 2, 'T5: stopy';
  assert (select count(*) from order_items where order_id = v_new_id) = 1, 'T5: towary';

  -- T6: błąd przy tworzeniu → brak osieroconego zlecenia
  begin
    perform public.create_order_with_children(
      '{"order_no":"TEST/9998","status_code":"robocze","transport_type_code":"PL","currency_code":"PLN"}'::jsonb,
      '[]'::jsonb, '[{"loading_method_code":"ZLY"}]'::jsonb
    );
    assert false, 'T6: oczekiwano wyjątku';
  exception when check_violation then
    null;
  end;
  select count(*) into v_count from transport_orders where order_no = 'TEST/9998';
  assert v_count = 0, 'T6: osierocone zlecenie';

  raise notice 'order_rpc_test: wszystkie testy OK';
end;
$$;

rollback;
