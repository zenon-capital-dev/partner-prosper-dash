
-- Notification preferences per user and type
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs select" ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own prefs insert" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs update" ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs delete" ON public.notification_preferences FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check user preference (defaults to true if row missing)
CREATE OR REPLACE FUNCTION public.notification_enabled(_user_id uuid, _type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT in_app FROM public.notification_preferences WHERE user_id = _user_id AND type = _type), true);
$$;
GRANT EXECUTE ON FUNCTION public.notification_enabled(uuid, text) TO authenticated;

-- Trigger: notify parties (client, provider, admins) when a comment is added to a demand
CREATE OR REPLACE FUNCTION public.notify_demand_comment_all()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cp record;
  v_client_user uuid;
  v_provider_user uuid;
  v_link text;
  v_author uuid := NEW.user_id;
BEGIN
  SELECT cp.id, cp.client_id, cp.service_provider_id, cp.custom_product_name
    INTO v_cp
  FROM public.client_products cp WHERE cp.id = NEW.client_product_id;

  IF v_cp.id IS NULL THEN RETURN NEW; END IF;
  v_link := '/demandas/' || v_cp.id;

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = v_cp.client_id;
  SELECT user_id INTO v_provider_user FROM public.service_providers WHERE id = v_cp.service_provider_id;

  -- Client
  IF v_client_user IS NOT NULL AND v_client_user <> v_author AND public.notification_enabled(v_client_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_client_user, 'Novo comentário na sua demanda', COALESCE(v_cp.custom_product_name, '—'), '/portal-cliente/demandas', 'comment');
  END IF;

  -- Provider
  IF v_provider_user IS NOT NULL AND v_provider_user <> v_author AND public.notification_enabled(v_provider_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_provider_user, 'Novo comentário em demanda', COALESCE(v_cp.custom_product_name, '—'), v_link, 'comment');
  END IF;

  -- Admins
  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Novo comentário em demanda', COALESCE(v_cp.custom_product_name, '—'), v_link, 'comment'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','admin_secondary','super_admin')
    AND ur.user_id <> v_author
    AND public.notification_enabled(ur.user_id, 'comment');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demand_comment_all ON public.demand_comments;
CREATE TRIGGER trg_notify_demand_comment_all
AFTER INSERT ON public.demand_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_comment_all();

-- Trigger: notify client + admins when a demand status changes
CREATE OR REPLACE FUNCTION public.notify_demand_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_user uuid; v_provider_user uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = NEW.client_id;
  SELECT user_id INTO v_provider_user FROM public.service_providers WHERE id = NEW.service_provider_id;

  IF v_client_user IS NOT NULL AND public.notification_enabled(v_client_user, 'status') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_client_user, 'Status da demanda atualizado',
      COALESCE(NEW.custom_product_name, '—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
      '/portal-cliente/demandas', 'status');
  END IF;

  IF v_provider_user IS NOT NULL AND public.notification_enabled(v_provider_user, 'status') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_provider_user, 'Status da demanda atualizado',
      COALESCE(NEW.custom_product_name, '—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
      '/demandas/' || NEW.id, 'status');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Status de demanda atualizado',
         COALESCE(NEW.custom_product_name,'—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
         '/demandas/' || NEW.id, 'status'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','admin_secondary','super_admin')
    AND public.notification_enabled(ur.user_id, 'status');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demand_status_change ON public.client_products;
CREATE TRIGGER trg_notify_demand_status_change
AFTER UPDATE OF status ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_status_change();

-- Ensure realtime already publishes notifications (idempotent)
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
