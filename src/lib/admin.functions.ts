// Client-facing admin status check. The actual allow-list lives server-side in
// `src/lib/admin.ts` (reads `process.env.ADMIN_EMAILS`) so it's never inlined
// into the browser bundle. Components call this fn instead of importing the
// list directly.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "@/lib/admin";

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as { email?: string } | undefined;
    return { isAdmin: isAdminEmail(claims?.email) };
  });