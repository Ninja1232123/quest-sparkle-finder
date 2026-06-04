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
 *   A simple answer is ~1 credit, but billing is METERED by depth (see below),
 *   not flat per-question — deeper research spends more. Each credit is priced
 *   ABOVE the model cost it represents, so every credit sold carries margin.
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

/**
 * Credits granted to a brand-new account on signup. Kept at 0: Juri is Pro-gated,
 * so signup credits would be unspendable anyway (and a free-account farming
 * vector if JURI_FREE_TASTE were ever raised). New Pro users get the full
 * PRO_MONTHLY_CREDITS the moment their first invoice clears, so there's no
 * welcome gap to fill. The signup trigger is dropped in cloud-juri-credits-v2.sql.
 */
export const JURI_STARTER_CREDITS = 0;

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

/** Cents per credit, for display ("4.3¢ / credit"). */
export function centsPerCredit(pack: CreditPack): number {
  return pack.priceCents / pack.credits;
}

// ===========================================================================
// METERED CREDITS — a credit is a unit of FUEL, not a flat per-question toll.
// An answer spends credits in proportion to the model cost it actually incurs,
// so Juri can read as deep as a question deserves. Credits = ceil(modelCost /
// CREDIT_COST_CENTS), clamped to the mode's ceiling. Because credits are sold
// at the pack rate (~5¢) over this ~3¢ cost basis, every answer carries margin.
// ===========================================================================

/** Model cost (cents) that one credit represents. Sold to users at the pack rate. */
export const CREDIT_COST_CENTS = 3;

/** Sonnet 4.6 price, dollars per 1M tokens — used to turn token usage into cost. */
export const MODEL_PRICE = { inPerM: 3, outPerM: 15, cacheReadPerM: 0.3, cacheWritePerM: 3.75 };

export type JuriMode = "quick" | "deep";

/**
 * Depth profiles. The user picks intent (Quick vs Deep dive); billing follows
 * the actual work. Deep traverses the citation graph to surface connections and
 * reads far more of the corpus, so it costs more credits — that's the point.
 */
export const JURI_MODES: Record<JuriMode, {
  label: string;
  blurb: string;
  maxRounds: number;       // agentic tool-use rounds before Juri must answer
  searchLimit: number;     // default hits per search_law call
  useGraph: boolean;       // expose the find_connections (citation graph) tool
  maxConnections: number;  // connections returned per find_connections call
  maxContextChars: number; // total section text Juri may read (bounds cost)
  maxTokens: number;       // answer length cap
  minCredits: number;      // balance required to start this mode
  maxCredits: number;      // hard per-answer credit ceiling (cost safety)
}> = {
  // maxCredits is a RUNAWAY BACKSTOP, not a price throttle. Billing is metered:
  // an answer costs ceil(modelCost / CREDIT_COST_CENTS), and credits sell above
  // that cost basis, so every credit carries margin. Capping LOW just made us
  // eat the cost of deep work we couldn't bill for — accurate beats cheap, so
  // the cap now sits well above realistic cost and only catches a true loop.
  quick: {
    label: "Quick",
    blurb: "Focused — follows the definitions an answer turns on.",
    maxRounds: 5, searchLimit: 8, useGraph: false, maxConnections: 0,
    maxContextChars: 24000, maxTokens: 1100, minCredits: 1, maxCredits: 15,
  },
  deep: {
    label: "Deep dive",
    blurb: "Chases the full chain of definitions, cross-references & authority.",
    maxRounds: 9, searchLimit: 12, useGraph: true, maxConnections: 18,
    maxContextChars: 70000, maxTokens: 2600, minCredits: 3, maxCredits: 60,
  },
};

/** Model cost in cents from an Anthropic usage object. */
export function usageToCents(u: {
  input_tokens?: number; output_tokens?: number;
  cache_read_input_tokens?: number; cache_creation_input_tokens?: number;
}): number {
  const inT = u.input_tokens ?? 0;
  const outT = u.output_tokens ?? 0;
  const cr = u.cache_read_input_tokens ?? 0;
  const cw = u.cache_creation_input_tokens ?? 0;
  const dollars =
    (inT / 1e6) * MODEL_PRICE.inPerM +
    (outT / 1e6) * MODEL_PRICE.outPerM +
    (cr / 1e6) * MODEL_PRICE.cacheReadPerM +
    (cw / 1e6) * MODEL_PRICE.cacheWritePerM;
  return dollars * 100;
}

/** Credits to charge for an answer: ceil(cost / credit) clamped to the mode ceiling. */
export function costToCredits(cents: number, mode: JuriMode): number {
  const raw = Math.max(1, Math.ceil(cents / CREDIT_COST_CENTS));
  return Math.min(raw, JURI_MODES[mode].maxCredits);
}
