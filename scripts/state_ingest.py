#!/usr/bin/env python3
"""
state_ingest.py — one engine, many adapters, for the 50-state statute scrape.

The scrape on /mnt/sdb1/States/<State>/ is the same shape for every state:
    manifest.tsv         url <TAB> pages/<md5>.html <TAB> http_status <TAB> bytes
    pages/<md5>.html     the raw fetched body (HTML / XML / sometimes a PDF)

You cannot write ONE parser for ~40 different legislature websites. So this is
ONE engine — discover -> sniff bytes -> decode -> dispatch by domain -> clean ->
normalise to the folder model -> QA / load — plus a thin ADAPTER per source.

The folder model (see state_sections.sql): each output row is just
    path        folder names, outer -> inner   e.g. ['California Codes','Labor Code']
    heading     the leaf's own title           e.g. '§ 7856'
    body_text   the hunk of law
Everything else the page carried (nav, history notes, annotations) is trash.

Most sources need only a declarative Rule (a few CSS selectors). The genuinely
weird ones (California's XML fragments, Texas' one-chapter-per-page <pre>) get a
custom function. Adding a normal state later = one SOURCES entry.

USAGE
    python3 scripts/state_ingest.py --state California --limit 20        # dry sample
    python3 scripts/state_ingest.py --state Texas --limit 5 --show       # print bodies
    python3 scripts/state_ingest.py --state Ohio --apply                 # load to PG
    python3 scripts/state_ingest.py --all --apply                        # every wired state

PHASE 1 wires the clean HTML/XML families (CA, TX, OH, FL, AZ as proof; more are
trivial config). PDF states (IA/ND/OK/KY), Colorado docx, and NJ frames are
phase 2 and are skipped with a logged reason.
"""

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Callable, Optional
from urllib.parse import urlparse, parse_qs, unquote

from bs4 import BeautifulSoup, NavigableString, Tag

# Default to the USB archive, but allow staging on fast storage (e.g. tmpfs at
# /dev/shm/States) via STATE_ROOT — the USB disk is a ~30-IOPS bottleneck, so we
# bulk-copy a state to RAM and parse from there. Set once; children inherit it.
ROOT = os.environ.get("STATE_ROOT", "/mnt/sdb1/States")

# USPS code per state-folder name (our short browse key).
STATE_CODE = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
    "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}


# ─────────────────────────────────────────────────────────────────────────────
# shared text helpers
# ─────────────────────────────────────────────────────────────────────────────

def norm(s: str) -> str:
    """Collapse whitespace; keep the text, lose the formatting noise."""
    return re.sub(r"\s+", " ", (s or "")).strip()


# Sites whose bytes auto-detect wrong; force the right codec (Alaska = cp1252 dashes).
ENCODING_OVERRIDE = {"www.akleg.gov": "cp1252"}


def decode_bytes(raw: bytes, enc: Optional[str] = None) -> str:
    """Best-effort decode. Scrapes mix UTF-8, cp1252 smart-quotes (Alaska), etc."""
    if enc:
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    try:
        from charset_normalizer import from_bytes
        best = from_bytes(raw).best()
        if best is not None:
            return str(best)
    except Exception:
        pass
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def sniff(raw: bytes) -> str:
    """What did we actually fetch? (URL extension lies — KY's .aspx is a PDF.)"""
    head = raw[:512].lstrip()
    if head[:4] == b"%PDF":
        return "pdf"
    if head[:2] == b"PK":          # zip / docx / xlsx
        return "zip"
    low = head[:200].lower()
    if low.startswith(b"<?xml") and b"<html" not in low:
        return "xml"
    return "html"


def pdf_to_text(path: str) -> str:
    """Extract a born-digital PDF with poppler's `pdftotext -layout`, which keeps
    column/indent structure (so a wrapped paragraph stays one visual block and
    indentation still marks where a new paragraph or subsection begins). Every
    state PDF in the corpus is born-digital — no OCR needed. `-nopgbrk` drops the
    form-feed page breaks; the PDF adapters strip the repeated running
    header/footer each page carries by line pattern, not by page position."""
    out = subprocess.run(
        ["pdftotext", "-layout", "-enc", "UTF-8", "-nopgbrk", path, "-"],
        capture_output=True, timeout=180,
    )
    if out.returncode != 0:
        raise RuntimeError(f"pdftotext failed: {out.stderr.decode('utf-8','replace')[:200]}")
    return out.stdout.decode("utf-8", "replace")


def pdf_paragraphs(lines):
    """Rejoin `pdftotext -layout` lines into paragraphs. The layout extractor
    hard-wraps a paragraph across several lines; the convention every state PDF
    shares is that a NEW paragraph (or subsection) is indented while its wrapped
    continuation lines sit at the left margin. So: a blank line or a fresh
    indented line closes the current paragraph; an unindented line continues it.
    Returns cleaned, norm()'d paragraph strings."""
    paras, buf = [], []
    for ln in lines:
        if not ln.strip():
            if buf:
                paras.append(" ".join(buf)); buf = []
            continue
        if ln[:1].isspace() and buf:
            paras.append(" ".join(buf)); buf = []
        buf.append(ln.strip())
    if buf:
        paras.append(" ".join(buf))
    return [norm(p) for p in paras if norm(p)]


