-- 1. Primeiro, ajustar user_roles para evitar recursividade
-- A política "Admins manage all roles" usava private.is_admin(auth.uid())
-- que por sua vez consultava user_roles. RECURSIVIDADE.

DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;

-- Nova política para admins em user_roles sem usar funções que consultam a própria tabela
-- Usamos uma subconsulta direta ou verificamos se o usuário já tem a role admin no banco
-- Mas a forma mais segura de quebrar a recursividade em RLS de roles é usar uma política baseada em existencialismo simples
CREATE POLICY "Admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'admin_secondary')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'admin_secondary')
  )
);

-- 2. Corrigir as funções is_admin para garantir que funcionem corretamente
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  );
$function$;

-- 3. Limpar políticas duplicadas ou conflitantes em tabelas core que podem afetar o login
-- clients
DROP POLICY IF EXISTS "Admins total access" ON public.clients;
CREATE POLICY "Admins total access" ON public.clients FOR ALL TO authenticated USING (private.is_admin());

-- leads
DROP POLICY IF EXISTS "Admins total access" ON public.leads;
CREATE POLICY "Admins total access" ON public.leads FOR ALL TO authenticated USING (private.is_admin());

-- partners
DROP POLICY IF EXISTS "Admins total access" ON public.partners;
CREATE POLICY "Admins total access" ON public.partners FOR ALL TO authenticated USING (private.is_admin());

-- referrers
DROP POLICY IF EXISTS "Admins total access" ON public.referrers;
CREATE POLICY "Admins total access" ON public.referrers FOR ALL TO authenticated USING (private.is_admin());

-- service_providers
DROP POLICY IF EXISTS "Admins total access" ON public.service_providers;
CREATE POLICY "Admins total access" ON public.service_providers FOR ALL TO authenticated USING (private.is_admin());
