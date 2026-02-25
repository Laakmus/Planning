-- Migracja M-07: Dodanie kolumny order_seq_no INT do sortowania numerycznego.
-- Problem: order_no (TEXT) "ZT2026/10000" < "ZT2026/9999" leksykograficznie.
-- Rozwiązanie: kolumna INT + trigger auto-extract + backfill istniejących wierszy.

BEGIN;

-- 1. Dodaj kolumnę (nullable na start, żeby backfill nie blokował)
ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS order_seq_no integer;

-- 2. Backfill — wyciągnij część numeryczną z order_no
UPDATE public.transport_orders
SET order_seq_no = CASE
  WHEN order_no ~ '/(\d+)$'
  THEN substring(order_no from '/(\d+)$')::integer
  ELSE NULL
END
WHERE order_seq_no IS NULL;

-- 3. Trigger function — auto-extract przy INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_set_order_seq_no()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_no IS NOT NULL AND NEW.order_no ~ '/(\d+)$' THEN
    NEW.order_seq_no := substring(NEW.order_no from '/(\d+)$')::integer;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger na INSERT i UPDATE order_no
DROP TRIGGER IF EXISTS set_order_seq_no ON public.transport_orders;
CREATE TRIGGER set_order_seq_no
  BEFORE INSERT OR UPDATE OF order_no
  ON public.transport_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_order_seq_no();

-- 5. Indeks na sortowanie
CREATE INDEX IF NOT EXISTS idx_transport_orders_order_seq_no
  ON public.transport_orders (order_seq_no);

COMMIT;
