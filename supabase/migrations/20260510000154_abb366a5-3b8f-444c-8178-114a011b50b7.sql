-- Adicionar campos personalizados na demanda
ALTER TABLE public.client_products
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Adicionar controle de onboarding nos clientes
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'nao_iniciado' CHECK (onboarding_status IN ('nao_iniciado', 'em_andamento', 'documentos_pendentes', 'aguardando_validacao', 'completo')),
ADD COLUMN IF NOT EXISTS onboarding_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Configurar campos personalizados de exemplo para os produtos existentes
UPDATE public.products 
SET custom_fields_template = '[
    {"name": "regime_tributario", "label": "Regime Tributário Atual", "type": "select", "options": ["Simples Nacional", "Lucro Presumido", "Lucro Real"]},
    {"name": "faturamento_medio", "label": "Faturamento Mensal Médio", "type": "number"},
    {"name": "segmento", "label": "Segmento da Empresa", "type": "text"},
    {"name": "debitos_fiscais", "label": "Possui débitos fiscais?", "type": "boolean"}
]'::jsonb
WHERE name ILIKE '%tributária%';

UPDATE public.products 
SET custom_fields_template = '[
    {"name": "numero_funcionarios", "label": "Número de Funcionários", "type": "number"},
    {"name": "usa_erp", "label": "Usa sistema ERP?", "type": "boolean"},
    {"name": "tem_folha", "label": "Tem folha de pagamento?", "type": "boolean"}
]'::jsonb
WHERE name ILIKE '%contabilidade%';
