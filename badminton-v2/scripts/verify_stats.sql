SELECT p.nickname, ps.games_played, ps.wins, ps.sessions_attended
FROM public.player_stats ps
JOIN public.profiles p ON p.id = ps.player_id
WHERE ps.player_id IN (
  'a3f001e3-661e-4d7a-9eb2-dd5c8df852ea',
  '23b0b7ed-ce8a-4f08-a7bf-d8867b223b84',
  'b9c66c3f-f2ce-4e86-9f76-2fefcc0db942',
  '8870526d-2d15-48f2-a2a4-06a49b99a4da',
  '6e8e65c2-a7f7-42b6-9de5-3012123f11df'
)
ORDER BY p.nickname;
