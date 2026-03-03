-- Dodanie pola "Dane do awizacji" do tabeli transport_orders
ALTER TABLE transport_orders
  ADD COLUMN notification_details TEXT;

COMMENT ON COLUMN transport_orders.notification_details
  IS 'Dane do awizacji — informacje przekazywane przewoźnikowi o planowanym załadunku/rozładunku';
