-- =============================================================
-- Maintenance: find matches that list the same player in two slots.
-- Run this BEFORE migration 079 — that migration refuses to apply while any
-- such row exists. Read-only; fix anything it returns by editing the match in
-- the admin UI (or with the UPDATE at the bottom).
-- =============================================================

SELECT
  m.id                AS match_id,
  s.name              AS session_name,
  s.date              AS session_date,
  m.queue_position    AS game_number,
  m.status,
  COALESCE(p1.nickname, p1.name_slug) AS t1p1,
  COALESCE(p2.nickname, p2.name_slug) AS t1p2,
  COALESCE(p3.nickname, p3.name_slug) AS t2p1,
  COALESCE(p4.nickname, p4.name_slug) AS t2p2
FROM public.matches m
JOIN public.sessions s  ON s.id = m.session_id
LEFT JOIN public.profiles p1 ON p1.id = m.team1_player1_id
LEFT JOIN public.profiles p2 ON p2.id = m.team1_player2_id
LEFT JOIN public.profiles p3 ON p3.id = m.team2_player1_id
LEFT JOIN public.profiles p4 ON p4.id = m.team2_player2_id
WHERE m.team1_player1_id IN (m.team1_player2_id, m.team2_player1_id, m.team2_player2_id)
   OR m.team1_player2_id IN (m.team2_player1_id, m.team2_player2_id)
   OR m.team2_player1_id = m.team2_player2_id
ORDER BY s.date DESC, m.queue_position;

-- Related: players who share a display name. Not a data error, but two
-- different people both nicknamed "Alexis" render identically, which is how a
-- legitimate match can *look* like it has a duplicate. The app now qualifies
-- these (e.g. "Alexis (Cruz)"); this lists who is affected.
SELECT
  COALESCE(nickname, name_slug) AS display_name,
  count(*)                      AS players,
  array_agg(name_slug ORDER BY name_slug) AS name_slugs
FROM public.profiles
WHERE is_active
GROUP BY 1
HAVING count(*) > 1
ORDER BY 2 DESC, 1;

-- Fix template — replace the ids, then re-run the first query to confirm clean:
-- UPDATE public.matches SET team1_player2_id = '<correct-player-uuid>' WHERE id = '<match-uuid>';
