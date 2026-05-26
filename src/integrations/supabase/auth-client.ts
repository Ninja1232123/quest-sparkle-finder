import { createClient } from "@supabase/supabase-js";

// Auth-only Supabase client.
//
// The self-hosted local backend has no auth server (Caddy stubs /auth/v1 → 501),
// so login/signup run against a CLOUD Supabase project instead. Data still goes
// through the local client in ./client; this client is used ONLY for auth.*
// (sign in/up, session, password reset). The two clients use separate storage
// keys, and the user's cloud-issued JWT is never sent to the local PostgREST —
// public data reads stay on the local anon key.

function createAuthClient() {
  const url = import.meta.env.VITE_SUPABASE_AUTH_URL || process.env.SUPABASE_AUTH_URL;
  const key =
    import.meta.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing auth env: set VITE_SUPABASE_AUTH_URL and VITE_SUPABASE_AUTH_PUBLISHABLE_KEY (the cloud Supabase project used for login).",
    );
  }
  return createClient(url, key, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      storageKey: "marg-auth", // distinct from the data client's key
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof createAuthClient> | undefined;

// Lazy proxy so the client is only built when first touched (client-side),
// never during SSR render where the env may not be inlined yet.
export const supabaseAuth = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createAuthClient();
    return Reflect.get(_client, prop, receiver);
  },
});
