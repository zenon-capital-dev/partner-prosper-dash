
CREATE OR REPLACE FUNCTION public.sales_set_closed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM 'concluida') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  IF NEW.status::text <> 'concluida' THEN
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.sales
   SET closed_at = COALESCE(paid_at, updated_at, created_at)
 WHERE status::text = 'concluida' AND closed_at IS NULL;
