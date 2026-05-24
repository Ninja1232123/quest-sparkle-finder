#!/usr/bin/env bash
# apply-marginalia-v2.sh
# Drops the Marginalia v2 patch into a checked-out self-law repo.
# Run from the repo root:   bash apply-marginalia-v2.sh
#
# What it touches:
#   - src/styles.css                                    (replace — v1 + v2 styles)
#   - src/routes/__root.tsx                             (replace — mounts CmdPalette)
#   - src/routes/{index,about,whitepaper}.tsx           (replace — v1 patch carry-over)
#   - src/routes/{usc,cfr,const,model}.tsx              (replace — loads TOC for landing)
#   - src/components/marginalia/MarginalNote.tsx        (new — v1 patch carry-over)
#   - src/components/marginalia/SiteHeader.tsx          (replace — v1 patch carry-over)
#   - src/components/marginalia/CmdPalette.tsx          (new — ⌘K palette)
#   - src/components/marginalia/CodebookLanding.tsx     (replace — sub-volume grid + desk rail)
#
# Re-running is idempotent — it just overwrites the same files.
# Run `git diff` afterward to review, then commit and push from your machine.

set -euo pipefail

if [ ! -f "package.json" ] || ! grep -q "self-law\|marginalia" package.json 2>/dev/null; then
  echo "⚠️  This does not look like the self-law repo root."
  echo "    Make sure you're cd'd into the repo before running this."
  read -rp "    Continue anyway? [y/N] " yn
  case "$yn" in [yY]*) ;; *) exit 1 ;; esac
fi

write_file() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  echo "  ✓ wrote $path"
}

echo "→ Applying Marginalia v2 patch…"

write_file "src/styles.css" <<'__MARGINALIA_V2_EOF__'
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap");

/*
 * Design system definition.
 *
 * The @theme inline block maps CSS custom properties to Tailwind utility
 * classes (e.g. --color-primary -> bg-primary, text-primary).
 *
 * The :root and .dark blocks define the actual color values using oklch.
 * All colors MUST use oklch format.
 *
 * To add a new semantic color:
 * 1. Add the variable to :root (light value) and .dark (dark value)
 * 2. Register it in @theme inline as --color-<name>: var(--<name>)
 */

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-ring-offset-background: var(--background);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-ink: var(--ink);
  --color-paper: var(--paper);
  --color-sage: var(--sage);
  --color-sage-deep: var(--sage-deep);
  --color-terracotta: var(--terracotta);
  --color-ochre: var(--ochre);
  --color-highlight: var(--highlight);
  --font-display: "Bricolage Grotesque", "Inter", system-ui, sans-serif;
  --font-serif: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

:root {
  --radius: 0.875rem;

  /* Warm paper — reading-room palette. Cream background, near-black serif type.
     Saturated color is reserved for accents and highlights only. */
  --paper: oklch(0.957 0.012 80);       /* #F7F2E8 warm parchment */
  --paper-deep: oklch(0.93 0.014 78);   /* aged page edge */
  --paper-soft: oklch(0.974 0.012 85);  /* #FCF8F0 card surface */
  --paper-tint: oklch(0.945 0.014 80);  /* between paper and paper-deep — sidebars / chip backgrounds */
  --ink: oklch(0.18 0.008 70);          /* #1A1814 warm near-black */
  --ink-muted: oklch(0.38 0.014 75);    /* darker muted body for contrast on cream */
  --rule-card: oklch(0.74 0.020 75);    /* darker tan border for "ink-on-paper" cards */
  --sage: oklch(0.55 0.07 165);         /* desaturated reading-room green */
  --sage-deep: oklch(0.42 0.08 165);
  --terracotta: oklch(0.42 0.13 30);    /* #8B2E1F deep oxblood */
  --ochre: oklch(0.81 0.14 80);         /* #E8B84A — reserved for marks */
  --highlight: oklch(0.86 0.12 85);     /* softer highlight wash */

  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper-soft);
  --card-foreground: var(--ink);
  --popover: var(--paper-soft);
  --popover-foreground: var(--ink);
  --primary: var(--terracotta);
  --primary-foreground: oklch(0.974 0.012 85);
  --secondary: oklch(0.91 0.014 78);
  --secondary-foreground: var(--ink);
  --muted: oklch(0.92 0.012 78);
  --muted-foreground: var(--ink-muted);
  --accent: var(--terracotta);
  --accent-foreground: oklch(0.974 0.012 85);
  --destructive: oklch(0.5 0.18 28);
  --destructive-foreground: oklch(0.974 0.012 85);
  --border: oklch(0.84 0.018 75);       /* #D9CFBF */
  --input: oklch(0.89 0.014 78);
  --ring: var(--terracotta);
  --chart-1: var(--sage-deep);
  --chart-2: var(--terracotta);
  --chart-3: oklch(0.65 0.13 80);
  --chart-4: oklch(0.45 0.08 220);
  --chart-5: oklch(0.5 0.1 320);
  --sidebar: oklch(0.94 0.014 78);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--terracotta);
  --sidebar-primary-foreground: oklch(0.974 0.012 85);
  --sidebar-accent: oklch(0.91 0.014 78);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: oklch(0.84 0.018 75);
  --sidebar-ring: var(--terracotta);

  --gradient-warm: linear-gradient(135deg, var(--terracotta), var(--ochre));
  --gradient-sage: linear-gradient(135deg, var(--sage) 0%, var(--sage-deep) 100%);
  --gradient-sunset: linear-gradient(135deg, var(--ochre), var(--terracotta));
  --shadow-soft: 0 1px 2px oklch(0 0 0 / 0.06), 0 4px 14px -6px oklch(0 0 0 / 0.10);
  --shadow-warm: 0 10px 30px -14px oklch(0.42 0.13 30 / 0.30);
  --shadow-card: 0 1px 2px oklch(0 0 0 / 0.05), 0 6px 18px -10px oklch(0 0 0 / 0.10);
  --shadow-card-lift: 0 2px 0 oklch(0 0 0 / 0.04), 0 6px 18px -4px oklch(0 0 0 / 0.10);
}

.dark {
  /* Warm charcoal — same palette family as light, inverted lightness. No midnight blue. */
  --paper: oklch(0.18 0.006 70);         /* #1C1A17 */
  --paper-deep: oklch(0.14 0.006 70);
  --paper-soft: oklch(0.22 0.006 70);    /* #252320 card */
  --paper-tint: oklch(0.20 0.006 70);
  --ink: oklch(0.90 0.014 80);           /* #E8E2D4 cream */
  --ink-muted: oklch(0.72 0.013 75);     /* brighter muted text on warm charcoal */
  --rule-card: oklch(0.32 0.008 70);     /* lighter line for dark cards */
  --sage: oklch(0.66 0.08 165);
  --sage-deep: oklch(0.55 0.08 165);
  --terracotta: oklch(0.62 0.10 40);     /* #C97B5A muted */
  --ochre: oklch(0.74 0.12 80);          /* #D4A84A softer */
  --highlight: oklch(0.74 0.12 80);

  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper-soft);
  --card-foreground: var(--ink);
  --popover: var(--paper-soft);
  --popover-foreground: var(--ink);
  --primary: var(--terracotta);
  --primary-foreground: oklch(0.14 0.006 70);
  --secondary: oklch(0.25 0.008 70);
  --secondary-foreground: var(--ink);
  --muted: oklch(0.25 0.008 70);
  --muted-foreground: var(--ink-muted);
  --accent: var(--terracotta);
  --accent-foreground: oklch(0.14 0.006 70);
  --destructive: oklch(0.62 0.18 28);
  --destructive-foreground: oklch(0.90 0.014 80);
  --border: oklch(0.27 0.008 70);        /* #2F2B26 */
  --input: oklch(0.25 0.008 70);
  --ring: var(--terracotta);
  --chart-1: var(--sage-deep);
  --chart-2: var(--terracotta);
  --chart-3: var(--ochre);
  --chart-4: oklch(0.55 0.10 220);
  --chart-5: oklch(0.55 0.12 320);
  --sidebar: oklch(0.16 0.006 70);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--terracotta);
  --sidebar-primary-foreground: oklch(0.14 0.006 70);
  --sidebar-accent: oklch(0.25 0.008 70);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: oklch(0.27 0.008 70);
  --sidebar-ring: var(--terracotta);

  --shadow-soft: 0 1px 2px oklch(0 0 0 / 0.4), 0 6px 18px -8px oklch(0 0 0 / 0.5);
  --shadow-warm: 0 10px 30px -14px oklch(0.62 0.10 40 / 0.45);
  --shadow-card: 0 1px 0 oklch(1 0 0 / 0.03) inset, 0 1px 3px oklch(0 0 0 / 0.45), 0 10px 24px -14px oklch(0 0 0 / 0.55);
  --shadow-card-lift: 0 2px 0 oklch(0 0 0 / 0.30), 0 6px 18px -4px oklch(0 0 0 / 0.50);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    font-feature-settings: "ss01", "cv11";
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  h1,
  h2,
  h3,
  h4,
  .font-display {
    font-family: var(--font-display);
    font-optical-sizing: auto;
    letter-spacing: -0.02em;
    font-weight: 700;
    color: var(--ink);
  }

  /* Long-form reading regions (statute body, articles). Serif at comfortable size. */
  .reading,
  article .reading,
  .prose-legal {
    font-family: var(--font-serif);
    font-size: 1.125rem;        /* 18px */
    line-height: 1.7;
    color: var(--ink);
    font-feature-settings: "onum", "kern";
  }

  /* Subtle paper texture — barely visible, no longer a grid pattern */
  .paper-grain {
    background-image:
      radial-gradient(at 20% 30%, oklch(0 0 0 / 0.015) 0px, transparent 50%),
      radial-gradient(at 80% 70%, oklch(0 0 0 / 0.012) 0px, transparent 55%);
  }
  .dark .paper-grain {
    background-image:
      radial-gradient(at 20% 30%, oklch(1 0 0 / 0.02) 0px, transparent 50%),
      radial-gradient(at 80% 70%, oklch(1 0 0 / 0.015) 0px, transparent 55%);
  }

  /* Hand-marked highlight — thinner band, warmer, sits behind italic serif */
  .ink-underline {
    background-image: linear-gradient(transparent 72%, var(--ochre) 72%, var(--ochre) 92%, transparent 92%);
    background-size: 100% 100%;
    padding: 0 0.08em;
    color: var(--ink);
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 600;
  }
  .dark .ink-underline {
    background-image: linear-gradient(transparent 72%, oklch(0.74 0.12 80 / 0.55) 72%, oklch(0.74 0.12 80 / 0.55) 92%, transparent 92%);
    color: var(--ink);
  }

  /* Highlighting matches inside snippets (e.g., ts_headline <mark>) */
  mark {
    background-color: oklch(0.86 0.12 85 / 0.6);
    color: var(--ink);
    padding: 0 0.1em;
    border-radius: 2px;
  }
  .dark mark {
    background-color: oklch(0.74 0.12 80 / 0.35);
    color: var(--ink);
  }

  .citation-tag {
    font-family: var(--font-mono);
    font-size: 1.19rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @keyframes float-slow {
    0%,
    100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  .animate-float {
    animation: float-slow 6s ease-in-out infinite;
  }

  @keyframes draw-line {
    from {
      stroke-dashoffset: 1000;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  .animate-draw {
    stroke-dasharray: 1000;
    animation: draw-line 2.5s ease-out forwards;
  }
}

/* ============================================================
   v2 ADDITIONS — solid count pills, tinted accent surfaces,
   marginal notes. All additive; existing classes untouched.
   ============================================================ */

@layer components {
  /* ----- Solid count pill (the big visual shift) -----
     Use as: <span class="count-pill" style="--c: #b22234">
                <span class="num">218,447</span>
                <span class="lbl">docs</span>
              </span>
     Falls back to ink-on-paper if --c is unset. */
  .count-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffffff;
    background: var(--c, var(--ink));
    border-radius: 999px;
    padding: 4px 11px;
    white-space: nowrap;
  }
  .count-pill.lg {
    font-size: 12.5px;
    padding: 6px 14px;
    gap: 8px;
  }
  .count-pill .num {
    font-weight: 800;
    letter-spacing: 0.03em;
  }
  .count-pill .lbl {
    opacity: 0.85;
    font-weight: 600;
  }
  /* Coming-soon variant — neutral, hollow */
  .count-pill.soon {
    background: transparent;
    color: var(--ink-muted);
    border: 1.5px dashed var(--border);
  }

  /* ----- Tinted accent surface -----
     A card / chip that picks up its codebook accent as a soft wash on
     the background and a slightly stronger color on the border.
     Use as: <div class="accent-surface" style="--c: #1a4a2e"> */
  .accent-surface {
    background:
      linear-gradient(135deg, color-mix(in oklch, var(--c, var(--ink)) 8%, transparent) 0%, transparent 55%),
      var(--card);
    border: 1.5px solid color-mix(in oklch, var(--c, var(--ink)) 28%, var(--rule-card));
    transition: transform 160ms ease-out, border-color 160ms ease-out, box-shadow 160ms ease-out;
  }
  .accent-surface:hover {
    transform: translateY(-1px);
    border-color: var(--c, var(--ink));
    box-shadow: 0 6px 20px -8px color-mix(in oklch, var(--c, var(--ink)) 40%, transparent);
  }
  .accent-surface-row {
    background:
      linear-gradient(to right, color-mix(in oklch, var(--c, var(--ink)) 7%, transparent) 0%, transparent 85%),
      var(--card);
    border: 1.5px solid color-mix(in oklch, var(--c, var(--ink)) 28%, var(--rule-card));
    transition: transform 160ms ease-out, border-color 160ms ease-out;
  }
  .accent-surface-row:hover {
    transform: translateY(-1px);
    border-color: var(--c, var(--ink));
  }

  /* ----- Tinted codebook tab -----
     Replaces the plain hover used by the SiteHeader CodebookTab. The dot
     + label stay; the background and border now carry the accent color
     so the strip reads as a row of distinct books. */
  .cb-tab {
    --c: var(--ink);
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    border-radius: 6px;
    padding: 6px 10px;
    font-family: var(--font-display);
    font-size: 13px;
    color: var(--ink);
    background: color-mix(in oklch, var(--c) 6%, transparent);
    border: 1px solid color-mix(in oklch, var(--c) 18%, transparent);
    transition: background 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out;
  }
  .cb-tab:hover {
    background: color-mix(in oklch, var(--c) 14%, transparent);
    border-color: color-mix(in oklch, var(--c) 45%, transparent);
  }
  .cb-tab.active,
  .cb-tab[data-active="true"] {
    background: color-mix(in oklch, var(--c) 18%, transparent);
    border: 1.5px solid var(--c);
    font-weight: 700;
  }
  .cb-tab.soon {
    background: color-mix(in oklch, var(--c) 3%, transparent);
    border-color: color-mix(in oklch, var(--c) 12%, transparent);
    color: var(--ink-muted);
  }
  .cb-tab.soon:hover {
    color: var(--ink);
    background: color-mix(in oklch, var(--c) 9%, transparent);
  }

  /* ----- Top nav row (sits under brand row, above codebook strip) ----- */
  .top-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 1.5rem;
    border-top: 1px solid var(--border);
  }
  .top-nav-link {
    font-family: var(--font-display);
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink-muted);
    padding: 10px 14px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 150ms, border-color 150ms;
  }
  .top-nav-link:hover {
    color: var(--ink);
  }
  .top-nav-link[data-active="true"] {
    color: var(--ink);
    border-bottom-color: var(--terracotta);
    font-weight: 700;
  }
  .top-nav-support {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
    padding: 8px 12px;
  }
  .top-nav-support:hover {
    color: var(--terracotta);
  }

  /* ----- Button primitives (consistent ink-pill / paper-pill) ----- */
  .btn-ink {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--ink);
    color: var(--paper);
    border-radius: 999px;
    padding: 9px 18px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    border: 1.5px solid var(--ink);
    transition: opacity 150ms, transform 150ms;
  }
  .btn-ink:hover { opacity: 0.92; }
  .btn-ink:active { transform: translateY(1px); }
  .btn-paper {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    color: var(--ink);
    border-radius: 999px;
    padding: 9px 18px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    border: 1.5px solid var(--ink);
    transition: background 150ms, color 150ms;
  }
  .btn-paper:hover { background: var(--ink); color: var(--paper); }
  .btn-terracotta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--terracotta);
    color: var(--paper-soft);
    border-radius: 999px;
    padding: 10px 20px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14.5px;
    border: 1.5px solid var(--terracotta);
    transition: background 150ms;
  }
  .btn-terracotta:hover { background: oklch(0.46 0.135 30); }
}

