-- Tabela odbiorców raportu tygodniowego magazynu.
-- Stała lista email per oddział (zmienia się raz na pół roku).
-- Zarządzanie: ADMIN w panelu — brak UI do zarządzania w MVP.

CREATE TABLE public.warehouse_report_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  name varchar(200),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unikalne: jeden email per lokalizacja (case-insensitive)
CREATE UNIQUE INDEX wrr_location_email_uq
  ON public.warehouse_report_recipients (location_id, lower(email));

-- Indeks FK dla szybkiego filtrowania per lokalizacja
CREATE INDEX wrr_location_id_idx
  ON public.warehouse_report_recipients (location_id);

-- RLS
ALTER TABLE public.warehouse_report_recipients ENABLE ROW LEVEL SECURITY;

-- Wszyscy zalogowani mogą czytać (potrzebne do wyświetlenia listy odbiorców)
CREATE POLICY "select_recipients" ON public.warehouse_report_recipients
  FOR SELECT TO authenticated USING (true);

-- Tylko ADMIN może dodawać/edytować/usuwać
CREATE POLICY "manage_recipients" ON public.warehouse_report_recipients
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );
