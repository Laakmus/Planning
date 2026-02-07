-- cel: początkowy schemat domeny planowania transportu
-- szczegóły:
-- - tworzy kluczowe tabele domenowe:
--   - user_profiles (profile użytkowników nad supabase auth.users)
--   - companies, locations, products (słowniki firm, lokalizacji i towarów)
--   - transport_types, order_statuses, vehicle_variants (słowniki pomocnicze)
--   - transport_orders, order_stops, order_items (tabele operacyjne)
--   - order_status_history, order_change_log (tabele audytowe/logi)
-- - dodaje klucze główne, obce, ograniczenia check i indeksy zgodnie z db-plan.md
-- - włącza row level security (rls) na wszystkich tabelach
-- - definiuje polityki rls:
--   - użytkownicy authenticated mogą czytać wszystkie dane
--   - tylko użytkownicy z rolą ('ADMIN','PLANNER') w user_profiles.role
--     mogą modyfikować tabele domenowe i słownikowe
--   - user_profiles jest czytane tylko przez aktualnego użytkownika (id = auth.uid())
-- - dodaje funkcję pomocniczą i triggery: utrzymanie updated_at oraz ochrona order_no
--
-- uwagi:
-- - ta migracja nie implementuje jeszcze wszystkich zaawansowanych triggerów biznesowych
--   (np. szczegółowych ograniczeń edycji dla statusów nieedytowalnych);
--   takie triggery można dodać w kolejnych migracjach w tej samej konwencji.

begin;

-- ============================================================
-- 1. rozszerzenia i search_path
-- ============================================================

-- funkcja gen_random_uuid() jest używana do generowania kluczy głównych
create extension if not exists "pgcrypto";

-- upewniamy się, że domyślnie pracujemy w schemacie public
set search_path to public;

-- ============================================================
-- 2. tabele podstawowe
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 user_profiles – profile użytkowników aplikacji nad auth.users
-- ------------------------------------------------------------

create table public.user_profiles (
  id uuid primary key,
  email varchar(320) not null unique,
  full_name varchar(200),
  phone varchar(100),
  role text not null check (role in ('ADMIN','PLANNER','READ_ONLY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- rls musi być włączone na każdej nowej tabeli
alter table public.user_profiles enable row level security;

-- rls: użytkownicy authenticated mogą odczytać tylko swój własny profil (id = auth.uid()).
-- zapis (insert/update/delete) zakładamy przez service_role / ścieżki administracyjne,
-- nie wystawiamy go bezpośrednio dla zwykłych klientów authenticated w tej migracji.

create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

-- brak polityk insert/update/delete dla roli authenticated:
-- domyślnie tylko service_role / uprzywilejowane role mogą modyfikować user_profiles.

-- ============================================================
-- 3. funkcja pomocnicza do sprawdzania roli w rls
-- ============================================================

-- funkcja pomocnicza używana w politykach rls do sprawdzania,
-- czy bieżący uwierzytelniony użytkownik może zapisywać w tabelach domenowych
-- na podstawie kolumny user_profiles.role.
-- implementacja jest celowo prosta i używa jedynie auth.uid() oraz user_profiles.

create or replace function public.current_user_is_admin_or_planner()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.role in ('ADMIN','PLANNER')
  );
$$;

-- ------------------------------------------------------------
-- 2.2 companies – firmy (przewoźnicy, nadawcy, odbiorcy, wewnętrzne)
-- ------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  erp_id text,
  name varchar(500) not null,
  type text,
  tax_id varchar(50),
  notes varchar(500),
  is_active boolean not null default true
);

-- częściowy unikalny indeks na erp_id, gdy nie jest null
create unique index companies_erp_id_uq
  on public.companies (erp_id)
  where erp_id is not null;

-- indeks przyspieszający wyszukiwanie po nazwie
create index companies_name_idx
  on public.companies (name);

alter table public.companies enable row level security;

-- rls: użytkownicy authenticated mogą czytać wszystkie firmy
create policy companies_select_all_authenticated
on public.companies
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą dodawać i modyfikować firmy
create policy companies_insert_admin_planner
on public.companies
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy companies_update_admin_planner
on public.companies
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy companies_delete_admin_planner
on public.companies
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.3 locations – lokalizacje / oddziały firm / miejsca załadunku i rozładunku
-- ------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  erp_id text,
  company_id uuid not null references public.companies(id) on delete restrict,
  name varchar(500) not null,
  country varchar(100) not null,
  city varchar(200) not null,
  street_and_number varchar(200) not null,
  postal_code varchar(20) not null,
  notes varchar(500),
  is_active boolean not null default true
);

