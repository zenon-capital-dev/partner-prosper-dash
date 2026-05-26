-- Grant permissions for all existing tables in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') LOOP
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.table_name) || ' TO authenticated';
        EXECUTE 'GRANT ALL ON public.' || quote_ident(r.table_name) || ' TO service_role';
        -- For tables that might need public access (e.g., profiles, products for view only)
        -- We will be conservative and only grant to authenticated by default.
    END LOOP;
END $$;

-- Specifically for profiles and products which are often viewable by anyone
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.user_roles TO anon;
