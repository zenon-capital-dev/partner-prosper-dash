ALTER TYPE public.beneficiary_type ADD VALUE IF NOT EXISTS 'service_provider';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'commission_splits'
      AND policyname = 'Provider view own splits'
  ) THEN
    CREATE POLICY "Provider view own splits" ON public.commission_splits
      FOR SELECT TO authenticated
      USING (
        beneficiary_type::text = 'service_provider'
        AND beneficiary_id IN (
          SELECT sp.id FROM public.service_providers sp
          WHERE sp.user_id = auth.uid()
             OR lower(sp.email) = lower((auth.jwt() ->> 'email'))
        )
      );
  END IF;
END $$;