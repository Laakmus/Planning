-- ============================================================
-- Migracja: naprawa rekursji RLS w policies user_profiles
-- ============================================================
-- Cel:
--   Policies dodane w 20260414120000_add_username_and_invite.sql używały
--   subquery `EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid()
--   AND p.role = 'ADMIN')` w policies NA tej samej tabeli user_profiles.
--   To klasyczny Supabase anti-pattern — Postgres może rzucić
--   `infinite recursion detected in policy for relation "user_profiles"`.
--
-- Naprawa:
--   - Utworzyć SECURITY DEFINER function `public.is_admin(uid)` omijającą RLS.
--   - Zastąpić EXISTS w 4 policies wywołaniem is_admin(auth.uid()).
-- ============================================================

-- ------------------------------------------------------------
-- 1. SECURITY DEFINER helper — is_admin(uid) omija RLS
-- ------------------------------------------------------------

create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = p_uid and role = 'ADMIN'
  );
$$;

comment on function public.is_admin(uuid) is
  'Zwraca true jeśli user o danym uid ma rolę ADMIN. SECURITY DEFINER — omija RLS, zapobiega rekursji w policies user_profiles.';

grant execute on function public.is_admin(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Podmiana policies user_profiles na wersje bez rekursji
-- ------------------------------------------------------------

drop policy if exists user_profiles_select_admin on public.user_profiles;
create policy user_profiles_select_admin
on public.user_profiles
for select
to authenticated
using (public.is_admin(auth.uid()));
comment on policy user_profiles_select_admin on public.user_profiles is
  'ADMIN widzi wszystkie profile (panel /admin/users). Używa is_admin() — bez rekursji.';

drop policy if exists user_profiles_insert_admin on public.user_profiles;
create policy user_profiles_insert_admin
on public.user_profiles
for insert
to authenticated
with check (public.is_admin(auth.uid()));
comment on policy user_profiles_insert_admin on public.user_profiles is
  'Tylko ADMIN tworzy nowe konta userów. Używa is_admin() — bez rekursji.';

drop policy if exists user_profiles_update_admin on public.user_profiles;
create policy user_profiles_update_admin
on public.user_profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
comment on policy user_profiles_update_admin on public.user_profiles is
  'ADMIN modyfikuje dowolny profil. Używa is_admin() — bez rekursji.';

drop policy if exists user_profiles_delete_admin on public.user_profiles;
create policy user_profiles_delete_admin
on public.user_profiles
for delete
to authenticated
using (public.is_admin(auth.uid()));
comment on policy user_profiles_delete_admin on public.user_profiles is
  'ADMIN może hard-delete profil. Używa is_admin() — bez rekursji.';
