
-- Helper to generate sync trigger for each junction table
-- We write each table explicitly for clarity.

-- ============= CLIENT_PARTNERS =============
CREATE TABLE IF NOT EXISTS public.client_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  role text,
  notes text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, partner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_partners TO authenticated;
GRANT ALL ON public.client_partners TO service_role;
ALTER TABLE public.client_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_partners" ON public.client_partners FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Partners view their client links" ON public.client_partners FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = client_partners.partner_id AND p.user_id = auth.uid()));
CREATE TRIGGER trg_client_partners_updated_at BEFORE UPDATE ON public.client_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= CLIENT_REFERRERS =============
CREATE TABLE IF NOT EXISTS public.client_referrers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.referrers(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  share_percent numeric(5,2),
  notes text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, referrer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_referrers TO authenticated;
GRANT ALL ON public.client_referrers TO service_role;
ALTER TABLE public.client_referrers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_referrers" ON public.client_referrers FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Referrers view their client links" ON public.client_referrers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.referrers r WHERE r.id = client_referrers.referrer_id AND r.user_id = auth.uid()));
CREATE TRIGGER trg_client_referrers_updated_at BEFORE UPDATE ON public.client_referrers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= CLIENT_COLLABORATORS =============
CREATE TABLE IF NOT EXISTS public.client_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL,  -- profiles.id (auth user)
  is_primary boolean NOT NULL DEFAULT false,
  role text,
  notes text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, collaborator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_collaborators TO authenticated;
GRANT ALL ON public.client_collaborators TO service_role;
ALTER TABLE public.client_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_collaborators" ON public.client_collaborators FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Collaborators view their client links" ON public.client_collaborators FOR SELECT
  USING (collaborator_id = auth.uid());
CREATE TRIGGER trg_client_collaborators_updated_at BEFORE UPDATE ON public.client_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= CLIENT_PROVIDERS =============
CREATE TABLE IF NOT EXISTS public.client_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  role text,
  notes text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_providers TO authenticated;
GRANT ALL ON public.client_providers TO service_role;
ALTER TABLE public.client_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_providers" ON public.client_providers FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Providers view their client links" ON public.client_providers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id = client_providers.service_provider_id AND sp.user_id = auth.uid()));
CREATE TRIGGER trg_client_providers_updated_at BEFORE UPDATE ON public.client_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= SYNC TRIGGERS (primary -> legacy clients.* fields) =============
CREATE OR REPLACE FUNCTION public.sync_primary_partner_to_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP IN ('INSERT','UPDATE')) AND NEW.is_primary THEN
    UPDATE public.client_partners SET is_primary = false, updated_at = now()
      WHERE client_id = NEW.client_id AND id <> NEW.id AND is_primary;
    UPDATE public.clients SET partner_id = NEW.partner_id, updated_at = now() WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.clients SET partner_id = (
      SELECT partner_id FROM public.client_partners WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), updated_at = now() WHERE id = OLD.client_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_sync_primary_partner AFTER INSERT OR UPDATE OR DELETE ON public.client_partners
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_partner_to_client();

CREATE OR REPLACE FUNCTION public.sync_primary_referrer_to_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP IN ('INSERT','UPDATE')) AND NEW.is_primary THEN
    UPDATE public.client_referrers SET is_primary = false, updated_at = now()
      WHERE client_id = NEW.client_id AND id <> NEW.id AND is_primary;
    UPDATE public.clients SET referrer_id = NEW.referrer_id, indicator_id = NEW.referrer_id, updated_at = now()
      WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.clients SET referrer_id = (
      SELECT referrer_id FROM public.client_referrers WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), indicator_id = (
      SELECT referrer_id FROM public.client_referrers WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), updated_at = now() WHERE id = OLD.client_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_sync_primary_referrer AFTER INSERT OR UPDATE OR DELETE ON public.client_referrers
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_referrer_to_client();

CREATE OR REPLACE FUNCTION public.sync_primary_collaborator_to_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP IN ('INSERT','UPDATE')) AND NEW.is_primary THEN
    UPDATE public.client_collaborators SET is_primary = false, updated_at = now()
      WHERE client_id = NEW.client_id AND id <> NEW.id AND is_primary;
    UPDATE public.clients SET collaborator_id = NEW.collaborator_id, responsible_id = NEW.collaborator_id, updated_at = now()
      WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.clients SET collaborator_id = (
      SELECT collaborator_id FROM public.client_collaborators WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), responsible_id = (
      SELECT collaborator_id FROM public.client_collaborators WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), updated_at = now() WHERE id = OLD.client_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_sync_primary_collaborator AFTER INSERT OR UPDATE OR DELETE ON public.client_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_collaborator_to_client();

CREATE OR REPLACE FUNCTION public.sync_primary_provider_to_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP IN ('INSERT','UPDATE')) AND NEW.is_primary THEN
    UPDATE public.client_providers SET is_primary = false, updated_at = now()
      WHERE client_id = NEW.client_id AND id <> NEW.id AND is_primary;
    UPDATE public.clients SET service_provider_id = NEW.service_provider_id, provider_id = NEW.service_provider_id, updated_at = now()
      WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.clients SET service_provider_id = (
      SELECT service_provider_id FROM public.client_providers WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), provider_id = (
      SELECT service_provider_id FROM public.client_providers WHERE client_id = OLD.client_id ORDER BY created_at ASC LIMIT 1
    ), updated_at = now() WHERE id = OLD.client_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_sync_primary_provider AFTER INSERT OR UPDATE OR DELETE ON public.client_providers
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_provider_to_client();

-- ============= BACKFILL =============
INSERT INTO public.client_partners (client_id, partner_id, is_primary)
SELECT id, partner_id, true FROM public.clients WHERE partner_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.client_referrers (client_id, referrer_id, is_primary)
SELECT id, COALESCE(referrer_id, indicator_id), true FROM public.clients
WHERE COALESCE(referrer_id, indicator_id) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.client_collaborators (client_id, collaborator_id, is_primary)
SELECT id, COALESCE(collaborator_id, responsible_id), true FROM public.clients
WHERE COALESCE(collaborator_id, responsible_id) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.client_providers (client_id, service_provider_id, is_primary)
SELECT id, COALESCE(service_provider_id, provider_id), true FROM public.clients
WHERE COALESCE(service_provider_id, provider_id) IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============= EXTEND clients RLS so secondary links can view =============
DROP POLICY IF EXISTS "Secondary partners view clients" ON public.clients;
CREATE POLICY "Secondary partners view clients" ON public.clients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_partners cp JOIN public.partners p ON p.id = cp.partner_id
    WHERE cp.client_id = clients.id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Secondary referrers view clients" ON public.clients;
CREATE POLICY "Secondary referrers view clients" ON public.clients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_referrers cr JOIN public.referrers r ON r.id = cr.referrer_id
    WHERE cr.client_id = clients.id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Secondary collaborators view clients" ON public.clients;
CREATE POLICY "Secondary collaborators view clients" ON public.clients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_collaborators cc
    WHERE cc.client_id = clients.id AND cc.collaborator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Secondary providers view clients" ON public.clients;
CREATE POLICY "Secondary providers view clients" ON public.clients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_providers cpr JOIN public.service_providers sp ON sp.id = cpr.service_provider_id
    WHERE cpr.client_id = clients.id AND sp.user_id = auth.uid()
  ));
