
ALTER TABLE public.client_document_requests DROP CONSTRAINT IF EXISTS client_document_requests_status_check;
ALTER TABLE public.client_document_requests
  ADD CONSTRAINT client_document_requests_status_check
  CHECK (status = ANY (ARRAY[
    'pendente'::text,
    'solicitado'::text,
    'em_analise'::text,
    'enviado'::text,
    'aprovado'::text,
    'rejeitado'::text,
    'reprovado'::text,
    'pendente_correcao'::text
  ]));
