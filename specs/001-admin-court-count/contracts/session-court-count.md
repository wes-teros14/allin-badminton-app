# Contract: Session Court Count

## Purpose

Define the expected behavior boundary between persisted session data, shared live court-state hooks, and UI surfaces that render or mutate court-based session state.

## Persistence Contract

### Session write contract

- Session setup must persist a session-level `court_count` value.
- If an explicit court count is not provided for a legacy session, the effective value is `2`.
- Invalid values must be rejected before persistence.

### Match assignment contract

- Live match assignments may only target configured court numbers for the session.
- Session-start logic assigns up to `court_count` queued matches to active courts in queue order.
- Match-completion logic promotes at most one next queued match into the just-finished court.

## Shared Hook Contract

### Dynamic live court state

Shared court-state loaders must expose an ordered collection of courts rather than two hard-coded court branches.

Expected shape:

```ts
type CourtSlotDisplay = {
  courtNumber: number
  label: string
  current: CourtMatchDisplay | null
  next: CourtMatchDisplay | null
}
```

Behavior rules:

- Returned court slots are ordered from `1` to `court_count`
- Slots reuse stored labels for courts 1 and 2 when available
- Slots above 2 use generated numbered labels
- Views must render from this collection and not assume exactly two entries

## UI Contract

### Session setup

- Admin setup shows the persisted or default court count
- Admin cannot confirm invalid input
- Saving the session keeps other setup values intact

### Admin live session view

- Renders one live card per configured court
- Queue actions must work with any valid court number
- Changing the court count updates the visible set of court cards on refresh or realtime sync

### Liveboard

- Renders one visible lane/card per configured court
- Finishing a match acts on the lane's `courtNumber`
- No lane may be shown for a court number above the configured count

### Player live summary

- Renders only the configured courts for the active session
- Uses the same court ordering and labels as the shared court-state contract
