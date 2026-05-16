#!/usr/bin/env python3
"""
Preprocess USC + IRM archives into NDJSON rows ready to COPY into the
`documents` table.

USAGE
-----

1. Unzip whatever you've got into one folder per source, e.g.:

     ~/codebooks/
         usc/        <- unzip USCxml.zip OR USCxHTML.zip OR pdf_uscAll@119-90.zip here
         irm/        <- unzip every IRM*.zip here (mix of html / pdf is fine)

2. Install deps once:

     python -m pip install lxml beautifulsoup4 pdfminer.six tqdm

3. Run per source:

     python scripts/preprocess_codebooks.py --source usc --input ~/codebooks/usc --out ./out/usc.ndjson
     python scripts/preprocess_codebooks.py --source irm --input ~/codebooks/irm --out ./out/irm.ndjson

4. Send the two .ndjson files back to me (upload to the `docs` bucket or
   attach in chat). I'll `COPY` them into the `documents` table in one shot.

OUTPUT SHAPE  (one JSON object per line, matches the `documents` table)
---------------------------------------------------------------------
    {
      "source_code":   "usc" | "irm",
      "identifier":    "/usc/title-26/section-501"      (unique, URL-safe),
      "parent_label":  "Title 26 - Internal Revenue Code · Subchapter F",
      "section_label": "§ 501",
      "heading":       "Exemption from tax on corporations...",
      "body_text":     "...plain text...",
      "body_md":       "...optional markdown...",
      "hierarchy":     {"title":"26","chapter":"1","section":"501"},
      "sort_key":      "0026.00501",
      "word_count":    1234
    }

Each parser is best-effort. If something looks wrong in the output, run with
`--limit 20 --pretty` to eyeball before committing to a full run.
"""
from __future__ import annotations

import argparse, json, os, re, sys
from pathlib import Path
from typing import Iterator

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(x, **k): return x  # type: ignore

# ----------------------------- helpers ------------------------------------

WS = re.compile(r"\s+")
def norm(s: str | None) -> str:
    return WS.sub(" ", (s or "")).strip()

def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")

def wc(s: str) -> int:
    return len((s or "").split())

def pad(num: str, width: int = 5) -> str:
    digits = re.sub(r"\D", "", num or "")
    return digits.zfill(width) if digits else (num or "")

# ---------------------------- USC: USLM XML --------------------------------
# https://uscode.house.gov/download/resources/schemaandcss.zip

USLM_NS = {"u": "http://schemas.gpo.gov/xml/uslm"}

def _local(el) -> str:
    tag = el.tag
    if isinstance(tag, str) and "}" in tag:
        return tag.split("}", 1)[1]
    return tag if isinstance(tag, str) else ""

def _first_child(el, name: str):
    for child in el:
        if isinstance(child.tag, str) and _local(child) == name:
            return child
    return None

def _first_desc(el, name: str):
    found = el.xpath(f".//*[local-name()='{name}']")
    return found[0] if found else None

def _text(el) -> str:
    return norm("".join(el.itertext()) if el is not None else "")

def parse_uslm(xml_path: Path) -> Iterator[dict]:
    from lxml import etree
    try:
        tree = etree.parse(str(xml_path))
    except Exception as e:
        print(f"  ! skip {xml_path.name}: {e}", file=sys.stderr)
        return
    root = tree.getroot()

    # Be namespace-agnostic. USC releases have changed namespaces over time,
    # and a fixed namespace silently turns whole titles into "0 rows".
    title_el = (root.xpath(".//*[local-name()='main']/*[local-name()='title']") or
                root.xpath(".//*[local-name()='title']"))
    title_el = title_el[0] if title_el else None
    title_num_el = _first_child(title_el, "num") if title_el is not None else None
    title_num = (title_num_el.get("value") if title_num_el is not None else None) \
                or _text(title_num_el).replace("Title", "").strip() \
                or xml_path.stem.replace("usc", "").lstrip("0") or "0"
    title_heading_el = _first_child(title_el, "heading") if title_el is not None else None
    title_heading = _text(title_heading_el)

    for sec in root.xpath(".//*[local-name()='section']"):
        num_el = _first_child(sec, "num")
        head_el = _first_child(sec, "heading")
        sec_num = (num_el.get("value") if num_el is not None else None) or _text(num_el)
        if not sec_num:
            continue
        sec_num = re.sub(r"^§+\s*", "", sec_num).rstrip(".")
        heading = _text(head_el)

        # nearest chapter / subchapter for parent_label
        chapter = None
        for anc in sec.iterancestors():
            tag = _local(anc)
            if tag in ("chapter", "subchapter", "part"):
                c_num = _first_child(anc, "num")
                c_head = _first_child(anc, "heading")
                if c_num is not None or c_head is not None:
                    label = " ".join(filter(None, [_text(c_num), _text(c_head)]))
                    chapter = label if chapter is None else chapter
                    break

        # body = all text under the section minus num/heading
        body_parts: list[str] = []
        for el in sec.iter():
            if _local(el) in ("num", "heading"):
                continue
            if el.text:
                body_parts.append(el.text)
            if el.tail:
                body_parts.append(el.tail)
        body = norm(" ".join(body_parts))

        parent = f"Title {title_num} - {title_heading}".rstrip(" -")
        if chapter:
            parent = f"{parent} · {chapter}"

        yield {
            "source_code": "usc",
            "identifier": f"/usc/title-{title_num}/section-{slug(sec_num)}",
            "parent_label": parent,
            "section_label": f"§ {sec_num}",
            "heading": heading,
            "body_text": body,
            "body_md": None,
            "hierarchy": {"title": title_num, "section": sec_num},
            "sort_key": f"{pad(title_num, 4)}.{pad(sec_num)}",
            "word_count": wc(body),
        }

