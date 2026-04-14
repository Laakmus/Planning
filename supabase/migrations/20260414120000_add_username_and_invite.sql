-- ============================================================
-- Migracja: dodanie username + invite flow do user_profiles
-- ============================================================
-- Cel:
--   Wprowadzenie loginu (username) zamiast email do autentykacji
--   oraz mechanizmu aktywacji konta przez invite token (TTL 7 dni).
--   Login + hasło nadaje admin; user aktywuje konto klikając link.
--
-- Dotknięte obiekty:
--   - public.user_profiles (nowe kolumny: username, is_active,
--     invite_token_hash, invite_expires_at, invited_at, activated_at)
--   - nowe RLS policies dla ADMIN (SELECT/INSERT/UPDATE/DELETE)
--   - nowa funkcja RPC public.resolve_username_to_email(citext)
--
-- Uwagi:
--   - migracja jest idempotentna (IF NOT EXISTS, CREATE OR REPLACE)
--   - dla istniejących rekordów: backfill username z części email
--     przed '@' (lowercase), is_active = true, activated_at = now()
--     — żeby nie zablokować istniejącego admina.
--   - CITEXT zapewnia case-insensitive unikalność loginu.
--   - User NIE dostaje uprawnień UPDATE na swój profil — edycja
--     własnych pól (full_name, phone) będzie przez dedykowany
--     endpoint PATCH /auth/me/profile w Fazie A3a (walidacja Zod).
-- ============================================================

-- rozszerzenie case-insensitive text — wymagane dla username
create extension if not exists citext;

-- ------------------------------------------------------------
-- 1. nowe kolumny w user_profiles
-- ------------------------------------------------------------

-- username: login użytkownika (case-insensitive, unique)
alter table public.user_profiles
  add column if not exists username citext;

-- is_active: flaga aktywacji konta (domyślnie false dla nowych userów;
-- ustawiana na true po kliknięciu linku aktywacyjnego)
alter table public.user_profiles
  add column if not exists is_active boolean not null default false;

-- invite_token_hash: sha-256 hash tokenu aktywacyjnego
-- (plain token nigdy nie jest zapisywany — tylko hash)
alter table public.user_profiles
  add column if not exists invite_token_hash text null;

-- invite_expires_at: moment wygaśnięcia tokenu aktywacyjnego
alter table public.user_profiles
  add column if not exists invite_expires_at timestamptz null;

-- invited_at: moment wystawienia zaproszenia (ostatniego)
alter table public.user_profiles
  add column if not exists invited_at timestamptz null;

-- activated_at: moment aktywacji konta przez usera
alter table public.user_profiles
  add column if not exists activated_at timestamptz null;

-- komentarze kolumn (dokumentacja w bazie)
comment on column public.user_profiles.username is
  'Login użytkownika (case-insensitive, unique, 3-32 znaki: a-z 0-9 . _ -)';
comment on column public.user_profiles.is_active is
  'Czy konto jest aktywne. Nowi userzy: false; po aktywacji: true. Deaktywacja = false + signOut.';
comment on column public.user_profiles.invite_token_hash is
  'SHA-256 hash tokenu aktywacyjnego (hex). Plain token nigdy w DB — tylko hash.';
comment on column public.user_profiles.invite_expires_at is
  'Moment wygaśnięcia tokenu aktywacyjnego (TTL 7 dni od invited_at).';
comment on column public.user_profiles.invited_at is
  'Moment wystawienia ostatniego zaproszenia (ustawiany przy create/regenerate invite).';
comment on column public.user_profiles.activated_at is
  'Moment aktywacji konta przez usera (ustawiany po POST /auth/activate).';

-- ------------------------------------------------------------
-- 2. backfill dla istniejących rekordów
-- ------------------------------------------------------------
-- Strategia: username = split_part(email, '@', 1) w lowercase.
-- W razie kolizji (duplikaty) — dodajemy sufiks _2, _3, ...
-- Dla istniejących userów ustawiamy is_active=true i activated_at=now(),
-- żeby nie zablokować istniejącego admina (on już działa w systemie).

do $$
declare
  r record;
  base_username text;
  candidate text;
  suffix int;
