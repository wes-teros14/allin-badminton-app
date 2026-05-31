# Data Model: Admin Court Count

## Session

**Purpose**: Stores the persisted configuration and lifecycle state for a badminton session.

### Fields relevant to this feature

- `id`: Unique session identifier
- `name`: Session name
- `status`: Session lifecycle status
- `court_count`: Positive whole number defining how many courts the session can actively use
- `court_1_label`: Optional custom display label for court 1, defaults to `Court 1`
- `court_2_label`: Optional custom display label for court 2, defaults to `Court 2`

### Validation rules

- `court_count` is required for new writes after the migration path is in place
- `court_count` must be a whole number greater than or equal to 1
- legacy rows without an explicit stored value must resolve to an effective value of `2`

### State implications

- `court_count` influences setup validation, session start behavior, live rendering, and queue promotion rules
- changing `court_count` must not invalidate the session record itself, but may require downstream reconciliation of match assignments

## Match

**Purpose**: Represents one queued, live, or completed doubles match in a session.

### Fields relevant to this feature

- `id`: Unique match identifier
- `session_id`: Parent session
- `queue_position`: Queue order used for scheduling and promotion
- `status`: Queued, playing, or complete
- `court_number`: Nullable active court assignment for live matches
- `started_at`: Timestamp used for live elapsed-time display

### Validation rules

- `court_number` may be null for queued matches
- when `court_number` is not null, it must reference a configured court number for the session, except during controlled reconciliation of an in-progress court-count reduction

### State transitions

- `queued -> playing`: When session start or court promotion assigns the match to a valid court number
- `playing -> complete`: When the admin or liveboard finishes the match
- `playing -> queued`: When the session is unstarted or a live match is deliberately demoted back to queue

## Derived Court Slot

**Purpose**: Shared runtime view model for rendering one configured court in admin, liveboard, or player surfaces.

### Fields

- `courtNumber`: Ordered numeric court identifier starting at 1
- `label`: Display name for the court
- `current`: Current playing match for the court, if any
- `next`: Next queued match shown for the court, if any

### Derivation rules

- one slot exists for each number from `1` through `court_count`
- labels use stored custom labels for courts 1 and 2 when present
- labels for courts above 2 default to `Court N`
- `current` is derived from the playing match assigned to that `courtNumber`
- `next` is derived from queued matches distributed in display order after current assignments are resolved

## Admin Court Count Input

**Purpose**: Editable setup value used by admins to define available courts for a session.

### Fields

- `value`: The numeric court count currently entered by the admin
- `isDirty`: Whether the field differs from the persisted session value
- `validationError`: User-facing invalid-input message, if any

### Validation rules

- accepts only whole-number positive input
- cannot save when invalid
- should load the persisted value for existing sessions and `2` for legacy sessions
