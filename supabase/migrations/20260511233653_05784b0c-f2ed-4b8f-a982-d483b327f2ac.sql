-- Security hardening for roles, lead history, helper functions, and invoker views

-- 1) Private helper schema for RLS-only authorization helpers.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_admin(auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.check_is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION private.check_user_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role::text = _role OR role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role))
  )
$$;

CREATE OR REPLACE FUNCTION private.is_delegated_provider(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    LEFT JOIN auth.users u ON u.id = _user_id
    WHERE cp.id = _client_product_id
      AND (
        sp.user_id = _user_id
        OR (sp.email IS NOT NULL AND u.email IS NOT NULL AND lower(sp.email) = lower(u.email))
      )
  )
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO anon, authenticated;

-- 2) Rewrite existing public/storage policies to call private helpers instead of API-exposed helpers.
DO $$
DECLARE
  pol record;
  roles_sql text;
  cmd_sql text;
  qual_sql text;
  check_sql text;
  create_sql text;
BEGIN
  FOR pol IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      p.polpermissive,
      p.polcmd,
      p.polroles,
      pg_get_expr(p.polqual, p.polrelid) AS qual_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'storage')
      AND (
        pg_get_expr(p.polqual, p.polrelid) ~ '(^|[^[:alnum:]_.])(is_admin|has_role|check_is_admin|check_user_role|is_delegated_provider)\('
        OR pg_get_expr(p.polwithcheck, p.polrelid) ~ '(^|[^[:alnum:]_.])(is_admin|has_role|check_is_admin|check_user_role|is_delegated_provider)\('
      )
  LOOP
    SELECT string_agg(CASE WHEN r = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(r)) END, ', ')
    INTO roles_sql
    FROM unnest(pol.polroles) AS r;

    cmd_sql := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;

    qual_sql := pol.qual_expr;
    check_sql := pol.check_expr;

    IF qual_sql IS NOT NULL THEN
      qual_sql := regexp_replace(qual_sql, '(^|[^[:alnum:]_.])is_admin\(', '\1private.is_admin(', 'g');
      qual_sql := regexp_replace(qual_sql, '(^|[^[:alnum:]_.])has_role\(', '\1private.has_role(', 'g');
      qual_sql := regexp_replace(qual_sql, '(^|[^[:alnum:]_.])check_is_admin\(', '\1private.check_is_admin(', 'g');
      qual_sql := regexp_replace(qual_sql, '(^|[^[:alnum:]_.])check_user_role\(', '\1private.check_user_role(', 'g');
      qual_sql := regexp_replace(qual_sql, '(^|[^[:alnum:]_.])is_delegated_provider\(', '\1private.is_delegated_provider(', 'g');
    END IF;

    IF check_sql IS NOT NULL THEN
      check_sql := regexp_replace(check_sql, '(^|[^[:alnum:]_.])is_admin\(', '\1private.is_admin(', 'g');
      check_sql := regexp_replace(check_sql, '(^|[^[:alnum:]_.])has_role\(', '\1private.has_role(', 'g');
      check_sql := regexp_replace(check_sql, '(^|[^[:alnum:]_.])check_is_admin\(', '\1private.check_is_admin(', 'g');
      check_sql := regexp_replace(check_sql, '(^|[^[:alnum:]_.])check_user_role\(', '\1private.check_user_role(', 'g');
      check_sql := regexp_replace(check_sql, '(^|[^[:alnum:]_.])is_delegated_provider\(', '\1private.is_delegated_provider(', 'g');
    END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_sql,
      COALESCE(roles_sql, 'PUBLIC')
    );

    IF qual_sql IS NOT NULL AND cmd_sql <> 'INSERT' THEN
      create_sql := create_sql || ' USING (' || qual_sql || ')';
    END IF;

    IF check_sql IS NOT NULL AND cmd_sql <> 'SELECT' AND cmd_sql <> 'DELETE' THEN
      create_sql := create_sql || ' WITH CHECK (' || check_sql || ')';
    END IF;

    EXECUTE create_sql;
  END LOOP;
END $$;

-- 3) Prevent role escalation through auth metadata during signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  target_role public.app_role := 'cliente'::public.app_role;
BEGIN
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'cliente'));

  -- Self-service signup may only create public account types.
  -- Admin, internal, provider, and seller roles must be assigned by an existing admin through user_roles.
  IF requested_role IN ('cliente', 'parceiro') THEN
    target_role := requested_role::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, active)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, true)
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    active = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$;

-- 4) Lock down lead history; remove broad authenticated read/write.
DROP POLICY IF EXISTS "Leads history visible to authenticated users" ON public.lead_history;
DROP POLICY IF EXISTS "Leads history insertable by authenticated users" ON public.lead_history;
DROP POLICY IF EXISTS "Internal team reads lead history" ON public.lead_history;
DROP POLICY IF EXISTS "Internal team writes lead history" ON public.lead_history;

CREATE POLICY "Internal team reads lead history"
ON public.lead_history
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Internal team writes lead history"
ON public.lead_history
FOR INSERT
TO authenticated
WITH CHECK (
  (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
  )
  AND (created_by IS NULL OR created_by = auth.uid())
);

-- 5) Make demand activity logging invoker-safe and scoped by RLS-visible demand access.
DROP POLICY IF EXISTS "Authorized users insert demand activity logs" ON public.activity_logs;

CREATE POLICY "Authorized users insert demand activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND entity_type = 'client_product'
  AND entity_id IN (SELECT id FROM public.client_products)
);

CREATE OR REPLACE FUNCTION public.log_demand_activity(
  _client_product_id uuid,
  _action text,
  _description text DEFAULT NULL::text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES (
    _action,
    'client_product',
    _client_product_id,
    auth.uid(),
    jsonb_build_object('description', _description, 'metadata', coalesce(_metadata, '{}'::jsonb))
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_demand_activity(uuid, text, text, jsonb) TO authenticated;

-- 6) Remove direct API execution from public SECURITY DEFINER authorization helpers.
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_delegated_provider(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 7) Keep existing reporting views bound to caller permissions.
ALTER VIEW IF EXISTS public.view_client_financial_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.view_performance_by_product SET (security_invoker = true);
ALTER VIEW IF EXISTS public.view_performance_by_source SET (security_invoker = true);