import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";

// 4-frame ASCII capybara — now with full glam: lashes, lipstick, the works
const FRAMES = [
  String.raw`
   ⋆˚༘♡  (\__/)
         (✿◕ᴥ◕)♡
         /  づ  ` ,
  String.raw`
   ⋆˚༘♡  (\__/)
         (✿-ᴥ-)♡
         /  づ  ` ,
  String.raw`
   ⋆˚༘♡  (\__/)
         (✿◉ᴥ◉)~♡
         /  づ  ` ,
  String.raw`
   ⋆˚༘♡  (\__/)
         (✿¬‿¬)♡
         /  づ  ` ,
];

type QuipRule = { test: (q: string, path: string) => boolean; quips: string[] };

const RULES: QuipRule[] = [
  { test: (q) => /\btax|irs|revenue|1040\b/i.test(q), quips: [
    "ah, taxes. the only horror story congress writes annually.",
    "you, voluntarily reading the IRM? bold.",
    "Title 26 enjoyer detected. seek sunlight.",
  ]},
  { test: (q) => /\b(gun|firearm|2a|second amendment)\b/i.test(q), quips: [
    "the comma in the 2nd amendment has its own legal practice.",
    "27 CFR enjoyer. ATF says hi.",
  ]},
  { test: (q) => /\b(weed|marijuana|cannabis|drug)\b/i.test(q), quips: [
    "Schedule I. don't shoot the messenger capybara.",
    "21 USC 812 has thoughts.",
  ]},
  { test: (q) => /\b(landlord|tenant|eviction|lease)\b/i.test(q), quips: [
    "landlord-tenant law: where 'reasonable' means whatever the judge had for breakfast.",
  ]},
  { test: (q) => /\b(divorce|custody|alimony)\b/i.test(q), quips: [
    "this is state law, friend. federal capybara cannot help. emotionally either.",
  ]},
  { test: (q) => /\b(ucc|9-\d|secured|collateral)\b/i.test(q), quips: [
    "Article 9. nobody's favorite, everybody's problem.",
  ]},
  { test: (q) => /\b(due process|14th|fourteenth)\b/i.test(q), quips: [
    "substantive or procedural? trick question. it's both. forever.",
  ]},
  { test: (q) => /\b(warrant|search|seizure|4th)\b/i.test(q), quips: [
    "Fourth Amendment: vibes-based since 1791.",
  ]},
  { test: (q) => q.length > 0 && q.length < 4, quips: [
    "three letters? this is a law library, not a license plate.",
    "expand on that, philosopher.",
  ]},
  { test: (_q, path) => path.startsWith("/code"), quips: [
    "120,000 documents. statistically, one of them ruins your day.",
    "skimming the CFR for fun? log off.",
    "fun fact: nobody has read all of this. nobody.",
  ]},
  { test: (_q, path) => path.startsWith("/search"), quips: [
    "searching is just guessing with extra steps.",
    "ctrl+f, but make it federal.",
  ]},
  { test: (_q, path) => path.startsWith("/forum"), quips: [
    "opinions ahead. proceed at own risk.",
  ]},
  { test: (_q, path) => path.startsWith("/chambers"), quips: [
    "you found the back room. don't tell legal.",
  ]},
];

const IDLE_QUIPS = [
  "drag me. i don't have feelings about it.",
  "*chews grass judgmentally*",
  "still here. still a capybara.",
  "this app has a forum, you know.",
  "i'm not legal advice. i'm barely a rodent.",
  "the largest rodent. the most legal rodent.",
  "click me again, see what happens.",
  "psst — try the konami code.",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const STORAGE_KEY = "capy.pos.v1";
const HIDE_KEY = "capy.hidden.v1";

export function Capybara() {
  const router = useRouter();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [frame, setFrame] = useState(0);
  const [quip, setQuip] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [clicks, setClicks] = useState(0);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const quipTimer = useRef<number | null>(null);

  // Load saved position + hidden state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPos(JSON.parse(saved));
      else setPos({ x: window.innerWidth - 180, y: window.innerHeight - 160 });
      if (localStorage.getItem(HIDE_KEY) === "1") setHidden(true);
    } catch {
      setPos({ x: 20, y: 20 });
    }
  }, []);

  // Idle blink/yawn cycle
  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame(() => (Math.random() < 0.6 ? 0 : Math.floor(Math.random() * FRAMES.length)));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Quip on route / search-query change
  useEffect(() => {
    if (hidden) return;
    const path = router.state.location.pathname;
    const q = (router.state.location.search as { q?: string })?.q ?? "";
    const matched = RULES.filter((r) => r.test(q, path));
    const pool = matched.length ? matched.flatMap((r) => r.quips) : IDLE_QUIPS;
    const t = window.setTimeout(() => {
      setQuip(pick(pool));
      setFrame(matched.length ? 3 : 1);
      if (quipTimer.current) clearTimeout(quipTimer.current);
      quipTimer.current = window.setTimeout(() => setQuip(null), 6000);
    }, 600);
    return () => clearTimeout(t);
  }, [router.state.location.pathname, router.state.location.searchStr, hidden]);

  function onMouseDown(e: React.MouseEvent) {
    if (!pos) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.preventDefault();
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 140, e.clientX - dragRef.current.dx));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragRef.current.dy));
      setPos({ x, y });
    }
    function onUp() {
      if (dragRef.current && pos) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
      }
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pos]);

  function onClick() {
    if (dragRef.current) return;
    const next = clicks + 1;
    setClicks(next);
    setFrame((f) => (f + 1) % FRAMES.length);
    setQuip(pick(IDLE_QUIPS));
    if (quipTimer.current) clearTimeout(quipTimer.current);
    quipTimer.current = window.setTimeout(() => setQuip(null), 5000);
    if (next >= 7) {
      setClicks(0);
      router.navigate({ to: "/chambers" });
    }
  }

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setHidden(true);
    try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* ignore */ }
  }

  if (hidden || !pos) return null;

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[60] select-none"
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {quip && (
        <div className="mb-1 max-w-[220px] rounded-lg border border-accent/40 bg-card px-3 py-2 text-xs leading-snug text-foreground shadow-[0_8px_24px_-8px_oklch(0.68_0.21_32/0.6)]">
          {quip}
        </div>
      )}
      <div className="group relative cursor-grab active:cursor-grabbing">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl opacity-70"
          style={{ background: "radial-gradient(circle at 50% 60%, oklch(0.78 0.18 350 / 0.55), transparent 70%)" }}
        />
        <pre className="font-mono text-[11px] font-bold leading-tight whitespace-pre"
             style={{ color: "oklch(0.92 0.08 350)", textShadow: "0 0 10px oklch(0.78 0.2 350 / 0.7)" }}>
{FRAMES[frame]}
        </pre>
        <button
          onClick={dismiss}
          title="hide capybara"
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-foreground/30 bg-background text-[10px] text-foreground/60 hover:text-foreground group-hover:flex"
        >
          ×
        </button>
      </div>
    </div>
  );
}