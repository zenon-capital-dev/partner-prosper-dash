
-- 1. Trigger: client_products herda responsible_employee_id do cliente
CREATE OR REPLACE FUNCTION public.fill_client_product_responsible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsible_employee_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT collaborator_id INTO NEW.responsible_employee_id
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_client_product_responsible ON public.client_products;
CREATE TRIGGER trg_fill_client_product_responsible
BEFORE INSERT ON public.client_products
FOR EACH ROW
EXECUTE FUNCTION public.fill_client_product_responsible();

-- 2. Trigger: ao trocar o colaborador do cliente, propaga para demandas
CREATE OR REPLACE FUNCTION public.propagate_client_collaborator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.collaborator_id IS DISTINCT FROM OLD.collaborator_id THEN
    UPDATE public.client_products
    SET responsible_employee_id = NEW.collaborator_id
    WHERE client_id = NEW.id
      AND (
        responsible_employee_id IS NULL
        OR responsible_employee_id = OLD.collaborator_id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_client_collaborator ON public.clients;
CREATE TRIGGER trg_propagate_client_collaborator
AFTER UPDATE OF collaborator_id ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.propagate_client_collaborator();

-- 3. Trigger: tarefa herda assigned_to da demanda quando não vier preenchido
CREATE OR REPLACE FUNCTION public.fill_task_assigned_from_demand()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_fill_task_assigned_from_demand ON public.tasks;
CREATE TRIGGER trg_fill_task_assigned_from_demand
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fill_task_assigned_from_demand();

-- 4. Backfill: alinhar dados existentes
UPDATE public.client_products cp
SET responsible_employee_id = c.collaborator_id
FROM public.clients c
WHERE cp.client_id = c.id
  AND cp.responsible_employee_id IS NULL
  AND c.collaborator_id IS NOT NULL;

UPDATE public.tasks t
SET assigned_to = cp.responsible_employee_id
FROM public.client_products cp
WHERE t.client_product_id = cp.id
  AND t.assigned_to IS NULL
  AND cp.responsible_employee_id IS NOT NULL;

-- 5. Política: colaborador também enxerga clientes onde é responsible_id direto
DROP POLICY IF EXISTS "Colaboradores view clients by responsible" ON public.clients;
CREATE POLICY "Colaboradores view clients by responsible"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'colaborador'::app_role)
  AND (collaborator_id = auth.uid() OR responsible_id = auth.uid())
);

-- 6. Política: colaborador enxerga leads atribuídos a ele
DROP POLICY IF EXISTS "Colaboradores view assigned leads" ON public.leads;
CREATE POLICY "Colaboradores view assigned leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'colaborador'::app_role)
  AND responsible_id = auth.uid()
);
