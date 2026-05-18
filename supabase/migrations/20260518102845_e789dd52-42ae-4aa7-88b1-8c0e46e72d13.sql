-- 1. Atualiza seed para copiar due_date a partir do default_due_offset_days
CREATE OR REPLACE FUNCTION public.seed_client_product_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.client_product_steps WHERE client_product_id = NEW.id) THEN
      INSERT INTO public.client_product_steps (
        client_product_id, label, description, position,
        is_visible_to_client, default_responsible, due_date
      )
      SELECT
        NEW.id,
        ps.name,
        ps.description,
        COALESCE(ps.step_order, 0),
        ps.is_visible_to_client,
        ps.default_responsible,
        CASE
          WHEN ps.default_due_offset_days IS NOT NULL
          THEN (COALESCE(NEW.sla_start_date, now()) + (ps.default_due_offset_days || ' days')::interval)
          ELSE NULL
        END
      FROM public.product_steps ps
      WHERE ps.product_id = NEW.product_id
      ORDER BY ps.step_order;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Trigger: log + auto-avanço no checklist
CREATE OR REPLACE FUNCTION public.handle_checklist_step_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next_step uuid;
  v_total int;
  v_done int;
  v_demand_status text;
BEGIN
  -- Só atua quando status realmente muda
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.status::text, '') = COALESCE(OLD.status::text, '') THEN
    RETURN NEW;
  END IF;

  -- Log no histórico da demanda
  INSERT INTO public.activity_logs (entity_type, entity_id, action, user_id, new_data, old_data)
  VALUES (
    'client_product',
    NEW.client_product_id,
    'step_status_changed',
    auth.uid(),
    jsonb_build_object('step_id', NEW.id, 'label', NEW.label, 'status', NEW.status),
    CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('step_id', OLD.id, 'label', OLD.label, 'status', OLD.status)
      ELSE NULL
    END
  );

  -- Se concluiu, avança current_step_id e checa fechamento da demanda
  IF NEW.status::text = 'concluido' THEN
    SELECT id INTO v_next_step
    FROM public.client_product_steps
    WHERE client_product_id = NEW.client_product_id
      AND status::text <> 'concluido'
      AND status::text <> 'cancelado'
      AND id <> NEW.id
    ORDER BY position ASC
    LIMIT 1;

    SELECT status INTO v_demand_status FROM public.client_products WHERE id = NEW.client_product_id;

    IF v_next_step IS NOT NULL THEN
      UPDATE public.client_products
      SET current_step_id = v_next_step
      WHERE id = NEW.client_product_id
        AND (current_step_id IS DISTINCT FROM v_next_step);
    ELSE
      -- Todos concluídos: fecha a demanda se ainda estiver ativa
      SELECT count(*) FILTER (WHERE status::text = 'concluido'),
             count(*) FILTER (WHERE status::text <> 'cancelado')
        INTO v_done, v_total
      FROM public.client_product_steps
      WHERE client_product_id = NEW.client_product_id;

      IF v_total > 0 AND v_done = v_total
         AND v_demand_status NOT IN ('concluida', 'cancelada', 'pausada') THEN
        UPDATE public.client_products
        SET status = 'concluida',
            current_step_id = NULL,
            end_date = CURRENT_DATE
        WHERE id = NEW.client_product_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_checklist_step_change ON public.client_product_steps;
CREATE TRIGGER trg_checklist_step_change
AFTER INSERT OR UPDATE OF status ON public.client_product_steps
FOR EACH ROW
EXECUTE FUNCTION public.handle_checklist_step_change();