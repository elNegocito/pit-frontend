-- ASG Operations / PIT #2
-- Migration 012: CTAL (carriers, weekly load log, statements, billing, profit).
--
-- Ported from the client's Google Sheet "CTAL CARRIER REGIST" and the weekly
-- Excel template "CTAL <week>.xlsx" (sheets Log / Statements / ASG /
-- Ready Mix / Excavation / Billins / Profit). Admin-only: the owner is the
-- single user of this section.
--
-- Additive only: nothing that exists is changed.
--
--   * ctal_carriers           : contractor registry (the Google Sheet).
--   * ctal_carrier_documents  : insurance, contract, CDL... files, stored in
--                               the private Storage bucket "ctal-docs".
--   * ctal_customers          : who the load was hauled for, with the default
--                               rules of that job (unit, rates, fee, FSC).
--                               Entered in the app: no customer data is seeded.
--   * ctal_weeks              : one per week (Sunday to Saturday), paid on
--                               the Friday after.
--   * ctal_loads              : the "Log" sheet. Amounts are computed and
--                               frozen by a trigger.
--   * ctal_statements         : per carrier and week: link to the tickets on
--                               the owner's server, and when it was emailed.
--
-- Excel formulas (per log row):
--   carrier amount = qty x carrier rate   (TON, HR)   |  carrier rate x 1 (YDS, LOAD)
--   broker amount  = qty x broker rate    (TON, HR)   |  broker rate x 1  (YDS, LOAD)
--   quick pay fee  = -(carrier amount x 3.5%)         every job except...
--   broker fee     = -(carrier amount x 8%)           ...the jobs set to broker fee
--   FSC $          = carrier amount x FSC %  |  a fixed amount per load  |  0
-- Statement total = carrier amount + broker fee + quick pay fee + FSC $.
-- Billing total   = broker amount + FSC $.

-- ---------------------------------------------------------------- carriers
CREATE TABLE public.ctal_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The sheet's own number (3001, 3002...). Filled by trigger when missing.
  carrier_number integer NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  name_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) STORED UNIQUE,
  -- QP = quick pay (3.5% fee by default); 28 = paid at 28 days (no fee).
  pay_term text NOT NULL DEFAULT 'QP' CHECK (pay_term IN ('QP', '28')),
  dispatch_contact text CHECK (dispatch_contact IS NULL OR char_length(dispatch_contact) <= 120),
  owner text CHECK (owner IS NULL OR char_length(owner) <= 120),
  -- Free text like the sheet: driver, truck number, trailer type.
  equipment text CHECK (equipment IS NULL OR char_length(equipment) <= 200),
  ins_exp date,
  -- What the sheet shows instead of a date: EXPIRED, CONTACTED...
  ins_note text CHECK (ins_note IS NULL OR char_length(ins_note) <= 60),
  hub_city text CHECK (hub_city IS NULL OR char_length(hub_city) <= 80),
  usdot text CHECK (usdot IS NULL OR char_length(usdot) <= 20),
  -- Where statements are sent.
  email text CHECK (email IS NULL OR char_length(email) <= 120),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  -- Link to this carrier's tickets folder on the owner's own server.
  tickets_url text CHECK (tickets_url IS NULL OR char_length(tickets_url) <= 500),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.ctal_carrier_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.carrier_number IS NULL THEN
    SELECT COALESCE(max(carrier_number), 3000) + 1 INTO NEW.carrier_number FROM public.ctal_carriers;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ctal_carriers_number_bi
  BEFORE INSERT ON public.ctal_carriers
  FOR EACH ROW EXECUTE FUNCTION public.ctal_carrier_number();

CREATE TRIGGER ctal_carriers_touch_updated_at
  BEFORE UPDATE ON public.ctal_carriers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- documents
