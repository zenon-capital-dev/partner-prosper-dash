-- Recreate notifications table with correct column names for frontend
DROP TABLE IF EXISTS public.notifications;

CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'error', 'success'
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'info',
    p_link TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id, p_title, p_message, p_type, p_link)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger/Function for pending commissions alert
CREATE OR REPLACE FUNCTION public.check_pending_commissions() RETURNS void AS $$
DECLARE
    v_admin_id UUID;
    v_commission RECORD;
BEGIN
    -- Get first admin user
    SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
    
    FOR v_commission IN 
        SELECT c.id, c.amount, p.full_name 
        FROM public.commissions c
        JOIN public.partners p ON c.partner_id = p.id
        WHERE c.status IN ('gerada', 'em_analise', 'aprovada')
        AND c.created_at < now() - interval '7 days'
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications 
            WHERE title = 'Comissão Pendente' 
            AND link = '/commissions'
            AND message LIKE '%' || p.full_name || '%'
            AND created_at > now() - interval '1 day'
        )
    LOOP
        PERFORM public.create_notification(
            v_admin_id,
            'Comissão Pendente',
            'A comissão de ' || v_commission.full_name || ' no valor de R$ ' || v_commission.amount || ' está pendente há mais de 7 dias.',
            'warning',
            '/commissions'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function for overdue documents
CREATE OR REPLACE FUNCTION public.check_overdue_documents() RETURNS void AS $$
DECLARE
    v_admin_id UUID;
    v_doc RECORD;
BEGIN
    SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
    
    FOR v_doc IN 
        SELECT d.id, d.title, c.full_name 
        FROM public.client_document_requests d
        JOIN public.clients c ON d.client_id = c.id
        WHERE d.status = 'pending'
        AND d.due_date < now()
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications 
            WHERE title = 'Documento Atrasado' 
            AND link = '/clients'
            AND message LIKE '%' || d.title || '%'
            AND created_at > now() - interval '1 day'
        )
    LOOP
        PERFORM public.create_notification(
            v_admin_id,
            'Documento Atrasado',
            'O documento "' || v_doc.title || '" do cliente ' || v_doc.full_name || ' está com o prazo vencido.',
            'error',
            '/clients'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
