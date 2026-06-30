CREATE TABLE public.partner_support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.partner_support_tickets(id) ON DELETE CASCADE,
  sender_user_id UUID,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('partner','admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pstm_ticket ON public.partner_support_ticket_messages(ticket_id, created_at);

GRANT SELECT, INSERT ON public.partner_support_ticket_messages TO authenticated;
GRANT ALL ON public.partner_support_ticket_messages TO service_role;

ALTER TABLE public.partner_support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Admins: full read/write
CREATE POLICY "Admins manage ticket messages"
ON public.partner_support_ticket_messages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Partners: read/insert messages of own tickets
CREATE POLICY "Partners read own ticket messages"
ON public.partner_support_ticket_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partner_support_tickets t
    JOIN public.partners p ON p.id = t.partner_id
    WHERE t.id = partner_support_ticket_messages.ticket_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Partners insert own ticket messages"
ON public.partner_support_ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_role = 'partner'
  AND sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.partner_support_tickets t
    JOIN public.partners p ON p.id = t.partner_id
    WHERE t.id = partner_support_ticket_messages.ticket_id
      AND p.user_id = auth.uid()
  )
);