-- częściowy unikalny indeks na erp_id, gdy nie jest null
create unique index locations_erp_id_uq
  on public.locations (erp_id)
  where erp_id is not null;

-- indeks do szybkiego wyszukiwania lokalizacji w ramach firmy
create index locations_company_name_idx
  on public.locations (company_id, name);

-- indeks do wyszukiwania po mieście i kraju
create index locations_city_country_idx
  on public.locations (city, country);

alter table public.locations enable row level security;

-- rls: authenticated mogą czytać wszystkie lokalizacje
create policy locations_select_all_authenticated
on public.locations
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do locations
create policy locations_insert_admin_planner
on public.locations
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy locations_update_admin_planner
on public.locations
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy locations_delete_admin_planner
on public.locations
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.4 products – towary z domyślnym sposobem załadunku
-- ------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  erp_id text,
  name varchar(500) not null,
  description varchar(500),
  default_loading_method_code text not null check (
    default_loading_method_code in ('PALETA','PALETA_BIGBAG','LUZEM','KOSZE')
  ),
  is_active boolean not null default true
);

-- częściowy unikalny indeks na erp_id, gdy nie jest null
create unique index products_erp_id_uq
  on public.products (erp_id)
  where erp_id is not null;

-- indeks do wyszukiwania towarów po nazwie
create index products_name_idx
  on public.products (name);

alter table public.products enable row level security;

-- rls: authenticated mogą czytać wszystkie produkty
create policy products_select_all_authenticated
on public.products
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do products
create policy products_insert_admin_planner
on public.products
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy products_update_admin_planner
on public.products
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy products_delete_admin_planner
on public.products
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.5 transport_types – typy transportu
-- ------------------------------------------------------------

create table public.transport_types (
  code text primary key,
  name varchar(200) not null,
  description varchar(500),
  is_active boolean not null default true
);

alter table public.transport_types enable row level security;

-- rls: authenticated mogą czytać wszystkie typy transportu
create policy transport_types_select_all_authenticated
on public.transport_types
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do transport_types
create policy transport_types_insert_admin_planner
on public.transport_types
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy transport_types_update_admin_planner
on public.transport_types
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy transport_types_delete_admin_planner
on public.transport_types
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.6 order_statuses – słownik statusów zleceń
-- ------------------------------------------------------------

create table public.order_statuses (
  code text primary key,
  name varchar(200) not null,
  view_group text not null,
  is_editable boolean not null,
  sort_order smallint
);

alter table public.order_statuses enable row level security;

-- rls: authenticated mogą czytać wszystkie statusy
create policy order_statuses_select_all_authenticated
on public.order_statuses
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do order_statuses
create policy order_statuses_insert_admin_planner
on public.order_statuses
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy order_statuses_update_admin_planner
on public.order_statuses
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy order_statuses_delete_admin_planner
on public.order_statuses
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.7 vehicle_variants – warianty pojazdów i ich ładowności
-- ------------------------------------------------------------

create table public.vehicle_variants (
  code text primary key,
  name varchar(200) not null,
  vehicle_type varchar(100) not null,
  capacity_tons numeric(12,3) not null check (capacity_tons > 0),
  description varchar(500),
  is_active boolean not null default true
);

alter table public.vehicle_variants enable row level security;

-- rls: authenticated mogą czytać wszystkie warianty pojazdów
create policy vehicle_variants_select_all_authenticated
on public.vehicle_variants
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do vehicle_variants
create policy vehicle_variants_insert_admin_planner
on public.vehicle_variants
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy vehicle_variants_update_admin_planner
on public.vehicle_variants
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy vehicle_variants_delete_admin_planner
on public.vehicle_variants
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.8 transport_orders – nagłówek zlecenia transportowego
-- ------------------------------------------------------------

