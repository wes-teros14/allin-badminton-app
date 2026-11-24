-- "No cheers" list rules test (migration 094). Runs on Neon dev and ALWAYS rolls back: it ends by raising
-- the report as an error, so nothing it changes is kept.
--   node scripts/neon/run-dev.mjs scripts/neon/tests/no-cheer-rls.sql
-- Expect the "rolled back:" line to list only PASS rows.
DO $$
DECLARE
  admin_ uuid := 'd5b89b34-afe0-4b5a-9cba-68aa2756898d';
  mod_   uuid := '2754a4d9-d34a-4327-a30c-04a55cc6e97c';  -- John, a moderator
  jane   uuid := 'de296a4b-6446-436d-8ad8-ab712cd190bb';
  raj    uuid := '916208b8-35e0-4fc2-81c6-8dc529fc49cc';
  report text := '';
  n int;
  ok boolean;
BEGIN
  -- 1. Admin adds Raj
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.no_cheer_players (player_id, added_by) VALUES (raj, admin_);
  SELECT count(*) INTO n FROM public.no_cheer_players;
  report := report || format(E'\n%s 01 admin adds a player and sees the list (%s row)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- 2. Raj reads his own row
  PERFORM set_config('request.jwt.claims', json_build_object('sub', raj, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.no_cheer_players WHERE player_id = raj;
  report := report || format(E'\n%s 02 listed player sees own row (%s)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  -- 3. Raj cannot remove himself
  DELETE FROM public.no_cheer_players WHERE player_id = raj;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 03 listed player cannot remove own row (%s deleted)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- 4. Jane sees nothing and cannot add herself
  PERFORM set_config('request.jwt.claims', json_build_object('sub', jane, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.no_cheer_players;
  report := report || format(E'\n%s 04 other player sees no rows (%s)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  ok := true;
  BEGIN
    INSERT INTO public.no_cheer_players (player_id) VALUES (jane);
    ok := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  report := report || format(E'\n%s 05 player cannot add self', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
  EXECUTE 'RESET ROLE';

  -- 6. A moderator cannot add anyone (admin only, like Cheer later)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', mod_, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ok := true;
  BEGIN
    INSERT INTO public.no_cheer_players (player_id) VALUES (jane);
    ok := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  report := report || format(E'\n%s 06 moderator cannot add', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION '%', report;
END $$;
