import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
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
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: item?.price?.product,
      price_id: pickPriceId(item),
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