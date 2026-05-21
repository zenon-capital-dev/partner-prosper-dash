
-- ========= 1. WIPE OPERATIONAL DATA =========
-- Order matters: children first
TRUNCATE TABLE
  public.activities,
  public.activity_logs,
  public.audit_logs,
  public.automation_logs,
  public.chat_messages,
  public.client_document_requests,
  public.client_interactions,
  public.client_product_delays,
  public.client_product_pauses,
  public.client_product_quality_checks,
  public.client_product_status_reports,
  public.client_product_steps,
  public.client_subscriptions,
  public.client_timeline,
  public.collaborator_products,
  public.commission_splits,
  public.commissions,
  public.contract_history,
  public.contracts,
  public.daily_actions,
  public.demand_comments,
  public.demand_deliveries,
  public.document_history,
  public.document_requests,
  public.document_versions,
  public.documents,
  public.expenses,
  public.financial_alerts,
  public.lead_history,
  public.leads,
  public.notes,
  public.notifications,
  public.nps_responses,
  public.onboarding_documents,
  public.onboarding_history,
  public.partner_products,
  public.payments,
  public.proposal_items,
  public.proposals,
  public.provider_interactions,
  public.provider_schedule,
  public.service_assignments,
  public.service_provider_products,
  public.task_checklist_items,
  public.task_comments,
  public.tasks,
  public.client_products,
  public.sales,
  public.company_contacts,
  public.companies,
  public.clients,
  public.partners,
  public.referrers,
  public.service_providers,
  public.employees,
  public.projects
RESTART IDENTITY CASCADE;

-- ========= 2. REMOVE TEST USERS (keep only admin@admin.com) =========
DO $$
DECLARE
  v_admin_id uuid := 'dbebc38a-8691-4dc4-a644-869cac299c46';
BEGIN
  -- Remove user_roles, permissions, profiles for everyone else
  DELETE FROM public.user_permissions WHERE user_id <> v_admin_id;
  DELETE FROM public.user_roles WHERE user_id <> v_admin_id;
  DELETE FROM public.profiles WHERE id <> v_admin_id;

  -- Remove auth users (cascades to identities, sessions etc.)
  DELETE FROM auth.users WHERE id <> v_admin_id;

  -- Make sure admin profile is clean & active
  UPDATE public.profiles
  SET active = true, full_name = COALESCE(NULLIF(full_name,''),'Administrador')
  WHERE id = v_admin_id;

  -- Ensure admin role exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
