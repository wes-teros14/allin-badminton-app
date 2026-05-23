# Feature Research: v1.3 Split Match Scoring

## Admin Session Setup

Admins need one session-level checkbox/toggle for split-match scoring. This belongs in the existing session setup/admin flow, near the other session-level fields in `SessionView.tsx`.

## Result Entry

Current result entry asks "Who won?" and inserts one `match_results` row. Split mode should ask for the two game winners for the same scheduled match:

- `2-0`: insert two result rows for the same winning pair.
- `1-1`: insert one result row for each pair.

## Live Board

The unauthenticated live board uses `CourtCard.tsx` and can insert `match_results` today via anon RLS. It must load the session split setting and present the split result options when enabled.

## Admin Court Controls

The authenticated admin court controls use `CourtTabs.tsx` and `useAdminActions.ts`. They need the same result options and insert behavior as the live board.

## Player Views And Leaderboards

Several readers currently assume only the first result row matters:

- `TodayView.tsx`
- `SessionPlayerDetailView.tsx`
- `usePlayerSchedule.ts`
- `usePlayerStats.ts`

These must aggregate all result rows for a match.

