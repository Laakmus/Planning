-- ==========================================================================
-- Seed: dane referencyjne wymagane do działania aplikacji
-- ==========================================================================

-- Statusy zleceń (mapowanie: kod → nazwa, grupa widoku, edytowalność)
INSERT INTO order_statuses (code, name, view_group, is_editable, sort_order) VALUES
  ('ROB', 'Roboczy', 'CURRENT', true, 1),
  ('WYS', 'Wysłany', 'CURRENT', false, 2),
  ('KOR', 'Korekta', 'CURRENT', true, 3),
  ('KOR_WYS', 'Korekta wysłana', 'CURRENT', false, 4),
  ('ZRE', 'Zrealizowany', 'COMPLETED', false, 5),
  ('ANL', 'Anulowany', 'CANCELLED', false, 6),
  ('REK', 'Reklamacja', 'CURRENT', true, 7)
ON CONFLICT (code) DO NOTHING;

-- Typy transportu
INSERT INTO transport_types (code, name, is_active) VALUES
  ('PL', 'Krajowy', true),
  ('EXP', 'Eksport', true),
  ('EXP_K', 'Eksport kabotaż', true),
  ('IMP', 'Import', true)
ON CONFLICT (code) DO NOTHING;

-- Warianty pojazdów
INSERT INTO vehicle_variants (code, name, vehicle_type, capacity_tons, is_active) VALUES
  ('STANDARD', 'Standard', 'Ciężarówka', 24.0, true),
  ('MEGA', 'Mega', 'Ciężarówka', 24.0, true),
  ('TANDEM', 'Tandem', 'Tandem', 25.0, true),
  ('BUS', 'Bus', 'Bus', 3.5, true),
  ('SOLO', 'Solo', 'Ciężarówka', 12.0, true),
  ('FRIGO', 'Chłodnia', 'Ciężarówka', 22.0, true),
  ('PLANDEKA', 'Plandeka', 'Ciężarówka', 24.0, true),
  ('IZOTERMA', 'Izoterma', 'Ciężarówka', 24.0, true)
ON CONFLICT (code) DO NOTHING;

-- ==========================================================================
-- Seed: firmy transportowe (przewoźnicy)
-- ==========================================================================

