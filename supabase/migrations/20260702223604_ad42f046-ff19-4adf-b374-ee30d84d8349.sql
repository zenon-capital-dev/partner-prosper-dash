ALTER TABLE public.partner_materials
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'partner'
  CHECK (audience IN ('partner','provider','client','general'));

CREATE INDEX IF NOT EXISTS idx_partner_materials_audience ON public.partner_materials(audience, active);

DROP POLICY IF EXISTS "Providers view active provider materials" ON public.partner_materials;
CREATE POLICY "Providers view active provider materials"
  ON public.partner_materials FOR SELECT
  USING (
    active = true
    AND audience IN ('provider','general')
    AND EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients view active client materials" ON public.partner_materials;
CREATE POLICY "Clients view active client materials"
  ON public.partner_materials FOR SELECT
  USING (
    active = true
    AND audience IN ('client','general')
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Collaborators view general materials" ON public.partner_materials;
CREATE POLICY "Collaborators view general materials"
  ON public.partner_materials FOR SELECT
  USING (
    active = true
    AND audience = 'general'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
    )
  );