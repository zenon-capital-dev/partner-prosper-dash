CREATE POLICY "Clientes anexam docs nas suas demandas"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = documents.client_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Clientes atualizam envio de seus docs"
ON public.documents FOR UPDATE TO authenticated
USING (
  client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = documents.client_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = documents.client_id AND c.user_id = auth.uid()
  )
);