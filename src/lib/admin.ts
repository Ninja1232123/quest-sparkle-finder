// Admin allow-list — SERVER-ONLY data source.
//
// Reads `process.env.ADMIN_EMAILS` (comma-separated, case-insensitive). This is
// deliberately NOT a `VITE_`-prefixed var so the list is never inlined into the
// client bundle — exposing it there hands an attacker a curated phishing list
// of every account with elevated privilege.
//
// On the client, `process.env.ADMIN_EMAILS` is undefined and `isAdminEmail`
// always returns false. Client code that needs "is current user admin?" should
// call the `getIsAdmin` server function instead of importing this helper.
const RAW =
  (typeof process !== "undefined" ? process.env?.ADMIN_EMAILS : undefined) ?? "";

const ADMIN_EMAILS = new Set(
  RAW.split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
