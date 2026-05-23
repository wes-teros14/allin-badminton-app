# Stack Research: v1.3 Split Match Scoring

## Existing Stack

- React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui primitives
- Supabase Postgres, Auth, Realtime, RLS, SQL migrations
- Current scoring persistence is `match_results(match_id, winning_pair_index, completed_at)`
- Current match lifecycle is `matches.status`: `queued`, `playing`, `complete`

## Stack Additions

No new npm packages are needed.

## Database Implications

Use Supabase migration SQL:

- Add a session-level split setting, likely `sessions.split_match_scoring boolean not null default false`.
- Add game sequencing to result rows, likely `match_results.game_number integer not null default 1`.
- Add a uniqueness rule such as `unique(match_id, game_number)` to prevent duplicate game rows.
- Keep `winning_pair_index in (1, 2)` because a 1-1 split can be represented as two rows with opposite winners.

## TypeScript Implications

Update `src/types/database.ts` after migration or manually keep types in sync if Supabase CLI remains blocked.

