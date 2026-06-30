
-- 1) Support tickets
CREATE TABLE IF NOT EXISTS public.partner_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid,
  subject text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberto',
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_support_tickets TO authenticated;
GRANT ALL ON public.partner_support_tickets TO service_role;

ALTER TABLE public.partner_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all support tickets"
  ON public.partner_support_tickets FOR ALL
  USING (private.is_admin((SELECT auth.uid())))
  WITH CHECK (private.is_admin((SELECT auth.uid())));

CREATE POLICY "Partners view own support tickets"
  ON public.partner_support_tickets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_support_tickets.partner_id
      AND (p.user_id = (SELECT auth.uid())
        OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  ));

CREATE POLICY "Partners create own support tickets"
  ON public.partner_support_tickets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_support_tickets.partner_id
      AND (p.user_id = (SELECT auth.uid())
        OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  ));

CREATE TRIGGER trg_partner_tickets_updated
  BEFORE UPDATE ON public.partner_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify admins when a partner opens a ticket
CREATE OR REPLACE FUNCTION public.notify_on_partner_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.partners WHERE id = NEW.partner_id;
  PERFORM public.notify_admins(
    'Novo chamado de parceiro',
    COALESCE(v_name,'Parceiro') || ' · ' || COALESCE(NEW.subject,'—'),
    '/admin/parceiros/suporte',
    'support'
  );
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_partner_ticket() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_partner_ticket_notify
  AFTER INSERT ON public.partner_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_partner_ticket();

-- 2) Admin contract template paths
ALTER TABLE public.partner_contracts
  ADD COLUMN IF NOT EXISTS contract_template_path text,
  ADD COLUMN IF NOT EXISTS contract_template_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS nda_template_path text,
  ADD COLUMN IF NOT EXISTS nda_template_uploaded_at timestamptz;

-- 3) Allow partner to upload signed versions; keep template/admin fields locked
CREATE OR REPLACE FUNCTION public.prevent_partner_contract_admin_field_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) THEN
    RETURN NEW;
  END IF;
  -- Block partner from changing admin-managed fields
  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.contract_template_path IS DISTINCT FROM OLD.contract_template_path
     OR NEW.contract_template_uploaded_at IS DISTINCT FROM OLD.contract_template_uploaded_at
     OR NEW.nda_template_path IS DISTINCT FROM OLD.nda_template_path
     OR NEW.nda_template_uploaded_at IS DISTINCT FROM OLD.nda_template_uploaded_at
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    RAISE EXCEPTION 'Não é permitido alterar campos administrativos do contrato';
  END IF;
  -- Partner CAN upload signed files (contract_signed_path / nda_signed_path)
  RETURN NEW;
END;
$function$;
