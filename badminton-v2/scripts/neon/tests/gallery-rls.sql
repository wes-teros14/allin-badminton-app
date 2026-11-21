-- Gallery rules test (migration 092). Runs on Neon dev and ALWAYS rolls back: it ends by raising
-- the report as an error, so nothing it changes is kept.
--   node scripts/neon/run-dev.mjs scripts/neon/tests/gallery-rls.sql
-- Expect the "rolled back:" line to list only PASS rows.
DO $$
DECLARE
  live  uuid := 'dddddddd-0000-4000-8000-000000000005';  -- Dev Live Session (in_progress)
  done_ uuid := 'dddddddd-0000-4000-8000-000000000004';  -- Dev Session 4 (complete)
  admin_ uuid := 'd5b89b34-afe0-4b5a-9cba-68aa2756898d';
  mod_  uuid := '2754a4d9-d34a-4327-a30c-04a55cc6e97c';  -- John
  jane  uuid := 'de296a4b-6446-436d-8ad8-ab712cd190bb';
  joe   uuid := '5ea161e2-5575-4cbb-b5f9-d970912babc8';
  dana  uuid := '3bf1d8d6-003a-4c4b-833b-a45eb10029c7';  -- made unregistered below
  kim   uuid := 'a9a094ad-3141-41cf-aab8-264671c7a5e9';  -- made a first-timer below
  raj   uuid := '916208b8-35e0-4fc2-81c6-8dc529fc49cc';  -- made a guest below
  report text := '';
  n int;
  pid uuid;
  jane_photo uuid;
  ok boolean;
  r record;