CREATE TABLE public.ctal_carrier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES public.ctal_carriers (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('insurance', 'contract', 'cdl', 'w9', 'other')),
  label text CHECK (label IS NULL OR char_length(label) <= 120),
  -- Object name inside the "ctal-docs" bucket: <carrier id>/<uuid>-<file name>.
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  mime text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  expires_on date,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ctal_carrier_documents_carrier_idx ON public.ctal_carrier_documents (carrier_id, uploaded_at DESC);

-- ---------------------------------------------------------------- customers
CREATE TABLE public.ctal_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  name_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) STORED UNIQUE,
  -- Which company bills this job (the Excel sheets ASG / Ready Mix / Excavation).
  bill_to text NOT NULL DEFAULT 'asg' CHECK (bill_to IN ('asg', 'ready_mix', 'excavation')),
  -- Defaults copied onto each new log row (every row stays editable).
  default_unit text NOT NULL DEFAULT 'TON' CHECK (default_unit IN ('TON', 'YDS', 'LOAD', 'HR')),
  broker_rate numeric(10, 4) NOT NULL DEFAULT 0 CHECK (broker_rate >= 0),
  carrier_rate numeric(10, 4) NOT NULL DEFAULT 0 CHECK (carrier_rate >= 0),
  fee_kind text NOT NULL DEFAULT 'quick_pay' CHECK (fee_kind IN ('quick_pay', 'broker_fee')),
  fee_pct numeric(6, 3) NOT NULL DEFAULT 3.5 CHECK (fee_pct BETWEEN 0 AND 100),
  fsc_mode text NOT NULL DEFAULT 'none' CHECK (fsc_mode IN ('none', 'percent', 'fixed')),
  -- percent: % of the carrier amount; fixed: dollars per load.
  fsc_value numeric(10, 4) NOT NULL DEFAULT 0 CHECK (fsc_value >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ctal_customers_touch_updated_at
  BEFORE UPDATE ON public.ctal_customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- weeks
CREATE TABLE public.ctal_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always a Sunday; the week ends the Saturday after.
  week_start date NOT NULL UNIQUE CHECK (extract(dow FROM week_start) = 0),
  -- Invoices arrive on Monday and are paid that Friday (week_start + 12).
  pay_date date NOT NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ctal_weeks_touch_updated_at
  BEFORE UPDATE ON public.ctal_weeks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- loads
CREATE TABLE public.ctal_loads (
  -- Generated by the app so a row keeps its id from the first keystroke.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.ctal_weeks (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  -- Invoices can include loads hauled weeks before, so any date is allowed.
  load_date date NOT NULL,
  carrier_id uuid NOT NULL REFERENCES public.ctal_carriers (id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.ctal_customers (id) ON DELETE RESTRICT,
  -- Snapshots: renaming a carrier / customer never rewrites past weeks.
  carrier_name text NOT NULL,
  customer_name text NOT NULL,
  bill_to text NOT NULL CHECK (bill_to IN ('asg', 'ready_mix', 'excavation')),
  truck text CHECK (truck IS NULL OR char_length(truck) <= 40),
  driver text CHECK (driver IS NULL OR char_length(driver) <= 80),
  ticket text CHECK (ticket IS NULL OR char_length(ticket) <= 40),
  quantity numeric(10, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'TON' CHECK (unit IN ('TON', 'YDS', 'LOAD', 'HR')),
  broker_rate numeric(10, 4) NOT NULL DEFAULT 0 CHECK (broker_rate >= 0),
  carrier_rate numeric(10, 4) NOT NULL DEFAULT 0 CHECK (carrier_rate >= 0),
  fee_kind text NOT NULL DEFAULT 'quick_pay' CHECK (fee_kind IN ('quick_pay', 'broker_fee')),
  fee_pct numeric(6, 3) NOT NULL DEFAULT 3.5 CHECK (fee_pct BETWEEN 0 AND 100),
  fsc_mode text NOT NULL DEFAULT 'none' CHECK (fsc_mode IN ('none', 'percent', 'fixed')),
  fsc_value numeric(10, 4) NOT NULL DEFAULT 0 CHECK (fsc_value >= 0),

  -- Computed + frozen by ctal_loads_compute_biu (any client value is
  -- overwritten). 4 decimals like the Excel cells; totals round to cents.
  carrier_amount numeric(12, 4) NOT NULL DEFAULT 0,
  broker_amount numeric(12, 4) NOT NULL DEFAULT 0,
  broker_fee numeric(12, 4) NOT NULL DEFAULT 0,
  quick_pay_fee numeric(12, 4) NOT NULL DEFAULT 0,
  fsc_amount numeric(12, 4) NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ctal_loads_week_idx ON public.ctal_loads (week_id, position);
CREATE INDEX ctal_loads_carrier_idx ON public.ctal_loads (carrier_id, created_at DESC);
CREATE INDEX ctal_loads_ticket_idx ON public.ctal_loads (ticket);

-- Single source of truth for the amounts (mirrored in lib/ctal/compute.ts for
-- the live preview).
CREATE OR REPLACE FUNCTION public.compute_ctal_load()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  -- YDS and LOAD are paid per load: the rate counts once whatever the quantity.
  factor numeric := CASE WHEN NEW.unit IN ('TON', 'HR') THEN NEW.quantity ELSE 1 END;
  fee numeric;
BEGIN
  NEW.carrier_amount := round(factor * NEW.carrier_rate, 4);
  NEW.broker_amount := round(factor * NEW.broker_rate, 4);
  fee := -round(NEW.carrier_amount * NEW.fee_pct / 100, 4);
  IF NEW.fee_kind = 'broker_fee' THEN
    NEW.broker_fee := fee;
    NEW.quick_pay_fee := 0;
  ELSE
    NEW.broker_fee := 0;
    NEW.quick_pay_fee := fee;
  END IF;
  NEW.fsc_amount := CASE NEW.fsc_mode
    WHEN 'percent' THEN round(NEW.carrier_amount * NEW.fsc_value / 100, 4)
    WHEN 'fixed' THEN NEW.fsc_value
    ELSE 0
  END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ctal_loads_compute_biu
  BEFORE INSERT OR UPDATE ON public.ctal_loads
  FOR EACH ROW EXECUTE FUNCTION public.compute_ctal_load();

-- ---------------------------------------------------------------- statements
CREATE TABLE public.ctal_statements (
  week_id uuid NOT NULL REFERENCES public.ctal_weeks (id) ON DELETE CASCADE,
  carrier_id uuid NOT NULL REFERENCES public.ctal_carriers (id) ON DELETE CASCADE,
  -- Link to that week's tickets on the owner's server (no files stored here).
  tickets_url text CHECK (tickets_url IS NULL OR char_length(tickets_url) <= 500),
  emailed_at timestamptz,
  emailed_to text,
  PRIMARY KEY (week_id, carrier_id)
);

-- ---------------------------------------------------------------- RLS
-- Everything here is admin-only.
ALTER TABLE public.ctal_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctal_carrier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctal_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctal_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctal_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctal_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY ctal_carriers_admin ON public.ctal_carriers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ctal_carrier_documents_admin ON public.ctal_carrier_documents
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ctal_customers_admin ON public.ctal_customers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ctal_weeks_admin ON public.ctal_weeks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ctal_loads_admin ON public.ctal_loads
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ctal_statements_admin ON public.ctal_statements
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------- storage
-- Private bucket for carrier paperwork (PDF + photos, 20 MB each).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ctal-docs', 'ctal-docs', false, 20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ctal_docs_admin_select ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ctal-docs' AND public.is_admin());
CREATE POLICY ctal_docs_admin_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ctal-docs' AND public.is_admin());
CREATE POLICY ctal_docs_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ctal-docs' AND public.is_admin())
  WITH CHECK (bucket_id = 'ctal-docs' AND public.is_admin());
CREATE POLICY ctal_docs_admin_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ctal-docs' AND public.is_admin());
