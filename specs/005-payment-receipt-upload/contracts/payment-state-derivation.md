# Contract: Payment State Derivation

The three-state payment value is a **pure function**, not a database column. This file is its contract, because every surface in the app must agree on it (FR-020) and because the arrangement is what keeps finance untouched (FR-034, SC-004).

## Module

`src/lib/paymentState.ts`

```ts
export type PaymentState = 'unpaid' | 'submitted' | 'paid'

export function derivePaymentState(input: {
  paid: boolean | null
  activeReceiptCount: number
}): PaymentState
```

## Truth table

| `paid` | `activeReceiptCount` | Result | Colour | Label |
|---|---|---|---|---|
| `true` | `0` | `paid` | green | Paid |
| `true` | `> 0` | `paid` | green | Paid |
| `false` | `> 0` | `submitted` | orange | Awaiting confirmation |
| `null` | `> 0` | `submitted` | orange | Awaiting confirmation |
| `false` | `0` | `unpaid` | red | Unpaid |
| `null` | `0` | `unpaid` | red | Unpaid |

`paid` dominates: a confirmed player is green regardless of how many receipts exist, which is what makes the `paid → unpaid` reversal in US2 scenario 6 safe — receipts are retained and the row simply re-derives to orange.

`activeReceiptCount` counts only rows with `dismissed_at IS NULL`. A dismissed receipt is still visible to the administrator (FR-027) but contributes nothing here, which is what returns a player to red in US4.

`null` is treated as unpaid. The column is `NOT NULL` in the database, but the player-side read path types it `boolean | null` for the not-registered case (`SessionPlayerDetailView.tsx:22`) and the existing suite already pins null-as-unpaid in `sessionPlayerDetailView.paymentVisibility.test.ts`. The helper preserves that rather than tightening it.

## What this contract forbids

- **No `payment_status` column.** Any stored copy can disagree with `paid`, and the disagreement would surface as wrong money, since `get_session_finance` (`074:53`) computes revenue as `COUNT(*) FILTER (WHERE sr.paid) × price`.
- **No surface may compute its own version.** All three read paths — the player's session card, the player's sessions list, and the admin payment panel — import this function. A local ternary anywhere is a Principle III violation waiting to drift.
- **`submitted` is never revenue.** Orange is a claim, not collected money. No caller may treat it as paid for any total, count, or export.

## Relationship to `shouldShowPaymentInfo`

The existing exported helper in `SessionPlayerDetailView.tsx:17` stays as-is:

```ts
isRegistered && paid !== true && hasPaymentInfo
```

It already returns `true` for both `unpaid` and `submitted`, because both have `paid !== true`. That is precisely the behaviour FR-011 wants — the payment details stay visible alongside the submitted receipts until an administrator confirms. Its six existing unit tests continue to pass unmodified, and the new receipt UI renders inside the banner it already gates.

## Consumers

| Surface | File | Uses |
|---|---|---|
| Player session card | `SessionPlayerDetailView.tsx` | Own state → banner content, awaiting-confirmation copy |
| Player sessions list | `MySessionsView.tsx` (via `usePlayerSessions.ts`) | Own state → payment label + colour (replaces the two-state ternary at `MySessionsView.tsx:117`) |
| Admin payment panel | `RosterPanel.tsx` (via `useRoster.ts`) | Per-player state → row indicator + header tally (replaces the two-state counts at `RosterPanel.tsx:52-53`) |

## Test obligation

`derivePaymentState` is pure and dependency-free, so all six truth-table rows are covered by a table-driven unit test in `src/__tests__/paymentState.test.ts`. Because this function is the single point where the middle state comes into existence, that test is the cheapest available proof of FR-016 through FR-019.
