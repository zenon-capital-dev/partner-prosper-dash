-- Harden security definer views so caller RLS is used
ALTER VIEW IF EXISTS public.view_client_financial_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS public.view_performance_by_product SET (security_invoker = on);
ALTER VIEW IF EXISTS public.view_performance_by_source SET (security_invoker = on);

-- Fix mutable search_path on public functions flagged by the linter
CREATE OR REPLACE FUNCTION public.calculate_sla_due_date(start_date timestamp with time zone, days_to_add integer, day_type text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    target_date TIMESTAMP WITH TIME ZONE;
    added_days INTEGER := 0;
BEGIN
    target_date := start_date;
    IF day_type = 'calendar' THEN
        RETURN start_date + (days_to_add || ' days')::interval;
    END IF;
    WHILE added_days < days_to_add LOOP
        target_date := target_date + interval '1 day';
        IF EXTRACT(DOW FROM target_date) NOT IN (0, 6) THEN
            added_days := added_days + 1;
        END IF;
    END LOOP;
    RETURN target_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = _user_id
      AND user_roles.role::text IN ('admin', 'admin_secondary')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = _user_id
      AND (user_roles.role::text = _role OR user_roles.role::text IN ('admin', 'admin_secondary'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_demand_pause()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.resumed_at IS NULL THEN
        UPDATE public.client_products
        SET status = 'pausado', is_sla_frozen = NEW.freeze_sla
        WHERE id = NEW.client_product_id;
    ELSE
        UPDATE public.client_products
        SET status = 'em_execucao', is_sla_frozen = false
        WHERE id = NEW.client_product_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_role public.app_role;
BEGIN
    target_role := COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'cliente'::public.app_role);
    INSERT INTO public.profiles (id, full_name, email, active)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', ''), new.email, true);
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, target_role);
    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_sale_splits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_amount DECIMAL(12,2);
    v_referrer_amount DECIMAL(12,2);
    v_company_amount DECIMAL(12,2);
BEGIN
    v_partner_amount := (NEW.amount * COALESCE(NEW.commission_percent, 0)) / 100;
    v_referrer_amount := (NEW.amount * COALESCE(NEW.referrer_percent, 0)) / 100;
    v_company_amount := NEW.amount - v_partner_amount - v_referrer_amount;
    IF NEW.partner_id IS NOT NULL AND v_partner_amount > 0 THEN
        INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
        VALUES (NEW.id, 'partner', NEW.partner_id, v_partner_amount, NEW.commission_percent);
    END IF;
    IF NEW.referrer_id IS NOT NULL AND v_referrer_amount > 0 THEN
        INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
        VALUES (NEW.id, 'referrer', NEW.referrer_id, v_referrer_amount, NEW.referrer_percent);
    END IF;
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'company', NEW.id, v_company_amount, 100 - COALESCE(NEW.commission_percent, 0) - COALESCE(NEW.referrer_percent, 0));
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entity_id UUID;
    v_user_id UUID;
    v_ip_address TEXT;
BEGIN
    v_user_id := auth.uid();
    BEGIN
        v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
        IF v_ip_address IS NULL THEN
            v_ip_address := current_setting('request.headers', true)::json->>'x-real-ip';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;
    IF (TG_OP = 'DELETE') THEN entity_id := OLD.id; ELSE entity_id := NEW.id; END IF;
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
    VALUES (v_user_id, TG_OP, TG_TABLE_NAME, entity_id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
            v_ip_address);
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
    VALUES (v_user_id, TG_OP, TG_TABLE_NAME, entity_id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
            v_ip_address) ON CONFLICT DO NOTHING;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.populate_client_product_from_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    p_record RECORD;
    step_item JSONB;
    doc_item JSONB;
    task_item JSONB;
    v_pos INTEGER := 0;
BEGIN
    SELECT * INTO p_record FROM public.products WHERE id = NEW.product_id;
    IF p_record.id IS NOT NULL THEN
        NEW.status := COALESCE(NEW.status, p_record.initial_status, 'aguardando_inicio');
        IF p_record.standard_steps IS NOT NULL AND jsonb_array_length(p_record.standard_steps) > 0 THEN
            FOR step_item IN SELECT jsonb_array_elements(p_record.standard_steps) LOOP
                INSERT INTO public.client_product_steps (client_product_id, label, position, status)
                VALUES (NEW.id, step_item->>'label', v_pos, 'pending');
                v_pos := v_pos + 1;
            END LOOP;
        END IF;
        IF p_record.required_documents IS NOT NULL AND jsonb_array_length(p_record.required_documents) > 0 THEN
            FOR doc_item IN SELECT jsonb_array_elements(p_record.required_documents) LOOP
                INSERT INTO public.documents (client_id, client_product_id, name, status, category)
                VALUES (NEW.client_id, NEW.id, doc_item->>'name', 'solicitado', 'obrigatorio');
            END LOOP;
        END IF;
        IF p_record.auto_tasks_template IS NOT NULL AND jsonb_array_length(p_record.auto_tasks_template) > 0 THEN
            FOR task_item IN SELECT jsonb_array_elements(p_record.auto_tasks_template) LOOP
                INSERT INTO public.tasks (title, description, status, priority, related_type, related_id, user_id)
                VALUES (task_item->>'title', task_item->>'description', 'todo',
                        (task_item->>'priority')::public.demand_priority, 'client_product', NEW.id, auth.uid());
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_audit_ip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.ip_address IS NULL THEN
        BEGIN
            NEW.ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
            IF NEW.ip_address IS NULL THEN
                NEW.ip_address := current_setting('request.headers', true)::json->>'x-real-ip';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_client_product_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    p_days INTEGER;
    p_type TEXT;
