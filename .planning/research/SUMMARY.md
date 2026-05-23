# Research Summary: v1.3 Split Match Scoring

## Stack Additions

No new frontend packages are needed. This is a Supabase schema + React flow change.

## Feature Table Stakes

- Session-level split-match checkbox/toggle.
- One-game mode remains unchanged.
- Split mode records two result rows for the same scheduled match.
- `2-0` and `1-1` are both valid final outcomes.
- Each inserted result row counts as one game win through the existing stats trigger.

## Recommended Architecture

Keep one scheduled `matches` row per matchup. Store split games as multiple `match_results` rows with a `game_number` column.

The existing `update_player_stats_on_result` trigger already counts every inserted result row as one game. That matches the intended rule: `2-0` gives two wins to one team, `1-1` gives one win to each team.

## Watch Out For

- Add a unique constraint on `(match_id, game_number)` to prevent duplicate split-game inserts.
- Update all readers that currently use only `match_results[0]`.
- Review `reverse_session_stats` after schema changes.
- Make the result-entry UI explicit enough that admins know they are choosing winners for Game 1 and Game 2 of the same scheduled match.

