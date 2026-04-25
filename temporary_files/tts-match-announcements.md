# Text-to-Speech Match Announcements

## Status: Parked (2026-03-30)

## Idea
When a match finishes and the next match auto-advances, announce the next players' names via text-to-speech.

## Technical Approach
- Use browser's built-in `SpeechSynthesis` API — no npm packages needed
- Hook into the match auto-advance flow in `CourtCard.tsx` (lines 59-74)
- Player names already resolved via `useCourtState` → profiles lookup

## Key Decisions (TBD)
1. **Which view triggers TTS?** — Recommendation: LiveBoardView only (shared venue device)
2. **Announcement format?** — e.g. "Game 5, Court 1: Mark and Wes versus John and Bob"
3. **UI toggle?** — Mute/unmute button on LiveBoardView

## Background/Minimized Browser Limitations
- **iOS Safari:** TTS blocked when app is backgrounded or screen locked
- **Android Chrome:** TTS unreliable in background (tab throttling)
- **Foreground:** Works reliably on both platforms
- **Recommendation:** Run TTS on LiveBoard device only (always foreground, connected to speaker)

## Files Involved
- `src/views/LiveBoardView.tsx` — where to add TTS trigger
- `src/hooks/useCourtState.ts` — provides next match player names
- `src/components/CourtCard.tsx` — match completion + auto-advance logic

## Notes
- No audio/sound features exist in the app currently
- All 4 player names per match are already available in court state
- Consider a `useEffect` watching `court.current` changes to trigger announcement
