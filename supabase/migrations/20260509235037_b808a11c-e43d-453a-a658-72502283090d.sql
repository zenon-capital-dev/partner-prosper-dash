-- Adicionar configurações de SLA na tabela de produtos
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS default_sla_days INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS sla_day_type TEXT DEFAULT 'working' CHECK (sla_day_type IN ('calendar', 'working'));

-- Adicionar campos de controle de SLA na tabela de demandas (client_products)
ALTER TABLE public.client_products
ADD COLUMN IF NOT EXISTS sla_start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS sla_due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'no_prazo' CHECK (sla_status IN ('no_prazo', 'atencao', 'vence_hoje', 'atrasado', 'pausado', 'concluido')),
ADD COLUMN IF NOT EXISTS delay_reason TEXT;

-- Função para calcular data final considerando dias úteis (simplificada)
CREATE OR REPLACE FUNCTION public.calculate_sla_due_date(start_date TIMESTAMP WITH TIME ZONE, days_to_add INTEGER, day_type TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    target_date TIMESTAMP WITH TIME ZONE;
    added_days INTEGER := 0;
BEGIN
    target_date := start_date;
    
    IF day_type = 'calendar' THEN
        RETURN start_date + (days_to_add || ' days')::interval;
    END IF;

    -- Lógica de dias úteis (pula sábados e domingos)
    WHILE added_days < days_to_add LOOP
        target_date := target_date + interval '1 day';
        IF EXTRACT(DOW FROM target_date) NOT IN (0, 6) THEN
            added_days := added_days + 1;
        END IF;
    END LOOP;

    RETURN target_date;
END;
$$ LANGUAGE plpgsql;

-- Trigger para definir o prazo final automaticamente ao criar uma demanda
CREATE OR REPLACE FUNCTION public.set_client_product_sla()
RETURNS TRIGGER AS $$
DECLARE
    p_days INTEGER;
    p_type TEXT;
BEGIN
    SELECT default_sla_days, sla_day_type INTO p_days, p_type 
    FROM public.products WHERE id = NEW.product_id;
    
    IF p_days IS NOT NULL THEN
        NEW.sla_due_date := public.calculate_sla_due_date(NEW.sla_start_date, p_days, COALESCE(p_type, 'working'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_client_product_sla ON public.client_products;
CREATE TRIGGER tr_set_client_product_sla
BEFORE INSERT ON public.client_products
FOR EACH ROW
EXECUTE FUNCTION public.set_client_product_sla();

-- Atualizar produtos existentes com prazos sugeridos pelo usuário
UPDATE public.products SET default_sla_days = 15, sla_day_type = 'working' WHERE name ILIKE '%tributário%';
UPDATE public.products SET default_sla_days = 7, sla_day_type = 'working' WHERE name ILIKE '%contabilidade%';
UPDATE public.products SET default_sla_days = 10, sla_day_type = 'working' WHERE name ILIKE '%jurídico%';
UPDATE public.products SET default_sla_days = 30, sla_day_type = 'calendar' WHERE name ILIKE '%financeira%';
UPDATE public.products SET default_sla_days = 20, sla_day_type = 'calendar' WHERE name ILIKE '%regularização%';
