-- Migracja H-16: Funkcja RPC filter_order_ids
-- Zastępuje 5 osobnych sub-queries w order-list.service.ts jednym wywołaniem RPC.
-- Eliminuje limit 1000 wierszy PostgREST przy filtrach po product/location/company.

-- Indeks kompozytowy na order_stops(kind, location_id)
-- Istniejące indeksy: order_stops_order_id_idx, order_stops_location_id_idx
-- Ten indeks obsługuje filtry WHERE kind = '...' AND location_id = '...' jednym skanem
create index if not exists order_stops_kind_location_id_idx
  on public.order_stops (kind, location_id);

-- Funkcja filter_order_ids: zwraca order_id spełniające WSZYSTKIE podane filtry (AND)
-- Parametry NULL są ignorowane (nie filtrują)
-- SECURITY INVOKER — RLS na tabelach nadal obowiązuje
create or replace function public.filter_order_ids(
  p_product_id uuid default null,
  p_loading_location_id uuid default null,
  p_unloading_location_id uuid default null,
  p_loading_company_id uuid default null,
  p_unloading_company_id uuid default null
)
returns table(order_id uuid)
language sql
stable
security invoker
as $$
  select t.id as order_id
  from public.transport_orders t
  where
    -- Filtr: produkt (exists w order_items)
    (p_product_id is null or exists (
      select 1 from public.order_items oi
      where oi.order_id = t.id
        and oi.product_id = p_product_id
    ))
    -- Filtr: lokalizacja załadunku
    and (p_loading_location_id is null or exists (
      select 1 from public.order_stops os
      where os.order_id = t.id
        and os.kind = 'LOADING'
        and os.location_id = p_loading_location_id
    ))
    -- Filtr: lokalizacja rozładunku
    and (p_unloading_location_id is null or exists (
      select 1 from public.order_stops os
      where os.order_id = t.id
        and os.kind = 'UNLOADING'
        and os.location_id = p_unloading_location_id
    ))
    -- Filtr: firma załadunku (przez locations.company_id)
    and (p_loading_company_id is null or exists (
      select 1 from public.order_stops os
      join public.locations l on l.id = os.location_id
      where os.order_id = t.id
        and os.kind = 'LOADING'
        and l.company_id = p_loading_company_id
    ))
    -- Filtr: firma rozładunku (przez locations.company_id)
    and (p_unloading_company_id is null or exists (
      select 1 from public.order_stops os
      join public.locations l on l.id = os.location_id
      where os.order_id = t.id
        and os.kind = 'UNLOADING'
        and l.company_id = p_unloading_company_id
    ))
  ;
$$;

-- Komentarz na funkcji
comment on function public.filter_order_ids(uuid, uuid, uuid, uuid, uuid)
  is 'Zwraca order_id zleceń spełniających wszystkie podane filtry (product, loading/unloading location/company). Parametry NULL są pomijane. Używane przez listOrders zamiast osobnych sub-queries.';
