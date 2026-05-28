import Stripe from 'stripe';
import { Buffer } from 'node:buffer';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

export function getStripeApiKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SANDBOX_API_KEY')
    : getEnv('STRIPE_LIVE_API_KEY');
}

// Direct to api.stripe.com. The earlier version proxied through
// connector-gateway.lovable.dev/stripe (leftover Lovable scaffold + a
// LOVABLE_API_KEY header). Since this app no longer runs on Lovable, the
// proxy was a vendor dependency in the live payment path with nothing to
// gain — removed 2026-05-27 along with the LOVABLE_API_KEY env dep.
export function createStripeClient(env: StripeEnv): Stripe {
  return new Stripe(getStripeApiKey(env), {
    apiVersion: '2026-03-25.dahlia',
  });
}

// Verifies a Stripe webhook signature without depending on the SDK.
export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const secret =
    env === 'sandbox'
      ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
      : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!signature || !body) throw new Error('Missing signature or body');

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k === 't') timestamp = v;
    if (k === 'v1') v1Signatures.push(v);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error('Invalid signature format');

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error('Webhook timestamp too old');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString('hex');

  if (!v1Signatures.includes(expected)) throw new Error('Invalid webhook signature');

  return JSON.parse(body);
}
