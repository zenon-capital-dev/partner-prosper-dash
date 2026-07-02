
CREATE TABLE public.profit_reserves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference_month DATE NOT NULL,
  description TEXT,
  category TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profit_reserves TO authenticated;
GRANT ALL ON public.profit_reserves TO service_role;

ALTER TABLE public.profit_reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage profit reserves"
ON public.profit_reserves
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_profit_reserves_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profit_reserves_updated_at
BEFORE UPDATE ON public.profit_reserves
FOR EACH ROW EXECUTE FUNCTION public.update_profit_reserves_updated_at();

CREATE INDEX idx_profit_reserves_month ON public.profit_reserves(reference_month);
