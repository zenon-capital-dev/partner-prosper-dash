
-- Backfill all junction tables from legacy FKs on clients
INSERT INTO public.client_partners (client_id, partner_id, is_primary)
SELECT c.id, c.partner_id, true
FROM public.clients c
WHERE c.partner_id IS NOT NULL
ON CONFLICT (client_id, partner_id) DO NOTHING;

INSERT INTO public.client_referrers (client_id, referrer_id, is_primary)
SELECT c.id, COALESCE(c.referrer_id, c.indicator_id), true
FROM public.clients c
WHERE COALESCE(c.referrer_id, c.indicator_id) IS NOT NULL
ON CONFLICT (client_id, referrer_id) DO NOTHING;

INSERT INTO public.client_collaborators (client_id, collaborator_id, is_primary)
SELECT c.id, COALESCE(c.collaborator_id, c.responsible_id), true
FROM public.clients c
WHERE COALESCE(c.collaborator_id, c.responsible_id) IS NOT NULL
ON CONFLICT (client_id, collaborator_id) DO NOTHING;

INSERT INTO public.client_providers (client_id, service_provider_id, is_primary)
SELECT c.id, COALESCE(c.service_provider_id, c.provider_id), true
FROM public.clients c
WHERE COALESCE(c.service_provider_id, c.provider_id) IS NOT NULL
ON CONFLICT (client_id, service_provider_id) DO NOTHING;

-- Trigger: sempre que um cliente é criado/atualizado com um FK legado, garante a linha primária na junction
CREATE OR REPLACE FUNCTION public.sync_client_legacy_to_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.partner_id IS NOT NULL THEN
    INSERT INTO public.client_partners (client_id, partner_id, is_primary)
    VALUES (NEW.id, NEW.partner_id, true)
    ON CONFLICT (client_id, partner_id) DO NOTHING;
  END IF;

  IF COALESCE(NEW.referrer_id, NEW.indicator_id) IS NOT NULL THEN
    INSERT INTO public.client_referrers (client_id, referrer_id, is_primary)
    VALUES (NEW.id, COALESCE(NEW.referrer_id, NEW.indicator_id), true)
    ON CONFLICT (client_id, referrer_id) DO NOTHING;
  END IF;

  IF COALESCE(NEW.collaborator_id, NEW.responsible_id) IS NOT NULL THEN
    INSERT INTO public.client_collaborators (client_id, collaborator_id, is_primary)
    VALUES (NEW.id, COALESCE(NEW.collaborator_id, NEW.responsible_id), true)
    ON CONFLICT (client_id, collaborator_id) DO NOTHING;
  END IF;

  IF COALESCE(NEW.service_provider_id, NEW.provider_id) IS NOT NULL THEN
    INSERT INTO public.client_providers (client_id, service_provider_id, is_primary)
    VALUES (NEW.id, COALESCE(NEW.service_provider_id, NEW.provider_id), true)
    ON CONFLICT (client_id, service_provider_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_client_legacy_to_links() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_client_legacy_to_links ON public.clients;
CREATE TRIGGER trg_sync_client_legacy_to_links
AFTER INSERT OR UPDATE OF partner_id, referrer_id, indicator_id, collaborator_id, responsible_id, service_provider_id, provider_id
ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_legacy_to_links();