BEGIN
    SELECT default_sla_days, sla_day_type INTO p_days, p_type
    FROM public.products WHERE id = NEW.product_id;
    IF p_days IS NOT NULL THEN
        NEW.sla_due_date := public.calculate_sla_due_date(NEW.sla_start_date, p_days, COALESCE(p_type, 'working'));
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Remove unsafe JWT-metadata role helper and broad policies before replacing them
DROP POLICY IF EXISTS "Admins and Collaborators can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and Collaborators can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.contracts;

DROP POLICY IF EXISTS "Admins and Collaborators can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admins and Collaborators can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

DROP POLICY IF EXISTS "Admins manage all demands" ON public.client_products;
DROP POLICY IF EXISTS "Admins can do everything with companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can do everything with company contacts" ON public.company_contacts;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.commission_splits;
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can manage service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Authenticated users can view service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Admin view all deliveries" ON public.demand_deliveries;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.client_product_steps;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.client_document_requests;
DROP POLICY IF EXISTS "Everyone can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "System inserts automation logs" ON public.automation_logs;

DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage contract files" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own contracts" ON storage.objects;

DROP FUNCTION IF EXISTS public.has_role(text[]);

-- Scoped replacement policies
CREATE POLICY "Internal team manages contracts"
ON public.contracts
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Internal team manages payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Clients view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()));

CREATE POLICY "Clients view own client document requests"
ON public.client_document_requests
FOR SELECT
TO authenticated
USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()));

CREATE POLICY "Clients update own client document requests"
ON public.client_document_requests
FOR UPDATE
TO authenticated
USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()));

CREATE POLICY "Internal team manages client document requests"
ON public.client_document_requests
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Providers view delegated client document requests"
ON public.client_document_requests
FOR SELECT
TO authenticated
USING (client_product_id IS NOT NULL AND public.is_delegated_provider(auth.uid(), client_product_id));

CREATE POLICY "Providers update delegated client document requests"
ON public.client_document_requests
FOR UPDATE
TO authenticated
USING (client_product_id IS NOT NULL AND public.is_delegated_provider(auth.uid(), client_product_id))
WITH CHECK (client_product_id IS NOT NULL AND public.is_delegated_provider(auth.uid(), client_product_id));

CREATE POLICY "Internal team manages companies"
ON public.companies
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Internal team manages company contacts"
ON public.company_contacts
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Internal team manages demand deliveries"
ON public.demand_deliveries
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Clients view own demand deliveries"
ON public.demand_deliveries
FOR SELECT
TO authenticated
USING (client_product_id IN (
  SELECT cp.id FROM public.client_products cp JOIN public.clients c ON c.id = cp.client_id WHERE c.user_id = auth.uid()
));

CREATE POLICY "Providers view delegated demand deliveries"
ON public.demand_deliveries
FOR SELECT
TO authenticated
USING (public.is_delegated_provider(auth.uid(), client_product_id));

CREATE POLICY "Providers insert delegated demand deliveries"
ON public.demand_deliveries
FOR INSERT
TO authenticated
WITH CHECK (public.is_delegated_provider(auth.uid(), client_product_id));

CREATE POLICY "Providers update delegated demand deliveries"
ON public.demand_deliveries
FOR UPDATE
TO authenticated
USING (public.is_delegated_provider(auth.uid(), client_product_id))
WITH CHECK (public.is_delegated_provider(auth.uid(), client_product_id));

CREATE POLICY "Internal team manages employees"
ON public.employees
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Employees view own employee record"
ON public.employees
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Internal team manages service providers"
ON public.service_providers
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Providers view own provider record"
ON public.service_providers
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR lower(email) = lower((auth.jwt() ->> 'email')));

CREATE POLICY "Internal team views system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Admins insert automation logs"
ON public.automation_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Internal team manages client product steps"
ON public.client_product_steps
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);

CREATE POLICY "Clients view visible own product steps"
ON public.client_product_steps
FOR SELECT
TO authenticated
USING (
  is_visible_to_client = true AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp JOIN public.clients c ON c.id = cp.client_id WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Providers manage delegated product steps"
ON public.client_product_steps
FOR ALL
TO authenticated
USING (client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE public.is_delegated_provider(auth.uid(), cp.id)))
WITH CHECK (client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE public.is_delegated_provider(auth.uid(), cp.id)));

-- Storage policies: keep bucket private and path/role scoped
CREATE POLICY "Internal team manages all contract files"
ON storage.objects
FOR ALL
TO authenticated
USING ((bucket_id = 'contracts') AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)))
WITH CHECK ((bucket_id = 'contracts') AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)));

CREATE POLICY "Clients read own contract folder"
ON storage.objects
FOR SELECT
TO authenticated
USING ((bucket_id = 'contracts') AND ((storage.foldername(name))[1] IN (SELECT c.id::text FROM public.clients c WHERE c.user_id = auth.uid())));

CREATE POLICY "Internal team uploads all documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK ((bucket_id = 'documents') AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) OR public.has_role(auth.uid(), 'colaborador'::public.app_role)));

-- Restrict direct execution of definer functions; grant only helpers used by RLS and safe authenticated actions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_overdue_documents() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_pending_commissions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_payments() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_delegated_provider(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_demand_activity(uuid, text, text, jsonb) TO authenticated;