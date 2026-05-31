# Match Generator Early Selection Bias

## Summary

The current match generator can favor certain players in the first two games when the roster has varied levels and gender constraints. This is not a simple input-order bug. The bias appears to come from the interaction of level spread limits, gender rules, candidate ordering, and optimizer scoring.

The issue is most visible with larger mixed rosters, especially around 16 players, because only 8 players can appear in the first two games and the optimizer tends to choose players that are easier to fit into valid groups.

## Relevant Code

- `src/lib/matchGenerator.ts`
- `buildAssignment(...)`: creates candidate groups from remaining play counts.
- `pickGroup(...)`: returns the first valid 4-player combination from sorted candidates.
- `generateScheduleOptimized(...)`: runs multiple starts and keeps the highest-scoring schedule.
- `evaluateSessionScore(...)`: scores level balance, rest spacing, gender composition, partner repeats, and participation fairness, but does not directly score fairness of who starts early.

## Findings

The generator shuffles players before assignment, so it does not appear to directly favor registration order.

However, `pickGroup(...)` returns the first valid group it finds. Since candidates are sorted by remaining games and previous-game avoidance, the first valid group can repeatedly contain players that are easiest to fit within constraints.

The optimizer then keeps the best scoring schedule. If middle-level players produce better spread/rest/gender scores early, the optimizer can repeatedly select schedules where those players appear in games 1 and 2 more often.

## Simulation Results

Settings used for quick checks:

- `numMatches: 20`
- `maxConsecutiveGames: 1`
- `maxSpreadLimit: 2`
- gender rules enabled
- `idealRestGames: 2`
- `earlyRestWindow: 20`

### 12 Varied Players

First-two-game appearance counts over 200 generated schedules ranged from:

- Minimum: `116`
- Maximum: `160`
- Ratio: about `1.38x`

Impact exists, but is moderate.

### 16 Varied Players

First-two-game appearance counts over 200 generated schedules ranged from:

- Minimum: `64`
- Maximum: `128`
- Ratio: about `2.0x`

Impact is stronger. Middle-level players appeared earlier more often, while very low/high players appeared less often due to the tight spread limit.

### Uniform Control

When players had the same level, early selection was much flatter. This suggests the bias is constraint-driven rather than random-order or registration-order driven.

## User Impact

Users may notice the same players appearing in the first two games more often across regenerated schedules. This is more likely when:

- roster size is 12-16 players,
- levels vary widely,
- `maxSpreadLimit` is tight,
- gender rules are enabled,
- the optimizer is run with many starts/trials.

## Recommended Improvement

Add an early-start fairness scoring term.

Example concept:

- Track players appearing in games 1 and 2.
- Penalize schedules where early slots are concentrated on the same easy-to-place level/gender cluster.
- Prefer schedules where early appearances are more evenly distributed across player levels/genders when other score dimensions are similar.

Possible option name:

```ts
earlyStartFairnessWeight?: number
```

This would directly address the observed issue while preserving the existing optimizer and level/gender constraints.

## Alternative Improvements

- Randomize among several valid groups in `pickGroup(...)` instead of returning the first valid combination.
- Add a mild penalty when low-level or high-level players are consistently pushed later.
- Add a setting specifically for first-rotation fairness.

The best first change is likely an early-start fairness score because it is explicit, tunable, and less disruptive than changing the group picker.
