-- Usunięcie nieużywanej kolumny search_vector i indeksu GIN
-- search_text z ILIKE wystarczy dla MVP
DROP INDEX IF EXISTS transport_orders_search_vector_gin_idx;
ALTER TABLE public.transport_orders DROP COLUMN IF EXISTS search_vector;
