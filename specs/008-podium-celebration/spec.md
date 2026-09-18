# Feature Specification: Leaderboard Celebrations

**Feature Branch**: `008-podium-celebration`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "tasks/podium-celebration-brief.md — celebrate when a player's standing on a leaderboard improves in a way that is new to them, with a card in place, a toast offering that board, and a sweep on their row when they arrive."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A player learns they made the podium (Priority: P1)

A player is somewhere in the app — checking next Sunday's session, looking at their profile — when the
results of the session they played are finalised. A card springs up over whatever they are looking at,
showing a medal, "2nd place!", and which board it was on. It clears itself after a moment. They now
know something they would otherwise only have found by going looking.

**Why this priority**: This is the whole point of the feature. Without it a player can top a board for
weeks and never find out. Everything else in this spec makes that moment easier to act on, but the
moment itself is the value, and it stands alone.

**Independent Test**: Complete a session that moves a test player into the top 3, open the app as that
player on any screen, and confirm a card appears naming the correct medal, placing and board, and that
it disappears without interaction.

**Acceptance Scenarios**:

1. **Given** a player ranked 5th on Individual whose last recorded rank was 5th, **When** a completed
   session moves them to 3rd, **Then** a card appears naming 3rd place on Individual.
2. **Given** a player who was 2nd last time and is 2nd again, **When** they open the app, **Then** no
   card appears.
3. **Given** a player who was 3rd and is now 1st, **When** they open the app, **Then** a card appears
   naming 1st place, because improving within the podium is still news.
4. **Given** a player on the Sessions screen, **When** the card appears, **Then** the screen behind it
   is not navigated away from and no tap of theirs is consumed.
5. **Given** a player who has never had their ranks recorded, **When** the feature runs for the first
   time, **Then** no card appears and their current ranks are recorded silently.
6. **Given** a card is on screen, **When** the player does nothing, **Then** the card leaves on its
   own without requiring a dismiss action.

---

### User Story 2 - The player goes and looks at the board (Priority: P2)

Once the card has cleared, a toast slides up naming the placing and offering to show that board.
Tapping it opens the leaderboard already switched to the right board, and the player's own row lifts
and shimmers so they can see themselves without reading down the list. Ignoring the toast costs
nothing.

**Why this priority**: Turns the announcement into something the player can act on. Valuable, but the
announcement in Story 1 already delivers on its own, so this can follow.

**Independent Test**: Trigger a celebration, confirm a toast appears after the card, tap its action,
and confirm arrival on the correct board with the player's own row visibly marked.

**Acceptance Scenarios**:

1. **Given** the card has cleared, **When** the toast appears, **Then** it names the same placing and
   board as the card and offers an action to view it.
2. **Given** the toast is showing, **When** the player taps the view action, **Then** the leaderboard
   opens already switched to that board and the player's own row plays a sweep.
3. **Given** the toast is showing, **When** the player ignores or dismisses it, **Then** nothing
   navigates and no further prompting occurs.
4. **Given** the player ignored the toast, **When** they later open that leaderboard themselves,
   **Then** their row still plays the sweep.
5. **Given** a celebration for the Partners board, **When** the toast appears, **Then** it names the
   partner the placing was earned with.

---

### User Story 3 - A player who did not medal is celebrated too (Priority: P3)

A player who is 6th — better than they have ever been — gets the same card, the same confetti and the
same time on screen as a medallist. The icon is the app's thumbs-up bunny instead of a medal, and the
card's border is the ordinary one rather than a medal colour. Nothing else about the moment is
smaller.

**Why this priority**: Extends the feature past the three people who can be on a podium, which is most
of the roster. It depends on Story 1's machinery, so it follows it, but it is the difference between a
feature for three players and a feature for everyone.

**Independent Test**: Move a test player from 9th to 6th without entering the top 3 and confirm a card
appears reading "Your best yet!" with the bunny icon and a plain border.

**Acceptance Scenarios**:

1. **Given** a player whose best ever rank was 9th, **When** they reach 6th, **Then** a card appears
   announcing a personal best, using the bunny icon and the ordinary border.
2. **Given** a player appearing in a board's top 10 for the first time, **When** the celebration
   fires, **Then** it announces making the board rather than a personal best.
3. **Given** a player who improved by 2 places without setting a personal best, **When** the check
   runs, **Then** no celebration fires, because the climb threshold is 3.
4. **Given** a podium placing and a non-podium achievement earned at the same time, **When** the
   celebration fires, **Then** the podium one is the one shown.
5. **Given** a non-podium celebration, **When** it is compared with a podium one, **Then** the card
   size, confetti and time on screen are identical and only the icon and border differ.

---

### User Story 4 - Several achievements at once become one celebration (Priority: P4)

A good session can move a player on several boards at the same time. Rather than a queue of cards to
sit through, one card lists them: a row of medals, a count, and a line per board. The toast names the
best and mentions how many others there were.

