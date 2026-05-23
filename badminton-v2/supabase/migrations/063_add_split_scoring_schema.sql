-- =============================================================
-- Migration: 063_add_split_scoring_schema
-- Adds a session-level split scoring flag and game-level result numbering.
-- Safe to run in the Supabase Dashboard SQL Editor if local CLI remains blocked.
-- =============================================================

-- Session-level scoring format flag. Default false preserves current one-game behavior.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS split_match_scoring BOOLEAN NOT NULL DEFAULT false;

-- Normalize match results to a game-level contract without requiring null-handling.
ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS game_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.match_results
  DROP CONSTRAINT IF EXISTS match_results_game_number_check;

ALTER TABLE public.match_results
  ADD CONSTRAINT match_results_game_number_check
  CHECK (game_number >= 1);

UPDATE public.match_results
SET game_number = 1
WHERE game_number IS NULL;

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Remove any unique constraint or unique index that still enforces one row per match.
  FOR rec IN
    SELECT con.conname AS object_name, 'constraint' AS object_kind
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'match_results'
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY ord.ordinality)
        FROM unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality)
        JOIN pg_attribute att
          ON att.attrelid = rel.oid
         AND att.attnum = ord.attnum
      ) = ARRAY['match_id']

    UNION ALL

    SELECT idx.indexrelid::regclass::text AS object_name, 'index' AS object_kind
    FROM pg_index idx
    JOIN pg_class rel ON rel.oid = idx.indrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'match_results'
      AND idx.indisunique
      AND NOT idx.indisprimary
      AND (
        SELECT array_agg(att.attname::text ORDER BY ord.ordinality)
        FROM unnest(idx.indkey) WITH ORDINALITY AS ord(attnum, ordinality)
        JOIN pg_attribute att
          ON att.attrelid = rel.oid
         AND att.attnum = ord.attnum
      ) = ARRAY['match_id']
  LOOP
    IF rec.object_kind = 'constraint' THEN
      EXECUTE format('ALTER TABLE public.match_results DROP CONSTRAINT IF EXISTS %I', rec.object_name);
    ELSE
      EXECUTE format('DROP INDEX IF EXISTS %s', rec.object_name);
    END IF;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS match_results_match_id_game_number_key
  ON public.match_results (match_id, game_number);
