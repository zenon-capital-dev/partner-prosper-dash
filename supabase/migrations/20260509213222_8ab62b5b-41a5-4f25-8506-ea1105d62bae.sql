-- Auto-mark overdue payments
CREATE OR REPLACE FUNCTION public.mark_overdue_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payments
  SET status = 'vencido'
  WHERE status IN ('pendente', 'em_aberto')
    AND due_date < CURRENT_DATE;
END;
$$;

-- Client financial summary view
CREATE OR REPLACE VIEW public.view_client_financial_summary AS
SELECT 
  c.id AS client_id,
  c.full_name,
  COALESCE(SUM(DISTINCT cp.value), 0) AS total_contracted,
  COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.amount_paid ELSE 0 END), 0) AS total_paid,
  COALESCE(SUM(CASE WHEN p.status IN ('pendente', 'em_aberto', 'parcial') THEN (p.amount - COALESCE(p.amount_paid, 0)) ELSE 0 END), 0) AS total_pending,
  COALESCE(SUM(CASE WHEN p.status = 'vencido' THEN (p.amount - COALESCE(p.amount_paid, 0)) ELSE 0 END), 0) AS total_overdue,
  COUNT(DISTINCT CASE WHEN cp.status NOT IN ('cancelado', 'finalizado') THEN cp.id END) AS active_products
FROM public.clients c
LEFT JOIN public.client_products cp ON cp.client_id = c.id
LEFT JOIN public.payments p ON p.client_id = c.id
GROUP BY c.id, c.full_name;