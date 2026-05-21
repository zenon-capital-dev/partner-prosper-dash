CREATE OR REPLACE FUNCTION public.sync_sale_to_client_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_target_status text;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_target_status := CASE
    WHEN NEW.status::text = 'cancelada' THEN 'cancelado'
    ELSE 'em_andamento'
  END;

  SELECT id INTO v_existing_id
  FROM public.client_products
  WHERE sale_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    SELECT cp.id INTO v_existing_id
    FROM public.client_products cp
    WHERE cp.client_id = NEW.client_id
      AND cp.product_id = NEW.product_id
      AND cp.sale_id IS NULL
      AND cp.created_at >= now() - interval '15 minutes'
    ORDER BY cp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.client_products
    SET sale_id = COALESCE(sale_id, NEW.id),
        status = CASE WHEN TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN v_target_status ELSE status END,
        value = COALESCE(value, NEW.amount),
        updated_at = now()
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'cancelada' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_products (
    client_id, product_id, sale_id, status, value, start_date
  )
  VALUES (
    NEW.client_id, NEW.product_id, NEW.id, v_target_status,
    NEW.amount, COALESCE(NEW.sale_date, CURRENT_DATE)
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.propagate_client_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.service_provider_id IS DISTINCT FROM OLD.service_provider_id THEN
    UPDATE public.client_products
    SET service_provider_id = NEW.service_provider_id,
        updated_at = now()
    WHERE client_id = NEW.id
      AND status NOT IN ('concluido', 'concluida', 'cancelado', 'cancelada')
      AND (
        service_provider_id IS NULL
        OR service_provider_id IS NOT DISTINCT FROM OLD.service_provider_id
      );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.propagate_client_collaborator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.collaborator_id IS DISTINCT FROM OLD.collaborator_id THEN
    UPDATE public.client_products
    SET responsible_employee_id = NEW.collaborator_id,
        updated_at = now()
    WHERE client_id = NEW.id
      AND status NOT IN ('concluido', 'concluida', 'cancelado', 'cancelada')
      AND (
        responsible_employee_id IS NULL
        OR responsible_employee_id IS NOT DISTINCT FROM OLD.collaborator_id
      );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fill_task_assigned_from_demand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    IF NEW.client_product_id IS NOT NULL THEN
      SELECT responsible_employee_id INTO NEW.assigned_to
      FROM public.client_products
      WHERE id = NEW.client_product_id;
    END IF;
    IF NEW.assigned_to IS NULL AND NEW.client_id IS NOT NULL THEN
      SELECT collaborator_id INTO NEW.assigned_to
      FROM public.clients
      WHERE id = NEW.client_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fill_task_assigned_from_demand ON public.tasks;
CREATE TRIGGER trg_fill_task_assigned_from_demand
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.fill_task_assigned_from_demand();

DROP POLICY IF EXISTS "Partners view own commissions" ON public.commissions;
CREATE POLICY "Partners view own commissions"
ON public.commissions
FOR SELECT
TO authenticated
USING (
  partner_id IN (
    SELECT p.id
    FROM public.partners p
    WHERE p.user_id = auth.uid()
       OR lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_products_client_product_sale_null
ON public.client_products (client_id, product_id, created_at DESC)
WHERE sale_id IS NULL;