-- Jednorazowy backfill: uzupełnienie shipper_location_id / receiver_location_id
-- z istniejących punktów trasy (order_stops).
--
-- Logika (spójna z backendem order-create/order-update):
--   shipper = location_id z PIERWSZEGO LOADING stop (najniższy sequence_no)
--   receiver = location_id z OSTATNIEGO UNLOADING stop (najwyższy sequence_no)
--
-- Snapshoty (name, address) pobierane z locations JOIN companies
-- — identycznie jak buildSnapshotsForShipperReceiver w order-snapshot.service.ts.
--
-- Bezpieczna (idempotentna): aktualizuje TYLKO zlecenia z NULL w danym polu.

-- ====================================================================
-- 1. Backfill shipper (pierwszy LOADING stop)
-- ====================================================================
WITH first_loading AS (
  SELECT DISTINCT ON (os.order_id)
    os.order_id,
    os.location_id,
    c.name   AS company_name,
    concat_ws(', ',
      nullif(l.street_and_number, ''),
      nullif(concat_ws(' ', l.postal_code, l.city), ' '),
      nullif(l.country, '')
    ) AS address
  FROM public.order_stops os
  LEFT JOIN public.locations l ON l.id = os.location_id
  LEFT JOIN public.companies c ON c.id = l.company_id
  WHERE os.kind = 'LOADING'
    AND os.location_id IS NOT NULL
  ORDER BY os.order_id, os.sequence_no ASC
)
UPDATE public.transport_orders t
SET
  shipper_location_id    = fl.location_id,
  shipper_name_snapshot  = fl.company_name,
  shipper_address_snapshot = fl.address
FROM first_loading fl
WHERE fl.order_id = t.id
  AND t.shipper_location_id IS NULL;

-- ====================================================================
-- 2. Backfill receiver (ostatni UNLOADING stop)
-- ====================================================================
WITH last_unloading AS (
  SELECT DISTINCT ON (os.order_id)
    os.order_id,
    os.location_id,
    c.name   AS company_name,
    concat_ws(', ',
      nullif(l.street_and_number, ''),
      nullif(concat_ws(' ', l.postal_code, l.city), ' '),
      nullif(l.country, '')
    ) AS address
  FROM public.order_stops os
  LEFT JOIN public.locations l ON l.id = os.location_id
  LEFT JOIN public.companies c ON c.id = l.company_id
  WHERE os.kind = 'UNLOADING'
    AND os.location_id IS NOT NULL
  ORDER BY os.order_id, os.sequence_no DESC
)
UPDATE public.transport_orders t
SET
  receiver_location_id    = lu.location_id,
  receiver_name_snapshot  = lu.company_name,
  receiver_address_snapshot = lu.address
FROM last_unloading lu
WHERE lu.order_id = t.id
  AND t.receiver_location_id IS NULL;
