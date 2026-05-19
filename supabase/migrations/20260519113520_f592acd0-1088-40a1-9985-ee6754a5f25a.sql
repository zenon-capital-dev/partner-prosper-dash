-- 1) Preenche service_provider_id na demanda a partir do cliente (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.fill_client_product_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_provider_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT service_provider_id INTO NEW.service_provider_id
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_client_product_provider ON public.client_products;
CREATE TRIGGER trg_fill_client_product_provider
BEFORE INSERT ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.fill_client_product_provider();

-- 2) Propaga troca de prestador padrão do cliente para demandas existentes
CREATE OR REPLACE FUNCTION public.propagate_client_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_provider_id IS DISTINCT FROM OLD.service_provider_id THEN
    UPDATE public.client_products
    SET service_provider_id = NEW.service_provider_id
    WHERE client_id = NEW.id
      AND (
        service_provider_id IS NULL
        OR service_provider_id = OLD.service_provider_id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_client_provider ON public.clients;
CREATE TRIGGER trg_propagate_client_provider
AFTER UPDATE OF service_provider_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.propagate_client_provider();

-- 3) Garante que o trigger equivalente para colaborador esteja ativo (idempotente)
DROP TRIGGER IF EXISTS trg_fill_client_product_responsible ON public.client_products;
CREATE TRIGGER trg_fill_client_product_responsible
BEFORE INSERT ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.fill_client_product_responsible();

DROP TRIGGER IF EXISTS trg_propagate_client_collaborator ON public.clients;
CREATE TRIGGER trg_propagate_client_collaborator
AFTER UPDATE OF collaborator_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.propagate_client_collaborator();

-- 4) Tarefa: preenche assigned_to a partir do responsável da demanda/cliente
DROP TRIGGER IF EXISTS trg_fill_task_assigned_from_demand ON public.tasks;
CREATE TRIGGER trg_fill_task_assigned_from_demand
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.fill_task_assigned_from_demand();