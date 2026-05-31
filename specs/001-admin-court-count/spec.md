# Feature Specification: Admin Court Count

**Feature Branch**: `[001-admin-court-count]`

**Created**: 2026-05-31

**Status**: Draft

**Input**: User description: "new feature for admin to input # of courts, this will affect court cards in admin view and liveboard. currently it is defaulted to 2 courts. check also all impacted."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Session Court Count (Priority: P1)

An admin can set how many physical courts are available for a session instead of relying on the current fixed two-court setup.

**Why this priority**: The number of courts determines how the session runs. Without this setting, sessions with more or fewer courts cannot be represented correctly anywhere else in the product.

**Independent Test**: Can be fully tested by creating or editing a session, setting a court count, saving it, and reopening the session to confirm the saved count remains in place.

**Acceptance Scenarios**:

1. **Given** an admin is preparing a session, **When** they enter a valid court count and save the session, **Then** the session stores that court count and uses it as the active court configuration for that session.
2. **Given** an existing session already uses the legacy default setup, **When** the admin opens it without changing the setting, **Then** the session continues to behave as a two-court session until the admin chooses a different count.
3. **Given** an admin enters an invalid court count, **When** they try to save it, **Then** the system prevents the change and explains what valid input is required.

---

### User Story 2 - Show the Correct Number of Court Cards Everywhere (Priority: P1)

As a player or admin viewing live session progress, I see the exact number of configured courts in the admin session view and liveboard so the display matches the real venue layout.

**Why this priority**: The configured court count has no value unless the operational views reflect it accurately during live play.

**Independent Test**: Can be fully tested by setting different court counts for separate sessions and confirming that the admin session view and liveboard render the same number of court cards for each session.

**Acceptance Scenarios**:

1. **Given** a session is configured with one court, **When** the admin or liveboard view opens that session, **Then** only one court card is shown.
2. **Given** a session is configured with more than two courts, **When** the admin or liveboard view opens that session, **Then** one court card is shown for each configured court and each card is labeled in order.
3. **Given** a session court count changes before or during live use, **When** the affected views refresh or receive the update, **Then** they update to match the new court count without requiring manual re-entry of the session.

---

### User Story 3 - Keep Match Flow Consistent Across Impacted Views (Priority: P2)

As an admin running a session, I need queueing, current-court assignments, and player-facing court summaries to stay consistent with the configured number of courts so no match appears assigned to a court that does not exist.

**Why this priority**: Rendering the right number of cards is not enough if scheduling and player guidance still assume exactly two courts.

**Independent Test**: Can be fully tested by running a session with a non-default court count, starting matches, finishing matches, and confirming that queue advancement and player court summaries remain aligned to the configured courts.

**Acceptance Scenarios**:

1. **Given** a session uses a non-default court count, **When** matches are assigned to courts, **Then** only configured courts can receive live matches.
2. **Given** a session uses additional courts, **When** a match completes on one of those courts, **Then** the next eligible queued match advances using the same session court rules as the other courts.
3. **Given** a player opens their schedule during an active session, **When** the session uses a non-default court count, **Then** the player-facing live court summary shows only the configured courts and their current or next matches.

### Edge Cases

- What happens when an admin reduces the court count while one or more higher-numbered courts already have active matches?
- How does the system handle sessions created before this feature that have no explicit stored court count?
- What happens when a session has fewer queued matches than configured courts?
- How does the system behave if a user opens a stale admin or liveboard page after the court count was changed elsewhere?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an admin to define the number of courts for each session as a positive whole-number setting.
- **FR-002**: The system MUST persist the configured court count with the session so it remains the source of truth across future visits and live updates.
- **FR-003**: The system MUST treat two courts as the default value for sessions that do not yet have an explicit court count stored.
- **FR-004**: The system MUST show the configured number of court cards in the admin session view.
- **FR-005**: The system MUST show the configured number of court cards in the liveboard for the same session.
- **FR-006**: The system MUST label displayed courts in a clear ordered sequence that matches the configured court count.
- **FR-007**: The system MUST ensure that only configured courts can be assigned live matches or shown as active court positions.
- **FR-008**: The system MUST apply the configured court count when determining which matches are currently on court and which matches are next in line for each court.
- **FR-009**: The system MUST keep player-facing live court summaries aligned with the configured court count for the active session.
- **FR-010**: The system MUST update affected views after a court-count change so admins and players see the same session court layout.
- **FR-011**: The system MUST prevent invalid court-count entries from being saved and provide clear correction guidance to the admin.
- **FR-012**: The system MUST preserve in-progress session continuity when court count changes, avoiding loss of active match information while reconciling courts that are no longer configured.
- **FR-013**: The system MUST continue to support sessions that remain on the legacy two-court configuration without requiring admin action.
- **FR-014**: The system MUST ensure that reporting or session state derived from court assignments does not reference court numbers outside the configured count.

### Key Entities *(include if feature involves data)*

- **Session Court Configuration**: The session-level setting that defines how many physical courts are available for a specific session.
- **Court Slot**: A numbered playable court position within a session that can hold a current match and an upcoming match.
- **Court Assignment**: The relationship between a match and a specific court slot during live play.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can set or update a session's court count in under 30 seconds without support help.
- **SC-002**: For every active session, the admin view and liveboard display the same number of court cards as the session's configured court count.
- **SC-003**: 100% of live matches in a configured session appear on valid court numbers only.
- **SC-004**: In validation testing of legacy sessions, sessions without an explicit court count continue to behave as two-court sessions with no manual repair required.
- **SC-005**: In test runs using non-default court counts, players can correctly identify their current or next court from the player-facing live summary on the first attempt.

## Assumptions

- Court count is managed per session, not as a single global venue setting shared by all sessions.
- The feature applies to the operational session experience, including admin live controls, liveboard display, and player-facing live court summaries.
- Existing sessions created before this feature should continue working with an effective default of two courts until an admin changes the value.
- Court labels continue to follow the existing numbered-court pattern unless separately renamed by the admin.
- If court count is reduced during an in-progress session, active matches already on removed courts remain visible until the system can safely reconcile them rather than disappearing immediately.
