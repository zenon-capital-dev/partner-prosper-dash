CREATE TABLE public.partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  original_path text,
  original_uploaded_at timestamptz,
  signed_path text,
  signed_uploaded_at timestamptz,
  final_path text,
  final_uploaded_at timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_documents TO authenticated;
GRANT ALL ON public.partner_documents TO service_role;

ALTER TABLE public.partner_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partner_documents"
  ON public.partner_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners view their own documents"
  ON public.partner_documents FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.partners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners update signed slot of own documents"
  ON public.partner_documents FOR UPDATE TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

CREATE INDEX partner_documents_partner_idx ON public.partner_documents(partner_id, created_at DESC);

CREATE TRIGGER trg_partner_documents_updated
BEFORE UPDATE ON public.partner_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();