import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Clock, Sparkles } from "lucide-react";
import { ResearchShell } from "./ResearchShell";
import { ComingSoonHeader } from "./ComingSoon";
import type { Codebook } from "@/lib/codebooks";
import type { SourceSummary } from "@/lib/documents.functions";

const SOURCE_DISPLAY: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  irm: "Internal Revenue Manual",
  tfm: "Treasury Financial Manual",
  usgm: "U.S. Government Manual",
  fedregister: "Federal Register",
  bills: "Congressional Bills",
  plaw: "Public & Private Laws",
  statute: "Statutes at Large",
  statcomp: "Statute Compilations",
  presdoc: "Presidential Documents",
  pppus: "Public Papers of the Presidents",
  scotus: "Supreme Court Decisions",
  flite: "SCOTUS · FLITE (1937–1975)",
};

type Props = {
  codebook: Codebook;
  sources: SourceSummary[];
};

export function CodebookLanding({ codebook, sources }: Props) {
  const isLive = codebook.status === "live";
  const ownSources = sources.filter((s) => codebook.sources.includes(s.code));
  const totalDocs = ownSources.reduce((n, s) => n + s.count, 0);

  const Icon = codebook.icon;

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">this codebook</div>
        <div
          className="rounded-lg border border-border/60 bg-card/60 p-3"
          style={{ borderLeft: `4px solid ${codebook.accent}` }}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: codebook.accent }} />
            <span className="font-display text-sm font-semibold">{codebook.name}</span>
          </div>
          {isLive && totalDocs > 0 && (
            <>
              <div className="mt-2 font-mono text-xs text-muted-foreground">documents indexed</div>
              <div className="font-display text-2xl font-semibold">{totalDocs.toLocaleString()}</div>
            </>
          )}
          <p className="mt-2 text-xs leading-relaxed text-foreground/65">{codebook.tagline}</p>
        </div>
      </div>

      {!isLive && (
        <div>
          <div className="citation-tag mb-1.5 text-ochre">status</div>
          <div className="rounded-lg border border-dashed border-ochre/40 bg-ochre/5 p-3 text-xs text-foreground/70">
            <div className="flex items-center gap-1.5 font-medium text-ochre">
              <Sparkles className="h-3 w-3" />
              Coming to the index
            </div>
            <p className="mt-1 leading-relaxed">
              The structure is planned. Documents land here once ingest is wired up — no need to
              guess where they'll go.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-5xl">
      <section>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: codebook.accent }} />
          <span className="citation-tag text-muted-foreground">{isLive ? "now browseable" : "coming soon"}</span>
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {codebook.name}
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">{codebook.tagline}</p>

        {/* Live: source-card grid that lets the user open the existing reader */}
        {isLive && ownSources.length > 0 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {ownSources.map((s) => (
              <Link
                key={s.code}
                to="/code/source/$source"
                params={{ source: s.code }}
                className="group relative overflow-hidden rounded-2xl border bg-card p-6 pl-7 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm)]"
                style={{
                  borderLeft: `6px solid ${codebook.accent}`,
                  backgroundImage: `linear-gradient(135deg, ${codebook.accent}14 0%, transparent 55%)`,
                }}
              >
                <div className="citation-tag" style={{ color: codebook.accent }}>
                  {s.count.toLocaleString()} documents
                </div>
                <div className="mt-1 font-display text-xl font-semibold">
                  {SOURCE_DISPLAY[s.code] ?? s.name}
                </div>
                <div className="mt-4 flex items-center gap-1.5 font-mono text-xs text-muted-foreground group-hover:text-foreground/70">
                  Browse <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Live but empty: ingest hasn't run yet for a "live" codebook */}
        {isLive && ownSources.length === 0 && (
          <PlannedShape codebook={codebook} />
        )}

        {/* Soon: planned shape with example URLs */}
        {!isLive && <PlannedShape codebook={codebook} />}
      </section>
    </ResearchShell>
  );
}

function PlannedShape({ codebook }: { codebook: Codebook }) {
  const examples = exampleBrowseFor(codebook);
  return (
    <div className="mt-10">
      <ComingSoonHeader
        eyebrow={`planned browse model · ${kindLabel(codebook.kind)}`}
        title="Here's the shape this codebook will take."
        subtitle="When the data lands, these are the screens you'll click through. No mystery search-first list."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {examples.map((ex, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-2xl border border-dashed border-foreground/15 bg-card/40 p-5 paper-grain"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: `linear-gradient(135deg, ${codebook.accent}10 0%, transparent 55%)` }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <ex.icon className="h-3.5 w-3.5" style={{ color: codebook.accent }} />
                <span className="citation-tag" style={{ color: codebook.accent }}>{ex.eyebrow}</span>
              </div>
              <h3 className="mt-2 font-display text-base font-semibold">{ex.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">{ex.pitch}</p>
              {ex.urlHint && (
                <code className="mt-3 inline-block rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground/65">
                  {ex.urlHint}
                </code>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function kindLabel(kind: Codebook["kind"]): string {
  switch (kind) {
    case "small-toc": return "single-page table of contents";
    case "hierarchy": return "Title → Chapter → Section";
    case "time": return "year → month → document";
    case "cases": return "decade → year → case";
    case "agency": return "by agency";
  }
}

function exampleBrowseFor(cb: Codebook): { icon: typeof Calendar; eyebrow: string; title: string; pitch: string; urlHint?: string }[] {
  const slug = cb.slug;
  switch (cb.kind) {
    case "time":
      return [
        { icon: Calendar, eyebrow: "by year", title: "Current year, all months", pitch: "Big year picker at top, month density heatmap below — at a glance see when activity spiked.", urlHint: `/${slug}/2026` },
        { icon: Calendar, eyebrow: "by month", title: "A single month's docs", pitch: "Day-by-day list with type chips. Click in for the full text.", urlHint: `/${slug}/2026/05` },
        { icon: Clock, eyebrow: "recently added", title: "Just-landed feed", pitch: "What hit the index in the last 7 days, sorted newest first.", urlHint: `/${slug}/recent` },
        { icon: Sparkles, eyebrow: "by agency / sponsor", title: "Group by who issued it", pitch: "Once metadata is cleaned, sort the firehose by EPA / Treasury / individual sponsor.", urlHint: `/${slug}/agency/epa` },
      ];
    case "cases":
      return [
        { icon: Calendar, eyebrow: "by decade", title: "1970s opinions", pitch: "Decade ribbon at top, scroll a clean list of cases by year.", urlHint: `/${slug}/1970s` },
        { icon: Clock, eyebrow: "by case", title: "Brown v. Board of Education", pitch: "Full opinion with the holding pulled to the top and citations wired into the codebooks they interpret.", urlHint: `/${slug}/1954/brown-v-board` },
        { icon: Sparkles, eyebrow: "by topic", title: "Equal protection cases", pitch: "Once cases are tagged, browse by doctrine — not just chronology.", urlHint: `/${slug}/topic/equal-protection` },
        { icon: Calendar, eyebrow: "recently added", title: "Latest opinions indexed", pitch: "What got added in the last drop.", urlHint: `/${slug}/recent` },
      ];
    case "agency":
      return [
        { icon: Sparkles, eyebrow: "shelf", title: "Pick an agency manual", pitch: "Each agency manual gets its own card with last-updated date and a section count.", urlHint: `/${slug}` },
      ];
    case "small-toc":
      return [
        { icon: Sparkles, eyebrow: "shelf", title: "Full table of contents", pitch: "Small enough to live on one page — no pagination, no hunting.", urlHint: `/${slug}` },
      ];
    case "hierarchy":
      return [
        { icon: Sparkles, eyebrow: "shelf", title: "Title grid", pitch: "Every title with section counts; jump-to-citation input at the top.", urlHint: `/${slug}` },
      ];
  }
}