// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Baseline HTTP security headers, applied to every route by Nitro's routeRules.
// Nitro's Vercel preset writes these into the Build Output API config, so a
// top-level vercel.json `headers` block would be ignored — this is the correct
// place for them on this deploy target.
//
// CSP notes:
// - 'unsafe-inline' on script/style is required because TanStack Start (SSR)
//   injects inline hydration scripts and the styling layer emits inline styles.
//   Removing it would break hydration; tightening to nonces is a later step.
// - connect-src allows https:/wss: so the Supabase client (REST + realtime),
//   Stripe, and the AI gateway can reach their APIs without enumerating hosts.
// - Stripe Elements/Checkout run in iframes from js.stripe.com / hooks.stripe.com.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};

// Deploy target: Vercel (not Cloudflare).
// - cloudflare: false  -> disables the Lovable wrapper's build-only Cloudflare plugin.
// - nitro()            -> emits a Vercel-compatible build (.vercel/output) when VERCEL is set,
//                         and a Node server output otherwise. This is the path Vercel's
//                         TanStack Start docs recommend.
export default defineConfig({
  // Nitro's Vercel preset uses the Build Output API, so vercel.json's `functions`
  // block is ignored — maxDuration must be set here to be written into the
  // function's .vc-config.json. Juri's deep dives chase long chains of
  // definitions (many model rounds + corpus lookups), so give them headroom:
  // 300s is the Vercel Pro ceiling. Applies to all routes; it's only a cap, and
  // you're billed for actual execution, so fast routes are unaffected.
  plugins: [
    nitro({
      vercel: { functions: { maxDuration: 300 } },
      // Apply the baseline security headers to all routes. API routes layer
      // their own Cache-Control/CORS on top via the jsonResponse helper.
      routeRules: {
        "/**": { headers: SECURITY_HEADERS },
      },
    }),
  ],
});
