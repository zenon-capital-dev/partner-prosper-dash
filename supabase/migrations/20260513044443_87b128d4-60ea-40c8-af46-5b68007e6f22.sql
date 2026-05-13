ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_responsible_id_fkey;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.profiles(id) ON DELETE SET NULL;