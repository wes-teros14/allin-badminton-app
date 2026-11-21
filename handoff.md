# Handoff — current snapshot

Updated: 2026-11-21 ~10:30 Manila. Overwrite this file on every update; it is never a running history.

## Done this session (2026-11-20 → 11-21)
- Photo Gallery planned with the owner (all choices in `tasks/todo.md` "Photo Gallery") and built on branch
  `095-photo-gallery` (off `dev`; **not committed, not pushed**).
- Navigation replaced: bottom tab bar with raised rabbit Home (`BottomTabBar.tsx`); `TopNavBar.tsx` removed.
- Neon **dev**: migration 092 applied, 23/23 rule checks pass, private `gallery` bucket + CORS, `gallery`
  Function deployed (`https://br-gentle-wildflower-ao7c6whw-gallery.compute.c-2.ap-southeast-1.aws.neon.tech/`).
- Verified on localhost (admin + player Raj): upload, caption, replace (old version cleaned), delete, viewer
  buttons per role, admin menu, Cheer later bar above tabs, 360 px both themes. `tsc -b`, 600 unit tests, build pass.
- Neon CLI 9.9.0 installed + signed in on this PC. `run-dev.mjs` can read `NEON_DEV_URL` from `.env.schedule`.

## Current state
- Production untouched (no SQL, no bucket, no Function, no Vercel var). Dev test data cleaned.

## Next steps
1. Owner: review on localhost, then commit the branch (ask first).
2. Production, only with owner OK: run 092 SQL on Neon `production`; `neon bucket create gallery --branch
   production`; `gallery-bucket-setup.mjs` against production; `neon functions deploy gallery --branch
   production` with prod SUPABASE_URL + prod Data API URL; add `VITE_NEON_GALLERY_URL` to Vercel Production.
3. Push `dev`, merge to `main` (ask first). Add egress to the Phase 4 daily usage check.

## Open questions
- iPhone Safari WebP encoding untested on a real phone (falls back to JPEG by design).
- Carried over: kiosk insert rule; offline-backup phone check; Broadcast/share on phones; Nov 1 session not
  closed; prod `service_role` key not rotated; old Neon test branches cleanup.
