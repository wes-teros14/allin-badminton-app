# Feature Specification: Partner Combination Win-Rate Leaderboard

**Feature Branch**: `006-pair-winrate-leaderboard`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "is it possible we can add a new leaderboard for winrate of partner combinations? for example Sim & Wes 9W 0L. similar to per player leaderboard." Plus scope narrowing: "dont do any changes yet to all time stats view for now. need just to add the win rate leaderboard per pair combination."

## Overview

The All-time Leaderboard today ranks individuals: Mga Lodi (win rate per player), Cheers, and Awards. It answers "who is the strongest player" but not "which duo actually wins together" — a question players ask constantly on court, because in doubles the partnership is the unit that wins or loses, not the individual.

This feature adds a fourth tab that ranks two-player partnerships by win rate, displayed the same way as the player board: `Sim & Wes — 100% · 9W 0L`.

The board is **derived on read** from recorded match results. It introduces no new stored counters, no schema change, and no change to any existing leaderboard, so it cannot alter or corrupt the numbers players already see.

### Explicitly out of scope

The organiser intends to archive sessions yearly so that archived games stop counting toward all-time stats. That change requires reworking the existing counter-based all-time surfaces and is **deliberately excluded from this feature**. This spec only requires that the partnership board be built so a future season filter is a single added condition on its source query, not a structural rewrite.

## Impacted Surfaces

Per Constitution Principle III (Cross-Surface Consistency), the surfaces this feature touches:

| Surface | Change |
|---------|--------|
| All-time Leaderboard — tab bar | New fourth tab added alongside Mga Lodi / Cheers / Awards |
| All-time Leaderboard — new partnership list | New ranking list, loading state, eligibility caption, empty state |
| All-time Leaderboard — existing three tabs | **No change** — values and layout MUST remain identical |
| Today's session leaderboard, profile stats, session player detail | **No change** |
| Stored player/pair/cheer counters and their update rules | **No change** — not read, not written, not migrated |
| Stored data / schema | **No change** — no new tables, columns, or permissions |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player sees which partnerships win the most (Priority: P1)

A player opens the All-time Leaderboard and taps the partnership tab. They see a ranked list of the top duos in the club, each row showing both players' names and photos, the pair's win rate, and their win–loss record. They immediately recognise which combinations have been dominant and can spot their own name if their duo qualifies.

**Why this priority**: This is the entire feature request. Shipped alone it delivers the full value; every other story refines how it is understood.

**Independent Test**: Open the leaderboard, switch to the partnership tab, and confirm a ranked list of pairs appears with correct names, win rate, and W/L for each — verifiable by manually counting one pair's results from past sessions.

**Acceptance Scenarios**:

1. **Given** several partnerships have played 3 or more games together, **When** a player opens the partnership tab, **Then** the qualifying partnerships appear ordered from highest win rate to lowest, capped at ten rows.
2. **Given** a partnership has won 9 of 9 recorded games together, **When** the board is displayed, **Then** that pair shows "100%" and "9W 0L".
3. **Given** two players have partnered in both directions across different matches (once listed first, once listed second), **When** the board is displayed, **Then** they appear as a single combined entry, not two separate rows.
4. **Given** two partnerships have the same win rate, **When** the board is displayed, **Then** the one with more wins is ranked higher.
5. **Given** the board is still loading, **When** a player opens the tab, **Then** placeholder rows are shown rather than a blank screen or an error.

---

### User Story 2 - Player understands why a partnership is or isn't listed (Priority: P2)

A player looks for their own duo, doesn't find it, and reads the caption above the list explaining the eligibility rules — a minimum number of games together, and both players having been active recently. They understand the board is not showing a fluke 2-0 record as the club's best pairing, and they know what it would take for their duo to appear.

**Why this priority**: Without it the board invites arguments. The match generator deliberately rotates partners, so most pairs have very few games together; an unexplained ranking where a 2W-0L pair outranks a 12W-3L pair reads as broken rather than intentional.

**Independent Test**: With a test dataset containing a pair below the games threshold and a pair whose partner stopped attending, confirm neither appears and that the caption states both rules.

**Acceptance Scenarios**:

1. **Given** a partnership has played fewer than 3 games together, **When** the board is displayed, **Then** that partnership does not appear regardless of its win rate.
2. **Given** a partnership qualifies on games played but one of the two players has not registered for any of the last 4 completed sessions, **When** the board is displayed, **Then** that partnership does not appear.
3. **Given** any partnership list is displayed, **When** a player reads the area above the list, **Then** a caption states the ranking basis, the minimum games-together requirement, and the recent-activity requirement.
4. **Given** no partnership meets the eligibility rules, **When** a player opens the tab, **Then** a plain explanatory message is shown instead of an empty list.

