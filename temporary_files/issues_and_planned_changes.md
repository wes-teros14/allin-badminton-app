# issues and changes
## issues

- **Prod/dev share same Supabase project** — test sessions pollute prod player stats. Workaround: run `SELECT reverse_session_stats('session-uuid')` in SQL Editor after each test session to roll back stats. Long-term fix: create a second free Supabase project (`allin-badminton-dev`) and point dev Vercel environment variables to it.

## changes

### Change RegisterView.tsx session full notice from "Registration is full. Contact the admin." to "Sorry all slots have been taken 💔"

### RegisterView.tsx - Add rabbit image on the success registration and session full view.

### when editing the locked schedule its confusing how is team 1 and team 2

