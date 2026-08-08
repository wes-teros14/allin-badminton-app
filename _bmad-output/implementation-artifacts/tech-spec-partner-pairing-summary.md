---
title: 'Partner Pairing Summary Audit'
type: 'feature'
created: '2026-08-08'
status: 'done'
context: []
baseline_commit: 'f3728cd'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The session admin view's schedule audit panel shows Match Type Summary, Player Participation, Consecutive Game Audit, and Rest Spacing Grid — but no view of how many games each partner pair has played together, so admins can't spot over-repeated partnerships at a glance.

**Approach:** Add a "Partner Pairing Summary" audit cell, mirroring the existing `MatchTypeChart` bar-chart pattern, to the same audit grids in `MatchGeneratorPanel.tsx` (preview stage and locked stage). Tally each match's two teams as partner pairs, keyed by a sorted pair of player IDs so order doesn't matter (`"A and B"` and `"B and A"` both increment the same pair's count), and render descending by count using existing `nameMap` for display names.

## Boundaries & Constraints

**Always:** Normalize each pair key by sorting the two player IDs before counting, so order-independent duplicates merge into one tally entry. Reuse the existing `nameMap` prop convention already passed into `ParticipationChart`/`ConsecutiveAudit`/`RestSpacingChart` for name lookups. Follow `MatchTypeChart`'s exact bar-chart JSX/Tailwind structure for visual consistency.

**Ask First:** None anticipated — purely additive, mirrors an established pattern.

**Never:** Do not modify match generation/scoring logic in `matchGenerator.ts`. Do not change DB schema. Do not touch the session `status` gating already in `SessionView.tsx`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Order-independent count | Match A: team `[wes, yelli]`; Match B: team `[yelli, wes]` | Single "wes & yelli" entry with count 2 | N/A |
| No matches | `matches = []` | Component renders empty state (no rows) or nothing, matching sibling charts' empty behavior | N/A |
| Mixed team sizes across matches | Some matches have 2 teams of 2 (standard doubles) | Both team pairs per match counted as separate partnerships | N/A |

</frozen-after-approval>

## Code Map

- `badminton-v2/src/components/MatchGeneratorPanel.tsx` -- add `PartnerPairChart` component (mirrors `MatchTypeChart` at lines 940-970) and mount it in both audit grids (preview grid ~lines 567-591, locked grid ~lines 677-700), next to Match Type Summary.

## Tasks & Acceptance

**Execution:**
- [ ] `badminton-v2/src/components/MatchGeneratorPanel.tsx` -- Add `PartnerPairChart({ matches, nameMap }: { matches: GeneratedMatch[]; nameMap: Map<string,string> })` that tallies `[team1Player1, team1Player2]` and `[team2Player1, team2Player2]` per match into a `Map<string, number>` keyed by `[...pair].sort().join('|')`, sorts descending by count, and renders a bar row per pair labeled `"{name(id1)} & {name(id2)}"` -- provides the order-independent partner tally requested.
- [ ] `badminton-v2/src/components/MatchGeneratorPanel.tsx` -- Mount `<PartnerPairChart matches={matches} nameMap={nameMap} />` under a "Partner Pairing Summary" label in the preview-stage grid (next to Match Type Summary) -- surfaces the audit during registration_closed/preview.
- [ ] `badminton-v2/src/components/MatchGeneratorPanel.tsx` -- Mount the same component with `enrichedMatches`/locked-stage `nameMap` in the locked-stage grid -- surfaces the audit during schedule_locked.

**Acceptance Criteria:**
- Given a session in `registration_closed` (preview) or `schedule_locked` stage with generated matches, when the admin views the audit panel, then a "Partner Pairing Summary" list/chart appears showing each unique partner pair and their combined game count.
- Given two matches where the same two players are teamed as "A,B" in one and "B,A" in the other, when the summary is computed, then they appear as one pair entry with count 2, not two separate entries.

## Design Notes

Mirror `MatchTypeChart` (MatchGeneratorPanel.tsx:940-970) almost verbatim: `Map<string, number>` tally → sorted entries → bar row with label, proportional-width bar, and count. Key difference: the map key is a sorted-pair string per team (`[id1, id2].sort().join('|')`), and the label resolves both IDs through `nameMap` joined with `" & "` instead of a single `type` string.

## Verification

**Commands:**
- `npm run build` (in `badminton-v2/`) -- expected: TypeScript compiles with no new errors.

**Manual checks (if no CLI):**
- Run the dev server, open a session, close registration to reach the preview stage with generated matches, confirm "Partner Pairing Summary" renders with correct order-independent counts; repeat after locking the schedule.
