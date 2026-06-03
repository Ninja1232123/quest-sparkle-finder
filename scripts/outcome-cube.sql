-- Analytics cube — pre-aggregated outcome base rates
-- ------------------------------------------------------------------
-- L3 in COURT_DATA_SPEC.md. Two feeds into ONE unified `outcome_cube`:
--   federal_civil    — FJC IDB (9.38M rows): disposition (how it ended) deferring
--                      to judgment (who won) on merits dispositions. case_type = NOS.
--   state_appellate  — cluster_outcome (built by state-outcome-classifier.sql):
--                      affirm/reverse/etc. case_type='all' (state NOS is sparse).
-- Cube grain: (layer, court_id, jurisdiction, case_type, year, outcome) -> n.
-- Tiny vs source; serving slices roll up further. Re-run:
--   psql "$URI" -f scripts/state-outcome-classifier.sql   (state feed first)
--   psql "$URI" -f scripts/outcome-cube.sql
-- ------------------------------------------------------------------

-- Nature-of-suit decode (FJC codes -> label), for serving readable case types.
DROP TABLE IF EXISTS nos_label;
CREATE TABLE nos_label (code int PRIMARY KEY, label text NOT NULL);
INSERT INTO nos_label (code, label) VALUES
  (110, 'Insurance'),
  (120, 'Marine contract actions'),
  (130, 'Miller act'),
  (140, 'Negotiable instruments'),
  (150, 'Overpayments & enforcement of judgments'),
  (151, 'Overpayments under the medicare act'),
  (152, 'Recovery of defaulted student loans'),
  (153, 'Recovery of overpayments of vet benefits'),
  (160, 'Stockholder''s suits'),
  (190, 'Other contract actions'),
  (195, 'Contract product liability'),
  (196, 'Contract franchise'),
  (210, 'Land condemnation'),
  (220, 'Foreclosure'),
  (230, 'Rent, lease, ejectment'),
  (240, 'Torts to land'),
  (245, 'Tort product liability'),
  (290, 'Other real property actions'),
  (310, 'Airplane personal injury'),
  (315, 'Airplane product liability'),
  (320, 'Assault, libel, and slander'),
  (330, 'Federal employers'' liability'),
  (340, 'Marine personal injury'),
  (345, 'Marine - Product liability'),
  (350, 'Motor vehicle personal injury'),
  (355, 'Motor vehicle product liability'),
  (360, 'Other personal liability'),
  (362, 'Medical malpractice'),
  (365, 'Personal injury - Product liability'),
  (367, 'Health care / pharm'),
  (368, 'Asbestos personal injury - Prod. Liab.'),
  (370, 'Other fraud'),
  (371, 'Truth in lending'),
  (375, 'False Claims Act'),
  (380, 'Other personal property damage'),
  (385, 'Property damage - Product liability'),
  (400, 'State re-appointment'),
  (410, 'Antitrust'),
  (422, 'Bankruptcy appeals rule 28 USC 158'),
  (423, 'Bankruptcy withdrawal 28 USC 157'),
  (430, 'Banks and banking'),
  (440, 'Civil rights other'),
  (441, 'Civil rights voting'),
  (442, 'Civil rights jobs'),
  (443, 'Civil rights accomodations'),
  (444, 'Civil rights welfare'),
  (445, 'Civil rights ADA employment'),
  (446, 'Civil rights ADA other'),
  (448, 'Education'),
  (450, 'Interstate commerce'),
  (460, 'Deportation'),
  (462, 'Naturalization, petition for hearing of denial'),
  (463, 'Habeas corpus - alien detainee'),
  (465, 'Other immigration actions'),
  (470, 'Civil (RICO)'),
  (480, 'Consumer credit'),
  (490, 'Cable/Satellite TV'),
  (510, 'Prisoner petitions - vacate sentence'),
  (530, 'Prisoner petitions - habeas corpus'),
  (535, 'Habeas corpus: Death penalty'),
  (540, 'Prisoner petitions - mandamus and other'),
  (550, 'Prisoner - civil rights'),
  (555, 'Prisoner - prison condition'),
  (560, 'Civil detainee'),
  (610, 'Agricultural acts'),
  (620, 'Food and drug acts'),
  (625, 'Drug related seizure of property'),
  (630, 'Liquor laws'),
  (640, 'Railroad and trucks'),
  (650, 'Airline regulations'),
  (660, 'Occupational safety/health'),
  (690, 'Other forfeiture and penalty suits'),
  (710, 'Fair Labor Standards Act'),
  (720, 'Labor/Management Relations Act'),
  (730, 'Labor/Management report & disclosure'),
  (740, 'Railway Labor Act'),
  (751, 'Family and Medical Leave Act'),
  (790, 'Other labor litigation'),
  (791, 'Employee Retirement Income Security Act'),
  (810, 'Selective service'),
  (820, 'Copyright'),
  (830, 'Patent'),
  (835, 'Patent Abbreviated New Drug Application (ANDA)'),
  (840, 'Trademark'),
  (850, 'Securities, Commodities, Exchange'),
  (860, 'Social security'),
  (861, 'HIA (1395 FF) / Medicare'),
  (862, 'Black lung'),
  (863, 'D.I.W.C. / D.I.W.W.'),
  (864, 'S.S.I.D.'),
  (865, 'R.S.I.'),
  (870, 'Tax suits'),
  (871, 'IRS 3rd party suits 26 USC 7609'),
  (875, 'Customer challenge 12 USC 3410'),
  (890, 'Other statutory actions'),
  (891, 'Agricultural acts'),
  (892, 'Economic Stabilization Act'),
  (893, 'Environmental matters'),
  (894, 'Energy Allocation Act'),
  (895, 'Freedom of Information Act of 1974'),
  (896, 'Arbitration'),
  (899, 'Administrative procedure act / review or appeal of agency decision'),
  (900, 'Appeal of fee - equal access to justice'),
  (910, 'Domestic relations'),
  (920, 'Insanity'),
  (930, 'Probate'),
  (940, 'Substitute trustee'),
  (950, 'Constitutionality of state statutes'),
  (990, 'Other'),
  (992, 'Local jurisdictional appeal'),
  (999, 'Miscellaneous'),
  (376, 'Qui Tam (31 USC 3729(a))'),
  (420, 'Antitrust (appeals)'),
  (421, '(Bankruptcy-related; appears in data, not in AO cover sheet)'),
  (485, 'Telephone Consumer Protection Act (TCPA)'),
  (880, 'Defend Trade Secrets Act of 2016 (DTSA)');

