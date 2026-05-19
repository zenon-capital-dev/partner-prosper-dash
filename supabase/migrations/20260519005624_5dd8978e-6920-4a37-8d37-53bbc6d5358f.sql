-- Add onboarding fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_approval_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMP WITH TIME ZONE;

-- Create onboarding documents table
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewing', 'approved', 'rejected')),
    file_url TEXT,
    file_name TEXT,
    rejection_reason TEXT,
    version INTEGER DEFAULT 1,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create onboarding history
CREATE TABLE IF NOT EXISTS public.onboarding_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_history ENABLE ROW LEVEL SECURITY;

-- Simple, robust policies using auth.jwt() for role check
DO $$ BEGIN
    CREATE POLICY "Onboarding docs: Client view" ON public.onboarding_documents FOR SELECT USING (auth.uid() = client_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Onboarding docs: Client update" ON public.onboarding_documents FOR UPDATE USING (auth.uid() = client_id AND status IN ('pending', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Onboarding docs: Admin full access" ON public.onboarding_documents FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (raw_app_meta_data ->> 'role' = 'admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Onboarding history: Client view" ON public.onboarding_history FOR SELECT USING (auth.uid() = client_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Onboarding history: Admin view" ON public.onboarding_history FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (raw_app_meta_data ->> 'role' = 'admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
