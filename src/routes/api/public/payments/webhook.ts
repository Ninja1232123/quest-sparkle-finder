import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";
import { PRO_MONTHLY_CREDITS } from "@/lib/juri-credits";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    // Subscriptions live on the CLOUD auth project (alongside auth + RLS), NOT
    // the local read-only data backend. So the webhook must use the cloud URL +
    // a service-role/secret key (it has no user session, so it bypasses RLS for
    // the upsert). Earlier this used SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY,
    // which point at the LOCAL backend — writes landed in the wrong database and
    // Pro never activated. SUPABASE_AUTH_SERVICE_ROLE_KEY is the dedicated var;
    // the Vercel↔Supabase Marketplace integration exposes the same project's key
    // as SUPABASE_SECRET_KEY, accepted as a fallback.
    const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
    const key =
      process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "Subscription webhook needs cloud Supabase creds: set SUPABASE_AUTH_URL and SUPABASE_AUTH_SERVICE_ROLE_KEY (or the Supabase integration's SUPABASE_SECRET_KEY).",
      );
    }
    _supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

function pickPriceId(item: any): string | undefined {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id
  );
}

async function upsertSubscription(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("subscription has no userId metadata", sub.id);
    return;
  }
  const item = sub.items?.data?.[0];
  const priceId = pickPriceId(item);
  if (!priceId) {
    console.error("subscription has no price", sub.id);
    return;
  }
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: item?.price?.product,
      price_id: priceId,
      status: sub.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function markCanceled(sub: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: sub.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}

// ── Juri credits ────────────────────────────────────────────────────────────
// One-time credit-pack purchase → grant top-up credits. Idempotent: the
// purchase row's unique index on stripe_payment_intent stops a double grant
// if Stripe redelivers the event.
async function grantCreditPurchase(session: any, env: StripeEnv) {
  const userId = session.metadata?.userId;
  const credits = parseInt(session.metadata?.credits ?? "0", 10);
  const priceCents = parseInt(session.metadata?.price_cents ?? "0", 10);
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  if (!userId || !credits) {
    console.error("juri credit purchase missing userId/credits", session.id);
    return;
  }
  const sb: any = getSupabase();
  const { error: insErr } = await sb.from("juri_credit_purchases").insert({
    user_id: userId,
    amount: credits,
    price_cents: priceCents,
    stripe_payment_intent: pi,
    environment: env,
  });
  if (insErr) {
    // 23505 = unique_violation → this payment was already processed. Don't grant again.
    if (insErr.code === "23505") return;
    console.error("juri purchase insert failed; skipping grant:", insErr);
    return;
  }
  await sb.rpc("add_topup_credits", { p_user_id: userId, p_amount: credits });
}

// Pro renewal (and the initial subscription invoice) → reset the monthly Juri
// allowance. Idempotent per (user, billing period) via set_pro_monthly_credits.
async function grantProMonthly(invoice: any, env: StripeEnv) {
  const reason = invoice.billing_reason;
  if (reason && !["subscription_create", "subscription_cycle"].includes(reason)) return;

  const line = invoice.lines?.data?.[0];
  const periodStart = line?.period?.start ?? invoice.period_start ?? invoice.created;
  const periodKey = String(periodStart);

  const sb: any = getSupabase();
  let userId: string | null = null;
  const subId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (subId) {
    const { data } = await sb
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  // Fallback: the subscription row may not exist yet on the very first invoice —
  // read userId off the Stripe customer's metadata.
  if (!userId && invoice.customer) {
    try {
      const stripe = createStripeClient(env);
      const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id;
      const cust = await stripe.customers.retrieve(custId);
      if (cust && !(cust as any).deleted) userId = (cust as any).metadata?.userId ?? null;
    } catch (e) {
      console.error("invoice.paid: customer fetch failed", e);
    }
  }
  if (!userId) {
    console.error("invoice.paid: could not resolve userId", invoice.id);
    return;
  }
  await sb.rpc("set_pro_monthly_credits", {
    p_user_id: userId,
    p_period_key: periodKey,
    p_amount: PRO_MONTHLY_CREDITS,
  });
}

async function handle(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await markCanceled(event.data.object, env);
      break;
    case "checkout.session.completed": {
      const s = event.data.object as any;
      if (s.mode === "payment" && s.metadata?.kind === "juri_credits") {
        await grantCreditPurchase(s, env);
      }
      break;
    }
    case "invoice.paid":
      await grantProMonthly(event.data.object, env);
      break;
    default:
      console.log("Unhandled stripe event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("webhook called without valid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});