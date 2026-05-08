-- =============================================================
-- Migration: 058_create_get_session_finance
-- Computes per-session finance metrics in the database.
-- Admin-only via explicit auth check inside the function.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_session_finance(p_session_id UUID DEFAULT NULL)
RETURNS TABLE (
  session_id UUID,
  date DATE,
  name TEXT,
  fee_per_player NUMERIC(10,2),
  court_cost NUMERIC(10,2),
  paid_count BIGINT,
  total_count BIGINT,
  revenue NUMERIC(10,2),
  shuttle_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  profit NUMERIC(10,2),
  total_shuttles_logged NUMERIC(10,1)
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH registration_totals AS (
    SELECT
      sr.session_id,
      COUNT(*) FILTER (WHERE sr.paid) AS paid_count,
      COUNT(*) AS total_count
    FROM public.session_registrations sr
    GROUP BY sr.session_id
  ),
  usage_totals AS (
    SELECT
      su.session_id,
      COALESCE(SUM(su.shuttles_used * (sb.cost_per_tube / 12.0)), 0)::NUMERIC(10,2) AS shuttle_cost,
      COALESCE(SUM(su.shuttles_used), 0)::NUMERIC(10,1) AS total_shuttles_logged
    FROM public.shuttle_usage su
    JOIN public.shuttle_batches sb ON sb.id = su.batch_id
    GROUP BY su.session_id
  )
  SELECT
    s.id AS session_id,
    s.date,
    s.name,
    COALESCE(s.price, 0)::NUMERIC(10,2) AS fee_per_player,
    s.court_cost,
    COALESCE(rt.paid_count, 0) AS paid_count,
    COALESCE(rt.total_count, 0) AS total_count,
    (COALESCE(s.price, 0) * COALESCE(rt.paid_count, 0))::NUMERIC(10,2) AS revenue,
    COALESCE(ut.shuttle_cost, 0)::NUMERIC(10,2) AS shuttle_cost,
    (COALESCE(ut.shuttle_cost, 0) + COALESCE(s.court_cost, 0))::NUMERIC(10,2) AS total_cost,
    (
      (COALESCE(s.price, 0) * COALESCE(rt.paid_count, 0))
      - COALESCE(ut.shuttle_cost, 0)
      - COALESCE(s.court_cost, 0)
    )::NUMERIC(10,2) AS profit,
    COALESCE(ut.total_shuttles_logged, 0)::NUMERIC(10,1) AS total_shuttles_logged
  FROM public.sessions s
  LEFT JOIN registration_totals rt ON rt.session_id = s.id
  LEFT JOIN usage_totals ut ON ut.session_id = s.id
  WHERE p_session_id IS NULL OR s.id = p_session_id
  ORDER BY s.date DESC, s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_finance(UUID) TO authenticated;
