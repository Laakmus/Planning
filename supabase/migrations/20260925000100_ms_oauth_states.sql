-- =============================================================================
-- Tabela ms_oauth_states — stan OAuth (state + PKCE verifier) w bazie
-- =============================================================================
-- Problem: stan był trzymany w Map w pamięci procesu. Na Fly.io przy >1 maszynie
-- (lub restarcie/auto-stop) callback trafiał na proces bez stanu → błąd połączenia.
--
-- Dostęp wyłącznie przez service_role (RLS włączone, brak policies).
-- Rekord jest jednorazowy: callback usuwa go atomowo (DELETE ... RETURNING).
-- =============================================================================

create table if not exists public.ms_oauth_states (
  state text primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  code_verifier text not null,
  created_at timestamptz not null default now()
);

comment on table public.ms_oauth_states is
  'Jednorazowy stan OAuth Microsoft (anti-CSRF state + PKCE code_verifier). TTL 5 min, czyszczony przez backend.';

create index if not exists ms_oauth_states_created_at_idx on public.ms_oauth_states (created_at);

alter table public.ms_oauth_states enable row level security;

revoke all on table public.ms_oauth_states from anon, authenticated;
