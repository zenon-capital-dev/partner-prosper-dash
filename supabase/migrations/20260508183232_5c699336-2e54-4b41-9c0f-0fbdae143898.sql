-- Message templates
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage templates" ON public.message_templates FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated read templates" ON public.message_templates FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see all chat" ON public.chat_messages FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Users see own chat" ON public.chat_messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR recipient_id IS NULL);
CREATE POLICY "Users send chat" ON public.chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users update own chat" ON public.chat_messages FOR UPDATE USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE INDEX idx_chat_recipient ON public.chat_messages(recipient_id, created_at DESC);
CREATE INDEX idx_chat_sender ON public.chat_messages(sender_id, created_at DESC);

-- NPS responses
CREATE TABLE public.nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  score INT NOT NULL CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/vendedor view nps" ON public.nps_responses FOR SELECT USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));
CREATE POLICY "Client submits own nps" ON public.nps_responses FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "Client views own nps" ON public.nps_responses FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;