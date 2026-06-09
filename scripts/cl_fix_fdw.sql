-- cl_fix_fdw.sql — run in self_law (as superuser) after loading search_opinion data.
--
-- 1. Recreates the cl.opinions foreign table with the correct column name
--    (ordering_key, not position — the old definition caused every case-page load
--    to fail with "column r6.position does not exist").
-- 2. Replaces cl.get_case_opinion with a version that actually joins opinion text.

-- ── 1. Fix cl.opinions foreign table ─────────────────────────────────────────

DROP FOREIGN TABLE IF EXISTS cl.opinions;

CREATE FOREIGN TABLE cl.opinions (
    id                  bigint,
    cluster_id          bigint,
    plain_text          text,
    html_with_citations text,
    ordering_key        integer
)
SERVER courtlistener_fdw
OPTIONS (schema_name 'public', table_name 'search_opinion');

GRANT SELECT ON cl.opinions TO anon, authenticator;

-- ── 2. Fix cl.get_case_opinion ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cl.get_case_opinion(p_cluster_id bigint)
RETURNS TABLE(
    cl_cluster_id bigint,
    case_name     text,
    court         text,
    date_filed    date,
    cite_count    integer,
    slug          text,
    outcome       text,
    text_content  text
)
LANGUAGE sql STABLE AS $$
    SELECT
        oc.id,
        oc.case_name,
        d.court_id,
        oc.date_filed,
        oc.citation_count,
        oc.slug,
        co.outcome,
        COALESCE(
            NULLIF(TRIM(op.plain_text),          ''),
            NULLIF(TRIM(op.html_with_citations), '')
        ) AS text_content
    FROM  cl.opinion_clusters oc
    JOIN  cl.dockets           d  ON d.id         = oc.docket_id
    LEFT  JOIN cl.outcomes     co ON co.cluster_id = oc.id
    LEFT  JOIN cl.opinions     op ON op.cluster_id = oc.id
    WHERE oc.id = p_cluster_id
    ORDER BY op.ordering_key ASC NULLS LAST
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION cl.get_case_opinion TO anon, authenticator;

-- Reload PostgREST schema cache so the fixed function is picked up immediately.
-- (Runs as the user owning the PostgREST process — if this errors, send
--  kill -10 $(pgrep -f postgrest) from the shell instead.)
-- NOTIFY pgrst, 'reload schema';
