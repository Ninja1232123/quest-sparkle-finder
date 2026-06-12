#!/usr/bin/env python3
"""
cl_opinions_ingest.py — load CourtListener opinion text into the local DB.

Uses PostgreSQL COPY (via psycopg2 copy_expert) which handles embedded
newlines in HTML fields correctly — Python's csv module cannot.

Usage:
  python scripts/cl_opinions_ingest.py opinions-2026-03-31.csv.bz2

Options:
  --db   PostgreSQL DSN (default: postgresql:///courtlistener  — Unix socket, peer auth)
"""

import argparse
import bz2
import sys
import time

import psycopg2

DEFAULT_DB = "postgresql:///courtlistener"

# Load only the 4 columns we need into the slim opinion_text table.
# The CSV has 22 columns; we extract just these via a temp table + INSERT SELECT.
# Faster: use COPY to a TEMP TABLE (all columns, no constraints), then INSERT.
COPY_COLS = (
    "id, date_created, date_modified, author_str, per_curiam, joined_by_str, "
    "type, sha1, page_count, download_url, local_path, plain_text, html, "
    "html_lawbox, html_columbia, html_anon_2020, xml_harvard, xml_scan, "
    "html_with_citations, extracted_by_ocr, author_id, cluster_id"
)

CREATE_TEMP = """
CREATE TEMP TABLE opinion_raw (
    id bigint, date_created text, date_modified text, author_str text,
    per_curiam text, joined_by_str text, type text, sha1 text,
    page_count text, download_url text, local_path text, plain_text text,
    html text, html_lawbox text, html_columbia text, html_anon_2020 text,
    xml_harvard text, xml_scan text, html_with_citations text,
    extracted_by_ocr text, author_id text, cluster_id bigint
) ON COMMIT DROP;
"""

COPY_SQL = (
    r"COPY opinion_raw FROM STDIN WITH (FORMAT csv, HEADER true, NULL '', ESCAPE '\')"
)

INSERT_SQL = """
INSERT INTO opinion_text (id, cluster_id, plain_text, html_with_citations)
SELECT id, cluster_id,
       COALESCE(NULLIF(TRIM(plain_text), ''), '') AS plain_text,
       COALESCE(NULLIF(TRIM(html_with_citations), ''), '') AS html_with_citations
FROM opinion_raw
ON CONFLICT (id) DO UPDATE
    SET plain_text          = EXCLUDED.plain_text,
        html_with_citations = EXCLUDED.html_with_citations;
"""


def run(source_path, db_dsn):
    conn = psycopg2.connect(db_dsn)
    conn.autocommit = False
    cur = conn.cursor()

    t0 = time.time()
    try:
        cur.execute(CREATE_TEMP)
        print("Streaming CSV into temp table...", flush=True)

        if source_path == "-":
            import io
            src = sys.stdin.buffer
            magic = src.read(2)
            rest = src.read()
            data = bz2.decompress(magic + rest) if magic == b"BZ" else (magic + rest)
            cur.copy_expert(COPY_SQL, io.BytesIO(data))
        elif source_path.endswith(".bz2"):
            with bz2.open(source_path, "rb") as f:
                cur.copy_expert(COPY_SQL, f)
        else:
            with open(source_path, "rb") as f:
                cur.copy_expert(COPY_SQL, f)

        print(f"COPY done ({time.time()-t0:.0f}s), inserting into opinion_text...", flush=True)
        cur.execute(INSERT_SQL)
        conn.commit()

        elapsed = time.time() - t0
        cur.execute("SELECT COUNT(*) FROM opinion_text;")
        count = cur.fetchone()[0]
        print(f"Done. {count:,} rows in opinion_text  ({elapsed:.0f}s)")
        print("\nNext: run scripts/cl_fix_fdw.sql in pgAdmin (self_law) to fix the FDW.")

    except Exception as e:
        conn.rollback()
        print(f"\nError: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()


def main():
    ap = argparse.ArgumentParser(description="Load CourtListener opinion text via COPY")
    ap.add_argument("source", help="Path to opinions CSV or .csv.bz2 (or - for stdin)")
    ap.add_argument("--db", default=DEFAULT_DB, help="PostgreSQL DSN")
    args = ap.parse_args()
    run(args.source, args.db)


if __name__ == "__main__":
    main()
