-- ============================================================
-- MIGRACJA: Tabela liczników numerów zleceń (order_no_counters)
-- ============================================================
-- cel: naprawienie buga, w którym fizyczne usunięcie anulowanego
--      zlecenia z najwyższym numerem powodowało ponowne przydzielenie
--      tego samego numeru nowemu zleceniu.
--
-- root cause: generate_next_order_no() używała MAX(seq) z tabeli
--      transport_orders — po DELETE wiersza MAX się cofał.
--
-- fix: dedykowana tabela order_no_counters przechowuje ostatni
--      użyty numer per rok. Atomowy UPSERT gwarantuje, że licznik
--      nigdy się nie cofa, nawet po fizycznym usunięciu zleceń.
--
-- dotknięte obiekty:
--   - nowa tabela: public.order_no_counters
--   - zaktualizowana funkcja: public.generate_next_order_no()
--
-- brak zmian w kodzie TypeScript — sygnatura RPC bez zmian.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Tabela liczników
-- ------------------------------------------------------------

create table if not exists public.order_no_counters (
  year int primary key,
  last_seq int not null default 0
);

alter table public.order_no_counters enable row level security;

-- RLS: SELECT dla authenticated (potrzebne dla RPC SECURITY DEFINER)
create policy order_no_counters_select_authenticated
on public.order_no_counters
for select
to authenticated
using (true);

-- Brak policy INSERT/UPDATE/DELETE — dostęp tylko przez RPC (SECURITY DEFINER)

-- ------------------------------------------------------------
-- 2. Inicjalizacja z istniejących danych
-- ------------------------------------------------------------
-- Dla każdego roku obecnego w transport_orders, wstaw max seq.
-- ON CONFLICT zabezpiecza przed powtórnym uruchomieniem migracji.

insert into public.order_no_counters (year, last_seq)
select
  substring(order_no from '^ZT(\d{4})/')::int as yr,
  coalesce(max(substring(order_no from '/(\d+)$')::int), 0) as max_seq
from public.transport_orders
where order_no ~ '^ZT\d{4}/\d+$'
group by yr
on conflict (year) do update
  set last_seq = greatest(order_no_counters.last_seq, excluded.last_seq);

-- ------------------------------------------------------------
-- 3. Zaktualizowana generate_next_order_no()
-- ------------------------------------------------------------
-- Zmiany względem poprzedniej wersji:
--   - zamiast SELECT MAX(...) FROM transport_orders
--     → atomowy INSERT ... ON CONFLICT DO UPDATE na order_no_counters
--   - zachowany pg_advisory_xact_lock (dodatkowe zabezpieczenie)
--   - zachowany require_write_role() guard
--   - zachowany dynamiczny padding

create or replace function public.generate_next_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_prefix text := 'ZT' || v_year || '/';
  v_next_seq int;
  v_order_no text;
begin
  -- guard: wymagana rola ADMIN lub PLANNER
  perform public.require_write_role();

  -- advisory lock z kluczem na rok — serializuje równoczesne wywołania
  perform pg_advisory_xact_lock(hashtext('order_no_' || v_year::text));

  -- atomowy UPSERT: inkrementuj licznik lub utwórz nowy wiersz dla nowego roku
  insert into public.order_no_counters (year, last_seq)
  values (v_year, 1)
  on conflict (year) do update
    set last_seq = order_no_counters.last_seq + 1
  returning last_seq into v_next_seq;

  -- dynamiczny padding: min 4 cyfry, rośnie automatycznie powyżej 9999
  v_order_no := v_prefix || lpad(v_next_seq::text, greatest(4, length(v_next_seq::text)), '0');

  return v_order_no;
end;
$$;

-- uprawnienia: bez zmian — authenticated mogą wywoływać RPC
grant execute on function public.generate_next_order_no() to authenticated;

commit;