# ---------------------------- USC: xHTML -----------------------------------

def parse_usc_html(html_path: Path) -> Iterator[dict]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8", errors="ignore"), "lxml")
    # GPO releases use <h3 class="section-head"> etc. Be forgiving.
    title_el = soup.find(class_=re.compile("title-head", re.I)) or soup.find("h1")
    title_text = norm(title_el.get_text() if title_el else "")
    m = re.search(r"Title\s+(\d+)", title_text)
    title_num = m.group(1) if m else (re.sub(r"\D", "", html_path.stem) or "0")

    for sec in soup.find_all(class_=re.compile(r"\bsection\b", re.I)):
        head = sec.find(class_=re.compile("section-head", re.I)) or sec.find(["h3", "h2"])
        head_text = norm(head.get_text() if head else "")
        m = re.match(r"[§\s]*([\w\-.]+)\.?\s*(.*)", head_text)
        if not m:
            continue
        sec_num, heading = m.group(1), m.group(2)
        body = norm(sec.get_text(" "))
        # strip the heading from body
        if head:
            body = norm(body.replace(head_text, "", 1))
        yield {
            "source_code": "usc",
            "identifier": f"/usc/title-{title_num}/section-{slug(sec_num)}",
            "parent_label": f"Title {title_num}{(' - ' + title_text) if title_text else ''}",
            "section_label": f"§ {sec_num}",
            "heading": heading,
            "body_text": body,
            "body_md": None,
            "hierarchy": {"title": title_num, "section": sec_num},
            "sort_key": f"{pad(title_num,4)}.{pad(sec_num)}",
            "word_count": wc(body),
        }

# ---------------------------- IRM: HTML ------------------------------------
# Internal Revenue Manual chapters publish as html with <h1> chapter title +
# numbered subsections like "1.2.3.4 (mm-dd-yyyy) Heading".

IRM_NUM = re.compile(r"^\s*(\d+(?:\.\d+){1,5})\b\s*(?:\([^)]*\))?\s*(.*)")

def parse_irm_html(html_path: Path) -> Iterator[dict]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8", errors="ignore"), "lxml")
    title_el = soup.find("h1") or soup.find("title")
    chapter_title = norm(title_el.get_text() if title_el else html_path.stem)

    # heading-based chunking
    headings = soup.find_all(re.compile(r"^h[2-5]$"))
    if not headings:
        # whole doc as one entry
        body = norm(soup.get_text(" "))
        yield _irm_row(html_path.stem, chapter_title, "", body)
        return

    for i, h in enumerate(headings):
        head_text = norm(h.get_text())
        m = IRM_NUM.match(head_text)
        if not m:
            continue
        section_num, heading = m.group(1), m.group(2)
        # body = siblings until next heading
        chunks: list[str] = []
        for sib in h.next_siblings:
            if getattr(sib, "name", None) and re.match(r"^h[2-5]$", sib.name or ""):
                break
            chunks.append(sib.get_text(" ") if hasattr(sib, "get_text") else str(sib))
        body = norm(" ".join(chunks))
        yield _irm_row(section_num, chapter_title, heading, body)

