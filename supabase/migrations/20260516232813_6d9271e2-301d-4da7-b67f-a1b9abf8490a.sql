
-- Fix remaining /irm/www.irs.gov_irm_partN_irm_NN-NNN-NNN[a] rows
WITH parsed AS (
  SELECT
    id,
    identifier,
    -- the trailing token after the last "_irm_" looks like "06-315-002" or "06-315-002a"
    regexp_replace(split_part(identifier, '_irm_', 3), '[a-z]$', '') AS code
  FROM documents
  WHERE source_code = 'irm' AND identifier LIKE '/irm/www.%'
), mapped AS (
  SELECT
    id,
    -- "06-315-002" -> part=6, chapter=315, section=2
    (split_part(code, '-', 1))::int AS part_num,
    (split_part(code, '-', 2))::int AS chapter_num,
    (split_part(code, '-', 3))::int AS section_num
  FROM parsed
)
UPDATE documents d
SET
  identifier    = '/irm/' || m.part_num || '.' || m.chapter_num || '.' || m.section_num,
  section_label = 'IRM ' || m.part_num || '.' || m.chapter_num || '.' || m.section_num,
  parent_label  = 'Part ' || m.part_num,
  hierarchy     = jsonb_build_object(
                    'part', m.part_num,
                    'chapter', m.chapter_num,
                    'section', m.section_num
                  ),
  sort_key      = lpad(m.part_num::text, 3, '0') || '.' ||
                  lpad(m.chapter_num::text, 4, '0') || '.' ||
                  lpad(m.section_num::text, 4, '0')
FROM mapped m
WHERE d.id = m.id
  AND NOT EXISTS (
    SELECT 1 FROM documents x
    WHERE x.source_code = 'irm'
      AND x.identifier = '/irm/' || m.part_num || '.' || m.chapter_num || '.' || m.section_num
      AND x.id <> d.id
  );

-- Delete any rows that collided with an already-canonical identifier
DELETE FROM doc_citations
WHERE from_document_id IN (SELECT id FROM documents WHERE source_code='irm' AND identifier LIKE '/irm/www.%');
DELETE FROM documents WHERE source_code='irm' AND identifier LIKE '/irm/www.%';
