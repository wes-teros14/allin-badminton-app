-- Migration 020: Enforce registration limit at DB level
--
-- Adds a BEFORE INSERT trigger on session_registrations that checks
-- the active invitation's max_players. Raises an error if the session
-- is already full, preventing race conditions where multiple players
-- could slip through a client-side-only check simultaneously.

CREATE OR REPLACE FUNCTION check_registration_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max_players INT;
  v_current_count INT;
BEGIN
  -- Look up max_players from the active invitation for this session
  SELECT max_players INTO v_max_players
  FROM session_invitations
  WHERE session_id = NEW.session_id
    AND is_active = true
  LIMIT 1;

  -- No active invitation or no limit set — allow the insert
  IF v_max_players IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing registrations for this session
  SELECT COUNT(*) INTO v_current_count
  FROM session_registrations
  WHERE session_id = NEW.session_id;

  IF v_current_count >= v_max_players THEN
    RAISE EXCEPTION 'session_full: maximum of % players already registered', v_max_players;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_registration_limit
  BEFORE INSERT ON session_registrations
  FOR EACH ROW EXECUTE FUNCTION check_registration_limit();

-- Grant service_role access to session_invitations (needed for seed script and tests)
GRANT ALL ON public.session_invitations TO service_role;
