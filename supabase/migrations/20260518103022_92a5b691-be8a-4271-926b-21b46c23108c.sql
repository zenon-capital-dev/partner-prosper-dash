-- Comentários
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Sub-checklist
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  done_by uuid,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task ON public.task_checklist_items(task_id);
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_task_checklist_items_updated_at ON public.task_checklist_items;
CREATE TRIGGER trg_task_checklist_items_updated_at
BEFORE UPDATE ON public.task_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: pode acessar a tarefa?
CREATE OR REPLACE FUNCTION private.can_access_task(_uid uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.is_admin(_uid)
    OR private.has_role(_uid, 'admin_secondary'::app_role)
    OR private.has_role(_uid, 'colaborador'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = _task_id
        AND (
          t.assigned_to = _uid
          OR t.created_by = _uid
          OR (t.client_product_id IS NOT NULL AND private.is_delegated_provider(_uid, t.client_product_id))
        )
    )
$$;
REVOKE EXECUTE ON FUNCTION private.can_access_task(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_task(uuid, uuid) TO authenticated;

-- Policies task_comments
CREATE POLICY "tc_select" ON public.task_comments FOR SELECT TO authenticated
  USING (private.can_access_task(auth.uid(), task_id));
CREATE POLICY "tc_insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND private.can_access_task(auth.uid(), task_id));
CREATE POLICY "tc_update_own" ON public.task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "tc_delete_own_or_admin" ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR private.is_admin(auth.uid()));

-- Policies task_checklist_items
CREATE POLICY "tci_select" ON public.task_checklist_items FOR SELECT TO authenticated
  USING (private.can_access_task(auth.uid(), task_id));
CREATE POLICY "tci_insert" ON public.task_checklist_items FOR INSERT TO authenticated
  WITH CHECK (private.can_access_task(auth.uid(), task_id));
CREATE POLICY "tci_update" ON public.task_checklist_items FOR UPDATE TO authenticated
  USING (private.can_access_task(auth.uid(), task_id))
  WITH CHECK (private.can_access_task(auth.uid(), task_id));
CREATE POLICY "tci_delete" ON public.task_checklist_items FOR DELETE TO authenticated
  USING (private.can_access_task(auth.uid(), task_id));