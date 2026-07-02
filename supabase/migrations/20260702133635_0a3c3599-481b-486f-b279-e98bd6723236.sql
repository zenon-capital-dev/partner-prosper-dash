
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reference_month date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill reference_month a partir de expense_date quando ausente
UPDATE public.expenses
  SET reference_month = date_trunc('month', expense_date)::date
  WHERE reference_month IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_reference_month ON public.expenses (reference_month DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid ON public.expenses (paid);

-- Trigger de updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_expenses_updated_at'
  ) THEN
    CREATE TRIGGER trg_expenses_updated_at
      BEFORE UPDATE ON public.expenses
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Garantir grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

-- Política adicional para admin secundário (mantém as existentes)
DROP POLICY IF EXISTS "Admin secundário gerencia despesas" ON public.expenses;
CREATE POLICY "Admin secundário gerencia despesas"
  ON public.expenses
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin_secondary'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin_secondary'::app_role));
