-- =============================================================================
-- Migracja: add_ms_oauth_tokens
-- Data:    2026-04-14
-- Cel:     Dodanie tabeli `ms_oauth_tokens` przechowującej zaszyfrowane tokeny
--          Microsoft Graph (access + refresh) per użytkownik aplikacji.
--          Szyfrowanie realizowane przez pgcrypto (pgp_sym_encrypt/decrypt)
--          z kluczem przekazywanym z backendu (env APP_ENCRYPTION_KEY).
-- Dotknięte obiekty:
--   - CREATE EXTENSION: pgcrypto, citext (idempotentnie)
--   - CREATE TABLE: public.ms_oauth_tokens
--   - CREATE INDEX: idx_ms_oauth_tokens_ms_user_id
--   - CREATE TRIGGER: set_ms_oauth_tokens_updated_at
--   - CREATE POLICY: 4 polityki RLS (SELECT/INSERT/UPDATE/DELETE dla własnych tokenów)
--   - CREATE FUNCTION: encrypt_ms_token, decrypt_ms_token (SECURITY DEFINER)
-- Uwagi:
--   - Admin celowo NIE ma uprawnień do czytania cudzych tokenów (prywatność).
--     Backend używający service_role omija RLS, więc operacje serwerowe działają bez policy dla ADMIN.
--   - Kolumna `user_id` jest PK — każdy user ma maksymalnie jeden rekord tokenów MS.
--   - `ms_email` używa typu CITEXT (case-insensitive), zgodnie z konwencją z migracji A2.
-- =============================================================================

