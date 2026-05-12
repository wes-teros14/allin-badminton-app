# Phase 12: Public Registration Homepage - Research

**Researched:** 2026-05-12
**Domain:** React route/auth entry flow
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The signed-out homepage should show only basic information about the app. Keep the page simple and informational; do not turn it into a large marketing site.
- **D-02:** The page should make it clear enough that this is the badminton group app and that registration starts from the homepage.
- **D-03:** The Register button should go straight to the existing Google OAuth flow.
- **D-04:** Do not add a public registration form or an intermediate confirmation step before Google sign-in.
- **D-05:** After Google sign-in from the Register button, redirect back to the homepage URL (`/`).
- **D-06:** Signed-in users should continue to see the existing authenticated homepage experience with no added landing step.
- **D-07:** Keep the invite-link/session-token code for now.
- **D-08:** Do not modify invite-link behavior in this phase except as necessary to ensure homepage onboarding no longer depends on it.

### the agent's Discretion
- The exact copy, layout, and visual treatment of the simple signed-out homepage are left to the planner/executor, constrained by the existing app style and the decisions above.

### Deferred Ideas (OUT OF SCOPE)
- None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | Signed-out visitors can open the root app URL and see a public homepage instead of being immediately prompted to sign in with Google. | `HomeView` already branches on `!user`; modify only that branch. |
| REG-02 | Signed-out visitors can click a clear Register button from the public homepage. | Use the existing root route UI and replace the generic sign-in CTA with registration-oriented copy. |
| REG-03 | Clicking Register starts the existing Google sign-in flow, with no extra public registration form. | Existing `supabase.auth.signInWithOAuth({ provider: 'google' })` call in `HomeView` can be reused. |
| AUTH-01 | Signed-in users keep the current homepage behavior and continue into the authenticated app experience without a new landing step. | Existing `user` branch in `HomeView` renders the authenticated welcome and `BulletinBoard`; preserve it. |
| AUTH-02 | Existing Google OAuth behavior remains the only authentication method for registration and sign-in. | No new auth provider or form is needed; keep Supabase Google OAuth. |
| INVITE-01 | Existing invite-link code remains in the codebase and is not removed during this milestone. | `/register` is separately routed to `RegisterView`; no change required there beyond tests verifying compatibility remains reachable. |
| INVITE-02 | Normal onboarding no longer depends on the admin sending a session invite link. | Root homepage Register CTA starts OAuth from `/`, independent of `token` query params. |
</phase_requirements>

## Summary

Phase 12 is a route-level UI/auth flow change, not a new registration subsystem. [VERIFIED: codebase] The root route `/` renders `HomeView` inside `PlayerLayout`, and `HomeView` already has a signed-out branch that calls `supabase.auth.signInWithOAuth` with `provider: 'google'` and `redirectTo` set to the root URL. The safest implementation is to keep the route graph and authenticated branch intact while replacing the signed-out prompt with a simple public homepage and Register CTA.

The invite-token path is isolated. [VERIFIED: codebase] `App.tsx` maps `/register` to `RegisterView`, and `RegisterView` handles token presence, in-app browser warnings, OAuth sign-in for token registration, auto-registration, and session-full/already-registered states. Phase 12 should not merge homepage onboarding into this token flow.

**Primary recommendation:** Update `badminton-v2/src/views/HomeView.tsx` only for production behavior, then add Playwright coverage in a new `badminton-v2/tests/public-homepage.spec.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Public signed-out homepage rendering | Browser / Client | CDN / Static | Vite React renders the root route client-side; no server route or database change is needed. |
| Register CTA starts Google OAuth | Browser / Client | Supabase Auth | The existing Supabase client owns OAuth initiation from the browser. |
| Authenticated homepage preservation | Browser / Client | Supabase Auth | `AuthContext` provides `user`, `role`, and `isLoading`; `HomeView` chooses the branch. |
| Invite-link compatibility | Browser / Client | Database / Storage | `/register` and `useRegistration` own token-based registration and must remain separate. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Route view rendering and stateful UI | Existing app framework in `package.json`. |
| React Router | 7.13.1 | Client route graph | Existing `App.tsx` routing layer. |
| Supabase JS | 2.99.2 | Google OAuth initiation and auth session state | Existing auth client and `AuthContext` provider. |
| Playwright | 1.58.2 | Browser route/auth smoke tests | Existing E2E runner and dev server config. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Sonner | 2.0.7 | Toast errors for UI actions | Only if OAuth initiation needs visible error handling. |
| Tailwind CSS | 4.2.1 | Utility styling | Match existing `HomeView` style. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `HomeView` branch | New `PublicHomeView` route component | Adds indirection for one narrow branch and risks changing signed-in routing. |
| Existing Supabase OAuth | Public registration form | Explicitly out of scope and contradicts D-04/AUTH-02. |

**Installation:** None. Use existing dependencies.

## Architecture Patterns

### System Architecture Diagram

```text
Visitor opens /
  -> App.tsx root route
  -> PlayerLayout
  -> HomeView
      -> AuthContext isLoading true: spinner
      -> no user: simple public homepage + Register button
          -> Register click: supabase.auth.signInWithOAuth(provider: google, redirectTo: /)
      -> user present: existing authenticated welcome + BulletinBoard

Visitor opens /register?token=...
  -> RegisterView
  -> useRegistration(token)
  -> existing invite-token validation and auto-registration flow
