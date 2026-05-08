-- Função auxiliar para habilitar RLS em massa se necessário
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(t.table_name) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- Função para verificar se o usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar políticas globais para admins (exemplo em tabelas críticas)
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        -- Tenta criar política de acesso total para admins
        EXECUTE 'DROP POLICY IF EXISTS "Admins total access" ON public.' || quote_ident(t.table_name);
        EXECUTE 'CREATE POLICY "Admins total access" ON public.' || quote_ident(t.table_name) || 
                ' FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    END LOOP;
END $$;