create table public.transport_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null,
  status_code text not null references public.order_statuses(code),
  transport_type_code text not null references public.transport_types(code),
  currency_code text not null check (currency_code in ('PLN','EUR','USD')),
  price_amount numeric(12,2),
  total_load_tons numeric(12,3),
  summary_route varchar(500),
  first_loading_date date,
  first_loading_time time without time zone,
  first_unloading_date date,
  first_unloading_time time without time zone,
  transport_year integer,
  first_loading_country text,
  first_unloading_country text,
  carrier_company_id uuid references public.companies(id) on delete restrict,
  carrier_name_snapshot varchar(500),
  carrier_location_name_snapshot varchar(500),
  carrier_address_snapshot varchar(500),
  shipper_location_id uuid references public.locations(id) on delete restrict,
  shipper_name_snapshot varchar(500),
  shipper_address_snapshot varchar(500),
  receiver_location_id uuid references public.locations(id) on delete restrict,
  receiver_name_snapshot varchar(500),
  receiver_address_snapshot varchar(500),
  vehicle_variant_code text not null references public.vehicle_variants(code),
  required_documents_text varchar(500),
  general_notes varchar(500),
  complaint_reason varchar(500),
  sender_contact_name varchar(200),
  sender_contact_phone varchar(100),
  sender_contact_email varchar(320),
  search_text text,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references public.user_profiles(id),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references public.user_profiles(id),
  locked_by_user_id uuid references public.user_profiles(id),
  locked_at timestamptz
);

-- unikalny biznesowy numer zlecenia
create unique index transport_orders_order_no_uq
  on public.transport_orders (order_no);

-- indeksy wspierające najczęstsze filtry
create index transport_orders_status_code_idx
  on public.transport_orders (status_code);

create index transport_orders_transport_type_code_idx
  on public.transport_orders (transport_type_code);

create index transport_orders_carrier_company_id_idx
  on public.transport_orders (carrier_company_id);

create index transport_orders_first_loading_date_order_no_idx
  on public.transport_orders (first_loading_date, order_no);

create index transport_orders_transport_type_first_loading_date_idx
  on public.transport_orders (transport_type_code, first_loading_date);

-- opcjonalny indeks pełnotekstowy na search_vector (tsvector jest natywnie w postgresql)
create index transport_orders_search_vector_gin_idx
  on public.transport_orders using gin (search_vector);

alter table public.transport_orders enable row level security;

-- rls: wszyscy authenticated mogą czytać wszystkie zlecenia
create policy transport_orders_select_all_authenticated
on public.transport_orders
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą dodawać / edytować / usuwać zlecenia
create policy transport_orders_insert_admin_planner
on public.transport_orders
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy transport_orders_update_admin_planner
on public.transport_orders
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy transport_orders_delete_admin_planner
on public.transport_orders
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.9 order_stops – punkty trasy (załadunek / rozładunek)
-- ------------------------------------------------------------

create table public.order_stops (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.transport_orders(id) on delete cascade,
  kind text not null check (kind in ('LOADING','UNLOADING')),
  sequence_no smallint not null,
  date_local date,
  time_local time without time zone,
  location_id uuid references public.locations(id) on delete restrict,
  location_name_snapshot varchar(500),
  company_name_snapshot varchar(500),
  address_snapshot varchar(500),
  notes varchar(500),
  constraint order_stops_order_sequence_uq unique (order_id, sequence_no)
);

create index order_stops_order_id_idx
  on public.order_stops (order_id);

create index order_stops_location_id_idx
  on public.order_stops (location_id);

alter table public.order_stops enable row level security;

