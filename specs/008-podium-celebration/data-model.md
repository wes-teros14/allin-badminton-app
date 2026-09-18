# Phase 1: Data Model — Leaderboard Celebrations

No database schema changes. The feature reads existing leaderboard sources and writes only its own
per-player client storage.

---

## Entities

### BoardKey

Identifies one watched leaderboard.

| Value | Board |
|-------|-------|
| `wins` | Individual, most wins |
| `pairs` | Partners, pair win rate |
| `cheers:<slug>` | One Cheers category, e.g. `cheers:good_sport` |

The Awards board has no key: it is single-holder with no second or third place, so it is out of scope
(FR-006).

**Why the cheers key carries its slug**: each of the six categories is its own board with its own
podium, so they cannot share one key without losing which one was won.

---

### RankSnapshot

What the app last told one player about their position on each watched board.

```
RankSnapshot = { [board: BoardKey]: number | null }
```

| State | Meaning | Consequence |
|-------|---------|-------------|
| Key present, number | Player held that place when last evaluated | An improvement on it is news |
| Key present, `null` | Board was watched; player was not placed | Appearing on it later **is** news |
| **Key absent** | Board was **not being watched** then | Appearing on it later is **not** news |

**The present-null versus absent distinction is load-bearing** and is the subtlest rule in the
feature. It is what stops a newly added cheer category from congratulating everyone already inside its
top 3. See research.md R4.

**Validation**: a rank is a positive integer or null. Ranks are dense — ties share a place — so two
players may legitimately hold the same number.

---

### PlayerCelebrationState

Everything persisted for one player. Stored under a key namespaced by player id, so two accounts on
one device never read or overwrite each other (FR-010) — a real case here, because the dev login panel
switches between test players in one browser.

| Field | Type | Purpose |
|-------|------|---------|
| `snapshot` | `RankSnapshot` | The standings last shown to this player |
| `bestEver` | `{ [board: BoardKey]: number }` | Best rank ever held per board, for the personal-best achievement |
| `sentinel` | `string \| null` | The most recent session `completed_at` seen at the last evaluation |
| `sweepOwed` | `{ board: BoardKey, sentinel: string } \| null` | A celebration shown but not yet collected on the board |
| `version` | `number` | Storage shape version, so a later change can migrate rather than reset |

**First-run rule**: absence of stored state entirely means this player has never been evaluated.
That evaluation records everything and celebrates nothing (FR-002). It is the difference between a
quiet launch and congratulating every long-standing podium holder on day one.

**`sweepOwed` carries the sentinel it was created under** so expiry is a comparison rather than a
timer: when the current sentinel differs, the debt has lapsed (research.md R9).

---

### Achievement

One thing worth celebrating, produced by evaluating a previous snapshot against current standings.

| Field | Type | Notes |
|-------|------|-------|
| `board` | `BoardKey` | Which board it was earned on |
| `kind` | `'podium' \| 'first-appearance' \| 'personal-best' \| 'climb'` | Determines icon, border and wording |
| `rank` | `number` | The new standing |
| `previousRank` | `number \| null` | Null when the player was not placed before |
| `detail` | `string` | Board-specific qualifier — the partner, or the cheer share |

**Precedence when several are earned at once**, highest first: `podium`, `first-appearance`,
`personal-best`, `climb`. Within the same kind, the better rank wins; the Individual and Partners
boards break a remaining tie ahead of cheer categories.

`first-appearance` must outrank `personal-best` because it is always also a personal best.

*(The deferred streak achievement would slot between `personal-best` and `climb`; see research.md R7.)*

---

### Presentation shapes

Not persisted — derived for display.

**CelebrationContent**: what one card shows.

| Field | Notes |
|-------|-------|
| `achievements` | One or more, ordered best first |
| `icon` | Medal for a podium, the thumbs-up bunny otherwise |
| `borderRank` | `1 \| 2 \| 3 \| null` — null means the ordinary border |
| `dwellMs` | Scales with how much there is to read |

**Dwell**: a baseline for one achievement, extended per additional one, to a ceiling. A card that says
more must stay longer, but it always leaves on its own — a celebration that must be dismissed has
become a dialog (FR-014, FR-015).

**Border**: `borderRank` takes the *best* placing on the card, matching the toast, which names that
same placing. Non-podium cards take the ordinary border, which is the only structural difference
between them and a podium card (FR-017, FR-018).

---

## State transitions

```
        no stored state
              │
              │  first evaluation
              ▼
        recorded, silent ──────────────┐
              │                        │
              │  sentinel unchanged    │  (the common launch:
              │─────────────────────►──┘   one small query, stop)
              │
              │  sentinel changed, standings computed
              ▼
      ┌── no achievement ──► snapshot + sentinel updated, nothing shown
      │
      └── achievement ─────► card shown, toast offered,
                             snapshot + bestEver + sentinel updated,
                             sweepOwed armed
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
          player reaches that board          next session completes
                    │                                │
                    ▼                                ▼
              sweep plays,                      sweepOwed lapses
              sweepOwed cleared                 (research.md R9)
```

**The snapshot updates whether or not anything was celebrated.** Skipping the update on a "nothing
happened" evaluation would let the same achievement be re-detected later.

**`sweepOwed` is armed when the celebration is shown, not when the player accepts the offer.** Both
routes to the leaderboard — accepting, and arriving later unprompted — must find the same owed state
(FR-024). A prototype armed it only on the ignoring path, and the main route silently did nothing;
see research.md R10.

---

## Read-only sources

Consumed, never written:

| Source | Used for |
|--------|----------|
| `player_stats`, `profiles`, `sessions`, `session_registrations` | Individual board |
| `matches`, `match_results`, `profiles` | Partners board |
| `player_cheer_stats`, `profiles` | Cheers boards |
| `sessions.completed_at` where `status = 'complete'` | The sentinel (R1) |

All of these are reached through the shared `leaderboardData` module, so the celebration and the
leaderboard screen cannot disagree about a player's place (Constitution III, research.md R2).
