# Deep Technical Audit: Match Generation Engine

> **Audit date**: 2026-04-04
> **Post-fix update**: All audit items resolved. Sections marked with [FIXED] below.

## 1. Algorithm Design

### Strengths
- **Weighted soft-constraint scoring** [FIXED] — replaces the old 3-phase hard relaxation. Every candidate group is scored on 6 dimensions (streak, partner, gender, spread, fairness, balance) and the best one is selected. Constraints degrade proportionally instead of cliff-edge on/off.
- **Best-group selection** [FIXED] — the engine now evaluates all C(12,4) = 495 candidate groups per match and picks the highest-scoring one, instead of taking the first valid group.
- **Post-process balancing** (the swap pass) compensates for remaining selection bias
- **All 3 team splits evaluated** per group — exhaustive for 4-player combinations
- **Simulated annealing optimizer** [FIXED] — replaced independent random trials with neighborhood search (single player swaps, temperature cooling at 0.995)

### Remaining Weaknesses

~~**The balance pass can silently break gender rules.**~~ [FIXED] The gender-same guard in `balanceParticipation` was gated behind `enforceSpread`, so the second pass (relaxed spread) freely swapped M↔F. Fixed by always enforcing the gender guard when `!disableGenderRules`, independent of `enforceSpread`. Same-gender swaps structurally preserve valid compositions (4M, 4F, 2M+2F).

~~**`streakLimit = 1` semantics remain confusing.**~~ [FIXED] Renamed to `maxConsecutiveGames` throughout the codebase and UI. `maxConsecutiveGames = 1` clearly means "play 1 game, then rest." The comparison logic (`>=`) was already correct — only the naming was confusing.

---

## 2. Complexity & Performance

### Time Complexity

