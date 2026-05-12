# Phase 12: Public Registration Homepage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 12-Public Registration Homepage
**Areas discussed:** Homepage first impression, Register button behavior, Post-login destination, Invite-link compatibility

---

## Homepage First Impression

| Option | Description | Selected |
|--------|-------------|----------|
| Basic app info | Signed-out homepage explains the app briefly and gives a clear registration entry point. | Yes |
| Marketing-style landing page | Larger promotional page with richer sections and more copy. | No |
| Minimal button-only page | Little or no explanation beyond a Register button. | No |

**User's choice:** Basic app info.
**Notes:** User said the homepage may just show basic information about the app.

---

## Register Button Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to Google OAuth | Register immediately starts the existing Google sign-in flow. | Yes |
| Confirmation/context step first | Register opens a small explanation step before Google sign-in. | No |
| Public registration form first | User fills a public form before signing in. | No |

**User's choice:** Straight to Google OAuth.
**Notes:** User confirmed the Register button should go straight to registration via Google sign-in.

---

## Post-Login Destination

| Option | Description | Selected |
|--------|-------------|----------|
| Homepage URL | OAuth redirect returns to `/`, preserving the existing signed-in homepage behavior. | Yes |
| Dedicated registration completion page | OAuth redirect lands on a separate page after sign-in. | No |
| Sessions page | OAuth redirect lands directly on the sessions list. | No |

**User's choice:** Homepage URL.
**Notes:** User said the post-login destination should be the homepage URL.

---

## Invite-Link Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Keep invite link code unchanged | Do not remove or redesign existing invite-link/session-token behavior. | Yes |
| Hide invite links but refactor code | Keep compatibility while changing internals now. | No |
| Remove invite-link support | Delete old invite-token behavior. | No |

**User's choice:** Keep invite link code unchanged.
**Notes:** User said to keep invite link behavior for now and make no code changes for it.

---

## the agent's Discretion

- The agent may decide exact signed-out homepage copy, layout, and styling within existing app conventions.

## Deferred Ideas

None.
