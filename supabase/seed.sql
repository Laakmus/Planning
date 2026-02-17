-- Seed: dane testowe dla wizualnego testowania frontendu
-- User: admin@test.pl / test1234 (ID: c94a20d0-16ca-4f9d-873a-05f31be633ff)

BEGIN;

-- ============================================================
-- 1. Profil użytkownika (powiązany z auth user)
-- ============================================================

INSERT INTO public.user_profiles (id, email, full_name, phone, role) VALUES
  ('c94a20d0-16ca-4f9d-873a-05f31be633ff', 'admin@test.pl', 'Jan Kowalski', '+48 600 100 200', 'ADMIN')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, role = EXCLUDED.role;

-- ============================================================
-- 2. Słowniki
-- ============================================================

-- Transport types (PRD: PL, EXP, EXP_K, IMP)
INSERT INTO public.transport_types (code, name, description, is_active) VALUES
  ('PL',    'Krajowy',           'Transport krajowy', true),
  ('EXP',   'Eksport drogowy',   'Eksport drogowy', true),
  ('EXP_K', 'Kontener morski',   'Eksport kontenerowy (kontener morski)', true),
  ('IMP',   'Import',            'Import', true);

-- Order statuses
INSERT INTO public.order_statuses (code, name, view_group, is_editable, sort_order) VALUES
  ('robocze',          'Robocze',           'CURRENT',   true,  1),
  ('wysłane',          'Wysłane',           'CURRENT',   false, 2),
  ('korekta',          'Korekta',           'CURRENT',   true,  3),
  ('korekta wysłane',  'Korekta wysłane',   'CURRENT',   false, 4),
  ('zrealizowane',     'Zrealizowane',      'COMPLETED', false, 5),
  ('reklamacja',       'Reklamacja',        'CURRENT',   false, 6),
  ('anulowane',        'Anulowane',         'CANCELLED', false, 7);

-- Vehicle variants
INSERT INTO public.vehicle_variants (code, name, vehicle_type, capacity_tons, capacity_volume_m3, description, is_active) VALUES
  ('MEGA_24T',   'Mega 24t',        'Naczepa mega',   24.000, 100.0, 'Naczepa mega do 24 ton',   true),
  ('STAND_24T',  'Standard 24t',    'Naczepa standard',24.000, 90.0,  'Naczepa standard 24 ton',  true),
  ('SOLO_12T',   'Solo 12t',        'Samochód solo',   12.000, 40.0,  'Samochód solo do 12 ton',  true),
  ('BUS_3T',     'Bus 3.5t',        'Bus',             3.500,  15.0,  'Bus dostawczy 3.5t',       true);

-- ============================================================
-- 3. Firmy
-- ============================================================

INSERT INTO public.companies (id, name, type, tax_id, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'NordMetal Sp. z o.o.',     'INTERNAL', '5270001001', true),
  ('a0000000-0000-0000-0000-000000000002', 'Recykling Plus S.A.',      'INTERNAL', '5270002002', true),
  ('a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',       'CARRIER',  '6340003003', true),
  ('a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',    'CARRIER',  '7250004004', true),
  ('a0000000-0000-0000-0000-000000000005', 'Huta Silesia S.A.',        'CLIENT',   '6310005005', true),
  ('a0000000-0000-0000-0000-000000000006', 'BerlinBau GmbH',           'CLIENT',   'DE123456789', true),
  ('a0000000-0000-0000-0000-000000000007', 'ChemTrans International',  'CARRIER',  '8130007007', true);

-- ============================================================
-- 4. Lokalizacje
-- ============================================================