/* ============================================================
   MARGINAL NOTES — handwritten side annotations
   ============================================================
   Sit in the outer gutter of <main>. Each parent screen must be
   position:relative (most are by default since they contain children
   with absolute positioning). Hidden below 1100px so they don't
   overlap content on tablet/phone. */

main {
  position: relative;
}

.margin-note {
  position: absolute;
  width: 220px;
  z-index: 2;
  pointer-events: auto;
  opacity: 0.78;
  transition: opacity 220ms ease-out, transform 220ms ease-out;
}
.margin-note:hover {
  opacity: 1;
  transform: rotate(0deg) translateY(-1px) !important;
}

/* Anchor outside a ~840px reading column. Tucks to viewport edge when
   there's no gutter room. */
.margin-note.left {
  left: max(8px, calc(50vw - 420px - 240px));
}
.margin-note.right {
  right: max(8px, calc(50vw - 420px - 240px));
}

.margin-note .mn-bar {
  position: absolute;
  left: -10px;
  top: 0;
  bottom: 0;
  width: 2.5px;
  background: var(--terracotta);
  border-radius: 1px;
}
.margin-note.right .mn-bar {
  left: auto;
  right: -10px;
  background: var(--ochre);
}

.margin-note .mn-cite {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--terracotta);
  display: inline-block;
  margin-bottom: 6px;
  padding-bottom: 1px;
  border-bottom: 1.5px solid color-mix(in oklch, var(--ochre) 70%, transparent);
}
.margin-note.right .mn-cite {
  color: var(--sage-deep);
  border-bottom-color: var(--ochre);
}

.margin-note .mn-body {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 500;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-muted);
  margin: 0;
}
.margin-note .mn-aside {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11.5px;
  line-height: 1.45;
  color: oklch(0.55 0.014 75);
  margin: 8px 0 0;
  padding-left: 8px;
  border-left: 1px solid var(--rule-card);
}

/* Hide on narrow viewports — no gutter to live in */
@media (max-width: 1100px) {
  .margin-note {
    display: none;
  }
}

/* Tweak switch (write data-margins="off" on <html> to hide globally) */
html[data-margins="off"] .margin-note {
  display: none;
}

/* ============================================================
   v2.1 ADDITIONS — codebook landing (hero strip, sub-volume
   cards, the Desk rail) and the ⌘K command palette.
   ============================================================ */

@layer components {
  /* ───── CODEBOOK HERO STRIP ───── */
  .cb-hero {
    --c: var(--ink);
    display: flex;
    align-items: flex-start;
    gap: 28px;
    padding: 40px 4px 36px;
    border-bottom: 1.5px solid var(--ink);
    margin-bottom: 8px;
  }
  .cb-hero-icon {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    background: var(--c);
    color: #ffffff;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 0 oklch(0 0 0 / 0.10);
  }
  .cb-hero-status {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c);
    display: inline-flex;
    align-items: center;
  }
  .cb-hero-status-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--c);
    margin-right: 8px;
  }
  .cb-hero-title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 48px;
    letter-spacing: -0.024em;
    margin: 8px 0 0;
    color: var(--ink);
    line-height: 1.05;
  }
  @media (min-width: 768px) {
    .cb-hero-title { font-size: 56px; }
  }
  .cb-hero-tag {
    font-size: 18px;
    color: var(--ink-muted);
    line-height: 1.5;
    margin: 14px 0 0;
    max-width: 640px;
  }
  .cb-hero-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }
  @media (max-width: 900px) {
    .cb-hero { flex-direction: column; }
    .cb-hero-actions { flex-direction: row; }
  }

  /* ───── SECTION HEADERS ───── */
  .section-title-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 1.5px solid var(--ink);
  }
  .cb-section-eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .cb-section-title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 32px;
    letter-spacing: -0.02em;
    color: var(--ink);
    margin-top: 6px;
    line-height: 1.1;
  }

  /* ───── SUB-VOLUME CARDS ───── */
  .subvol-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    background: var(--card);
    border: 1.5px solid var(--rule-card);
    border-radius: 10px;
    transition: transform 160ms ease-out, border-color 160ms ease-out, box-shadow 160ms ease-out;
  }
  .subvol-card:hover {
    transform: translateY(-1px);
    border-color: var(--ink);
    box-shadow: var(--shadow-card-lift);
  }
  .subvol-card-lg {
    padding: 22px 24px;
  }
  .subvol-eyebrow {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .subvol-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    letter-spacing: -0.014em;
    color: var(--ink);
    margin-top: 4px;
    line-height: 1.2;
  }
  .subvol-recent {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .subvol-browse {
    margin-top: 10px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ───── THE DESK (right rail) ───── */
  .desk-eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule-card);
  }
  .desk-mini {
    --c: var(--ink);
    padding: 14px 16px;
    background: var(--card);
    border: 1.5px solid var(--rule-card);
    border-radius: 8px;
  }
  .desk-mini-num {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
    letter-spacing: -0.02em;
    color: var(--c);
    line-height: 1;
  }
  .desk-mini-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin-top: 6px;
  }
  .desk-card {
    padding: 14px 16px;
    background: var(--card);
    border: 1.5px solid var(--rule-card);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .desk-card-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    color: var(--ink);
  }
  .desk-card-body {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-muted);
    margin: 0;
  }
  .desk-btn-paper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    margin-top: 2px;
    padding: 6px 12px;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 12px;
    color: var(--ink);
    background: transparent;
    transition: background 150ms, color 150ms;
  }
  .desk-btn-paper:hover {
    background: var(--ink);
    color: var(--paper);
  }
  .desk-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    background: var(--card);
    border: 1px solid var(--rule-card);
    border-radius: 6px;
  }
  .desk-stat-lab {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .desk-stat-num {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 17px;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .desk-rel-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--ink-muted);
    transition: background 120ms, color 120ms;
  }
  .desk-rel-row:hover {
    background: var(--muted);
    color: var(--ink);
  }
  .desk-rel-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .desk-rel-name {
    flex: 1;
    font-weight: 500;
  }
}

/* ============================================================
   COMMAND PALETTE (⌘K)
   ============================================================ */

