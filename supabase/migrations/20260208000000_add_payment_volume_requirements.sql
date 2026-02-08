ALTER TABLE public.transport_orders
  ADD COLUMN payment_term_days smallint,
  ADD COLUMN payment_method varchar(100),
  ADD COLUMN total_load_volume_m3 numeric(12,3),
  ADD COLUMN special_requirements varchar(500);
