
-- service_providers: separar leitura (staff interno) de escrita (apenas admin)
DROP POLICY IF EXISTS "Internal team manages service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Internal team can view service providers" ON public.service_providers;

CREATE POLICY "Staff can view service providers"
  ON public.service_providers
  FOR SELECT
  USING (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::app_role)
    OR private.has_role(auth.uid(), 'colaborador'::app_role)
  );

CREATE POLICY "Admins manage service providers writes"
  ON public.service_providers
  FOR INSERT
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "Admins update service providers"
  ON public.service_providers
  FOR UPDATE
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "Admins delete service providers"
  ON public.service_providers
  FOR DELETE
  USING (private.is_admin(auth.uid()));

-- Garantir que colaborador tenha visibilidade de leitura em clients e leads,
-- sem qualquer permissão de escrita.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clients'
      AND policyname='Colaboradores view clients'
  ) THEN
    CREATE POLICY "Colaboradores view clients"
      ON public.clients
      FOR SELECT
      USING (private.has_role(auth.uid(), 'colaborador'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='leads'
      AND policyname='Colaboradores view leads'
  ) THEN
    CREATE POLICY "Colaboradores view leads"
      ON public.leads
      FOR SELECT
      USING (private.has_role(auth.uid(), 'colaborador'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='partners'
      AND policyname='Colaboradores view partners'
  ) THEN
    CREATE POLICY "Colaboradores view partners"
      ON public.partners
      FOR SELECT
      USING (private.has_role(auth.uid(), 'colaborador'::app_role));
  END IF;
END $$;
