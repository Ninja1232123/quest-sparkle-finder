import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Capybara } from "@/components/marginalia/Capybara";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

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
      { title: "Marginalia · Read the law for yourself" },
      { name: "description", content: "A pro se reading desk: federal codebooks indexed together, with cross-references and plain-English summaries side-by-side." },
      { property: "og:title", content: "Marginalia · Read the law for yourself" },
      { property: "og:description", content: "A pro se reading desk: federal codebooks indexed together, with cross-references and plain-English summaries side-by-side." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Marginalia" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Marginalia · Read the law for yourself" },
      { name: "twitter:description", content: "A pro se reading desk: federal codebooks indexed together, with cross-references and plain-English summaries side-by-side." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3acaabdc-213e-4ba1-8c1a-370626dc5be4/id-preview-9ef085ee--03d3f7f3-0812-4f07-974e-69a3123fcc08.lovable.app-1778774951725.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3acaabdc-213e-4ba1-8c1a-370626dc5be4/id-preview-9ef085ee--03d3f7f3-0812-4f07-974e-69a3123fcc08.lovable.app-1778774951725.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Marginalia",
              url: "https://self-law.org",
              description: "A citizen's law index — federal codebooks read together.",
            },
            {
              "@type": "WebSite",
              name: "Marginalia",
              url: "https://self-law.org",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://self-law.org/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
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
        <AuthGate />
        <main id="main">
          <Outlet />
        </main>
        <Capybara />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Public, crawlable, or auth-flow routes. Everything else requires sign-in.
const PUBLIC_PREFIXES = [
  "/auth",
  "/about",
  "/whitepaper",
  "/chambers",
  "/subscribe",
  "/checkout",
  "/sitemap.xml",
  "/api/",
  "/lovable/",
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
