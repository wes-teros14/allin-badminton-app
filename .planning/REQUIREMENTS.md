# Requirements: All-In Badminton App

**Defined:** 2026-05-12
**Core Value:** Players can register, get a fair auto-generated match schedule, and track live results without the admin manually coordinating anything during play.

## v1.2 Requirements

Requirements for milestone v1.2 - Public Registration Homepage.

### Public Entry

- [ ] **REG-01**: Signed-out visitors can open the root app URL and see a public homepage instead of being immediately prompted to sign in with Google.
- [ ] **REG-02**: Signed-out visitors can click a clear Register button from the public homepage.
- [ ] **REG-03**: Clicking Register starts the existing Google sign-in flow, with no extra public registration form.

### Existing User Behavior

- [ ] **AUTH-01**: Signed-in users keep the current homepage behavior and continue into the authenticated app experience without a new landing step.
- [ ] **AUTH-02**: Existing Google OAuth behavior remains the only authentication method for registration and sign-in.

### Compatibility

- [ ] **INVITE-01**: Existing invite-link code remains in the codebase and is not removed during this milestone.
- [ ] **INVITE-02**: Normal onboarding no longer depends on the admin sending a session invite link.

## Future Requirements

Features discussed but deferred beyond v1.2.

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
| Public registration form | User explicitly wants Google sign-in only with no extra form. |
| Removing invite-token code | Keep the existing code for now; only stop relying on invite links for normal onboarding. |
| Changing signed-in user routing | Existing signed-in behavior should remain unchanged. |
| Adding new auth providers | Google OAuth remains the only auth method. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | TBD | Pending |
| REG-02 | TBD | Pending |
| REG-03 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| INVITE-01 | TBD | Pending |
| INVITE-02 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 7 total
- Mapped to phases: 0
- Unmapped: 7

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-12 after milestone scoping*
