
-- 1) Add kind to client_interactions
ALTER TABLE public.client_interactions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'outro';

CREATE INDEX IF NOT EXISTS idx_client_interactions_kind_occurred
  ON public.client_interactions (kind, occurred_at DESC);

-- 2) Activity goals
CREATE TABLE IF NOT EXISTS public.activity_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_kind text NOT NULL CHECK (period_kind IN ('day','week','month')),
  period_start date NOT NULL,
  kind text NOT NULL,
  target_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_kind, period_start, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_goals TO authenticated;
GRANT ALL ON public.activity_goals TO service_role;

ALTER TABLE public.activity_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage activity goals"
  ON public.activity_goals
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_secondary'::app_role)
    OR has_role(auth.uid(), 'colaborador'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_secondary'::app_role)
    OR has_role(auth.uid(), 'colaborador'::app_role)
  );

CREATE TRIGGER trg_activity_goals_updated_at
  BEFORE UPDATE ON public.activity_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
