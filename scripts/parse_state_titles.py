#!/usr/bin/env python3
"""Parse the Justia TOC dump (/home/k/state_title) into (state, type, number) ->
name, then cross-check against the actual parent_label structure in
document_sections. Dry-run: reports coverage, writes nothing."""
import re, subprocess, sys, os
from collections import defaultdict

# The Justia state-code TOC dump (state header lines + Title/Chapter/… entries).
# Tracked alongside this script for reproducibility.
FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "justia-state-toc.txt")

STATE_CODE = {
 "alabama":"al","alaska":"ak","arizona":"az","arkansas":"ar","california":"ca",
 "colorado":"co","connecticut":"ct","delaware":"de","florida":"fl","georgia":"ga",
 "hawaii":"hi","idaho":"id","illinois":"il","indiana":"in","iowa":"ia","kansas":"ks",
 "kentucky":"ky","louisiana":"la","maine":"me","maryland":"md","massachusetts":"ma",
 "michigan":"mi","minnesota":"mn","mississippi":"ms","missouri":"mo","montana":"mt",
 "nebraska":"ne","nevada":"nv","new hampshire":"nh","new jersey":"nj","new mexico":"nm",
 "new york":"ny","north carolina":"nc","north dakota":"nd","ohio":"oh","oklahoma":"ok",
 "oregon":"or","pennsylvania":"pa","rhode island":"ri","south carolina":"sc",
 "south dakota":"sd","tennessee":"tn","texas":"tx","utah":"ut","vermont":"vt",
 "virginia":"va","washington":"wa","west virginia":"wv","wisconsin":"wi","wyoming":"wy",
}

YEAR_HDR = re.compile(r"^[0-9]{4}\s+(.*)$")
ENTRY = re.compile(r"^(Title|Chapter|Division|Part|Subtitle|Subchapter|Article)\s+"
                   r"([0-9]+[A-Za-z]?|[IVXLCDM]+[A-Za-z]?)\s*[.\-–—]\s*(.+?)\s*$",
                   re.IGNORECASE)

def state_from_header(h):
    hl = h.lower()
    # longest name first so "new york" beats "york"-ish partials
    for name in sorted(STATE_CODE, key=len, reverse=True):
        if name in hl:
            return STATE_CODE[name]
    return None

def parse():
    # data[code][type][number] = name
    data = defaultdict(lambda: defaultdict(dict))
    cur = None
    for raw in open(FILE, encoding="utf-8"):
        line = raw.rstrip("\n").strip()
        if not line:
            continue
        m = YEAR_HDR.match(line)
        if m:
            cur = state_from_header(m.group(1))
            continue
        if cur is None:
            continue
        e = ENTRY.match(line)
        if e:
            typ = e.group(1).lower()
            num = e.group(2).upper()
            name = clean_name(e.group(3))
            if name:
                data[cur][typ][num] = name
    return data

def db_labels(code):
    q = ("select distinct split_part(parent_label,' · ',1) "
         "from document_sections where source_code='%s'" % code)
    out = subprocess.run(["psql","-d","self_law","-tA","-c",q],
                         capture_output=True, text=True).stdout
    return [l for l in out.splitlines() if l.strip()]

SEG = re.compile(r"^(Title|Chapter|Division|Part|Subtitle|Subchapter|Article)\s+"
                 r"([0-9]+[A-Za-z]?|[IVXLCDM]+[A-Za-z]?)\.?$", re.IGNORECASE)

CH_TAIL = re.compile(r"\s+Ch\.\s*[0-9IVXLC].*$")        # FL "… Ch. 760-765"
def clean_name(n):
    n = CH_TAIL.sub("", n)
    n = re.sub(r"\s+", " ", n).strip().rstrip(".")
    return n

def distinct_full_labels(code):
    q = ("select distinct parent_label from document_sections "
         "where source_code='%s'" % code)
    out = subprocess.run(["psql","-d","self_law","-tA","-c",q],
                         capture_output=True, text=True).stdout
    return [l for l in out.splitlines() if l.strip()]

def rename_label(label, types):
    """Replace each bare 'Type Num' segment with 'Type Num — Name' where known."""
    segs = label.split(" · ")
    changed = False
    out = []
    for seg in segs:
        s = SEG.match(seg.strip())
        if s:
            typ, num = s.group(1).lower(), s.group(2).upper()
            nm = types.get(typ, {}).get(num)
            if nm:
                # Preserve original capitalisation of "Type Num" minus trailing dot.
                base = seg.strip().rstrip(".")
                out.append(f"{base} — {nm}")
                changed = True
                continue
        out.append(seg)
    return (" · ".join(out), changed)

def main():
    apply = "--apply" in sys.argv
    data = parse()
    print("Parsed %d state blocks from %s\n" % (len(data), FILE))
    rows = []  # (code, old_label, new_label)
    for code in sorted(data):
        types = data[code]
        labels = distinct_full_labels(code)
        changed = 0
        for lab in labels:
            new, ch = rename_label(lab, types)
            if ch:
                rows.append((code, lab, new)); changed += 1
        flag = "" if changed else "   (no matches — granularity mismatch?)"
        print(f"[{code}] distinct_labels={len(labels)} renamed={changed}{flag}")
    print(f"\nTotal distinct labels to rename: {len(rows)}")
    if not apply:
        print("\nDry-run. Re-run with --apply to write.")
        return
    # Write TSV and load via temp table + UPDATE join (no SQL injection).
    tsv = "/tmp/label_rename.tsv"
    with open(tsv, "w", encoding="utf-8") as f:
        for code, old, new in rows:
            f.write(f"{code}\t{old}\t{new}\n")
    sql = f"""
\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE label_rename(source_code text, old_label text, new_label text);
\\copy label_rename FROM '{tsv}' WITH (FORMAT text, DELIMITER E'\\t');
UPDATE public.document_sections d
SET parent_label = r.new_label
FROM label_rename r
WHERE d.source_code = r.source_code AND d.parent_label = r.old_label;
COMMIT;
"""
    p = subprocess.run(["psql","-d","self_law"], input=sql, capture_output=True, text=True)
    print(p.stdout.strip()); print(p.stderr.strip())

if __name__ == "__main__":
    main()
