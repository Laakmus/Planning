-- Zmiana odcieni kolorów przewoźników na wartości z palety Tailwind (emerald/amber/orange).
-- Stare: #48A111, #25671E, #FFEF5F, #EEA727
-- Nowe: #34d399 (emerald-400), #047857 (emerald-700), #fde047 (amber-400), #f97316 (orange-500)

BEGIN;

-- Aktualizacja istniejących danych
UPDATE public.transport_orders SET carrier_cell_color = '#34d399' WHERE carrier_cell_color = '#48A111';
UPDATE public.transport_orders SET carrier_cell_color = '#047857' WHERE carrier_cell_color = '#25671E';
UPDATE public.transport_orders SET carrier_cell_color = '#fde047' WHERE carrier_cell_color = '#FFEF5F';
UPDATE public.transport_orders SET carrier_cell_color = '#f97316' WHERE carrier_cell_color = '#EEA727';

-- Wymiana CHECK constraint
ALTER TABLE public.transport_orders DROP CONSTRAINT IF EXISTS transport_orders_carrier_cell_color_check;
ALTER TABLE public.transport_orders ADD CONSTRAINT transport_orders_carrier_cell_color_check
  CHECK (carrier_cell_color IS NULL OR carrier_cell_color IN ('#34d399', '#047857', '#fde047', '#f97316'));

COMMIT;
