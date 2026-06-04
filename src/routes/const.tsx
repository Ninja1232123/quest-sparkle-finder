import { createFileRoute } from "@tanstack/react-router";
import { getConstitutionLanding } from "@/lib/documents.functions";
import { ConstitutionLanding } from "@/components/marginalia/ConstitutionLanding";

export const Route = createFileRoute("/const")({
  loader: () => getConstitutionLanding(),
  component: ConstPage,
  head: () => ({
    meta: [
      { title: "The U.S. Constitution — We the People · Self-Law" },
      { name: "description", content: "Read the U.S. Constitution whole — all seven articles and twenty-seven amendments, in plain text, exactly as written. The founding charter, indexed." },
      { property: "og:title", content: "The U.S. Constitution — We the People · Self-Law" },
      { property: "og:description", content: "Seven articles. Twenty-seven amendments. One stubborn experiment in self-rule — read it whole." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/const" }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load the Constitution</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function ConstPage() {
  const { docs, preambleText } = Route.useLoaderData();
  return <ConstitutionLanding docs={docs} preambleText={preambleText} />;
}
