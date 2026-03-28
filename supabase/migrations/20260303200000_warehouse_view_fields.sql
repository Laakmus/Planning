-- Migracja: pola wymagane przez widok magazynowy
-- 1. user_profiles.location_id (oddział użytkownika)
-- 2. Indeks na order_stops(location_id, date_local)

-- 1. Oddział użytkownika
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);

COMMENT ON COLUMN public.user_profiles.location_id IS 'Oddział magazynowy użytkownika — FK do locations. Używane przez widok magazynowy.';

-- 2. Indeks na order_stops dla wydajnego filtrowania widoku magazynowego
CREATE INDEX IF NOT EXISTS idx_order_stops_location_date
  ON public.order_stops(location_id, date_local);
