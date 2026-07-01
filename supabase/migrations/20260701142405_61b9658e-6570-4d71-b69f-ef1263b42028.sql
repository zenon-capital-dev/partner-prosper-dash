
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS requires_signature boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_file_path text,
  ADD COLUMN IF NOT EXISTS signed_file_size integer,
  ADD COLUMN IF NOT EXISTS signed_mime_type text,
  ADD COLUMN IF NOT EXISTS signed_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS completed_file_path text,
  ADD COLUMN IF NOT EXISTS completed_file_size integer,
  ADD COLUMN IF NOT EXISTS completed_mime_type text,
  ADD COLUMN IF NOT EXISTS completed_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_uploaded_by uuid;
