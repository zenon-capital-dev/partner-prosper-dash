
CREATE POLICY "Admins read expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'expense-receipts' AND private.is_admin());

CREATE POLICY "Admins upload expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-receipts' AND private.is_admin());

CREATE POLICY "Admins update expense receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'expense-receipts' AND private.is_admin())
WITH CHECK (bucket_id = 'expense-receipts' AND private.is_admin());

CREATE POLICY "Admins delete expense receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense-receipts' AND private.is_admin());
