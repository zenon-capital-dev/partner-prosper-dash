-- Performance: wrap auth.uid() / auth.jwt() em (SELECT ...) para virar InitPlan
-- nas tabelas com mais tráfego. Sem mudança de regra de acesso.

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  cmd_clause text;
  using_clause text;
  check_clause text;
  roles_clause text;
  hot_tables text[] := ARRAY[
    'tasks','clients','client_products','documents','payments','sales',
    'notifications','audit_logs','demand_comments','client_product_steps',
    'client_product_status_reports','client_timeline','activity_logs',
    'contracts','commissions','commission_splits','company_contacts',
    'companies','partners','referrers','service_providers','user_roles',
    'employees','message_templates','tasks','task_comments','task_checklist_items',
    'demand_deliveries','client_partners','client_providers','client_referrers',
    'client_collaborators','client_product_providers','client_product_pauses',
    'client_product_delays','client_product_quality_checks','demand_requests',
    'demand_shares','onboarding_documents','onboarding_history','document_requests',
    'client_document_requests','document_versions','document_history',
    'notes','nps_responses','financial_alerts','expenses','partner_contracts',
    'partner_materials','partner_products','resource_pools','resource_pool_movements',
    'sales_goals','leads','lead_history'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(hot_tables)
  LOOP
    -- Só reescreve quando há chamada "nua" a auth.uid() / auth.jwt()
    -- (sem o SELECT na frente) — evita trabalho desnecessário.
    IF (r.qual IS NULL OR (r.qual !~ '\mauth\.(uid|jwt|role)\s*\(' ))
       AND (r.with_check IS NULL OR (r.with_check !~ '\mauth\.(uid|jwt|role)\s*\(' )) THEN
      CONTINUE;
    END IF;

    new_qual := r.qual;
    new_check := r.with_check;

    -- Envolve auth.uid() em (SELECT auth.uid()) quando ainda não está envolvido.
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '(?<!\(\s*SELECT\s)auth\.uid\(\)', '(SELECT auth.uid())', 'gi');
      new_qual := regexp_replace(new_qual, '(?<!\(\s*SELECT\s)auth\.jwt\(\)', '(SELECT auth.jwt())', 'gi');
      new_qual := regexp_replace(new_qual, '(?<!\(\s*SELECT\s)auth\.role\(\)', '(SELECT auth.role())', 'gi');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '(?<!\(\s*SELECT\s)auth\.uid\(\)', '(SELECT auth.uid())', 'gi');
      new_check := regexp_replace(new_check, '(?<!\(\s*SELECT\s)auth\.jwt\(\)', '(SELECT auth.jwt())', 'gi');
      new_check := regexp_replace(new_check, '(?<!\(\s*SELECT\s)auth\.role\(\)', '(SELECT auth.role())', 'gi');
    END IF;

    -- Monta CREATE POLICY equivalente, preservando cmd, permissive, roles
    cmd_clause := CASE r.cmd
      WHEN 'ALL' THEN 'ALL'
      WHEN 'SELECT' THEN 'SELECT'
      WHEN 'INSERT' THEN 'INSERT'
      WHEN 'UPDATE' THEN 'UPDATE'
      WHEN 'DELETE' THEN 'DELETE'
      ELSE r.cmd
    END;

    using_clause := CASE WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual) ELSE '' END;
    check_clause := CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

    roles_clause := COALESCE(
      (SELECT string_agg(quote_ident(unnest), ', ') FROM unnest(r.roles)),
      'public'
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname,
      r.schemaname,
      r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_clause,
      roles_clause,
      using_clause,
      check_clause
    );
  END LOOP;
END $$;