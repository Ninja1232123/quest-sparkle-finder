#!/usr/bin/env python3
"""
cl_opinions_ingest.py — load CourtListener opinion text into the local DB.

The search_opinion table exists but is empty (the dataset ships metadata-only).
This script streams the bulk CSV (bz2-compressed) and inserts only the 5 columns
Self-Law actually needs: id, cluster_id, plain_text, html_with_citations,
ordering_key.  Heavy fields (xml_harvard, html_columbia, html_lawbox, etc.) are
skipped to keep storage manageable.

Download the latest bulk CSV first:
  https://www.courtlistener.com/api/bulk-data/
  (free with a CL account — look for opinions-YYYY-MM-DD.csv.bz2)
  Direct S3 path pattern:
  https://storage.courtlistener.com/bulk-data/opinions-YYYY-MM-DD.csv.bz2

Usage:
  python scripts/cl_opinions_ingest.py opinions-2024-01-31.csv.bz2

  # Or pipe straight from wget without storing the full file:
  wget -qO- URL | python scripts/cl_opinions_ingest.py -

Options:
  --db   PostgreSQL DSN (default: postgresql://k@127.0.0.1:5432/courtlistener)
  --batch  Rows per COPY batch (default: 5000)
"""

import argparse
import bz2
import csv
import io
import sys
import time

import psycopg2
import psycopg2.extras

DEFAULT_DB = "postgresql://k@127.0.0.1:5432/courtlistener"
DEFAULT_BATCH = 5_000

# Only columns we need — everything else (xml_harvard, html_columbia, etc.) is
# skipped.  text_col picks the best text: plain_text first, html_with_citations
# as fallback (handled in get_case_opinion / TypeScript layer, not here).
WANT = ("id", "cluster_id", "plain_text", "html_with_citations", "ordering_key")

INSERT = """
    INSERT INTO search_opinion (id, cluster_id, plain_text, html_with_citations, ordering_key)
    VALUES %s
    ON CONFLICT (id) DO UPDATE
        SET plain_text          = EXCLUDED.plain_text,
            html_with_citations = EXCLUDED.html_with_citations,
            ordering_key        = EXCLUDED.ordering_key
"""


def open_source(path):
    """Return a line iterator over the (possibly bz2-compressed) CSV."""
    if path == "-":
        # Piped from stdin — stdin delivers raw bytes
        raw = sys.stdin.buffer
        if raw.read(2) == b"BZ":
            raw.seek(0)
            return io.TextIOWrapper(bz2.open(raw, "rb"), encoding="utf-8", errors="replace")
        raw.seek(0)
        return io.TextIOWrapper(raw, encoding="utf-8", errors="replace")
    if path.endswith(".bz2"):
        return bz2.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def run(source_path, db_dsn, batch_size):
    conn = psycopg2.connect(db_dsn)
    conn.autocommit = False
    cur = conn.cursor()

    # Disable autovacuum during load — re-enables on reconnect.
    cur.execute("ALTER TABLE search_opinion SET (autovacuum_enabled = false);")
    conn.commit()

    t0 = time.time()
    rows_done = 0
    rows_skipped = 0
    batch = []

    try:
        with open_source(source_path) as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                # Some CSV exports use different capitalisation — normalise.
                r = {k.lower().strip(): v for k, v in row.items()}

                oid = r.get("id") or r.get("opinion_id")
                cid = r.get("cluster_id")
                if not oid or not cid:
                    rows_skipped += 1
                    continue

                batch.append((
                    int(oid),
                    int(cid),
                    (r.get("plain_text") or "").strip() or None,
                    (r.get("html_with_citations") or "").strip() or None,
                    int(r["ordering_key"]) if r.get("ordering_key") else None,
                ))

                if len(batch) >= batch_size:
                    psycopg2.extras.execute_values(cur, INSERT, batch)
                    conn.commit()
                    rows_done += len(batch)
                    batch.clear()
                    elapsed = time.time() - t0
                    rate = rows_done / elapsed if elapsed else 0
                    print(f"  {rows_done:>9,}  inserted   ({rate:,.0f} rows/s)", end="\r", flush=True)

        if batch:
            psycopg2.extras.execute_values(cur, INSERT, batch)
            conn.commit()
            rows_done += len(batch)

    finally:
        # Re-enable autovacuum whether we finished or hit an error.
        cur.execute("ALTER TABLE search_opinion SET (autovacuum_enabled = true);")
        conn.commit()
        cur.close()
        conn.close()

    elapsed = time.time() - t0
    print(f"\nDone. {rows_done:,} inserted, {rows_skipped:,} skipped  ({elapsed:.1f}s)")
    print("\nNext: run scripts/cl_fix_fdw.sql in pgAdmin (self_law) to fix the FDW.")


def main():
    ap = argparse.ArgumentParser(description="Load CourtListener opinion text")
    ap.add_argument("source", help="Path to opinions CSV or .csv.bz2 (or - for stdin)")
    ap.add_argument("--db", default=DEFAULT_DB, help="PostgreSQL DSN")
    ap.add_argument("--batch", type=int, default=DEFAULT_BATCH, help="Rows per commit")
    args = ap.parse_args()
    run(args.source, args.db, args.batch)


if __name__ == "__main__":
    main()