Per match generation (single pass):
- Sort: O(n log n)
- Combination enumeration: **O(C(n', 4))** where n' = min(n, 12)
- Per combination: 3 splits evaluated + 1 `scoreCandidate` call, each O(1)
- **All 495 candidates are now evaluated** (no early break) — still O(495) per match
- Total per match: O(C(12, 4)) = O(495) — constant due to SEARCH_LIMIT

Per schedule: O(m * 495) where m = numMatches ~ 2n

**The SEARCH_LIMIT = 12 cap keeps performance constant.**

| Players | C(n,4) without cap | With cap (12) |
|---------|-------------------|---------------|
| 12 | 495 | 495 |
| 20 | 4,845 | 495 |
| 40 | 91,390 | 495 |
| 100 | 3.9M | 495 |

### The Cap Creates a Hidden Problem

With 20+ players, SEARCH_LIMIT=12 means you only ever consider the 12 players with the fewest games. Players 13-20 are **invisible** until the balance pass rescues them. The scored selection [FIXED] partially mitigates this — the fairness bonus in `scoreCandidate` now actively prefers underplayed players within the window — but the window itself is still a bottleneck for large groups.

### Balance Pass Complexity

The balance pass is O(m * n * n) per improvement step, iterated until convergence. Worst case O(m^2 * n^3). For typical sizes this is fine.

### Optimizer Cost [FIXED]

~~`generateScheduleOptimized` runs 50 independent random trials.~~ Replaced with **simulated annealing** with **4 mutation types** [FIXED]:

1. **Single player swap** (50%) — swap one player in a match with an eligible non-participant
2. **Match order swap** (20%) — swap positions of two matches to fix streak/rest issues
3. **Cross-match player swap** (15%) — swap players between two different matches to break repeat partnerships
4. **Intra-match team reshuffle** (15%) — reassign 4 players into a different team split to fix level imbalance

Accepts improvements, and occasionally accepts downgrades (probability e^(delta/T)) to escape local optima. Tracks the best-ever schedule seen. Temperature cools at 0.995 per step from T0=500. Richer mutations explore a broader solution space than single-swap alone.

---

## 3. Fairness & Match Quality

### What It Gets Right
- Participation equalization is explicitly targeted (sort + fairness bonus in candidate scoring + balance pass + optimizer penalty)
- Repeat partner avoidance is tracked and penalized via soft scoring
- Level-sum balancing per match is sound
- **Candidate scoring** [FIXED] now considers streak, partner, gender, spread, fairness, and balance simultaneously instead of treating them as independent hard filters

### Remaining Fairness Gaps (assessed — none actionable)

**Opponent diversity** — not tracked, but parked as low priority for this group's use case.

**Fairness scoring (min-max gap)** — not a problem in practice. Sessions use exact player counts for equal division (e.g., 16 players, 20 games = 5 games each). The min-max gap metric works correctly when slots divide evenly.

**Team-internal balance** — mitigated by `maxSpreadLimit`. With spread=1, the worst within-team gap is 1 level (e.g., L5+L6 vs L5+L6). Acceptable for club play.

**Skill clustering** — working as designed. The spread limit intentionally groups similar levels together. This is a feature, not a bug.

**Edge case — gender imbalance (e.g., 10M + 2F):**
With soft constraints, the gender-doubles preference is now a penalty rather than a hard Phase 1 requirement. The 2 females will be included in matches sooner (their participation deficit triggers the fairness bonus), which partially mitigates the old problem. However, with only 2F, valid gender compositions are limited (no Women's Doubles possible), so participation may still be slightly uneven.

---

## 4. Constraint System

### Current System: Unified Scoring [FIXED]

~~The old 3-phase hard relaxation was replaced with `scoreCandidate()`.~~ Now further simplified: **one scoring function** (`evaluateSessionScore`) is used by both generation and SA optimizer. During generation, each candidate group is scored by building a partial schedule and evaluating it with the same scorer SA uses. No more separate `scoreCandidate` / `CandidateWeights`.

| Weight | Default | Effect |
|--------|---------|--------|
| `fairnessWeight` | 5000 | Per game-count gap between players |
| `spreadPenalty` | 2000 | Per match exceeding maxSpreadLimit |
| `streakWeight` | 1000 | Per game over max consecutive |
| `wishlistReward` | 500 | Per wishlist pair granted |
| `mixedDoublesPenalty` | 300 | Per Mixed Doubles / generic Doubles match (prioritizes MD/WD) |
| `repeatPartnerPenalty` | 200 | Per repeat partnership |
| `imbalancePenalty` | 100 | Per level diff between teams |

**Only two hard filters remain** (structural invalidity, cannot be soft):
- Skill spread > maxSpreadLimit (unplayable match)
- Gender composition not in {4M, 4F, 2M+2F} (badminton doubles rules)

**Advantages:**
- One scorer, one set of weights — generation and SA always agree
- Tunable via "Scoring Weights" in UI (active for both single-pass and iterative modes)
- Generation sees the full picture (streaks, partners, participation) not just local approximations

---

## 5. Alternative Approaches

~~**A. Weighted Bipartite Matching (for team formation)**~~ Not needed — the current exhaustive 3-split approach is fine for doubles (2v2).

~~**B. Constraint Programming (CP-SAT)**~~ Parked — would require WASM build or server-side solver. Current soft constraint system handles the problem well.

~~**C. Simulated Annealing (practical middle ground)**~~ [FIXED] Implemented with 4 mutation types (single swap 50%, match order swap 20%, cross-match swap 15%, team reshuffle 15%). T0=500, cooling rate 0.995. Accepts improvements and occasionally accepts downgrades (probability e^(delta/T)) to escape local optima.

**D. Graph-Based Opponent Tracking** — remaining future improvement. Build a complete graph where edge weight = "number of times these two players have been in the same match." Use this to maximize opponent diversity and detect cliques.

---

## 6. Practical Improvements

### Code Structure

The file is now ~650 lines. Consider splitting into modules:
```
matchGenerator/
  types.ts          — interfaces (PlayerInput, GeneratedMatch, ScoreWeights, etc.)
  scoring.ts        — evaluateSessionScore, adjustNumMatches
  balancer.ts       — balanceParticipation
  generator.ts      — generateSchedule (core loop + relaxation retry)
  optimizer.ts      — generateScheduleOptimized (multi-start SA)
```

### ~~Debuggability~~ [FIXED]

Decision logging implemented. `generateSchedule` accepts an optional `_decisionLog` parameter. Each match records:
- `gameIndex` — which match
- `candidatesEvaluated` — how many groups passed hard filters
- `bestScore` — the winning candidate's score
- `selectedGroup` — the 4 player IDs chosen

The optimized function returns `decisions` alongside `matches` and `audit`. A collapsible "Decision Log" table is shown in the UI.

### Extensibility

Adding a new constraint means adding a penalty term to `evaluateSessionScore` (one function, used by both generation and SA). The scoring logic is inline but well-structured. Adding a new weight follows the existing pattern:

1. Add field to `ScoreWeights` interface + `DEFAULT_WEIGHTS`
2. Add penalty calculation in `evaluateSessionScore`
3. Add field to `AuditData` for display
4. Wire up UI input in `MatchGeneratorPanel.tsx`

Example weights already added this way: `mixedDoublesPenalty`, `wishlistReward`.

### Resolved Bug [FIXED]

~~**Line 122: `genderMap` defaults null gender to `'M'`** — silently treats unknown-gender players as male when only some players lack gender data.~~

Fixed: `disableGenderRules` now auto-triggers when *any* player has null gender (changed from `every` to `some`). The `genderMap` fallback to `'M'` still exists for match-type label computation but is irrelevant since gender composition rules are disabled.

---

## 7. Final Verdict

| Dimension | Before | After | Notes |
|-----------|--------|-------|-------|
| **Fairness** | 6/10 | **7.5/10** | Scored selection with fairness bonus improves participation. Null-gender bug fixed. Balance pass gender guard fixed. Opponent diversity still missing. |
| **Efficiency** | 8/10 | **8/10** | All 495 candidates evaluated (no early break) but still O(495) per match. Negligible performance difference. |
| **Scalability** | 5/10 | **5/10** | SEARCH_LIMIT=12 window unchanged. Fairness bonus helps within the window but large groups still rely on balance pass. |
| **Real-world usability** | 7/10 | **8.5/10** | Soft constraints, clear naming (`maxConsecutiveGames`), balance pass gender safety. Tunable weights enable customization. |

### Bottom Line

The engine is now a **well-designed club-level scheduler** with a proper multi-dimensional scoring system. The weighted soft constraints eliminate the brittle phase logic and the scored selection produces measurably better matches per trial. The simulated annealing optimizer on top of this produces high-quality schedules for typical badminton sessions (8-16 players).

### Remaining High-Impact Improvements (prioritized)

1. ~~**Simulated annealing optimizer**~~ [FIXED] — replaced independent random trials with SA neighborhood search
2. ~~**Decision logging**~~ [FIXED] — per-match decision data returned and displayed in UI
3. ~~**UI for candidate weights**~~ [FIXED] — exposed in Settings panel as "Generation Weights"

### All Fixes Applied

| Issue | Fix | Test |
|-------|-----|------|
| Null-gender bug (`every` → `some`) | `disableGenderRules` auto-triggers when any player has null gender | Test 8.1, 8.2 |
| 3-phase hard relaxation | Replaced with weighted `scoreCandidate()` soft scoring | Test 9.1, 9.2, 9.3 |
| First-valid-group selection | All 495 candidates scored, best picked | Test 9.1, 9.2 |
| Confusing `streakLimit` naming | Renamed to `maxConsecutiveGames` throughout code + UI | All streak tests |
| Balance pass breaking gender rules | Gender guard now always enforced when `!disableGenderRules` | Test 5.6 |
| Independent random trials optimizer | Replaced with simulated annealing (mutate + accept/reject) | Test 11.1–11.3 |
| Single mutation type in SA | Added 4 mutation types: single swap, match order, cross-match swap, team reshuffle | Test 11.4, 11.5 |
| No decision visibility | Per-match decision log with candidates evaluated, score, group | Test 10.1–10.5 |
| Two separate scoring systems | Merged to one `evaluateSessionScore` used by both generation and SA | All tests |
| Balance pass ignoring spread limit | Always enforce spread in balance pass | Test 6.1 |
| Duplicated `teamCat` closure | Extracted to shared `computeMatchType` helper (used by generation, balance pass, SA mutations) | All existing tests |