INSERT INTO public.locations (id, company_id, name, country, city, street_and_number, postal_code, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Magazyn Główny',   'PL', 'Gdańsk',     'ul. Portowa 15',      '80-001', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Oddział Warszawa',  'PL', 'Warszawa',   'ul. Przemysłowa 42',  '02-001', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Zakład Recyklingu', 'PL', 'Katowice',   'ul. Hutnicza 8',      '40-001', true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', 'Huta - Brama Główna','PL','Ruda Śląska','ul. 1 Maja 100',      '41-710', true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006', 'Lager Berlin',      'DE', 'Berlin',     'Industriestr. 22',    '10115', true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'Baustelle München', 'DE', 'München',    'Bauweg 5',            '80331', true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'Baza TransBud',     'PL', 'Wrocław',    'ul. Logistyczna 3',   '50-001', true);

-- ============================================================
-- 5. Produkty
-- ============================================================

INSERT INTO public.products (id, name, description, default_loading_method_code, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Stal walcowana',      'Blachy i zwoje stalowe',        'PALETA',       true),
  ('c0000000-0000-0000-0000-000000000002', 'Złom stalowy',        'Złom stalowy do recyklingu',     'LUZEM',        true),
  ('c0000000-0000-0000-0000-000000000003', 'Cement workowy',      'Cement w workach 25kg',          'PALETA',       true),
  ('c0000000-0000-0000-0000-000000000004', 'Granulat PP',         'Granulat polipropylenowy',       'PALETA_BIGBAG', true),
  ('c0000000-0000-0000-0000-000000000005', 'Odpady przemysłowe',  'Odpady do utylizacji',           'KOSZE',        true);

-- ============================================================
-- 6. Zlecenia transportowe (różne statusy)
-- ============================================================

-- Zlecenie 1: robocze, krajowe
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, general_notes, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sender_contact_name, sender_contact_phone, sender_contact_email,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000001', 'ZT/2026/02/001', 'robocze', 'PL', 'PLN',
  4500.00, 22.5, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'MEGA_24T', 'Pilne — dostarczyć przed weekendem', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-20', '08:00:00', '2026-02-21', '14:00:00',
  'PL', 'PL', 2026,
  'Anna Nowak', '+48 601 222 333', 'anna.nowak@nordmetal.pl',
  30, 'Przelew'
);

-- Zlecenie 2: wysłane, międzynarodowe
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sent_at, sent_by_user_id, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000002', 'ZT/2026/02/002', 'wysłane', 'EXP', 'EUR',
  2800.00, 18.0, 'a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',
  'STAND_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-18', '06:00:00', '2026-02-19', '16:00:00',
  'PL', 'DE', 2026,
  '2026-02-17T10:30:00Z', 'c94a20d0-16ca-4f9d-873a-05f31be633ff', 14, 'Przelew'
);

-- Zlecenie 3: korekta
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000003', 'ZT/2026/02/003', 'korekta', 'PL', 'PLN',
  3200.00, 12.0, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'SOLO_12T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-22', '10:00:00', '2026-02-22', '18:00:00',
  'PL', 'PL', 2026,
  21, 'Przelew'
);

-- Zlecenie 4: korekta wysłane
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sent_at, sent_by_user_id, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000004', 'ZT/2026/02/004', 'korekta wysłane', 'EXP', 'EUR',
  5100.00, 24.0, 'a0000000-0000-0000-0000-000000000007', 'ChemTrans International',
  'MEGA_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-25', '07:00:00', '2026-02-26', '12:00:00',
  'PL', 'DE', 2026,
  '2026-02-16T09:00:00Z', 'c94a20d0-16ca-4f9d-873a-05f31be633ff', 30, 'Przelew'
);

-- Zlecenie 5: zrealizowane
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000005', 'ZT/2026/01/015', 'zrealizowane', 'PL', 'PLN',
  3800.00, 20.0, 'a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',
  'STAND_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-01-28', '09:00:00', '2026-01-29', '15:00:00',
  'PL', 'PL', 2026,
  14, 'Przelew'
);

-- Zlecenie 6: reklamacja
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, complaint_reason, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000006', 'ZT/2026/02/005', 'reklamacja', 'IMP', 'PLN',
  6500.00, 3.0, 'a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',
  'BUS_3T', 'Towar uszkodzony podczas transportu — pęknięcia opakowań', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-15', '14:00:00', '2026-02-15', '20:00:00',
  'PL', 'PL', 2026,
  7, 'Przelew'
);

-- Zlecenie 7: anulowane
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_unloading_date,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000007', 'ZT/2026/02/006', 'anulowane', 'PL', 'PLN',
  2000.00, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'SOLO_12T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-28', '2026-03-01',
  'PL', 'PL', 2026,
  30, 'Przelew'
);

-- Zlecenie 8: robocze, ekspres (więcej punktów trasy)
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  special_requirements, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000008', 'ZT/2026/02/007', 'robocze', 'IMP', 'PLN',
  8500.00, 3.2, 'a0000000-0000-0000-0000-000000000007', 'ChemTrans International',
  'BUS_3T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-19', '05:30:00', '2026-02-19', '22:00:00',
  'PL', 'DE', 2026,
  'ADR — materiały niebezpieczne klasa 3', 7, 'Przelew'
);

-- ============================================================
-- 7. Przystanki (order_stops)
-- ============================================================

-- Zlecenie 1: L1 Gdańsk → U1 Katowice
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'LOADING',    1, '2026-02-20', '08:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL'),
  ('d0000000-0000-0000-0000-000000000001', 'UNLOADING',  2, '2026-02-21', '14:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL');

