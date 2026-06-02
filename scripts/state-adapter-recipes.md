# State adapter recipes — recon of the 17 remaining states

Generated from a 17-agent swarm that read the actual on-disk bytes under
`/mnt/sdb1/States/<State>/` (not the file extensions — those lie). Each entry is
a concrete recipe a developer can write the `state_ingest.py` adapter straight
from.

**STATUS: DONE.** All 17 adapters below were written and the states loaded —
the DB now holds **49 of 50 states, 2,016,810 sections**. The only state NOT
loaded is **Pennsylvania** (empty iframe shells on disk — needs a re-scrape of
the `?…&iFrame=true` URLs, then the wired `parse_pa` runs). The table below is
kept as the as-built reference for each adapter.

**Headline:** 5 states previously marked DEFERRED are actually recoverable from
the data already on disk — **Idaho, Indiana, New Jersey, South Dakota, Kentucky**.
Only **Pennsylvania** is truly blocked (the scrape captured empty JS shells).
New Mexico is partial (62% of URLs fetched).

---

## PDF states → the new `("pdf", fn)` dispatch path (pdftotext -layout -nopgbrk)

| State | Granularity | Files | Split strategy |
|-------|-------------|-------|----------------|
| **Iowa** ✓ | section-per-file | 47k | DONE — `parse_ia`. URL basename = section; chapter from running header `<n> NAME, §<sec>`. |
| **Kentucky** | section-per-file | 35k | `.html` ext but `%PDF` bytes. First line = `CHAP.SEC Title.`; body until `Effective:`/`History:` (drop those). No header/footer. Chapter = `sec.split('.')[0]`. |
| **North Dakota** | chapter-per-file | 2.5k | One PDF/chapter `t<TT>c<CC>.pdf`. Split on `^\s{0,10}(\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?)\.\s+(.+)`. Drop `^\s*Page No\.\s+\d+$`. Title/chapter from URL `t..c..`. |
| **Wyoming** | title-per-file | 44 | One PDF/title. Headers `TITLE N - …`, `CHAPTER N - …`, `ARTICLE N - …` are structural (keep). Split on `^ +(\d+)-(\d+)-(\d+)\.\s*(.*)`. No footer. |
| **Oklahoma** | title-per-file | 90 | HUGE (to 121MB). Running header `Oklahoma Statutes - Title N. <Name>`; footer `Page N`; **skip the first ~5-30 TOC pages**. Split on `^§([0-9A-Za-z][\w.\-]*)\.`. |
| **New Mexico** | chapter-per-file | 52/84 ⚠ | `.html` ext but `%PDF`. One PDF/chapter; header `CHAPTER N`/`<name>`. Split on `^([0-9]{1,2}[A-Z]?-\d+-\d+(?:\.\d+)?)\.\s`. **Incomplete: 32 of 84 URLs failed (HTTP 0)** — load the 52 we have, re-fetch the rest later. |
| **Colorado** | title-per-file | 148 | Has both `.htm` and `.pdf`. PDF: header `Colorado Revised Statutes 2025`, footer `Page N of M`, split on `^\s+\d+-\d+-\d{3,}\.`. (HTML variant below is cleaner.) |

A multi-section PDF splitter (`^<section-number>. <catchline>` → records, body
to next marker) is shared by ND/WY/OK/NM/CO-pdf. KY/IA are the simple
one-section-per-file case.

---

## HTML — shared UniCourt `cic-code` format → one `parse_unicourt` for 3 states

`unicourt.github.io/cic-code-XX/transforms/…` — identical DOM for all three:
`<main>` holds title; each section is `<div><h3 id="t<T>c<C>s<SEC>"><b>SEC. Title</b></h3> …content…</div>`.

- **Arkansas** (30 files), **Georgia** (55), **Mississippi** (52).
- Section #: from `h3[id*="s"]` text prefix (`N-N-N`) / the `id` attr. Skip `h3.subchapterh3` (dividers, no body).
- Path: Title from `<h1>`/URL `…title.NN…`, Chapter from `h2[id*="c"]`, Subchapter from `h3.subchapterh3`.
- Drop: `<nav>`, and `<h4 id*="CaseNotes|ResearchReferences|JudicialDecisions|OpinionsOfTheAttorneyGeneral|LawReviews|Amendments|Editorial…">` subtrees + `<p>` whose leading `<b>` is `History.`/`Cross references.`/`Amendments.`.
- Constitution files use `id="constitution-xx-aNN…"` — same shape, no `h2` chapters.

