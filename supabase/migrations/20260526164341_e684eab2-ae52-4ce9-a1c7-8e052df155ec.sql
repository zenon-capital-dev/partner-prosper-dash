-- Fix security warning by setting search_path
ALTER FUNCTION public.handle_new_sale() SET search_path = public;
