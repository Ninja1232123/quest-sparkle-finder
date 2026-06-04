// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Deploy target: Vercel (not Cloudflare).
// - cloudflare: false  -> disables the Lovable wrapper's build-only Cloudflare plugin.
// - nitro()            -> emits a Vercel-compatible build (.vercel/output) when VERCEL is set,
//                         and a Node server output otherwise. This is the path Vercel's
//                         TanStack Start docs recommend.
export default defineConfig({
  cloudflare: false,
  // Nitro's Vercel preset uses the Build Output API, so vercel.json's `functions`
  // block is ignored — maxDuration must be set here to be written into the
  // function's .vc-config.json. Juri's deep dives chase long chains of
  // definitions (many model rounds + corpus lookups), so give them headroom:
  // 300s is the Vercel Pro ceiling. Applies to all routes; it's only a cap, and
  // you're billed for actual execution, so fast routes are unaffected.
  plugins: [nitro({ vercel: { functions: { maxDuration: 300 } } })],
});
