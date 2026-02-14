-- Migracja: dodanie kolumn brakujących w schemacie SQL, ale zdefiniowanych w db-plan.md
-- Dotyczy: transport_orders (week_number, main_product_name, sent_by_user_id, sent_at),
--          order_items (loading_method_code), vehicle_variants (capacity_volume_m3)

-- ============================================================
-- 1. transport_orders — brakujące kolumny
-- ============================================================

ALTER TABLE public.transport_orders
  ADD COLUMN week_number integer,
  ADD COLUMN main_product_name varchar(500),
  ADD COLUMN sent_by_user_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN sent_at timestamptz;

-- Indeks na sent_at (opcjonalny, wymieniony w db-plan.md sekcja 3.1)
CREATE INDEX transport_orders_sent_at_idx
  ON public.transport_orders (sent_at);

-- ============================================================
-- 2. order_items — loading_method_code (nadpisywalny sposób załadunku)
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN loading_method_code varchar(100);

-- CHECK constraint na loading_method_code (db-plan.md sekcja 1.3)
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_loading_method_code_chk
  CHECK (loading_method_code IS NULL OR loading_method_code IN ('PALETA','PALETA_BIGBAG','LUZEM','KOSZE'));

-- ============================================================
-- 3. vehicle_variants — capacity_volume_m3 (objętość w m³)
-- ============================================================

ALTER TABLE public.vehicle_variants
  ADD COLUMN capacity_volume_m3 numeric(12,1);

-- ============================================================
-- 4. Trigger: automatyczne obliczanie week_number z first_loading_date
--    (db-plan.md sekcja 4.5)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_week_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_loading_date IS NOT NULL THEN
    NEW.week_number := EXTRACT(WEEK FROM NEW.first_loading_date)::integer;
  ELSE
    NEW.week_number := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_week_number
  BEFORE INSERT OR UPDATE OF first_loading_date ON public.transport_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_week_number();
