-- Migracja: dodanie kolumny confidentiality_clause do transport_orders.
-- Klauzula poufności (wolny tekst, max 2000 znaków), edytowalna w OrderView.

ALTER TABLE transport_orders
  ADD COLUMN IF NOT EXISTS confidentiality_clause text DEFAULT NULL;

COMMENT ON COLUMN transport_orders.confidentiality_clause
  IS 'Klauzula poufności — wolny tekst wyświetlany i edytowany w OrderView (podgląd A4)';
