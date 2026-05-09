-- 1. Ampliar a tabela de produtos com campos de template adicionais
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS recommended_provider_type TEXT,
ADD COLUMN IF NOT EXISTS recommended_contract_model_id UUID, -- Referência futura se houver tabela de modelos
ADD COLUMN IF NOT EXISTS initial_status TEXT DEFAULT 'aguardando_inicio',
ADD COLUMN IF NOT EXISTS client_welcome_message TEXT,
ADD COLUMN IF NOT EXISTS provider_welcome_message TEXT,
ADD COLUMN IF NOT EXISTS custom_fields_template JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS auto_tasks_template JSONB DEFAULT '[]'::jsonb;

-- 2. Garantir que as tabelas de destino existam para a automação (já existem: client_product_steps, document_requests)

-- 3. Função para popular automaticamente uma nova demanda (client_products)
CREATE OR REPLACE FUNCTION public.populate_client_product_from_template()
RETURNS TRIGGER AS $$
DECLARE
    p_record RECORD;
    step_item JSONB;
    doc_item JSONB;
    task_item JSONB;
    v_pos INTEGER := 0;
BEGIN
    -- Pegar dados do template do produto
    SELECT * INTO p_record FROM public.products WHERE id = NEW.product_id;
    
    IF p_record.id IS NOT NULL THEN
        -- Definir status inicial e mensagens se não informados
        NEW.status := COALESCE(NEW.status, p_record.initial_status, 'aguardando_inicio');
        
        -- Inserir Checklist Padrão (standard_steps)
        IF p_record.standard_steps IS NOT NULL AND jsonb_array_length(p_record.standard_steps) > 0 THEN
            FOR step_item IN SELECT jsonb_array_elements(p_record.standard_steps) LOOP
                INSERT INTO public.client_product_steps (
                    client_product_id,
                    label,
                    position,
                    status
                ) VALUES (
                    NEW.id,
                    step_item->>'label',
                    v_pos,
                    'pending'
                );
                v_pos := v_pos + 1;
            END LOOP;
        END IF;

        -- Inserir Documentos Necessários (required_documents)
        IF p_record.required_documents IS NOT NULL AND jsonb_array_length(p_record.required_documents) > 0 THEN
            FOR doc_item IN SELECT jsonb_array_elements(p_record.required_documents) LOOP
                INSERT INTO public.documents (
                    client_id,
                    client_product_id,
                    name,
                    status,
                    category
                ) VALUES (
                    NEW.client_id,
                    NEW.id,
                    doc_item->>'name',
                    'solicitado',
                    'obrigatorio'
                );
            END LOOP;
        END IF;
        
        -- Inserir Tarefas Automáticas (auto_tasks_template)
        IF p_record.auto_tasks_template IS NOT NULL AND jsonb_array_length(p_record.auto_tasks_template) > 0 THEN
            FOR task_item IN SELECT jsonb_array_elements(p_record.auto_tasks_template) LOOP
                INSERT INTO public.tasks (
                    title,
                    description,
                    status,
                    priority,
                    related_type,
                    related_id,
                    user_id
                ) VALUES (
                    task_item->>'title',
                    task_item->>'description',
                    'todo',
                    (task_item->>'priority')::public.demand_priority,
                    'client_product',
                    NEW.id,
                    auth.uid()
                );
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para execução após a inserção (para ter o ID da demanda)
DROP TRIGGER IF EXISTS tr_populate_client_product ON public.client_products;
CREATE TRIGGER tr_populate_client_product
AFTER INSERT ON public.client_products
FOR EACH ROW
EXECUTE FUNCTION public.populate_client_product_from_template();

-- 4. Popular exemplo: Tributário
UPDATE public.products 
SET 
    required_documents = '[
        {"name": "Contrato social"},
        {"name": "Cartão CNPJ"},
        {"name": "Notas fiscais dos últimos 12 meses"},
        {"name": "Extratos bancários"},
        {"name": "Apurações anteriores"},
        {"name": "Guias pagas"}
    ]'::jsonb,
    standard_steps = '[
        {"label": "Conferir documentos"},
        {"label": "Analisar regime tributário"},
        {"label": "Verificar impostos pagos"},
        {"label": "Identificar oportunidades"},
        {"label": "Montar parecer"},
        {"label": "Enviar relatório final"}
    ]'::jsonb,
    default_sla_days = 15,
    sla_day_type = 'working',
    initial_status = 'aguardando_inicio',
    client_welcome_message = 'Seja bem-vindo ao serviço Tributário. Já solicitamos os documentos iniciais para análise.',
    provider_welcome_message = 'Uma nova demanda tributária foi delegada a você. Por favor, revise o checklist inicial.',
    auto_tasks_template = '[
        {"title": "Validar Documentos Iniciais", "description": "Verificar se todos os documentos obrigatórios foram anexados corretamente.", "priority": "normal"}
    ]'::jsonb
WHERE name ILIKE '%tributário%';