-- Zlecenie 2: L1 Warszawa → U1 Berlin
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'LOADING',    1, '2026-02-18', '06:00:00', 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL'),
  ('d0000000-0000-0000-0000-000000000002', 'UNLOADING',  2, '2026-02-19', '16:00:00', 'b0000000-0000-0000-0000-000000000005', 'Lager Berlin',       'BerlinBau GmbH',         'Industriestr. 22, 10115 Berlin, DE');

-- Zlecenie 3: L1 Katowice → U1 Ruda Śląska
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000003', 'LOADING',    1, '2026-02-22', '10:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000003', 'UNLOADING',  2, '2026-02-22', '18:00:00', 'b0000000-0000-0000-0000-000000000004', 'Huta - Brama Główna','Huta Silesia S.A.',      'ul. 1 Maja 100, 41-710 Ruda Śląska, PL');

-- Zlecenie 4: L1 Gdańsk → L2 Warszawa → U1 Berlin
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000004', 'LOADING',    1, '2026-02-25', '07:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL'),
  ('d0000000-0000-0000-0000-000000000004', 'LOADING',    2, '2026-02-25', '14:00:00', 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL'),
  ('d0000000-0000-0000-0000-000000000004', 'UNLOADING',  3, '2026-02-26', '12:00:00', 'b0000000-0000-0000-0000-000000000005', 'Lager Berlin',       'BerlinBau GmbH',         'Industriestr. 22, 10115 Berlin, DE');

-- Zlecenie 5: L1 Wrocław → U1 Gdańsk
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000005', 'LOADING',    1, '2026-01-28', '09:00:00', 'b0000000-0000-0000-0000-000000000007', 'Baza TransBud',      'TransBud Logistyka',     'ul. Logistyczna 3, 50-001 Wrocław, PL'),
  ('d0000000-0000-0000-0000-000000000005', 'UNLOADING',  2, '2026-01-29', '15:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL');

-- Zlecenie 6: L1 Warszawa → U1 Ruda Śląska
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000006', 'LOADING',    1, '2026-02-15', '14:00:00', 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL'),
  ('d0000000-0000-0000-0000-000000000006', 'UNLOADING',  2, '2026-02-15', '20:00:00', 'b0000000-0000-0000-0000-000000000004', 'Huta - Brama Główna','Huta Silesia S.A.',      'ul. 1 Maja 100, 41-710 Ruda Śląska, PL');

-- Zlecenie 7: L1 Katowice → U1 Warszawa
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000007', 'LOADING',    1, '2026-02-28', NULL, 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000007', 'UNLOADING',  2, '2026-03-01', NULL, 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL');

-- Zlecenie 8: L1 Gdańsk → L2 Katowice → U1 Berlin → U2 München (5 punktów)
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000008', 'LOADING',    1, '2026-02-19', '05:30:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL'),
  ('d0000000-0000-0000-0000-000000000008', 'LOADING',    2, '2026-02-19', '12:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000008', 'UNLOADING',  3, '2026-02-19', '18:00:00', 'b0000000-0000-0000-0000-000000000005', 'Lager Berlin',       'BerlinBau GmbH',         'Industriestr. 22, 10115 Berlin, DE'),
  ('d0000000-0000-0000-0000-000000000008', 'UNLOADING',  4, '2026-02-19', '22:00:00', 'b0000000-0000-0000-0000-000000000006', 'Baustelle München',  'BerlinBau GmbH',         'Bauweg 5, 80331 München, DE');

-- ============================================================
-- 8. Pozycje towarowe (order_items)
-- ============================================================

-- Zlecenie 1
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 15.0),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Złom stalowy',   'LUZEM',  'LUZEM',  7.5);

-- Zlecenie 2
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'Granulat PP', 'PALETA_BIGBAG', 'PALETA_BIGBAG', 18.0);

-- Zlecenie 3
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Cement workowy', 'PALETA', 'PALETA', 12.0);

-- Zlecenie 4
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 16.0),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'Granulat PP',    'PALETA_BIGBAG', 'PALETA_BIGBAG', 8.0);

-- Zlecenie 5
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Złom stalowy', 'LUZEM', 'LUZEM', 20.0);

-- Zlecenie 6
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000005', 'Odpady przemysłowe', 'KOSZE', 'KOSZE', 3.0);

-- Zlecenie 8
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'Granulat PP', 'PALETA_BIGBAG', 'PALETA_BIGBAG', 2.0),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Cement workowy', 'PALETA', 'PALETA', 1.2);

COMMIT;