BEGIN
  -- ---- setup (as owner) ----
  DELETE FROM public.session_registrations WHERE session_id = live AND player_id = dana;
  UPDATE public.player_stats SET sessions_attended = 0 WHERE player_id = kim;
  UPDATE public.profiles SET is_guest = true WHERE id = raj;

  -- helper pattern: become a user
  -- (set_config is transaction-local; SET LOCAL ROLE likewise)

  -- 1. Jane uploads to the live session
  PERFORM set_config('request.jwt.claims', json_build_object('sub', jane, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.session_photos (session_id, player_id, caption, by_admin, version, ready)
    VALUES (live, jane, 'hi', true, 9, true) RETURNING id INTO jane_photo;
  SELECT by_admin, version, ready INTO r FROM public.session_photos WHERE id = jane_photo;
  report := report || format(E'\n%s 01 player uploads to live session (client flags ignored: by_admin=%s version=%s ready=%s)',
    CASE WHEN NOT r.by_admin AND r.version = 0 AND NOT r.ready THEN 'PASS' ELSE 'FAIL' END, r.by_admin, r.version, r.ready);

  -- 2. second photo in the same session
  BEGIN
    INSERT INTO public.session_photos (session_id, player_id) VALUES (live, jane);
    report := report || E'\nFAIL 02 second photo same session was allowed';
  EXCEPTION WHEN unique_violation THEN report := report || E'\nPASS 02 second photo same session refused (unique)';
  END;

  -- 3. completed session
  BEGIN
    INSERT INTO public.session_photos (session_id, player_id) VALUES (done_, jane);
    report := report || E'\nFAIL 03 upload to completed session allowed';
  EXCEPTION WHEN insufficient_privilege THEN report := report || E'\nPASS 03 upload to completed session refused';
  END;

  -- 4. upload as someone else
  BEGIN
    INSERT INTO public.session_photos (session_id, player_id) VALUES (live, joe);
    report := report || E'\nFAIL 04 upload under another player allowed';
  EXCEPTION WHEN insufficient_privilege THEN report := report || E'\nPASS 04 upload under another player refused';
  END;

  -- 5. finish upload: version 1 + ready
  UPDATE public.session_photos SET version = 1, ready = true, width = 1280, height = 960 WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 05 owner marks own photo ready (%s row)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);

  -- 6. can't move it / claim admin
  UPDATE public.session_photos SET player_id = joe, session_id = done_, by_admin = true WHERE id = jane_photo;
  SELECT player_id, session_id, by_admin INTO r FROM public.session_photos WHERE id = jane_photo;
  report := report || format(E'\n%s 06 owner cannot move photo or claim admin',
    CASE WHEN r.player_id = jane AND r.session_id = live AND NOT r.by_admin THEN 'PASS' ELSE 'FAIL' END);

  -- 7. version can't go down
  BEGIN
    UPDATE public.session_photos SET version = 0 WHERE id = jane_photo;
    report := report || E'\nFAIL 07 version went down';
  EXCEPTION WHEN check_violation THEN report := report || E'\nPASS 07 version cannot go down';
  END;
  EXECUTE 'RESET ROLE';

  -- 8. Dana not registered
  PERFORM set_config('request.jwt.claims', json_build_object('sub', dana, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.session_photos (session_id, player_id) VALUES (live, dana);
    report := report || E'\nFAIL 08 unregistered player upload allowed';
  EXCEPTION WHEN insufficient_privilege THEN report := report || E'\nPASS 08 unregistered player upload refused';
  END;
  EXECUTE 'RESET ROLE';

  -- 9. Joe (eligible) sees Jane's ready photo but can't change it
  PERFORM set_config('request.jwt.claims', json_build_object('sub', joe, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.session_photos WHERE id = jane_photo;
  report := report || format(E'\n%s 09 eligible player sees others'' ready photo (%s)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  UPDATE public.session_photos SET caption = 'hacked' WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 10 player cannot edit someone else''s photo (%s rows)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  DELETE FROM public.session_photos WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 11 player cannot delete someone else''s photo (%s rows)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- 12-13. Kim first-timer: uploads, sees only own
  PERFORM set_config('request.jwt.claims', json_build_object('sub', kim, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.session_photos (session_id, player_id) VALUES (live, kim) RETURNING id INTO pid;
  UPDATE public.session_photos SET version = 1, ready = true WHERE id = pid;
  SELECT count(*) INTO n FROM public.session_photos;
  report := report || format(E'\n%s 12 first-timer can upload and sees only own photo (sees %s)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- 14. guest sees nothing of others
  PERFORM set_config('request.jwt.claims', json_build_object('sub', raj, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.session_photos;
  report := report || format(E'\n%s 13 guest sees no photos (%s)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- 15. unready rows are private to their uploader
  PERFORM set_config('request.jwt.claims', json_build_object('sub', joe, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.session_photos (session_id, player_id) VALUES (live, joe) RETURNING id INTO pid;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', jane, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.session_photos WHERE id = pid;
  report := report || format(E'\n%s 14 others cannot see an unfinished upload (%s)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- 16. moderator = player rules (owner confirmed 2026-11-21): can upload when registered, can't edit Jane's
  PERFORM set_config('request.jwt.claims', json_build_object('sub', mod_, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.session_photos (session_id, player_id) VALUES (live, mod_) RETURNING id INTO pid;
  SELECT by_admin INTO ok FROM public.session_photos WHERE id = pid;
  UPDATE public.session_photos SET caption = 'mod edit' WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 15 moderator uploads as a player, cannot edit others (by_admin=%s, %s rows)',
    CASE WHEN NOT ok AND n = 0 THEN 'PASS' ELSE 'FAIL' END, ok, n);
  EXECUTE 'RESET ROLE';

  -- ---- session completes ----
  UPDATE public.sessions SET status = 'complete' WHERE id = live;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', jane, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.session_photos SET caption = 'late edit' WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 16 owner locked out after completion: edit (%s rows)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  DELETE FROM public.session_photos WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 17 owner locked out after completion: delete (%s rows)', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- Kim now has a completed session -> sees everyone's ready photos
  UPDATE public.player_stats SET sessions_attended = 1 WHERE player_id = kim;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', kim, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.session_photos WHERE id = jane_photo;
  report := report || format(E'\n%s 18 first-timer sees all after first completed session (%s)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- ---- admin ----
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.session_photos (session_id, player_id) VALUES (done_, admin_);
  INSERT INTO public.session_photos (session_id, player_id) VALUES (done_, admin_);
  SELECT count(*) INTO n FROM public.session_photos WHERE session_id = done_ AND player_id = admin_ AND by_admin;
  report := report || format(E'\n%s 19 admin: unlimited uploads, completed session too (%s)', CASE WHEN n = 2 THEN 'PASS' ELSE 'FAIL' END, n);
  SELECT count(*) INTO n FROM public.session_photos WHERE id = pid;  -- moderator's unfinished row
  report := report || format(E'\n%s 20 admin sees unfinished uploads (%s)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  UPDATE public.session_photos SET caption = 'admin edit' WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 21 admin edits a locked photo (%s row)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  DELETE FROM public.session_photos WHERE id = jane_photo;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || format(E'\n%s 22 admin deletes a locked photo (%s row)', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'RESET ROLE';

  -- ---- signed out ----
  BEGIN
    EXECUTE 'SET LOCAL ROLE anonymous';
    PERFORM 1 FROM public.session_photos;
    report := report || E'\nFAIL 23 signed-out read allowed';
  EXCEPTION WHEN insufficient_privilege THEN report := report || E'\nPASS 23 signed-out read refused';
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'GALLERY RLS REPORT (rolled back)%', report;
END
$$;
