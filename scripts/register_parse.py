#!/usr/bin/env python3
"""
Federal Register preamble parser.

The `register` corpus stores each document as one raw run of body_text with the
standard FR preamble structure embedded but unparsed. This pulls that structure
out: splits the document on the required FR headings (AGENCY / ACTION / SUMMARY /
DATES / ADDRESSES / FOR FURTHER INFORMATION CONTACT / SUPPLEMENTARY INFORMATION),
extracts citation metadata (FR vol/issue, RIN, docket, CFR parts affected), writes
a structured body_md, and records the metadata + CFR cross-refs in register_meta.

The CFR-parts extraction is the join key: from a CFR section you can later surface
the Federal Register preambles that created or amended it (regulatory history).

Usage:
  python3 scripts/register_parse.py sample [N]   # parse N (default 500), no writes, print stats + examples
  python3 scripts/register_parse.py apply [LIMIT] # parse + write register_meta and body_md (all, or LIMIT rows)

Targets the local self_law corpus DB (NOT the cloud auth project).
"""
import sys, re, json
import psycopg2, psycopg2.extras

DB = "self_law"

# Required FR preamble headings, in canonical order. They appear inline in the
# raw text (space-separated, not newline-delimited).
LABELS = [
    ("agency",   "AGENCY:"),
    ("action",   "ACTION:"),
    ("summary",  "SUMMARY:"),
    ("dates",    "DATES:"),
    ("addresses","ADDRESSES:"),
    ("contact",  "FOR FURTHER INFORMATION CONTACT:"),
    ("supplementary", "SUPPLEMENTARY INFORMATION:"),
]

RE_VOLISSUE = re.compile(
    r'\b(\d{2,3})\s+(\d{1,3})\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),')
RE_RIN     = re.compile(r'\bRIN\s+(\d{4}-[A-Z]{1,2}\d{2,3})')
RE_DOCKET  = re.compile(r'\[([^\]]{3,80})\]')
RE_CFR     = re.compile(r'\b(\d{1,2})\s+CFR\s+Parts?\s+([\d,\sand]+?)(?=[A-Z\[\(]|RIN|\bDocket|$)')
RE_INT     = re.compile(r'\d+')


def split_preamble(body: str):
    """Return (masthead, {field: value}) by slicing on the known labels."""
    found = []
    for key, lab in LABELS:
        i = body.find(lab)
        if i >= 0:
            found.append((i, key, lab))
    found.sort()
    if not found:
        return body, {}
    masthead = body[: found[0][0]].strip()
    fields = {}
    for n, (i, key, lab) in enumerate(found):
        start = i + len(lab)
        end = found[n + 1][0] if n + 1 < len(found) else len(body)
        fields[key] = body[start:end].strip()
    return masthead, fields


def extract_meta(body: str, masthead: str, identifier: str):
    m = {"fr_volume": None, "fr_issue": None, "fr_doc_number": None,
         "rin": [], "docket_ids": [], "cfr_refs": []}
    # FR doc number is the last identifier segment (the federalregister.gov handle).
    seg = identifier.rstrip("/").split("/")
    if seg:
        m["fr_doc_number"] = seg[-1]
    vi = RE_VOLISSUE.search(masthead)
    if vi:
        m["fr_volume"] = int(vi.group(1))
        m["fr_issue"] = int(vi.group(2))
    m["rin"] = sorted(set(RE_RIN.findall(body[:4000])))
    # Dockets: bracketed tokens in the masthead (skip pure CFR-part echoes).
    m["docket_ids"] = [d.strip() for d in RE_DOCKET.findall(masthead)
                       if not re.fullmatch(r'\d{1,2} CFR.*', d.strip())][:6]
    # CFR parts affected -> [{title, parts:[...]}], the join key to the CFR corpus.
    refs = {}
    for title, partsraw in RE_CFR.findall(masthead or body[:1500]):
        nums = [int(x) for x in RE_INT.findall(partsraw)]
        if nums:
            refs.setdefault(int(title), set()).update(nums)
    m["cfr_refs"] = [{"title": t, "parts": sorted(p)} for t, p in sorted(refs.items())]
    return m


def first_sentence(txt: str, cap: int = 400):
    txt = re.sub(r'\s+', ' ', txt).strip()
    return (txt[:cap] + "…") if len(txt) > cap else txt


def build_md(title, fields, meta):
    cite = []
    if meta["fr_volume"]:
        cite.append(f"{meta['fr_volume']} FR (No. {meta['fr_issue']})")
    if meta["fr_doc_number"]:
        cite.append(f"FR Doc. {meta['fr_doc_number']}")
    for r in meta["rin"]:
        cite.append(f"RIN {r}")
    for d in meta["docket_ids"][:2]:
        cite.append(d)
    for ref in meta["cfr_refs"]:
        parts = ", ".join(str(p) for p in ref["parts"])
        cite.append(f"{ref['title']} CFR {parts}")
    out = []
    if title:
        out.append(f"## {title}\n")
    if fields.get("agency"):
        out.append(f"**Agency:** {fields['agency'].rstrip('.')}  ")
    if fields.get("action"):
        out.append(f"**Action:** {fields['action'].rstrip('.')}  ")
    if cite:
        out.append(f"**Citation:** {' · '.join(cite)}\n")
    if fields.get("summary"):
        out.append(f"### Summary\n\n{fields['summary']}\n")
    if fields.get("dates"):
        out.append(f"### Dates\n\n{fields['dates']}\n")
    if fields.get("supplementary"):
        out.append(f"### Supplementary Information\n\n{fields['supplementary']}\n")
    return "\n".join(out).strip()


