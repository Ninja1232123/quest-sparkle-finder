#!/usr/bin/env bash
# Continuation: wait for the cap-search-tsv migration to finish, restore the
# documents view grants, then project every state not yet in document_sections.
# Self-contained so the pipeline completes without babysitting.
set -u
cd /home/k/quest-sparkle-finder

echo "[finish] waiting for cap-search-tsv migration to exit…"
while pgrep -f "cap-search-tsv.sql" >/dev/null 2>&1; do sleep 10; done

# Confirm the migration actually applied the capped generated column.
capped=$(psql self_law -t -A -c "SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE a.attrelid='document_sections'::regclass AND a.attname='search_tsv';" 2>/dev/null)
if ! echo "$capped" | grep -q "500000"; then
  echo "[finish] ABORT — search_tsv is not the capped definition; migration may have failed:"
  echo "  $capped"
  exit 1
fi
echo "[finish] migration applied (search_tsv capped at 500000)."

echo "[finish] restoring documents view grants…"
psql self_law -v ON_ERROR_STOP=1 -f scripts/restore-documents-grants.sql 2>&1 | tail -3

# States already present (committed per-state before the IN failure).
done_states=$(psql self_law -t -A -c "SELECT string_agg(DISTINCT upper(source_code), ' ') FROM document_sections ds JOIN (SELECT DISTINCT lower(state_code) sc FROM state_sections) s ON s.sc=ds.source_code;" 2>/dev/null)
echo "[finish] already projected: $done_states"

# Remaining = all state_codes minus the ones already in document_sections.
remaining=$(psql self_law -t -A -c "SELECT string_agg(state_code,' ' ORDER BY state_code) FROM (SELECT DISTINCT state_code FROM state_sections WHERE state_code<>'DC' EXCEPT SELECT upper(source_code) FROM document_sections WHERE source_code IN (SELECT distinct lower(state_code) FROM state_sections)) t;" 2>/dev/null)
echo "[finish] remaining to project: ${remaining:-(none)}"

if [ -n "${remaining// /}" ]; then
  python3 scripts/project_states_to_documents.py $remaining 2>&1
fi

echo "[finish] === FINAL TALLY ==="
psql self_law -t -A -F' | ' -c "SELECT count(DISTINCT source_code) AS state_sources, count(*) AS state_rows FROM document_sections WHERE source_code IN (SELECT DISTINCT lower(state_code) FROM state_sections);" 2>/dev/null
echo "[finish] DONE"
