-- Chat messages per demand request
CREATE TABLE IF NOT EXISTS public.demand_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.demand_requests(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_request_messages_request ON public.demand_request_messages(request_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_request_messages TO authenticated;
GRANT ALL ON public.demand_request_messages TO service_role;

ALTER TABLE public.demand_request_messages ENABLE ROW LEVEL SECURITY;

-- Reuse the parent request's visibility: anyone who can SELECT the request can read/write messages
CREATE POLICY "read messages when request visible"
  ON public.demand_request_messages FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.demand_requests dr WHERE dr.id = request_id));

CREATE POLICY "insert messages when request visible"
  ON public.demand_request_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.demand_requests dr WHERE dr.id = request_id)
  );

CREATE POLICY "author can update own message"
  ON public.demand_request_messages FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "author or admin can delete"
  ON public.demand_request_messages FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR private.is_admin(auth.uid()));
