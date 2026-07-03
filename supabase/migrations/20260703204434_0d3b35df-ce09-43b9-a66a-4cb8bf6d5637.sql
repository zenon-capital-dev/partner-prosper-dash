CREATE TABLE public.signature_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type text NOT NULL CHECK (parent_type IN ('document','contract')),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  name text NOT NULL,
  party text NOT NULL DEFAULT 'zenon' CHECK (party IN ('zenon','contraparte')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida')),
  file_path text,
  file_name text,
  file_size int,
  mime_type text,
  uploaded_by uuid,
  uploaded_at timestamptz,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_stages_parent_ck CHECK (
    (parent_type = 'document' AND document_id IS NOT NULL AND contract_id IS NULL) OR
    (parent_type = 'contract' AND contract_id IS NOT NULL AND document_id IS NULL)
  )
);

CREATE INDEX idx_sig_stages_doc ON public.signature_stages(document_id);
CREATE INDEX idx_sig_stages_ctr ON public.signature_stages(contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_stages TO authenticated;
GRANT ALL ON public.signature_stages TO service_role;

ALTER TABLE public.signature_stages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_signature_stage(_stage_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_secondary'::app_role)
    OR public.has_role(auth.uid(), 'colaborador'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.signature_stages s
      LEFT JOIN public.contracts c ON c.id = s.contract_id
      LEFT JOIN public.documents d ON d.id = s.document_id
      LEFT JOIN public.clients cl ON cl.id = COALESCE(c.client_id, d.client_id)
      LEFT JOIN public.partners p  ON p.id  = c.partner_id
      LEFT JOIN public.service_providers sp ON sp.id = COALESCE(c.provider_id, d.provider_id)
      WHERE s.id = _stage_id
        AND (
          cl.user_id = auth.uid()
          OR p.user_id = auth.uid()
          OR sp.user_id = auth.uid()
          OR d.uploaded_by = auth.uid()
          OR d.requested_by = auth.uid()
        )
    );
$$;

CREATE POLICY "stages_admin_all" ON public.signature_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'admin_secondary'::app_role) OR public.has_role(auth.uid(),'colaborador'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'admin_secondary'::app_role) OR public.has_role(auth.uid(),'colaborador'::app_role));

CREATE POLICY "stages_party_read" ON public.signature_stages FOR SELECT TO authenticated
  USING (public.can_access_signature_stage(id));

CREATE POLICY "stages_party_update_file" ON public.signature_stages FOR UPDATE TO authenticated
  USING (public.can_access_signature_stage(id))
  WITH CHECK (public.can_access_signature_stage(id));

CREATE TRIGGER trg_sig_stages_updated
  BEFORE UPDATE ON public.signature_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_signature_object(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parts text[];
  stage uuid;
BEGIN
  parts := string_to_array(_name, '/');
  IF array_length(parts,1) < 3 THEN RETURN false; END IF;
  BEGIN stage := parts[3]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.can_access_signature_stage(stage);
END;
$$;

CREATE POLICY "sig_stage_obj_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signature-stages' AND public.can_access_signature_object(name));

CREATE POLICY "sig_stage_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signature-stages' AND public.can_access_signature_object(name));

CREATE POLICY "sig_stage_obj_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signature-stages' AND public.can_access_signature_object(name))
  WITH CHECK (bucket_id = 'signature-stages' AND public.can_access_signature_object(name));

CREATE POLICY "sig_stage_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signature-stages' AND public.can_access_signature_object(name));
