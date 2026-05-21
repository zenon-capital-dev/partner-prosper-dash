DO $$ BEGIN
  CREATE TYPE public.task_kind AS ENUM ('tarefa','reuniao','ligacao','pendencia_documento','lembrete','follow_up');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kind public.task_kind NOT NULL DEFAULT 'tarefa',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS visible_to_client boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome text;

CREATE INDEX IF NOT EXISTS idx_tasks_kind ON public.tasks(kind);
CREATE INDEX IF NOT EXISTS idx_tasks_due_client ON public.tasks(due_date, client_id);

INSERT INTO public.tasks (
  title, kind, client_id, client_product_id, due_date, priority, status_new,
  assigned_to, created_by, description, outcome, completed_at, created_at, updated_at
)
SELECT
  COALESCE('Ligação · ' || c.full_name, 'Ligação'),
  'ligacao'::public.task_kind,
  da.client_id,
  da.client_product_id,
  da.scheduled_date::timestamptz,
  da.priority,
  CASE da.status
    WHEN 'executada' THEN 'concluida'::public.task_status_new
    WHEN 'cancelada' THEN 'cancelada'::public.task_status_new
    ELSE 'a_fazer'::public.task_status_new
  END,
  da.assigned_to, da.created_by, da.notes,
  COALESCE(da.result, da.execution_notes),
  da.executed_at, da.created_at, da.updated_at
FROM public.daily_actions da
LEFT JOIN public.clients c ON c.id = da.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.kind = 'ligacao' AND t.client_id = da.client_id
    AND t.due_date = da.scheduled_date::timestamptz
);

CREATE OR REPLACE FUNCTION public.notify_tasks_due_today()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.id, t.title, t.assigned_to, t.due_date, c.full_name AS client_name
    FROM public.tasks t
    LEFT JOIN public.clients c ON c.id = t.client_id
    WHERE t.assigned_to IS NOT NULL
      AND t.status_new NOT IN ('concluida','cancelada')
      AND (t.due_date::date = CURRENT_DATE
           OR (t.due_date < now() AND t.due_date::date >= CURRENT_DATE - INTERVAL '14 days'))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.assigned_to AND n.link = '/agenda'
        AND n.created_at::date = CURRENT_DATE
        AND n.message LIKE '%' || r.title || '%'
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (
        r.assigned_to,
        CASE WHEN r.due_date::date < CURRENT_DATE THEN 'Pendência atrasada' ELSE 'Para hoje' END,
        r.title || COALESCE(' · ' || r.client_name, ''),
        '/agenda', 'task'
      );
    END IF;
  END LOOP;
END; $$;