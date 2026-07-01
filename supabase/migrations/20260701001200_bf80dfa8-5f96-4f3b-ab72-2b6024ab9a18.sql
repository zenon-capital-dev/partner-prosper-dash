
DO $$
DECLARE
  r record;
  fks text[][] := ARRAY[
    -- table, column, ref_table, ref_col, on_delete
    ['client_products','client_id','clients','id','CASCADE'],
    ['client_products','product_id','products','id','SET NULL'],
    ['client_products','sale_id','sales','id','SET NULL'],
    ['client_products','service_provider_id','service_providers','id','SET NULL'],
    ['client_products','company_id','companies','id','SET NULL'],
    ['client_products','current_step_id','product_steps','id','SET NULL'],
    ['commissions','client_id','clients','id','SET NULL'],
    ['commissions','product_id','products','id','SET NULL'],
    ['commissions','sale_id','sales','id','CASCADE'],
    ['commissions','partner_id','partners','id','SET NULL'],
    ['commissions','collaborator_id','employees','id','SET NULL'],
    ['commissions','referrer_id','referrers','id','SET NULL'],
    ['commissions','client_product_id','client_products','id','SET NULL'],
    ['commissions','applied_rule_id','commission_rules','id','SET NULL'],
    ['commission_splits','sale_id','sales','id','CASCADE'],
    ['contracts','client_id','clients','id','CASCADE'],
    ['contracts','client_product_id','client_products','id','SET NULL'],
    ['contracts','partner_id','partners','id','SET NULL'],
    ['contracts','product_id','products','id','SET NULL'],
    ['contracts','provider_id','service_providers','id','SET NULL'],
    ['contracts','sale_id','sales','id','SET NULL'],
    ['contract_history','contract_id','contracts','id','CASCADE'],
    ['demand_comments','client_product_id','client_products','id','CASCADE'],
    ['demand_deliveries','client_product_id','client_products','id','CASCADE'],
    ['demand_deliveries','collaborator_id','employees','id','SET NULL'],
    ['demand_deliveries','provider_id','service_providers','id','SET NULL'],
    ['demand_requests','client_id','clients','id','CASCADE'],
    ['demand_requests','client_product_id','client_products','id','CASCADE'],
    ['client_document_requests','client_id','clients','id','CASCADE'],
    ['client_document_requests','client_product_id','client_products','id','CASCADE'],
    ['client_interactions','client_id','clients','id','CASCADE'],
    ['client_timeline','client_id','clients','id','CASCADE'],
    ['client_subscriptions','client_id','clients','id','CASCADE'],
    ['client_subscriptions','product_id','products','id','SET NULL'],
    ['companies','client_id','clients','id','CASCADE'],
    ['company_contacts','company_id','companies','id','CASCADE'],
    ['collaborator_products','collaborator_id','employees','id','CASCADE'],
    ['collaborator_products','product_id','products','id','CASCADE'],
    ['commission_rules','partner_id','partners','id','CASCADE'],
    ['commission_rules','product_id','products','id','CASCADE'],
    ['client_partners','client_id','clients','id','CASCADE'],
    ['client_partners','partner_id','partners','id','CASCADE'],
    ['client_referrers','client_id','clients','id','CASCADE'],
    ['client_referrers','referrer_id','referrers','id','CASCADE'],
    ['client_collaborators','client_id','clients','id','CASCADE'],
    ['client_collaborators','collaborator_id','employees','id','CASCADE'],
    ['client_providers','client_id','clients','id','CASCADE'],
    ['client_providers','service_provider_id','service_providers','id','CASCADE'],
    ['client_product_delays','client_product_id','client_products','id','CASCADE'],
    ['client_product_pauses','client_product_id','client_products','id','CASCADE'],
    ['client_product_providers','client_product_id','client_products','id','CASCADE'],
    ['client_product_providers','service_provider_id','service_providers','id','CASCADE'],
    ['client_product_quality_checks','client_product_id','client_products','id','CASCADE'],
    ['client_product_status_reports','client_product_id','client_products','id','CASCADE'],
    ['client_product_status_reports','service_provider_id','service_providers','id','SET NULL'],
    ['client_product_steps','client_product_id','client_products','id','CASCADE'],
    ['clients','partner_id','partners','id','SET NULL'],
    ['clients','collaborator_id','employees','id','SET NULL'],
    ['clients','responsible_id','employees','id','SET NULL'],
    ['clients','referrer_id','referrers','id','SET NULL'],
    ['clients','indicator_id','referrers','id','SET NULL'],
    ['clients','service_provider_id','service_providers','id','SET NULL'],
    ['clients','provider_id','service_providers','id','SET NULL'],
    ['clients','journey_stage_id','client_journey_stages','id','SET NULL'],
    ['automation_logs','rule_id','automation_rules','id','CASCADE']
  ];
  cname text;
  parent_exists boolean;
BEGIN
  FOR i IN 1..array_length(fks,1) LOOP
    cname := 'fk_' || fks[i][1] || '_' || fks[i][2];
    -- skip if parent table missing
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=''public'' AND table_name=%L)', fks[i][3]) INTO parent_exists;
    IF NOT parent_exists THEN CONTINUE; END IF;
    -- skip if constraint already exists on this column
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=fks[i][1] AND kcu.column_name=fks[i][2] AND tc.constraint_type='FOREIGN KEY'
    ) THEN CONTINUE; END IF;

    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s NOT VALID',
        fks[i][1], cname, fks[i][2], fks[i][3], fks[i][4], fks[i][5]
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)',
        'idx_'||fks[i][1]||'_'||fks[i][2], fks[i][1], fks[i][2]);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped FK %.%: %', fks[i][1], fks[i][2], SQLERRM;
    END;
  END LOOP;
END $$;
