-- Citation-graph serving RPC (self_law)
-- ------------------------------------------------------------------
-- Powers the "cited by" side of the section citation graph in the reader
-- (src/components/marginalia/SectionCitationGraph.tsx, wired in code.$.tsx via
-- getDocument in src/lib/documents.functions.ts).
--
-- Returns the EXACT count of inbound citations to a section, grouped by the
-- citing document's source. The honesty point: a section cited 61,322× by the
-- Federal Register isn't 61,322 peer relationships — it's breadth of
-- cross-reference from one corpus. Per-source counts make that legible instead
-- of implying tens of thousands of equally-weighted edges.
--
-- Reads citation_edges (target_id btree index: citation_edges_tgtid) + documents.
-- Worst case (5 USC 552 / FOIA, ~64k inbound) ~0.34s; typical sections far less.
--
-- Run:  psql "$SELF_LAW_URI" -f scripts/citation-graph-rpc.sql
-- After running, PostgREST must refresh its schema cache to expose the function
-- (the NOTIFY below does this; without it supabase.rpc() returns nothing).
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION juri_inbound_by_source(p_target bigint)
RETURNS TABLE(source text, n bigint)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT d.source_code::text, count(*)::bigint
  FROM citation_edges e
  JOIN documents d ON d.id = e.source_id
  WHERE e.target_id = p_target
  GROUP BY d.source_code
  ORDER BY 2 DESC
$$;

GRANT EXECUTE ON FUNCTION juri_inbound_by_source(bigint) TO anon, selflaw_web, service_role;

NOTIFY pgrst, 'reload schema';
