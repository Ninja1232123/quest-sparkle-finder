#!/usr/bin/env python3
"""Re-scrape Pennsylvania consolidated statutes via the iframe content frame.

The original PA crawl captured only the jQuery wrapper pages (empty
<iframe id="IFrame_StatuteText" src="about:blank">); the real statute text lives
at the same URL + "&iFrame=true". palegis.us 403s a bare client, so we send a
browser UA + a Referer.

The CHAPTER-level URL (ttl + chpt, no sctn) returns the whole chapter's sections
in one frame — exactly what parse_pa expects — so we fetch ~1045 chapter pages
instead of 15.4k section pages.

Writes pages/<md5>.html + a fresh manifest.tsv into the Pennsylvania dir, in the
same format state_ingest.py reads. Resumable: existing non-trivial files skipped.
"""
import concurrent.futures as cf
import hashlib
import os
import sys
import time
import urllib.request
import urllib.error

OUT = "/mnt/sdb1/States/Pennsylvania"
PAGES = os.path.join(OUT, "pages")
MANIFEST = os.path.join(OUT, "manifest.tsv")
CHAPTERS = "/tmp/pa_chapters.txt"
BASE = "https://www.palegis.us/statutes/consolidated/view-statute?"
REFERER = "https://www.palegis.us/statutes/consolidated/view-statute"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")
WORKERS = 6
DELAY = 0.25          # per-worker polite pause
MIN_OK = 3000         # bytes; smaller than this == a 403/shell, treat as miss


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def fetch(query):
    url = BASE + query + "&iFrame=true"
    fname = f"{md5(url)}.html"
    fpath = os.path.join(PAGES, fname)
    if os.path.exists(fpath) and os.path.getsize(fpath) >= MIN_OK:
        return url, fname, 200, os.path.getsize(fpath), "cached"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": REFERER})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                code = r.getcode()
            if code == 200 and len(data) >= MIN_OK:
                with open(fpath, "wb") as fh:
                    fh.write(data)
                time.sleep(DELAY)
                return url, fname, 200, len(data), "fetched"
            # too-small / non-200 — back off and retry
            time.sleep(0.6 * (attempt + 1))
        except (urllib.error.URLError, OSError) as e:
            time.sleep(0.8 * (attempt + 1))
            last = str(e)
    return url, fname, 0, 0, "FAIL"


def main():
    os.makedirs(PAGES, exist_ok=True)
    with open(CHAPTERS) as f:
        queries = [ln.strip() for ln in f if ln.strip()]
    print(f"[pa] {len(queries)} chapter URLs, {WORKERS} workers", flush=True)

    rows, fetched, cached, failed = [], 0, 0, 0
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for i, (url, fname, code, nbytes, how) in enumerate(
                ex.map(fetch, queries), 1):
            if how == "fetched":
                fetched += 1
            elif how == "cached":
                cached += 1
            if code == 200:
                rows.append(f"{url}\tpages/{fname}\t200\t{nbytes}")
            else:
                failed += 1
            if i % 100 == 0:
                print(f"  {i}/{len(queries)}  fetched={fetched} cached={cached} "
                      f"failed={failed}", flush=True)

    # back up the old shell manifest once, then write the iframe manifest
    if os.path.exists(MANIFEST) and not os.path.exists(MANIFEST + ".shells.bak"):
        os.rename(MANIFEST, MANIFEST + ".shells.bak")
    with open(MANIFEST, "w") as fh:
        fh.write("\n".join(rows) + "\n")
    print(f"[pa] DONE  ok={len(rows)} fetched={fetched} cached={cached} "
          f"failed={failed}  -> {MANIFEST}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
