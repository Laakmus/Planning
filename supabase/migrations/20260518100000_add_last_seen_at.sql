-- Migracja: add_last_seen_at
-- Data:     2026-05-18
-- Cel:      Dodanie kolumny `last_seen_at` do `user_profiles` — śledzenie ostatniej
--           aktywności użytkownika (do widoku online/offline w panelu admina).
--
-- Aktualizacja przez middleware backendu na każdym uwierzytelnionym żądaniu
-- (throttled per user w pamięci, fizyczny UPDATE max raz na ~60s — żeby nie
-- spamować DB przy każdym GET /api/v1/orders itp.).
--
-- Definicja "online" w UI: last_seen_at > NOW() - INTERVAL '5 minutes'.

alter table public.user_profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.user_profiles.last_seen_at is
  'Timestamp ostatniej aktywności (uwierzytelnionego requestu). Aktualizowany przez middleware. NULL = nigdy się nie logował / brak danych.';

-- Indeks na pole — używany przez query `SELECT ... ORDER BY last_seen_at DESC`
-- oraz potencjalny filtr "online users" (last_seen_at > now - 5 min).
create index if not exists idx_user_profiles_last_seen_at
  on public.user_profiles (last_seen_at desc);
