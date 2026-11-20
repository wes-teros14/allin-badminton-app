# Scheduler script — setup on a new PC or account

`schedule.ts` runs the app's match engine against a session and can lock the result in, so a schedule
can be made by asking Claude Code. Usage is in the header of `schedule.ts`; Claude's rules for it are in
the repo's `CLAUDE.md` ("Scheduling by prompt").

## What travels with the repo

- The script, the engine, the shared settings (`src/lib/generatorSettings.ts`) and the instructions
  Claude reads (`CLAUDE.md`, `project_memory.md`). Any Claude Code session opened in this repo, on any
  account, picks them up.

## What does not, and must be set up once per machine

1. `git clone`, then `npm install` in `badminton-v2/`.
2. Create `badminton-v2/.env.schedule` (gitignored by `.env.*`; Claude never reads it):

   ```
   NEON_DEV_URL=postgresql://...@ep-blue-recipe-aodxyifb...
   NEON_PROD_URL=postgresql://...@ep-small-river-aox8dd9u...
   ```

   Neon console → project `lucky-heart-02739020` → **Connect** → pick the branch (`dev` / `production`)
   → copy the connection string. The script refuses a string that points at the wrong branch.
3. Check it: `npm run schedule -- sessions` (dev) and `npm run schedule -- sessions --prod`.

The Neon account used must be a member of the project (Neon console → Settings → Members), otherwise
the Connect dialog is not available to it.

## Not portable

- Drafts live in `temporary_files/schedule-drafts/` on the machine that made them. Generate and save
  on the same machine; on another one, generate again.
- The connection strings carry the database owner's password: full read/write on the live database.
  Never paste them into chat, a commit or a shared doc. If one leaks, reset the password in the Neon
  console (Roles) and update `.env.schedule` everywhere.
