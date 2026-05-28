import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

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