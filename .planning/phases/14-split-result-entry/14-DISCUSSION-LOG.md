# Phase 14: Split Result Entry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 14-split-result-entry
**Areas discussed:** Toggle Placement, Finish UI, Admin vs Live Board, Session Mode Propagation

---

## Toggle Placement

| Option | Description | Selected |
|--------|-------------|----------|
| SetupCard only | Set during initial setup alongside name/date/venue | |
| SetupCard + schedule_locked | Editable in two places | |
| registration_closed + schedule_locked | Toggle appears after seeing player count | ✓ |

**User's choice:** Toggle lives in `registration_closed` and `schedule_locked` states only.
**Notes:** "I will enable this only if there is a few joiners on the session" — decision is made after seeing who registered, not during initial setup.

---

## Finish UI — Split Sessions

| Option | Description | Selected |
|--------|-------------|----------|
| 3 stacked buttons | 2-0 T1 / 1-1 Draw / 2-0 T2, full-screen takeover | ✓ |
| Team buttons + draw below | 2 large team buttons, smaller draw button underneath | |
| Claude decides | Open to Claude's layout judgment | |

**User's choice:** 3 stacked buttons, same full-screen style as current "Who won?" screen.

| Label option | Description | Selected |
|--------------|-------------|----------|
| Player names | "Wes & Mark won 2-0" | ✓ |
| Score only | "2-0 Team 1", "1-1", "2-0 Team 2" | |
| Names + score | "Wes & Mark — 2-0" | |

**User's choice:** Player names on the 2-0 buttons (consistent with current flow).

---

## Finish UI — One-Game Sessions

| Option | Description | Selected |
|--------|-------------|----------|
| No change | Keep exactly as is | ✓ |
| Minor polish | Small label tweaks allowed | |

**User's choice:** Zero changes to one-game finish flow.

---

## Admin vs Live Board

| Option | Description | Selected |
|--------|-------------|----------|
| Same 3-button UI in both | CourtCard and CourtTabs identical | ✓ |
| Separate layouts | Live board big buttons, admin compact | |

**User's choice:** Both surfaces show the same 3-outcome finish UI.

---

## Session Mode Propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Prop from parent (Recommended) | Parent passes splitScoring boolean down | ✓ |
| Internal fetch | Each component fetches flag itself | |

**User's choice:** `splitScoring` prop passed from parent — no redundant fetches.

| Insert logic option | Description | Selected |
|--------------------|-------------|----------|
| Shared helper in matchResults.ts | `submitSplitResult` helper, called by both components | ✓ |
| Inline in each component | Each handles its own 2-row insert | |

**User's choice:** Shared helper in `src/lib/matchResults.ts`.

---

## Claude's Discretion

- Toggle position within section layouts
- Loading/disabled state during Supabase update
- Toast wording for toggle save

## Deferred Ideas

None.
