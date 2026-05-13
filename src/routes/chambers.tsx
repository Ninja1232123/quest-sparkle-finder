import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, RotateCw, Home, Copy, Check } from "lucide-react";
import {
  generateBranch,
  formatBig,
  BRANCH_TYPE_LABEL,
  HOME_BRANCH,
  type Branch,
} from "@/lib/multiverse";

export const Route = createFileRoute("/chambers")({
  component: ChambersPage,
  head: () => ({
    meta: [
      { title: "Multiverse Explorer · Marginalia" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Every choice creates a new branch." },
    ],
  }),
});

function StatRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-background/10 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-background/40">{label}</span>
      <span className={`text-right text-sm text-background/85 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function PhysicsBar({ label, value, low = 0, high = 2 }: { label: string; value: number; low?: number; high?: number }) {
  const pct = Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
  const ours = Math.max(0, Math.min(100, ((1 - low) / (high - low)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] font-mono uppercase tracking-wider text-background/40">
        <span>{label}</span>
        <span className="text-background/70">{value.toFixed(2)}×</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-background/10">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-[var(--ochre)]/70"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-[-2px] h-[10px] w-px bg-background/40"
          style={{ left: `${ours}%` }}
          title="our universe"
        />
      </div>
    </div>
  );
}

function BranchCard({ branch, index }: { branch: Branch; index: number }) {
  const [copied, setCopied] = useState(false);
  const isHome = branch.branchId === "Ω-HOME-0000";
  function copy() {
    navigator.clipboard.writeText(branch.branchId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="rounded-2xl border border-background/15 bg-background/[0.03] p-6 paper-grain">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-background/40">
          observation #{String(index).padStart(3, "0")} · {BRANCH_TYPE_LABEL[branch.branchType].toLowerCase()}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-full border border-background/15 px-2 py-0.5 font-mono text-[10px] text-background/60 hover:border-background/40 hover:text-background"
        >
          {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
          {branch.branchId}
        </button>
      </div>

      <div className="mt-3">
        <div className="font-display text-2xl font-semibold tracking-tight text-[var(--ochre)] md:text-3xl">
          {branch.divergencePoint}.
        </div>
        <div className="mt-2 text-sm italic text-background/70">{branch.specialNote}</div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-background/40">
            census
          </div>
          <StatRow label="age" value={`${branch.ageBillionYears.toFixed(1)} Gyr`} />
          <StatRow label="galaxies" value={formatBig(branch.galaxies)} />
          <StatRow label="stars" value={formatBig(branch.stars)} />
          <StatRow label="habitable worlds" value={formatBig(branch.habitableWorlds)} />
          <StatRow label="life-bearing" value={formatBig(branch.lifeBearingWorlds)} />
          <StatRow label="civilizations" value={formatBig(branch.civilizations)} />
          <StatRow label="dominant life" value={branch.dominantLifeForm} mono={false} />
          <StatRow label="tech level" value={branch.technologyLevel} mono={false} />
        </div>
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-background/40">
            physics — relative to ours
          </div>
          <div className="space-y-3">
            <PhysicsBar label="gravity" value={branch.physics.gravity} />
            <PhysicsBar label="speed of light" value={branch.physics.lightSpeed} />
            <PhysicsBar label="atomic binding" value={branch.physics.atomicBinding} />
            <PhysicsBar label="dark energy" value={branch.physics.darkEnergy} />
          </div>

          <div className="mt-6">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-background/40">
              status
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Tag ok={branch.physics.stable}>stable</Tag>
              <Tag ok={branch.physics.lifePossible}>life possible</Tag>
              <Tag ok={branch.physics.intelligencePossible}>intelligence possible</Tag>
              <Tag ok={branch.hasContactedOtherBranches}>cross-branch contact</Tag>
              {isHome && <Tag ok>this is your universe</Tag>}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-background/40">
              ultimate fate
            </div>
            <div className="font-display text-base font-semibold text-background">{branch.fate}</div>
            <div className="text-xs text-background/60">{branch.fateDescription}</div>
            {branch.timeRemaining > 0 && (
              <div className="mt-1 font-mono text-[10px] text-background/40">
                in ~{formatBig(branch.timeRemaining)} years
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tag({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        ok
          ? "border-[var(--ochre)]/40 bg-[var(--ochre)]/10 text-[var(--ochre)]"
          : "border-background/15 text-background/30 line-through"
      }`}
    >
      {children}
    </span>
  );
}

function ChambersPage() {
  const [branch, setBranch] = useState<Branch>(HOME_BRANCH);
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<Branch[]>([]);

  function generate() {
    const b = generateBranch();
    setBranch(b);
    setCount((n) => n + 1);
    setHistory((h) => [b, ...h].slice(0, 6));
  }

  useEffect(() => {
    // First load: show home branch, then auto-jump after a beat
    const t = setTimeout(generate, 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--ink)] text-background">
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-24">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-background/40">
          ⬆ ⬆ ⬇ ⬇ ⬅ ➡ ⬅ ➡ B A
        </div>
        <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
          The <span className="italic text-[var(--ochre)]">multiverse</span> explorer.
        </h1>
        <p className="mt-6 max-w-xl font-display text-lg italic leading-relaxed text-background/70 md:text-xl">
          Every choice creates a new branch. Every quantum event splits reality. This is your window into the infinite.
        </p>
        <p className="mt-3 max-w-xl font-mono text-[10px] uppercase tracking-wider text-background/30">
          none of this is real. none of this is advice. all of it is a coping mechanism.
        </p>

        <div className="mt-10">
          <BranchCard branch={branch} index={count} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ochre)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Spin another branch
          </button>
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-4 py-2 text-xs text-background/70 hover:border-background/60 hover:text-background"
          >
            <RotateCw className="h-3 w-3" /> reroll
          </button>
          <button
            onClick={() => { setBranch(HOME_BRANCH); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-4 py-2 text-xs text-background/70 hover:border-background/60 hover:text-background"
          >
            <Home className="h-3 w-3" /> home branch
          </button>
        </div>

        {history.length > 0 && (
          <div className="mt-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-background/40">
              recent observations
            </div>
            <ul className="mt-3 space-y-1">
              {history.map((b, i) => (
                <li key={`${b.branchId}-${i}`}>
                  <button
                    onClick={() => setBranch(b)}
                    className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-background/[0.04]"
                  >
                    <span className="font-mono text-[10px] text-background/40 group-hover:text-background/70">
                      {b.branchId}
                    </span>
                    <span className="truncate text-sm text-background/75 group-hover:text-background">
                      {b.divergencePoint}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-background/30">
                      {BRANCH_TYPE_LABEL[b.branchType].toLowerCase()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-16 flex flex-wrap gap-4 border-t border-background/10 pt-8">
          <Link
            to="/"
            className="rounded-full border border-background/20 px-5 py-2 text-sm text-background/80 hover:border-background/60 hover:text-background"
          >
            ← back to the record
          </Link>
          <Link
            to="/forum"
            className="rounded-full bg-[var(--ochre)] px-5 py-2 text-sm font-semibold text-[var(--ink)] hover:opacity-90"
          >
            take it to The Floor
          </Link>
        </div>
      </section>
    </div>
  );
}
