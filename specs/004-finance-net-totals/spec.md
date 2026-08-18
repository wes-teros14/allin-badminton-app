# Feature Specification: Finance Net Totals Summary

**Feature Branch**: `004-finance-net-totals`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "need to add 2 fields on the /finance route. need to be at level on the \"Finance\" label ther should be 2 fields that computes gain/loss on all sessions and for all completed sessions only. suggest a field label to me."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the club's overall net position at a glance (Priority: P1)

An admin opens the Finance page. Today they see a per-session table and must add the Net Cash column in their head to know whether the club is up or down overall. With this feature, the page heading area shows a single running total of gain/loss across every session, so the admin knows the club's cumulative position the moment the page loads — no scrolling, no mental math.

**Why this priority**: This is the core value of the request. A single all-sessions total answers the club organizer's most frequent question ("are we ahead or behind overall?") and is useful on its own even if the second field is never built.

**Independent Test**: Sign in as an admin, open the Finance page, and confirm the all-sessions total equals the sum of the Net Cash values shown in the table rows, with a positive/negative treatment matching the sign of the result.

**Acceptance Scenarios**:

1. **Given** an admin is signed in and multiple sessions exist with recorded fees, court cost, and shuttle usage, **When** they open the Finance page, **Then** an all-sessions gain/loss total is displayed in the heading area and equals the sum of the Net Cash values of every session row in the table.
2. **Given** the all-sessions total is a positive amount, **When** the admin views it, **Then** it is presented as a gain using the same positive treatment already used for a positive Net Cash value in the table.
3. **Given** the all-sessions total is a negative amount, **When** the admin views it, **Then** it is presented as a loss using the same negative treatment already used for a negative Net Cash value in the table.
4. **Given** no sessions exist yet, **When** the admin opens the Finance page, **Then** the all-sessions total displays a zero currency amount rather than a blank or error state.

---

### User Story 2 - Separate settled results from in-flight sessions (Priority: P2)

The all-sessions total mixes finished sessions with sessions that are still being set up, still open for registration, or currently being played — sessions whose fees are only partially collected and whose shuttle usage is not final. The admin needs a second total restricted to completed sessions so they can see the club's settled, trustworthy result separately from figures that are still moving.

**Why this priority**: Valuable, but depends on the same calculation and layout as Story 1. The all-sessions total delivers value without it; this one sharpens the picture.

**Independent Test**: With a mix of completed and non-completed sessions present, confirm the completed-only total equals the sum of Net Cash across only the sessions whose status is complete, and that it differs from the all-sessions total whenever a non-completed session has a non-zero Net Cash value.

**Acceptance Scenarios**:

1. **Given** sessions exist in a mix of statuses including at least one completed session, **When** the admin opens the Finance page, **Then** a completed-sessions gain/loss total is displayed alongside the all-sessions total and equals the sum of Net Cash across only completed sessions.
2. **Given** every session in the system is completed, **When** the admin views both totals, **Then** the two totals show the same amount.
3. **Given** no session has reached completed status, **When** the admin views the totals, **Then** the completed-sessions total displays a zero currency amount.
4. **Given** a session transitions to completed and the admin reloads the Finance page, **When** the totals are recalculated, **Then** that session's Net Cash is now included in the completed-sessions total.

---

### Edge Cases

- **No sessions at all**: Both totals show a zero currency amount; the existing empty-state message for the table is unchanged.
- **Sessions with no financial data**: A session with no recorded fee, court cost, or shuttle usage contributes zero to both totals and does not cause an error or a blank total.
- **Data still loading**: While finance data is being fetched, the totals show a loading treatment consistent with the table's existing skeleton rather than a misleading zero.
- **Data fails to load**: When finance data cannot be loaded, the totals are not shown as zero (which would read as a real result); the existing error toast remains the signal to the admin.
- **Large negative running total**: A cumulative loss displays with the loss treatment and does not overflow, truncate, or push the "Finance" heading off screen on a narrow phone viewport.
- **Long currency values on narrow screens**: On the smallest supported phone width, both totals and the heading remain fully readable — wrapping to a second line is acceptable, clipping is not.
- **Non-admin access**: The totals are visible only where the Finance page itself is already visible; they introduce no new access path to financial data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Finance page MUST display two gain/loss summary fields positioned in the same heading area as the "Finance" title, visually level with it.
- **FR-002**: The first field MUST show the cumulative gain/loss across every session known to the finance data, regardless of session status.
- **FR-003**: The second field MUST show the cumulative gain/loss across only those sessions that have reached completed status.
- **FR-004**: Each total MUST be computed as the sum of the same per-session net result already shown in the table's Net Cash column — the net **after** the session's personal-share deduction — so that the all-sessions total always reconciles to the visible rows.
- **FR-005**: Both totals MUST be formatted as Philippine peso currency using the same formatting already applied to monetary values elsewhere on the Finance page.
- **FR-006**: Both totals MUST visually distinguish a gain from a loss using the same positive/negative treatment already applied to the Net Cash column, so the sign is readable without parsing the number.
- **FR-007**: The first field MUST be labeled **"All Sessions"** and the second **"Completed"**, each rendered as a short caption paired with its peso amount.
- **FR-008**: While finance data is loading, both totals MUST show a loading treatment rather than a zero or stale amount.
- **FR-009**: When finance data fails to load, both totals MUST NOT display a zero amount that could be mistaken for a real result.
- **FR-010**: When there are no sessions, or no completed sessions, the corresponding total MUST display a zero currency amount rather than a blank, dash, or error.
- **FR-011**: The totals MUST remain fully legible on the narrowest supported phone viewport without clipping the heading or either value.
- **FR-012**: The totals MUST refresh together with the rest of the finance data whenever that data is refetched, so they never disagree with the table beneath them.
- **FR-013**: The feature MUST NOT change any existing per-session calculation, table column, navigation behavior, or access rule on the Finance page.

