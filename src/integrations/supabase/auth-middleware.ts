// Edited for the cloud-auth split: validate the bearer token against the CLOUD
// Supabase project (where login + RLS live), not the local read-only backend.
// Needs SUPABASE_AUTH_URL / SUPABASE_AUTH_PUBLISHABLE_KEY in the SERVER env
// (set on Vercel). The returned client carries the user's token, so any cloud
// table query it makes runs under that user's RLS.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL =
      process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL
    const SUPABASE_KEY =
      process.env.SUPABASE_AUTH_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Response(
        'Missing cloud auth env: set SUPABASE_AUTH_URL and SUPABASE_AUTH_PUBLISHABLE_KEY.',
        { status: 500 },
      )
    }

    const authHeader = getRequest()?.headers?.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Response('Unauthorized: no bearer token', { status: 401 })
    }
    const token = authHeader.slice('Bearer '.length)
    if (!token) throw new Response('Unauthorized: no token', { status: 401 })

    // User-scoped client against the cloud project (token → RLS on cloud tables).
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Validate the cloud-issued JWT against the cloud project.
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      throw new Response('Unauthorized: invalid token', { status: 401 })
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: { sub: data.user.id, email: data.user.email },
      },
    })
  },
)