```

### Recommended Project Structure

```text
badminton-v2/
+-- src/views/HomeView.tsx              # Public signed-out homepage branch
+-- src/views/RegisterView.tsx          # Existing invite-token flow, unchanged
+-- tests/public-homepage.spec.ts       # Phase 12 E2E smoke coverage
```

### Pattern 1: Root View Owns Auth Branching

**What:** `HomeView` reads `useAuth()` and renders loading, signed-out, or signed-in content in one route-level component. [VERIFIED: codebase]

**When to use:** For root homepage behavior that depends on auth state but does not require route graph changes.

### Pattern 2: OAuth Redirect Uses App Origin

**What:** `HomeView` currently passes a `redirectTo` value based on `import.meta.env.VITE_APP_URL ?? window.location.origin`, ending at `/`. [VERIFIED: codebase]

**When to use:** Preserve this for the Register CTA so OAuth returns to `/` as required by D-05.

### Anti-Patterns to Avoid

- **Adding a public form:** Contradicts D-04 and AUTH-02.
- **Moving normal onboarding into `/register`:** Keeps invite-link dependency and fails INVITE-02.
- **Changing `App.tsx` unnecessarily:** The root route already reaches `HomeView`; route graph changes increase regression risk.
- **Removing token registration code:** Contradicts D-07 and INVITE-01.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication provider flow | Custom Google OAuth flow or form | Existing Supabase `signInWithOAuth` | Existing app already centralizes auth through Supabase. |
| Public homepage route | New routing shell | Existing `/` route and `HomeView` branch | Avoids altering signed-in navigation behavior. |

## Common Pitfalls

### Pitfall 1: Register CTA Still Looks Like Generic Sign-In
**What goes wrong:** The user can technically click the button, but the page still reads like a sign-in wall.
**Why it happens:** Only the button label changes.
**How to avoid:** Include basic app information and registration-oriented CTA text per D-01 and D-02.
**Warning signs:** Tests only assert `Sign in with Google`, not public homepage content.

### Pitfall 2: Authenticated Home Regression
**What goes wrong:** Signed-in users see the public homepage before or after auth loads.
**Why it happens:** The `user` branch is changed or loading behavior is weakened.
**How to avoid:** Preserve the `isLoading` spinner and signed-in return block in `HomeView`.
**Warning signs:** `Welcome back!` no longer appears after dev-login in E2E.

### Pitfall 3: Invite Flow Coupling
**What goes wrong:** `/register` behavior changes while trying to support homepage registration.
**Why it happens:** Treating token registration and public homepage registration as the same flow.
**How to avoid:** Keep `RegisterView` untouched unless tests reveal compatibility breakage.
**Warning signs:** `Registration Closed` no-token state changes without requirement.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `badminton-v2/playwright.config.ts` |
| Quick run command | `npm run test:e2e -- public-homepage.spec.ts` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REG-01 | Signed-out `/` shows public homepage, not a generic immediate sign-in wall. | E2E | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |
| REG-02 | Public homepage has a visible Register action. | E2E | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |
| REG-03 | Register action initiates Google OAuth through Supabase. | E2E smoke/mock | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |
| AUTH-01 | Signed-in users still see authenticated homepage content. | E2E | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |
| AUTH-02 | No alternate auth method or public form appears. | E2E | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |
| INVITE-01 | `/register` remains reachable and tokenless state remains compatible. | E2E | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |
| INVITE-02 | Root Register starts onboarding without requiring `token`. | E2E | `npm run test:e2e -- public-homepage.spec.ts` | Wave 1 creates |

### Sampling Rate

- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run test:e2e -- public-homepage.spec.ts`
- **Phase gate:** `npm run lint` and affected E2E green before `$gsd-verify-work`

### Wave 0 Gaps

- None - Playwright infrastructure exists. The phase plan should add the missing spec in the same execution plan before relying on it.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase Google OAuth only; no custom credential collection. |
| V3 Session Management | yes | Existing Supabase session handling through `AuthContext`. |
| V4 Access Control | yes | Existing route-level auth/admin checks remain unchanged. |
| V5 Input Validation | no | No new public form or user input is introduced. |
| V6 Cryptography | yes | OAuth/session cryptography remains owned by Supabase. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect drift | Spoofing | Preserve explicit root `redirectTo` using app origin. |
| Accidental credential collection | Information Disclosure | Do not add public registration form fields. |
| Auth route regression | Elevation of Privilege | Do not modify `AdminRoute`, `AuthContext`, or `/register` token validation unless tests require it. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dev login panel can be used in E2E to simulate an authenticated user for AUTH-01. | Validation Architecture | If disabled in a target env, the signed-in branch may require a different seeded auth helper. |

## Open Questions (RESOLVED)

1. **Should the homepage use a new route or component?**
   - RESOLVED: Use existing `HomeView` root branch. The route already exists and this avoids signed-in behavior changes.
2. **Should `/register` be changed for normal onboarding?**
   - RESOLVED: No. It remains invite-token compatibility only; normal onboarding starts from `/`.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). Phase 12 uses existing Vite, React, Supabase, and Playwright dependencies already declared in `badminton-v2/package.json`.

## Sources

### Primary (HIGH confidence)
- `badminton-v2/package.json` - Verified existing dependency versions and scripts.
- `badminton-v2/src/views/HomeView.tsx` - Verified root auth branch and OAuth redirect pattern.
- `badminton-v2/src/App.tsx` - Verified root and `/register` route graph.
- `badminton-v2/src/views/RegisterView.tsx` - Verified invite-token registration remains isolated.
- `badminton-v2/src/contexts/AuthContext.tsx` - Verified auth state shape used by `HomeView`.
- `badminton-v2/tests/registration-limit.spec.ts` - Verified Playwright/dev-login patterns.
- `.planning/REQUIREMENTS.md` and `.planning/phases/12-public-registration-homepage/12-CONTEXT.md` - Verified scope and locked decisions.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified in `package.json`.
- Architecture: HIGH - verified by direct source inspection.
- Pitfalls: HIGH - derived from existing code boundaries and locked decisions.

**Research date:** 2026-05-12
**Valid until:** 2026-06-11
