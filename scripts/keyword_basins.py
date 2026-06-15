#!/usr/bin/env python3
"""Precompute keyword "basins" — AND-expressions of trigger slots, mined so each
one narrows to a useful size, with its matching doc-ids cached.

The corpus is 3.4M sections. Live-scanning all of it every turn is wasteful and
shallow. Instead we mine a pile of boolean trigger expressions, run each ONCE
against search_tsv, and save the doc-ids it returns into keyword_basins /
keyword_basin_doc. The model then lands on a basin and reads a few-hundred cached
rows instead of sweeping the whole table. We never look inside the bodies — the
signal is the overlap (which expressions return the same docs vs. different ones).

A basin is an AND of "slots". A slot is a single word OR an OR-bundle of
synonyms, so expressions look like:
    debt & collector & (instrument|note)
    taxation & void & discharge & fraud
    (instrument|note) & discharge & obligation

Mining rule (why it's fast AND deep): an AND only ever shrinks the result set, so
we deepen a combo *only while it's still too broad* (> CAP) and save it the moment
it lands in [MIN, CAP]. Empty branches are pruned (a superset of nothing is
nothing). Depth is driven by the data, not a fixed arity — the deep expressions
exist only where the shallower ANDs were still broad.

  python scripts/keyword_basins.py sample          # mine, print shape, NO writes
  python scripts/keyword_basins.py apply           # mine + write basins

Pure SQL FTS, no Claude calls.
"""
import sys

import psycopg2
import psycopg2.extras

DSN = "dbname=self_law user=k"
CAP = 800        # a basin must match <= CAP docs; broader than that => deepen it
MIN = 2          # ignore expressions matching fewer than MIN docs (noise)
MAX_DEPTH = 3    # ceiling on AND depth (bump to 4 once v1 is validated)
MAX_BASINS = 80000   # runaway guard
PROBE_BUDGET = 30000 # hard cap on FTS probes so mining can't explode

# Trigger slots. Each is (label, [words]); multiple words = an OR-bundle.
SLOTS: list[tuple[str, list[str]]] = [
    # consumer / debt
    ("debt", ["debt"]),
    ("collector", ["collector", "collection"]),
    ("validation", ["validation"]),
    ("dunning", ["dunning"]),
    ("servicer", ["servicer"]),
    ("mortgage", ["mortgage"]),
    ("rescission", ["rescission", "rescind"]),
    ("usury", ["usury"]),
    # negotiable instruments / obligation
    ("instrument|note", ["instrument", "note"]),
    ("obligation|liability", ["obligation", "liability"]),
    ("discharge", ["discharge"]),
    ("tender|payment", ["tender", "payment"]),
    ("holder|bearer", ["holder", "bearer"]),
    # fraud
    ("fraud", ["fraud", "fraudulent"]),
    ("misrepresentation", ["misrepresentation"]),
    ("concealment", ["concealment"]),
    ("scienter", ["scienter"]),
    ("materiality|material", ["materiality", "material"]),
    ("forgery|falsify", ["forgery", "falsify"]),
    # validity / taxation
    ("void|voidable", ["void", "voidable"]),
    ("taxation|tax", ["taxation", "tax"]),
    # property
    ("foreclosure", ["foreclosure"]),
    ("deed", ["deed"]),
    ("lien", ["lien"]),
    ("title", ["title"]),
    ("redemption", ["redemption"]),
    ("conveyance", ["conveyance"]),
    # procedure / due process
    ("jurisdiction", ["jurisdiction"]),
    ("standing", ["standing"]),
    ("default", ["default"]),
    ("notice", ["notice"]),
    ("hearing", ["hearing"]),
    ("sanctions", ["sanctions"]),
    # evidence / remedies
    ("hearsay", ["hearsay"]),
    ("presumption", ["presumption"]),
    ("damages", ["damages"]),
    ("injunction", ["injunction"]),
    ("immunity", ["immunity"]),
]


def tsquery_sql(idxs) -> str:
    """AND of per-slot OR-groups: (a||b) && (c) && (d||e)."""
    parts = []
    for i in idxs:
        _, words = SLOTS[i]
        ors = " || ".join("plainto_tsquery('english', %s)" for _ in words)
        parts.append(f"({ors})")
    return " && ".join(parts)


def flat_words(idxs):
    return [w for i in idxs for w in SLOTS[i][1]]


def label(idxs) -> str:
    return " & ".join(SLOTS[i][0] for i in idxs)


def probe_count(cur, idxs) -> int:
    """How many docs match (bounded at CAP+1 so broad terms stay cheap)."""
    q = tsquery_sql(idxs)
    cur.execute(
        f"SELECT count(*) FROM (SELECT 1 FROM public.document_sections d "
        f"WHERE d.search_tsv @@ ({q}) LIMIT {CAP + 1}) s",
        flat_words(idxs),
    )
    return cur.fetchone()[0]


