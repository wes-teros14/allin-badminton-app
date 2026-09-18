# Leaderboard celebrations — feature brief

Input for `/speckit-specify`. Deliberately natural language and free of implementation: it states
what the feature must do and which decisions are already settled, and leaves the how to the spec.

Every decision below was made against working prototypes in `temporary_files/`, not in the abstract.

---

## Feature description

When a player's standing on a leaderboard improves in a way that is new to them, the app celebrates
it once. Reaching the top 3 is the headline case, but it is not the only one — see *Players who did
not medal* below.

### The sequence

The celebration has three beats, in order.

**1 — A card appears, in place.** It springs into the middle of whatever screen the player is
currently on, with a confetti burst behind it, and it leaves on its own. The player is never required
to dismiss it. A celebration that must be dismissed has become a dialog.

The card names what was won: the medal, the placing as an ordinal, and the board with a short detail.
"2nd place!" over "Individual · most wins". For the partnership board it names the partner —
"Partners · with Alex Tan". For a cheer category it gives the share — "Good Sport · 36% of your
cheers".

**2 — A toast follows once the card has cleared.** It slides up, names the placing, and offers to
show that exact board. Tapping it goes there. Ignoring it costs nothing: no tap is stolen, nothing is
blocked, and the app never navigates anywhere the player did not ask to go.

The toast says "You're 2nd **on** Individual" and "You're 2nd **on** Partners, with Alex Tan", but
"You're 3rd **in** Good Sport" — a board takes *on*, a cheer category takes *in*.

**3 — The player's row sweeps on arrival.** When they reach that leaderboard, their own row lifts
slightly and a gold shimmer crosses it twice, so they find themselves without scanning the list.

### When several boards move at once

A completed session can move a player onto more than one of the eight boards. That must produce a
**single card, never a queue of them**: a row of medals across the top, a heading counting them
("3 podiums!"), and one line per board underneath giving the medal, the board and the placing. The
toast names the best one and admits the rest — "You're 1st on Partners, with Alex Tan — and 2 more" —
and tapping it goes to the best one's board.

Because that card carries more to read than a single-medal one, **it must stay on screen long enough
to be read**: about two seconds for one medal, plus a little over half a second for each additional
medal, capped at around five seconds. It still leaves on its own at every size.

This case may be common rather than rare. Six of the eight boards are cheer categories whose shares
all move together, so a player whose cheer mix shifts can cross several podiums in one session.

### When it fires

The trigger is **"newly theirs", never "currently theirs"**. A player who has held 2nd place since
August must never be congratulated for it again. Every decision is a comparison against the last
ranks that player was shown — never against the board on its own.

Three cases must stay silent:

- **The very first run** after the feature ships records the player's current ranks and celebrates
  nothing. Otherwise every existing podium holder is congratulated on launch day for a placing they
  have held for months.
- **A board that was not being watched** at the time of the previous snapshot. If a seventh cheer
  category is added later, everyone already inside its top 3 must not be congratulated for it.
- **Holding the same place.** 2nd last week and 2nd today is not news.

Improving *within* the podium does count. Moving from 3rd to 1st is the best news this can deliver.

### Boards in scope

Individual (most wins), Partners (pair win rate), and all six Cheers categories, each at top 3.

Awards is out of scope: it is single-holder with no 2nd or 3rd place, so there is no top 3 to detect.

### Players who did not medal

Reaching the top 3 is not the only thing worth celebrating, and a player who did not medal gets
**exactly the same celebration** — same card, same confetti, same time on screen. That is deliberate:
the celebration is for the achievement the player actually had, not a ranking of whose achievement
counted for more.

Two things change. The **icon** is the app's thumbs-up bunny rather than a medal. And the **border**
carries the rank: a podium card has a 3px edge in its own medal colour — gold for first, silver for
second, bronze for third, the same three the leaderboard's podium rows already use — while every
other card gets the ordinary 1px border. Nothing else differs.

Four things can earn a non-podium celebration:

- **Made the board** — their first ever appearance in the top 10 of that board.
- **Personal best placing** — they beat their own best-ever rank.
- **Sessions climbing** — three or more consecutive sessions of improvement.
- **Climbed places** — an improvement of three or more places.

