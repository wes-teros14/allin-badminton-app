# Phase 12: Public Registration Homepage - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase changes the signed-out root homepage experience. Signed-out visitors who open `/` should see basic app information and an explicit Register button instead of an immediate Google sign-in prompt. The Register button starts the existing Google OAuth flow directly. Signed-in users keep the current authenticated homepage behavior. Existing invite-link registration code remains in place for compatibility.

</domain>

<decisions>
## Implementation Decisions

### Homepage First Impression
- **D-01:** The signed-out homepage should show only basic information about the app. Keep the page simple and informational; do not turn it into a large marketing site.
- **D-02:** The page should make it clear enough that this is the badminton group app and that registration starts from the homepage.

### Register Button Behavior
- **D-03:** The Register button should go straight to the existing Google OAuth flow.
- **D-04:** Do not add a public registration form or an intermediate confirmation step before Google sign-in.

### Post-Login Destination
- **D-05:** After Google sign-in from the Register button, redirect back to the homepage URL (`/`).
- **D-06:** Signed-in users should continue to see the existing authenticated homepage experience with no added landing step.

### Invite-Link Compatibility
- **D-07:** Keep the invite-link/session-token code for now.
- **D-08:** Do not modify invite-link behavior in this phase except as necessary to ensure homepage onboarding no longer depends on it.

### the agent's Discretion
- The exact copy, layout, and visual treatment of the simple signed-out homepage are left to the planner/executor, constrained by the existing app style and the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope
- `.planning/ROADMAP.md` - Phase 12 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - v1.2 requirement IDs and out-of-scope boundaries.
- `.planning/PROJECT.md` - Project context and milestone goal.

### Entry Flow Code
- `badminton-v2/src/views/HomeView.tsx` - Current signed-out homepage prompt, signed-in homepage behavior, and Google OAuth redirect for `/`.
- `badminton-v2/src/App.tsx` - Route graph, root route, authenticated/admin route behavior, and provider composition.
- `badminton-v2/src/views/RegisterView.tsx` - Existing invite-token registration flow that must remain compatible.
- `badminton-v2/src/hooks/useRegistration.ts` - Existing token-based registration hook used by `RegisterView`.
- `badminton-v2/src/contexts/AuthContext.tsx` - Auth state, role loading, and signed-in session behavior.

### Codebase Guidance
- `.planning/codebase/STRUCTURE.md` - Where route views, hooks, and tests belong.
- `.planning/codebase/CONVENTIONS.md` - React/TypeScript naming, import, error, and style conventions.
- `.planning/codebase/TESTING.md` - Unit and Playwright test patterns for validating route/auth behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `badminton-v2/src/views/HomeView.tsx`: Reuse this route as the owner of the signed-out and signed-in homepage split.
- `badminton-v2/src/lib/supabase.ts`: Use the existing typed Supabase client for `supabase.auth.signInWithOAuth`.
- `badminton-v2/src/contexts/AuthContext.tsx`: Use existing `user`, `role`, and `isLoading` state to preserve signed-in behavior.
- `badminton-v2/src/views/RegisterView.tsx`: Keep this view and its token handling intact for legacy invite links.

### Established Patterns
- Route-level screens live in `badminton-v2/src/views/` and are wired from `badminton-v2/src/App.tsx`.
- App-owned React files use 2-space indentation, PascalCase components, camelCase helpers, and `@/` imports.
- Async UI actions generally use the existing Supabase client directly and keep user-facing failures simple.
- Existing signed-out auth prompts redirect to `${import.meta.env.VITE_APP_URL ?? window.location.origin}/...`; preserve this redirect pattern unless planning finds a concrete reason to adjust it.

### Integration Points
- Root route `/` currently renders `HomeView` inside `PlayerLayout` from `badminton-v2/src/App.tsx`.
- Signed-out homepage behavior currently lives inside the `if (!user)` branch in `badminton-v2/src/views/HomeView.tsx`.
- Existing invite-token registration is handled separately at `/register` by `badminton-v2/src/views/RegisterView.tsx`.

</code_context>

<specifics>
## Specific Ideas

- Signed-out homepage content should be basic app information.
- The primary action label should be Register or a closely equivalent registration-oriented label, not a generic-only sign-in prompt.
- The Register action should immediately start Google sign-in.
- After OAuth, redirect back to the homepage URL.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 12-Public Registration Homepage*
*Context gathered: 2026-05-12*
