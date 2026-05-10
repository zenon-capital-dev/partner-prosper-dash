ALTER TABLE public.clients ADD COLUMN health_score INTEGER DEFAULT 100;
ALTER TABLE public.clients ADD COLUMN churn_risk TEXT DEFAULT 'Baixo';