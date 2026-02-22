-- Allow vehicle_variant_code to be NULL (draft orders may not have a vehicle assigned yet)
ALTER TABLE public.transport_orders
  ALTER COLUMN vehicle_variant_code DROP NOT NULL;
