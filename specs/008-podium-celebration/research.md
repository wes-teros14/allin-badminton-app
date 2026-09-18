# Phase 0: Research — Leaderboard Celebrations

Each entry is a decision that could reasonably have gone another way, with what was chosen, why, and
what was rejected. Several were settled against working prototypes in `temporary_files/` rather than
in the abstract.

---

## R1 — How to know cheaply that anything could have changed

**Decision**: On evaluation, issue one small query for the most recent `completed_at` among sessions
with `status = 'complete'`. Compare it against the value stored alongside the player's recorded
standings. If unchanged, stop — no board computation at all.

**Rationale**: Celebrating "in place" means the app must know a player's rank from anywhere, but the
Individual board reads `player_stats`, every active profile, recent sessions and registrations, and
the Partners board pages through every completed match with an exact-count cross-check. Paying that on
every launch is indefensible for a feature that has news maybe once a week. Ranks can only move when a
session completes, so a single scalar makes a perfect gate. The common launch costs one indexed
lookup.

**Alternatives considered**:
- *Compute on every launch.* Correct but wasteful — several seconds of queries for a result that is
  almost always "nothing happened".
- *A dedicated `leaderboard_version` column or trigger.* More precise, but needs a migration and a
  trigger to maintain, and `completed_at` already changes exactly when ranks can change.
- *Realtime subscription on session completion.* Would deliver the news mid-interaction, which the
  spec explicitly does not want, and adds a live connection for a once-a-week event.

---

## R2 — One definition of a rank, or two

**Decision**: Extract the board fetchers and ranking out of `LeaderboardView.tsx` into
`src/lib/leaderboardData.ts`, and have both the leaderboard screen and the celebration hook import it.

**Rationale**: Constitution Principle III, and a specific scar this codebase already carries.
`project_memory.md` records that match outcomes were independently derived in two places and the two
disagreed — one surface showed a 1-1 split as a win. The fix at the time was to delete the second copy
rather than keep it correct. A celebration that congratulates a player the leaderboard does not place
in the top 3 is exactly that bug, wearing a party hat.

**Alternatives considered**:
- *A lighter "just my rank" query.* Tempting, because the celebration only needs one row. Rejected:
  ranking here is dense ranking over an ordered set with eligibility gates (minimum sessions, recent
  activity, minimum cheers, minimum games together), so "just my rank" would have to re-implement all
  of it. Two implementations of that will drift.
- *Leave the fetchers in the view and import from the view.* Works technically, but makes a 950-line
  view a dependency of a hook, and pulls React into a data path that does not need it.

**Status**: the extraction is already written and typechecks; its lint and full test run were
interrupted and must be re-run before it is trusted. Treat as unverified work-in-progress, not done.

---

## R3 — Where recorded standings live

**Decision**: `localStorage`, keyed by player id, for the first release.

**Rationale**: The data is presentation history — "what have we already told this person" — not
session or product data. It is small, it is read on launch, and it has no value to anyone but the one
device's user. No migration, no RLS policy, no new table.

**Consequences accepted**:
- A player who uses a second device gets one silent evaluation there before celebrations begin,
  because that device has no recorded standings and the first-run rule applies. They miss at most one
  celebration; they are never congratulated twice.
- Clearing browser data has the same effect.

**Alternatives considered**:
- *A `player_leaderboard_standings` table in Supabase.* Correct across devices and durable, and the
  natural upgrade if players start using several devices. Rejected for v1 as a migration plus RLS plus
  a write path for a feature whose failure mode is "one missed celebration". The storage module is
  written behind a narrow interface so this swap is a change to one file.
- *Session storage or in-memory.* Would re-celebrate on every launch. Actively wrong.

**Key naming**: keys are namespaced per player id so two accounts on one phone cannot read or
overwrite each other — an explicit spec requirement (FR-010), and a real case here since the app has a
dev login panel that switches between test players on one browser.

---

## R4 — Distinguishing "not placed" from "not watched"

**Decision**: A recorded standing stores, per board, either a number or an explicit null, and the
*absence* of a board key means something different from a null value.

**Rationale**: This is the single subtlest rule in the feature and it protects two separate silences.
A null means "we watched this board and you were not on it" — so appearing on it later is news. A
missing key means "we were not watching this board when we last looked" — so appearing on it is not
news, because we cannot tell whether the player just arrived or has been there for months. Without the
distinction, adding a seventh cheer category would congratulate everyone already inside its top 3.

**Alternatives considered**:
- *Treat missing as null.* Simpler, and wrong in exactly the case above.
- *Version the snapshot and reset on change.* Punishes every player for a board being added, silencing
  legitimate celebrations across all boards rather than just the new one.

---

## R5 — Animation approach

**Decision**: Hand-written canvas particles, roughly sixty lines, drawn into an overlay canvas sized
to the viewport.