### Key Entities *(include if feature involves data)*

- **Session**: A scheduled play event. Carries a lifecycle status; only the completed status distinguishes settled sessions from in-flight ones for the purposes of this feature.
- **Session finance record**: The per-session financial rollup already shown as a table row — revenue collected, total cost, and the resulting net result (Net Cash). This feature consumes it and adds no new fields to it.
- **Finance summary totals**: Two derived, read-only aggregates over the session finance records — one unfiltered, one filtered to completed sessions. Not stored; recomputed whenever finance data is loaded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can determine the club's overall gain/loss position within 3 seconds of the Finance page finishing loading, without scrolling or interacting with the page.
- **SC-002**: The all-sessions total reconciles exactly to the sum of the Net Cash values in the table for 100% of data sets tested, including sets containing sessions with zero financial activity.
- **SC-003**: The completed-sessions total reconciles exactly to the sum of Net Cash across completed sessions only, verified against a data set containing at least one session in each non-completed status.
- **SC-004**: Both totals and the "Finance" heading remain fully readable, with no clipped or truncated characters, at the narrowest supported phone viewport.
- **SC-005**: An admin shown the two labels without additional explanation can correctly state which total includes in-progress sessions on the first attempt.
- **SC-006**: Existing Finance page behavior is unchanged: every table column, row ordering, row navigation to session detail, empty state, and error toast behaves exactly as before the change.

## Assumptions

- **Decided**: "Gain/loss" means the same per-session net result already labeled **Net Cash** in the table — net **after** the personal-share deduction. The all-sessions total is therefore the visible column's sum and always reconciles to what the admin can see on screen. Gross profit before the personal share is explicitly out of scope.
- "Completed sessions" means sessions whose lifecycle status is the terminal completed state. Sessions that are set up, open or closed for registration, schedule-locked, or in progress are excluded from the second total.
- "All sessions" means every session present in the finance data with no status filter and no date-range filter — the same set of rows the table already displays.
- The two totals are read-only display values. No new filtering, sorting, date-range selection, or drill-down interaction is introduced by this feature.
- The totals are derived from the same finance data the page already loads; no new data source, permission, or user role is introduced.
- Access remains admin-only, unchanged from the current Finance page.
- On narrow viewports the heading row may wrap so the two totals sit beneath the "Finance" title; "level with the Finance label" is satisfied by same-row placement wherever width allows.
- Amounts continue to use Philippine peso formatting with two decimal places, consistent with the rest of the page.

## Labels (Decided)

**Confirmed pair**: **"All Sessions"** and **"Completed"**, each a small caption paired with its peso amount.

**Rationale**: The table column immediately below is already named *Net Cash*, so repeating "Net Cash" in both labels adds width without adding meaning — the peso value and the gain/loss coloring already communicate what kind of number it is. Two short labels differing only in scope make the comparison between the pair the thing the eye reads, which is the actual question being asked. Short labels also survive the narrow phone viewport this app is designed around, where the heading row has very little horizontal room to spare.

**Rejected alternatives**: "Net Cash (All)" / "Net Cash (Completed)" — roughly double the width, wraps on a phone. "Overall Net" / "Realized Net" — "Realized" is accounting jargon a club organizer may not map to "completed". "Running Total" / "Settled Total" — clear, but wider than needed.
