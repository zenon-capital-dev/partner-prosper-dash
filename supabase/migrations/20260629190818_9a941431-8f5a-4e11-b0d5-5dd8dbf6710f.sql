-- Finaliza acesso do painel de parceiros para vínculos por e-mail e carteira secundária.

DROP POLICY IF EXISTS "Partners view their client links" ON public.client_partners;
CREATE POLICY "Partners view their client links"
ON public.client_partners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partners p
    WHERE p.id = client_partners.partner_id
      AND (
        p.user_id = auth.uid()
        OR lower(p.email) = lower(auth.jwt() ->> 'email')
      )
  )
);

-- Permite que parceiros anexem/atualizem documentos operacionais dos clientes e demandas da sua carteira.
DROP POLICY IF EXISTS "Partners insert related documents" ON public.documents;
CREATE POLICY "Partners insert related documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  (
    client_id IS NOT NULL
    AND private.is_partner_for_client(auth.uid(), client_id)
  )
  OR (
    client_product_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_products cp
      WHERE cp.id = documents.client_product_id
        AND private.is_partner_for_client(auth.uid(), cp.client_id)
    )
  )
);

DROP POLICY IF EXISTS "Partners update related documents" ON public.documents;
CREATE POLICY "Partners update related documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  (
    client_id IS NOT NULL
    AND private.is_partner_for_client(auth.uid(), client_id)
  )
  OR (
    client_product_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_products cp
      WHERE cp.id = documents.client_product_id
        AND private.is_partner_for_client(auth.uid(), cp.client_id)
    )
  )
)
WITH CHECK (
  (
    client_id IS NOT NULL
    AND private.is_partner_for_client(auth.uid(), client_id)
  )
  OR (
    client_product_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_products cp
      WHERE cp.id = documents.client_product_id
        AND private.is_partner_for_client(auth.uid(), cp.client_id)
    )
  )
);

-- Demand requests já usa public.user_involved_in_demand; recria as policies para pegar a função atualizada
-- que inclui parceiros secundários e fallback por e-mail.
DROP POLICY IF EXISTS "Envolvidos veem solicitações da demanda" ON public.demand_requests;
DROP POLICY IF EXISTS "Envolvidos criam solicitações" ON public.demand_requests;
DROP POLICY IF EXISTS "Envolvidos respondem solicitações" ON public.demand_requests;

CREATE POLICY "Envolvidos veem solicitações da demanda"
ON public.demand_requests
FOR SELECT
TO authenticated
USING (public.user_involved_in_demand(auth.uid(), client_product_id));

CREATE POLICY "Envolvidos criam solicitações"
ON public.demand_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND public.user_involved_in_demand(auth.uid(), client_product_id)
);

CREATE POLICY "Envolvidos respondem solicitações"
ON public.demand_requests
FOR UPDATE
TO authenticated
USING (public.user_involved_in_demand(auth.uid(), client_product_id))
WITH CHECK (public.user_involved_in_demand(auth.uid(), client_product_id));
