CREATE OR REPLACE FUNCTION public.run_query_text(q text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE r RECORD; result text := '';
BEGIN
  FOR r IN EXECUTE q LOOP
    result := result || r::text || E'\n';
  END LOOP;
  RETURN result;
END;
$func$;

-- 1. Check authenticator role
SELECT run_query_text(
  'SELECT rolname::text, rolcanlogin::text, rolsuper::text FROM pg_roles WHERE rolname IN (''authenticator'', ''anon'', ''authenticated'', ''service_role'') ORDER BY rolname'
);

-- 2. Check what the anon key JWT actually sets as role
SELECT run_query_text(
  'SELECT rolname::text FROM pg_roles WHERE rolname = current_setting(''request.jwt.claim.role'', true)'
);
