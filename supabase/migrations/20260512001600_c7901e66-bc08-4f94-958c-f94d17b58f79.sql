DROP POLICY IF EXISTS "Provider views delegated notes" ON public.notes;

CREATE POLICY "Provider views delegated notes"
ON public.notes
FOR SELECT
TO authenticated
USING (
  is_private = false
  AND client_product_id IS NOT NULL
  AND private.is_delegated_provider(auth.uid(), client_product_id)
);