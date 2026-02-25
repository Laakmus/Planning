-- Seed: dane testowe dla wizualnego testowania frontendu
-- User: admin@test.pl / test1234 (ID: c94a20d0-16ca-4f9d-873a-05f31be633ff)

BEGIN;

-- ============================================================
-- 1a. Auth user (Supabase Auth) — admin@test.pl / test1234
-- ============================================================

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_sso_user, is_anonymous,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone, phone_change, phone_change_token,
  reauthentication_token, email_change_confirm_status
) VALUES (
  'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@test.pl',
  '$2a$06$aOIUYmSR6ANr0jaIvFey2eYBV0uF19yD3wUCsHvx2zfrK4dApGZmC',
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"email_verified":true}',
  false, false, false,
  now(), now(),
  '', '', '', '', '', '', '', '', '', 0
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 1b. Profil użytkownika (powiązany z auth user)
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
  ('korekta wysłane',  'Korekta_w',         'CURRENT',   false, 4),
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

-- ============================================================
-- 9. Dodatkowe firmy i lokalizacje
-- ============================================================

INSERT INTO public.companies (id, name, type, tax_id, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000008', 'EuroLog Transport GmbH',    'CARRIER',  'DE987654321',  true),
  ('a0000000-0000-0000-0000-000000000009', 'Metalurgica Poznań S.A.',   'CLIENT',   '7770009009',   true),
  ('a0000000-0000-0000-0000-000000000010', 'GreenWaste Recycling',      'CARRIER',  '5260010010',   true),
  ('a0000000-0000-0000-0000-000000000011', 'Praga Steel s.r.o.',        'CLIENT',   'CZ12345678',   true);

INSERT INTO public.locations (id, company_id, name, country, city, street_and_number, postal_code, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'Depot Hamburg',          'DE', 'Hamburg',   'Hafenstr. 44',        '20095', true),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'Zakład Metalurgiczny',   'PL', 'Poznań',    'ul. Metalowa 12',     '60-001', true),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'Sortownia Wrocław',      'PL', 'Wrocław',   'ul. Ekologiczna 7',   '50-200', true),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Terminal Kontenerowy',    'PL', 'Gdynia',    'ul. Portowa 88',      '81-001', true),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000011', 'Závod Praha',            'CZ', 'Praha',     'Průmyslová 15',       '10000', true),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000002', 'Magazyn Łódź',           'PL', 'Łódź',      'ul. Składowa 20',     '90-001', true);

INSERT INTO public.products (id, name, description, default_loading_method_code, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000006', 'Rury stalowe',       'Rury bezszwowe i spawane',       'PALETA',       true),
  ('c0000000-0000-0000-0000-000000000007', 'Drut miedziany',     'Drut Cu w szpulach',             'PALETA',       true);

-- ============================================================
-- 10. Dodatkowe zlecenia transportowe (9–20)
-- ============================================================

-- Zlecenie 9: robocze, krajowe, Katowice → Gdańsk
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sender_contact_name, sender_contact_phone,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000009', 'ZT/2026/02/008', 'robocze', 'PL', 'PLN',
  3900.00, 20.0, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'STAND_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-24', '07:00:00', '2026-02-25', '13:00:00',
  'PL', 'PL', 2026,
  'Piotr Zieliński', '+48 602 333 444',
  30, 'Przelew'
);

-- Zlecenie 10: robocze, eksport, Gdańsk → München
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, general_notes, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  carrier_cell_color, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000010', 'ZT/2026/02/009', 'robocze', 'EXP', 'EUR',
  3200.00, 22.0, 'a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',
  'MEGA_24T', 'Dokumenty celne przygotowane', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-26', '06:00:00', '2026-02-27', '18:00:00',
  'PL', 'DE', 2026,
  '#48A111', 14, 'Przelew'
);

-- Zlecenie 11: wysłane, krajowe, multi-stop: Warszawa → Łódź → Katowice → Ruda Śląska
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  last_loading_date, last_loading_time, last_unloading_date, last_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sent_at, sent_by_user_id, carrier_cell_color, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000011', 'ZT/2026/02/010', 'wysłane', 'PL', 'PLN',
  5800.00, 23.5, 'a0000000-0000-0000-0000-000000000007', 'ChemTrans International',
  'MEGA_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-23', '06:00:00', '2026-02-24', '16:00:00',
  '2026-02-23', '11:00:00', '2026-02-24', '16:00:00',
  'PL', 'PL', 2026,
  '2026-02-22T08:00:00Z', 'c94a20d0-16ca-4f9d-873a-05f31be633ff', '#FFEF5F', 21, 'Przelew'
);

