# Court Data Spec
_Drafted 2026-06-03. Companion to `CITATION_GAMEPLAN.md`. The court-data layer is the last source to integrate._

## TL;DR
- Court data is a **structured analytics layer** — facts, coded outcomes, authority, citations — **not** a full-text opinion corpus. Opinion text is deliberately skipped ("case law" ≈ opinions ≈ open for argument; the *facts* are what we want).
- **Source:** CourtListener bulk (Public Domain), which already packages the **FJC IDB** as a clean CSV, plus **SCDB** for SCOTUS. All on disk at `/mnt/sdb1/Courts/` (2026-03-31 snapshot).
- **Don't invent a schema.** CL ships a relational one that already links `docket ↔ IDB ↔ cluster ↔ judge ↔ citation`. Load it verbatim (Postgres `COPY`), then build two derived layers on top.
- **Lead surfaces (chosen):** the analytics cube (base-rate stats) **and** an authority-tiered case index, together, with case↔citation linking. Judge pages deferred.
- **Authority is the spine.** A ruling's weight = its precedential authority. Privilege binding precedent (SCOTUS + state supreme); everything below is persuasive / "for your consideration." All signals are already present.
- **Federal stats are strong** (IDB: complete + coded). **State stats are appellate-only + classifier-dependent** — an honest asterisk, same spirit as the "check your local rules" caveat.

---

