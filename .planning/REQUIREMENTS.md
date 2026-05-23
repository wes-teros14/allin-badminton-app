# Requirements: All-In Badminton App

**Defined:** 2026-05-23
**Core Value:** Players can register, get a fair auto-generated match schedule, and track live results without the admin manually coordinating anything during play.

## v1.3 Requirements

Requirements for milestone v1.3 - Split Match Scoring.

### Match Format

- [ ] **FMT-01**: Admin can enable or disable split-match scoring for a session with a single session-level checkbox/toggle.
- [ ] **FMT-02**: Sessions with split-match scoring disabled keep the current one-result match finish behavior.
- [ ] **FMT-03**: Sessions with split-match scoring enabled require two game winners when finishing a scheduled match.

### Result Recording

- [ ] **RES-01**: Admin/live board can record a `2-0` split result for either team.
- [ ] **RES-02**: Admin/live board can record a `1-1` split result as a valid final result.
- [ ] **RES-03**: Split results persist as two game-level result records for the same scheduled match.
- [ ] **RES-04**: Duplicate split-game result records are prevented for the same match and game number.

### Stats And Leaderboards

- [ ] **STAT-01**: A `2-0` result counts as two wins for each player on the winning team.
- [ ] **STAT-02**: A `1-1` result counts as one win for each team's players.
- [ ] **STAT-03**: Session leaderboards, today leaderboard, player schedule, player profile stats, and all-time leaderboard aggregate all game-level result records correctly.

### Compatibility

- [ ] **COMP-01**: Existing completed matches without split-game data continue to display and count as one-game results.
- [ ] **COMP-02**: Existing session lifecycle, queue advancement, court assignment, and realtime updates keep working in both scoring modes.

## Future Requirements

Features discussed but deferred beyond v1.3.

### Finance Insights

- **FIN-F01**: Session-to-session profit trend view after enough session data exists.
- **FIN-F02**: Low stock alert when remaining shuttles fall below one session's worth.
- **FIN-F03**: Shuttle sell-price tracking in settings to compute markup versus cost.

### Inventory

- **INV-F01**: Batch quality notes, such as feather versus plastic and brand rating.
- **INV-F02**: Batch expiry tracking.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-match scoring format | User specified the split setting should apply per session. |
| Custom point targets | User specified no custom scoring input is needed; use a checkbox only. |
| Tiebreaker/decider game | User specified `1-1` is an allowed final result. |
| New stats formula | Game wins remain the stat unit; split results add one or two wins through game-level result rows. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FMT-01 | Phase 13, Phase 14 | Pending |
| FMT-02 | Phase 14 | Pending |
| FMT-03 | Phase 14 | Pending |
| RES-01 | Phase 14 | Pending |
| RES-02 | Phase 14 | Pending |
| RES-03 | Phase 13, Phase 14 | Pending |
| RES-04 | Phase 13 | Pending |
| STAT-01 | Phase 15 | Pending |
| STAT-02 | Phase 15 | Pending |
| STAT-03 | Phase 15 | Pending |
| COMP-01 | Phase 13, Phase 15 | Pending |
| COMP-02 | Phase 14, Phase 15 | Pending |

**Coverage:**
- v1.3 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-05-23*
*Last updated: 2026-05-23 after roadmap creation*