-- Zlecenie 12: wysłane, kontener morski, Gdynia → Hamburg
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, required_documents_text, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sent_at, sent_by_user_id, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000012', 'ZT/2026/02/011', 'wysłane', 'EXP_K', 'EUR',
  4200.00, 24.0, 'a0000000-0000-0000-0000-000000000008', 'EuroLog Transport GmbH',
  'MEGA_24T', 'WZE, Aneks VII, CMR, Bill of Lading', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-24', '05:00:00', '2026-02-25', '14:00:00',
  'PL', 'DE', 2026,
  '2026-02-23T15:00:00Z', 'c94a20d0-16ca-4f9d-873a-05f31be633ff', 30, 'Przelew'
);

-- Zlecenie 13: korekta, krajowe, Wrocław → Poznań
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, general_notes, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000013', 'ZT/2026/02/012', 'korekta', 'PL', 'PLN',
  2600.00, 10.5, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'SOLO_12T', 'Korekta: zmiana adresu rozładunku', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-27', '09:00:00', '2026-02-27', '17:00:00',
  'PL', 'PL', 2026,
  14, 'Przelew'
);

-- Zlecenie 14: korekta wysłane, import, Berlin → Warszawa → Katowice
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  last_unloading_date, last_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sent_at, sent_by_user_id, carrier_cell_color, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000014', 'ZT/2026/02/013', 'korekta wysłane', 'IMP', 'EUR',
  3600.00, 18.5, 'a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',
  'STAND_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-22', '08:00:00', '2026-02-23', '10:00:00',
  '2026-02-23', '18:00:00',
  'DE', 'PL', 2026,
  '2026-02-21T14:00:00Z', 'c94a20d0-16ca-4f9d-873a-05f31be633ff', '#EEA727', 14, 'Przelew'
);

-- Zlecenie 15: zrealizowane, krajowe, Gdańsk → Wrocław
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000015', 'ZT/2026/01/016', 'zrealizowane', 'PL', 'PLN',
  4100.00, 23.0, 'a0000000-0000-0000-0000-000000000007', 'ChemTrans International',
  'MEGA_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-01-20', '07:00:00', '2026-01-21', '15:00:00',
  'PL', 'PL', 2026,
  30, 'Przelew'
);

-- Zlecenie 16: zrealizowane, eksport, Katowice → Berlin → München
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  last_unloading_date, last_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000016', 'ZT/2026/01/017', 'zrealizowane', 'EXP', 'EUR',
  5500.00, 24.0, 'a0000000-0000-0000-0000-000000000008', 'EuroLog Transport GmbH',
  'MEGA_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-01-15', '06:00:00', '2026-01-16', '12:00:00',
  '2026-01-16', '20:00:00',
  'PL', 'DE', 2026,
  30, 'Przelew'
);

-- Zlecenie 17: reklamacja, krajowe, Warszawa → Ruda Śląska
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, complaint_reason, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000017', 'ZT/2026/02/014', 'reklamacja', 'PL', 'PLN',
  1800.00, 2.8, 'a0000000-0000-0000-0000-000000000010', 'GreenWaste Recycling',
  'BUS_3T', 'Opóźnienie dostawy o 6h — kara umowna', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-17', '10:00:00', '2026-02-17', '18:00:00',
  'PL', 'PL', 2026,
  7, 'Przelew'
);

-- Zlecenie 18: robocze, krajowe, Poznań → Gdańsk
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sender_contact_name, sender_contact_phone, sender_contact_email,
  carrier_cell_color, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000018', 'ZT/2026/02/015', 'robocze', 'PL', 'PLN',
  3500.00, 18.0, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'STAND_24T', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-28', '08:00:00', '2026-03-01', '12:00:00',
  'PL', 'PL', 2026,
  'Marek Wiśniewski', '+48 605 666 777', 'marek.w@metalurgica.pl',
  '#25671E', 21, 'Przelew'
);

-- Zlecenie 19: wysłane, eksport, Gdańsk → Berlin (USD)
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, total_load_tons, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, required_documents_text, created_by_user_id,
  first_loading_date, first_loading_time, first_unloading_date, first_unloading_time,
  first_loading_country, first_unloading_country, transport_year,
  sent_at, sent_by_user_id, payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000019', 'ZT/2026/02/016', 'wysłane', 'EXP', 'USD',
  2900.00, 20.0, 'a0000000-0000-0000-0000-000000000004', 'SpeedCargo Sp. z o.o.',
  'MEGA_24T', 'WZE, Aneks VII, CMR', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-02-25', '07:00:00', '2026-02-26', '15:00:00',
  'PL', 'DE', 2026,
  '2026-02-24T11:00:00Z', 'c94a20d0-16ca-4f9d-873a-05f31be633ff', 14, 'Przelew'
);

