#!/usr/bin/env python3
"""Project state_sections (the 50-state corpus) into document_sections so the
website serves them.

The site reads everything from document_sections (the `documents` view is a
passthrough); state_sections is a separate partitioned table the frontend never
queries. This script copies each state row into document_sections shaped like a
federal source:

  source_code   = lowercased state_code   ('pa', 'ca', …) — one source per state
  identifier    = '/<sc>/<slug path>/<slug section>'      — unique, URL = /code + it
  parent_label  = path with the corpus name dropped, joined by ' · '
                  (so source_toc's split gives title_group / part_group like USC)
  section_label = NULL  (state `heading` already carries "§ N. Catchline.", and the
                  reader renders "{section_label}. {heading}" — NULL avoids a dupe)
  heading       = the state heading (fallback to "§ <num>")
  hierarchy     = path
  body_text/md, word_count, sort_key = copied straight across

search_tsv is a generated column (computed on insert); embedding stays NULL
(no semantic vectors for states yet). Idempotent: deletes a state's rows before
re-inserting, so re-runs are safe.

  python3 scripts/project_states_to_documents.py            # all states
  python3 scripts/project_states_to_documents.py PA CA      # just these
"""
import re
import sys
import psycopg2
from psycopg2.extras import execute_values

INSERT_COLS = ("source_code", "identifier", "parent_label", "section_label",
               "heading", "body_text", "body_md", "hierarchy", "word_count",
               "sort_key")


def slugify(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def build_identifier(sc, path, section_num, heading, rid, seen):
    # drop the corpus name (path[0]); slugify the rest + the section token
    parts = [slugify(p) for p in path[1:]]
    sec = slugify(section_num or heading or str(rid))
    parts.append(sec)
    parts = [p for p in parts if p]
    base = "/" + sc + "/" + "/".join(parts)
    base = base[:280]                      # identifier validator caps at 300
    ident = base
    n = 1
    while ident in seen:                   # de-dupe within the state
        n += 1
        ident = f"{base}-{n}"
    seen.add(ident)
    return ident


def parent_label(path):
    # path[0] is the corpus name ("California Codes", "Delaware Code", …) — it's
    # redundant once you're browsing that state's source, so drop it. The rest
    # becomes "Title 18 · Chapter 25"; source_toc splits on the first ' · '.
    if len(path) >= 2:
        return " · ".join(path[1:])
    return path[0] if path else None


def project_state(conn, state_code):
    sc = state_code.lower()
    seen = set()
    rows = []
    with conn.cursor(name=f"src_{sc}") as cur:   # server-side cursor: stream
        cur.itersize = 5000
        cur.execute(
            "SELECT id, path, heading, section_num, body_text, body_md, "
            "word_count, sort_key FROM state_sections WHERE state_code = %s "
            "ORDER BY id",
            (state_code,),
        )
        for rid, path, heading, section_num, body_text, body_md, wc, sort_key in cur:
            path = path or []
            ident = build_identifier(sc, path, section_num, heading, rid, seen)
            head = heading or (f"§ {section_num}" if section_num else "Section")
            rows.append((
                sc, ident, parent_label(path), None,
                head, body_text, body_md, path, wc, sort_key,
            ))
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.execute("DELETE FROM document_sections WHERE source_code = %s", (sc,))
        sql = (f"INSERT INTO document_sections ({','.join(INSERT_COLS)}) VALUES %s")
        execute_values(cur, sql, rows, page_size=2000)
    conn.commit()
    return len(rows)


def main(argv):
    conn = psycopg2.connect("dbname=self_law")
    if argv:
        states = [s.upper() for s in argv]
    else:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT state_code FROM state_sections "
                        "WHERE state_code <> 'DC' ORDER BY state_code")
            states = [r[0] for r in cur.fetchall()]
    total = 0
    for st in states:
        n = project_state(conn, st)
        total += n
        print(f"  {st} -> {n:>7} rows  (source_code='{st.lower()}')", flush=True)
    print(f"DONE  {len(states)} states, {total} rows projected into document_sections")
    conn.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