**Why this priority**: A correctness and dignity issue rather than a new capability — but if Stories
1-3 ship without it, a player with a great night gets punished with a sequence of interruptions.

**Independent Test**: Move a test player onto three boards in one session and confirm exactly one card
appears, listing all three.

**Acceptance Scenarios**:

1. **Given** a player newly placing on three boards, **When** the celebration fires, **Then** exactly
   one card appears and it lists all three.
2. **Given** that card, **When** it is displayed, **Then** it stays on screen longer than a
   single-achievement card, and still leaves on its own.
3. **Given** several placings, **When** the toast appears, **Then** it names the best one and states
   how many others there were.
4. **Given** several placings, **When** the player taps the toast's action, **Then** they arrive at
   the board of the best placing.

---

### Edge Cases

- **First ever run.** A player who has held 2nd place for months must not be congratulated the day the
  feature ships. The first run records ranks and says nothing.
- **A board added later.** If a seventh cheer category is introduced, players already inside its top 3
  must not be congratulated for a standing they already had. An unwatched board is not news the first
  time it is watched.
- **Standing got worse.** Reported, at the same threshold as a gain and with the same card. A player
  who slips *within* the podium keeps their medal border, because they still hold that place. Leaving
  the board entirely is still silent — "down N places" needs a place to have landed on.
- **Ties.** Two players sharing a rank both hold that place; a tie is a placing, not a near miss.
- **Improved and worsened at once.** A player who gains on one board and loses on another is
  celebrated for the gain and not told about the loss.
- **Toast never tapped.** The owed row sweep persists for the player's next visit to that board.
- **Reduced motion.** A player whose device asks for reduced motion still receives the information —
  the same card content, without the spring, the particles or the sweep.
- **Two accounts on one device.** Celebration state belongs to a player, not a device; signing in as
  someone else must not inherit or overwrite the other's recorded ranks.
- **Partner without a nickname.** A Partners celebration must still name the partner readably.
- **Nothing has changed.** On an app launch where no session has completed since the last check, the
  feature must do effectively no work.
- **Player never opens the leaderboard.** The celebration and toast still reached them; the sweep is
  simply never collected.

## Requirements *(mandatory)*

### Functional Requirements

**Detection**

- **FR-001**: System MUST determine whether a player's standing has improved by comparing against the
  standings last recorded for that player, never against the current board alone.
- **FR-002**: System MUST record a player's current standings without celebrating anything the first
  time it ever evaluates that player.
- **FR-003**: System MUST treat a board absent from a player's previous recorded standings as not yet
  watched, and MUST NOT celebrate a standing on it until the following evaluation.
- **FR-004**: System MUST NOT announce an unchanged standing, or a standing lost entirely. A worsened
  standing that still holds a place MUST be announced — see FR-007.
- **FR-005**: System MUST celebrate an improvement that occurs entirely inside the top 3, such as 3rd
  to 1st.
- **FR-006**: System MUST watch the Individual board, the Partners board, and each of the six Cheers
  category boards. The Awards board is excluded, having a single holder and no second or third place.
- **FR-007**: System MUST recognise these movements: reaching the top 3; appearing in a board's top 10
  for the first time; improving by one or more places; and **falling by one or more places**. The
  system MUST NOT claim a personal best, because it holds no rank history and cannot know one.
- **FR-008**: System MUST select exactly one movement to announce per evaluation, in this order of
  precedence: top 3, first appearance, places climbed, places lost.
- **FR-009**: System MUST record the player's new standings once an evaluation completes, so the same
  achievement cannot be celebrated twice.
- **FR-010**: System MUST keep recorded standings per player, so that two players using the same
  device never read or overwrite each other's.

**Announcement**

- **FR-011**: System MUST display the celebration over whatever screen the player is currently on,
  without navigating away from it.
- **FR-012**: System MUST NOT redirect a player as a result of a celebration; any navigation MUST be
  the result of the player choosing it.
- **FR-013**: The card MUST name the achievement, the board it was earned on, and a short qualifying
  detail — the partner for a Partners placing, the share for a Cheers placing.
- **FR-014**: The card MUST dismiss itself without requiring any player action.
- **FR-015**: The card MUST remain on screen long enough to be read, scaling with how much it says: a
  baseline for a single achievement, extended for each additional one, up to a stated ceiling.
- **FR-016**: When several achievements are earned at once, the system MUST present them as one card
  listing each, and MUST NOT present them as consecutive celebrations.
- **FR-017**: A podium card MUST carry a thicker border in the colour of the place earned — first,
  second and third each distinct, and consistent with the colours the leaderboard's own podium rows
  use. Every other card MUST use the ordinary border.
- **FR-018**: A non-podium card MUST be identical to a podium card in size, animation, celebratory
  effects and time on screen, differing only in its icon and its border.