-- Zlecenie 20: anulowane, krajowe
INSERT INTO public.transport_orders (
  id, order_no, status_code, transport_type_code, currency_code,
  price_amount, carrier_company_id, carrier_name_snapshot,
  vehicle_variant_code, general_notes, created_by_user_id,
  first_loading_date, first_unloading_date,
  first_loading_country, first_unloading_country, transport_year,
  payment_term_days, payment_method
) VALUES (
  'd0000000-0000-0000-0000-000000000020', 'ZT/2026/02/017', 'anulowane', 'PL', 'PLN',
  2200.00, 'a0000000-0000-0000-0000-000000000003', 'TransBud Logistyka',
  'SOLO_12T', 'Klient zrezygnował z zamówienia', 'c94a20d0-16ca-4f9d-873a-05f31be633ff',
  '2026-03-05', '2026-03-06',
  'PL', 'PL', 2026,
  30, 'Przelew'
);

-- ============================================================
-- 11. Przystanki dla nowych zleceń (9–20)
-- ============================================================

-- Zlecenie 9: L1 Katowice → U1 Gdańsk
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000009', 'LOADING',    1, '2026-02-24', '07:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000009', 'UNLOADING',  2, '2026-02-25', '13:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL');

-- Zlecenie 10: L1 Gdańsk → U1 München
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000010', 'LOADING',    1, '2026-02-26', '06:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL'),
  ('d0000000-0000-0000-0000-000000000010', 'UNLOADING',  2, '2026-02-27', '18:00:00', 'b0000000-0000-0000-0000-000000000006', 'Baustelle München',  'BerlinBau GmbH',         'Bauweg 5, 80331 München, DE');

-- Zlecenie 11: L1 Warszawa → L2 Łódź → U1 Katowice → U2 Ruda Śląska
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000011', 'LOADING',    1, '2026-02-23', '06:00:00', 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL'),
  ('d0000000-0000-0000-0000-000000000011', 'LOADING',    2, '2026-02-23', '11:00:00', 'b0000000-0000-0000-0000-000000000013', 'Magazyn Łódź',       'Recykling Plus S.A.',    'ul. Składowa 20, 90-001 Łódź, PL'),
  ('d0000000-0000-0000-0000-000000000011', 'UNLOADING',  3, '2026-02-24', '10:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000011', 'UNLOADING',  4, '2026-02-24', '16:00:00', 'b0000000-0000-0000-0000-000000000004', 'Huta - Brama Główna','Huta Silesia S.A.',      'ul. 1 Maja 100, 41-710 Ruda Śląska, PL');

-- Zlecenie 12: L1 Gdynia → U1 Hamburg
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000012', 'LOADING',    1, '2026-02-24', '05:00:00', 'b0000000-0000-0000-0000-000000000011', 'Terminal Kontenerowy','NordMetal Sp. z o.o.',   'ul. Portowa 88, 81-001 Gdynia, PL'),
  ('d0000000-0000-0000-0000-000000000012', 'UNLOADING',  2, '2026-02-25', '14:00:00', 'b0000000-0000-0000-0000-000000000008', 'Depot Hamburg',       'EuroLog Transport GmbH', 'Hafenstr. 44, 20095 Hamburg, DE');

-- Zlecenie 13: L1 Wrocław → U1 Poznań
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000013', 'LOADING',    1, '2026-02-27', '09:00:00', 'b0000000-0000-0000-0000-000000000010', 'Sortownia Wrocław',  'GreenWaste Recycling',   'ul. Ekologiczna 7, 50-200 Wrocław, PL'),
  ('d0000000-0000-0000-0000-000000000013', 'UNLOADING',  2, '2026-02-27', '17:00:00', 'b0000000-0000-0000-0000-000000000009', 'Zakład Metalurgiczny','Metalurgica Poznań S.A.','ul. Metalowa 12, 60-001 Poznań, PL');

-- Zlecenie 14: L1 Berlin → U1 Warszawa → U2 Katowice
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000014', 'LOADING',    1, '2026-02-22', '08:00:00', 'b0000000-0000-0000-0000-000000000005', 'Lager Berlin',       'BerlinBau GmbH',         'Industriestr. 22, 10115 Berlin, DE'),
  ('d0000000-0000-0000-0000-000000000014', 'UNLOADING',  2, '2026-02-23', '10:00:00', 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL'),
  ('d0000000-0000-0000-0000-000000000014', 'UNLOADING',  3, '2026-02-23', '18:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL');

-- Zlecenie 15: L1 Gdańsk → U1 Wrocław
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000015', 'LOADING',    1, '2026-01-20', '07:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL'),
  ('d0000000-0000-0000-0000-000000000015', 'UNLOADING',  2, '2026-01-21', '15:00:00', 'b0000000-0000-0000-0000-000000000007', 'Baza TransBud',      'TransBud Logistyka',     'ul. Logistyczna 3, 50-001 Wrocław, PL');

-- Zlecenie 16: L1 Katowice → U1 Berlin → U2 München
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000016', 'LOADING',    1, '2026-01-15', '06:00:00', 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000016', 'UNLOADING',  2, '2026-01-16', '12:00:00', 'b0000000-0000-0000-0000-000000000005', 'Lager Berlin',       'BerlinBau GmbH',         'Industriestr. 22, 10115 Berlin, DE'),
  ('d0000000-0000-0000-0000-000000000016', 'UNLOADING',  3, '2026-01-16', '20:00:00', 'b0000000-0000-0000-0000-000000000006', 'Baustelle München',  'BerlinBau GmbH',         'Bauweg 5, 80331 München, DE');

