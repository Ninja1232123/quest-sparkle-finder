/**
 * ConstitutionLanding — the "We the People" themed front door for /const.
 *
 * A bespoke Americana treatment (the Const codebook's own red accent taken
 * full-dress: navy/gold/parchment, screaming eagle, script wordmark). All
 * styling is scoped under `.merica` in styles.css so it never touches the
 * global reading-room palette. Wired to the real 35-document corpus — every
 * card and chip links straight into the reader (/code/$).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import type { ConstDoc } from "@/lib/documents.functions";
import {
  parseConstIdentifier,
  ARTICLE_NAMES,
  AMENDMENT_NAMES,
  romanForAmendment,
  BILL_OF_RIGHTS,
  LATER_AMENDMENTS,
} from "@/lib/constitution-structure";

// reader path for a const document: /us/const/article/1 -> splat "us/const/article/1"
const splat = (identifier: string) => identifier.replace(/^\//, "");

function ArticleCard({ doc }: { doc: ConstDoc }) {
  const ref = parseConstIdentifier(doc.identifier);
  if (!ref || ref.kind !== "article") return null;
  const meta = ARTICLE_NAMES[ref.num];
  if (!meta) return null;
  const branch = ref.num <= 3; // Legislative / Executive / Judicial → navy spine
  return (
    <Link to="/code/$" params={{ _splat: splat(doc.identifier) }} className={`m-card ${branch ? "blue" : ""}`}>
      <div className="num">Article {romanForAmendment(ref.num)}</div>
      <h3>{meta.title}</h3>
      <div className="gist">{meta.gist}</div>
      <div className="meta">
        <span className="secs">{meta.sections > 0 ? `${meta.sections} sections` : "single passage"}</span>
        <span className="go">Open →</span>
      </div>
    </Link>
  );
}

function AmendmentChips({ nums, collapsed }: { nums: number[]; collapsed: boolean }) {
  // Always rendered (so the 27 amendment links sit in the SSR DOM and work
  // without JS) — folded via CSS until the group is opened.
  return (
    <div className={`m-amds${collapsed ? " collapsed" : ""}`} aria-hidden={collapsed}>
      {nums.map((n) => (
        <Link key={n} to="/code/$" params={{ _splat: `us/const/amendment/${n}` }} className="m-chip">
          <span className="r">{romanForAmendment(n)}</span>
          <span className="s">{AMENDMENT_NAMES[n] ?? `Amendment ${romanForAmendment(n)}`}</span>
        </Link>
      ))}
    </div>
  );
}

// A gold grouping card that reveals its amendment chips inline (anti-walls:
// the 27 amendments stay folded until asked for).
function AmendmentGroup({ label, sub, nums, badge }: { label: string; sub: string; nums: number[]; badge?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className="m-card gold" aria-expanded={open}>
        <div className="num">{sub}</div>
        <h3>{label}</h3>
        <div className="meta">
          {badge ? <span className="badge">★ {badge}</span> : <span className="secs">{nums.length} amendments</span>}
          <span className="go">{open ? "Hide ▲" : "Browse →"}</span>
        </div>
      </button>
      <AmendmentChips nums={nums} collapsed={!open} />
    </>
  );
}

export function ConstitutionLanding({ docs, preambleText }: { docs: ConstDoc[]; preambleText: string }) {
  const articles = docs.filter((d) => parseConstIdentifier(d.identifier)?.kind === "article");
  const amendments = docs.filter((d) => parseConstIdentifier(d.identifier)?.kind === "amendment");
  const totalSections = docs.length; // 35: preamble + articles + amendments

  // Preamble drop-cap: split the first letter off for the script flourish.
  const pre = preambleText || "We the People of the United States…";
  const firstLetter = pre.charAt(0);
  const restOfPreamble = pre.slice(1);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="merica">
        <div className="bunting" />
        <div className="starband">★ &nbsp; established 1787 &nbsp; ★ &nbsp; the supreme law of the land &nbsp; ★ &nbsp; we the people &nbsp; ★</div>

        {/* ===== HERO ===== */}
        <section className="m-hero">
          <div className="m-rays" />
          <div className="m-hero-inner">
            <div className="m-eyebrow">★ the founding charter ★</div>
            <div className="m-wethepeople">We the People</div>
            <div className="m-eagle-wrap">
              <img className="m-eagle" src="/bald-eagle.png" alt="Screaming bald eagle, wings spread" />
              <div className="m-cartouche">
                <div className="m-kicker">Of the United States of America</div>
                <h1 className="m-doc-title">The Constitution</h1>
                <p className="m-doc-sub">Seven articles. Twenty-seven amendments. One stubborn experiment in self-rule — read it whole.</p>
                <div className="m-pill-row">
                  <span className="m-pill"><span className="n">{articles.length}</span> Articles</span>
                  <span className="m-pill red"><span className="n">{amendments.length}</span> Amendments</span>
                  <span className="m-pill"><span className="n">{totalSections}</span> sections indexed</span>
                </div>
                <div className="m-cta-row">
                  <Link to="/code/$" params={{ _splat: "us/const/preamble" }} className="m-btn m-btn-blue">★ Read the whole thing</Link>
                  <Link to="/compare" search={{ q: "Const.", sources: "const,usc,cfr" }} className="m-btn m-btn-red">Compare across books</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="m-hero-foot" />
        </section>

        {/* ===== PREAMBLE ===== */}
        <section className="m-preamble">
          <div className="m-sec-eyebrow"><span className="star">★</span> the preamble <span className="star">★</span></div>
          <h2>It Starts With Us</h2>
          <p className="m-preamble-body">
            <span className="drop">{firstLetter}</span>{restOfPreamble}
          </p>
          <Link to="/code/$" params={{ _splat: "us/const/preamble" }} className="m-seal" aria-label="Read the Preamble">★</Link>
        </section>

        <div className="m-ribbon">Land of the Free <span className="star">★</span> Home of the Brave</div>

        {/* ===== ARTICLES & AMENDMENTS ===== */}
        <section className="m-shelf">
          <div className="m-shelf-head">
            <div>
              <div className="m-sec-eyebrow"><span className="star">★</span> by title</div>
              <h2>Articles &amp; Amendments</h2>
            </div>
            <span className="count">{articles.length + 2} sub-volumes · {totalSections} sections</span>
          </div>
          <div className="m-grid">
            {articles.map((d) => <ArticleCard key={d.identifier} doc={d} />)}
            <AmendmentGroup label="The Bill of Rights" sub="Amend. I–X" nums={BILL_OF_RIGHTS} badge="the big ten" />
            <AmendmentGroup label="Later Amendments" sub="Amend. XI–XXVII" nums={LATER_AMENDMENTS} />
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="m-footer">
          <div className="snake">don't tread on me</div>
          <div className="tread">Read it. Cite it. Hold them to it.</div>
          <div className="pluribus">E Pluribus Unum — out of many, one</div>
          <p className="disclaimer">Marginalia is a research index, not a law firm. Nothing here is legal advice. The text of the Constitution is reproduced verbatim from the primary source.</p>
          <div className="stripes" />
        </footer>
      </main>

      <SiteFooter />
    </div>
  );
}
