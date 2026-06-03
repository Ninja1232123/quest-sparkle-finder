CREATE OR REPLACE FUNCTION public._scope_sources(p_scope text, p_source text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_source IS NOT NULL THEN ARRAY[p_source]
    WHEN p_scope = 'all'      THEN NULL
    WHEN p_scope = 'primary'  THEN ARRAY['register','statutes-at-large','bill','public-papers-president','statute-compilations','public-private-law']
    WHEN p_scope = 'cases'    THEN ARRAY[]::text[]
    WHEN p_scope = 'states'   THEN ARRAY[
      'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
      'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
      'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
      'va','wa','wv','wi','wy']
    ELSE ARRAY['const','usc','cfr','ucc','tfm','irm']  -- 'codified' (default)
  END;
$function$;
