-- Grant EXECUTE on RLS helper functions to authenticated (both public and private schemas)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','private')
      AND p.prosecdef = true
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Ensure the private schema itself is usable by authenticated (needed to resolve function names)
GRANT USAGE ON SCHEMA private TO authenticated;