def extract_title(masthead, heading):
    # Title = text after the last RIN/docket marker, before AGENCY: (already stripped).
    tail = masthead
    last = 0
    for rx in (RE_RIN, RE_DOCKET):
        for mt in rx.finditer(masthead):
            last = max(last, mt.end())
    cand = masthead[last:].strip(" .—-") if last else ""
    cand = re.sub(r'\s+', ' ', cand)
    if 8 <= len(cand) <= 240:
        return cand
    return (heading or "").strip()


def parse_row(row):
    body = row["body_text"] or ""
    masthead, fields = split_preamble(body)
    meta = extract_meta(body, masthead, row["identifier"])
    title = extract_title(masthead, row["heading"])
    md = build_md(title, fields, meta)
    return title, fields, meta, md


def connect():
    return psycopg2.connect(dbname=DB, cursor_factory=psycopg2.extras.RealDictCursor)


def cmd_sample(n):
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, identifier, heading, body_text
        FROM document_sections
        WHERE source_code='register'
          AND section_label IN ('Rules and Regulations','Proposed Rules')
          AND body_text ~ 'AGENCY:'
        ORDER BY random() LIMIT %s
    """, (n,))
    rows = cur.fetchall()
    stats = {"n": len(rows), "title": 0, "summary": 0, "suppl": 0,
             "rin": 0, "docket": 0, "cfr": 0, "volissue": 0}
    examples = []
    for r in rows:
        title, fields, meta, md = parse_row(r)
        if title: stats["title"] += 1
        if fields.get("summary"): stats["summary"] += 1
        if fields.get("supplementary"): stats["suppl"] += 1
        if meta["rin"]: stats["rin"] += 1
        if meta["docket_ids"]: stats["docket"] += 1
        if meta["cfr_refs"]: stats["cfr"] += 1
        if meta["fr_volume"]: stats["volissue"] += 1
        if len(examples) < 2 and meta["cfr_refs"] and fields.get("supplementary"):
            examples.append((r["identifier"], title, meta, md))
    n = max(stats["n"], 1)
    print(f"\n=== PARSED {stats['n']} register rules ===")
    for k in ("title", "summary", "suppl", "rin", "docket", "cfr", "volissue"):
        print(f"  {k:9} {stats[k]:5}  ({100*stats[k]//n}%)")
    for ident, title, meta, md in examples:
        print("\n" + "=" * 78)
        print(ident, "->", title)
        print("  meta:", json.dumps({k: v for k, v in meta.items() if v}))
        print("-" * 78)
        print(md[:1600])
    conn.close()


def cmd_apply(limit):
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS register_meta (
            id            integer PRIMARY KEY REFERENCES document_sections(id) ON DELETE CASCADE,
            fr_volume     integer,
            fr_issue      integer,
            fr_doc_number text,
            rin           text[],
            docket_ids    text[],
            cfr_refs      jsonb,
            title         text,
            summary       text,
            parsed_at     timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS register_meta_cfr_gin ON register_meta USING gin (cfr_refs jsonb_path_ops);
    """)
    conn.commit()
    sel = """
        SELECT id, identifier, heading, body_text
        FROM document_sections
        WHERE source_code='register'
          AND section_label IN ('Rules and Regulations','Proposed Rules')
          AND body_text ~ 'AGENCY:'
        ORDER BY id
    """
    if limit:
        sel += f" LIMIT {int(limit)}"
    cur.execute(sel)
    upd = conn.cursor()
    done = 0
    batch_meta, batch_md = [], []
    for r in cur:
        title, fields, meta, md = parse_row(r)
        batch_meta.append((r["id"], meta["fr_volume"], meta["fr_issue"],
                           meta["fr_doc_number"], meta["rin"], meta["docket_ids"],
                           json.dumps(meta["cfr_refs"]), title,
                           first_sentence(fields.get("summary", ""), 1000)))
        batch_md.append((md, r["id"]))
        done += 1
        if len(batch_meta) >= 1000:
            flush(upd, batch_meta, batch_md); conn.commit()
            batch_meta, batch_md = [], []
            print(f"  ...{done}", flush=True)
    if batch_meta:
        flush(upd, batch_meta, batch_md); conn.commit()
    print(f"DONE: parsed + wrote {done} register rules")
    conn.close()


def flush(cur, batch_meta, batch_md):
    psycopg2.extras.execute_values(cur, """
        INSERT INTO register_meta
          (id, fr_volume, fr_issue, fr_doc_number, rin, docket_ids, cfr_refs, title, summary)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
          fr_volume=EXCLUDED.fr_volume, fr_issue=EXCLUDED.fr_issue,
          fr_doc_number=EXCLUDED.fr_doc_number, rin=EXCLUDED.rin,
          docket_ids=EXCLUDED.docket_ids, cfr_refs=EXCLUDED.cfr_refs,
          title=EXCLUDED.title, summary=EXCLUDED.summary, parsed_at=now()
    """, batch_meta)
    psycopg2.extras.execute_values(cur,
        "UPDATE document_sections d SET body_md = v.md "
        "FROM (VALUES %s) AS v(md, id) WHERE d.id = v.id",
        batch_md)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "sample"
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    if mode == "sample":
        cmd_sample(int(arg) if arg else 500)
    elif mode == "apply":
        cmd_apply(int(arg) if arg else None)
    else:
        print(__doc__)
