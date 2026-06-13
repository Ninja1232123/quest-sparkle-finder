#!/usr/bin/env python3
"""
state_supreme_ingest.py — load state supreme court opinions from Arrow files.

Source: /mnt/sdb1/State-Supreme-Ct/  (20 Arrow IPC stream shards, ~528k records)
Target: self_law.state_supreme_opinions

Usage:
    python scripts/state_supreme_ingest.py
    python scripts/state_supreme_ingest.py --db "postgresql:///self_law"
    python scripts/state_supreme_ingest.py --shard 0   # single shard for testing
"""

import argparse
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import pyarrow.ipc as ipc

SOURCE_DIR = Path("/mnt/sdb1/State-Supreme-Ct")
SHARDS = 20
BATCH = 500
DEFAULT_DB = "postgresql:///self_law"

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS state_supreme_opinions (
    id              uuid        PRIMARY KEY,
    title           text        NOT NULL DEFAULT '',
    citation        text,
    docket_number   text,
    state           text        NOT NULL,
    issuer          text,
    body_text       text        NOT NULL DEFAULT '',
    body_len        int         GENERATED ALWAYS AS (length(body_text)) STORED,
    hash            text,
    decided_at      timestamptz,
    title_tsv       tsvector    GENERATED ALWAYS AS (
                                    to_tsvector('english', coalesce(title, ''))
                                ) STORED,
    ingested_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS state_supreme_title_tsv_idx
    ON state_supreme_opinions USING gin(title_tsv);
CREATE INDEX IF NOT EXISTS state_supreme_state_idx
    ON state_supreme_opinions (state);
CREATE INDEX IF NOT EXISTS state_supreme_decided_idx
    ON state_supreme_opinions (decided_at DESC NULLS LAST);

-- Grants matching the rest of self_law
DO $$ BEGIN
    GRANT SELECT ON state_supreme_opinions TO anon;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
    GRANT SELECT ON state_supreme_opinions TO selflaw_web;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON state_supreme_opinions TO claude_mcp;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
"""

INSERT_SQL = """
INSERT INTO state_supreme_opinions
    (id, title, citation, docket_number, state, issuer, body_text, hash, decided_at)
VALUES %s
ON CONFLICT (id) DO NOTHING
"""


def parse_ts(val: str | None):
    if not val:
        return None
    try:
        # Arrow timestamps come as ISO strings: "2015-02-11T00:00:00Z"
        return val[:10] or None  # postgres will coerce date string fine
    except Exception:
        return None


def ingest_shard(cur, path: Path) -> tuple[int, int]:
    with ipc.open_stream(path) as f:
        table = f.read_all()

    rows = table.to_pylist()
    inserted = skipped = 0

    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        values = []
        for r in batch:
            def clean(v):
                return v.replace("\x00", "") if isinstance(v, str) else v
            values.append((
                r["id"],
                clean(r["title"] or "")[:1000],
                clean(r.get("citation")) or None,
                clean(r.get("docket_number")) or None,
                (r.get("state") or "").lower().replace(" ", "-"),
                clean(r.get("issuer")) or None,
                clean(r.get("document") or ""),
                r.get("hash") or None,
                parse_ts(r.get("timestamp")),
            ))
        psycopg2.extras.execute_values(cur, INSERT_SQL, values)
        inserted += len(values)

    return inserted, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--shard", type=int, default=None, help="single shard index (0-19) for testing")
    args = ap.parse_args()

    conn = psycopg2.connect(args.db)
    conn.autocommit = False
    cur = conn.cursor()

    print("Creating table + indexes if needed…")
    cur.execute(CREATE_TABLE)
    conn.commit()

    shards = [args.shard] if args.shard is not None else range(SHARDS)
    total_inserted = 0
    t0 = time.time()

    for idx in shards:
        path = SOURCE_DIR / f"us-{idx:05d}-of-{SHARDS:05d}.arrow"
        if not path.exists():
            print(f"  shard {idx}: not found, skipping")
            continue

        t1 = time.time()
        inserted, _ = ingest_shard(cur, path)
        conn.commit()
        total_inserted += inserted
        elapsed = time.time() - t1
        print(f"  shard {idx:02d}: {inserted:,} rows  ({elapsed:.1f}s)  — running total {total_inserted:,}")

    conn.close()
    print(f"\nDone. {total_inserted:,} rows in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
