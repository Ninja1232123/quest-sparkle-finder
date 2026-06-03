-- Strip stray BOM / zero-width characters from state labels.
--
-- A few state scrapes (e.g. WV "﻿CHAPTER 37B. MINERAL DEVELOPMENT.") carried a
-- leading U+FEFF byte-order-mark / U+200B zero-width space into parent_label and
-- heading. Invisible, but it breaks the "CHAPTER"/"TITLE" prefix detection in the
-- browse TOC (the regexes anchor on ^), so the bubble can't classify the node —
-- and it sits in the reader heading too. search_tsv is generated from heading, so
-- stripping here also cleans the index. Idempotent.
UPDATE public.document_sections
SET parent_label = regexp_replace(parent_label, U&'[\feff\200b]', '', 'g'),
    heading      = regexp_replace(heading,      U&'[\feff\200b]', '', 'g')
WHERE length(source_code) = 2
  AND (parent_label ~ U&'[\feff\200b]' OR heading ~ U&'[\feff\200b]');
