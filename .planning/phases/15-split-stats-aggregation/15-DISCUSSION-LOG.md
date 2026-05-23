# Phase 15: Split Stats Aggregation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 15-split-stats-aggregation
**Mode:** discuss
**Areas discussed:** 1-1 draw display, leaderboard W label

---

## 1-1 Draw Display in Schedule

| Option | Description | Selected |
|--------|-------------|----------|
| Show as a draw (neutral) | '—' or 'D' indicator; third outcome state | |
| Show nothing (no won/lost chip) | won=null; match shows complete with no badge | |
| Show separate game wins | '1-1' badge on completed match card | ✓ |

**User's choice:** Show separate game wins — "1-1" badge on the GameCard
**Notes:** Same chip style as win/loss (same border-radius, font size) but with muted/gray background and "1-1" label.

---

## 1-1 Badge Visual Style (GameCard)

| Option | Description | Selected |
|--------|-------------|----------|
| Same style as win/loss chip but labeled '1-1' | Neutral muted color chip | ✓ |
| A split pill showing both outcomes | Two-tone ✓ \| ✗ chip | |
| Claude decides | Cleanest fit with existing design | |

**User's choice:** Same chip style, labeled "1-1", muted/neutral color.

---

## Leaderboard W Column Label

| Option | Description | Selected |
|--------|-------------|----------|
| No label change — just fix the numbers | Keep '2W 1L' style; numbers naturally higher | ✓ |
| Add a small note for split-scoring sessions | Subtitle 'wins = game wins' under header | |
| Claude decides | Whatever fits existing card design | |

**User's choice:** No label change — fix the numbers only.

---

## Claude's Discretion

- Exact function signature for the new split-aware stats helper
- Whether `computeStatsFromResults` is exported or private
- Draw detection logic structure in `usePlayerSchedule`
- GameCard chip color specifics for draw state

## Deferred Ideas

None.
