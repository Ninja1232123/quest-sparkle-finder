import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { CmdPalette } from "@/components/marginalia/CmdPalette";
import { Juri } from "@/components/marginalia/Juri";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { MobileExperienceNotice } from "@/components/marginalia/MobileExperienceNotice";
import { TosGate } from "@/components/marginalia/TosGate";

const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "MrUA-5AhYOA7ltMplk_EcKzRwYSJaa0-J_mhiXnsqI4" },
      { title: "Self-Law · Read the law for yourself" },
      { name: "description", content: "A legal research tool designed for pro se litigants. All of the law in one place." },
      { property: "og:title", content: "Self-Law · Read the law for yourself" },
      { property: "og:description", content: "A legal research tool designed for pro se litigants. All of the law in one place." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Self-Law" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Self-Law · Read the law for yourself" },
      { name: "twitter:description", content: "A legal research tool designed for pro se litigants. All of the law in one place." },
      { property: "og:image", content: "https://self-law.org/og-image.png" },
      { name: "twitter:image", content: "https://self-law.org/og-image.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Engraved Legal Codex direction — Cinzel for titles, Special Elite for
      // typewriter eyebrows. Body/reading text uses --font-read (Inter) for
      // sharp legibility; Playfair Display was dropped (it read thin/choppy at
      // body sizes and is no longer referenced).
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Special+Elite&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              "@id": "https://self-law.org",
              "name": "Self-Law",
              "url": "https://self-law.org",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "All",
              "browserRequirements": "Requires HTML5 compatible browser.",
              "description": "A 50-state legal research and document workspace for Pro Se Litigants. Features side-by-side legal source comparison, marginalia case notes, and a filing template creator.",
              "featureList": [
                "50-State Primary Law Search",
                "Local Browser Marginalia Notes",
                "Legal Filing Template Creator",
                "Side-by-Side Source Comparison"
              ],
          // This tells crawlers that the app handles data locally/client-side
              "storageRequirements": "Local browser storage (Privacy-focused, client-side case files)"
            },
            {
              "@type": "WebSite",
              "@id": "https://self-law.org",
              "name": "Self-Law",
              "url": "https://self-law.org",
              "description": "Primary legal research platform and workspace.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://self-law.org/search?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            }
          ]
        })
      }
    ]
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('marginalia-theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const router = useRouter();
  useEffect(() => {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === seq[i]) {
        i++;
        if (i === seq.length) { i = 0; router.navigate({ to: "/chambers" }); }
      } else {
        i = k === seq[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    // Tiny console wink for the curious
     
    console.log("%c⚖  marginalia ", "font-family:serif;font-size:14px;background:#1a1a1a;color:#e8d8b0;padding:2px 6px;border-radius:3px", "— try the konami code");
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PaymentTestModeBanner />
        <MobileExperienceNotice />
        <AuthGate />
        <div className="app-shell">
          <main id="main">
            <Outlet />
          </main>
        </div>
        <CmdPalette />
        <Juri />
        <TosGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Public, crawlable, or auth-flow routes. Everything else requires sign-in.
// The law-reading surface (the reader, search, compare, and every codebook
// landing) is public so Google can index it — crawlability is the moat. Premium
// tooling (the Desk, casefiles, AI, export) gates itself at the component level
// via useAuth, so the page can render publicly while the actions prompt sign-in.
// Still gated: /account, /cases, /checkout return — user-specific or in robots
// Disallow.
const PUBLIC_PREFIXES = [
  "/auth",
  "/about",
  "/whitepaper",
  "/features",
  "/how-it-works",
  "/chambers",
  "/subscribe",
  "/checkout",
  "/sitemap.xml",
  "/api/",
  "/lovable/",
  // reading surface
  "/code",
  "/case",
  "/states",
  "/outcomes",
  "/record",
  "/search",
  "/compare",
  "/builder",
  "/library",
  "/topic",
  "/forum",
  // codebook landings (slugs from src/lib/codebooks.ts)
  "/const",
  "/usc",
  "/cfr",
  "/register",
  "/bills",
  "/laws",
  "/statutes",
  "/presidential",
  "/scotus",
  "/agency",
  "/ucc",
  "/model", // legacy → 301s to /ucc; keep public so crawlers reach the redirect
];

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = router.state.location.pathname;
  useEffect(() => {
    if (loading || user) return;
    if (path === "/") return; // landing stays public
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return;
    router.navigate({ to: "/auth", search: { mode: "signup", redirect: path } });
  }, [user, loading, path, router]);
  return null;
}