-- Federal CIVIL outcome: disposition says how it ended; merits dispositions
-- (default/consent/motion/verdict/trial/arbitration) defer to judgment (winner).
CREATE OR REPLACE FUNCTION juri_idb_civil_outcome(disp smallint, judg smallint)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN disp = 13 THEN 'settled'
    WHEN disp IN (12) THEN 'dismissed'              -- voluntarily dismissed
    WHEN disp IN (2,3,14,16,17,18) THEN 'dismissed' -- want of pros / juris / other / stayed / stat close
    WHEN disp IN (0,10) THEN 'transferred'
    WHEN disp IN (1,11) THEN 'remanded'
    WHEN disp = 19 THEN 'affirmed'                  -- appeal affirmed (magistrate)
    WHEN disp = 20 THEN 'denied'                    -- appeal denied (magistrate)
    WHEN disp IN (4,5,6,7,8,9,15) THEN              -- a merits judgment -> who won
      CASE judg WHEN 1 THEN 'plaintiff_win'
                WHEN 2 THEN 'defendant_win'
                WHEN 3 THEN 'mixed'
                ELSE 'decided_other' END
    ELSE 'other'
  END
$$;

DROP TABLE IF EXISTS outcome_cube;
CREATE TABLE outcome_cube AS
-- Federal civil feed (dataset_source 1,2,8,9,10)
SELECT
  'federal_civil'::text AS layer,
  coalesce(district_id, circuit_id, 'unknown') AS court_id,
  'FD'::text                                AS jurisdiction,
  coalesce(nature_of_suit::text, 'unknown') AS case_type,
  extract(year FROM date_filed)::int        AS year,
  juri_idb_civil_outcome(disposition, judgment) AS outcome,
  count(*)                                  AS n
FROM recap_fjcintegrateddatabase
WHERE dataset_source IN (1,2,8,9,10)
  AND date_filed IS NOT NULL
GROUP BY 1,2,3,4,5,6
UNION ALL
-- State appellate / supreme feed
SELECT
  'state_appellate'::text AS layer,
  court_id,
  jurisdiction,
  'all'::text                               AS case_type,
  extract(year FROM date_filed)::int        AS year,
  outcome,
  count(*)                                  AS n
FROM cluster_outcome
WHERE outcome IS NOT NULL AND date_filed IS NOT NULL
GROUP BY 1,2,3,4,5,6;

ALTER TABLE outcome_cube ADD PRIMARY KEY (layer, court_id, jurisdiction, case_type, year, outcome);
CREATE INDEX outcome_cube_layer_idx ON outcome_cube (layer, jurisdiction);
CREATE INDEX outcome_cube_court_idx ON outcome_cube (court_id, case_type);
CREATE INDEX outcome_cube_type_idx  ON outcome_cube (case_type, outcome);
ANALYZE outcome_cube;
