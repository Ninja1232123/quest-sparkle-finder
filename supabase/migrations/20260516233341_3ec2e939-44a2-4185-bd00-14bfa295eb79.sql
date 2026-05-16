
WITH irm_titles(part_num, title) AS (
  VALUES
    (1,'Organization, Finance, and Management'),(2,'Information Technology'),
    (3,'Submission Processing'),(4,'Examining Process'),(5,'Collecting Process'),
    (6,'Human Resources Management'),(7,'Rulings and Agreements'),(8,'Appeals'),
    (9,'Criminal Investigation'),
    (10,'Security, Privacy, Assurance and Artificial Intelligence'),
    (11,'Communications and Liaison'),(13,'Taxpayer Advocate Service'),
    (20,'Penalty and Interest'),(21,'Customer Account Services'),
    (22,'Taxpayer Education and Assistance'),(25,'Special Topics'),
    (30,'Chief Counsel Directives Manual – Administrative'),
    (31,'Chief Counsel Directives Manual – Guiding Principles'),
    (32,'Chief Counsel Directives Manual – Published Guidance and Other Guidance to Taxpayers'),
    (33,'Chief Counsel Directives Manual – Legal Advice'),
    (34,'Chief Counsel Directives Manual – Litigation in District Court, Bankruptcy Court, Court of Federal Claims, and State Court'),
    (35,'Chief Counsel Directives Manual – Tax Court Litigation'),
    (36,'Chief Counsel Directives Manual – Appellate Litigation and Actions on Decision'),
    (37,'Chief Counsel Directives Manual – Disclosure'),
    (38,'Chief Counsel Directives Manual – Criminal Tax'),
    (39,'Chief Counsel Directives Manual – General Legal Services')
)
UPDATE documents d
SET parent_label = 'Part ' || t.part_num || ' · ' || t.title
FROM irm_titles t
WHERE d.source_code = 'irm'
  AND NULLIF(substring(d.parent_label FROM '^Part\s+(\d+)'), '')::int = t.part_num
  AND d.parent_label IS DISTINCT FROM 'Part ' || t.part_num || ' · ' || t.title;
