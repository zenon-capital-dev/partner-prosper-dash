
-- Queue / assignment fields
ALTER TABLE public.partner_support_tickets
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_responded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pst_assigned_to ON public.partner_support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pst_status ON public.partner_support_tickets(status);

-- Attachment fields on messages
ALTER TABLE public.partner_support_ticket_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

-- Storage policies for support-attachments bucket
DROP POLICY IF EXISTS "support_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_delete" ON storage.objects;

CREATE POLICY "support_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments' AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.partners p
        WHERE p.user_id = auth.uid()
          AND split_part(name, '/', 1) = p.id::text
      )
    )
  );

CREATE POLICY "support_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments' AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.partners p
        WHERE p.user_id = auth.uid()
          AND split_part(name, '/', 1) = p.id::text
      )
    )
  );

CREATE POLICY "support_attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments' AND (
      public.is_admin(auth.uid()) OR owner = auth.uid()
    )
  );