begin
  for r in
    select id, email
    from public.user_profiles
    where username is null
    order by created_at asc
  loop
    -- bazowy username: część przed @ w lowercase, ograniczona do 32 znaków
    base_username := lower(split_part(r.email, '@', 1));
    -- sanityzacja: wymieniamy znaki nie pasujące do regexa na '_'
    base_username := regexp_replace(base_username, '[^a-z0-9._-]', '_', 'g');
    -- skrócenie jeśli za długie
    if length(base_username) > 32 then
      base_username := substring(base_username from 1 for 32);
    end if;
    -- zapewnienie minimum 3 znaków
    if length(base_username) < 3 then
      base_username := base_username || 'usr';
    end if;

    candidate := base_username;
    suffix := 2;
    -- collision-safe: jeśli duplikat, dodajemy _2, _3, ...
    while exists (select 1 from public.user_profiles where username = candidate::citext) loop
      candidate := base_username || '_' || suffix;
      suffix := suffix + 1;
    end loop;

    update public.user_profiles
       set username = candidate::citext,
           is_active = true,
           activated_at = now()
     where id = r.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. NOT NULL + UNIQUE + CHECK constraint
-- ------------------------------------------------------------

-- po backfillu wszystkie rekordy mają username — możemy wymusić NOT NULL
alter table public.user_profiles
  alter column username set not null;

-- unikalny indeks — CITEXT sam zapewnia case-insensitivity
create unique index if not exists user_profiles_username_key
  on public.user_profiles (username);

-- constraint formatu: 3-32 znaki, tylko a-z 0-9 . _ -
-- (CITEXT porównuje case-insensitive, ale i tak wymuszamy lowercase w regexie)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_username_format_chk'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_username_format_chk
      check (username::text ~ '^[a-z0-9._-]{3,32}$');
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. RLS policies — ADMIN pełny CRUD
-- ------------------------------------------------------------
-- Istniejąca polityka user_profiles_select_own pozostaje bez zmian
-- (user nadal widzi swój własny profil).
-- Dodajemy granularne polityki dla ADMIN — full access do zarządzania userami.
-- User NIE dostaje INSERT/UPDATE/DELETE — edycja przez endpointy backend.

-- SELECT dla ADMIN: może widzieć wszystkie profile (panel admina)
drop policy if exists user_profiles_select_admin on public.user_profiles;
create policy user_profiles_select_admin
on public.user_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  )
);
comment on policy user_profiles_select_admin on public.user_profiles is
  'ADMIN widzi wszystkie profile (panel /admin/users).';

-- INSERT dla ADMIN: tylko admin tworzy nowe konta
drop policy if exists user_profiles_insert_admin on public.user_profiles;
create policy user_profiles_insert_admin
on public.user_profiles
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  )
);
comment on policy user_profiles_insert_admin on public.user_profiles is
  'Tylko ADMIN tworzy nowe konta userów (panel admina / invite flow).';

-- UPDATE dla ADMIN: dowolny profil (w tym swój własny)
-- User nie ma UPDATE — edycja własnych pól przez dedykowany endpoint backend.
drop policy if exists user_profiles_update_admin on public.user_profiles;
create policy user_profiles_update_admin
on public.user_profiles
for update
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  )
);
comment on policy user_profiles_update_admin on public.user_profiles is
  'ADMIN modyfikuje dowolny profil (email, fullName, phone, role, isActive).';

-- DELETE dla ADMIN: hard delete (zwykle używamy miękkiej deaktywacji via is_active=false)
drop policy if exists user_profiles_delete_admin on public.user_profiles;
create policy user_profiles_delete_admin
on public.user_profiles
for delete
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  )
);
comment on policy user_profiles_delete_admin on public.user_profiles is
  'ADMIN może hard-delete profil (preferujemy miękką deaktywację przez is_active=false).';

-- ------------------------------------------------------------
-- 5. RPC: resolve_username_to_email
-- ------------------------------------------------------------
-- Używane przez endpoint POST /api/v1/auth/login:
--   1) frontend wysyła {username, password}
--   2) backend woła resolve_username_to_email(username) → {email, is_active}
--   3) backend woła supabase.auth.signInWithPassword({email, password})
--   4) backend sprawdza is_active=true przed zwróceniem tokenów.
--
-- SECURITY DEFINER — funkcja czyta user_profiles z uprawnieniami właściciela
-- (omija RLS), żeby móc działać dla anon (nie ma jeszcze sesji przy logowaniu).
-- Zwraca 0 rows dla nieistniejących userów (nie rzuca błędu).

create or replace function public.resolve_username_to_email(p_username citext)
returns table(email text, is_active boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select up.email::text, up.is_active
  from public.user_profiles up
  where up.username = p_username
  limit 1;
end;
$$;

comment on function public.resolve_username_to_email(citext) is
  'Mapuje username → email dla endpointu /auth/login. Zwraca też is_active. SECURITY DEFINER (omija RLS dla anon).';

-- uprawnienia: anon (logowanie bez sesji) + authenticated (re-login z sesją)
grant execute on function public.resolve_username_to_email(citext) to anon, authenticated;