-- rozszerzenia wymagane przez migrację (idempotentne)
create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- tabela ms_oauth_tokens
-- -----------------------------------------------------------------------------
create table if not exists public.ms_oauth_tokens (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  access_token_encrypted bytea not null,
  refresh_token_encrypted bytea not null,
  expires_at timestamptz not null,
  scope text not null,
  ms_user_id text not null,
  ms_email citext not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- komentarze kolumn (po polsku) — wyjaśniają cel każdej kolumny
comment on table public.ms_oauth_tokens is
  'Tokeny OAuth Microsoft Graph (access/refresh) per użytkownik. Tokeny zaszyfrowane symetrycznie (pgcrypto). Klucz po stronie backendu (env APP_ENCRYPTION_KEY).';
comment on column public.ms_oauth_tokens.user_id is
  'FK do user_profiles.id — właściciel tokenów. PK: każdy user ma maks. jeden rekord MS.';
comment on column public.ms_oauth_tokens.access_token_encrypted is
  'Zaszyfrowany access_token Microsoft (pgp_sym_encrypt). Do odszyfrowania backend przekazuje klucz z env.';
comment on column public.ms_oauth_tokens.refresh_token_encrypted is
  'Zaszyfrowany refresh_token Microsoft. Używany do odświeżenia access_token po wygaśnięciu.';
comment on column public.ms_oauth_tokens.expires_at is
  'Moment wygaśnięcia access_token (UTC). Po tej dacie backend musi odświeżyć token przez refresh_token.';
comment on column public.ms_oauth_tokens.scope is
  'Lista przyznanych scope-ów Microsoft Graph (np. "Mail.ReadWrite User.Read offline_access"), spacjami rozdzielona.';
comment on column public.ms_oauth_tokens.ms_user_id is
  'Identyfikator użytkownika w Entra ID (claim "oid" lub "sub"). Do weryfikacji ciągłości konta.';
comment on column public.ms_oauth_tokens.ms_email is
  'Adres email powiązany z kontem MS (case-insensitive, citext). Wyświetlany w UI "Połączono jako …".';
comment on column public.ms_oauth_tokens.created_at is
  'Data pierwszego połączenia konta Microsoft.';
comment on column public.ms_oauth_tokens.updated_at is
  'Data ostatniej aktualizacji tokenów (refresh lub ponowne połączenie). Aktualizowane triggerem.';

-- indeks do lookup po identyfikatorze użytkownika MS (np. przy callbacku OAuth)
create index if not exists idx_ms_oauth_tokens_ms_user_id
  on public.ms_oauth_tokens (ms_user_id);

-- -----------------------------------------------------------------------------
-- trigger: auto-update kolumny updated_at
-- używa istniejącej funkcji public.set_updated_at() z consolidated_schema
-- -----------------------------------------------------------------------------
drop trigger if exists set_ms_oauth_tokens_updated_at on public.ms_oauth_tokens;
create trigger set_ms_oauth_tokens_updated_at
  before update on public.ms_oauth_tokens
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — włączone. User ma dostęp wyłącznie do własnych tokenów.
-- Admin celowo NIE ma policy — tokeny innych userów nie powinny być widoczne
-- w UI/PostgREST. Operacje backendowe używają service_role (omija RLS).
-- -----------------------------------------------------------------------------
alter table public.ms_oauth_tokens enable row level security;

-- SELECT: user widzi tylko własne tokeny (identyfikacja po auth.uid())
drop policy if exists ms_oauth_tokens_select_own on public.ms_oauth_tokens;
create policy ms_oauth_tokens_select_own
  on public.ms_oauth_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

-- INSERT: user może zapisać tokeny wyłącznie dla siebie (anti-spoofing)
drop policy if exists ms_oauth_tokens_insert_own on public.ms_oauth_tokens;
create policy ms_oauth_tokens_insert_own
  on public.ms_oauth_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- UPDATE: user może aktualizować wyłącznie własne tokeny (np. po refresh)
drop policy if exists ms_oauth_tokens_update_own on public.ms_oauth_tokens;
create policy ms_oauth_tokens_update_own
  on public.ms_oauth_tokens
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: user może usunąć wyłącznie własne tokeny (rozłączenie konta MS)
drop policy if exists ms_oauth_tokens_delete_own on public.ms_oauth_tokens;
create policy ms_oauth_tokens_delete_own
  on public.ms_oauth_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Funkcje pomocnicze: encrypt/decrypt tokenów MS
-- Klucz przekazywany z backendu (env APP_ENCRYPTION_KEY, min 16 znaków).
-- SECURITY DEFINER — wykonują się z uprawnieniami właściciela funkcji.
-- -----------------------------------------------------------------------------
create or replace function public.encrypt_ms_token(p_plain text, p_key text)
returns bytea
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- walidacja: odmawiamy szyfrowania pustego tekstu (z reguły błąd wywołującego)
  if p_plain is null or length(p_plain) = 0 then
    raise exception 'encrypt_ms_token: empty plaintext';
  end if;
  -- klucz musi mieć rozsądną długość — krótki klucz = łatwe złamanie
  if p_key is null or length(p_key) < 16 then
    raise exception 'encrypt_ms_token: key must be at least 16 chars';
  end if;
  -- pgp_sym_encrypt zwraca bytea z ciphertext zgodnym z OpenPGP
  return pgp_sym_encrypt(p_plain, p_key);
end;
$$;

comment on function public.encrypt_ms_token(text, text) is
  'Szyfruje token MS kluczem symetrycznym (pgp_sym_encrypt). Klucz min. 16 znaków. Używane przez backend podczas zapisu tokenów.';

create or replace function public.decrypt_ms_token(p_encrypted bytea, p_key text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- tolerujemy NULL na wejściu — zwracamy NULL, ułatwia użycie w SELECT
  if p_encrypted is null then
    return null;
  end if;
  return pgp_sym_decrypt(p_encrypted, p_key);
end;
$$;

comment on function public.decrypt_ms_token(bytea, text) is
  'Deszyfruje token MS kluczem symetrycznym (pgp_sym_decrypt). Zwraca NULL dla NULL wejścia. Używane przez backend podczas wywołań do Microsoft Graph.';

-- GRANT EXECUTE tylko dla authenticated — tokeny nie są dla nieuwierzytelnionych userów.
-- Równocześnie REVOKE z PUBLIC (domyślnie plpgsql przyznaje PUBLIC execute).
revoke all on function public.encrypt_ms_token(text, text) from public;
revoke all on function public.decrypt_ms_token(bytea, text) from public;
grant execute on function public.encrypt_ms_token(text, text) to authenticated;
grant execute on function public.decrypt_ms_token(bytea, text) to authenticated;