---

### User Story 3 - Player shares a direct link to the partnership board (Priority: P3)

A player wants to settle a debate in the group chat and shares a link that opens the leaderboard directly on the partnership tab rather than on the default tab.

**Why this priority**: The existing tabs already support opening a specific tab from a link. Matching that behaviour is small, but skipping it makes the new tab the odd one out.

**Independent Test**: Open the leaderboard using a link that names the partnership tab and confirm the partnership list is shown on arrival without further taps.

**Acceptance Scenarios**:

1. **Given** a link that names the partnership tab, **When** it is opened, **Then** the leaderboard opens with the partnership list already selected.
2. **Given** a link that names an existing tab or names nothing, **When** it is opened, **Then** the previous behaviour is unchanged.

---

### Edge Cases

- **Split-scored match ending 1-1**: both games are recorded separately, so each partnership in that match gains exactly 1 win and 1 loss from it.
- **Match with no recorded result** (queued, in progress, or abandoned): contributes nothing to either partnership's totals.
- **Match un-finished by an organiser**: its result records are removed, so the partnership totals recalculate downward on the next load without any manual correction.
- **Fewer than ten qualifying partnerships**: the list shows however many qualify, with no filler rows.
- **Exactly tied win rate and wins**: ordering must still be stable and repeatable between loads rather than shuffling.
- **A player in the pair no longer has an active profile**: the partnership is excluded, matching how the player board already treats inactive profiles.
- **A partnership with a losing record** (for example 1W 7L) that meets the games threshold: eligible, and simply ranks near the bottom — it will normally fall outside the top ten.
- **A player who partners with many different people**: appears in multiple rows, once per qualifying partnership. This is expected and not deduplicated.
- **Very first sessions of a new club or season**: no pair reaches the threshold, so the empty state is the normal early-life view of this tab.

## Requirements *(mandatory)*

### Functional Requirements

**Placement and navigation**

- **FR-001**: The All-time Leaderboard MUST offer a fourth tab for partnership rankings, positioned after the existing Mga Lodi, Cheers, and Awards tabs.
- **FR-002**: Users MUST be able to open the leaderboard directly on the partnership tab via the same link mechanism the existing tabs use.
- **FR-003**: Selecting the partnership tab MUST NOT alter the behaviour, content, or appearance of the other three tabs.

**What a partnership is**

- **FR-004**: A partnership MUST be identified by its two players without regard to order, so the same two people always resolve to a single entry.
- **FR-005**: Both sides of every recorded match MUST be treated as partnerships — the winning pair and the losing pair alike.
- **FR-006**: A player MUST be able to appear in more than one partnership row.

**How wins and losses are counted**

- **FR-007**: Totals MUST be counted per recorded game result, not per match, so that a match scored as two separate games contributes two results.
- **FR-008**: A partnership on the winning side of a recorded game MUST gain one win; the partnership on the losing side MUST gain one loss.
- **FR-009**: Matches with no recorded result MUST contribute nothing to any partnership's totals.
- **FR-010**: Win rate MUST be the pair's wins divided by their total games together, expressed as a whole percentage.
- **FR-011**: Totals MUST be derived from the stored match records at the time the board is viewed, so that corrections to match results are reflected without any separate reconciliation step.

**Eligibility**

- **FR-012**: A partnership MUST have played at least 3 games together to appear on the board.
- **FR-013**: Both players in a partnership MUST have registered for at least one of the 4 most recent completed sessions for that partnership to appear.
- **FR-014**: Both players MUST have an active profile for the partnership to appear.
- **FR-014a**: Both players MUST have attended at least 3 sessions — the same floor the individual board applies, read from the same `player_stats.sessions_attended` column — for the partnership to appear. One regular carrying a newcomer through three games together must not mint a top-ten pairing.

**Ranking and presentation**

