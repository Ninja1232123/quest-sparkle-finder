/**
 * Juri credit economics — the single source of truth.
 *
 * Everything about how Juri is priced lives here so the business model is one
 * edit, not a scavenger hunt. Used by the client (pack display in the buy
 * screen) and the server (checkout + webhook grants).
 *
 * The math that anchors these numbers (see also the explanation in chat):
 *   Juri runs on Sonnet 4.6 with a CAPPED payload (≤5 docs × 3k chars in,
 *   ≤1.2k tokens out). That bounds the cost of one question to:
 *     typical    ~1.4¢   (≈2,200 in / ~500 out)
 *     worst case ~3.2¢   (≈4,500 in / 1,200 out)
 *   So 1 credit = 1 question, and a credit is priced ABOVE worst-case cost.
 *   Credits are pre-paid, so Juri can never run a deficit.
 */

/** Juri is a Pro-only convenience tool. No active Pro subscription → locked. */
export const JURI_REQUIRES_PRO = true;

/**
 * One-time "taste" credits a signed-in NON-Pro user may spend on Juri before
 * the Pro wall. 0 = hard wall (you-must-be-Pro, per the product call). Bump to
 * e.g. 3 to let free users try Juri 3× as a conversion hook (~9¢ to win a $5/mo
 * subscriber — cheap CAC) without changing any other code.
 */
export const JURI_FREE_TASTE = 0;

/** Credits granted to a brand-new account on signup (a Pro welcome bonus). */
export const JURI_STARTER_CREDITS = 3;

/**
 * Credits granted at the start of each Pro billing cycle. Reset, not rollover —
 * the webhook overwrites to this floor on each `invoice.paid` so unused credits
 * don't stack month over month (top-up packs DO persist; see below).
 * Worst-case cost to us: 50 × 3.2¢ ≈ $1.50 of the $5 sub.
 */
export const PRO_MONTHLY_CREDITS = 50;

export type CreditPack = {
  /** Stripe Price lookup_key — create these prices in Stripe with this key. */
  lookupKey: string;
  credits: number;
  priceCents: number;
  /** Marketing label for the buy screen. */
  label: string;
  /** Optional badge, e.g. "Best value". */
  badge?: string;
};

/**
 * Top-up packs. One-time payments (mode=payment). Credits never expire.
 * Per-credit price stays at ~2× our worst-case cost so every pack is
 * profitable even after Stripe's ~2.9% + 30¢.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { lookupKey: "juri_pack_100", credits: 100, priceCents: 500, label: "Starter" },
  { lookupKey: "juri_pack_350", credits: 350, priceCents: 1500, label: "Researcher", badge: "Popular" },
  { lookupKey: "juri_pack_1000", credits: 1000, priceCents: 4000, label: "Counsel", badge: "Best value" },
];

/** Look up a pack by its Stripe lookup_key (used by the webhook to grant). */
export function packByLookupKey(key: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.lookupKey === key);
}

/** Cents per credit, for display ("4.3¢ / question"). */
export function centsPerCredit(pack: CreditPack): number {
  return pack.priceCents / pack.credits;
}
