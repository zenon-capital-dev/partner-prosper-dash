
-- 1) onboarding_status: aceitar concluido e aguardando_aprovacao
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_onboarding_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_onboarding_status_check
  CHECK (onboarding_status IS NULL OR onboarding_status = ANY (ARRAY[
    'nao_iniciado','em_andamento','documentos_pendentes',
    'aguardando_validacao','aguardando_aprovacao',
    'completo','concluido'
  ]));

-- 2) contracts.contract_type: aceitar padrao e geral
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_contract_type_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_contract_type_check
  CHECK (contract_type IS NULL OR contract_type = ANY (ARRAY[
    'cliente','parceiro','prestador','produto',
    'termo_servico','procuracao','termo_confidencialidade',
    'padrao','geral'
  ]));
