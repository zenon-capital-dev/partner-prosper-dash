CREATE OR REPLACE FUNCTION public.client_submit_payment_receipt(_payment_id uuid, _receipt_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  IF _receipt_path IS NULL OR length(_receipt_path) = 0 THEN
    RAISE EXCEPTION 'receipt path required';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = _payment_id AND c.user_id = auth.uid()
  ) INTO _ok;
  IF NOT _ok THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payments
     SET receipt_url = _receipt_path,
         notes = COALESCE(notes || E'\n', '') || 'Comprovante enviado pelo cliente em ' || to_char(now(),'DD/MM/YYYY HH24:MI'),
         updated_at = now()
   WHERE id = _payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_submit_payment_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_submit_payment_receipt(uuid, text) TO authenticated;