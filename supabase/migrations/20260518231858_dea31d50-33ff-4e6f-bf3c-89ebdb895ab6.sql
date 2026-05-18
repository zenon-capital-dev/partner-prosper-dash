-- Permitir que clientes assinem seus próprios contratos
CREATE POLICY "Clients can sign own contracts" 
ON public.contracts 
FOR UPDATE 
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
)
WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()) AND
  status = 'assinado'
);

-- Permitir que clientes marquem etapas como concluídas (se visíveis)
CREATE POLICY "Clients can toggle own product steps" 
ON public.client_product_steps 
FOR UPDATE 
USING (
  is_visible_to_client = true AND
  client_product_id IN (
    SELECT cp.id FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  is_visible_to_client = true AND
  client_product_id IN (
    SELECT cp.id FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE c.user_id = auth.uid()
  )
);

-- Garantir que a política de update de documentos permita o envio pelo cliente
DROP POLICY IF EXISTS "Clients can update their own documents" ON public.documents;
CREATE POLICY "Clients can update their own documents"
ON public.documents
FOR UPDATE
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
)
WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
