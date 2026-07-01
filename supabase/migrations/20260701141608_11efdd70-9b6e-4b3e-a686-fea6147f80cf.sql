-- Track last journey stage change on clients and log to timeline
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.log_client_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_name text;
  new_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.journey_stage_id IS DISTINCT FROM OLD.journey_stage_id THEN
    SELECT name INTO old_name FROM public.client_journey_stages WHERE id = OLD.journey_stage_id;
    SELECT name INTO new_name FROM public.client_journey_stages WHERE id = NEW.journey_stage_id;

    NEW.stage_changed_at := now();

    INSERT INTO public.client_timeline (client_id, user_id, event_type, title, description, metadata)
    VALUES (
      NEW.id,
      auth.uid(),
      'stage_change',
      'Estágio alterado',
      COALESCE(old_name, 'Sem estágio') || ' → ' || COALESCE(new_name, 'Sem estágio'),
      jsonb_build_object(
        'from_stage_id', OLD.journey_stage_id,
        'to_stage_id',   NEW.journey_stage_id,
        'from_stage',    old_name,
        'to_stage',      new_name,
        'changed_at',    now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_client_stage_change ON public.clients;
CREATE TRIGGER trg_log_client_stage_change
BEFORE UPDATE OF journey_stage_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.log_client_stage_change();

-- Backfill current stage_changed_at from clients.updated_at for existing rows with a stage
UPDATE public.clients
SET stage_changed_at = COALESCE(stage_changed_at, updated_at, created_at)
WHERE journey_stage_id IS NOT NULL AND stage_changed_at IS NULL;