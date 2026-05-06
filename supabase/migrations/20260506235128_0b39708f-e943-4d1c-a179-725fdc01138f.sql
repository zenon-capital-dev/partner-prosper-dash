-- Table for detailed audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for system settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for audit logs (Admins only)
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies for system settings
CREATE POLICY "Admins can manage system settings"
ON public.system_settings
FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Everyone can view system settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Function to help logging
CREATE OR REPLACE FUNCTION public.log_action(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_value, p_new_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
