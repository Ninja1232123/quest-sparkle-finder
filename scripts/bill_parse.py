#!/usr/bin/env python3
"""
Congressional bill stage-collapse + USC-amendment parser.

The `bill` corpus stores 835k sections, but each *bill* exists as several near-
duplicate STAGES (GPO version codes: ih introduced, rh reported, eh engrossed,
enr enrolled, ...). The identifier encodes the whole path:

    /bill/{congress}/{type}/{number}/{stage}/{section}
    /bill/119/hr/6813/ih/preamble

This collapses the stages back to one bill identity (`bill_key` = the first four
segments) and records, per bill: every stage present, the furthest-progressed
("canonical") stage, the bill's long + short title and sponsor, whether it was
enacted, and — the join key — the U.S. Code titles/sections it proposes to amend.

That USC cross-ref is the legislative-history mirror of register_meta.cfr_refs:
from a USC section you can later surface the bills that amended (or tried to
amend) it — Congress's own words behind the codified text.

Usage:
  python3 scripts/bill_parse.py sample [N]    # group N bills, no writes, print stats + examples
  python3 scripts/bill_parse.py apply [LIMIT]  # build bill_meta (all bills, or first LIMIT rows scanned)

Targets the local self_law corpus DB (NOT the cloud auth project).
"""
import sys, re, json
import psycopg2, psycopg2.extras

DB = "self_law"

# GPO bill version codes ranked by how far the bill progressed. The canonical
# stage is the highest rank present — the most authoritative text. Enrolled
# (passed both chambers, presented to the President) tops it; introduced floors.
STAGE_RANK = {
    "enr": 100,                                  # enrolled — final
    "pap": 92, "pp": 90,                          # public/printed as passed
    "ats": 88, "ath": 88, "as": 88,              # agreed to (resolutions)
    "es": 80, "eh": 80, "eas": 78, "eah": 78,    # engrossed (+ amendments)
    "rs": 70, "rh": 70, "ris": 68, "rih": 68,    # reported
    "pcs": 60, "cps": 58, "cph": 58, "cds": 56,  # placed on / calendar
    "rfs": 50, "rfh": 50, "rds": 48, "rdh": 48,  # referred / received
    "rcs": 46, "rch": 46, "rts": 46, "rth": 46,
    "ips": 44, "hds": 44, "lth": 44, "fph": 44, "fps": 44, "rhuc": 44,
    "is": 10, "ih": 10,                          # introduced
}
DEFAULT_RANK = 30  # unknown/rare stage: above introduced, below the named flow

# "title 38, United States Code" / "title 38 of the United States Code"
RE_USC_TITLE = re.compile(r'\btitle\s+(\d{1,2})\b[,]?\s+(?:of\s+the\s+)?United States Code', re.I)
# "section 1983 of title 42" — specific section + its title
RE_USC_SEC = re.compile(r'\bsection\s+(\d[0-9A-Za-z\-]{0,12})\s+of\s+title\s+(\d{1,2})\b', re.I)
RE_SHORT = re.compile(r'cited as the\s+[“"\']?(.{3,120}? Act(?:\s+of\s+\d{4})?)', re.I)
RE_SPONSOR = re.compile(r'Sponsor:\s*([^—\n|]{2,80})')

BILL_TYPES = {"hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"}


def parse_ident(identifier: str):
    """/bill/119/hr/6813/ih/preamble -> (bill_key, congress, btype, number, stage)."""
    seg = identifier.strip("/").split("/")
    # seg = ['bill','119','hr','6813','ih','preamble']
    if len(seg) < 5 or seg[0] != "bill":
        return None
    congress, btype, number, stage = seg[1], seg[2], seg[3], seg[4]
    bill_key = "/" + "/".join(seg[:4])
    return bill_key, congress, btype, number, stage


def add_usc_refs(refs: dict, text: str):
    """Accumulate {title:int -> set(section str)} from one body of text."""
    for sec, title in RE_USC_SEC.findall(text):
        refs.setdefault(int(title), set()).add(sec.lstrip("0") or sec)
    # bare title mentions register the title even with no specific section
    for title in RE_USC_TITLE.findall(text):
        refs.setdefault(int(title), set())


class BillAcc:
    """Accumulates every row of one bill_key as the stream passes through it."""
    __slots__ = ("key", "congress", "btype", "number", "stages",
                 "best_rank", "best_stage", "best_pre_id", "title", "short",
                 "sponsor", "refs", "secs")

    def __init__(self, key, congress, btype, number):
        self.key = key
        self.congress = int(congress) if congress.isdigit() else None
        self.btype = btype
        self.number = int(number) if number.isdigit() else None
        self.stages = set()
        self.best_rank = -1
        self.best_stage = None
        self.best_pre_id = None     # preamble identifier of the canonical stage
        self.title = None
        self.short = None
        self.sponsor = None
        self.refs = {}
        self.secs = set()

    def add(self, identifier, stage, section, heading, body):
        self.stages.add(stage)
        rank = STAGE_RANK.get(stage, DEFAULT_RANK)
        is_pre = section == "preamble"
        if rank > self.best_rank:
            self.best_rank, self.best_stage = rank, stage
        if is_pre and rank >= self.best_rank:
            self.best_pre_id = identifier
        # Bill title + sponsor live in the preamble; prefer a canonical-stage one.
        if is_pre and (self.title is None or rank >= self.best_rank):
            if heading:
                self.title = re.sub(r'\s+', ' ', heading).strip()
            sp = RE_SPONSOR.search(body or "")
            if sp:
                self.sponsor = sp.group(1).strip(" .,—-")
        else:
            self.secs.add(section)
        sh = RE_SHORT.search(body or "")
        if sh and not self.short:
            self.short = sh.group(1).strip(" .,”\"'")
        if body and "United States Code" in body:
            add_usc_refs(self.refs, body)

    def row(self):
        usc = [{"title": t, "sections": sorted(s)} for t, s in sorted(self.refs.items())]
        # Link target: the canonical stage's preamble, else the bill key itself.
        latest_id = self.best_pre_id or f"{self.key}/{self.best_stage}/preamble"
        return (
            self.key, self.congress, self.btype, self.number,
            self.title, self.short, self.sponsor,
            sorted(self.stages), self.best_stage, latest_id,
            "enr" in self.stages, json.dumps(usc), len(self.secs),
        )


