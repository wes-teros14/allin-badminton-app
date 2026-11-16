import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { neonDataBaseUrl, routeDataCalls } from '@/lib/dataRouter'
import { singleObjectFetch } from '@/lib/singleObjectFetch'

const authClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { flowType: 'pkce' } }
)

const NEON_DATA_API_URL: string | undefined = import.meta.env.VITE_NEON_DATA_API_URL
const NEON_ANON_JWT: string | undefined = import.meta.env.VITE_NEON_ANON_JWT

/**
 * The app's one client. Sign-in and file storage always use Supabase. Data
 * (from/rpc) goes to Neon's Data API when VITE_NEON_DATA_API_URL and
 * VITE_NEON_ANON_JWT are set (src/lib/dataRouter.ts), otherwise to Supabase.
 *
 * On Neon, each request carries the player's Supabase sign-in token, or the
 * long-lived anonymous token when signed out (Neon rejects requests with no
 * token). `singleObjectFetch` restores PostgREST's `.single()` contract, which
 * Neon's Data API does not keep (G3).
 */
export const supabase =
  NEON_DATA_API_URL && NEON_ANON_JWT
    ? routeDataCalls(
        authClient,
        createClient<Database>(neonDataBaseUrl(NEON_DATA_API_URL), NEON_ANON_JWT, {
          accessToken: async () => (await authClient.auth.getSession()).data.session?.access_token ?? NEON_ANON_JWT,
          global: { fetch: singleObjectFetch() },
        }),
      )
    : authClient