---

## HTML — per-state custom (multi-section-per-file, split in-text)

- **Connecticut** (`cga.ct.gov`, chapter-per-file, 1.1k): sections = `span.catchln[id="sec_X-Y"]`; body = following `<p>` until next catchln. Drop `p.source*`, `p.history*`, `p.annotation*`, `p.cross-ref*`, `p.front-note*`, `table.nav_tbl`, TOC. Title # = left of `-` in section id. Chapter name from `h2.chap-no`/`h2.chap-name`.
- **Colorado** (`olls.info`, title-per-file): WordPerfect HTML, `BODY > P > SPAN`; section = `<STRONG>N-N-N. Title.</STRONG>` bold prefix, body = rest of paragraph + following non-numbered `<P>`. Drop `<STRONG>Source:/Editor's note:/Cross references:/Law reviews:</STRONG>` paras. Title name from `<TITLE>` tag. (Some `.html` files are actually DOCX — prefer the confirmed-HTML or the PDF variant.)
- **Idaho** ⭐recovered (`legislature.idaho.gov`, section-per-file, 23k): text IS in static HTML (was wrongly deferred as JS-rendered). Inline-styled `div.pgbrk`; section/title in a `<div><span class="f11s">10-1106.&nbsp;&nbsp;<span style="text-transform:uppercase">TITLE</span>`. Title/chapter from URL `/title10/t10ch11/sect10-1106/` and centered `TITLE N`/`CHAPTER N` divs. Drop `div.advancedSearchFormControls`, `footer`, breadcrumb section.
- **Indiana** ⭐recovered (`iga.in.gov`, title-per-file, 36): text IS present (was wrongly deferred as empty SPA mount). Sections = `div.section[id="T-A-C-S"]` with `span#ic_number` (`IC 6-1.1-1-1`) + `span#shortdescription`; body = following `<p>` until next structural `div.{section,chapter,article,title}`. Drop `p.derivation`, blank spacers, `span.crossref`.
- **New Hampshire** (`gc.nh.gov`, section-per-file, 7k): non-standard tags. Body = `<codesect>…</codesect>`; history = `<sourcenote>`; section #/title/chapter/title-name in an HTML comment block in `<head>` (`<titlename>`, `<chapter>`, `<sectiontitle>`). Hierarchy also in URL `/rsa/html/<TITLE_ROMAN>/<CHAPTER>/<SECTION>.htm`.

## HTML — clean, near-Rule (one section per file)

- **Nebraska** (`nebraskalegislature.gov`, 50k): `div.statute` → `h2` (number), `h3` (title), `p.text-justify` (body). Section # from URL `?statute=CH-SEC` / top comment `<!-- 01-106 -->`. Chapter from breadcrumb. Drop `Source` history div, headers/footers. Likely expressible as a `Rule`.
- **New Jersey** ⭐recovered (`lis.njleg.state.nj.us`, 56k): text IS present, one section per file (was wrongly deferred as nxt frames). `div.Headnotes div` = `N:N-N.  Title`; `div.Normal-Level div` = body. Section # = `TITLE:CHAPTER-SECTION`. Drop `script,style,span.heading_text`.

## JSON — new `("json", fn)` dispatch path

- **South Dakota** ⭐recovered (`sdlegislature.gov`, 50k): files are JSON API responses (was wrongly deferred as empty SPA). Keys: `Statute` (e.g. `10-10-1`), `Type` (Title/Chapter/Section — keep only Section), `CatchLine` (title), `parents[]` (hierarchy), `Html` (embedded). Extract from `Html`: `span[class$=SENU]` = number, `span[class$=CL]` = catchline, `p[class*=Normal-000000]` = body; stop at `Source:`/`Credits:`. (Classes carry a per-statute numeric prefix — match by suffix/regex.)

---

## BLOCKED — needs a re-scrape (cannot parse what's on disk)

- **Pennsylvania** (`palegis.us`, 15.4k): every captured file is a jQuery wrapper with an empty `<iframe id="IFrame_StatuteText" src="about:blank">`; the statute text loads from `/statutes/consolidated/view-statute?<id>&iFrame=true&ttl=..&chpt=..&sctn=..`. `parse_pa` is already wired — just re-fetch those `&iFrame=true` iframe URLs (no headless needed; they're direct routes) and re-run. Until then, DEFERRED.
