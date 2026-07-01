
CREATE TABLE public.client_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_product_id uuid REFERENCES public.client_products(id) ON DELETE SET NULL,
  subject text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'aberto',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid,
  created_by uuid,
  admin_notes text,
  closed_at timestamptz,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cst_client ON public.client_support_tickets(client_id);
CREATE INDEX ix_cst_status ON public.client_support_tickets(status);
CREATE INDEX ix_cst_assigned ON public.client_support_tickets(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_support_tickets TO authenticated;
GRANT ALL ON public.client_support_tickets TO service_role;
ALTER TABLE public.client_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cst_client_select" ON public.client_support_tickets FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "cst_client_insert" ON public.client_support_tickets FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "cst_admin_update" ON public.client_support_tickets FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "cst_admin_delete" ON public.client_support_tickets FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.client_support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.client_support_tickets(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_role text NOT NULL,
  body text,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cstm_ticket ON public.client_support_ticket_messages(ticket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_support_ticket_messages TO authenticated;
GRANT ALL ON public.client_support_ticket_messages TO service_role;
ALTER TABLE public.client_support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cstm_select" ON public.client_support_ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM public.client_support_tickets WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())) OR public.is_admin(auth.uid()));
CREATE POLICY "cstm_insert" ON public.client_support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (SELECT id FROM public.client_support_tickets WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())) OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_cst_last_message() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.client_support_tickets SET last_message_at = now(), updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cst_touch AFTER INSERT ON public.client_support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_cst_last_message();
