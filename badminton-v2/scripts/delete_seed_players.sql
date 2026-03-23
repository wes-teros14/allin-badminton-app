-- =============================================================
-- Delete Seed Players
-- Targets all users with @test.local emails.
-- Deleting from auth.users cascades to:
--   profiles, session_registrations, player_stats,
--   player_pair_stats, player_cheer_stats, cheers, matches
-- =============================================================

-- STEP 1: Preview who will be deleted (run this first)
SELECT id, email
FROM auth.users
WHERE email LIKE '%@test.local'
ORDER BY email;

-- STEP 2: Delete (uncomment when you're happy with the preview)
-- DELETE FROM auth.users
-- WHERE email LIKE '%@test.local';
