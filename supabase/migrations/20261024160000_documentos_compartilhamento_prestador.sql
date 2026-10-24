-- Documentos do cliente: acesso do prestador via compartilhamento (document_shares)
-- e origem 'partner_upload' aceita em documents.source.
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.

-- 1) Origem do arquivo: inclui partner_upload (painel do parceiro já grava esse valor)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.documents ADD CONSTRAINT documents_source_check
    CHECK (source IN ('client_upload','admin_upload','email','whatsapp','provider_upload','partner_upload','imported'));
END $$;

-- 2) Função auxiliar: o usuário é prestador e recebeu este documento (não expirado)?
CREATE OR REPLACE FUNCTION private.provider_has_document_share(_user_id uuid, _document_id uuid, _file_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_shares ds
    JOIN public.documents d ON d.id = ds.document_id
    JOIN public.service_providers sp ON sp.id = ds.provider_id
    WHERE sp.user_id = _user_id
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
      AND (
        (_document_id IS NOT NULL AND d.id = _document_id)
        OR (_file_path IS NOT NULL AND d.file_path = _file_path)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_provider_user(_user_id uuid, _provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id = _provider_id AND sp.user_id = _user_id);
$$;

-- 3) Regras de acesso de document_shares
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_shares TO authenticated;

DROP POLICY IF EXISTS "zenon admin gerencia shares" ON public.document_shares;
CREATE POLICY "zenon admin gerencia shares" ON public.document_shares
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "zenon prestador ve seus shares" ON public.document_shares;
CREATE POLICY "zenon prestador ve seus shares" ON public.document_shares
  FOR SELECT TO authenticated
  USING (private.is_provider_user(auth.uid(), provider_id));

DROP POLICY IF EXISTS "zenon prestador marca visualizado" ON public.document_shares;
CREATE POLICY "zenon prestador marca visualizado" ON public.document_shares
  FOR UPDATE TO authenticated
  USING (private.is_provider_user(auth.uid(), provider_id))
  WITH CHECK (private.is_provider_user(auth.uid(), provider_id));

-- 4) Prestador lê a linha do documento que recebeu
DROP POLICY IF EXISTS "zenon prestador le documento compartilhado" ON public.documents;
CREATE POLICY "zenon prestador le documento compartilhado" ON public.documents
  FOR SELECT TO authenticated
  USING (private.provider_has_document_share(auth.uid(), id, NULL));

-- 5) Prestador abre/baixa o arquivo que recebeu (storage, bucket documents)
DROP POLICY IF EXISTS "zenon documents storage read via share" ON storage.objects;
CREATE POLICY "zenon documents storage read via share" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND private.provider_has_document_share((SELECT auth.uid()), NULL, name));

CREATE INDEX IF NOT EXISTS idx_document_shares_provider ON public.document_shares (provider_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON public.document_shares (document_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON public.documents (file_path) WHERE file_path IS NOT NULL;
