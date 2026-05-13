
CREATE OR REPLACE FUNCTION public.notify_on_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins('Novo documento', COALESCE(NEW.name, '—'), '/documentos', 'document');
  RETURN NEW;
END; $$;