**Rationale**: Prototyped and measured. A Lottie confetti file of the kind originally suggested is
about 200 KB of JSON plus a ~300 KB player, and renders fixed shapes at a fixed size regardless of the
device. The canvas version downloads nothing, scales to the screen, and lets the podium and non-podium
bursts be provably identical because they are the same function with the same arguments.

**Alternatives considered**:
- *Lottie.* Rejected on payload and inflexibility, not on looks.
- *`canvas-confetti` (npm).* Reasonable, but a dependency for something the prototype already does.
- *CSS-only particles.* Dozens of animated DOM nodes; worse on a mid-range phone than one canvas.

**Trap found in prototyping, recorded so it is not rediscovered**: an emitter that seeds its first
particles on a timer will be killed by an animation loop that stops when the particle array is empty —
the loop runs once, sees nothing, and shuts down before the first batch arrives. The loop must stay
alive while an emitter is still producing, not merely while particles exist.

---

## R6 — Podium versus non-podium presentation

**Decision**: Identical card, identical confetti, identical time on screen. Rank is carried by the
border — three pixels in the medal colour for a podium, the ordinary one-pixel border otherwise — and
the icon: a medal, or the app's thumbs-up bunny.

**Rationale**: A product decision by the user, made explicitly against a prototype that had done the
opposite. An earlier draft made the non-podium card smaller and purple so that a podium would visibly
outrank it; the user overruled that on the grounds that everybody who achieved something deserves the
same celebration. Recorded here because the reasoning is not recoverable from the code.

**Medal colours** reuse the leaderboard's existing `PODIUM_TINT` values — `--gold`, zinc-400,
amber-700 — rather than inventing a second set. The existing code carries a note that bronze is a
brown rather than an orange because an orange edge on a dark card reads as the destructive red; that
constraint applies here unchanged.

---

## R7 — Which achievements ship first

**Decision**: Four of the five. Top 3, first appearance on a board, personal best placing, and a climb
of one or more places. "Improving for three consecutive sessions" is deferred.

**Rationale**: The four shipping achievements each compare against a single previous snapshot. The
streak needs several past standings per board — a different storage shape, a migration of existing
stored data, and a silent period after release before any streak can exist to detect. It is also the
least distinct of the five: a player on a three-session climb has almost certainly set a personal best
somewhere in it, so they would have been celebrated anyway.

**Thresholds**: the climb threshold is **one place**, set by product decision — any improvement is
worth telling someone about, in the same spirit as giving non-medallists the identical celebration.

An earlier draft used three, on the reasoning that in a fourteen-player session half the field moves
up whenever the other half moves down. That was overruled. It fires less often than the bare number
suggests, because `personal-best` outranks it: a player who improves *and* betters their own record is
celebrated for that instead, so a climb is someone recovering ground toward a high they held before.
The accepted cost is the oscillating player — 7th, 6th, 7th, 6th earns a card every other session for
going nowhere. This is the one dial that cheapens the celebration fastest if it needs turning back.

**Precedence**, highest first: top 3, first appearance, personal best, (streak), places climbed.
"First appearance" must outrank "personal best" because it is always also a personal best; personal
best outranks a plain climb for the same reason. Places climbed sits last because it is the weakest
claim — a player can climb purely because the people above them stopped attending.

---

## R8 — When evaluation runs

**Decision**: On app start, and when the app returns to the foreground.

**Rationale**: Keeps the news timely without interrupting an interaction. A session finalised while a
player is mid-tap is announced the next time they come back to the app, which is both calmer and
easier to reason about than an announcement arriving over a form.

**Alternatives considered**:
- *On every route change.* Many more evaluations for no benefit, given the sentinel makes most of them
  cheap but not free.
- *Realtime push.* See R1 — deliberately not wanted.

---

## R9 — Expiry of an uncollected sweep

**Decision**: An uncollected sweep lapses when the next session completes.

**Rationale**: Resolved during planning after the question went unanswered; see spec *Clarifications*.
Tying expiry to the session cadence means the sweep is always about the most recent result, needs no
tunable duration, and cannot leave a stale debt outstanding when a newer one is earned. A player who
does not open the leaderboard between sessions simply never collects it — acceptable, because the card
and the toast already reached them.

---

## R10 — The two-route trap

**Decision**: Arming the sweep and consuming it are two distinct steps, and arming happens when the
celebration is *shown*, not when the player accepts the offer.

**Rationale**: A prototype of this feature had precisely this bug. Tapping the toast navigated
correctly but never swept, because only the ignore-the-toast path recorded that a sweep was pending.
The main path silently did nothing, and it looked fine in a screenshot. Two routes reach the
leaderboard — accepting the offer, and arriving later unprompted — and both must find the same "a
sweep is owed" state waiting for them.

**Testing consequence**: the Playwright spec must cover *both* arrival routes. A test that only
exercises the toast would have passed against the broken prototype.
