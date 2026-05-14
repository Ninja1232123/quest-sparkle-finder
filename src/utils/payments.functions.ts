import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function pickEnvironment(): StripeEnv {
  return process.env.NODE_ENV === "production" && process.env.STRIPE_LIVE_API_KEY
    ? "live"
    : "sandbox";
}

function originFromRequest(): string {
  const req = getRequest();
  const origin = req?.headers.get("origin") ?? req?.headers.get("referer");
  if (!origin) throw new Error("Missing request origin");
  return new URL(origin).origin;
}

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
      customer: customerId,
      metadata: { userId },
      ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      // Stripe-managed full compliance: tax + fraud + disputes + support.
      // Not yet in SDK types for 2026-03-25.dahlia — cast through.
      ...({ managed_payments: { enabled: true } } as Record<string, unknown>),
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    return session.client_secret;
  });

// Pay-what-you-want donation. No userId required (anonymous OK).
export const createDonationCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { amountInCents: number; returnPath?: string }) => {
    if (!Number.isFinite(data.amountInCents) || data.amountInCents < 100) {
      throw new Error("Donation must be at least $1");
    }
    if (data.amountInCents > 100000) {
      throw new Error("Donation too large; contact us directly");
    }
    if (data.returnPath && !/^\/[A-Za-z0-9/_\-?=&{}.]*$/.test(data.returnPath)) {
      throw new Error("Invalid returnPath");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const environment = pickEnvironment();
    const origin = originFromRequest();
    const returnUrl = `${origin}${data.returnPath ?? "/checkout/return"}?session_id={CHECKOUT_SESSION_ID}`;
    const stripe = createStripeClient(environment);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Marginalia Donation" },
            unit_amount: data.amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...({ managed_payments: { enabled: true } } as Record<string, unknown>),
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    return session.client_secret;
  });

// Returns a Stripe Customer Portal URL so a logged-in user can manage their
// subscription (cancel, update card, view invoices).
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnPath?: string }) => {
    if (data.returnPath && !/^\/[A-Za-z0-9/_\-?=&{}.]*$/.test(data.returnPath)) {
      throw new Error("Invalid returnPath");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const environment = pickEnvironment();

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) throw new Error("No subscription found");

    const origin = originFromRequest();
    const stripe = createStripeClient(environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}${data.returnPath ?? "/account"}`,
    });
    return portal.url;
  });
