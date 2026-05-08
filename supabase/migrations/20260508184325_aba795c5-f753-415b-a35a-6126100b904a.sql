-- Create document history table
CREATE TABLE IF NOT EXISTS public.document_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.document_requests(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on document_history
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

-- Policies for document_history
CREATE POLICY "Admin/Vendedor manage history"
ON public.document_history
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Client view own history"
ON public.document_history
FOR SELECT
TO authenticated
USING (
    request_id IN (
        SELECT id FROM public.document_requests 
        WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
);

-- Fix SECURITY DEFINER vulnerabilities by revoking public execute
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;

-- Explicitly allow authenticated users where needed
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Ensure function search paths are set to prevent path hijacking
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.notify_admins(text, text, text, text) SET search_path = public;