def fetch_ranked(cur, idxs):
    """The basin's cached set — only ever called on narrow (<=CAP) combos, so
    ranking the full match set is cheap."""
    q = tsquery_sql(idxs)
    cur.execute(
        f"SELECT d.id, ts_rank_cd(d.search_tsv, ({q})) AS rank "
        f"FROM public.document_sections d WHERE d.search_tsv @@ ({q}) "
        f"ORDER BY rank DESC LIMIT {CAP}",
        flat_words(idxs) + flat_words(idxs),
    )
    return cur.fetchall()


def mine(cur, on_basin, on_probe=None):
    """Breadth-first deepen-while-broad. Calls on_basin(idxs, count) per kept
    basin. Returns total probes run."""
    n = len(SLOTS)
    probes = 0
    kept = 0
    # depth 1
    frontier = []
    for i in range(n):
        c = probe_count(cur, (i,)); probes += 1
        if c > CAP:
            frontier.append((i,))
        elif c >= MIN:
            on_basin((i,), c); kept += 1
        if on_probe:
            on_probe(probes)
    depth = 1
    while frontier and depth < MAX_DEPTH and kept < MAX_BASINS and probes < PROBE_BUDGET:
        depth += 1
        nxt = []
        for combo in frontier:
            for j in range(combo[-1] + 1, n):  # canonical: increasing index
                cand = combo + (j,)
                c = probe_count(cur, cand); probes += 1
                if on_probe:
                    on_probe(probes)
                if c > CAP:
                    nxt.append(cand)
                elif c >= MIN:
                    on_basin(cand, c); kept += 1
                    if kept >= MAX_BASINS:
                        return probes
                # c < MIN -> prune (supersets are no larger)
                if probes >= PROBE_BUDGET:
                    print(f"  [probe budget {PROBE_BUDGET} hit at depth {depth}]")
                    return probes
        frontier = nxt
    return probes


def cmd_sample():
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    by_depth: dict[int, int] = {}
    examples: list[tuple[str, int]] = []
    doc_sets: list[set] = []

    def on_basin(idxs, c):
        by_depth[len(idxs)] = by_depth.get(len(idxs), 0) + 1
        if len(idxs) >= 3 and len(examples) < 30:
            examples.append((label(idxs), c))
        if len(doc_sets) < 400:
            rows = fetch_ranked(cur, idxs)
            doc_sets.append({r[0] for r in rows})

    def on_probe(p):
        if p % 1000 == 0:
            print(f"  …{p} probes")

    print(f"mining (CAP={CAP}, MIN={MIN}, MAX_DEPTH={MAX_DEPTH}, slots={len(SLOTS)})…")
    probes = mine(cur, on_basin, on_probe)
    total = sum(by_depth.values())
    print(f"\nprobes={probes}  basins kept={total}")
    for d in sorted(by_depth):
        print(f"  depth {d}: {by_depth[d]} basins")
    print("\nexample deep basins:")
    for lab, c in examples[:18]:
        print(f"  {lab:54.54} -> {c:4d} docs")
    if len(doc_sets) >= 2:
        import random
        pairs = [(random.choice(doc_sets), random.choice(doc_sets)) for _ in range(300)]
        jac = [len(a & b) / len(a | b) for a, b in pairs if a is not b and (a | b)]
        avg = sum(jac) / len(jac) if jac else 0.0
        print(f"\navg pairwise overlap (Jaccard)≈{avg:.3f} "
              f"(low = basins surface different fields)")
    cur.close(); conn.close()


def cmd_apply():
    rconn = psycopg2.connect(DSN)
    wconn = psycopg2.connect(DSN)
    rcur = rconn.cursor()
    wcur = wconn.cursor()
    state = {"n": 0}

    def on_basin(idxs, c):
        rows = fetch_ranked(rcur, idxs)
        if not rows:
            return
        op = "single" if len(idxs) == 1 else "and"
        lab = label(idxs)
        terms_l = sorted({w.lower() for w in flat_words(idxs)})
        wcur.execute(
            """
            INSERT INTO public.keyword_basins (op, terms, label, doc_count, refreshed_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (op, label) DO UPDATE
              SET terms = EXCLUDED.terms, doc_count = EXCLUDED.doc_count, refreshed_at = now()
            RETURNING id
            """,
            (op, terms_l, lab, len(rows)),
        )
        basin_id = wcur.fetchone()[0]
        wcur.execute("DELETE FROM public.keyword_basin_doc WHERE basin_id = %s", (basin_id,))
        psycopg2.extras.execute_values(
            wcur,
            "INSERT INTO public.keyword_basin_doc (basin_id, doc_id, rank) VALUES %s",
            [(basin_id, r[0], float(r[1])) for r in rows],
        )
        state["n"] += 1
        if state["n"] % 200 == 0:
            wconn.commit()
            print(f"  wrote {state['n']} basins…")

    print(f"mining + writing (CAP={CAP}, MIN={MIN}, MAX_DEPTH={MAX_DEPTH})…")
    probes = mine(rcur, on_basin)
    wconn.commit()
    print(f"done. probes={probes} basins={state['n']}")
    rcur.close(); wcur.close(); rconn.close(); wconn.close()


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "sample"
    if mode == "sample":
        cmd_sample()
    elif mode == "apply":
        cmd_apply()
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