INSERT INTO companies (id, name, type, tax_id, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Trans-Pol Sp. z o.o.', 'PRZEWOŹNIK', '525-001-00-01', true),
  ('b0000000-0000-0000-0000-000000000004', 'Eko-Transport Logistic', 'PRZEWOŹNIK', '525-004-00-04', true),
  ('b0000000-0000-0000-0000-000000000006', 'Euro-Sped Sp. z o.o.', 'PRZEWOŹNIK', '525-006-00-06', true),
  ('b0000000-0000-0000-0000-000000000007', 'Pekaes S.A.', 'PRZEWOŹNIK', '525-007-00-07', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Seed: firmy nadawcze (miejsca załadunku towaru)
-- ==========================================================================

INSERT INTO companies (id, name, type, tax_id, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'Cementownia Warta S.A.', 'NADAWCA', '525-002-00-02', true),
  ('b0000000-0000-0000-0000-000000000005', 'Huta Szkła Jarocin', 'NADAWCA', '525-005-00-05', true),
  ('b0000000-0000-0000-0000-000000000008', 'Kopalnia Piasku Kotlarnia', 'NADAWCA', '525-008-00-08', true),
  ('b0000000-0000-0000-0000-000000000009', 'Cementownia Odra S.A.', 'NADAWCA', '525-009-00-09', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Seed: firmy odbiorcze (miejsca rozładunku)
-- ==========================================================================

INSERT INTO companies (id, name, type, tax_id, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000003', 'Betoniarnia Poznań Sp. z o.o.', 'ODBIORCA', '525-003-00-03', true),
  ('b0000000-0000-0000-0000-00000000000a', 'Budex Wrocław Sp. z o.o.', 'ODBIORCA', '525-010-00-10', true),
  ('b0000000-0000-0000-0000-00000000000b', 'Skład Budowlany Łódź', 'ODBIORCA', '525-011-00-11', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Seed: lokalizacje (adresy firm – załadunek i rozładunek)
-- ==========================================================================

INSERT INTO locations (id, company_id, name, country, city, street_and_number, postal_code, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Baza Trans-Pol Warszawa', 'Polska', 'Warszawa', 'ul. Logistyczna 8', '02-123', true),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004', 'Terminal Eko-Transport', 'Polska', 'Warszawa', 'ul. Eko 5', '00-001', true),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Zakład Warta – załadunek', 'Polska', 'Warta', 'ul. Cementowa 1', '98-290', true),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005', 'Huta Szkła – załadunek', 'Polska', 'Jarocin', 'ul. Szklana 3', '63-200', true),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000008', 'Kotlarnia – wywóz piasku', 'Polska', 'Kotlarnia', 'ul. Kopalniana 12', '47-246', true),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000009', 'Cementownia Odra – załadunek', 'Polska', 'Opole', 'ul. Cementowa 5', '45-001', true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'Betoniarnia Poznań – rozładunek', 'Polska', 'Poznań', 'ul. Przemysłowa 15', '61-222', true),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', 'Betoniarnia Poznań – magazyn 2', 'Polska', 'Poznań', 'ul. Magazynowa 7', '61-223', true),
  ('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-00000000000a', 'Budex Wrocław – plac budowy', 'Polska', 'Wrocław', 'ul. Budowlana 22', '50-001', true),
  ('c0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'Skład Budowlany Łódź', 'Polska', 'Łódź', 'ul. Magazynowa 3', '91-001', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Seed: produkty (towary)
-- ==========================================================================

INSERT INTO products (id, name, description, default_loading_method_code, is_active) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Cement CEM I 42,5R', 'Cement portlandzki workowany', 'PALETA', true),
  ('d0000000-0000-0000-0000-000000000002', 'Piasek budowlany', 'Piasek płukany luzem', 'LUZEM', true),
  ('d0000000-0000-0000-0000-000000000003', 'Żwir 2–8 mm', 'Kruszywo w big-bagach', 'PALETA_BIGBAG', true),
  ('d0000000-0000-0000-0000-000000000004', 'Szkło float', 'Tafle szkła float na koszach', 'KOSZE', true),
  ('d0000000-0000-0000-0000-000000000005', 'Cement CEM II 32,5N', 'Cement wieloskładnikowy', 'PALETA', true),
  ('d0000000-0000-0000-0000-000000000006', 'Grys 4–8 mm', 'Kruszywo łamane', 'LUZEM', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Seed: profil do powiązania z przykładowym zleceniem (created_by_user_id)
-- ==========================================================================
INSERT INTO user_profiles (id, email, full_name, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'seed@local.dev', 'Konto seed (dev)', 'ADMIN')
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Seed: 1 przykładowe zlecenie transportowe
-- ==========================================================================
INSERT INTO transport_orders (
  id, order_no, status_code, transport_type_code, currency_code, price_amount, total_load_tons,
  summary_route, first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  last_loading_date, last_unloading_date, transport_year, first_loading_country, first_unloading_country,
  carrier_company_id, carrier_name_snapshot, carrier_address_snapshot,
  shipper_location_id, shipper_name_snapshot, shipper_address_snapshot,
  receiver_location_id, receiver_name_snapshot, receiver_address_snapshot,
  vehicle_variant_code, created_by_user_id, updated_by_user_id
) VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'ZL/2025/001',
  'ROB',
  'PL',
  'PLN',
  4500.00,
  22.5,
  'Warta → Poznań',
  '2025-02-15',
  '08:00',
  '2025-02-15',
  '14:00',
  '2025-02-15',
  '2025-02-15',
  2025,
  'Polska',
  'Polska',
  'b0000000-0000-0000-0000-000000000001',
  'Trans-Pol Sp. z o.o.',
  'ul. Logistyczna 8, 02-123 Warszawa',
  'c0000000-0000-0000-0000-000000000001',
  'Cementownia Warta S.A.',
  'ul. Cementowa 1, 98-290 Warta',
  'c0000000-0000-0000-0000-000000000002',
  'Betoniarnia Poznań Sp. z o.o.',
  'ul. Przemysłowa 15, 61-222 Poznań',
  'STANDARD',
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Punkty trasy (załadunek + rozładunek)
INSERT INTO order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'LOADING',  1, '2025-02-15', '08:00', 'c0000000-0000-0000-0000-000000000001', 'Zakład Warta – załadunek', 'Cementownia Warta S.A.', 'ul. Cementowa 1, 98-290 Warta'),
  ('e0000000-0000-0000-0000-000000000001', 'UNLOADING', 2, '2025-02-15', '14:00', 'c0000000-0000-0000-0000-000000000002', 'Betoniarnia Poznań – rozładunek', 'Betoniarnia Poznań Sp. z o.o.', 'ul. Przemysłowa 15, 61-222 Poznań')
ON CONFLICT (order_id, sequence_no) DO NOTHING;

-- Pozycja towarowa
INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, default_loading_method_snapshot, quantity_tons) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Cement CEM I 42,5R', 'PALETA', 22.5)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- Uwaga: konto testowe do logowania (auth.users)
-- ==========================================================================
-- Aby móc się zalogować, utwórz użytkownika w Supabase Auth (Dashboard → Authentication
-- lub Admin API). Trigger on_auth_user_created utworzy wtedy profil w user_profiles.
-- Przykład: test@test.com / Test1234!
