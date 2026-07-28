# Feature Specification: Reorder Session Cards by Soonest Scheduled Date

**Feature Branch**: `002-reorder-session-cards`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "reorder the session cards on /sessions to be the soonest scheduled date to be on the top ordered by scheduled date."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Soonest upcoming session appears first (Priority: P1)

A player opens the Sessions page to check what's coming up. They want the session happening soonest to be the very first card, with later sessions following in order, so they don't have to scan the whole list to find what's next.

**Why this priority**: This is the entire point of the request — it's the primary way players decide "what's my next session." Without this, the page actively misleads players about what's imminent.

**Independent Test**: Register for (or view) multiple upcoming/active sessions with different dates. Open the Sessions page and confirm the card with the nearest scheduled date appears at the top of the list, followed by cards in increasing date order.

**Acceptance Scenarios**:

1. **Given** a player has three active sessions scheduled for July 30, August 2, and August 5, **When** they open the Sessions page, **Then** the July 30 session card appears first, August 2 second, and August 5 third.
2. **Given** a player has two active sessions scheduled on the same date but at different times, **When** they open the Sessions page, **Then** the session with the earlier start time appears first.
3. **Given** a player has only one active session, **When** they open the Sessions page, **Then** that session's card is shown alone with no ordering issue.

---

### User Story 2 - Ordering stays consistent when new sessions are registered (Priority: P2)

A player registers for a new session that happens to be scheduled sooner than one they were already registered for. They want the list to reflect the correct order immediately, without needing to refresh in a special way.

**Why this priority**: Confirms the ordering is a live rule applied to whatever sessions are present, not a one-time fix — important for the feature to hold up as the player's session list changes over time.

**Independent Test**: Start with a player registered for a session on August 5. Register them for a new session on August 1. Reload the Sessions page and confirm the August 1 card now appears above the August 5 card.

**Acceptance Scenarios**:

1. **Given** a player is registered for a session dated August 5, **When** they register for another session dated August 1, **Then** the August 1 session card appears above the August 5 session card the next time the list is displayed.

---

### Edge Cases

- What happens when two or more sessions share the exact same scheduled date and time? Order among them may be arbitrary but must remain stable (not reshuffle on every render).
- What happens when a session has a scheduled date but no scheduled time set? It MUST still be placed correctly relative to other sessions using date alone.
- What happens when the player has no active/upcoming sessions at all, only past ones? The past-sessions list (see FR-004) is unaffected by this change to the active list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sessions page MUST display active/upcoming session cards ordered by scheduled date in ascending order, so the session with the soonest scheduled date is always the first card shown.
- **FR-002**: When two or more active/upcoming sessions share the same scheduled date, the system MUST order those sessions by scheduled time in ascending order (earliest time first).
- **FR-003**: The reordering MUST apply automatically every time the Sessions page is displayed or its session list changes (e.g., after registering for a new session), without requiring any manual action from the player.
- **FR-004**: Past sessions (shown when the player expands "Show Past Sessions") MUST be ordered with the most recently occurred session first, descending by scheduled date — unchanged from current behavior, since "soonest" does not apply to sessions that have already happened.
- **FR-005**: Sessions missing a scheduled time value MUST still sort correctly by date alone, without causing errors or being dropped from the list.

### Key Entities

- **Session**: A scheduled badminton session with a date, an optional time, a status (e.g., registration open, schedule ready, live, closed, ended), and other display details (venue, price, notes). Ordering in this feature is based on the session's scheduled date and time only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a player has multiple active/upcoming sessions, the session with the nearest scheduled date is visible as the first card 100% of the time, without the player needing to scroll or search.
- **SC-002**: Players can correctly identify their next scheduled session at a glance, without cross-referencing dates across cards.

## Assumptions

- "The session cards on /sessions" refers to the player-facing Sessions page (route `/sessions`), which lists a signed-in player's own active and past sessions — not the admin session management list.
- Past sessions retain their existing most-recent-first ordering; only the active/upcoming section's ordering direction changes. (Confirmed via clarification — see below.)
- "Scheduled date" refers to the session's date field, with time used only as a tiebreaker when dates match.