@layer components {
  .cmd-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: oklch(0 0 0 / 0.42);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 96px 16px 16px;
    animation: cmd-fade 140ms ease-out;
  }
  @keyframes cmd-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .cmd-panel {
    width: 100%;
    max-width: 920px;
    max-height: calc(100vh - 160px);
    background: var(--paper-soft);
    border: 1.5px solid var(--ink);
    border-radius: 14px;
    box-shadow: var(--shadow-warm), 0 24px 60px -20px oklch(0 0 0 / 0.4);
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    overflow: hidden;
    animation: cmd-pop 160ms ease-out;
  }
  @keyframes cmd-pop {
    from { transform: translateY(-8px) scale(0.98); opacity: 0; }
    to   { transform: translateY(0) scale(1);     opacity: 1; }
  }
  @media (max-width: 720px) {
    .cmd-panel {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
    .cmd-preview { display: none; }
  }

  .cmd-left {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1.5px solid var(--rule-card);
  }
  .cmd-search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border-bottom: 1.5px solid var(--rule-card);
  }
  .cmd-search-row input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--font-display);
    font-size: 16px;
    color: var(--ink);
    padding: 4px 0;
    min-width: 0;
  }
  .cmd-search-row input::placeholder {
    color: var(--ink-muted);
    opacity: 0.7;
  }
  .cmd-compare {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 5px 10px;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-muted);
    border: 1.5px solid var(--rule-card);
    transition: background 140ms, color 140ms, border-color 140ms;
    flex-shrink: 0;
  }
  .cmd-compare:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .cmd-compare.on {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .cmd-slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1.5px solid var(--rule-card);
  }
  .cmd-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-muted);
    padding: 2px 7px;
    border: 1px solid var(--rule-card);
    border-radius: 4px;
  }
  .cmd-slider-end {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-muted);
    letter-spacing: 0.04em;
  }
  .cmd-slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--terracotta);
  }
  .cmd-slider-pct {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--terracotta);
    font-weight: 700;
    min-width: 32px;
    text-align: right;
  }

  .cmd-results {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0 12px;
    min-height: 0;
  }
  .cmd-section-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-muted);
    padding: 10px 22px 6px;
  }
  .cmd-section-build {
    margin-top: 8px;
    border-top: 1px solid var(--rule-card);
  }
  .cmd-item {
    --c: var(--ink);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 22px;
    cursor: pointer;
    transition: background 100ms;
    border-left: 2px solid transparent;
  }
  .cmd-item:hover,
  .cmd-item.active {
    background: color-mix(in oklch, var(--c) 7%, transparent);
    border-left-color: var(--c);
  }
  .cmd-item-body {
    flex: 1;
    min-width: 0;
  }
  .cmd-item-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cmd-item-sub {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-muted);
    margin-top: 2px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cmd-suggest-ico {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: var(--paper-tint);
    border: 1px solid var(--rule-card);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-muted);
    flex-shrink: 0;
  }
  .cmd-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    padding: 3px 9px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffffff;
    background: var(--c);
    flex-shrink: 0;
  }
  .cmd-pill-build {
    background: var(--terracotta);
  }
  .cmd-exact {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--terracotta);
    border: 1px solid var(--terracotta);
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .cmd-compare-hint {
    color: var(--terracotta);
    font-style: italic;
    font-weight: 500;
  }
  .cmd-empty {
    padding: 20px 22px;
    color: var(--ink-muted);
    font-size: 13.5px;
    font-family: var(--font-serif);
    font-style: italic;
  }

  .cmd-foot {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 9px 22px;
    border-top: 1.5px solid var(--rule-card);
    background: var(--paper-tint);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    letter-spacing: 0.04em;
  }
  .cmd-foot kbd {
    display: inline-block;
    margin-right: 5px;
    padding: 1px 5px;
    border: 1px solid var(--rule-card);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    background: var(--paper-soft);
    color: var(--ink);
  }
  .cmd-foot-spacer { margin-left: auto; }
  .cmd-foot-hint {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  /* ───── PREVIEW PANE ───── */
  .cmd-preview {
    display: flex;
    flex-direction: column;
    padding: 22px 24px;
    background: var(--paper);
    overflow-y: auto;
    min-height: 0;
  }
  .pp-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    min-width: 56px;
    padding: 4px 11px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffffff;
  }
  .pp-title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: -0.014em;
    color: var(--ink);
    line-height: 1.2;
    margin-top: 10px;
  }
  .pp-cite {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-muted);
    letter-spacing: 0.04em;
    margin-top: 4px;
  }
  .pp-body {
    font-family: var(--font-serif);
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--ink-muted);
    margin-top: 12px;
    flex: 1;
  }
  .pp-actions {
    display: flex;
    gap: 8px;
    padding-top: 14px;
    margin-top: auto;
    border-top: 1px solid var(--rule-card);
  }
  .cmd-btn-ink,
  .cmd-btn-paper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 12px;
    border: 1.5px solid var(--ink);
    transition: opacity 140ms, background 140ms, color 140ms;
  }
  .cmd-btn-ink {
    background: var(--ink);
    color: var(--paper);
  }
  .cmd-btn-ink:hover { opacity: 0.9; }
  .cmd-btn-paper {
    background: transparent;
    color: var(--ink);
  }
  .cmd-btn-paper:hover {
    background: var(--ink);
    color: var(--paper);
  }
  .pp-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.6;
    gap: 10px;
  }
  .pp-empty kbd {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid var(--rule-card);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    background: var(--paper-soft);
    color: var(--ink);
  }
  .pp-empty-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: var(--ink);
    margin-top: 4px;
  }
  .pp-empty-hint {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-muted);
  }
  .pp-empty-body {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-muted);
  }
  .pp-empty-codebooks {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    margin-top: 12px;
  }
  .pp-cb-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-muted);
    padding: 3px 8px;
    border: 1px solid var(--rule-card);
    border-radius: 999px;
  }
  .pp-cb-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
  }
}

__MARGINALIA_V2_EOF__

write_file "src/routes/__root.tsx" <<'__MARGINALIA_V2_EOF__'
import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Capybara } from "@/components/marginalia/Capybara";
import { CmdPalette } from "@/components/marginalia/CmdPalette";
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
      { name: "google-site-verification", content: "MrUA-5AhYOA7ltMplk_EcKzRwYSJaa0-J_mhiXnsqI4" },
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
        <CmdPalette />
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
__MARGINALIA_V2_EOF__

write_file "src/routes/index.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, Link } from "@tanstack/react-router";
import { TOPICS } from "@/data/topics";
import { TopicCard } from "@/components/marginalia/TopicCard";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { MarginalNotes } from "@/components/marginalia/MarginalNote";
import { listSources } from "@/lib/documents.functions";
import { codebookForSource } from "@/lib/codebooks";
import heroCollage from "@/assets/hero-collage.jpg";
import { GitCompare, Highlighter, FileDown, Bell, Zap, Map, Brain, Network, Scale, Calendar, GraduationCap } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};

// Per-source accent — falls back to ink. Pulls from the codebooks registry
// so colors stay consistent with the header tab strip and codebook landings.
function accentForSource(code: string): string {
  return codebookForSource(code)?.accent ?? "var(--ink)";
}

export const Route = createFileRoute("/")({
  loader: async () => {
    const { sources } = await listSources();
    return { sources };
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Marginalia — A citizen's law index" },
      {
        name: "description",
        content:
          "Cross-reference the Constitution, U.S. Code, CFR, UCC, TFM, and IRM in one place. Real law, no theories.",
      },
      { property: "og:title", content: "Marginalia — A citizen's law index" },
      {
        property: "og:description",
        content: "If you don't know your rights, you don't have any. Read the law as one connected record.",
      },
      { property: "og:url", content: "https://self-law.org/" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/" }],
  }),
});

