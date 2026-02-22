-- Add carrier_cell_color column to transport_orders
-- Allows marking carrier cell with one of 4 predefined colors in the orders table.

ALTER TABLE transport_orders
  ADD COLUMN carrier_cell_color varchar(7) DEFAULT NULL;

ALTER TABLE transport_orders
  ADD CONSTRAINT chk_carrier_cell_color
  CHECK (carrier_cell_color IS NULL OR carrier_cell_color IN ('#48A111', '#25671E', '#FFEF5F', '#EEA727'));