-- Zlecenie 17: L1 Warszawa → U1 Ruda Śląska
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000017', 'LOADING',    1, '2026-02-17', '10:00:00', 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL'),
  ('d0000000-0000-0000-0000-000000000017', 'UNLOADING',  2, '2026-02-17', '18:00:00', 'b0000000-0000-0000-0000-000000000004', 'Huta - Brama Główna','Huta Silesia S.A.',      'ul. 1 Maja 100, 41-710 Ruda Śląska, PL');

-- Zlecenie 18: L1 Poznań → U1 Gdańsk
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000018', 'LOADING',    1, '2026-02-28', '08:00:00', 'b0000000-0000-0000-0000-000000000009', 'Zakład Metalurgiczny','Metalurgica Poznań S.A.','ul. Metalowa 12, 60-001 Poznań, PL'),
  ('d0000000-0000-0000-0000-000000000018', 'UNLOADING',  2, '2026-03-01', '12:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL');

-- Zlecenie 19: L1 Gdańsk → U1 Berlin
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000019', 'LOADING',    1, '2026-02-25', '07:00:00', 'b0000000-0000-0000-0000-000000000001', 'Magazyn Główny',    'NordMetal Sp. z o.o.',   'ul. Portowa 15, 80-001 Gdańsk, PL'),
  ('d0000000-0000-0000-0000-000000000019', 'UNLOADING',  2, '2026-02-26', '15:00:00', 'b0000000-0000-0000-0000-000000000005', 'Lager Berlin',       'BerlinBau GmbH',         'Industriestr. 22, 10115 Berlin, DE');

-- Zlecenie 20: L1 Katowice → U1 Warszawa
INSERT INTO public.order_stops (order_id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot) VALUES
  ('d0000000-0000-0000-0000-000000000020', 'LOADING',    1, '2026-03-05', NULL, 'b0000000-0000-0000-0000-000000000003', 'Zakład Recyklingu',  'Recykling Plus S.A.',    'ul. Hutnicza 8, 40-001 Katowice, PL'),
  ('d0000000-0000-0000-0000-000000000020', 'UNLOADING',  2, '2026-03-06', NULL, 'b0000000-0000-0000-0000-000000000002', 'Oddział Warszawa',  'NordMetal Sp. z o.o.',   'ul. Przemysłowa 42, 02-001 Warszawa, PL');

-- ============================================================
-- 12. Pozycje towarowe dla nowych zleceń (9–20)
-- ============================================================

-- Zlecenie 9
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 20.0);

-- Zlecenie 10
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'Granulat PP', 'PALETA_BIGBAG', 'PALETA_BIGBAG', 22.0);

-- Zlecenie 11 (multi-towar)
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 12.0),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000006', 'Rury stalowe',   'PALETA', 'PALETA', 11.5);

-- Zlecenie 12
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 24.0);

-- Zlecenie 13
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'Cement workowy', 'PALETA', 'PALETA', 10.5);

-- Zlecenie 14
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000007', 'Drut miedziany', 'PALETA', 'PALETA', 8.5),
  ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000004', 'Granulat PP',    'PALETA_BIGBAG', 'PALETA_BIGBAG', 10.0);

-- Zlecenie 15
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000002', 'Złom stalowy', 'LUZEM', 'LUZEM', 23.0);

-- Zlecenie 16
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 14.0),
  ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000006', 'Rury stalowe',   'PALETA', 'PALETA', 10.0);

-- Zlecenie 17
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000005', 'Odpady przemysłowe', 'KOSZE', 'KOSZE', 2.8);

-- Zlecenie 18
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000006', 'Rury stalowe', 'PALETA', 'PALETA', 18.0);

-- Zlecenie 19
INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons) VALUES
  ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000001', 'Stal walcowana', 'PALETA', 'PALETA', 20.0);

-- (Zlecenie 20 — anulowane, bez pozycji towarowych)

COMMIT;
