-- Migration: 082_payment_exempt_players
-- Players who don't pay the session fee (typically the admin), managed on
-- Payment Settings. They skip the payment steps and finance stops counting
-- them as unpaid.
--
-- REVENUE IS UNTOUCHED. It stays `price * COUNT(paid)`, and an exempt player
-- is never confirmed paid, so adding someone to the list cannot remove money.
--
-- The flag is SNAPSHOTTED on each registration rather than looked up live, so
-- a completed session keeps the numbers it closed with. Adding or removing a
-- player updates only their registrations in sessions that are not complete.
-- A registration already confirmed `paid` stays paid either way: `paid`
-- dominates in derivePaymentState and in due_count below.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. The list
-- ---------------------------------------------------------------
CREATE TABLE public.payment_exempt_players (
  player_id UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.payment_exempt_players ENABLE ROW LEVEL SECURITY;

-- Admin-only: players learn their own status from their registration row,
-- which they can already read, so the list itself never needs to be public.
CREATE POLICY "payment_exempt_players: admin all"
  ON public.payment_exempt_players
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, DELETE ON public.payment_exempt_players TO authenticated;

-- ---------------------------------------------------------------
-- 2. The per-registration snapshot
-- ---------------------------------------------------------------
ALTER TABLE public.session_registrations
  ADD COLUMN payment_exempt BOOLEAN NOT NULL DEFAULT false;

-- Set on every insert from the list, overwriting whatever the client sent, so
-- a player registering themselves cannot claim an exemption. SECURITY DEFINER
-- because the registering player cannot read the admin-only list.
CREATE OR REPLACE FUNCTION public.set_registration_payment_exempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.payment_exempt := EXISTS (
    SELECT 1 FROM public.payment_exempt_players pe WHERE pe.player_id = NEW.player_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_registration_payment_exempt
  BEFORE INSERT ON public.session_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_registration_payment_exempt();

-- Keeps open sessions in step with the list. Completed sessions are left alone
-- on purpose — see the header.
CREATE OR REPLACE FUNCTION public.sync_payment_exempt_registrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_player UUID := COALESCE(NEW.player_id, OLD.player_id);
BEGIN
  UPDATE public.session_registrations sr
  SET payment_exempt = (TG_OP = 'INSERT')
  FROM public.sessions s
  WHERE s.id = sr.session_id
    AND s.status <> 'complete'
    AND sr.player_id = v_player;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_payment_exempt_registrations
  AFTER INSERT OR DELETE ON public.payment_exempt_players
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_exempt_registrations();

-- ---------------------------------------------------------------
-- 3. Finance: two new counts. Every existing column keeps its value.
--    due_count    = registrations expected to pay (paid, or not exempt)
--    exempt_count = exempt and not paid
-- Return type changes, so DROP + CREATE + re-GRANT, as in 060/065/074.
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_session_finance(UUID);

CREATE OR REPLACE FUNCTION public.get_session_finance(p_session_id UUID DEFAULT NULL)
RETURNS TABLE (
  session_id UUID,
  date DATE,
  name TEXT,
  fee_per_player NUMERIC(10,2),
  court_cost NUMERIC(10,2),
  personal_share_override NUMERIC(10,2),
  shuttle_allocation_mode public.shuttle_allocation_mode,
  paid_count BIGINT,
  total_count BIGINT,
  revenue NUMERIC(10,2),
  shuttle_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  effective_personal_share NUMERIC(10,2),
  profit NUMERIC(10,2),
  profit_after_personal_share NUMERIC(10,2),
  total_shuttles_logged NUMERIC(10,1),
  status public.session_status,
  due_count BIGINT,
  exempt_count BIGINT
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
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE sr.paid OR NOT sr.payment_exempt) AS due_count,
      COUNT(*) FILTER (WHERE sr.payment_exempt AND NOT sr.paid) AS exempt_count
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
  ),
  finance_base AS (
    SELECT
      s.id AS session_id,
      s.date,
      s.name,
      COALESCE(s.price, 0)::NUMERIC(10,2) AS fee_per_player,
      s.court_cost,
      s.personal_share_override,
      s.shuttle_allocation_mode,
      COALESCE(rt.paid_count, 0) AS paid_count,
      COALESCE(rt.total_count, 0) AS total_count,
      (COALESCE(s.price, 0) * COALESCE(rt.paid_count, 0))::NUMERIC(10,2) AS revenue,
      COALESCE(ut.shuttle_cost, 0)::NUMERIC(10,2) AS shuttle_cost,
      (COALESCE(ut.shuttle_cost, 0) + COALESCE(s.court_cost, 0))::NUMERIC(10,2) AS total_cost,
      (
        (
          COALESCE(s.price, 0) * COALESCE(rt.paid_count, 0)
        )
        - COALESCE(ut.shuttle_cost, 0)
        - COALESCE(s.court_cost, 0)
      )::NUMERIC(10,2) AS profit,
      COALESCE(ut.total_shuttles_logged, 0)::NUMERIC(10,1) AS total_shuttles_logged,
      COALESCE(rt.due_count, 0) AS due_count,
      COALESCE(rt.exempt_count, 0) AS exempt_count
    FROM public.sessions s
    LEFT JOIN registration_totals rt ON rt.session_id = s.id
    LEFT JOIN usage_totals ut ON ut.session_id = s.id
  )
  SELECT
    fb.session_id,
    fb.date,
    fb.name,
    fb.fee_per_player,
    fb.court_cost,
    fb.personal_share_override,
    fb.shuttle_allocation_mode,
    fb.paid_count,
    fb.total_count,
    fb.revenue,
    fb.shuttle_cost,
    fb.total_cost,
    COALESCE(fb.personal_share_override, 0)::NUMERIC(10,2) AS effective_personal_share,
    fb.profit,
    (
      fb.profit - COALESCE(fb.personal_share_override, 0)
    )::NUMERIC(10,2) AS profit_after_personal_share,
    fb.total_shuttles_logged,
    s.status,
    fb.due_count,
    fb.exempt_count
  FROM finance_base fb
  JOIN public.sessions s ON s.id = fb.session_id
  WHERE p_session_id IS NULL OR fb.session_id = p_session_id
  ORDER BY fb.date DESC, s.created_at DESC;
END;
$$;

-- Re-grant: DROP FUNCTION discards the function's privileges.
GRANT EXECUTE ON FUNCTION public.get_session_finance(UUID) TO authenticated;
