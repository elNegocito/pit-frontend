-- ASG Operations / PIT #2
-- Migration 010: public haulers leaderboard (/leaderboard, no login).
--
-- Drivers open a link to see who hauls the most: monthly ranking (resets on
-- the 1st) and yearly totals. Only aggregate drivers (pay_model 'trucking',
-- shown as "Aggregate"), only active pay sheets.
--
-- The page is public, so the anon role must NOT read pay_sheets / drivers.
-- These SECURITY DEFINER functions expose only what the ranking needs: an
-- opaque driver id, a short name (first name + last initial), loads and
-- tons per month. No money, no full names, no contact data.
--
-- Each load counts in the month of its own date (pay date when the load has
-- none). Tons come from the load's free-text "Tons" column when it is a
-- plain number ("24.34"); anything else counts as 0 tons but still 1 load.

CREATE OR REPLACE FUNCTION public.public_driver_production(p_year integer)
RETURNS TABLE (driver_id uuid, driver_label text, month integer, loads integer, tons numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH l AS (
    SELECT
      s.driver_id,
      COALESCE(NULLIF(x->>'date', '')::date, s.pay_date) AS day,
      CASE WHEN btrim(x->>'extra') ~ '^\d+(\.\d+)?$' THEN btrim(x->>'extra')::numeric ELSE 0 END AS tons
    FROM public.pay_sheets s
    CROSS JOIN LATERAL jsonb_array_elements(s.loads) AS x
    WHERE s.status = 'active' AND s.pay_model = 'trucking'
  )
  SELECT
    l.driver_id,
    initcap(split_part(d.name, ' ', 1))
      || COALESCE(' ' || upper(left(NULLIF(split_part(d.name, ' ', 2), ''), 1)) || '.', ''),
    extract(month FROM l.day)::integer,
    count(*)::integer,
    round(sum(l.tons), 2)
  FROM l
  JOIN public.drivers d ON d.id = l.driver_id
  WHERE extract(year FROM l.day) = p_year
  GROUP BY l.driver_id, d.name, extract(month FROM l.day);
$$;

-- Years that have aggregate loads (for the year picker), newest first.
CREATE OR REPLACE FUNCTION public.public_driver_production_years()
RETURNS SETOF integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT extract(year FROM COALESCE(NULLIF(x->>'date', '')::date, s.pay_date))::integer AS y
  FROM public.pay_sheets s
  CROSS JOIN LATERAL jsonb_array_elements(s.loads) AS x
  WHERE s.status = 'active' AND s.pay_model = 'trucking'
  ORDER BY y DESC;
$$;

REVOKE ALL ON FUNCTION public.public_driver_production(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_driver_production_years() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_driver_production(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_driver_production_years() TO anon, authenticated;