- **FR-015**: Eligible partnerships MUST be ordered by win rate descending, with total wins descending as the first tiebreaker.
- **FR-015a**: Partnerships showing the same win rate MUST share a rank. The record does not separate them — a board that prints the same percentage twice and ranks them apart contradicts what the reader sees.
- **FR-015b**: Ranks MUST be numbered densely: the rank after a shared one is the next number, not a skip (1, 1, 2 — not 1, 1, 3).
- **FR-015c**: A shared rank MUST be displayed once for the group rather than repeated on each row, with the tied rows visually bound together.
- **FR-016**: Ranking MUST be deterministic — two loads of the same underlying data MUST produce the same order, including for partnerships tied on both win rate and wins.
- **FR-017**: The board MUST show the top ten **places**, not the top ten rows. Because places are shared by ties, the number of rows varies — seven partnerships tied for first still leave nine further places to show. A place is therefore never split by the cut.
- **FR-018**: Each row MUST show the rank position, both players' identities including their photos, the pair's win rate, and the pair's win–loss record.
- **FR-019**: Player names MUST be presented using the same naming rule as every other leaderboard, so a player reads identically across tabs.
- **FR-020**: Rows MUST remain legible on a phone-width screen when both players have long names.
- **FR-021**: A caption MUST state the ranking basis and both eligibility rules.
- **FR-022**: While data is loading, placeholder rows MUST be shown; when no partnership qualifies, an explanatory empty-state message MUST be shown.

**Boundaries**

- **FR-023**: The feature MUST NOT modify, migrate, or write to any existing stored statistics counters, nor change the rules that maintain them.
- **FR-024**: The feature MUST NOT require any change to stored data structure or access permissions.
- **FR-025**: The partnership totals MUST be restricted to a chosen set of sessions in a way that allows a future season or archive rule to be applied as a single additional condition, without restructuring how partnerships are counted or displayed.

### Key Entities

- **Partnership**: Two players who appeared on the same side of a match. Identified by the unordered combination of the two players. Carries wins together, losses together, total games together, and win rate. Not stored — derived when the board is viewed.
- **Recorded Game Result**: A single scored game belonging to a match, naming which side won. A match may carry more than one when the session scores games separately.
- **Match**: A completed contest between two sides of two players each, belonging to one session.
- **Session**: A dated club night containing matches and a registration list. Supplies the recency window used for the activity rule, and is the natural future boundary for seasons.
- **Player Profile**: Supplies the display name, photo, and active/inactive state used to render and filter partnerships.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can go from opening the leaderboard to reading the top partnerships in a single tap.
- **SC-002**: The partnership list finishes loading within 2 seconds on a typical mobile connection, for a full club history of at least 2,000 recorded games.
- **SC-003**: 100% of listed partnerships meet both eligibility rules — no listed pair has fewer than 3 games together, and no listed pair contains a player absent from the last 4 completed sessions.
- **SC-004**: For any spot-checked partnership, the displayed wins and losses match a manual count of that pair's results across past sessions exactly.
- **SC-005**: A match scored as a 1-1 split contributes exactly one win and one loss to each of the two partnerships involved.
- **SC-006**: The Mga Lodi, Cheers, and Awards tabs display identical values before and after this feature ships, verified by comparing all three tabs against a pre-change capture.
- **SC-007**: Reloading the board twice with unchanged underlying data produces an identical ordering both times.
- **SC-008**: Correcting a match result is reflected on the partnership board on the next load, with no organiser action beyond the correction itself.

## Assumptions

- **Minimum 3 games together** was chosen by the organiser as the eligibility floor. It is a tuning value, expected to be revisited once the real distribution of games-per-pair is visible.
- **Top ten and the 4-session activity window** mirror the existing player win-rate board rather than introducing new numbers, so the two boards feel like one system.
- **Both players must satisfy the activity rule** — a partnership where one member has stopped attending is treated as inactive, not as a historical record.
- **Games from a session still in progress count immediately**, matching how the existing all-time player board already behaves as results are recorded. The activity window itself is measured only over completed sessions, again matching the existing board.
- **A pair's losing record does not disqualify it.** Any pair meeting the threshold is ranked; low win rates simply fall outside the top ten.
- **Every match is doubles** — two players per side — as the stored match structure guarantees.
- **The tab label follows the existing playful naming** used for the player board rather than a literal English word; the exact wording is cosmetic and can be settled during implementation without changing behaviour.
- **Cheers and Awards are untouched** by this feature, including their all-time meaning, even though the organiser may later want them to reset per season.
- **No per-session partnership board** is included; today's session view is unchanged. A session-scoped version can reuse the same counting rule later.
- **Match records remain present for the sessions being counted.** Should a session ever be deleted outright, its games disappear from this board — which is acceptable now and becomes moot once archiving is a flag rather than a deletion.
