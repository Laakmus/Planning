-- Kolumna "Fix" (czy wjazd zafiksowany) — boolean nullable, domyślnie NULL.
ALTER TABLE public.transport_orders
  ADD COLUMN is_entry_fixed boolean DEFAULT NULL;
