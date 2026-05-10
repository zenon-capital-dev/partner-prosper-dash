
-- Proposals module
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_email text,
  recipient_company text,
  recipient_document text,
  payment_terms text,
  notes text,
  internal_notes text,
  discount numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  valid_until date,
  status text NOT NULL DEFAULT 'rascunho',
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  converted_at timestamptz,
  converted_sale_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON public.proposals(lead_id);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/vendedor manage proposals" ON public.proposals
FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Client view own proposals" ON public.proposals
FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Admin/vendedor manage proposal items" ON public.proposal_items
FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Client view own proposal items" ON public.proposal_items
FOR SELECT USING (proposal_id IN (
  SELECT p.id FROM proposals p JOIN clients c ON c.id = p.client_id WHERE c.user_id = auth.uid()
));

CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
