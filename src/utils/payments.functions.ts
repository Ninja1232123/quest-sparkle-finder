import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      // SECURITY: never overwrite an existing customer's userId metadata.
      // If an attacker passes a victim's email with their own userId, we
      // would otherwise reassign the victim's Stripe customer to them.
      const existingUserId = customer.metadata?.userId;
      if (options.userId && existingUserId && existingUserId !== options.userId) {
        throw new Error("Email already linked to a different account");
      }
      if (options.userId && !existingUserId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnPath?: string }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.returnPath && !/^\/[A-Za-z0-9/_\-?=&{}.]*$/.test(data.returnPath)) {
      throw new Error("Invalid returnPath");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    // SECURITY: derive identity from the verified JWT, never trust client input.
    const userId = context.userId;
    const claims = context.claims as { email?: string } | undefined;
    const customerEmail = typeof claims?.email === "string" ? claims.email : undefined;

    // SECURITY: derive Stripe environment server-side. NODE_ENV is "production"
    // for the published worker; dev / preview uses sandbox.
    const environment: StripeEnv =
      process.env.NODE_ENV === "production" && process.env.STRIPE_LIVE_API_KEY
        ? "live"
        : "sandbox";

    // SECURITY: build returnUrl from the request's own origin so the client
    // can't redirect users off-site after checkout.
    const req = getRequest();
    const origin = req?.headers.get("origin") ?? req?.headers.get("referer");
    if (!origin) throw new Error("Missing request origin");
    const originUrl = new URL(origin);
    const returnUrl = `${originUrl.origin}${data.returnPath ?? "/checkout/return"}?session_id={CHECKOUT_SESSION_ID}`;

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: customerEmail,
      userId,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      // Stripe-managed full compliance (tax, fraud, disputes, support).
      // Not yet in SDK types for 2026-03-25.dahlia — cast through.
      ...({ managed_payments: { enabled: true } } as Record<string, unknown>),
      customer: customerId,
      metadata: { userId },
      ...(isRecurring && { subscription_data: { metadata: { userId } } }),
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    return session.client_secret;
  });