## 1. Ground truth (on disk 2026-06-03, `/mnt/sdb1/Courts/`)
- `cl/` CourtListener bulk: `fjc-integrated-database` (267 MB), `opinion-clusters` (2.34 GB), `dockets` (4.75 GB), `citation-map` (498 MB), `citations` (121 MB), `parentheticals` (273 MB), `courts`/`courthouses`, full `people-db-*` (judges). **Skipped** `opinions` (52 GB full text), audio, financial-disclosures.
- `scdb/` SCDB case-centered + justice-centered CSVs.
- `docs/` `schema.sql`, `load-bulk-data.sh` (the exact `COPY` commands — `FORMAT csv, ENCODING utf8, ESCAPE '\', HEADER`), `IDB-Research-Guide.pdf`, **`idb_codes.json`** (authoritative code→label decode, from FLP's own importer), offense/office codebooks.
- **IDB is decoded:** outcome vocabulary is tiny/coded (disposition 24, judgment ~5, NOJ 19, procedural_progress 31, NOS 113). Proven on 1.5M civil rows: 21.9% settled; of cases with a judgment, **Defendant 57.6% / Plaintiff 34.8%**. Facts layer = decode, no NLP.
- **Court level is encoded** in `search_court.jurisdiction` (`S`/`F`/`SA`/`FD`/`ST`/…) — the authority-tier signal, ready-made.
- **Infra:** local Postgres `self_law` is live (owner `app_user`), PostgREST on :3000. Load CL bulk into a sibling local DB **`courtlistener`**. Cloud serving DB = `ztyhvhrvbplqkmivizxd`.

---

## 2. Entity model — load CL's schema verbatim
```
search_court  (jurisdiction = Federal / <state>, court level)
    ↑ court_id
search_docket ──idb_data_id──▶ recap_fjcintegrateddatabase   ← CODED outcomes (federal)
   ├ assigned_to_id ▶ people_db_person (judge) + positions / political_affiliation / education
   ├ case_name, nature_of_suit, dates, docket_number_core
   ↑ docket_id
search_opinioncluster   ← case-law metadata: disposition(free-text), summary, syllabus,
   │                       scdb_*, precedential_status, citation_count
   ├ search_opinioncluster_panel ▶ people_db_person (appellate judges)
   ├ search_citation (reporter cites)            [opinion TEXT skipped]
search_opinionscited   ← citation map (citing_opinion → cited_opinion, depth)
search_parenthetical   ← "what a case stands for" one-liners (described / describing opinion)
```
**The unlock:** `search_docket.idb_data_id` is a direct FK to the IDB row — CL already links each federal docket to its coded outcome, no fuzzy matching. `cluster.docket_id` chains case law → docket → court + judge + IDB.

**Skip on load:** `opinions` (text), `oral-arguments`, `financial-disclosures-*`.

---

## 3. The three layers
- **L1 — Entities (as-shipped):** the graph above, in local `courtlistener` PG.
- **L2 — Normalized outcome:** one controlled `outcome` enum both feeds map into (§5).
- **L3 — Analytics cube + authority-tiered case index:** materialized `(court, case_type, year, [judge], outcome) → counts/rates` (§ powers stat pages), plus a ranked case index (§4).

---

## 4. Authority tiering — the "carries weight" model
A ruling's value is its binding force. Derive an **authority tier + score** per case from signals already on disk:

| Tier | Courts (`jurisdiction` + court_id) | Meaning |
|---|---|---|
| **1 — Apex / binding** | SCOTUS (`court_id=scotus`); State Supreme `S` (55) | Controlling. Surface first. |
| **2 — Appellate / binding** | Federal Appellate `F` (127); State Appellate `SA` (110) | Binding within circuit/state. |
| **3 — Trial / persuasive** | District `FD`, State Trial `ST` (2,618), Bankruptcy `FB` | "For your consideration." |

Within tier, rank by `precedential_status = Published` then `citation_count`. This **extends the existing `doc_authority` concept** (statutes corpus) to cases — same ranking philosophy, new node type. Product consequence: research/casefile views lead with apex authority and explicitly mark persuasive material, so a user can *push an issue* with real authority instead of folding.

---

## 5. Outcome normalization
One enum, two feeds:
- **Federal (deterministic):** map IDB codes via `docket.idb_data_id`. `judgment` (1=Plaintiff/2=Defendant/3=Both) + `disposition` (13=Settled, 14/12=Dismissed, 6=Motion, …) + `procedural_progress` → unified outcome. Already prototyped.
- **State appellate (classify):** `cluster.disposition` is free text → rules first (`affirmed`/`reversed`/`remanded`/`dismissed`/`vacated`), LLM for the residue. Lower coverage; carries the state asterisk.

Target enum (draft): `plaintiff_win · defendant_win · mixed · settled · dismissed_voluntary · dismissed_procedural · transferred · remanded · affirmed · reversed · vacated · other`.

---

## 6. Citation linking (the logical-application backbone)
- `search_opinionscited` (citing→cited + `depth`) = the case→case graph; `search_citation` = reporter cites for resolving references.
- **Per case:** "cites" and "cited by," each **ranked by authority** (§4) — so the strong supporting authorities float up.
- **Fold case-law cites into the existing `citation_edges`** → resolves the currently-0% `scotus`/`fed_app`/`fed_supp` cite types in the statutes corpus, and cross-links **statutes ↔ cases** both directions.
- `parentheticals` annotate edges with "what the cited case stands for" — free holding summaries on the links.

---

## 7. Federal vs state reality (honest limits)
| | Federal | State |
|---|---|---|
| Outcome facts | IDB: complete + coded ✓ | Appellate clusters only, free-text disposition, partial |
| Who-won / how-far | Yes (IDB) | Classifier-derived, lower coverage |
| Judge | Redacted in IDB → use `docket.assigned_to` + people-db | Appellate panel via `_panel` join |
| Base-rate quality | Strong | Appellate-only asterisk |

---

## 8. Serving
- Local `courtlistener` DB = load + analysis. Derive **thin slices → cloud** (`ztyhvhrvbplqkmivizxd`), matching the states pattern (heavy data local; project a serving slice).
- Slices: (a) analytics aggregates (tiny), (b) authority-tiered case index (name/court/tier/date/cite/outcome + citation links), (c) judge index (later).
- **UPL line** (per `product-thesis-and-no-advice-rule`): stats are *descriptive* ("X disposition in N% of cases of this type in this court"); authority is *surfaced*, never advised.

---

## 9. Build sequence
1. **Load** CL bulk verbatim into local `courtlistener` PG via `COPY` (skip opinions/audio/financial). ~½ day.
2. **Authority tier + case index** (court-level map + precedential_status + citation_count).
3. **Federal analytics cube** from IDB (logic prototyped) → first stat pages.
4. **State disposition classifier** → state cube.
5. **Citation linking** → fold into `citation_edges`; resolve case-law cites; statute↔case cross-links.
6. **Serving slices → cloud** (aggregates first, then case index).

---

## 10. Open questions
1. **Case-type taxonomy for the cube:** federal = IDB `nature_of_suit` (clean). State = ? (NOS rarely populated on state clusters — derive from `nature_of_suit`/`posture`/case-name, or a coarser bucket?).
2. **Case index scope:** all clusters (~10M incl. all 50 states' appellate) vs **precedential-only first** (Published) to keep it apex-weighted and lean?
3. **State classifier budget:** rules-only (cheap, ~?% coverage) vs LLM the residue (better, costs tokens) — and is appellate-only state data worth the classifier now or after federal ships?
4. **Cloud serving shape:** dedicated `cases`/`court_stats` tables vs projecting a thin row into `document_sections` (so cases appear in unified search like states do).