_BLOCK = {"p", "div", "li", "br", "tr", "section", "article", "blockquote",
          "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "pre"}


def block_text(el: Tag) -> str:
    """
    Flatten an element to clean text, treating block tags as paragraph breaks
    and inline tags (span/a/b/i/font) as part of the surrounding run. This is the
    one extractor every HTML adapter shares — it copes with <p> bodies (AZ, OH),
    <div class=Subsection> bodies (FL), and <p> caml fragments (CA) identically.
    """
    parts: list[tuple[str, str]] = []

    def rec(node):
        for child in node.children:
            if isinstance(child, NavigableString):
                t = str(child)
                if t.strip():
                    parts.append(("t", t))
            elif isinstance(child, Tag):
                if child.name in ("script", "style", "noscript", "template"):
                    continue
                if child.name in _BLOCK:
                    parts.append(("b", ""))
                    rec(child)
                    parts.append(("b", ""))
                else:
                    rec(child)

    rec(el)

    paras, buf = [], []
    for kind, val in parts:
        if kind == "t":
            buf.append(val)
        else:
            line = norm(" ".join(buf))
            if line:
                paras.append(line)
            buf = []
    line = norm(" ".join(buf))
    if line:
        paras.append(line)
    return "\n\n".join(paras)


def natural_sort_key(*tokens: str) -> str:
    """
    Stable browse order: zero-pad every numeric run in the citation tokens so
    '10' sorts after '2' and '1.01' sorts sensibly. Works for '7856', '10-120',
    '101.001', 'Title 10'.
    """
    s = " ".join(t for t in tokens if t)
    return re.sub(r"\d+", lambda m: m.group().zfill(8), s)


def section_from_text(s: str) -> Optional[str]:
    """Pull a leading section-number-ish token from a heading."""
    m = re.search(r"(\d+[\w.\-]*)", s or "")
    return m.group(1) if m else None


def heading_from_first_sentence(body: str) -> Optional[str]:
    """
    Many sites bury the section title at the head of the text itself, e.g.
    '[ §369-1] Findings and purpose. The legislature...' or
    '53H-10-203. Office facilities... Plan. (1) The Board...'. Take the leading
    'number. Catchline.' and stop at the first subsection / sentence start.
    """
    if not body:
        return None
    paras = body.split("\n\n")
    i = 0
    while i < len(paras) and re.match(r"(?i)^\(?\s*effective\b", paras[i].strip()):
        i += 1
    first = (paras[i] if i < len(paras) else paras[0]).strip()
    # some sites put a bare section number on its own line, catchline on the next
    if i + 1 < len(paras) and re.match(r"^(?:§+\s*)?[\d][\w.\-]*\.?$", first):
        first = f"{first} {paras[i + 1].strip()}"
    # "Sec. 01.05.006. Adoption..." / "1-1-101. Short title. (1)..." ->
    # designator (optional Sec.) then the catchline sentence
    m = re.match(r"^((?:Secs?\.\s+)?\[?\s*§*\s*\d[\w.\-]*\s*\]?\.)\s+(.{2,150}?\.)(?:\s|$)", first)
    if m:
        head = f"{m.group(1)} {m.group(2)}"
    else:
        # "[ §369-1] Findings and purpose. The..." -> just the first sentence
        m2 = re.match(r"^(.{3,170}?\.)\s+(?=\(|\[|—|\d|[A-Z])", first)
        head = m2.group(1) if m2 else first[:170]
    return head.strip() or None


# ─────────────────────────────────────────────────────────────────────────────
# the record + the declarative rule for the common HTML case
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Rule:
    """Declarative adapter for 'one tidy section per HTML page' sources."""
    body_css: str                              # container holding the law text
    heading_css: Optional[str] = None          # leaf title element(s), joined
    heading_drop_css: tuple = ()               # remove these from the heading element
    crumbs_css: Optional[str] = None           # breadcrumb NODE elements (each = a folder)
    crumbs_one_css: Optional[str] = None        # single breadcrumb element to split
    crumbs_split: str = ">"                    # delimiter for crumbs_one_css
    crumbs_drop: tuple = ()                    # crumb labels to discard (nav junk)
    crumbs_drop_last: int = 0                  # drop N trailing crumbs (the leaf itself)
    drop_css: tuple = ()                       # remove these from body before extract
    top_folder: Optional[str] = None           # static outermost folder if no crumbs
    url_path: Optional[Callable] = None        # fn(url)->list[str] hierarchy fallback
    heading_from_body: bool = False            # derive the leaf title from the body's first sentence


def make_record(state, url, path, heading, body, section_num=None):
    body = (body or "").strip()
    path = [norm(p) for p in path if norm(p)]
    if heading:
        heading = re.sub(r"\s+([.,;:])", r"\1", norm(heading))  # "10-120 ." -> "10-120."
    if section_num is None and heading:
        section_num = section_from_text(heading)
    return {
        "state": state,
        "state_code": STATE_CODE.get(state, state[:2].upper()),
        "path": path,
        "heading": heading,
        "section_num": section_num,
        "body_text": body,
        "body_md": None,
        "word_count": len(body.split()),
        "source_url": url,
        "sort_key": natural_sort_key(*path, section_num or heading or ""),
    }


def generic_parse(state, url, soup: BeautifulSoup, rule: Rule):
    body_el = soup.select_one(rule.body_css)
    if body_el is None:
        return []

    # 1. hierarchy (read text first): crumb nodes > single crumb split > url > static
    path = []
    if rule.crumbs_css:
        path = [norm(n.get_text(" ")) for n in soup.select(rule.crumbs_css)]
    elif rule.crumbs_one_css:
        one = soup.select_one(rule.crumbs_one_css)
        if one is not None:
            path = [norm(p) for p in one.get_text(" ").split(rule.crumbs_split)]
    if not path and rule.url_path:
        path = rule.url_path(url)
    path = [p for p in path if p and p not in rule.crumbs_drop]
    if rule.crumbs_drop_last:
        path = path[: -rule.crumbs_drop_last] or path
    if rule.top_folder and (not path or path[0] != rule.top_folder):
        path = [rule.top_folder] + path

    # 2. heading: join the title element(s), stripping any breadcrumb/info child
    heading = None
    if rule.heading_css:
        chunks = []
        for h in soup.select(rule.heading_css):
            for sel in rule.heading_drop_css:
                for n in h.select(sel):
                    n.decompose()
            t = norm(h.get_text(" "))
            if t:
                chunks.append(t)
        if chunks:
            heading = " ".join(chunks).replace(" | ", " — ")

    # 3. drop trash from the body, then flatten
    for sel in rule.drop_css:
        for n in body_el.select(sel):
            n.decompose()
    body = block_text(body_el)
    if not body:
        return []
    if not heading and rule.heading_from_body:
        heading = heading_from_first_sentence(body)
    return [make_record(state, url, path, heading, body)]


# ─────────────────────────────────────────────────────────────────────────────
# custom adapters (the formats a Rule can't express)
# ─────────────────────────────────────────────────────────────────────────────

# California: every page is a <caml:Content> XML fragment — body only, no
# hierarchy in the markup. The citation lives entirely in the URL query string.
CA_CODES = {
    "BPC": "Business and Professions Code", "CIV": "Civil Code",
    "CCP": "Code of Civil Procedure", "COM": "Commercial Code",
    "CORP": "Corporations Code", "EDC": "Education Code",
    "ELEC": "Elections Code", "EVID": "Evidence Code", "FAM": "Family Code",
    "FIN": "Financial Code", "FGC": "Fish and Game Code",
    "FAC": "Food and Agricultural Code", "GOV": "Government Code",
    "HNC": "Harbors and Navigation Code", "HSC": "Health and Safety Code",
    "INS": "Insurance Code", "LAB": "Labor Code",
    "MVC": "Military and Veterans Code", "PEN": "Penal Code",
    "PROB": "Probate Code", "PCC": "Public Contract Code",
    "PRC": "Public Resources Code", "PUC": "Public Utilities Code",
    "RTC": "Revenue and Taxation Code", "SHC": "Streets and Highways Code",
    "UIC": "Unemployment Insurance Code", "VEH": "Vehicle Code",
    "WAT": "Water Code", "WIC": "Welfare and Institutions Code",
}


def parse_ca(state, url, raw_text):
    q = parse_qs(urlparse(url).query)
    code = (q.get("lawCode") or [""])[0]
    num = (q.get("sectionNum") or [""])[0].rstrip(".")
    soup = BeautifulSoup(raw_text, "lxml")
    root = soup.find(["caml:content", "content"]) or soup
    body = block_text(root)
    if not body:
        return []
    path = ["California Codes", CA_CODES.get(code, f"{code} Code")]
    heading = f"§ {num}" if num else None
    return [make_record(state, url, path, heading, body, section_num=num or None)]


# Texas: one whole CHAPTER per page inside a <pre>. The hierarchy
# (CODE > TITLE > SUBTITLE > CHAPTER) is in centered bold <p> headers; sections
# begin at a "<p> Sec. N.NNN.  HEADING." line and run until the next one.
_TX_SEC = re.compile(r"^\s*Sec\.\s+([0-9.]+[A-Za-z]?)\.\s*(.*)", re.S)


def parse_tx(state, url, raw_text):
    soup = BeautifulSoup(raw_text, "lxml")
    body = soup.body or soup
    paras = body.find_all("p")

    # leading centered/bold paragraphs = the chapter's folder hierarchy
    hierarchy, started = [], False
    sections, cur = [], None

    for p in paras:
        txt = norm(p.get_text(" "))
        if not txt:
            continue
        m = _TX_SEC.match(txt)
        is_header = ("center" in (p.get("class") or [])) or \
                    ("center" in (p.get("style") or "")) or \
                    bool(p.find(["b", "strong"])) and not m
        if m:
            started = True
            if cur:
                sections.append(cur)
            secnum = m.group(1)
            catchline = norm(m.group(2).split(".", 1)[0])  # "DEFINITIONS.  In this..." -> "DEFINITIONS"
            cur = {"num": secnum, "heading": f"Sec. {secnum}. {catchline}.",
                   "paras": [txt]}
        elif cur is not None:
            cur["paras"].append(txt)
        elif is_header and not started:
            hierarchy.append(txt)
    if cur:
        sections.append(cur)

    path_base = ["Texas Statutes"] + [h for h in hierarchy if h]
    recs = []
    for s in sections:
        heading = norm(s["heading"])
        # heading line already contains the lead-in sentence; keep full body.
        body_text = "\n\n".join(s["paras"]).strip()
        recs.append(make_record(state, url, path_base, heading, body_text,
                                section_num=s["num"]))
    return recs


# ─────────────────────────────────────────────────────────────────────────────
# url-hierarchy helpers for sources with no in-page breadcrumb
# ─────────────────────────────────────────────────────────────────────────────

def az_url_path(url):
    # https://www.azleg.gov/ars/10/00120.htm  -> Title 10
    m = re.search(r"/ars/(\d+)/", url)
    return ["Arizona Revised Statutes"] + ([f"Title {int(m.group(1))}"] if m else [])


def hi_url_path(url):
    # .../Vol07_Ch0346-0398/HRS0369/HRS_0369-0001.htm -> Chapter 369
    m = re.search(r"/HRS0*(\d+)/", url)
    return ["Hawaii Revised Statutes"] + ([f"Chapter {int(m.group(1))}"] if m else [])


def mt_url_path(url):
    # .../title_0310/chapter_0020/part_0030/...  (codes are 10x the printed number)
    t = re.search(r"title_0*(\d+)", url)
    c = re.search(r"chapter_0*(\d+)", url)
    p = re.search(r"part_0*(\d+)", url)
    out = ["Montana Code Annotated"]
    if t: out.append(f"Title {int(t.group(1)) // 10}")
    if c: out.append(f"Chapter {int(c.group(1)) // 10}")
    if p: out.append(f"Part {int(p.group(1)) // 10}")
    return out


def ks_url_path(url):
    m = re.search(r"/ch(\d+)/", url)
    return ["Kansas Statutes"] + ([f"Chapter {int(m.group(1))}"] if m else [])


def mn_url_path(url):
    m = re.search(r"/cite/(\d+)", url)
    return ["Minnesota Statutes"] + ([f"Chapter {m.group(1)}"] if m else [])


def nc_url_path(url):
    m = re.search(r"Chapter_([0-9A-Za-z]+)/", url)
    return ["North Carolina General Statutes"] + ([f"Chapter {m.group(1)}"] if m else [])


def vt_url_path(url):
    m = re.search(r"/section/(\d+)/(\d+)/", url)
    if not m:
        return ["Vermont Statutes"]
    return ["Vermont Statutes", f"Title {int(m.group(1))}", f"Chapter {int(m.group(2))}"]


def va_url_path(url):
    t = re.search(r"/title([0-9.]+)/", url)
    c = re.search(r"/chapter([0-9.]+)/", url)
    out = ["Code of Virginia"]
    if t: out.append(f"Title {t.group(1).rstrip('.')}")
    if c: out.append(f"Chapter {c.group(1).rstrip('.')}")
    return out


def mi_url_path(url):
    m = re.search(r"mcl-(\d+)-", url)
    return ["Michigan Compiled Laws"] + ([f"Chapter {m.group(1)}"] if m else [])


def ak_url_path(url):
    m = re.search(r"secStart=(\d+)\.(\d+)", url)
    if not m:
        return ["Alaska Statutes"]
    return ["Alaska Statutes", f"Title {int(m.group(1))}", f"Chapter {int(m.group(2))}"]


def parse_la(state, url, raw_text):
    # Louisiana Law.aspx?d=<internal id>; the citation "RS 47:1126" leads the body.
    soup = BeautifulSoup(raw_text, "lxml")
    main = soup.select_one("main")
    if main is None:
        return []
    body = block_text(main)
    if not body:
        return []
    cite = re.match(r"\s*(?:RS|CC|CCP|CCRP|CHC|CE)\s+([0-9A-Za-z]+):", body)
    title = cite.group(1) if cite else None
    heading = heading_from_first_sentence(body)
    secnum = section_from_text(heading or "")
    path = ["Louisiana Revised Statutes"] + ([f"Title {title}"] if title else [])
    return [make_record(state, url, path, heading, body, section_num=secnum)]


def parse_wa(state, url, raw_text):
    # Washington RCW: citation in the URL (?Cite=9.95.370); breadcrumb gives folders.
    soup = BeautifulSoup(raw_text, "lxml")
    body_el = soup.select_one("div#contentWrapper")
    if body_el is None:
        return []
    body = block_text(body_el)
    # strip the prev/next nav line ("9.92.140 << 9.92.151 >> 9.92.200") and "Print"
    body = "\n\n".join(p for p in body.split("\n\n")
                       if not re.match(r"^[\d.]+ <<|^Print$|^PDF$", p.strip()))
    if not body:
        return []
    cite = parse_qs(urlparse(url).query).get("Cite", [""])[0]
    crumb = soup.select_one("div.breadcrumb-line")
    path = ["Revised Code of Washington"]
    if crumb:
        for c in crumb.get_text(" ").split("/"):
            c = norm(c)
            if c and c not in ("Home", "State laws and rules", "RCWs", "Print") \
                    and not c.startswith("Section"):
                path.append(c)
    heading = f"RCW {cite}" if cite else None
    return [make_record(state, url, path, heading, body, section_num=cite or None)]


def parse_ri(state, url, raw_text):
    # Rhode Island: <h1>=Title, <h2>=Chapter, first <b>=section heading, the §
    # text sits in its own <div>; a "History of Section" div trails it.
    soup = BeautifulSoup(raw_text, "lxml")
    h1 = soup.find("h1")
    h2 = soup.find("h2")
    b = soup.find("b")
    if b is None:
        return []
    body_el = b.find_parent("div")
    if body_el is None:
        return []
    body = block_text(body_el)
    if not body:
        return []
    heading = norm(b.get_text(" "))
    path = ["Rhode Island General Laws"]
    if h1: path.append(norm(h1.get_text(" ")))
    if h2: path.append(norm(h2.get_text(" ")))
    return [make_record(state, url, path, heading, body,
                        section_num=section_from_text(heading))]


def parse_nv(state, url, raw_text):
    # Nevada: one CHAPTER per page. Each section begins at a <p> carrying an
    # <a name="NRS###Sec###"> anchor, with span.Section (number) + span.Leadline
    # (catchline); p.SourceNote is history trash.
    soup = BeautifulSoup(raw_text, "lxml")
    cont = soup.select_one("div.WordSection1")
    if cont is None:
        return []
    chap = cont.select_one("p.Chapter")
    path = ["Nevada Revised Statutes"] + ([norm(chap.get_text(" "))] if chap else [])

    sections, cur = [], None
    for p in cont.find_all("p"):
        if "SourceNote" in (p.get("class") or []):
            continue
        secspan = p.find("span", class_="Section")
        if secspan is not None:
            if cur:
                sections.append(cur)
            num = norm(secspan.get_text(" "))
            lead = p.find("span", class_="Leadline")
            head = f"NRS {num}" + (f" {norm(lead.get_text(' '))}" if lead else "")
            cur = {"num": num, "heading": head, "ps": [p]}
        elif cur is not None:
            cur["ps"].append(p)
    if cur:
        sections.append(cur)

    recs = []
    for s in sections:
        body = "\n\n".join(block_text(p) for p in s["ps"]).strip()
        if body:
            recs.append(make_record(state, url, path, s["heading"], body,
                                    section_num=s["num"]))
    return recs


def parse_sc(state, url, raw_text):
    # South Carolina: one CHAPTER per page in div#contentsection. The header
    # (Title / CHAPTER / chapter-name) precedes the first "SECTION n-n-n." and
    # each section runs to the next SECTION marker; "HISTORY:" trails each.
    soup = BeautifulSoup(raw_text, "lxml")
    cont = soup.select_one("div#contentsection")
    if cont is None:
        return []
    text = block_text(cont)
    marker = re.compile(r"SECTION\s+(\d+-\d+-\d+)\.\s*", re.I)
    hits = list(marker.finditer(text))
    if not hits:
        return []
    head_block = text[: hits[0].start()]
    path = ["South Carolina Code of Laws"] + [norm(l) for l in head_block.split("\n\n")
                                              if norm(l)][:3]
    recs = []
    for i, m in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
        chunk = text[m.end():end]
        chunk = re.split(r"\n\nHISTORY:", chunk)[0].strip()
        num = m.group(1)
        catchline = norm(chunk.split(".", 1)[0])[:120]
        heading = f"§ {num}. {catchline}."
        body = f"§ {num}. {chunk}".strip()
        if chunk:
            recs.append(make_record(state, url, path, heading, body, section_num=num))
    return recs


def ut_url_path(url):
    # .../Title53H/Chapter10/C53H-10-S203_...html
    t = re.search(r"/Title([0-9A-Za-z]+)/", url)
    c = re.search(r"/Chapter([0-9A-Za-z]+)/", url)
    out = ["Utah Code"]
    if t: out.append(f"Title {t.group(1)}")
    if c: out.append(f"Chapter {c.group(1)}")
    return out


def parse_mo(state, url, raw_text):
    # Missouri PageSelect.aspx has no hierarchy in the URL, but the section
    # number is Chapter.Section (361.975 -> Chapter 361). Body is div.norm.
    soup = BeautifulSoup(raw_text, "lxml")
    body_el = soup.select_one("div.norm")
    if body_el is None:
        return []
    body = block_text(body_el)
    if not body:
        return []
    heading = heading_from_first_sentence(body)
    secnum = section_from_text(heading or "")
    chapter = (secnum or "").split(".")[0]
    path = ["Missouri Revised Statutes"] + ([f"Chapter {chapter}"] if chapter else [])
    return [make_record(state, url, path, heading, body, section_num=secnum)]


# Tennessee: the public-domain TCA bulk from the Internet Archive (gov.tn.tca) is
# one HTML file per TITLE, each holding ALL of that title's sections. Hierarchy
# is <h1>=Title, <h2>=Chapter AND Part (told apart by the anchor id: '...c01' is
# a chapter, '...c01p01' is a part), and every section is an <h3> ('1-1-101.
# Catchline.') whose div holds the law text followed by a source-history <p>
# ('Acts 1953, ch. 80...' / 'Code 1858...' / 'T.C.A. ...') and then annotation
# blocks (Compiler's Notes, Cross-References, NOTES TO DECISIONS, …). We keep the
# paragraphs up to the first history/annotation marker; the rest is trash.
_TN_HIST = re.compile(
    r"^(Acts\s|Code\s|C\.\s?Supp\.|Shan\.|mod\.|[Ii]mpl\.\s?am\.|Priv\.\s?Acts|"
    r"Pub\.\s?Acts|Former\s|Rule\s|T\.C\.A\.|\[(?:Current version|For contingent|"
    r"See contingent|Contingent|See the|Effective|Expired|Repealed|Reserved|"
    r"Obsolete|Transferred|Deleted))")
_TN_ANNOT = re.compile(
    r"^(Cross-References?\.|Compiler.s Notes?\.|Amendments\.|Effective Dates?\.|"
    r"Textbooks\.|Law Reviews?\.|Attorney General Opinions\.|NOTES TO DECISIONS|"
    r"Collateral References?\.|Comparative Legislation|Code Commission Notes\.|"
    r"Revision Notes?\.|Sentencing Commission|Decisions Under Prior Law|Cited:\s)")


def parse_tn(state, url, raw_text):
    soup = BeautifulSoup(raw_text, "lxml")
    main = soup.find("main")
    if main is None:
        return []
    h1 = soup.find("h1")
    title = norm(h1.get_text(" ")) if h1 else None

    recs, chapter, part = [], None, None
    for el in main.find_all(["h2", "h3"]):
        if el.name == "h2":
            # an <h2> is a Chapter ('...c01') unless its id ends '...pNN' (a Part).
            if re.search(r"p\d+$", el.get("id") or ""):
                part = norm(el.get_text(" "))
            else:
                chapter, part = norm(el.get_text(" ")), None
            continue
        # an <h3> is a section: catchline heading, then body paras until the
        # source-history line (or an annotation header) closes the law text.
        heading = norm(el.get_text(" "))
        body_parts = []
        for sib in el.next_siblings:
            if not isinstance(sib, Tag):
                continue
            # Stay inside this section. Most titles wrap each <h3> in its own div
            # (siblings = pure body), but some (e.g. Title 40) flatten sections
            # under <main>, so a following sibling may be a whole chapter <div>.
            # Any sibling that *is* or *contains* an <h3> is the next structural
            # unit, not this section's body — stop there.
            if sib.name == "h3" or sib.find("h3"):
                break
            txt = norm(sib.get_text(" "))
            if not txt:
                continue
            if _TN_HIST.match(txt) or _TN_ANNOT.match(txt):
                break
            if sib.name in ("p", "ol", "ul", "table", "blockquote"):
                t = block_text(sib)
                if t:
                    body_parts.append(t)
            elif sib.name == "div":      # annotation wrapper (NOTES TO DECISIONS)
                break
        # Final safeguard: a few contingent-amendment sections wrap the law text,
        # the source-history line and the annotations together in one container,
        # so the per-sibling break above can't see the boundary. Re-cut the
        # assembled body at the first paragraph that opens a history/annotation.
        paras = "\n\n".join(body_parts).split("\n\n")
        keep = []
        for p in paras:
            if _TN_HIST.match(p.strip()) or _TN_ANNOT.match(p.strip()):
                break
            keep.append(p)
        body = "\n\n".join(keep).strip()
        if not body:                       # repealed/reserved/transferred stub
            continue
        path = ["Tennessee Code Annotated"]
        for folder in (title, chapter, part):
            if folder:
                path.append(folder)
        recs.append(make_record(state, url, path, heading, body,
                                section_num=section_from_text(heading)))
    return recs


def parse_md(state, url, raw_text):
    # Maryland mgaleg StatuteText: one section per page in div#StatuteText. The
    # first centered bold line is "Article - <Name>" (the folder); the body opens
    # with a "§N–NNN." designator (en-dash) then the law. Next/Previous nav
    # buttons sit in .row wrappers and must be dropped. The clean section number
    # (regular hyphen) comes from the URL's ?section= for a tidy "§ N-NNN" heading.
    soup = BeautifulSoup(raw_text, "lxml")
    body_el = soup.select_one("div#StatuteText")
    if body_el is None:
        return []
    # article folder = first centered line ("Article - Criminal Law")
    article = None
    head = body_el.find("div", style=lambda v: v and "text-align: center" in v)
    if head is not None:
        article = norm(head.get_text(" "))
        if article and article.lower().startswith("article -"):
            article = norm(article.split("-", 1)[1])
        head.decompose()
    # drop the prev/next nav button rows
    for n in body_el.select("div.row, button.sub-navbar-button"):
        n.decompose()
    body = block_text(body_el)
    if not body:
        return []
    q = parse_qs(urlparse(url).query)
    secnum = (q.get("section") or [""])[0].strip()
    heading = f"§ {secnum}" if secnum else heading_from_first_sentence(body)
    path = ["Maryland Code"] + ([article] if article else [])
    return [make_record(state, url, path, heading, body, section_num=secnum or None)]


def wv_url_path(url):
    # https://code.wvlegislature.gov/16A-2-1/ -> Chapter 16A / Article 2
    # (fallback only — the page's <option selected> + div.art-head carry the
    # full chapter/article titles and win via crumbs_css when present.)
    m = re.match(r".*/([0-9]+[A-Za-z]?)-([0-9]+[A-Za-z]?)-", url)
    out = ["West Virginia Code"]
    if m:
        out += [f"Chapter {m.group(1)}", f"Article {m.group(2)}"]
    return out


def parse_wi(state, url, raw_text):
    # Wisconsin: the URL is /document/statutes/<chap>.<sec> but the page actually
    # carries the WHOLE chapter — div.statutes holds a flat run of paragraph divs.
    # A section starts at div.qsatxt_1sect (span.qsnum_sect = number,
    # span.qstitle_sect = catchline); deeper levels are qsatxt_2subsect /
    # _3para / _4subdiv, each prefixed by an <a class="reference"> that just
    # repeats the citation (drop it). The chapter opens with a TOC
    # (div.qstoc_entry / navigation / qsline) and each section trails a
    # div.qsnote_history / qsnote_xref(_code) / qsnote_annot — all trash.
    soup = BeautifulSoup(raw_text, "lxml")
    conts = [d for d in soup.select("div.statutes") if d.select(".qsnum_sect")]
    if not conts:
        return []
    cont = conts[0]

    # chapter number from the URL ("100.01" -> "100"); breadcrumb agrees.
    m = re.search(r"/statutes/(\d+)\.", url)
    chap = m.group(1) if m else None
    path = ["Wisconsin Statutes"] + ([f"Chapter {chap}"] if chap else [])

    TRASH = ("qstoc_entry", "navigation", "navigation_up", "navigation_down",
             "qsline", "qsnote_history", "qsnote_xref", "qsnote_xref_code",
             "qsnote_annot", "qssection")

    def clean(node):
        frag = BeautifulSoup(str(node), "lxml")
        for a in frag.select("a.reference"):  # just repeats the citation number
            a.decompose()
        return frag

    sections, cur = [], None
    for div in cont.children:
        if getattr(div, "name", None) != "div":
            continue
        classes = div.get("class") or []
        if any(c in TRASH for c in classes):
            continue
        if "qsatxt_1sect" in classes:
            if cur:
                sections.append(cur)
            head = clean(div)
            numspan = head.select_one("span.qsnum_sect")
            titlespan = head.select_one("span.qstitle_sect")
            num = norm(numspan.get_text(" ")) if numspan else None
            title = norm(titlespan.get_text(" ")) if titlespan else None
            heading = " ".join(x for x in (num, title) if x) or norm(head.get_text(" "))
            cur = {"num": num, "heading": heading, "divs": [div]}
        elif cur is not None:
            cur["divs"].append(div)
        # else: content before the first section start = tail of the previous
        # page's section (chapters can span pages); drop it.
    if cur:
        sections.append(cur)

    recs = []
    for s in sections:
        body = "\n\n".join(t for t in (block_text(clean(d)) for d in s["divs"]) if t).strip()
        if body:
            recs.append(make_record(state, url, path, s["heading"], body,
                                    section_num=s["num"]))
    return recs


def parse_ma(state, url, raw_text):
    # Massachusetts: one section per page, server-rendered. The law text sits in
    # the bare <div class="col-xs-12"> that wraps the section's <h2 class=
    # genLawHeading> title and its <p> body; a btn-toolbar (Print/Prev/Next) and
    # the heading itself are the only trash. Hierarchy (Part/Title/Chapter,
    # Roman-numbered) lives only in the URL path.
    soup = BeautifulSoup(raw_text, "lxml")
    gh = soup.select_one("h2.genLawHeading")
    if gh is None:
        return []
    body_el = gh.parent
    heading = norm(gh.get_text(" "))  # "Section 1: Appeals court; establishment"
    for sel in ("div.btn-toolbar", "h2.genLawHeading", "hr"):
        for n in body_el.select(sel):
            n.decompose()
    body = block_text(body_el)
    if not body:
        return []  # repealed/reserved sections carry no text
    m = re.search(r"/Part([IVXLCDM]+)/Title([IVXLCDM]+)/Chapter([0-9A-Za-z]+)"
                  r"/Section([0-9A-Za-z]+)", url)
    path = ["Massachusetts General Laws"]
    secnum = None
    if m:
        path += [f"Part {m.group(1)}", f"Title {m.group(2)}",
                 f"Chapter {m.group(3)}"]
        secnum = m.group(4)
    return [make_record(state, url, path, heading, body, section_num=secnum)]


# Illinois: the ILGA FTP bulk HTML export — one doc per file under
# /ftp/ILCS/Ch NNNN/Act NNNNN/<docname>.html, all old-style <font>/<code>/<center>
# markup. The trailing letter in the docname is the doc TYPE:
#   A = chapter header, F = act title page, H = article/division heading,
#   K = an actual section (the only thing we want). A/F/H carry only hierarchy
# labels, so we skip them. Every K body is:
#   "(N ILCS NNNN/sec) (from Ch. ...)"  <- citation line (chapter/act live here)
#   "Sec. N. Catchline. <law text>"
#   "(Source: ...)"                     <- history trash
_IL_DOCTYPE = re.compile(r"\dK", re.I)          # digit then 'K' = a section doc
_IL_CITE = re.compile(r"^\s*\(\s*(\d+)\s+ILCS\s+([0-9A-Za-z.]+)/", re.I)
_IL_SEC = re.compile(r"^\s*Sec\.\s+([0-9A-Za-z.\-]+)\.\s*(.*)", re.S)


def il_doc_is_section(url):
    name = unquote(urlparse(url).path.rsplit("/", 1)[-1])
    base = name[:-5] if name.lower().endswith(".html") else name
    return bool(_IL_DOCTYPE.search(base))


def parse_il(state, url, raw_text):
    if not il_doc_is_section(url):
        return []  # chapter header (A) / act title (F) / heading (H) — hierarchy only
    soup = BeautifulSoup(raw_text, "lxml")
    body = block_text(soup.body or soup)
    if not body:
        return []

    paras = [p for p in body.split("\n\n") if p.strip()]
    # 1. hierarchy from the leading ILCS citation; fall back to the (padded) URL.
    chapter = act = None
    cite = _IL_CITE.match(paras[0]) if paras else None
    if cite:
        chapter, act = cite.group(1), cite.group(2)
    else:
        m = re.search(r"/Ch\s*0*(\d+)/Act\s*0*(\d+)", unquote(urlparse(url).path))
        if m:
            chapter, act = m.group(1), m.group(2)
    path = ["Illinois Compiled Statutes"]
    if chapter: path.append(f"Chapter {chapter}")
    if act: path.append(f"Act {act}")

    # 2. drop the citation line(s) and the trailing "(Source: ...)" note.
    core = [p for p in paras
            if not _IL_CITE.match(p) and not re.match(r"^\s*\(Source:", p, re.I)]
    body_text = "\n\n".join(core).strip()
    if not body_text:
        return []

    # 3. heading: "Sec. N. Catchline." — number + the catchline sentence.
    secnum = heading = None
    sm = _IL_SEC.match(core[0]) if core else None
    if sm:
        secnum = sm.group(1)
        catchline = norm(sm.group(2).split(".", 1)[0])[:160]
        heading = f"Sec. {secnum}." + (f" {catchline}." if catchline else "")
    else:
        heading = heading_from_first_sentence(body_text)
    return [make_record(state, url, path, heading, body_text, section_num=secnum)]


def parse_or(state, url, raw_text):
    # Oregon: one CHAPTER per page (orsNNN.html) inside div.WordSection1, served
    # windows-1252. The page opens with header lines ("Chapter N — Name", edition,
    # an ALL-CAPS series banner) then a table of contents (section number + catch-
    # line in PLAIN <p>s), then the body: each section begins at a <p> whose lead
    # run is bold — "<b> N.NNN  Catchline.</b> body…" — and runs to the next bold
    # lead. ALL-CAPS unbold lines inside the body are topic sub-headings (folder).
    # Repealed/renumbered stubs read "N.NNN [Amended by …]" (bracket, no catchline).
    soup = BeautifulSoup(raw_text, "lxml")
    cont = soup.select_one("div.WordSection1")
    if cont is None:
        return []
    ps = cont.find_all("p")

    # chapter number from the URL (orsNNN.html); name from the first header para.
    mnum = re.search(r"ors0*(\d+[A-Za-z]?)\.html", url)
    chap_num = mnum.group(1) if mnum else None
    chap_name = None
    if ps:
        first = norm(ps[0].get_text(" "))
        m = re.match(r"(?i)^chapter\s+\S+\s*[—–-]\s*(.+)$", first)
        if m:
            chap_name = norm(m.group(1))
    chap_folder = f"ORS Chapter {chap_num}" if chap_num else "Oregon Revised Statutes"
    base = ["Oregon Revised Statutes", chap_folder]
    if chap_name:
        base.append(chap_name)

    sec_num = re.compile(r"^(\d+[A-Za-z]?\.\d+[A-Za-z]?)(?:\s+(.*))?$", re.S)

    sections, cur, group = [], None, None
    for p in ps:
        bold = p.find(["b", "strong"])
        btxt = norm(bold.get_text(" ")) if bold else ""
        full = norm(p.get_text(" "))
        # a section starts where the paragraph's bold lead IS the section number;
        # match against the full paragraph text (the bracket-stub bodies and the
        # body lead-in live outside the bold run).
        m = sec_num.match(full) if (bold and sec_num.match(btxt)) else None
        if m:                                   # start of a real section (bold lead)
            if cur:
                sections.append(cur)
            num = m.group(1)
            rest = m.group(2) or ""
            # catchline = text up to the first period that is NOT a bracketed stub
            if not rest or rest.startswith("["):
                heading = f"{num}"
            else:
                catch = norm(rest.split(".", 1)[0])[:140]
                heading = f"{num} {catch}".strip()
            cur = {"num": num, "heading": heading, "group": group, "paras": [full]}
        elif cur is not None:
            # an ALL-CAPS unbold line ends the section run and opens a new topic group
            letters = re.sub(r"[^A-Za-z]", "", full)
            if full and letters and full == full.upper() and not full[0].isdigit() \
                    and not full.startswith("(") and len(full) > 3:
                group = full.title()
                sections.append(cur)
                cur = None
            elif full and not full.startswith("_"):
                cur["paras"].append(full)

    if cur:
        sections.append(cur)

    recs = []
    for s in sections:
        path = list(base) + ([s["group"]] if s["group"] else [])
        body = "\n\n".join(s["paras"]).strip()
        if not body:
            continue
        recs.append(make_record(state, url, path, s["heading"], body,
                                section_num=s["num"]))
    return recs


# Pennsylvania: one CHAPTER per iframe page (the ?...&iFrame=true content frame).
# Title number is ttl= and chapter is chpt= in the URL query. Inside the frame,
# each section starts at a "§ NNNN.  Catchline." line and runs to the next §; a
# trailing "(<date>, P.L.NNN, No.NN, ...)" history line is statutory citation we
# keep. Pages where the iframe was never captured (the bare JS shell with no §)
# yield [] — DEFERRED handles the all-shell corpus until those URLs are scraped.
_PA_SEC = re.compile(r"(?m)^\s*§\s*([0-9]+[0-9.\-]*[A-Za-z]?)\.\s*")


def parse_pa(state, url, raw_text):
    q = parse_qs(urlparse(url).query)
    ttl = (q.get("ttl") or ["0"])[0].lstrip("0") or "0"
    chpt = (q.get("chpt") or ["0"])[0].lstrip("0") or "0"
    soup = BeautifulSoup(raw_text, "lxml")
    # the statute frame fills a content div; fall back to <body> for the raw frame.
    cont = (soup.select_one("div#StatuteBody, div.StatuteBody, div#viewStatute, "
                            "div.statuteBody, div#content") or soup.body or soup)
    text = block_text(cont)
    hits = list(_PA_SEC.finditer(text))
    if not hits:                                   # JS shell / no statute text
        return []

    path = ["Pennsylvania Consolidated Statutes", f"Title {ttl}"]
    if chpt and chpt != "0":
        path.append(f"Chapter {chpt}")

    recs = []
    for i, m in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
        num = m.group(1).rstrip(".")
        chunk = text[m.start():end].strip()        # keep the "§ NNNN." lead-in
        catchline = norm(re.sub(r"^\s*§\s*[0-9.\-A-Za-z]+\.\s*", "", chunk).split("\n\n")[0])
        catchline = norm(catchline.split(".", 1)[0])[:120]
        heading = f"§ {num}. {catchline}." if catchline else f"§ {num}"
        if chunk:
            recs.append(make_record(state, url, path, heading, chunk, section_num=num))
    return recs


def parse_de(state, url, raw_text):
    # Delaware: one CHAPTER (or subchapter) per index.html. Hierarchy lives in
    # #TitleHead (h1=TITLE n, the descriptive name lines, h3="CHAPTER n. Name",
    # h4="Subchapter ..."). #CodeBody holds many <div class="Section">, each a
    # <div class="SectionHead"> (the "§ n. Catchline.") followed by the body
    # <p> paragraphs; the trailing source/history note is loose text + <a> tags
    # directly under div.Section (no wrapper) — skipped by taking only <p>.
    soup = BeautifulSoup(raw_text, "lxml")
    body_root = soup.select_one("#CodeBody") or soup
    secs = body_root.select("div.Section")
    if not secs:
        return []

    # folder hierarchy: prefer the URL's title/chapter numbers, enrich with names.
    tnum = re.search(r"/title(\d+)/", url)
    cnum = re.search(r"/c0*(\d+)/", url)
    path = ["Delaware Code"]
    if tnum:
        path.append(f"Title {int(tnum.group(1))}")
    if cnum:
        path.append(f"Chapter {int(cnum.group(1))}")
    th = soup.select_one("#TitleHead")
    if th is not None:
        # the CHAPTER name (h3 "CHAPTER n. <name>") and Subchapter (h4) refine it
        for h in th.find_all(re.compile(r"h[2-4]")):
            t = norm(h.get_text(" "))
            cm = re.match(r"(?i)^CHAPTER\s+[0-9A-Za-z]+\.?\s*(.+)$", t)
            if cm and path and path[-1].startswith("Chapter"):
                path[-1] = f"{path[-1]}. {cm.group(1)}"
            elif re.match(r"(?i)^Subchapter\b", t):
                path.append(t)

    recs = []
    for sec in secs:
        head_el = sec.select_one("div.SectionHead")
        heading = norm(head_el.get_text(" ")) if head_el is not None else None
        num = section_from_text(heading or "")
        if head_el is not None and head_el.get("id"):
            num = norm(head_el.get("id")) or num
        # body = the section's <p> paragraphs only (drops the loose history note)
        paras = [block_text(p) for p in sec.find_all("p", recursive=False)]
        body = "\n\n".join(x for x in paras if x).strip()
        if not body:
            continue
        recs.append(make_record(state, url, path, heading, body, section_num=num))
    return recs


def parse_ny(state, url, raw_text):
    # New York (nysenate.gov Open Legislation, Drupal-rendered): one leaf SECTION
    # per page in div.nys-openleg-result-text. The same manifest also holds
    # ARTICLE/TITLE/CHAPTER/PART pages — those are tables of contents (lists of
    # section titles), not law — and empty/repealed stubs; both are skipped.
    # Hierarchy is the breadcrumb: name = "CHAPTER 16 / TITLE 2 / ARTICLE 41",
    # the matching .description = the readable folder name ("Education",
    # "School District Organization", ...). Heading = "§ <num>. <catchline>".
    soup = BeautifulSoup(raw_text, "lxml")
    head_el = soup.select_one(".nys-openleg-result-title-headline")
    body_el = soup.select_one(".nys-openleg-result-text")
    if head_el is None or body_el is None:
        return []                                   # TOC index or empty stub
    headline = norm(head_el.get_text(" "))
    m = re.match(r"(?i)^SECTION\s+(.+)$", headline)
    if not m:                                       # ARTICLE/TITLE/CHAPTER/PART page
        return []
    num = m.group(1).strip()
    body = block_text(body_el)
    if not body:
        return []

    # breadcrumb: name nodes carry the citation, description nodes the readable
    # title. name[0]="The Laws of New York", name[1]=the law family; keep the
    # family plus the readable descriptions (law name, chapter, title, article...)
    # as the folder hierarchy.
    names = [norm(n.get_text(" ")) for n in soup.select(".nys-openleg-result-breadcrumb-name")]
    descs = [norm(n.get_text(" ")) for n in soup.select(".nys-openleg-result-breadcrumb-description")]
    family = names[1] if len(names) > 1 else "Consolidated Laws of New York"
    folders = [d for d in descs if d]               # law name, chapter, title, article, part...
    path = [family] + folders

    short = soup.select_one(".nys-openleg-result-title-short")
    catchline = norm(short.get_text(" ")) if short else ""
    heading = (f"§ {num}. {catchline}".rstrip(".") + ".") if catchline else f"§ {num}"
    return [make_record(state, url, path, heading, body, section_num=num)]


# ─────────────────────────────────────────────────────────────────────────────
# Iowa: one born-digital PDF per Code section at
#   https://www.legis.iowa.gov/docs/code/2026/<chap>.<sec>.pdf
# The URL basename IS the section number ("100.10"); the chapter is its first
# dotted run. Every page repeats a running header
#   "<pageno>   <CHAPTER NAME>, §<section>"
# (the only place the chapter name appears) and a footer
#   "<weekday date>   Iowa Code 2026, Section <section> (...)".
# Strip both, take the chapter name from the header, the catchline from the
# leading "<section> <Title>." line, and rejoin layout-wrapped lines into
# paragraphs (a 2-space indent or a blank line starts a new one).
IA_FOOTER = re.compile(r"Iowa Code\s+\d{4},\s+Section", re.I)
IA_HEADER = re.compile(r"^\d+\s+(.*?),\s*§\s*\S+$")

def parse_ia(state, url, text):
    sec = re.sub(r"\.pdf$", "", url.rsplit("/", 1)[-1], flags=re.I)   # "100.10"
    chap = re.split(r"[.\-]", sec)[0]                                  # "100"
    chap_name = None
    lines = []                                       # raw (rstripped) body lines
    for ln in text.split("\n"):
        s = ln.strip()
        if not s:
            lines.append("")
            continue
        m = IA_HEADER.match(s)
        if m:                                        # running header → chapter name
            if not chap_name:
                chap_name = m.group(1).strip()
            continue
        if IA_FOOTER.search(s):                      # provenance footer
            continue
        if s.isdigit():                              # stray page number
            continue
        lines.append(ln.rstrip())

    paras = pdf_paragraphs(lines)
    if not paras:
        return []

    # the opening "<section> <Catchline>." paragraph is the heading
    heading, body_paras = f"§{sec}", paras
    if re.match(rf"^§?\s*{re.escape(sec)}\b", paras[0]):
        heading, body_paras = paras[0], paras[1:]
    body = "\n\n".join(body_paras)

    folder = f"Chapter {chap}"
    if chap_name:
        folder += f" — {chap_name.title()}"
    return [make_record(state, url, ["Iowa Code", folder], heading, body, section_num=sec)]


# Kentucky: one born-digital PDF per KRS section (the .aspx URL serves %PDF bytes,
# one file per statute, no running header/footer). The opening line is
#   "<chap>.<sec> <Catchline>."  e.g. "133.120 Appeal procedure."
# The statutory text runs until the "Effective:" / "History:" trailer, which is
# editorial provenance we drop. Chapter is the section number's prefix (may carry
# a letter, e.g. 15A.130 → 15A).
KY_TRAILER = re.compile(r"^\s*(Effective:|History:|Legislative Research Commission)", re.I)
# section number, then the catchline (first sentence), then the rest = body. KRS
# runs all three together in one paragraph when a section has no (1)/(2) subparts,
# so we peel the catchline off the head rather than assume a paragraph break.
KY_HEAD = re.compile(r"^(\d+[A-Za-z]?\.[0-9A-Za-z][\w.\-]*)\s+(.+?\.)(\s+.*)?$")

def parse_ky(state, url, text):
    body_lines = []
    for ln in text.split("\n"):
        if KY_TRAILER.match(ln):                      # editorial trailer → stop
            break
        body_lines.append(ln.rstrip())
    paras = pdf_paragraphs(body_lines)
    if not paras:
        return []
    m = KY_HEAD.match(paras[0])
    if m:
        sec = m.group(1)
        heading = f"{m.group(1)} {m.group(2)}"
        rest = (m.group(3) or "").strip()
        body_paras = ([rest] if rest else []) + paras[1:]
    else:                                             # repealed/odd stub
        sec, heading, body_paras = None, paras[0], paras[1:]
    body = "\n\n".join(body_paras)
    path = ["Kentucky Revised Statutes"]
    if sec:
        path.append(f"Chapter {sec.split('.')[0]}")
    return [make_record(state, url, path, heading, body, section_num=sec)]


# Arkansas, Georgia, Mississippi: the UniCourt cic-code public-domain mirrors,
# one HTML file per title with the SAME DOM. Sections are a flat sibling stream
# inside <main>: an <h3 id="t<T>c<C>s<SEC>"> heading ("1-1-1. Enactment of Code.")
# followed by the statute text (<ol>/<p>), then metadata paragraphs (History.,
# Cross references., …) and <h4>/<div> annotation blocks we drop. Hierarchy comes
# from the heading stream: <h1> title (in nav), <h2> chapter (or h2.subtitleh2
# subtitle), h3.subchapterh3 subchapter dividers (no body).
UNICOURT_SEC = re.compile(
    r"^\s*§*\s*(\d+[A-Za-z]?-\d+[A-Za-z]?-\d+(?:\.\d+)*[A-Za-z]?)\.?(?:\s|$)")
UNICOURT_META = re.compile(
    r"^\s*(History|Cross references?|Editor'?s notes?|Law reviews?|Amendments?|"
    r"Administrative rules?|Code Commission notes?|Repealed|Delegation|JUDICIAL DECISIONS|"
    r"RESEARCH REFERENCES|OPINIONS OF THE ATTORNEY GENERAL|U\.S\. Code|ALR|Am\.? Jur)",
    re.I)

def parse_unicourt(state, url, raw_text):
    soup = BeautifulSoup(raw_text, "lxml")
    main = soup.find("main")
    if main is None:
        return []
    code_name = f"{state} Code"
    h1 = soup.find("h1")
    title = norm(h1.get_text(" ")) if h1 else None
    subtitle = chapter = subchap = None
    recs = []
    for el in main.find_all(["h1", "h2", "h3"]):
        cls = el.get("class") or []
        txt = norm(el.get_text(" "))
        if el.name == "h1":
            title = txt; subtitle = chapter = subchap = None; continue
        if el.name == "h2":
            if "subtitleh2" in cls:
                subtitle = txt; chapter = None
            else:
                chapter = txt
            subchap = None
            continue
        if "subchapterh3" in cls:                      # subchapter divider, no body
            subchap = txt; continue
        m = UNICOURT_SEC.match(txt)
        if not m:
            continue
        sec = m.group(1)
        parts = []
        for sib in el.next_siblings:                   # statute text up to the metadata
            nm = getattr(sib, "name", None)
            if nm in ("h2", "h3", "h4", "div"):
                break
            if nm == "p" and UNICOURT_META.match(sib.get_text(" ")):
                break
            if nm in ("p", "ol", "ul", "blockquote", "table"):
                t = block_text(sib)
                if t:
                    parts.append(t)
        path = [p for p in (code_name, title, subtitle, chapter, subchap) if p]
        recs.append(make_record(state, url, path, txt, "\n\n".join(parts), section_num=sec))
    return recs


# North Dakota & Wyoming: multi-section PDFs (one chapter/title per file). The
# section marker is an indented "<T>-<C>-<S>. Catchline." line; the statute body
# is the lines beneath it up to the next marker. Hierarchy headers ("TITLE n",
# "CHAPTER n", "ARTICLE n") are uppercase structural lines.
PDF_SEC = re.compile(r"^\s+(\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?)\.\s+(.+?)\s*$")

def _emit_pdf_chunks(state, url, chunks):
    """chunks: list of {sec, heading, path, lines}. Each carries the folder path
    that was active when its section marker was read (set per-chunk, not globally —
    a one-title-per-file PDF spans many chapters)."""
    recs = []
    for c in chunks:
        body = "\n\n".join(pdf_paragraphs(c["lines"]))
        recs.append(make_record(state, url, c["path"], c["heading"], body, section_num=c["sec"]))
    return recs


ND_CHAP = re.compile(r"^CHAPTER\s+([\d.\-]+)\s*$")
ND_DROP = re.compile(r"^\s*Page No\.\s+\d+\s*$")
ND_URL = re.compile(r"/t(\d+(?:-\d+)?(?:\.\d+)?)c(\d+(?:-\d+)?(?:\.\d+)?)\.pdf", re.I)

def parse_nd(state, url, text):
    m = ND_URL.search(url)
    title = f"Title {m.group(1)}" if m else None
    chap_num, chap_name, want_name = None, None, False
    chunks, cur = [], None
    for raw in text.split("\n"):
        ln = raw.rstrip(); s = ln.strip()
        if ND_DROP.match(s):
            continue
        if not s:
            if cur:
                cur["lines"].append("")
            continue
        if s.startswith("TITLE ") and not PDF_SEC.match(ln):
            continue                                  # title comes from the URL
        cm = ND_CHAP.match(s)
        if cm:
            chap_num = cm.group(1); want_name = True; cur = None
            continue
        sm = PDF_SEC.match(ln)
        if sm:
            chapter = (f"Chapter {chap_num}" + (f" — {chap_name.title()}" if chap_name else "")
                       if chap_num else None)
            path = [p for p in ("North Dakota Century Code", title, chapter) if p]
            cur = {"sec": sm.group(1), "heading": f"{sm.group(1)}. {sm.group(2)}",
                   "path": path, "lines": []}
            chunks.append(cur); want_name = False
            continue
        if want_name:                                 # line right after CHAPTER = its name
            chap_name = s; want_name = False
            continue
        if cur:
            cur["lines"].append(ln)
    return _emit_pdf_chunks(state, url, chunks)


WY_TITLE = re.compile(r"^TITLE\s+(\d+(?:\.\d+)?)\s*-\s*(.+?)\s*$")
WY_CHAP = re.compile(r"^CHAPTER\s+(\d+[A-Za-z]?)\s*-\s*(.+?)\s*$")
WY_ART = re.compile(r"^ARTICLE\s+(\d+[A-Za-z]?)\s*-\s*(.+?)\s*$")

def parse_wy(state, url, text):
    title = chapter = article = None
    chunks, cur = [], None
    for raw in text.split("\n"):
        ln = raw.rstrip(); s = ln.strip()
        if not s:
            if cur:
                cur["lines"].append("")
            continue
        tm = WY_TITLE.match(s)
        if tm:
            title = f"Title {tm.group(1)} — {tm.group(2).title()}"; chapter = article = None; cur = None
            continue
        cm = WY_CHAP.match(s)
        if cm:
            chapter = f"Chapter {cm.group(1)} — {cm.group(2).title()}"; article = None; cur = None
            continue
        am = WY_ART.match(s)
        if am:
            article = f"Article {am.group(1)} — {am.group(2).title()}"; cur = None
            continue
        sm = PDF_SEC.match(ln)
        if sm:
            path = [p for p in ("Wyoming Statutes", title, chapter, article) if p]
            cur = {"sec": sm.group(1), "heading": f"{sm.group(1)}. {sm.group(2)}",
                   "path": path, "lines": []}
            chunks.append(cur)
            continue
        if cur:
            cur["lines"].append(ln)
    return _emit_pdf_chunks(state, url, chunks)


# the registry: domain -> adapter
# ─────────────────────────────────────────────────────────────────────────────

# ('html', Rule)        generic CSS extraction
# ('pdf',  fn)          custom function(state, url, pdftotext_layout_text) -> [rec]
# ('xml',  fn) / ('raw', fn)  custom function(state, url, decoded_text) -> [rec]
SOURCES = {
    "leginfo.legislature.ca.gov": ("raw", parse_ca),
    "tcss.legis.texas.gov": ("raw", parse_tx),
    "codes.ohio.gov": ("html", Rule(
        body_css="section.laws-body",
        heading_css="section.laws-header",
        heading_drop_css=("div.breadcrumbs", "div.laws-section-info"),
        crumbs_css="div.breadcrumbs div.breadcrumbs-node",
        drop_css=("section.laws-history", "div.laws-notice"),
    )),
    "www.flsenate.gov": ("html", Rule(
        body_css="div.Section span.SectionBody",
        heading_css="div.Section span.SectionNumber, div.Section span.CatchlineText",
        crumbs_one_css="#breadcrumbs",
        crumbs_split=">",
        crumbs_drop=("Home", "Laws"),
        crumbs_drop_last=1,
        drop_css=("span.HistoryText",),
    )),
    "www.azleg.gov": ("html", Rule(
        body_css="body",
        heading_css="body p:first-of-type",
        drop_css=("p:first-of-type",),  # the title line is repeated as the body's first <p>
        url_path=az_url_path,
    )),
    "www.capitol.hawaii.gov": ("html", Rule(
        body_css="div.WordSection1",
        url_path=hi_url_path,
        heading_from_body=True,
    )),
    "archive.legmt.gov": ("html", Rule(
        body_css="div.section-content",
        url_path=mt_url_path,
        heading_from_body=True,
    )),
    "le.utah.gov": ("html", Rule(
        body_css="div#secdiv",
        url_path=ut_url_path,
        heading_from_body=True,
    )),
    "revisor.mo.gov": ("raw", parse_mo),
    "ksrevisor.gov": ("html", Rule(
        body_css="div#print",
        drop_css=("p.ksa_stat_hist", "p.ksa_8pt_ca", "p.ksa_ca"),
        url_path=ks_url_path,
        heading_from_body=True,
    )),
    "www.legis.la.gov": ("raw", parse_la),
    "www.legislature.mi.gov": ("html", Rule(
        body_css="div.sectionWrapper",
        drop_css=("div.excerpt",),
        url_path=mi_url_path,
        heading_from_body=True,
    )),
    "www.revisor.mn.gov": ("html", Rule(
        body_css="div.section",
        url_path=mn_url_path,
        heading_from_body=True,
    )),
    "www.ncleg.gov": ("html", Rule(
        body_css="body",
        url_path=nc_url_path,
        heading_from_body=True,
    )),
    "legislature.vermont.gov": ("html", Rule(
        body_css="ul.statutes-detail",
        url_path=vt_url_path,
        heading_from_body=True,
    )),
    "law.lis.virginia.gov": ("html", Rule(
        body_css="section.body",
        heading_css="h2",
        url_path=va_url_path,
    )),
    "apps.leg.wa.gov": ("raw", parse_wa),
    "www.akleg.gov": ("html", Rule(
        body_css="div.statute",
        url_path=ak_url_path,
        heading_from_body=True,
    )),
    "legislature.maine.gov": ("html", Rule(
        body_css="div.MRSSection",
        heading_css="h3.heading_section",
        crumbs_css="div.MRSTitle, div.MRSChapter",
        drop_css=("div.qhistory", "h3.heading_section"),
        top_folder="Maine Revised Statutes",
    )),
    "webserver.rilegislature.gov": ("raw", parse_ri),
    "www.leg.state.nv.us": ("raw", parse_nv),
    "www.scstatehouse.gov": ("raw", parse_sc),
    "archive.org": ("raw", parse_tn),
    "mgaleg.maryland.gov": ("raw", parse_md),
    "code.wvlegislature.gov": ("html", Rule(
        body_css="div.sectiontext",
        heading_css="div.sectiontext h4",
        crumbs_css="#sel-chapter option[selected], div.art-head",
        drop_css=("h4",),
        top_folder="West Virginia Code",
        url_path=wv_url_path,
    )),
    "docs.legis.wisconsin.gov": ("raw", parse_wi),
    "malegislature.gov": ("raw", parse_ma),
    "ilga.gov": ("raw", parse_il),
    "www.oregonlegislature.gov": ("raw", parse_or),
    "www.palegis.us": ("raw", parse_pa),
    "delcode.delaware.gov": ("raw", parse_de),
    "www.nysenate.gov": ("raw", parse_ny),
    "www.legis.iowa.gov": ("pdf", parse_ia),
    "apps.legislature.ky.gov": ("pdf", parse_ky),
    "unicourt.github.io": ("raw", parse_unicourt),   # AR, GA, MS — shared cic-code DOM
    "www.ndlegis.gov": ("pdf", parse_nd),
    "wyoleg.gov": ("pdf", parse_wy),
}

# states whose first build is deferred, with the reason logged rather than failing.
DEFERRED = {
    "Oklahoma": "PDF corpus (phase 2)",
    "New Mexico": "chapter PDFs (phase 2)",
    "Colorado": "docx/zip bulk download (phase 2)",
    "New Jersey": "nxt gateway frames/JS (phase 2)",
    "Indiana": "React SPA — page HTML is an empty mount point (needs headless)",
    "South Dakota": "React/Vue SPA — empty shell HTML (needs headless)",
    "Pennsylvania": "JS shell — statute text lives in <iframe id=IFrame_StatuteText "
                    "src=about:blank> filled client-side from the un-scraped ?iFrame=true "
                    "URL; all 15,430 captured pages are the identical nav wrapper (zero § "
                    "content). parse_pa is wired and ready — re-scrape the iframe URLs, then "
                    "delete this line (needs headless)",
    "Idaho": "statute text is JS-rendered — static HTML has only the breadcrumb (phase 2)",
}


# ─────────────────────────────────────────────────────────────────────────────
# driver
# ─────────────────────────────────────────────────────────────────────────────

def iter_manifest(state):
    mpath = os.path.join(ROOT, state, "manifest.tsv")
    with open(mpath, encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2 or not parts[0] or not parts[1]:
                continue
            status = parts[2] if len(parts) > 2 else ""
            if status and status != "200":
                continue
            yield parts[0], os.path.join(ROOT, state, parts[1])


def domain_of(state):
    for url, _ in iter_manifest(state):
        return urlparse(url).netloc
    return None


def parse_one(state, url, path, kind, adapter):
    raw = open(path, "rb").read()
    fmt = sniff(raw)
    if kind == "pdf":
        # this domain's bytes are PDFs by design; extract text and dispatch. The
        # returned fmt is "ok" (not "pdf") so run_state doesn't treat it as skip.
        if fmt != "pdf":
            return [], fmt
        return adapter(state, url, pdf_to_text(path)), "ok"
    if fmt in ("pdf", "zip"):
        return [], fmt
    text = decode_bytes(raw, ENCODING_OVERRIDE.get(urlparse(url).netloc))
    if kind in ("raw", "xml"):
        return adapter(state, url, text), fmt
    soup = BeautifulSoup(text, "lxml")
    return generic_parse(state, url, soup, adapter), fmt


def run_state(state, limit=None, apply=False, show=False, shard=None):
    if state in DEFERRED:
        print(f"[{state}] DEFERRED — {DEFERRED[state]}")
        return []
    dom = domain_of(state)
    if dom not in SOURCES:
        print(f"[{state}] NO ADAPTER for domain {dom!r} — add a SOURCES entry")
        return []
    kind, adapter = SOURCES[dom]

    # shard = (i, m): this worker handles only manifest lines where idx % m == i,
    # so a big state can be split across m parallel processes (disjoint slices,
    # each loads its own rows — the upsert key keeps it idempotent).
    shard_i, shard_m = (shard if shard else (0, 1))
    tag = f"{state} [{shard_i + 1}/{shard_m}]" if shard_m > 1 else state

    recs, pages, skipped, empty = [], 0, 0, 0
    for idx, (url, fpath) in enumerate(iter_manifest(state)):
        if shard_m > 1 and idx % shard_m != shard_i:
            continue
        if not os.path.exists(fpath):
            continue
        pages += 1
        try:
            out, fmt = parse_one(state, url, fpath, kind, adapter)
        except Exception as e:
            skipped += 1
            if show:
                print(f"   ! {url}: {e}")
            continue
        if fmt in ("pdf", "zip"):
            skipped += 1
            continue
        if not out:
            empty += 1
            continue
        recs.extend(out)
        if limit and len(recs) >= limit:
            break

    print(f"[{tag}] {dom}  pages={pages} -> records={len(recs)}  "
          f"(empty={empty} skipped={skipped})")
    if show and recs:
        for r in recs[:5]:
            print("  " + " / ".join(r["path"]) + f"  ▸ {r['heading']}  [{r['word_count']}w]")
            print("     " + r["body_text"][:240].replace("\n", " ⏎ ") + "…")
    uniquify_source_urls(recs)
    if apply and recs:
        load(recs)
    return recs


def uniquify_source_urls(recs):
    """Multi-section-per-page sources (e.g. SC, NV) emit many records sharing one
    page URL. The upsert key is (state_code, source_url), so duplicate URLs in a
    batch trip `ON CONFLICT cannot affect row a second time`. Disambiguate by
    appending the section number as a URL fragment (an actual anchor on most
    statute sites), falling back to a stable per-page index. Idempotent on re-run:
    the parse is deterministic, so the same record gets the same fragment.
    Section-per-page states (already loaded) have no repeats, so this is a no-op
    for them."""
    seen, per_page = set(), {}
    for r in recs:
        url = r["source_url"]
        if url not in seen:
            seen.add(url)
            continue
        # this url already used — mint a unique variant for this section
        sec = r.get("section_num")
        n = per_page.get(url, 0) + 1
        per_page[url] = n
        frag = re.sub(r"[^\w.-]+", "-", sec).strip("-") if sec else f"i{n}"
        candidate = f"{url}#{frag}"
        while candidate in seen:  # same section_num twice on a page → fall to index
            n += 1
            per_page[url] = n
            candidate = f"{url}#{frag}-{n}"
        r["source_url"] = candidate
        seen.add(candidate)


def load(recs):
    import psycopg2
    from psycopg2.extras import execute_values
    conn = psycopg2.connect("dbname=self_law")
    conn.autocommit = False
    cur = conn.cursor()
    sql = """
        INSERT INTO public.state_sections
            (state, state_code, path, heading, section_num, body_text, body_md,
             word_count, source_url, sort_key)
        VALUES %s
        ON CONFLICT (state_code, source_url) DO UPDATE SET
            path=EXCLUDED.path, heading=EXCLUDED.heading,
            section_num=EXCLUDED.section_num, body_text=EXCLUDED.body_text,
            body_md=EXCLUDED.body_md, word_count=EXCLUDED.word_count,
            sort_key=EXCLUDED.sort_key, fetched_at=now()
    """
    rows = [(r["state"], r["state_code"], r["path"], r["heading"], r["section_num"],
             r["body_text"], r["body_md"], r["word_count"], r["source_url"],
             r["sort_key"]) for r in recs]
    execute_values(cur, sql, rows, page_size=1000)
    conn.commit()
    cur.close()
    conn.close()
    print(f"   ↳ loaded/updated {len(rows)} rows into state_sections")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--show", action="store_true")
    ap.add_argument("--shard", help='split one state across processes, e.g. "3/8" = worker 3 of 8')
    args = ap.parse_args()

    shard = None
    if args.shard:
        i, m = args.shard.split("/")
        shard = (int(i), int(m))

    if args.all:
        states = sorted(d for d in os.listdir(ROOT)
                        if os.path.isdir(os.path.join(ROOT, d)))
        for s in states:
            run_state(s, limit=args.limit, apply=args.apply, show=args.show)
    elif args.state:
        run_state(args.state, limit=args.limit, apply=args.apply, show=args.show, shard=shard)
    else:
        ap.error("pass --state NAME or --all")


if __name__ == "__main__":
    main()
