# Information architecture for the expanded corpus

You're going from ~4 corpora to roughly 15, with Federal Register and Congress alone bringing 500k+ documents. The current `/code/$identifier` catch-all will collapse under that — search will dominate because there's nowhere to *browse to*, and unrelated material (a SCOTUS opinion, a 1995 EO, a pending bill, 42 USC § 1983) all share the same reader chrome and URL shape.

This plan does **navigation/IA first**, as you asked. Schema work comes in a follow-up once you've uploaded a sample and we can see the actual shape.

## Proposed top-level shelves

Five sections in the main nav, each with its own landing page, browse model, and reader styling. Federal-only for now; "State" becomes a sixth shelf when that data lands.

```text
/codes        Codified law (stable, hierarchical)
              └─ USC · CFR · eCFR · Statute Compilations

/register     Federal Register (time-series, agency-driven)
              └─ Final rules · Proposed rules · Notices · Presidential docs

/congress     Legislative activity (time-series, status-driven)
              └─ Bills · Bill Status · Bill Summaries · Public & Private Laws
                 · Statutes at Large

/courts       Judicial opinions
              └─ SCOTUS (FLITE 1937–1975), room for more later

/reference    Government reference works (browsable, low-churn)
              └─ US Gov Manual · House Rules & Manual · Privacy Act Issuances
                 · Public Papers of the Presidents · Commerce Business Daily
```

Why this split and not "Federal = one bucket": each shelf wants a *different reader and a different browse pattern*. Codes are hierarchical (Title → Chapter → Section). The Register is a firehose (year/month/agency). Congress is lifecycle-driven (bill → status → law). Courts are by-case. Reference is shelf-browse. Cramming them into one filter UI hides everything.

## URL shapes

```text
/codes                      shelf landing — pick a code, recent activity
/codes/usc                  existing source landing
/codes/usc/42/1983          reader (migrated from /code/usc/42/1983)

/register                   shelf landing — today's FR, agency cloud
/register/2026/05           month browse
/register/agency/epa        agency browse
/register/doc/2026-12345    reader

/congress                   shelf landing — active bills, recently enacted
/congress/119               congress browse
/congress/119/hr/1234       bill reader (status timeline + text versions)
/congress/laws/119-12       public law reader

/courts/scotus/1972/brown-v-board     case reader
/reference/usgm/2026/doj              reference reader
```

Old `/code/*` URLs 301 to `/codes/*` so existing bookmarks, sitemaps, and the agent API keep working.

## Per-shelf landing pages

Each landing page is small and purpose-built — not a generic list:

- **/codes** — grid of the code families with cover/spine treatment, "browse the law as a library" framing. Big "search the codes" box. Recently viewed.
- **/register** — today's FR issue at the top, then a 12-month sparkline, then agencies grouped by volume. Filter chips for rule type.
- **/congress** — current Congress at top with bill counters by status; "recently became law" rail; sponsor & committee search.
- **/courts** — decade picker; recent additions; case-name search.
- **/reference** — flat tile grid; these are mostly one-and-done lookups.

## Discovery defaults

Per your note: **time-based browse is the default everywhere it applies** (FR, Congress, Public Papers, Statutes at Large). Agency/sponsor filters get added when the ingest reveals clean fields for them — we won't pre-build filter UI for fields that don't materialize cleanly.

## What changes in code (IA-first pass)

Frontend only. No DB or ingest work yet.

1. **New route files** (empty scaffolds with `head()` SEO and a "coming soon" stub where data isn't loaded yet):
   - `src/routes/codes.tsx` (shelf), `codes.index.tsx`, `codes.$source.$.tsx` (reader)
   - `src/routes/register.tsx`, `register.index.tsx`, `register.$year.$month.tsx`, `register.doc.$id.tsx`
   - `src/routes/congress.tsx`, `congress.index.tsx`, `congress.$congress.$type.$number.tsx`
   - `src/routes/courts.tsx`, `courts.index.tsx`
   - `src/routes/reference.tsx`, `reference.index.tsx`
2. **Migrate the existing reader**: `/code/$.tsx` → `/codes/$source/$.tsx`. Keep `/code/$.tsx` as a redirect for ~6 months.
3. **Update header nav** to surface the five shelves. Demote "Library" / "Chambers" / "Stacks" or fold them into the new shelves (worth a separate decision — see Open Questions).
4. **Agent API** (`/api/public/v1/*`) stays as-is. The `url` field starts returning the new `/codes/...` shape; old `/code/...` URLs 301.
5. **Sitemap** updated to enumerate shelves and per-source landing pages.

## What's deferred (schema pass, after you upload)

- New tables or columns for FR (publication_date, agency, rule_type, effective_date), Congress (congress, chamber, bill_type, sponsor, status, version), Courts (decided_date, docket, justices).
- Whether to keep one `documents` table with a `shelf` column + JSONB metadata, or split into `register_docs`, `congress_bills`, `court_opinions`. Recommendation pending — depends on how uniform the XML/uslm payloads are.
- Cross-source citation graph (FR rule → CFR section it amends; bill → USC it amends).
- Search ranking tuning per shelf (an FR notice shouldn't outrank a USC section on a statute query).

## Open questions for you

1. **Existing pages** — `library`, `chambers`, `stacks`, `compare`, `whitepaper`, `topic/$slug`. Which of these stay top-level, fold into a shelf, or retire? My instinct: `library` → becomes `/codes`; `chambers` → `/congress`; `stacks` → tools menu; `compare` and `whitepaper` stay.
2. **State law shelf** — placeholder in nav now (disabled) or wait until you have data?
3. **Reader chrome** — do you want each shelf to have a distinct visual treatment (color accent, header style), or stay uniform with just a breadcrumb difference?

Answer those and I'll execute the IA pass: new routes, redirects, nav update, sitemap. Then we plan the schema pass once your first FR/Congress dump lands.