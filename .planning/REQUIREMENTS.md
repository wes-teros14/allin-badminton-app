# Requirements: All-In Badminton App

**Defined:** 2026-05-04
**Core Value:** Players can register, get a fair auto-generated match schedule, and track live results without the admin manually coordinating anything during play.

## v1.1 Requirements

Requirements for milestone v1.1 — Finance & Inventory Tab.

### Inventory Management

- [ ] **INV-01**: Admin can add a new shuttle batch (brand, tube count, cost per tube, date purchased)
- [ ] **INV-02**: Admin can view all batches with their tubes listed cheapest-cost-first
- [ ] **INV-03**: Each tube in a batch gets a unique sequential physical ID starting from 1001 (T-1001, T-1002…) for physical labeling
- [ ] **INV-04**: Admin sees remaining shuttlecock count per tube (e.g., "T-1001: 4 / 12")
- [ ] **INV-05**: Finance page shows total shuttles currently in stock across all tubes

### Session Finance

- [ ] **FIN-01**: Admin can log shuttle usage for a session per specific tube (tube ID + how many shuttlecocks used from it)
- [ ] **FIN-02**: Admin can enter or override court rental cost per session
- [ ] **FIN-03**: Admin sees a P&L summary per session: revenue collected, court cost, shuttle COGS, net profit
- [ ] **FIN-04**: Finance page shows a list of all sessions with their P&L summary

### Payment Tracking

- [ ] **PAY-01**: Admin can mark each registered player as Paid or Unpaid per session from the Finance page
- [ ] **PAY-02**: Finance page shows payment count summary per session (e.g., "12 / 16 paid")
- [ ] **PAY-03**: Existing Paid/Unpaid controls are removed from the Admin tab (moved here)

## Future Requirements

Features discussed but deferred beyond v1.1.

### Finance Insights

- **FIN-F01**: Session-to-session profit trend view (needs 5+ sessions of data first)
- **FIN-F02**: Low stock alert when remaining shuttles fall below one session's worth (< 20)
- **FIN-F03**: Shuttle sell-price tracking in settings to compute markup vs cost

### Inventory

- **INV-F01**: Batch quality notes (feather vs plastic, brand rating)
- **INV-F02**: Batch expiry tracking

## Out of Scope

| Feature | Reason |
|---------|--------|
| Player-visible cost breakdown | Admin-only data — players see the fee, not cost/profit details |
| Automatic cheapest-batch allocation | Admin manually selects which tube to draw from — auto-allocation adds complexity without benefit |
| Realtime subscriptions for finance data | Finance is low-frequency admin data — query-on-load is sufficient |
| Invoice / receipt generation | Out of scope for a casual weekly club |
| Multi-currency | App is PHP only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INV-01 | — | Pending |
| INV-02 | — | Pending |
| INV-03 | — | Pending |
| INV-04 | — | Pending |
| INV-05 | — | Pending |
| FIN-01 | — | Pending |
| FIN-02 | — | Pending |
| FIN-03 | — | Pending |
| FIN-04 | — | Pending |
| PAY-01 | — | Pending |
| PAY-02 | — | Pending |
| PAY-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 12 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-05-04*
*Last updated: 2026-05-04 — initial definition for v1.1*
