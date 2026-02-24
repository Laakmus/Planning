-- Migracja: dodanie 8 kolumn brakujących w database.types.ts, zdefiniowanych w db-plan.md
-- Dotyczy: transport_orders (payment_term_days, payment_method, total_load_volume_m3,
--          special_requirements, last_loading_date, last_loading_time,
--          last_unloading_date, last_unloading_time)
-- UWAGA: Te kolumny mogły zostać już dodane przez wcześniejsze migracje (20260208*).

-- ============================================================
-- 1. transport_orders — kolumny płatności
-- ============================================================

ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS payment_term_days smallint,
  ADD COLUMN IF NOT EXISTS payment_method varchar(100);

-- ============================================================
-- 2. transport_orders — objętość ładunku
-- ============================================================

ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS total_load_volume_m3 numeric(12,3);

-- ============================================================
-- 3. transport_orders — wymagania specjalne
-- ============================================================

ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS special_requirements varchar(500);

-- ============================================================
-- 4. transport_orders — daty ostatniego załadunku/rozładunku
-- ============================================================

ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS last_loading_date date,
  ADD COLUMN IF NOT EXISTS last_loading_time time without time zone,
  ADD COLUMN IF NOT EXISTS last_unloading_date date,
  ADD COLUMN IF NOT EXISTS last_unloading_time time without time zone;

-- ============================================================
-- Po wykonaniu migracji: zregenerować typy Supabase:
-- npx supabase gen types typescript --project-id <id> > src/db/database.types.ts
-- ============================================================
