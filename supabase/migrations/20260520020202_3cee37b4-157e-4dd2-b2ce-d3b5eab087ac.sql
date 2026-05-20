
-- 1) Payments: colunas de beneficiários
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES public.referrers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collaborator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_partner ON public.payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_payments_referrer ON public.payments(referrer_id);
CREATE INDEX IF NOT EXISTS idx_payments_collaborator ON public.payments(collaborator_id);

-- 2) Atualiza handle_new_sale para preencher os IDs no payment
CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent,0) > 0 THEN
        INSERT INTO public.commissions (
            partner_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes
        )
        VALUES (
            NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.commission_percent) / 100, 2),
            NEW.commission_percent, NEW.amount,
            'pendente', 'aguardando_confirmacao',
            'Gerada automaticamente via venda ' || NEW.id
        );
    END IF;

    IF NEW.status::text <> 'cancelada' THEN
        INSERT INTO public.payments (
            client_id, sale_id, amount, status, due_date, description,
            partner_id, referrer_id, collaborator_id
        )
        VALUES (
            NEW.client_id, NEW.id, NEW.amount, 'pendente',
            COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '3 days'),
            'Fatura gerada via venda: ' || NEW.id,
            NEW.partner_id, NEW.referrer_id, NEW.collaborator_id
        );
    END IF;

    INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, metadata)
    VALUES ('CREATE_SALE', 'sales', NEW.id, NEW.created_by,
            jsonb_build_object('amount', NEW.amount, 'client_id', NEW.client_id));

    UPDATE public.clients SET status = 'ativo'
    WHERE id = NEW.client_id AND status = 'prospecto';

    RETURN NEW;
END;
$function$;

-- payments.description column check — if doesn't exist, fallback to notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='description'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN description text;
  END IF;
END$$;

-- 3) Propagate: cobrir NULL→valor (responsável/prestador novo onde antes não havia)
CREATE OR REPLACE FUNCTION public.propagate_client_collaborator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.collaborator_id IS DISTINCT FROM OLD.collaborator_id THEN
    UPDATE public.client_products
    SET responsible_employee_id = NEW.collaborator_id
    WHERE client_id = NEW.id
      AND (
        responsible_employee_id IS NULL
        OR responsible_employee_id IS NOT DISTINCT FROM OLD.collaborator_id
      );
  END IF;
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
    SET service_provider_id = NEW.service_provider_id
    WHERE client_id = NEW.id
      AND (
        service_provider_id IS NULL
        OR service_provider_id IS NOT DISTINCT FROM OLD.service_provider_id
      );
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) Tasks: policy de INSERT para colaborador em demanda atribuída
DROP POLICY IF EXISTS "Collaborators create tasks in assigned demands" ON public.tasks;
CREATE POLICY "Collaborators create tasks in assigned demands"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'colaborador'::app_role)
    AND (
      assigned_to = auth.uid()
      OR (client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), client_product_id))
    )
  );

-- 5) View unificada de comissões (parceiro + indicador + colaborador)
CREATE OR REPLACE VIEW public.v_commissions_unified
WITH (security_invoker=on) AS
SELECT
  cs.id,
  cs.sale_id,
  cs.beneficiary_type::text AS beneficiary_type,
  cs.beneficiary_id,
  CASE cs.beneficiary_type::text
    WHEN 'partner'      THEN p.full_name
    WHEN 'referrer'     THEN r.full_name
    WHEN 'collaborator' THEN pr.full_name
  END AS beneficiary_name,
  cs.amount,
  cs.percent,
  cs.status::text AS status,
  cs.paid_at,
  cs.created_at,
  s.amount AS sale_amount,
  s.sale_date,
  cl.full_name AS client_name,
  pd.name AS product_name
FROM public.commission_splits cs
LEFT JOIN public.sales s ON s.id = cs.sale_id
LEFT JOIN public.clients cl ON cl.id = s.client_id
LEFT JOIN public.products pd ON pd.id = s.product_id
LEFT JOIN public.partners p ON cs.beneficiary_type::text = 'partner' AND p.id = cs.beneficiary_id
LEFT JOIN public.referrers r ON cs.beneficiary_type::text = 'referrer' AND r.id = cs.beneficiary_id
LEFT JOIN public.profiles pr ON cs.beneficiary_type::text = 'collaborator' AND pr.id = cs.beneficiary_id;
