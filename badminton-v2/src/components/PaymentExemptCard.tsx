/**
 * The Settings list of players who don't pay (migration 082).
 *
 * Adding or removing someone updates their registrations in every session that
 * is not complete; completed sessions keep the numbers they closed with.
 */

import { PlayerListCard } from '@/components/PlayerListCard'

export function PaymentExemptCard() {
  return (
    <PlayerListCard
      table="payment_exempt_players"
      title="Players who don't pay"
      description="They skip the payment steps, and finance doesn't count them as unpaid. Applies to sessions that aren't finished yet. Saved as soon as you change it."
      emptyText="Nobody yet. Everyone pays."
      addLabel="Add a player who doesn't pay"
      addedMessage={(name) => `${name} won't be asked to pay`}
      removedMessage={(name) => `${name} pays again from now on`}
    />
  )
}

export default PaymentExemptCard
