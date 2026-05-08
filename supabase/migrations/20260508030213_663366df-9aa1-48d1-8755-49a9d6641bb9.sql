-- Revogar execução pública para todas as funções (boa prática geral)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Para as funções existentes, revogamos explicitamente da função anônima
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || quote_ident(func_record.schema) || '.' || quote_ident(func_record.name) || '(' || func_record.args || ') FROM PUBLIC';
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || quote_ident(func_record.schema) || '.' || quote_ident(func_record.name) || '(' || func_record.args || ') TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || quote_ident(func_record.schema) || '.' || quote_ident(func_record.name) || '(' || func_record.args || ') TO service_role';
    END LOOP;
END $$;
