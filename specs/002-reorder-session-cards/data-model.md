# Phase 1 Data Model: Reorder Session Cards by Soonest Scheduled Date

No new entities, fields, or state transitions are introduced by this feature. It reorders an existing, already-fetched list — it does not change what data exists or how it is stored.

## Existing Entity (unchanged shape)

### Session (`SessionPickerItem`, `badminton-v2/src/hooks/usePlayerSessions.ts`)

Fields relevant to this feature's ordering rule (full shape is unchanged — listed here only for context):

| Field | Type | Relevance to ordering |
|---|---|---|
| `date` | `string` (`YYYY-MM-DD`) | Primary sort key — ascending for active/upcoming sessions, descending for past sessions |
| `time` | `string \| null` | Secondary sort key (tiebreaker) when two sessions share the same `date`; `null` sorts after a set time on the same date |
| `status` | `string` | Determines which group (active vs. past) a session falls into via the existing `ACTIVE_STATUSES` set — unaffected by this feature |

## Validation Rules

- A session missing `time` MUST still sort deterministically by `date` alone (FR-005) — no exception thrown, no session dropped from the rendered list.
- Sort MUST be stable for sessions that are fully identical on `date` and `time` (arbitrary but non-reshuffling order across renders).

## State Transitions

None. This feature does not change session status, registration state, or any persisted value — display ordering only.
