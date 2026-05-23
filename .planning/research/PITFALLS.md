# Pitfalls Research: v1.3 Split Match Scoring

## Duplicate Result Rows

Risk: double-clicking finish or concurrent live board/admin actions could insert duplicate game rows.

Prevention: enforce `unique(match_id, game_number)` and preserve the existing `matches.status = playing` update guard before inserts.

## Readers Only Using First Result

Risk: split matches appear as 1 game instead of 2, especially for `1-1`.

Prevention: update all result readers to aggregate every result row, not `match_results[0]`.

## Stats Reversal

Risk: `reverse_session_stats` must subtract all result rows for a session. It already joins all `match_results`, but should be reviewed after adding `game_number`.

Prevention: include reverse function verification in the DB phase.

## Match Versus Game Language

Risk: UI currently labels scheduled matches as "Game N". Split mode could make "Game 1, Game 1.1" confusing.

Prevention: keep scheduled queue label as "Match N" or "Game N" consistently, but make result entry explicit: "Game 1 winner" and "Game 2 winner" inside the same scheduled match.

## Backward Compatibility

Risk: old result rows have no game number.

Prevention: migration default `game_number = 1` preserves existing completed matches.

