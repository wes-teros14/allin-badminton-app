/**
 * The payment states shown across the app.
 *
 * This value is DERIVED, never stored. `session_registrations.paid`
 * keeps its exact original meaning -- payment confirmed by an admin --
 * and stays the sole input to revenue in `get_session_finance`, which
 * computes it as `COUNT(*) FILTER (WHERE sr.paid) * price`.
 *
 * Deriving the middle state rather than adding a `payment_status`
 * column means there is no second value that can disagree with `paid`,
 * and a disagreement there would surface as wrong money. It also means
 * registrations that predate the receipts feature derive to exactly the
 * state they already showed, with no backfill.
 */
export type PaymentState = 'unpaid' | 'submitted' | 'paid' | 'exempt'

/**
 * `paid` dominates: a confirmed player is green regardless of receipt
 * count, which is what makes reversing a confirmation safe -- receipts
 * are retained and the row simply re-derives to orange.
 *
 * `paid` is NOT NULL in the database, but the player-side read path
 * types it `boolean | null` for the not-registered case, and the
 * existing suite pins null-as-unpaid. That behaviour is preserved here
 * rather than tightened.
 *
 * `activeReceiptCount` must count only receipts with `dismissed_at IS
 * NULL`. A dismissed receipt stays visible to the admin for audit but
 * contributes nothing to the state.
 *
 * `exempt` is `session_registrations.payment_exempt` (migration 082): the
 * player is on the Settings "don't pay" list. It ranks below `paid`
 * on purpose -- someone confirmed paid before being added keeps their money
 * in revenue and stays green. It is required rather than optional so that no
 * caller can silently forget it and show an exempt player as unpaid.
 */
export function derivePaymentState({
  paid,
  activeReceiptCount,
  exempt,
}: {
  paid: boolean | null
  activeReceiptCount: number
  exempt: boolean | null
}): PaymentState {
  if (paid === true) return 'paid'
  if (exempt === true) return 'exempt'
  return activeReceiptCount > 0 ? 'submitted' : 'unpaid'
}

/** Player-facing label for each state. */
export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  unpaid: 'Unpaid',
  submitted: 'Awaiting confirmation',
  paid: 'Paid',
  exempt: 'No fee',
}
