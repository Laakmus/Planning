# Backend Agent — Pamięć

## Sesja 25 (2026-03-03) — Widok magazynowy (warehouse)

### Nowe pliki
- **`src/lib/services/warehouse.service.ts`** — serwis `getWarehouseWeekOrders()` + `getCurrentISOWeek()`
  - Oblicza zakres dat tygodnia ISO (pon-nd) via `getISOWeekMonday()`
  - 2 zapytania Supabase: stopy z datą w zakresie + stopy bez daty
  - PostgREST inner join: `order_stops` → `transport_orders!inner` → `order_items`
  - Filtr statusów: robocze, wysłane, korekta, korekta wysłane, reklamacja
  - Sobota/niedziela przesuwane do piątku z `isWeekend: true`
  - Sortowanie chronologiczne wg `timeLocal` w każdym dniu
  - Podsumowanie: loadingCount/Tons, unloadingCount/Tons
- **`src/pages/api/v1/warehouse/orders.ts`** — GET endpoint
  - Auth guard + sprawdzenie `locationId` (403 gdy brak)
  - Query params: `week` + `year` (opcjonalne, domyślnie bieżący tydzień ISO)
  - Walidacja Zod via `warehouseQuerySchema`
  - Pobiera nazwę lokalizacji z `locations` table

### Zmiany w `order.service.ts`
- **`duplicateOrder()`**: Dodano nullowanie 5 pól awizacji (driver_name, driver_phone, truck_plate, trailer_plate, bdo_number) — dane dyspozycji nie są kopiowane do duplikatu

### Wzorce
- Supabase inner join na order_stops: `transport_orders!inner(...)` — filtruje stopy po statusie zlecenia
- `getDay()` JS: 0=nd, 1=pon; konwersja na indeks tygodniowy: `jsDay === 0 ? 6 : jsDay - 1`
- Typy DB nie zawierają nowych kolumn (driver_name itp.) — użyto `as any` cast na zapytaniach

## Sesja 21 (2026-03-02) — Rozdzielenie pól pojazdu

### Zmiany w `order.service.ts`
- **vehicleVariantCode (FK) usunięty** → zastąpiony przez `vehicleTypeText` (string) + `vehicleCapacityVolumeM3` (number)
- Usunięto join `vehicle_variants(name)` z `selectColumns`
- Usunięto typ `vehicle_variants` z `TransportOrderRow`
- Usunięto walidację `vehicleVariantCode` z `validateForeignKeys()`
- `mapRowToOrderListItemDto`: `vehicleTypeText` z `row.vehicle_type_text`, usunięto `vehicleVariantName`
- `getOrderDetail`: dodano `vehicleCapacityVolumeM3` do mapowania
- `createOrder`/`updateOrder`/`duplicateOrder`: `vehicle_type_text` + `vehicle_capacity_volume_m3` w payload
- `businessFieldMap`: 2 nowe pola zamiast 1 starego

### Migracja DB
- `vehicle_type_text varchar(100)` + `vehicle_capacity_volume_m3 numeric(12,1)` dodane do transport_orders
- FK `transport_orders_vehicle_variant_code_fkey` usunięty (kolumna zostaje)
- Dane zmigrowane z vehicle_variants (UPDATE ... FROM)

## Sesja 18 (2026-03-01) — Rozszerzenie Audit Trail

### Zmiany w `order.service.ts`
- **createOrder()**: Dodano INSERT do `order_change_log` z `field_name: "order_created"` po insertach stops+items
- **updateOrder()**: Dodano snapshoty starych items (`oldItemsMap`) i stops (`oldStopsMap`) PRZED modyfikacjami
  - Logowanie zmian items: `item_added`, `item_removed`, `item[N].product_name/loading_method_code/quantity_tons/notes`
  - Logowanie zmian stops: `stop_added`, `stop_removed` z etykietami `L{seq}: {firma}` / `U{seq}: {firma}`
  - FK resolve: `carrier_company_id`, `shipper_location_id`, `receiver_location_id` → nazwy firm zamiast UUID
  - Helper `resolveFkName()` zdefiniowany wewnątrz `updateOrder()` (nie top-level) — dodatkowe query tylko dla starych FK
- **patchStop()**: Wyłączono `location_id` z generycznego `fieldMap`, dodano specjalną obsługę z resolwem nazw lokalizacji

### Wzorce
- `auditItemNum` liczy numerację 1-based niezależnie od `activeItemIdx`
- `stopSnapshotMap` (po sequenceNo) zawiera snapshoty z batch query — zero dodatkowych queries dla nowych stops
- Dla nowych wartości FK: użyj istniejących snapshotów (`carrierSnapshots`, `shipperSnapshots`, `receiverSnapshots`)
- Dla starych wartości FK: `resolveFkName()` robi query (max 1-2 queries, tylko gdy FK się zmienia)
