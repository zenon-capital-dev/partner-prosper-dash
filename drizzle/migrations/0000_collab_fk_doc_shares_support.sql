-- 1) Colaborador = usuário (profiles), não registro em employees
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_collaborator_id_fkey;
ALTER TABLE public.clients ADD CONSTRAINT clients_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_collaborator_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.client_collaborators DROP CONSTRAINT IF EXISTS client_collaborators_collaborator_id_fkey;
ALTER TABLE public.client_collaborators ADD CONSTRAINT client_collaborators_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2) Compartilhamento de documentos com prestadores
CREATE TABLE public.document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  shared_by uuid,
  can_download boolean NOT NULL DEFAULT true,
  message text,
  expires_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, provider_id)
);
CREATE INDEX idx_document_shares_provider ON public.document_shares(provider_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_shares TO authenticated;
GRANT ALL ON public.document_shares TO service_role;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage document_shares" ON public.document_shares FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "provider reads own shares" ON public.document_shares FOR SELECT TO authenticated
  USING (public.is_provider_owner(auth.uid(), provider_id));
CREATE POLICY "provider marks viewed" ON public.document_shares FOR UPDATE TO authenticated
  USING (public.is_provider_owner(auth.uid(), provider_id)) WITH CHECK (public.is_provider_owner(auth.uid(), provider_id));

CREATE OR REPLACE FUNCTION public.provider_has_document_share(_user_id uuid, _document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_shares ds JOIN public.service_providers sp ON sp.id = ds.provider_id
    WHERE ds.document_id = _document_id AND sp.user_id = _user_id
      AND (ds.expires_at IS NULL OR ds.expires_at > now()))
$$;
CREATE OR REPLACE FUNCTION public.provider_can_read_shared_file(_user_id uuid, _path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_shares ds
    JOIN public.service_providers sp ON sp.id = ds.provider_id
    JOIN public.documents d ON d.id = ds.document_id
    WHERE sp.user_id = _user_id AND ds.can_download
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
      AND _path IN (d.file_path, d.signed_file_path, d.completed_file_path))
$$;
REVOKE EXECUTE ON FUNCTION public.provider_has_document_share(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_can_read_shared_file(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_has_document_share(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provider_can_read_shared_file(uuid, text) TO authenticated;

CREATE POLICY "provider reads shared documents" ON public.documents FOR SELECT TO authenticated
  USING (public.provider_has_document_share(auth.uid(), id));
CREATE POLICY "provider reads shared document files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.provider_can_read_shared_file(auth.uid(), name));

CREATE OR REPLACE FUNCTION public.notify_provider_on_document_share()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _name text;
BEGIN
  SELECT user_id INTO _uid FROM public.service_providers WHERE id = NEW.provider_id;
  SELECT name INTO _name FROM public.documents WHERE id = NEW.document_id;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (_uid, 'Novo documento compartilhado', COALESCE(_name, 'Documento'), 'document', '/prestador/compartilhados');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_provider_on_document_share() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_provider_document_share AFTER INSERT ON public.document_shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_provider_on_document_share();

-- 3) Suporte para colaboradores e prestadores
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid(),
  requester_role text NOT NULL CHECK (requester_role IN ('colaborador','prestador')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 200),
  category text NOT NULL DEFAULT 'geral' CHECK (category IN ('geral','acesso','demanda','documentos','financeiro','bug','outro')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido','fechado')),
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_tickets_requester ON public.support_tickets(requester_id);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all support_tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "requester reads own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (requester_id = auth.uid());
CREATE POLICY "requester creates tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'aberto' AND assigned_to IS NULL
    AND public.has_role(auth.uid(), (CASE WHEN requester_role = 'colaborador' THEN 'colaborador' ELSE 'prestador' END)::app_role));

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL DEFAULT auth.uid(),
  sender_role text NOT NULL CHECK (sender_role IN ('admin','requester')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_msgs_ticket ON public.support_ticket_messages(ticket_id);
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all support msgs" ON public.support_ticket_messages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()) AND sender_user_id = auth.uid());
CREATE POLICY "requester reads msgs" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.requester_id = auth.uid()));
CREATE POLICY "requester sends msgs" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid() AND sender_role = 'requester'
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.requester_id = auth.uid() AND t.status IN ('aberto','em_andamento')));

CREATE OR REPLACE FUNCTION public.on_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  UPDATE public.support_tickets SET updated_at = now(),
    status = CASE WHEN NEW.sender_role = 'admin' AND status = 'aberto' THEN 'em_andamento' ELSE status END
    WHERE id = NEW.ticket_id;
  IF NEW.sender_role = 'admin' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (t.requester_id, 'Resposta do suporte', t.subject, 'support',
      CASE WHEN t.requester_role = 'colaborador' THEN '/colaborador/suporte' ELSE '/prestador/suporte' END);
  ELSE
    PERFORM public.notify_admins('Suporte: nova mensagem (' || t.requester_role || ')', t.subject, '/admin/suporte?tab=' || t.requester_role || 'es', 'support');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.on_support_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_on_support_message AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_support_message();