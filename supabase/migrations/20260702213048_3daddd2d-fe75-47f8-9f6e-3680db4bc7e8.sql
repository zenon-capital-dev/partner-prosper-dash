
CREATE OR REPLACE FUNCTION public.financial_consistency_report()
RETURNS TABLE (check_code text, check_name text, severity text, problems bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH paid AS (
    SELECT id, sale_id, client_id, status, amount, amount_paid
    FROM public.payments
    WHERE status::text IN ('pago','paga','parcial','parcialmente_pago')
  ),
  zenon_by_sale AS (
    SELECT sale_id, SUM(GREATEST(COALESCE(amount_paid,0), COALESCE(amount,0))) AS received
    FROM paid GROUP BY sale_id
  ),
  sales_scope AS (
    SELECT id, amount, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent
    FROM public.sales WHERE status::text = 'concluida'
  )
  SELECT * FROM (
    VALUES
    ('A','Recebido maior que valor vendido','critical',
      (SELECT COUNT(*) FROM sales_scope s LEFT JOIN zenon_by_sale z ON z.sale_id=s.id WHERE COALESCE(z.received,0) > s.amount + 0.01)),
    ('B','Parcelas pagas sem comissao gerada','high',
      (SELECT COUNT(DISTINCT p.id) FROM paid p JOIN sales_scope s ON s.id=p.sale_id
       LEFT JOIN public.commission_splits cs ON cs.sale_id=p.sale_id
       WHERE (s.partner_id IS NOT NULL OR s.referrer_id IS NOT NULL OR s.collaborator_id IS NOT NULL OR s.service_provider_id IS NOT NULL)
         AND cs.id IS NULL)),
    ('C','Splits marcados PAGOS sem parcela paga','high',
      (SELECT COUNT(*) FROM public.commission_splits cs
       WHERE cs.status::text IN ('pago','paga')
         AND NOT EXISTS (SELECT 1 FROM paid p WHERE p.sale_id=cs.sale_id))),
    ('D','Comissoes legacy sem beneficiario','medium',
      (SELECT COUNT(*) FROM public.commissions
       WHERE partner_id IS NULL AND collaborator_id IS NULL AND referrer_id IS NULL AND service_provider_id IS NULL)),
    ('E','Splits com valor divergente de (venda * percent)','info',
      (SELECT COUNT(*) FROM public.commission_splits cs
       JOIN sales_scope s ON s.id=cs.sale_id
       WHERE cs.beneficiary_type::text <> 'service_provider'
         AND COALESCE(cs.percent,0) > 0
         AND ABS(COALESCE(cs.amount,0) - ROUND(s.amount * cs.percent / 100.0, 2)) > 0.05)),
    ('F','Vendas com % de comissao sem beneficiario','medium',
      (SELECT COUNT(*) FROM sales_scope s
       WHERE COALESCE(s.commission_percent,0) > 0
         AND s.partner_id IS NULL AND s.referrer_id IS NULL AND s.collaborator_id IS NULL)),
    ('G','Pagamentos sem client_id','medium',
      (SELECT COUNT(*) FROM public.payments WHERE client_id IS NULL)),
    ('H','Splits duplicados (mesma venda + beneficiario)','high',
      (SELECT COUNT(*) FROM (
        SELECT sale_id, beneficiary_type::text, beneficiary_id
        FROM public.commission_splits GROUP BY 1,2,3 HAVING COUNT(*)>1) x))
  ) AS t(check_code, check_name, severity, problems)
  WHERE (SELECT private.is_admin());
$$;

REVOKE EXECUTE ON FUNCTION public.financial_consistency_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financial_consistency_report() TO authenticated, service_role;
