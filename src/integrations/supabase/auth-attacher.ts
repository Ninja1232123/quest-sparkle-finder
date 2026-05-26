// Edited for the cloud-auth split: the session lives in the CLOUD client
// (supabaseAuth), not the local data client. Attach the cloud session's bearer
// token to serverFn RPCs so server-side requireSupabaseAuth can validate it.
import { createMiddleware } from '@tanstack/react-start'
import { supabaseAuth } from './auth-client'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabaseAuth.auth.getSession()
    const token = data.session?.access_token
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