- **FR-019**: A non-podium card MUST use the application's thumbs-up mascot as its icon.

**Follow-through**

- **FR-020**: After the card clears, the system MUST offer the player a way to view the board the
  achievement was earned on.
- **FR-021**: Declining or ignoring that offer MUST have no consequence beyond the offer disappearing.
- **FR-022**: When several achievements were earned, the offer MUST identify the best one and indicate
  how many others there were, and MUST lead to the best one's board.
- **FR-023**: On arriving at a board with an uncollected celebration, the system MUST visibly mark the
  player's own row so they can locate themselves without reading the list.
- **FR-024**: The row marking MUST occur whether the player arrived by accepting the offer or by
  navigating there themselves.

**Accessibility and cost**

- **FR-025**: Where the player's device requests reduced motion, the system MUST convey the same
  information without animation, motion or particle effects.
- **FR-026**: System MUST establish cheaply whether any standing could have changed before doing the
  work of computing standings, and MUST skip that work when nothing could have changed.
- **FR-027**: System MUST provide a way to trigger a celebration on demand during development, because
  the natural trigger depends on a real session completing.

### Key Entities

- **Recorded standings**: What the app last told a given player about their position on each watched
  board. Holds, per board, either a place or the fact that they were not placed — a distinction that
  matters, because "not placed before" is news and "not watched before" is not.
- **Achievement**: A single thing worth celebrating, identified during an evaluation. Carries which
  board, what kind of achievement, the new standing and the standing it replaced.
- **Uncollected celebration**: The record that a player has been told about an achievement but has not
  yet seen their row on the board in question. Consumed the first time they arrive there.
- **Watched board**: One of the leaderboards this feature evaluates — the Individual board, the
  Partners board, and each Cheers category.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero celebrations are shown for a standing the player already held. Across a full season
  of recorded sessions replayed through the feature, no player is congratulated twice for the same
  achievement.
- **SC-002**: On the first run after release, no player receives a celebration, however high they
  currently stand.
- **SC-003**: Exactly one celebration appears per evaluation, no matter how many achievements were
  earned at once.
- **SC-004**: A player can reach the board their achievement was earned on in a single tap from the
  celebration.
- **SC-005**: A player can identify their own row on that board without reading through it.
- **SC-006**: No celebration requires the player to dismiss it, and no celebration prevents them from
  continuing what they were doing.
- **SC-007**: On an app launch where no session has completed since the last evaluation, the feature
  performs no standings computation.
- **SC-008**: Every celebration is readable by a player who has requested reduced motion, conveying
  the same achievement, board and placing.
- **SC-009**: Across a typical fourteen-player session, the number of players receiving a celebration
  is a minority of the roster — the celebration marks a notable result rather than routine
  attendance.

## Assumptions

- **A tie is a placing.** Two players sharing second place have both placed second; neither is treated
  as having missed out.
- **Card wording** follows the prototypes: a board takes "on" ("2nd on Individual") and a cheer
  category takes "in" ("3rd in Good Sport").
- **A multi-achievement card takes the border of the best placing it contains**, matching the offer,
  which names that same placing.
- **Partner naming** reuses the app's existing display-name handling, including how it distinguishes
  two players with the same nickname, so a Partners celebration reads correctly for a partner with no
  nickname set.
- **Evaluation happens when the app starts and when it returns to the foreground.** A session
  finalised while a player is actively using the app is announced the next time one of those occurs,
  not mid-interaction.
- **The existing leaderboard definitions are authoritative.** This feature reads the same standings
  the leaderboard screen shows, rather than defining its own, so the two can never disagree about a
  player's place.
- **Recorded standings live on the player's device.** A player using a second device may miss a
  celebration they already received on the first; this is accepted rather than solved with
  server-side state.
- **"Improving for three or more consecutive sessions" requires history the other achievements do
  not** — several past standings per board rather than one. This is a larger storage change and is
  costed separately from the other four.

## Clarifications

Both were put to the user during `/speckit-specify` and were unanswered when planning began. They are
resolved here with the reasoning, so they can be overturned deliberately rather than by accident.

- **Sweep expiry — an uncollected celebration lapses when the next session completes.** Waiting
  indefinitely risks a shimmer arriving weeks after the news that prompted it, and risks a stale sweep
  still being owed when a newer one is earned. Tying expiry to the session cadence keeps the sweep
  always about the most recent result, and needs no tunable duration. The cost is that a player who
  does not open the leaderboard between sessions never collects it — acceptable, because the card and
  the offer already reached them.
- **Streak achievement deferred out of the first release.** "Improving for three or more consecutive
  sessions" is the only one of the five that needs several past standings per board rather than one,
  and a player on a climb almost always sets a personal best in the same move, so it is also the least
  distinct. The first release ships the other four; the recorded-standings shape leaves room to add it
  without re-migrating.