def _irm_row(section_num: str, chapter_title: str, heading: str, body: str) -> dict:
    parts = section_num.split(".")
    part_num = parts[0] if parts else ""
    return {
        "source_code": "irm",
        "identifier": f"/irm/{section_num}",
        "parent_label": f"Part {part_num} · {chapter_title}".strip(" ·"),
        "section_label": f"IRM {section_num}",
        "heading": heading,
        "body_text": body,
        "body_md": None,
        "hierarchy": {"part": part_num, "section": section_num},
        "sort_key": ".".join(pad(p, 4) for p in parts),
        "word_count": wc(body),
    }

# ---------------------------- PDFs (fallback) ------------------------------
# Whole-PDF-per-row. Good enough until you replace with structured source.

def parse_pdf(pdf_path: Path, source: str) -> Iterator[dict]:
    try:
        from pdfminer.high_level import extract_text
        text = norm(extract_text(str(pdf_path)))
    except Exception as e:
        print(f"  ! skip pdf {pdf_path.name}: {e}", file=sys.stderr)
        return
    if not text:
        return
    ident = f"/{source}/pdf/{slug(pdf_path.stem)}"
    yield {
        "source_code": source,
        "identifier": ident,
        "parent_label": "PDF imports",
        "section_label": pdf_path.stem,
        "heading": pdf_path.stem,
        "body_text": text,
        "body_md": None,
        "hierarchy": {"file": pdf_path.name},
        "sort_key": f"zzz.{pdf_path.stem.lower()}",
        "word_count": wc(text),
    }

# ----------------------------- driver --------------------------------------

def walk(root: Path, source: str, limit: int | None) -> Iterator[dict]:
    n = 0
    files = sorted(root.rglob("*"))
    # Diagnostics: count files by extension so we can tell what we're working with
    ext_counts: dict[str, int] = {}
    for p in files:
        if p.is_file():
            ext_counts[p.suffix.lower()] = ext_counts.get(p.suffix.lower(), 0) + 1
    print(f"file extensions found: {ext_counts}")
    per_file_rows: dict[str, int] = {}
    for p in tqdm(files, desc=f"scan {source}"):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        try:
            if source == "usc" and ext == ".xml":
                rows = parse_uslm(p)
            elif source == "usc" and ext in (".html", ".htm", ".xhtml"):
                rows = parse_usc_html(p)
            elif source == "irm" and ext in (".html", ".htm", ".xhtml"):
                rows = parse_irm_html(p)
            elif ext == ".pdf":
                rows = parse_pdf(p, source)
            else:
                continue
            file_rows = 0
            for row in rows:
                yield row
                n += 1
                file_rows += 1
                if limit and n >= limit:
                    print(f"  hit --limit {limit} on {p.name}")
                    return
            per_file_rows[p.name] = file_rows
            if file_rows == 0:
                print(f"  ! 0 rows from {p.name} (parser ran but found nothing)")
        except Exception as e:
            print(f"  ! error on {p}: {e}", file=sys.stderr)
    nonzero = sum(1 for v in per_file_rows.values() if v > 0)
    print(f"processed {len(per_file_rows)} files, {nonzero} produced rows")

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, choices=["usc", "irm"])
    ap.add_argument("--input", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--limit", type=int, default=None, help="stop after N rows (testing)")
    ap.add_argument("--pretty", action="store_true", help="indent JSON (debug only — don't use for final run)")
    args = ap.parse_args()

    # Expand ~ and resolve — Path() does NOT do this automatically (esp. on Windows).
    args.input = Path(os.path.expanduser(str(args.input))).resolve()
    args.out = Path(os.path.expanduser(str(args.out))).resolve()
    if not args.input.exists():
        sys.exit(f"ERROR: input folder does not exist: {args.input}\n"
                 f"Pass a real path, e.g. --input C:\\Downloads\\irm")
    if not args.input.is_dir():
        sys.exit(f"ERROR: --input must be a folder, got a file: {args.input}")
    sample = [p for p in args.input.rglob('*') if p.is_file()][:5]
    if not sample:
        sys.exit(f"ERROR: no files found under {args.input}. Did you unzip the archives into that folder?")
    print(f"input: {args.input}  (found files, e.g. {[p.name for p in sample]})")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    dupes = 0
    written = 0
    with args.out.open("w", encoding="utf-8") as f:
        for row in walk(args.input, args.source, args.limit):
            if row["identifier"] in seen:
                dupes += 1
                continue
            seen.add(row["identifier"])
            f.write(json.dumps(row, ensure_ascii=False, indent=2 if args.pretty else None))
            f.write("\n")
            written += 1
    print(f"wrote {written} rows to {args.out}  (dedup skipped {dupes})")

if __name__ == "__main__":
    main()