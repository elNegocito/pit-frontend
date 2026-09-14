-- ASG Operations / PIT #2
-- Migration 001: core schema (customers, materials, orders, profiles)
-- Business rules ported from Excel "PIT #2":
--   R1: gross = tons * material price ONLY when payment = COD
--   R2: gross = 0 when payment = ACCOUNT (billed outside the system)
--   R3: single price per ton per material, same for all customers
--   R4: gross is frozen at dispatch time (price changes never rewrite history)
--   R5: COD payment must specify cod_method (CASH/CARD/CHECK)

-- ---------------------------------------------------------------- profiles
-- Extends Supabase Auth users with a fixed app role.
-- Users are created manually in Supabase Auth (no public signup in the app);
-- their role row is inserted afterwards (see seed.sql).
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- customers
-- Canonical customer registry. Operators create customers implicitly by typing
-- a new name in the entry form (server normalizes + upserts), admins can
-- rename/merge from the web to fix typos ("ghost customers" in the Excel).
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  -- normalized lookup key: collapsed whitespace + upper-cased.
  -- Enforced UNIQUE so "Acme", " acme " and "ACME" can never split totals.
  name_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) STORED UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_name_trgm_idx ON public.customers (name);

-- ---------------------------------------------------------------- materials
-- Single price per ton per material (R3), equal for all customers.
-- Price history is implicit: orders freeze gross at insert (R4), so editing a
-- price only affects future dispatches.
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  name_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) STORED UNIQUE,
  price_per_ton numeric(10, 2) NOT NULL CHECK (price_per_ton >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- orders
-- One row per weighbridge ticket transcription (Entry Form B3-B11).
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Business date in America/Chicago (no time component; the pit works per day).
  date date NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials (id) ON DELETE RESTRICT,
  truck_number text NOT NULL CHECK (char_length(trim(truck_number)) BETWEEN 1 AND 40),
  ticket_number text NOT NULL CHECK (char_length(trim(ticket_number)) BETWEEN 1 AND 40),
  -- Normalized ticket key: blocks the Excel's main dirt source (duplicated /
  -- mistyped tickets). Tickets are globally unique; if the pit ever recycles
  -- ticket numbers per season, replace this with UNIQUE (ticket_key, date).
  ticket_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(ticket_number), '\s+', '', 'g'))
  ) STORED,
  -- Typical quarry trucks haul 10-40 tons; cap at 200 to catch decimal typos
  -- (e.g. 250 instead of 25.0) while never blocking a real load.
  tons numeric(10, 2) NOT NULL CHECK (tons > 0 AND tons <= 200),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  payment text NOT NULL CHECK (payment IN ('ACCOUNT', 'COD')),
  cod_method text CHECK (cod_method IN ('CASH', 'CARD', 'CHECK')),
  -- Frozen dispatch amount (R4). ALWAYS written by the gross trigger below;
  -- any client-supplied value is overwritten.
  gross numeric(12, 2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- R5: COD requires a collection method; ACCOUNT must not carry one.
  CHECK (
    (payment = 'COD' AND cod_method IS NOT NULL)
    OR (payment = 'ACCOUNT' AND cod_method IS NULL)
  )
);
CREATE UNIQUE INDEX orders_ticket_key_uidx ON public.orders (ticket_key);
CREATE INDEX orders_date_idx ON public.orders (date DESC);
CREATE INDEX orders_customer_idx ON public.orders (customer_id);
CREATE INDEX orders_material_idx ON public.orders (material_id);
CREATE INDEX orders_created_at_idx ON public.orders (created_at DESC);

-- ---------------------------------------------------------------- gross trigger (R1/R2/R4)
-- Single source of truth for the amount. Fires on every INSERT and UPDATE
-- so history can never be edited into inconsistency (even a direct
-- `SET gross = ...` is recomputed) and price changes only apply going
-- forward.
CREATE OR REPLACE FUNCTION public.compute_order_gross()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  unit_price numeric(10, 2);
BEGIN
  SELECT m.price_per_ton INTO unit_price
  FROM public.materials AS m
  WHERE m.id = NEW.material_id;

  IF unit_price IS NULL THEN
    RAISE EXCEPTION 'material % does not exist', NEW.material_id;
  END IF;

  IF NEW.payment = 'COD' THEN
    NEW.gross := round(NEW.tons * unit_price, 2);
  ELSE
    NEW.gross := 0;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_compute_gross_biu
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.compute_order_gross();

-- Keep materials.updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER materials_touch_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
