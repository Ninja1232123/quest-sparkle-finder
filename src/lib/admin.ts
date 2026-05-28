// Admin allow-list (env-driven). Admins are treated as full Pro — see
// use-subscription.tsx, which ORs isAdmin into isPro so every Pro gate
// (search quota, compare, etc.) unlocks for them.
//
// VITE_ADMIN_EMAILS is a comma-separated list, matched case-insensitively
// against the signed-in user's email. It's client-inlined like the other
// VITE_ vars, but that's harmless: it only flips the soft, client-side
// Pro/quota gates — there's no server-side privilege behind it to leak.
const RAW = import.meta.env.VITE_ADMIN_EMAILS ?? "";

const ADMIN_EMAILS = new Set(
  RAW.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
