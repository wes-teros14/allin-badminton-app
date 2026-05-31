# Research: Admin Court Count

## Decision 1: Persist court count on the session record

**Decision**: Add a `court_count` field to the session record with a default value of `2`.

**Rationale**: Court availability is session-specific and already sits alongside other session configuration such as date, venue, registration timing, and split scoring. Persisting the value on `sessions` keeps the source of truth aligned with the feature spec and supports legacy sessions through a safe default.

**Alternatives considered**:

- Store court count in client-only state: rejected because liveboard, admin, and player views need a shared persisted value.
- Store court count in `generator_settings`: rejected because court count affects live session behavior beyond schedule generation and should not depend on one feature-specific JSON blob.

## Decision 2: Preserve existing custom labels for courts 1-2 and generate default labels for additional courts

**Decision**: Keep the existing `court_1_label` and `court_2_label` fields for backward compatibility, and generate default labels such as `Court 3`, `Court 4`, and so on for additional configured courts.

**Rationale**: The requested feature is configurable court quantity, not a full redesign of label management. Reusing the current label storage avoids an unnecessary migration from fixed columns to a more complex dynamic label structure while still allowing the UI to scale beyond two courts.

**Alternatives considered**:

- Replace label columns with a dynamic label array or JSON object: rejected for this feature because it broadens scope and introduces extra migration, editing, and compatibility work not required to satisfy the current request.
- Ignore existing labels and show numbered defaults for all courts: rejected because it would regress the existing renamed-label behavior for courts 1 and 2.

## Decision 3: Refactor live court state and admin state to use collections instead of fixed court variables

**Decision**: Replace fixed `court1`/`court2` and `court1Current`/`court2Current` state shapes with ordered court collections keyed by court number.

**Rationale**: The current hooks and views cannot support variable court counts without repeated conditional branching. A collection-based shape scales to any configured court count, simplifies rendering loops, and keeps shared logic between player, liveboard, and admin views consistent.

**Alternatives considered**:

- Extend current code path-by-path for courts 3, 4, and beyond: rejected because it would multiply duplication and keep the code tied to an arbitrary upper bound.
- Keep fixed state in hooks and convert to arrays only in the UI: rejected because start-session, finish, promote, and validation logic also need the dynamic model.

## Decision 4: Make live match assignment rules court-count aware at session start and during match completion

**Decision**: Start the first `court_count` queued matches when a session begins, and when a court finishes, promote the next queued match into the specific finished court if one exists.

**Rationale**: This preserves the existing queue model while generalizing it to an arbitrary number of active courts. It keeps behavior intuitive and matches how the current two-court flow already works.

**Alternatives considered**:

- Introduce a more advanced scheduling engine as part of this feature: rejected because the queue ordering logic already exists and only needs to become court-count aware.
- Recalculate all playing courts after every finish event: rejected because it creates unnecessary churn and increases the risk of disrupting in-progress matches on unaffected courts.

## Decision 5: Use adaptive grid rendering for admin, liveboard, and player court summaries

**Decision**: Render courts from a shared ordered collection using responsive grids or wrapping layouts instead of two fixed columns.

**Rationale**: The number of courts becomes variable, so the view layer needs to scale without custom branches for each count. Adaptive rendering is the smallest change that supports one court, two courts, and multi-court sessions across the existing surfaces.

**Alternatives considered**:

- Keep two-column-only layouts and paginate extra courts: rejected because it hides active courts and would break the live operational use case.
- Limit support to exactly one or two courts: rejected because it fails the requested feature.

## Decision 6: Validate the change with focused unit coverage plus at least one end-to-end admin/live flow

**Decision**: Add or update unit tests around court-state derivation and session-start logic, and add one Playwright flow that proves a non-default court count renders correctly in the admin session and liveboard path.

**Rationale**: The risk is concentrated in shared session state logic. Unit tests can cover edge transitions quickly, while a single targeted browser flow confirms the visible surfaces are wired together correctly.

**Alternatives considered**:

- Rely only on manual browser testing: rejected because the feature refactors shared state with a high regression risk.
- Add broad end-to-end coverage for every court count: rejected for initial implementation because it adds cost without proportional confidence gain.
