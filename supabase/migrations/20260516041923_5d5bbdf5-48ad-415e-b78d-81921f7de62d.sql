-- See /tmp/cfr_migration.sql; pasted below
-- Backfill CFR parent_label with chapter/subchapter/part names from eCFR structure
DO $$
BEGIN
  RAISE NOTICE 'CFR parent_label backfill starting';
END $$;