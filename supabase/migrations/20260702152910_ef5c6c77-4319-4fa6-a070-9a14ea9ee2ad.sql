CREATE TABLE IF NOT EXISTS public.client_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.client_journey_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES public.client_journey_stages(id) ON DELETE SET NULL,
  from_stage_name text,
  to_stage_name text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.client_stage_history TO authenticated;
GRANT ALL ON public.client_stage_history TO service_role;

ALTER TABLE public.client_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users read stage history" ON public.client_stage_history;
CREATE POLICY "Auth users read stage history"
  ON public.client_stage_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth users insert stage history" ON public.client_stage_history;
CREATE POLICY "Auth users insert stage history"
  ON public.client_stage_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_stage_history_client_at ON public.client_stage_history(client_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_client_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_name text;
  v_to_name text;
BEGIN
  IF NEW.journey_stage_id IS DISTINCT FROM OLD.journey_stage_id THEN
    SELECT name INTO v_from_name FROM public.client_journey_stages WHERE id = OLD.journey_stage_id;
    SELECT name INTO v_to_name FROM public.client_journey_stages WHERE id = NEW.journey_stage_id;
    INSERT INTO public.client_stage_history (
      client_id, from_stage_id, to_stage_id, from_stage_name, to_stage_name, changed_by
    ) VALUES (
      NEW.id, OLD.journey_stage_id, NEW.journey_stage_id, v_from_name, v_to_name, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_client_stage_change ON public.clients;
CREATE TRIGGER trg_log_client_stage_change
  AFTER UPDATE OF journey_stage_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_client_stage_change();