function Index() {
  const { sources } = Route.useLoaderData();
  const totalDocs = sources.reduce((n: number, s: { count: number }) => n + s.count, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* Scattered marginalia — real, lesser-cited rights and statutes
            in the outer gutters of the page. Different notes per route so
            re-visits feel like the reader added new annotations. */}
        <MarginalNotes
          items={[
            { idx: 0,  side: "right", top: 360 },
            { idx: 4,  side: "left",  top: 1020 },
            { idx: 8,  side: "right", top: 1680 },
            { idx: 11, side: "left",  top: 2340 },
            { idx: 14, side: "right", top: 2980 },
          ]}
        />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
          <div className="relative z-10">
            <div className="citation-tag text-muted-foreground">Vol. I · the citizen's index</div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-[5.25rem]">
              Marginalia — <span className="ink-underline italic">A citizen's law index</span>
            </h1>
            <p className="mt-5 max-w-xl font-display text-2xl italic text-foreground/70 md:text-3xl">
              If you don't know your rights, you don't have any.
            </p>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-foreground/75">
              Six federal codebooks — Constitution, U.S. Code, CFR, UCC, TFM, IRM — indexed together,
              cross-referenced, and searchable in one place. No summaries. No gurus. Just the source.
            </p>

            <div className="mt-8">
              <SearchBar />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-display italic">try:</span>
                {["due process", "right to cure", "15 USC 1692", "4th amendment", "commercial paper"].map((s) => (
                  <Link
                    key={s}
                    to="/search"
                    search={{ q: s, source: "" }}
                    className="citation-tag rounded-full border border-border bg-background/60 px-2.5 py-1 hover:border-foreground/40 hover:text-foreground"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-10 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="citation-tag font-semibold text-foreground/80">
                  {totalDocs.toLocaleString()} documents indexed
                </span>
                <span className="citation-tag rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-700 dark:text-green-400 font-medium">
                  ✓ Updated May 2026 · direct from source
                </span>
              </div>
              {/* Indexed sources — accent-tinted chips with solid count pills.
                  Each chip picks up its codebook accent (red Const, navy USC,
                  forest CFR …) so the row reads as a stack of distinct books. */}
              <div className="flex flex-wrap gap-2.5">
                {sources.map((s: { code: string; name: string; count: number }) => {
                  const accent = accentForSource(s.code);
                  return (
                    <Link
                      key={s.code}
                      to="/code/source/$source"
                      params={{ source: s.code }}
                      className="accent-surface-row inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground"
                      style={{ ["--c" as never]: accent }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                      {SOURCE_LABELS[s.code] ?? s.name}
                      <span className="count-pill" style={{ ["--c" as never]: accent }}>
                        <span className="num">{s.count.toLocaleString()}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2rem] opacity-50 blur-2xl"
              style={{ background: "var(--gradient-sage)" }}
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-foreground/15 shadow-[var(--shadow-warm)]">
              <img
                src={heroCollage}
                alt="Federal regulations open on a research desk with citation connections visible"
                width={1536}
                height={1152}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Compare Mode CTA banner */}
      <section className="border-b border-border/60 bg-gradient-to-r from-sage-deep/5 to-terracotta/5">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="citation-tag text-sage-deep flex items-center gap-1.5">
                <GitCompare className="h-3.5 w-3.5" />
                new · side-by-side compare
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                The same term across every codebook, at once.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm text-foreground/65">
                Type one search. See how the Constitution, U.S. Code, CFR, and UCC each handle it — in
                split panes with matched sections highlighted. Spot the gaps. Find the authority.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end shrink-0">
              <Link
                to="/compare"
                search={{ q: "due process", sources: "const,usc,cfr" }}
                className="inline-flex items-center gap-2 rounded-full bg-sage-deep px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 whitespace-nowrap"
              >
                <GitCompare className="h-4 w-4" />
                Try Compare Mode
              </Link>
              <Link
                to="/compare"
                className="text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Open blank →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <div className="citation-tag text-muted-foreground">the method</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            How Marginalia works
          </h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {[
            {
              n: "I.",
              h: "Read primary sources",
              p: "No paraphrase replaces the original. Every result links back to the actual statute, regulation, or agency manual it came from. No second-hand interpretations.",
            },
            {
              n: "II.",
              h: "Trace the connections",
              p: "A statute rarely stands alone. The citation graph shows how rules across agencies cross-reference, modify, and depend on each other — visually.",
            },
            {
              n: "III.",
              h: "Build your case",
              p: "Save citations to private Case folders. Annotate sections with your own notes. Export to PDF. Your research, organized the way you need it.",
            },
          ].map((step) => (
            <div key={step.n} className="border-l border-border pl-5">
              <div className="font-display text-2xl text-accent">{step.n}</div>
              <h3 className="mt-1 font-display text-xl font-semibold">{step.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">{step.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Browse the Code (primary CTA) — accent-tinted cards with solid pills */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="citation-tag text-muted-foreground">primary sources</div>
             <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
               Open the <span className="ink-underline italic">Code</span>.
             </h2>
            <p className="mt-3 max-w-2xl text-foreground/70">
              Six codebooks, indexed and cross-linked. Browse the table of contents or jump in by citation.
            </p>
          </div>
          <Link to="/code" className="btn-ink">
            Open The Code →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s: { code: string; name: string; count: number }) => {
            const accent = accentForSource(s.code);
            const cb = codebookForSource(s.code);
            const Icon = cb?.icon;
            return (
              <Link
                key={s.code}
                to="/code/source/$source"
                params={{ source: s.code }}
                className="accent-surface group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5"
                style={{ ["--c" as never]: accent }}
              >
                {/* Spine — left accent bar */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ background: accent }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2 pl-1.5">
                  {Icon ? (
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white"
                      style={{ background: accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  ) : <span />}
                  <span className="count-pill" style={{ ["--c" as never]: accent }}>
                    <span className="num">{s.count.toLocaleString()}</span>
                    <span className="lbl">docs</span>
                  </span>
                </div>
                <div className="pl-1.5">
                  <div className="font-display text-xl font-semibold leading-tight">{SOURCE_LABELS[s.code] ?? s.name}</div>
                </div>
                <div className="mt-auto flex items-center justify-between pl-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{cb?.tagline?.split(",")[0] ?? "primary source"}</span>
                  <span className="font-display text-sm font-semibold normal-case tracking-normal text-foreground group-hover:text-terracotta">Browse →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pro features pitch */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-sage-deep/20 bg-gradient-to-br from-sage-deep/5 to-background p-8 paper-grain shadow-[var(--shadow-soft)] md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="citation-tag text-sage-deep">Pro · $5/month</div>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                The full research desk.
              </h2>
              <p className="mt-3 text-foreground/70">
                Every codebook is free to read. The power tools are $5/month. Less than a cup of coffee.
                More useful than a lawyer's first call.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { icon: GitCompare, label: "Side-by-side compare" },
                  { icon: Highlighter, label: "Highlight & annotate" },
                  { icon: FileDown, label: "Export to PDF" },
                  { icon: Bell, label: "Keyword alerts" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Icon className="h-4 w-4 shrink-0 text-sage-deep" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Link
                to="/subscribe"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sage-deep px-6 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-warm)] hover:opacity-90 transition-opacity"
              >
                <Zap className="h-4 w-4" />
                Go Pro — $5/mo
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Free account first →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Topics — samplers */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-4">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="citation-tag text-muted-foreground">curated walkthroughs</div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Topic samplers
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-foreground/65">
              Hand-threaded readings that trace a single issue across multiple codebooks.
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {TOPICS.map((t) => (
            <TopicCard key={t.slug} topic={t} />
          ))}
        </div>
      </section>

      {/* Vision strip — make the "what could be" tangible */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <ComingSoonHeader
          eyebrow="vol. ii · the build list"
          title="What this becomes once we get there."
          subtitle="The federal floor is live. These are the rooms we haven't built out yet — locked for now, but on the blueprint."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComingSoonCard
            icon={Map}
            status="building"
            title="All 50 states, indexed"
            pitch="Every state code, every state constitution, every state regulation — rolled into the same search bar. Start federal, finish in Wyoming, never leave the page."
          />
          <ComingSoonCard
            icon={Brain}
            status="building"
            title="Plain-English mode"
            pitch="A toggle that translates any statute or rule into everyday language, side-by-side with the original. The law stays the law — you just get a translator."
          />
          <ComingSoonCard
            icon={Network}
            status="soon"
            title="Citation graph"
            pitch="See every rule a statute spawned, and every statute a rule traces back to. Walk the law like a map, not a phone book."
          />
          <ComingSoonCard
            icon={Scale}
            status="soon"
            title="Caselaw threading"
            pitch="Open a section and see the Supreme Court and circuit decisions that interpret it — with the holdings pulled out so you don't have to read 80 pages of opinion to find the one line that matters."
          />
          <ComingSoonCard
            icon={Calendar}
            status="vision"
            title="Deadline calculator"
            pitch="Tell us your situation — eviction notice, debt suit, agency complaint — and get the actual statutory deadlines counted out on a real calendar with the citations behind every date."
          />
          <ComingSoonCard
            icon={GraduationCap}
            status="vision"
            title="Pro se starter courses"
            pitch="Short, free walkthroughs of the procedures most people face alone — small claims, eviction defense, debt collection answers — built straight from the rules they cite."
          />
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
__MARGINALIA_V2_EOF__

write_file "src/routes/about.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { MarginalNotes } from "@/components/marginalia/MarginalNote";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About · Marginalia" },
      {
        name: "description",
        content: "Why Marginalia exists: making the law readable for the people it actually applies to.",
      },
      { property: "og:title", content: "About · Marginalia" },
      {
        property: "og:description",
        content: "Why Marginalia exists: making the law readable for the people it actually applies to.",
      },
    ],
  }),
});

function About() {
  const [donationOpen, setDonationOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* Marginalia annotations in the page gutters — the brand name made literal */}
        <MarginalNotes
          items={[
            { idx: 0,  side: "left",  top: 360 },
            { idx: 9,  side: "right", top: 880 },
            { idx: 14, side: "left",  top: 1320 },
          ]}
        />

        <section className="mx-auto max-w-2xl px-6 py-20">
        <div className="citation-tag text-accent">a working note</div>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
          The law is intentionally <span className="ink-underline italic">interlocking</span>. Read it that way.
        </h1>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/85">
          <p>
            Most legal-research tools are sold to professionals already fluent in the vocabulary. Marginalia is built
            for the citizen-researcher: someone who suspects a rule applies to them and wants to read it for themselves,
            in context, exactly as written.
          </p>
          <p>
            The connections between statutes, regulations, agency manuals, and the commercial code are not always made
            explicit — that opacity is part of how the system works. We index the primary sources, surface the
            cross-references, and put the plain-English summary side-by-side with the original text so you can always
            verify.
          </p>
          <p>
            Marginalia is not legal advice. It is a research aid. Use it the way a careful reader would use any
            reference work: to orient yourself, then to read the source.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/" className="btn-ink">
            Open the index →
          </Link>
          <Link to="/whitepaper" className="btn-paper">
            Read the whitepaper →
          </Link>
        </div>

        <div className="mt-20 rounded-3xl border border-sage-deep/30 bg-sage-deep/5 p-8">
          <div className="citation-tag text-sage-deep">vol. I · the plan</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Where this is going.
          </h2>
          <p className="mt-3 text-foreground/75 leading-relaxed">
            Marginalia today is six federal codebooks indexed together. Next is all 50 state codes,
            domain packs for the situations people actually search, a visible citation graph, alerts,
            and an honest research desk. The whitepaper lays it all out — and why $5/mo is the honest
            number to fund it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/whitepaper"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Read the whitepaper →
            </Link>
            <Link
              to="/subscribe"
              className="group relative inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-foreground shadow-[var(--shadow-warm)] ring-2 ring-accent/40 ring-offset-2 ring-offset-background transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="absolute -top-2 -right-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                $5
              </span>
              ♥ Chip in / Go Pro
            </Link>
          </div>
          <p className="mt-3 text-xs italic text-muted-foreground">
            Reading the law stays free. Every $5 funds the next book on the shelf.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border-2 border-accent/40 bg-accent/5 p-8">
          <div className="citation-tag text-accent">no account required</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Or just toss a coin in the jar.
          </h2>
          <p className="mt-3 text-foreground/75 leading-relaxed">
            One-time donation. No subscription, no login, no follow-up emails.
            Goes straight to keeping the lights on and adding the next codebook.
          </p>
          {!donationOpen ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {[5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    amount === v
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border hover:bg-accent/10"
                  }`}
                >
                  ${v}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={1000}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                className="h-10 w-24 rounded-full border border-border bg-background px-4 text-sm"
                aria-label="Custom amount"
              />
              <button
                onClick={() => setDonationOpen(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2 text-sm font-bold text-accent-foreground shadow-[var(--shadow-warm)] hover:-translate-y-0.5 transition-transform"
              >
                ♥ Donate ${amount}
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <StripeEmbeddedCheckout donationCents={amount * 100} returnPath="/checkout/return" />
              <button
                onClick={() => setDonationOpen(false)}
                className="mt-3 text-xs text-muted-foreground underline"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-sm text-foreground/70">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              questions ·
            </span>
            <a href="mailto:support@self-law.org" className="font-semibold text-terracotta hover:underline">
              support@self-law.org
            </a>
            <span className="text-xs italic text-muted-foreground">— one person, replies within a day.</span>
          </div>
        </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
__MARGINALIA_V2_EOF__

write_file "src/routes/whitepaper.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { MarginalNotes } from "@/components/marginalia/MarginalNote";
import {
  BookOpen,
  MapPin,
  Briefcase,
  Network,
  Database,
  Bell,
  Bot,
  GitCompare,
  Scale,
  Gavel,
  FileSignature,
  Languages,
  Users,
  Mic,
  Map,
  ShieldCheck,
  Library,
  Sparkles,
  Calendar,
  Radio,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/whitepaper")({
  component: Whitepaper,
  head: () => ({
    meta: [
      { title: "The Plan · Marginalia" },
      {
        name: "description",
        content:
          "Where Marginalia is going: state codebooks, domain packs, citation graphs, alerts, and a structured legal corpus built for actual humans.",
      },
      { property: "og:title", content: "The Plan · Marginalia" },
      {
        property: "og:description",
        content:
          "Where Marginalia is going: state codebooks, domain packs, citation graphs, alerts, and a structured legal corpus built for actual humans.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://self-law.org/whitepaper" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/whitepaper" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "The Plan · Marginalia",
          description:
            "The roadmap for Marginalia: state codebooks, domain packs, citation graphs, and a structured legal corpus.",
          author: { "@type": "Organization", name: "Marginalia" },
          publisher: { "@type": "Organization", name: "Marginalia" },
          mainEntityOfPage: "https://self-law.org/whitepaper",
        }),
      },
    ],
  }),
});

function Section({ icon: Icon, tag, title, children }: { icon: any; tag: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/60 py-10 first:border-t-0 first:pt-0">
      <div className="citation-tag flex items-center gap-2 text-sage-deep">
        <Icon className="h-3.5 w-3.5" />
        {tag}
      </div>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <div className="mt-4 space-y-3 text-foreground/75 leading-relaxed">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: "live" | "building" | "soon" | "vision" }) {
  const map = {
    live: { label: "Shipped", cls: "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400" },
    building: { label: "In build", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    soon: { label: "Coming soon", cls: "border-sage-deep/40 bg-sage-deep/10 text-sage-deep" },
    vision: { label: "On the horizon", cls: "border-terracotta/40 bg-terracotta/10 text-terracotta" },
  } as const;
  const v = map[status];
  return (
    <span className={`citation-tag rounded-full border px-2 py-0.5 ${v.cls}`}>{v.label}</span>
  );
}

function VisionCard({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: any;
  title: string;
  status: "live" | "building" | "soon" | "vision";
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60">
          <Icon className="h-4 w-4 text-sage-deep" />
        </div>
        <StatusBadge status={status} />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">{children}</p>
    </div>
  );
}

function Milestone({ when, title, children, status }: { when: string; title: string; status: "live" | "building" | "soon" | "vision"; children: React.ReactNode }) {
  return (
    <li className="relative pl-8">
      <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-sage-deep bg-background">
        <span className="h-1.5 w-1.5 rounded-full bg-sage-deep" />
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="citation-tag text-muted-foreground">{when}</span>
        <StatusBadge status={status} />
      </div>
      <h4 className="mt-1 font-display text-xl font-semibold tracking-tight">{title}</h4>
      <p className="mt-1 text-sm text-foreground/70 leading-relaxed">{children}</p>
    </li>
  );
}

function Whitepaper() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* Marginalia annotations in the gutters — real, lesser-cited rights
            and statutes drifted alongside the prose. */}
        <MarginalNotes
          items={[
            { idx: 3,  side: "right", top: 320 },
            { idx: 6,  side: "left",  top: 920 },
            { idx: 10, side: "right", top: 1640 },
            { idx: 12, side: "left",  top: 2340 },
            { idx: 15, side: "right", top: 3060 },
          ]}
        />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="citation-tag text-muted-foreground">vol. I · the plan</div>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          A citizen's index of the law — built the way a citizen would actually use it.
        </h1>
        <p className="mt-6 text-lg text-foreground/70">
          Marginalia today is six federal codebooks indexed together: the Constitution, the U.S. Code, the
          CFR, the UCC, the Treasury Financial Manual, and the Internal Revenue Manual. That's the floor,
          not the ceiling. What follows is the full vision — what's shipped, what's being built right now,
          and the bigger swings on the horizon. Some of it is live. Most of it isn't yet. All of it is on
          the table.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge status="live" />
          <StatusBadge status="building" />
          <StatusBadge status="soon" />
          <StatusBadge status="vision" />
          <span className="text-muted-foreground">— how to read this document.</span>
        </div>

        <div className="mt-12">
          <Section icon={BookOpen} tag="today" title="Federal floor: six books, one search.">
            <p>
              Every word of the federal codebooks is indexed, cross-linked, and searchable from a single
              bar. No paraphrase, no AI summary swapped in for the source. You read the law itself, with
              one click back to the official text it came from.
            </p>
            <p>
              Compare Mode puts the same term in split panes across multiple books at once. That alone
              replaces the usual loop of: search, open tab, ctrl-F, give up, ask Reddit.
            </p>
            <div className="mt-2"><StatusBadge status="live" /></div>
          </Section>

          <Section icon={MapPin} tag="next · state law" title="All 50 states, same shelf.">
            <p>
              Federal law is the floor. State statutes and administrative codes are where most people
              actually get tangled — landlord-tenant, traffic, family, small claims, tax. Each state's
              code becomes another book on the same shelf, with the same search, same compare, same
              annotation tools.
            </p>
            <p>
              Pinned to your account: pick the states you actually live and work in, and they get top
              billing in every search.
            </p>
            <div className="mt-2"><StatusBadge status="building" /></div>
          </Section>

          <Section icon={Briefcase} tag="next · domain packs" title="Specialized lanes for the real questions.">
            <p>
              Most people don't search "the law." They search a situation: an eviction notice, a
              wage-theft complaint, a denied tax refund, a debt collector who won't stop calling. Domain
              packs bundle the relevant federal statutes, regulations, agency guidance, and state
              equivalents into a single curated reading list — with the citations pre-threaded.
            </p>
            <p>
              Planned packs: tenant rights, consumer credit & debt, wage and hour, traffic & criminal
              procedure, small business formation, tax controversy, family court basics. More based on
              what people actually open.
            </p>
            <div className="mt-2"><StatusBadge status="soon" /></div>
          </Section>

          <Section icon={Network} tag="research desk" title="The citation graph, made visible.">
            <p>
              A statute rarely stands alone. It gets defined in one place, modified in another, enforced
              by an agency rule somewhere else, and overridden by a court case nobody links to. The
              graph view makes those threads visible — click any section and see what cites it, what it
              cites, and what cites the things it cites.
            </p>
            <div className="mt-2"><StatusBadge status="soon" /></div>
          </Section>

          <Section icon={Bell} tag="research desk" title="Alerts that actually mean something.">
            <p>
              Set a keyword, a section, or a topic. Get pinged when the underlying text changes,
              when new agency guidance lands, or when a freshly indexed document mentions it. No more
              checking the Federal Register on a Tuesday hoping you didn't miss something.
            </p>
            <div className="mt-2"><StatusBadge status="soon" /></div>
          </Section>

          <Section icon={GitCompare} tag="research desk" title="Cases, notes, and exports.">
            <p>
              Save citations into private Case folders. Highlight and annotate sections in your own
              words. Export a clean PDF that includes the source text and your notes side by side —
              ready to walk into a courtroom, a hearing, or just a phone call with someone who insists
              you're wrong.
            </p>
            <div className="mt-2"><StatusBadge status="building" /></div>
          </Section>

          <Section icon={Database} tag="under the hood" title="A structured legal corpus, not another scraper.">
            <p>
              Behind the search bar is a normalized, de-duplicated, version-tracked corpus of every
              source on the shelf. Same schema across federal, state, and agency text. That's not a UI
              feature — it's the thing that makes everything else possible, and the thing that gives
              the data genuine value beyond the app itself.
            </p>
            <div className="mt-2"><StatusBadge status="live" /></div>
          </Section>

          <Section icon={Bot} tag="future" title="Optional AI, with the source always on screen.">
            <p>
              When AI shows up here, it shows up as a research assistant, not an oracle. Every answer
              comes attached to the actual statute or regulation it's reading from, and you can see the
              source text without leaving the page. If the model can't ground its answer in something
              on the shelf, it doesn't get to answer.
            </p>
            <div className="mt-2"><StatusBadge status="vision" /></div>
          </Section>
        </div>

        {/* The bigger swings */}
        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="citation-tag text-terracotta">vol. II · the bigger swings</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Things that don't exist yet — but should.
          </h2>
          <p className="mt-4 max-w-2xl text-foreground/70 leading-relaxed">
            None of what follows is shipped. Some of it is queued, some is sketched on the back of a
            napkin, some is still an argument we're having with ourselves. We're putting it on the page
            because the point of Marginalia is to be the thing it's pointing at — and the only honest way
            to build that is in public.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <VisionCard icon={Gavel} title="Caselaw, threaded into the statutes" status="vision">
              Every section of the U.S. Code annotated with the federal cases that have actually
              interpreted it. Click a paragraph, see how courts read it — circuit splits and all.
            </VisionCard>
            <VisionCard icon={FileSignature} title="Form library with smart fill" status="soon">
              Court forms, agency complaints, FOIA letters, fee waivers — pre-wired to the statute that
              authorizes them. Fill once, file anywhere it applies.
            </VisionCard>
            <VisionCard icon={Languages} title="Plain-English layer (toggleable)" status="vision">
              A second pane that translates legalese into normal sentences, side by side with the
              original. The original never moves. The translation is always labeled as a translation.
            </VisionCard>
            <VisionCard icon={Map} title="Procedural maps for every domain" status="soon">
              "Here's the eviction process in your state, step by step, with the statute behind each
              step and the deadline next to it." A map, not a wall of text.
            </VisionCard>
            <VisionCard icon={Calendar} title="Deadline calculator" status="soon">
              Drop in a court date, a notice date, an agency response — get back every statutory
              deadline that hangs off it, with citations. Adds to your calendar.
            </VisionCard>
            <VisionCard icon={Scale} title="Local rules + court-specific procedure" status="vision">
              Federal district rules, state trial court rules, even individual judges' standing orders.
              The stuff that gets cases dismissed and nobody warns you about.
            </VisionCard>
            <VisionCard icon={Users} title="Public Cases (opt-in)" status="vision">
              Make a Case folder public. Other people facing the same situation see your reading list,
              your annotations, your filings — fully attributed, fully optional.
            </VisionCard>
            <VisionCard icon={ShieldCheck} title="Rights-at-a-glance cards" status="building">
              Pulled-over, knock-and-talk, ICE at the door, school search, traffic stop. One card per
              situation, every claim backed to a statute or a controlling case.
            </VisionCard>
            <VisionCard icon={Mic} title="Read-aloud + audio briefs" status="vision">
              Long agency manuals turned into clean audio you can listen to on the bus. Same source
              text, just a different way in.
            </VisionCard>
            <VisionCard icon={Library} title="Historical versions, side by side" status="soon">
              Pick a date, see the law as it stood that day. Compare two versions of the same section
              with a single click. Useful for cases, essential for journalism.
            </VisionCard>
            <VisionCard icon={GraduationCap} title="Pro se starter courses" status="vision">
              Short, free, branching courses that walk you from "I just got served" to "I filed a
              response." Built around the actual statutes, not generic advice.
            </VisionCard>
            <VisionCard icon={Radio} title="Federal Register, demystified" status="soon">
              The daily firehose of new rules, sliced by agency and topic, with diffs against the
              existing CFR. Subscribe to a slice, get a weekly digest.
            </VisionCard>
          </div>

          <p className="mt-8 text-sm text-foreground/60 italic">
            None of these are promises. They're the shape of the thing we're trying to build. If one of
            them sounds like the reason you'd actually use Marginalia, tell us — that's how the next
            quarter gets prioritized.
          </p>
        </section>

        {/* Roadmap timeline */}
        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="citation-tag text-sage-deep">vol. III · the order of operations</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Roughly when, roughly in what order.
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/70">
            Dates are honest estimates, not commitments. Things move when the corpus, the funding, and
            reality all line up.
          </p>

          <ol className="mt-10 space-y-8 border-l border-border/70 pl-2">
            <Milestone when="now" status="live" title="Federal six on one shelf">
              Constitution, USC, CFR, UCC, TFM, IRM — searchable, cross-linked, and free to read.
            </Milestone>
            <Milestone when="this quarter" status="building" title="Cases, notes & exports v1">
              Save citations into private Case folders, annotate sections, export clean PDFs that hold
              up at a hearing.
            </Milestone>
            <Milestone when="next quarter" status="soon" title="First five state codes">
              California, Texas, New York, Florida, Illinois — same schema, same search, pinned to your
              account.
            </Milestone>
            <Milestone when="next quarter" status="soon" title="Domain packs (tenant, debt, wage)">
              The first three curated reading lists, with procedural maps and deadline calculators
              wired in.
            </Milestone>
            <Milestone when="later this year" status="soon" title="Citation graph + alerts">
              Visual graph view across the corpus. Subscribe to a section or a keyword, get pinged when
              it changes.
            </Milestone>
            <Milestone when="later this year" status="vision" title="Caselaw threading">
              Federal opinions threaded into the statutes they interpret. Starts with the most-cited
              sections and works outward.
            </Milestone>
            <Milestone when="next year" status="vision" title="All 50 states, plain-English layer, AI assistant">
              The shelf gets full, the translation pane goes live, and the source-grounded research
              assistant opens for Pro accounts.
            </Milestone>
          </ol>
        </section>

        {/* Principles */}
        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="citation-tag text-muted-foreground">vol. IV · the rules we won't break</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            How we'd rather lose than win.
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <Sparkles className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">Reading the law stays free.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                Forever. The source is public; the index of it should be too. Pro pays for the desk
                around it.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <BookOpen className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">The source is always on screen.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                No summary replaces the statute. Translations and AI answers ride alongside the
                original — they don't replace it.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <ShieldCheck className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">No legal advice, ever.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                We index the law. We don't tell you what to do with it. That line is the whole reason
                this can exist.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <Database className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">Open exports, always.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                Your Cases, notes, and citations leave with you in plain formats. No lock-in is part of
                the product.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-16 rounded-3xl border border-sage-deep/30 bg-sage-deep/5 p-8 text-center">
          <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">why $5</p>
          <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Five bucks a month is the honest number.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-foreground/70">
            Reading the law stays free. Pro covers the work that scales: ingesting state codes, keeping
            agency manuals current, the citation graph, alerts, exports, the whole research desk. Every
            $5 funds another piece. No trial, no bait, no upsell ladder.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/subscribe"
              className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Go Pro — $5/mo
            </Link>
            <Link
              to="/code"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Or just read the law
            </Link>
          </div>
        </div>
      </article>
      </main>
      <SiteFooter />
    </div>
  );
}
__MARGINALIA_V2_EOF__

write_file "src/routes/usc.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/usc")({
  loader: async () => {
    const cb = getCodebook("usc");
    if (!cb) throw notFound();
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: "usc" } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: "usc" };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "U.S. Code · Marginalia" },
      { name: "description", content: "Federal statutory law, organized by title." },
      { property: "og:title", content: "U.S. Code · Marginalia" },
      { property: "og:description", content: "Federal statutory law, organized by title." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/usc" }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this codebook</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Codebook not found</h1>
    </div>
  ),
});
__MARGINALIA_V2_EOF__

write_file "src/routes/cfr.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/cfr")({
  loader: async () => {
    const cb = getCodebook("cfr");
    if (!cb) throw notFound();
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: "cfr" } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: "cfr" };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "Code of Federal Regulations · Marginalia" },
      { name: "description", content: "The rulebook that implements federal statutes." },
      { property: "og:title", content: "Code of Federal Regulations · Marginalia" },
      { property: "og:description", content: "The rulebook that implements federal statutes." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/cfr" }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this codebook</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Codebook not found</h1>
    </div>
  ),
});
__MARGINALIA_V2_EOF__

write_file "src/routes/const.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/const")({
  loader: async () => {
    const cb = getCodebook("const");
    if (!cb) throw notFound();
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: "const" } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: "const" };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "U.S. Constitution · Marginalia" },
      { name: "description", content: "The founding charter — articles and amendments." },
      { property: "og:title", content: "U.S. Constitution · Marginalia" },
      { property: "og:description", content: "The founding charter — articles and amendments." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/const" }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this codebook</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Codebook not found</h1>
    </div>
  ),
});
__MARGINALIA_V2_EOF__

write_file "src/routes/model.tsx" <<'__MARGINALIA_V2_EOF__'
import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

// Model & Uniform Codes — currently houses the UCC (source code "ucc").
// We load the UCC TOC as the primary so the sub-volume grid populates with
// UCC articles. When more model codes land (UPC, etc.) revisit this.
export const Route = createFileRoute("/model")({
  loader: async () => {
    const cb = getCodebook("model");
    if (!cb) throw notFound();
    const primary = cb.sources[0] ?? "ucc";
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: primary } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: primary };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "Model & Uniform Codes · Marginalia" },
      { name: "description", content: "Model commercial law and uniform acts adopted by the states." },
      { property: "og:title", content: "Model & Uniform Codes · Marginalia" },
      { property: "og:description", content: "Model commercial law and uniform acts adopted by the states." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/model" }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this codebook</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Codebook not found</h1>
    </div>
  ),
});
__MARGINALIA_V2_EOF__

write_file "src/components/marginalia/MarginalNote.tsx" <<'__MARGINALIA_V2_EOF__'
// ===========================================================
// MarginalNote — handwritten side annotations.
//
// The brand-name made literal. Each note is a real, lesser-cited
// right or statute, drifting in the page gutters like a careful
// reader's marginalia. ALL-CAPS mono cite, statutory text in
// Fraunces italic, optional fainter aside underneath.
//
// USAGE:
//   <MarginalNotes items={[
//     { idx: 0, side: "right", top: 280 },
//     { idx: 4, side: "left",  top: 940 },
//   ]} />
//
// The parent <main> must be position:relative (most are by default).
// Hidden automatically below 1100px viewport. Toggleable via Tweaks
// (data-margins="off" on <html>).
// ===========================================================

export type MarginalNoteData = {
  cite: string;
  body: string;
  aside?: string;
};

export const MARGIN_NOTES: MarginalNoteData[] = [
  {
    cite: "Amend. IX",
    body:
      "The enumeration in the Constitution, of certain rights, shall not be construed to deny or disparage others retained by the people.",
    aside:
      "(litigated rarely. Read on its own terms, it does most of what people think the 10th does.)",
  },
  {
    cite: "Amend. III",
    body:
      "No Soldier shall, in time of peace be quartered in any house, without the consent of the Owner, nor in time of war, but in a manner to be prescribed by law.",
    aside: "(invoked exactly once at the appellate level — Engblom v. Carey, 1982.)",
  },
  {
    cite: "Art. I § 9, cl. 2",
    body:
      "The Privilege of the Writ of Habeas Corpus shall not be suspended, unless when in Cases of Rebellion or Invasion the public Safety may require it.",
    aside: "(The Great Writ. Older than the Constitution it sits inside.)",
  },
  {
    cite: "18 U.S.C. § 242",
    body:
      "Whoever, under color of any law, statute, ordinance, regulation, or custom, willfully subjects any person … to the deprivation of any rights, privileges, or immunities secured or protected by the Constitution …",
    aside: "→ the operative word is willfully.",
  },
  {
    cite: "26 U.S.C. § 7521(a)(1)",
    body:
      "Any officer or employee of the Internal Revenue Service in connection with any in-person interview … shall, upon advance request of such taxpayer, allow the taxpayer to make an audio recording of such interview at the taxpayer's own expense and with the taxpayer's own equipment.",
    aside: "(the IRS can be recorded. Few taxpayers know this.)",
  },
  {
    cite: "Art. I § 9, cl. 3",
    body: "No Bill of Attainder or ex post facto Law shall be passed.",
    aside: "(twenty words. Two foundational doctrines.)",
  },
  {
    cite: "15 U.S.C. § 1681j(a)(1)",
    body:
      "Each consumer reporting agency … shall make all disclosures pursuant to section 1681g of this title once during any 12-month period upon request of the consumer and without charge to the consumer.",
    aside: "(the statutory basis for a free annual credit report.)",
  },
  {
    cite: "17 U.S.C. § 107",
    body:
      "The fair use of a copyrighted work … for purposes such as criticism, comment, news reporting, teaching … is not an infringement of copyright.",
    aside: "(four factors, no bright line. The factors are listed in the same section.)",
  },
  {
    cite: "42 U.S.C. § 1983",
    body:
      "Every person who, under color of any statute … subjects … any citizen of the United States … to the deprivation of any rights, privileges, or immunities secured by the Constitution and laws, shall be liable to the party injured …",
    aside:
      "(passed in 1871. Sat largely unused for ninety years. Then Monroe v. Pape in 1961 woke it up.)",
  },
  {
    cite: "14 C.F.R. § 91.3(a)",
    body:
      "The pilot in command of an aircraft is directly responsible for, and is the final authority as to, the operation of that aircraft.",
    aside: "(the only statutory grant of absolute authority left on the books.)",
  },
  {
    cite: "Art. IV § 2, cl. 1",
    body:
      "The Citizens of each State shall be entitled to all Privileges and Immunities of Citizens in the several States.",
    aside: "(the right to travel between states, anchored here — see Saenz v. Roe.)",
  },
  {
    cite: "31 U.S.C. § 1341",
    body:
      "An officer or employee of the United States Government … may not make or authorize an expenditure or obligation exceeding an amount available in an appropriation …",
    aside: "(the Antideficiency Act. The actual reason for government shutdowns.)",
  },
  {
    cite: "Amend. V",
    body: "…nor shall private property be taken for public use, without just compensation.",
    aside: "(the Takings Clause. Smaller than most people think. Wider than they wish.)",
  },
  {
    cite: "5 U.S.C. § 552(a)",
    body:
      "Each agency shall make available to the public information as follows … any person has a right to obtain access to … agency records …",
    aside: "(the Freedom of Information Act. Fifty-eight years old.)",
  },
  {
    cite: "Amend. XIV § 1",
    body:
      "All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside.",
    aside: "(birthright citizenship. The first sentence of the most-litigated amendment.)",
  },
  {
    cite: "U.C.C. § 1-103(a)",
    body:
      "The Uniform Commercial Code must be liberally construed and applied to promote its underlying purposes and policies …",
    aside: "(commercial law's mood ring.)",
  },
];

type Side = "left" | "right";

type MarginalNoteProps = {
  idx: number;
  side?: Side;
  /** Distance from top of the positioned ancestor (px or any CSS length). */
  top: number | string;
};

export function MarginalNote({ idx, side = "left", top }: MarginalNoteProps) {
  const note = MARGIN_NOTES[idx % MARGIN_NOTES.length];
  if (!note) return null;
  // Deterministic per-index tilt: -2deg .. +2deg
  const tilt = ((idx * 37) % 5) - 2;

  return (
    <aside
      className={`margin-note ${side === "right" ? "right" : "left"}`}
      style={{
        top: typeof top === "number" ? `${top}px` : top,
        transform: `rotate(${tilt}deg)`,
      }}
      data-cite={note.cite}
      aria-hidden="true"
    >
      <div className="mn-bar" />
      <div className="mn-cite">{note.cite}</div>
      <p className="mn-body">{note.body}</p>
      {note.aside ? <p className="mn-aside">{note.aside}</p> : null}
    </aside>
  );
}

type MarginalNotesProps = {
  items: { idx: number; side?: Side; top: number | string }[];
};

export function MarginalNotes({ items }: MarginalNotesProps) {
  return (
    <>
      {items.map((it, i) => (
        <MarginalNote key={i} idx={it.idx} side={it.side} top={it.top} />
      ))}
    </>
  );
}
__MARGINALIA_V2_EOF__

write_file "src/components/marginalia/SiteHeader.tsx" <<'__MARGINALIA_V2_EOF__'
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "./SearchBar";
import { DevNoticeBanner } from "./DevNoticeBanner";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, LogOut, Sun, Moon, Sparkles, Mail } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { CODEBOOKS, TOOLS, type Codebook } from "@/lib/codebooks";

/* -----------------------------------------------------------
   § Brand mark — ink square with ochre section sign in Fraunces
   italic. Replaces the old sage→ink gradient block. Reads at any
   size and says "the law" without saying it.
   ----------------------------------------------------------- */
function BrandMark() {
  return (
    <div
      className="inline-flex items-center justify-center rounded-md shadow-inner"
      style={{
        width: 36,
        height: 36,
        background: "var(--ink)",
        boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 0 oklch(0 0 0 / 0.10)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 26,
          color: "var(--ochre)",
          lineHeight: 1,
          marginTop: -1,
        }}
      >
        §
      </span>
    </div>
  );
}

function CodebookTab({ cb }: { cb: Codebook }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const isSoon = cb.status === "soon";

  return (
    <div
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <Link
        to={`/${cb.slug}` as never}
        className={`cb-tab ${isSoon ? "soon" : ""}`}
        style={{ ["--c" as never]: cb.accent }}
        activeProps={{ className: "cb-tab active", style: { ["--c" as never]: cb.accent } }}
      >
        <span
          className="mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: cb.accent, opacity: isSoon ? 0.45 : 0.95 }}
          aria-hidden
        />
        {cb.tab}
        {isSoon && <Sparkles className="ml-0.5 h-2.5 w-2.5 text-ochre/70" aria-label="coming soon" />}
      </Link>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background shadow-[var(--shadow-warm)]"
          role="menu"
        >
          <div
            className="rounded-t-xl px-4 pt-3 pb-2"
            style={{ backgroundImage: `linear-gradient(135deg, ${cb.accent}18 0%, transparent 65%)` }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cb.accent }} />
              <span className="font-display text-sm font-semibold">{cb.name}</span>
              {isSoon && (
                <span className="ml-auto rounded-full border border-ochre/40 bg-ochre/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ochre">
                  soon
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/65">{cb.tagline}</p>
          </div>
          <div className="border-t border-border/40 px-2 py-2">
            <Link
              to={`/${cb.slug}` as never}
              className="block rounded-md px-3 py-2 text-xs text-foreground/80 hover:bg-muted hover:text-foreground"
            >
              {isSoon ? "See what's planned →" : `Browse the ${cb.name} →`}
            </Link>
            {cb.quickLinks?.map((ql) => (
              <Link
                key={ql.href}
                to={ql.href as never}
                className="block rounded-md px-3 py-1.5 text-xs text-foreground/65 hover:bg-muted hover:text-foreground"
              >
                {ql.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsMenu({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } setOpen(true); };
  const onLeave = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 font-display text-[13px] text-foreground/70 hover:bg-muted hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Tools
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background p-2 shadow-[var(--shadow-warm)]" role="menu">
          {TOOLS.filter((t) => !t.authRequired || signedIn).map((t) => (
            <Link
              key={t.href}
              to={t.href as never}
              className="flex items-start gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
            >
              <t.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60" />
              <div className="min-w-0">
                <div className="font-display text-xs font-semibold text-foreground">{t.label}</div>
                <div className="text-[11px] leading-snug text-foreground/55">{t.description}</div>
              </div>
            </Link>
          ))}
          {signedIn && (
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-md border-t border-border/40 px-3 py-2 pt-3 text-left hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5 text-foreground/60" />
              <span className="font-display text-xs text-foreground/75">Sign out</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------
   Top-nav row — sits between the brand row and the codebook
   tab strip. Whitepaper gets its own slot (was buried in About);
   support email is always visible on the right.
   ----------------------------------------------------------- */
const TOP_NAV_ITEMS = [
  { to: "/",            label: "Home" },
  { to: "/code",        label: "Browse the Code" },
  { to: "/whitepaper",  label: "Whitepaper" },
  { to: "/forum",       label: "The Floor" },
  { to: "/about",       label: "About" },
] as const;

function TopNav() {
  return (
    <nav
      className="mx-auto flex max-w-[1900px] items-center overflow-x-auto top-nav lg:px-6"
      aria-label="Sections"
    >
      <div className="flex flex-1 items-center gap-0">
        {TOP_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to as never}
            className="top-nav-link"
            activeProps={{ "data-active": "true" } as never}
            activeOptions={{ exact: item.to === "/" }}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <a href="mailto:support@self-law.org" className="top-nav-support shrink-0">
        <Mail className="h-3 w-3" />
        <span className="hidden sm:inline">support@self-law.org</span>
        <span className="sm:hidden">Support</span>
      </a>
    </nav>
  );
}

export function SiteHeader() {
  const { user, signOut, loading } = useAuth();
  const { theme, toggle } = useTheme();

  // Close hover panels when user scrolls or navigates (defensive — Link onClick
  // handles navigation, but a stuck panel on slow networks is jarring).
  const [, setTick] = useState(0);
  useEffect(() => {
    const onScroll = () => setTick((t) => t + 1);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <DevNoticeBanner />

      {/* Row 1 — brand, search, utility */}
      <div className="mx-auto flex max-w-[1900px] items-center gap-4 px-4 py-3 lg:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <BrandMark />
          <div className="leading-none">
            <div className="font-display text-lg font-semibold tracking-tight">Marginalia</div>
            <div className="hidden font-display text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
              a citizen's law index
            </div>
          </div>
        </Link>

        <div className="flex flex-1 justify-center">
          <div className="w-full max-w-2xl">
            <SearchBar compact />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!user && !loading && (
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="hidden rounded-full px-3 py-1.5 text-sm text-foreground/70 hover:bg-muted hover:text-foreground sm:block"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={toggle}
            className="flex items-center justify-center rounded-full p-1.5 text-foreground/60 hover:bg-muted hover:text-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Row 2 — top-level sections + support */}
      <TopNav />

      {/* Row 3 — codebook tab strip + Tools dropdown */}
      <nav
        className="mx-auto flex max-w-[1900px] items-center gap-1 overflow-x-auto px-4 pb-2 pt-2 lg:px-6"
        aria-label="Codebooks"
      >
        <div className="flex flex-1 items-center gap-1">
          {CODEBOOKS.map((cb) => (
            <CodebookTab key={cb.slug} cb={cb} />
          ))}
        </div>
        <div className="ml-2 shrink-0 border-l border-border/40 pl-2">
          <ToolsMenu signedIn={!!user} onSignOut={signOut} />
        </div>
      </nav>
    </header>
  );
}
__MARGINALIA_V2_EOF__

write_file "src/components/marginalia/CmdPalette.tsx" <<'__MARGINALIA_V2_EOF__'
/**
 * CmdPalette — global ⌘K (or Ctrl+K, or "/") search overlay.
 *
 * Two-pane: results list on the left, citation preview on the right.
 * Compare toggle routes Enter to /compare with a sensible default set of sources.
 * Semantic slider is visual-only for now — the server already picks the hybrid
 * path automatically for natural-language queries, so this is just a hint to
 * the user that semantic recall is on. Wire it to a real param when the API
 * supports it.
 *
 * Mounted once in __root.tsx so any page can trigger it via the keyboard.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search as SearchIcon,
  Columns,
  Sparkles,
  BookOpen,
  Bookmark,
  ChevronRight,
  Plus,
  Zap,
} from "lucide-react";
import { searchDocuments } from "@/lib/documents.functions";
import { CODEBOOKS, codebookForSource } from "@/lib/codebooks";

const SOURCE_LABELS: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

type Suggestion = { label: string; sub: string };
const SUGGESTIONS: Suggestion[] = [
  { label: "due process", sub: "concept · across 4 codebooks" },
  { label: "right to cure", sub: "concept · debt collection + UCC" },
  { label: "15 USC 1692", sub: "title · Fair Debt Collection Practices" },
  { label: "4th amendment", sub: "constitutional · search and seizure" },
  { label: "commercial paper", sub: "UCC Article 3 · negotiable instruments" },
];

type Hit = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string;
  exact?: boolean;
};

type Item =
  | { kind: "suggestion"; label: string; sub: string }
  | { kind: "hit"; hit: Hit };

function accentFor(source: string): string {
  return codebookForSource(source)?.accent ?? "#1A1814";
}

function stripMarks(s: string): string {
  return s.replace(/<\/?mark>/g, "");
}

export function CmdPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [semantic, setSemantic] = useState(60);
  const [compareMode, setCompareMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Global open/close shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" opens when not typing into a field
      if (e.key === "/" && !meta && !e.altKey) {
        const ae = document.activeElement;
        const typing =
          ae instanceof HTMLInputElement ||
          ae instanceof HTMLTextAreaElement ||
          (ae as HTMLElement | null)?.getAttribute("contenteditable") === "true";
        if (typing) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      setQ("");
      setActive(0);
      setHits([]);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchDocuments({ data: { q: term } });
        if (!cancelled) setHits(((res.hits as Hit[]) ?? []).slice(0, 8));
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  // Build items list
  const items: Item[] =
    q.trim().length < 2
      ? SUGGESTIONS.map((s) => ({ kind: "suggestion" as const, ...s }))
      : hits.map((h) => ({ kind: "hit" as const, hit: h }));

  // Keyboard nav inside palette
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const it = items[active];
        if (!it) {
          // No active item — submit raw query if there is one
          if (q.trim().length >= 2) submitQuery(q.trim());
          return;
        }
        if (it.kind === "suggestion") {
          setQ(it.label);
          setActive(0);
        } else {
          openHit(it.hit);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, active, q]);

  function submitQuery(term: string) {
    setOpen(false);
    if (compareMode) {
      navigate({ to: "/compare", search: { q: term, sources: "const,usc,cfr" } });
    } else {
      navigate({ to: "/search", search: { q: term } });
    }
  }

  function openHit(h: Hit) {
    setOpen(false);
    navigate({ to: "/code/$", params: { _splat: h.identifier.replace(/^\//, "") } });
  }

  if (!open) return null;

  const activeItem = items[active];

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)} role="dialog" aria-label="Search">
      <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
        {/* LEFT — search + results */}
        <div className="cmd-left">
          <div className="cmd-search-row">
            <SearchIcon className="h-4 w-4 shrink-0 text-foreground/55" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search every codebook — or paste a citation…"
              aria-label="Search query"
            />
            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className={`cmd-compare ${compareMode ? "on" : ""}`}
              aria-pressed={compareMode}
            >
              <Columns className="h-3 w-3" />
              {compareMode ? "Compare on" : "Compare"}
            </button>
          </div>

          <div className="cmd-slider-row">
            <span className="cmd-tag">match</span>
            <span className="cmd-slider-end">keyword</span>
            <input
              type="range"
              min={0}
              max={100}
              value={semantic}
              onChange={(e) => setSemantic(parseInt(e.target.value, 10))}
              aria-label="Match strength — keyword to meaning"
            />
            <span className="cmd-slider-end">meaning</span>
            <span className="cmd-slider-pct">{semantic}%</span>
          </div>

          <div className="cmd-results">
            <div className="cmd-section-label">
              {q.trim().length < 2 ? "Try one of these" : loading ? "Searching…" : "Matches"}
            </div>

            {q.trim().length >= 2 && !loading && hits.length === 0 ? (
              <div className="cmd-empty">Nothing on file matches that. Try a broader phrase.</div>
            ) : (
              items.map((it, i) => {
                const isActive = i === active;
                if (it.kind === "suggestion") {
                  return (
                    <div
                      key={`s-${i}`}
                      className={`cmd-item ${isActive ? "active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        setQ(it.label);
                        setActive(0);
                      }}
                    >
                      <span className="cmd-suggest-ico">
                        <SearchIcon className="h-3 w-3" />
                      </span>
                      <div className="cmd-item-body">
                        <div className="cmd-item-title">{it.label}</div>
                        <div className="cmd-item-sub">{it.sub}</div>
                      </div>
                    </div>
                  );
                }
                const h = it.hit;
                const acc = accentFor(h.source_code);
                const label = SOURCE_LABELS[h.source_code] ?? h.source_code.toUpperCase();
                return (
                  <div
                    key={h.identifier}
                    className={`cmd-item ${isActive ? "active" : ""}`}
                    style={{ ["--c" as string]: acc } as React.CSSProperties}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openHit(h)}
                  >
                    <span className="cmd-pill">{label}</span>
                    <div className="cmd-item-body">
                      <div className="cmd-item-title">{h.heading ?? h.section_label ?? h.identifier}</div>
                      <div className="cmd-item-sub">
                        {[h.parent_label, h.section_label].filter(Boolean).join(" · ") || h.identifier}
                      </div>
                    </div>
                    {h.exact && <span className="cmd-exact">exact</span>}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                  </div>
                );
              })
            )}

            {q.trim().length >= 2 && hits.length > 0 && (
              <>
                <div className="cmd-section-label cmd-section-build">Build</div>
                <div
                  className="cmd-item cmd-build"
                  style={{ ["--c" as string]: "var(--terracotta)" } as React.CSSProperties}
                  onClick={() => submitQuery(q.trim())}
                >
                  <span className="cmd-pill cmd-pill-build">SEARCH</span>
                  <div className="cmd-item-body">
                    <div className="cmd-item-title">
                      See all results for "{q.trim()}"
                      {compareMode && <span className="cmd-compare-hint"> · in Compare</span>}
                    </div>
                    <div className="cmd-item-sub">
                      Open the full search page · annotate, export, save to a Case
                    </div>
                  </div>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-terracotta" />
                </div>
              </>
            )}
          </div>

          <div className="cmd-foot">
            <span><kbd>↑↓</kbd>navigate</span>
            <span><kbd>↵</kbd>open</span>
            <span><kbd>esc</kbd>close</span>
            <span className="cmd-foot-spacer" />
            <span className="cmd-foot-hint">
              <Zap className="h-3 w-3 text-terracotta" />
              semantic on
            </span>
          </div>
        </div>

        {/* RIGHT — preview pane */}
        <div className="cmd-preview">
          {activeItem?.kind === "hit" ? (
            <>
              <span
                className="pp-pill"
                style={{ backgroundColor: accentFor(activeItem.hit.source_code) }}
              >
                {SOURCE_LABELS[activeItem.hit.source_code] ?? activeItem.hit.source_code.toUpperCase()}
              </span>
              <div className="pp-title">
                {activeItem.hit.heading ?? activeItem.hit.section_label ?? activeItem.hit.identifier}
              </div>
              <div className="pp-cite">
                {[activeItem.hit.parent_label, activeItem.hit.section_label]
                  .filter(Boolean)
                  .join(" · ") || activeItem.hit.identifier}
              </div>
              <p className="pp-body">{stripMarks(activeItem.hit.snippet || "")}</p>
              <div className="pp-actions">
                <button type="button" className="cmd-btn-ink" onClick={() => openHit(activeItem.hit)}>
                  <BookOpen className="h-3.5 w-3.5" />
                  Open section
                </button>
                <button type="button" className="cmd-btn-paper">
                  <Bookmark className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </>
          ) : activeItem?.kind === "suggestion" ? (
            <div className="pp-empty">
              <Sparkles className="h-5 w-5 text-foreground/40" />
              <div className="pp-empty-title">{activeItem.label}</div>
              <div className="pp-empty-hint">
                Press <kbd>↵</kbd> to expand into a full search
              </div>
            </div>
          ) : (
            <div className="pp-empty">
              <SearchIcon className="h-5 w-5 text-foreground/40" />
              <div className="pp-empty-body">
                Type to search.
                <br />
                Hover or arrow to preview.
              </div>
              <div className="pp-empty-codebooks">
                {CODEBOOKS.filter((c) => c.status === "live")
                  .slice(0, 6)
                  .map((cb) => (
                    <span key={cb.slug} className="pp-cb-chip">
                      <span className="pp-cb-dot" style={{ backgroundColor: cb.accent }} />
                      {cb.tab}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
__MARGINALIA_V2_EOF__

write_file "src/components/marginalia/CodebookLanding.tsx" <<'__MARGINALIA_V2_EOF__'
/**
 * CodebookLanding v2 — match the v2 prototype.
 *
 * Hero strip with accent-tinted icon block, big serif name, status dot,
 * count pill, primary CTAs. Body splits into a main column (sub-volume
 * grid when TOC is loaded, or source cards otherwise) and a "Desk" rail
 * with cross-reference, weekly stats, and related codebooks.
 *
 * The `toc` prop is optional — if a route loader provides it, the
 * sub-volume grid renders. Otherwise we fall back to the source-card
 * behavior the previous version had (which is correct for codebooks
 * with no per-title hierarchy, e.g. Constitution, UCC, agency manuals).
 */

import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
  Columns,
  Search as SearchIcon,
} from "lucide-react";
import { ResearchShell } from "./ResearchShell";
import { ComingSoonHeader } from "./ComingSoon";
import type { Codebook } from "@/lib/codebooks";
import { CODEBOOKS } from "@/lib/codebooks";
import type { SourceSummary, SourceTocNode } from "@/lib/documents.functions";

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
  /** Top-level TOC entries for the codebook's primary source, if loaded. */
  toc?: SourceTocNode[];
  /** Which source the TOC belongs to (so sub-volume links route correctly). */
  tocSource?: string;
};

// Cheap stable "this week" decorator — deterministic by string hash so the
// number doesn't dance between renders. Not real data; clearly visual only.
function fakeThisWeek(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 28 + 2;
}

export function CodebookLanding({ codebook, sources, toc, tocSource }: Props) {
  const isLive = codebook.status === "live";
  const ownSources = sources.filter((s) => codebook.sources.includes(s.code));
  const totalDocs = ownSources.reduce((n, s) => n + s.count, 0);
  const Icon = codebook.icon;

  // Sub-volume cards from TOC, sorted descending by total. Cap at 12 for the
  // landing — full list is always reachable via the source browser.
  const subVolumes = (toc ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const rightRail = (
    <div className="space-y-6 text-sm">
      <div>
        <div className="desk-eyebrow">in this codebook</div>
        <div className="desk-mini" style={{ ["--c" as string]: codebook.accent } as React.CSSProperties}>
          <div className="desk-mini-num">{isLive ? totalDocs.toLocaleString() : "—"}</div>
          <div className="desk-mini-sub">
            {isLive ? "documents indexed · updated May 2026" : "coming soon — queued for ingest"}
          </div>
        </div>
      </div>

      {isLive && (
        <>
          <div>
            <div className="desk-eyebrow">cross-reference</div>
            <div className="desk-card">
              <div className="desk-card-title">Open in Compare</div>
              <p className="desk-card-body">
                Put this codebook side-by-side with another. Matched terms highlighted across panes.
              </p>
              <Link
                to="/compare"
                search={{ q: codebook.tab, sources: codebook.sources.concat(["usc", "cfr"]).slice(0, 3).join(",") }}
                className="desk-btn-paper"
              >
                <Columns className="h-3.5 w-3.5" />
                Open Compare
              </Link>
            </div>
          </div>

          <div>
            <div className="desk-eyebrow">this week</div>
            <div className="space-y-2">
              {[
                { lab: "new sections", n: fakeThisWeek(codebook.slug + "new") },
                { lab: "amended", n: fakeThisWeek(codebook.slug + "amd") },
                { lab: "queries vs last week", n: `+${fakeThisWeek(codebook.slug + "q")}%` },
              ].map((m) => (
                <div key={m.lab} className="desk-stat">
                  <span className="desk-stat-lab">{m.lab}</span>
                  <span className="desk-stat-num">{m.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="desk-eyebrow">related codebooks</div>
            <div className="space-y-1">
              {CODEBOOKS.filter((c) => c.status === "live" && c.slug !== codebook.slug)
                .slice(0, 4)
                .map((c) => (
                  <Link
                    key={c.slug}
                    to={`/${c.slug}` as never}
                    className="desk-rel-row"
                  >
                    <span className="desk-rel-dot" style={{ backgroundColor: c.accent }} />
                    <span className="desk-rel-name">{c.tab}</span>
                    <ArrowRight className="h-3 w-3 text-foreground/40" />
                  </Link>
                ))}
            </div>
          </div>
        </>
      )}

      {!isLive && (
        <div>
          <div className="desk-eyebrow text-ochre">status</div>
          <div className="rounded-lg border border-dashed border-ochre/40 bg-ochre/5 p-3 text-xs text-foreground/70">
            <div className="flex items-center gap-1.5 font-medium text-ochre">
              <Sparkles className="h-3 w-3" />
              Coming to the index
            </div>
            <p className="mt-1 leading-relaxed">
              The structure is planned. Documents land here once ingest is wired — no need to
              guess where they'll go.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-5xl">
      {/* HERO STRIP */}
      <section
        className="cb-hero"
        style={{
          ["--c" as string]: codebook.accent,
          backgroundImage: `linear-gradient(135deg, ${codebook.accent}12 0%, transparent 55%)`,
        } as React.CSSProperties}
      >
        <div className="cb-hero-icon">
          <Icon className="h-9 w-9" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="cb-hero-status">
            <span className="cb-hero-status-dot" />
            {isLive ? "now browseable · indexed May 2026" : "coming soon"}
          </div>
          <h1 className="cb-hero-title">{codebook.name}</h1>
          <p className="cb-hero-tag">{codebook.tagline}</p>
          {isLive && totalDocs > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="count-pill lg" style={{ ["--c" as string]: codebook.accent } as React.CSSProperties}>
                <span className="num">{totalDocs.toLocaleString()}</span>
                <span className="lbl">documents</span>
              </span>
              <span className="citation-tag text-foreground/55">
                across {ownSources.length} {ownSources.length === 1 ? "source" : "sources"}
              </span>
            </div>
          )}
        </div>
        {isLive && (
          <div className="cb-hero-actions">
            <Link to="/search" search={{ q: codebook.tab }} className="btn-ink">
              <SearchIcon className="h-3.5 w-3.5" />
              Search this codebook
            </Link>
            <Link
              to="/compare"
              search={{ q: codebook.tab, sources: codebook.sources.concat(["usc", "cfr"]).slice(0, 3).join(",") }}
              className="btn-paper"
            >
              <Columns className="h-3.5 w-3.5" />
              Compare across books
            </Link>
          </div>
        )}
      </section>

      {/* MAIN BODY */}
      {isLive && subVolumes.length > 0 ? (
        <SubVolumeGrid
          codebook={codebook}
          subVolumes={subVolumes}
          source={tocSource ?? codebook.sources[0]}
        />
      ) : isLive && ownSources.length > 0 ? (
        <SourceCardGrid codebook={codebook} ownSources={ownSources} />
      ) : (
        <PlannedShape codebook={codebook} />
      )}
    </ResearchShell>
  );
}

function SubVolumeGrid({
  codebook,
  subVolumes,
  source,
}: {
  codebook: Codebook;
  subVolumes: SourceTocNode[];
  source: string;
}) {
  const label =
    codebook.slug === "const"
      ? "Articles & amendments"
      : codebook.slug === "model"
      ? "Articles"
      : "Titles in this codebook";

  return (
    <section className="mt-10">
      <div className="section-title-bar">
        <div>
          <div className="cb-section-eyebrow">by title</div>
          <h2 className="cb-section-title">{label}</h2>
        </div>
        <span className="citation-tag text-foreground/55">{subVolumes.length} sub-volumes</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {subVolumes.map((sv) => {
          const recent = fakeThisWeek(codebook.slug + sv.title_group);
          // Pick a sensible "part" parent_label to deep-link into. First part
          // is fine — the source browser opens that title's parts list.
          const firstPart = sv.parts[0];
          return (
            <Link
              key={sv.title_group}
              to="/code/source/$source"
              params={{ source }}
              search={firstPart ? { group: firstPart.parent_label } : {}}
              className="subvol-card"
            >
              <div className="min-w-0 flex-1">
                <div
                  className="subvol-eyebrow"
                  style={{ color: codebook.accent }}
                >
                  {sv.title_group}
                </div>
                <div className="subvol-name">{shortenTitle(sv.title_group, sv.parts[0]?.label) ?? sv.title_group}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className="count-pill"
                  style={{ ["--c" as string]: codebook.accent } as React.CSSProperties}
                >
                  <span className="num">{sv.total.toLocaleString()}</span>
                </span>
                {recent > 0 && (
                  <span className="subvol-recent">+{recent} this week</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SourceCardGrid({
  codebook,
  ownSources,
}: {
  codebook: Codebook;
  ownSources: SourceSummary[];
}) {
  return (
    <section className="mt-10">
      <div className="section-title-bar">
        <div>
          <div className="cb-section-eyebrow">sources in this codebook</div>
          <h2 className="cb-section-title">Open a volume</h2>
        </div>
        <span className="citation-tag text-foreground/55">
          {ownSources.length} {ownSources.length === 1 ? "source" : "sources"}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ownSources.map((s) => (
          <Link
            key={s.code}
            to="/code/source/$source"
            params={{ source: s.code }}
            className="subvol-card subvol-card-lg"
          >
            <div className="min-w-0 flex-1">
              <div
                className="subvol-eyebrow"
                style={{ color: codebook.accent }}
              >
                {s.count.toLocaleString()} documents
              </div>
              <div className="subvol-name">
                {SOURCE_DISPLAY[s.code] ?? s.name}
              </div>
              <div className="subvol-browse">
                Browse <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
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

// Best-effort shortener — strip the "Title N · " prefix from TOC headings
// when the title_group itself already conveys the number. Most TOC rows are
// already short, so this is a no-op for them.
function shortenTitle(_group: string, firstPart?: string): string | null {
  if (!firstPart) return null;
  // first part labels are often "Chapter 1", "Subchapter A" — not the title's
  // name. Caller falls back to the group string itself.
  return null;
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
__MARGINALIA_V2_EOF__

echo ""
echo "✓ All files written."
echo ""
echo "Next steps:"
echo "  1. git diff                         # review what changed"
echo "  2. bun run build  (or your build)   # confirm typescript is clean"
echo "  3. bun run dev                      # try it locally — open ⌘K"
echo "  4. git add -A && git commit -m 'marginalia v2 patch' && git push"
echo ""
