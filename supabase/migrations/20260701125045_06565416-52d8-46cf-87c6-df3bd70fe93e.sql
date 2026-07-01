
CREATE TABLE IF NOT EXISTS public.contract_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_folders TO authenticated;
GRANT ALL ON public.contract_folders TO service_role;

ALTER TABLE public.contract_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contract folders"
  ON public.contract_folders FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Clients view own contract folders"
  ON public.contract_folders FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER trg_contract_folders_updated
  BEFORE UPDATE ON public.contract_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.contract_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_file_path text,
  ADD COLUMN IF NOT EXISTS signed_uploaded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contracts_folder_id ON public.contracts(folder_id);

-- Allow client to update signed_file_path on their own contracts
DROP POLICY IF EXISTS "Clients can upload signed contract" ON public.contracts;
CREATE POLICY "Clients can upload signed contract"
  ON public.contracts FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Storage RLS: allow clients to upload to contracts bucket in their own folder
DROP POLICY IF EXISTS "Clients upload signed contracts" ON storage.objects;
CREATE POLICY "Clients upload signed contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients read own contracts storage" ON storage.objects;
CREATE POLICY "Clients read own contracts storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.clients WHERE user_id = auth.uid()
      )
    )
  );
