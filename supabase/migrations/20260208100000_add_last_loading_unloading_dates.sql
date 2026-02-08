ALTER TABLE public.transport_orders
  ADD COLUMN last_loading_date date,
  ADD COLUMN last_loading_time time without time zone,
  ADD COLUMN last_unloading_date date,
  ADD COLUMN last_unloading_time time without time zone;
