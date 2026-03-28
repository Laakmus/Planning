-- Migracja: dynamiczny padding numeru zlecenia
-- Format: ZT{rok}/{seq} — min 4 cyfry, auto-rozszerzenie powyżej 9999
-- Np. ZT2026/0001, ZT2026/9999, ZT2026/10000

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
