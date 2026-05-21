
-- 1) Add 'indicador' to app_role enum (used by frontend)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'indicador';

-- 2) Trigger to keep tasks.status (legacy text) in sync with tasks.status_new
CREATE OR REPLACE FUNCTION public.sync_task_status_legacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status_new IS NOT NULL AND (NEW.status IS NULL OR NEW.status <> NEW.status_new::text) THEN
    NEW.status := NEW.status_new::text;
  ELSIF NEW.status IS NOT NULL AND NEW.status_new IS NULL THEN
    BEGIN
      NEW.status_new := NEW.status::public.task_status_new;
    EXCEPTION WHEN others THEN
      NEW.status_new := 'a_fazer'::public.task_status_new;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_status_legacy ON public.tasks;
CREATE TRIGGER trg_sync_task_status_legacy
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_status_legacy();

-- 3) Trigger to ensure every profile has at least one role
CREATE OR REPLACE FUNCTION public.ensure_default_role_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_default_role_on_profile ON public.profiles;
CREATE TRIGGER trg_ensure_default_role_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_role_on_profile();
