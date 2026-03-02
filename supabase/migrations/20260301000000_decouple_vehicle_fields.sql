-- Rozdzielenie pól pojazdu: vehicle_variant_code (FK) → vehicle_type_text + vehicle_capacity_volume_m3
-- Typ auta i objętość m³ to teraz dwa niezależne pola (select + free input).

ALTER TABLE public.transport_orders
  ADD COLUMN vehicle_type_text varchar(100),
  ADD COLUMN vehicle_capacity_volume_m3 numeric(12,1);

-- Migracja istniejących danych z vehicle_variants
UPDATE public.transport_orders o
SET vehicle_type_text = vv.vehicle_type,
    vehicle_capacity_volume_m3 = vv.capacity_volume_m3
FROM public.vehicle_variants vv
WHERE o.vehicle_variant_code = vv.code;

-- Usunięcie FK (kolumna vehicle_variant_code zostaje, FK odpada)
ALTER TABLE public.transport_orders
  DROP CONSTRAINT IF EXISTS transport_orders_vehicle_variant_code_fkey;
