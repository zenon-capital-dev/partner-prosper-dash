DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_dashboard_snapshot'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'admin_dashboard_snapshot não encontrada';
  END IF;

  v_def := replace(v_def, '''todayContractsList'', doc_list.data', '''todayContractsList'', contract_list.data');
  EXECUTE v_def;
END $$;