def connect():
    return psycopg2.connect(dbname=DB, cursor_factory=psycopg2.extras.RealDictCursor)


def stream(rconn, limit):
    sel = ("SELECT identifier, heading, body_text FROM document_sections "
           "WHERE source_code='bill' ORDER BY identifier")
    if limit:
        sel += f" LIMIT {int(limit)}"
    cur = rconn.cursor(name="bill_scan", cursor_factory=psycopg2.extras.RealDictCursor)
    cur.itersize = 2000
    cur.execute(sel)
    acc = None
    for r in cur:
        p = parse_ident(r["identifier"])
        if not p:
            continue
        key, congress, btype, number, stage = p
        seg = r["identifier"].strip("/").split("/")
        section = seg[5] if len(seg) > 5 else "preamble"
        if acc is None or acc.key != key:
            if acc is not None:
                yield acc
            acc = BillAcc(key, congress, btype, number)
        acc.add(r["identifier"], stage, section, r["heading"], r["body_text"])
    if acc is not None:
        yield acc


def cmd_sample(n):
    # Sample groups whole bills: scan rows until we've closed n bills.
    rconn = connect()
    stats = {"n": 0, "title": 0, "short": 0, "sponsor": 0, "usc": 0,
             "multistage": 0, "enacted": 0}
    examples = []
    # Scan a generous row window so we actually close full bills.
    for acc in stream(rconn, limit=n * 40):
        r = acc.row()
        stats["n"] += 1
        if r[4]: stats["title"] += 1
        if r[5]: stats["short"] += 1
        if r[6]: stats["sponsor"] += 1
        if json.loads(r[11]): stats["usc"] += 1
        if len(r[7]) > 1: stats["multistage"] += 1
        if r[10]: stats["enacted"] += 1
        if len(examples) < 3 and json.loads(r[11]) and len(r[7]) > 1:
            examples.append(r)
        if stats["n"] >= n:
            break
    rconn.close()
    d = max(stats["n"], 1)
    print(f"\n=== GROUPED {stats['n']} bills ===")
    for k in ("title", "short", "sponsor", "usc", "multistage", "enacted"):
        print(f"  {k:11} {stats[k]:5}  ({100*stats[k]//d}%)")
    for r in examples:
        print("\n" + "=" * 78)
        print(f"{r[0]}  stages={r[7]} canonical={r[8]} enacted={r[10]}")
        print(f"  title: {r[4]}")
        print(f"  short: {r[5]}   sponsor: {r[6]}")
        print(f"  usc_refs: {r[11]}")
        print(f"  link: {r[9]}")


def cmd_apply(limit):
    rconn = connect()
    wconn = connect(); wconn.autocommit = False
    cur = wconn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bill_meta (
            bill_key      text PRIMARY KEY,
            congress      integer,
            bill_type     text,
            number        integer,
            title         text,
            short_title   text,
            sponsor       text,
            stages        text[],
            latest_stage  text,
            latest_id     text,
            enacted       boolean,
            usc_refs      jsonb,
            section_count integer,
            parsed_at     timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS bill_meta_usc_gin ON bill_meta USING gin (usc_refs jsonb_path_ops);
        CREATE INDEX IF NOT EXISTS bill_meta_congress_idx ON bill_meta (congress DESC, number);
    """)
    wconn.commit()
    upd = wconn.cursor()
    done = 0
    batch = []
    for acc in stream(rconn, limit):
        batch.append(acc.row())
        done += 1
        if len(batch) >= 1000:
            flush(upd, batch); wconn.commit()
            batch = []
            print(f"  ...{done} bills", flush=True)
    if batch:
        flush(upd, batch); wconn.commit()
    print(f"DONE: collapsed + wrote {done} bills")
    rconn.close(); wconn.close()


def flush(cur, batch):
    psycopg2.extras.execute_values(cur, """
        INSERT INTO bill_meta
          (bill_key, congress, bill_type, number, title, short_title, sponsor,
           stages, latest_stage, latest_id, enacted, usc_refs, section_count)
        VALUES %s
        ON CONFLICT (bill_key) DO UPDATE SET
          congress=EXCLUDED.congress, bill_type=EXCLUDED.bill_type,
          number=EXCLUDED.number, title=EXCLUDED.title,
          short_title=EXCLUDED.short_title, sponsor=EXCLUDED.sponsor,
          stages=EXCLUDED.stages, latest_stage=EXCLUDED.latest_stage,
          latest_id=EXCLUDED.latest_id, enacted=EXCLUDED.enacted,
          usc_refs=EXCLUDED.usc_refs, section_count=EXCLUDED.section_count,
          parsed_at=now()
    """, batch)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "sample"
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    if mode == "sample":
        cmd_sample(int(arg) if arg else 200)
    elif mode == "apply":
        cmd_apply(int(arg) if arg else None)
    else:
        print(__doc__)
