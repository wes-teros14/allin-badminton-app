-- Step 3: Delete all match results for the session
-- Run this AFTER steps 1 and 2
-- Session: d37974e0-90a8-4233-b7c0-8a4cdce3bb24

DELETE FROM public.match_results
WHERE match_id IN (
  SELECT id FROM public.matches WHERE session_id = 'd37974e0-90a8-4233-b7c0-8a4cdce3bb24'
);
