#!/usr/bin/env bash
# Move the stat-page serving slice from the courtlistener build DB into the
# live self_law serving DB (same local Postgres instance, served via PostgREST).
#
# Pipeline:  state-outcome-classifier.sql -> outcome-cube.sql -> stat-pages-build.sql
#            (all run against courtlistener)  THEN  this script  (-> self_law).
#
# Idempotent: --clean drops+recreates the two tables in self_law, then re-applies
# the ownership/grants that match document_sections (the states-serving pattern).
set -euo pipefail

PGHOST=127.0.0.1
CRED="claude_mcp:ZhelrU552lOJS4q14HSpOu8o54M14DF9"
CL="postgresql://${CRED}@${PGHOST}:5432/courtlistener"
SELF="postgresql://${CRED}@${PGHOST}:5432/self_law"

echo "Dumping stat_page + stat_outcome from courtlistener -> self_law ..."
pg_dump "$CL" --clean --if-exists --no-owner --no-privileges \
  -t public.stat_page -t public.stat_outcome \
  | psql "$SELF" -v ON_ERROR_STOP=1 -q

echo "Applying self_law ownership/grants (match document_sections) ..."
psql "$SELF" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.stat_page    OWNER TO app_user;
ALTER TABLE public.stat_outcome OWNER TO app_user;
GRANT SELECT ON public.stat_page, public.stat_outcome TO selflaw_web, service_role, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stat_page, public.stat_outcome TO claude_mcp;
NOTIFY pgrst, 'reload schema';
SQL

psql "$SELF" -c "SELECT 'stat_page' t, count(*) FROM stat_page UNION ALL SELECT 'stat_outcome', count(*) FROM stat_outcome;"
echo "Done. Served from self_law (PostgREST :3000)."
