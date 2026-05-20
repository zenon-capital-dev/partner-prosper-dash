
DROP POLICY IF EXISTS "Onboarding history: Admin view" ON public.onboarding_history;
CREATE POLICY "Onboarding history: Admin view"
  ON public.onboarding_history FOR SELECT
  TO authenticated
  USING (private.is_admin(auth.uid()));
