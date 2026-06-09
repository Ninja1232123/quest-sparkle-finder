-- Run in the `courtlistener` database (pgAdmin → courtlistener → Query Tool,
-- or: psql -U postgres courtlistener -f scripts/cl-grant-authenticator.sql)
--
-- Grants read-only SELECT to `authenticator` on the tables the cases panel
-- and Juri need. The `authenticator` role already exists (it's the PostgREST
-- login role for self_law); we're just extending its reach to courtlistener.

GRANT CONNECT ON DATABASE courtlistener TO authenticator;

GRANT SELECT ON search_opinioncluster            TO authenticator;
GRANT SELECT ON search_docket                    TO authenticator;
GRANT SELECT ON cluster_outcome                  TO authenticator;
GRANT SELECT ON search_opinion                   TO authenticator;
GRANT SELECT ON search_citation                  TO authenticator;
GRANT SELECT ON search_parenthetical             TO authenticator;
GRANT SELECT ON search_court                     TO authenticator;
GRANT SELECT ON search_opinionscited             TO authenticator;