These overlap heavily: going 9th to 6th is a personal best *and* a three-place climb *and* possibly a
streak. So exactly one celebration fires, chosen by this precedence, highest first:

1. Podium (top 3) — always wins
2. Made the board
3. Personal best placing
4. Sessions climbing
5. Climbed places

"Made the board" outranks "personal best" because it is always also a personal best; personal best
outranks a plain climb for the same reason.

The thresholds are not decoration. A podium is rare, but in a fourteen-player session half the field
moves up whenever the other half moves down — without a floor, "you climbed" would fire for most of
the roster every week and the celebration would become wallpaper within a month. Note also that
"climbed places" can be earned purely because the players above stopped attending, which is the
weakest claim of the four, and is why it sits last.

**"Sessions climbing" needs data the rest do not.** The other three compare against a single previous
snapshot; a streak needs the last several ranks per board. That is a larger storage change and should
be costed separately — it is not a free fourth option.

### Constraints

**Both routes to the leaderboard must arm the row sweep.** A player can arrive by tapping the toast,
or under their own steam later. Both must converge on the same "a sweep is owed" state. A prototype
of this feature had exactly this bug — tapping through navigated correctly but never swept, because
only the ignoring path recorded that a sweep was pending, so the main path silently did nothing.

**Reduced motion.** A player who has asked their device for reduced motion gets the card with no
spring, no particles and no sweep. They still get the news, just still. iOS exposes this setting to
the browser, so this is a real switch and not a formality.

**Cost.** Ranks can only change when a session completes. Celebrating in place means the app must
know the player's rank from anywhere, but computing the boards is expensive — the individual board
reads player stats, every profile, recent sessions and registrations, and the partnership board pages
through every completed match. The feature must therefore make a cheap check first (has any session
completed since this player's ranks were last recorded?) and compute the boards only when that check
says something could have moved. On a launch where nothing has completed, the feature must cost
effectively nothing.

**Storage.** A player's last known ranks are kept per player, so two accounts signed in on one phone
never inherit each other's celebration state.

**Testability.** There must be a way to trigger a celebration on demand during development, because
the natural trigger only fires after a real session completes — meaning nobody can see this working
until a session completes after it ships.

---

## Prototypes behind these decisions

- `temporary_files/podium-celebration-flow.html` — the three beats end to end, with board, placing
  and multi-board controls, and the ignore-the-toast path.
- `temporary_files/podium-celebration-multiple-medals.html` — four treatments of several medals at
  once, at 2, 3 and 5. The listing card was chosen.
- `temporary_files/leaderboard-podium-celebration-options.html` — the original four animation styles,
  including the row sweep.
- `temporary_files/non-podium-celebration-options.html` — the non-podium card: four candidate
  triggers, seven candidate icons, and a back-to-back comparison against a podium card.

The bunny artwork is `temporary_files/bunny-thumbsup.png` (192x261, RGBA, 52KB), chroma-keyed from the
supplied green-screen original, cropped, downscaled, and recoloured so the thumbs-up hand matches the
body: it shipped at grey 159 against a body of 175, and was shifted rather than flat-filled so the
line work kept its anti-aliasing. The full-resolution cut-out is kept beside it as
`bunny-thumbsup-full.png`.

## Already written, outside this spec

- `src/lib/podiumCelebration.ts` — the pure rule (previous ranks + current ranks → which boards are
  newly top 3), with 13 passing tests covering the three silences.
- `src/lib/leaderboardData.ts` — the board queries and ranking, lifted out of `LeaderboardView` so
  the celebration and the leaderboard share one definition of a rank rather than two that can drift.
  **Typechecks, but its full test run and lint were interrupted — treat as unverified.**

## Open questions for the spec to settle

- If the player never taps the toast, does the owed row sweep wait indefinitely for their next
  leaderboard visit, or expire?
- What the Partners card shows when the partner has no nickname set.
- Whether a tie ("joint 2nd") should read differently from an outright placing.
- **On the record, raised and overruled:** a Cheers placing is a share of a player's own cheers, so
  they can gain or lose a podium place there without doing anything differently — the share moves
  when someone above them is cheered in a different category. Full top 3 on Cheers was chosen anyway.
  If it proves noisy, the fallback is 1st place only.
