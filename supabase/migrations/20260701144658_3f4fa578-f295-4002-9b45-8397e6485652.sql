DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT DISTINCT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_trigger t ON t.tgfoid = p.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;