-- rls: authenticated mogą czytać wszystkie punkty trasy
create policy order_stops_select_all_authenticated
on public.order_stops
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do order_stops
create policy order_stops_insert_admin_planner
on public.order_stops
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy order_stops_update_admin_planner
on public.order_stops
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy order_stops_delete_admin_planner
on public.order_stops
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.10 order_items – pozycje towarowe w zleceniu
-- ------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.transport_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  product_name_snapshot varchar(500),
  default_loading_method_snapshot varchar(100),
  quantity_tons numeric(12,3),
  notes varchar(500),
  constraint order_items_quantity_tons_chk
    check (quantity_tons is null or quantity_tons >= 0)
);

create index order_items_order_id_idx
  on public.order_items (order_id);

create index order_items_product_id_idx
  on public.order_items (product_id);

alter table public.order_items enable row level security;

-- rls: authenticated mogą czytać wszystkie pozycje towarowe
create policy order_items_select_all_authenticated
on public.order_items
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do order_items
create policy order_items_insert_admin_planner
on public.order_items
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy order_items_update_admin_planner
on public.order_items
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy order_items_delete_admin_planner
on public.order_items
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.11 order_status_history – historia zmian statusów zleceń
-- ------------------------------------------------------------

create table public.order_status_history (
  id bigserial primary key,
  order_id uuid not null references public.transport_orders(id) on delete cascade,
  old_status_code text not null references public.order_statuses(code),
  new_status_code text not null references public.order_statuses(code),
  changed_by_user_id uuid not null references public.user_profiles(id),
  changed_at timestamptz not null default now()
);

create index order_status_history_order_changed_at_idx
  on public.order_status_history (order_id, changed_at);

alter table public.order_status_history enable row level security;

-- rls: authenticated mogą czytać historię zmian statusów
create policy order_status_history_select_all_authenticated
on public.order_status_history
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do order_status_history
create policy order_status_history_insert_admin_planner
on public.order_status_history
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy order_status_history_update_admin_planner
on public.order_status_history
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy order_status_history_delete_admin_planner
on public.order_status_history
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ------------------------------------------------------------
-- 3.12 order_change_log – dziennik zmian pól w zleceniu
-- ------------------------------------------------------------

create table public.order_change_log (
  id bigserial primary key,
  order_id uuid not null references public.transport_orders(id) on delete cascade,
  field_name varchar(100) not null,
  old_value text,
  new_value text,
  changed_by_user_id uuid not null references public.user_profiles(id),
  changed_at timestamptz not null default now()
);

create index order_change_log_order_changed_at_idx
  on public.order_change_log (order_id, changed_at);

alter table public.order_change_log enable row level security;

-- rls: authenticated mogą czytać dziennik zmian
create policy order_change_log_select_all_authenticated
on public.order_change_log
for select
to authenticated
using (true);

-- rls: tylko ADMIN/PLANNER mogą pisać do order_change_log
create policy order_change_log_insert_admin_planner
on public.order_change_log
for insert
to authenticated
with check (public.current_user_is_admin_or_planner());

create policy order_change_log_update_admin_planner
on public.order_change_log
for update
to authenticated
using (public.current_user_is_admin_or_planner())
with check (public.current_user_is_admin_or_planner());

create policy order_change_log_delete_admin_planner
on public.order_change_log
for delete
to authenticated
using (public.current_user_is_admin_or_planner());

-- ============================================================
-- 4. triggery ogólne
-- ============================================================

-- funkcja triggera pomocniczego, która na update ustawia updated_at na bieżący czas

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- podpięcie triggera updated_at do tabel, które mają kolumnę updated_at

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

create trigger set_transport_orders_updated_at
before update on public.transport_orders
for each row
execute function public.set_updated_at();

-- ochrona biznesowego numeru zlecenia order_no przed zmianą po wstawieniu

create or replace function public.prevent_transport_order_no_change()
returns trigger
language plpgsql
as $$
begin
  if new.order_no is distinct from old.order_no then
    raise exception 'order_no is immutable and cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger transport_orders_order_no_immutable
before update on public.transport_orders
for each row
execute function public.prevent_transport_order_no_change();

-- uwaga:
-- bardziej zaawansowane triggery biznesowe (np. blokowanie edycji zleceń
-- ze statusem zrealizowany/anulowany) można dodać w osobnych migracjach,
-- zgodnie ze szczegółowym opisem w dokumencie db-plan.

commit;

