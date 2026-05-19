# Plano de execução

Vou dividir em 4 frentes. Tudo entra em um único ciclo de implementação, com verificação ao final.

## 1. Testes automatizados de isolamento por colaborador

Configurar Vitest + Testing Library (se ainda não estiver) e criar suíte de testes de RLS direto no banco usando `supabase-js` com JWT de usuários de teste.

**Arquivos novos:**
- `vitest.config.ts`, `src/test/setup.ts` (se não existirem)
- `src/test/rls/collaborator-isolation.test.ts` — cria 2 colaboradores fake via service role, cria clientes/demandas/tasks vinculados a cada um, autentica como cada colaborador e valida:
  - `clients`: só vê os próprios (via `collaborator_id` ou demanda atribuída)
  - `client_products`: só vê onde `responsible_employee_id = auth.uid()`
  - `tasks`: só vê onde `assigned_to = auth.uid()`
  - `commissions` / `commission_splits`: só vê onde `beneficiary_id = auth.uid()` quando `beneficiary_type='collaborator'`
  - `sales`: só vê onde `collaborator_id = auth.uid()`
  - `documents`: só vê documentos de demandas dele
  - Contadores do dashboard batem com os registros visíveis
- `src/test/rls/admin-write-flow.test.ts` — simula o fluxo completo como admin (registrar cliente → vincular colaborador + prestador → criar demanda → criar venda → conferir propagação automática via triggers)
- `src/test/helpers/test-users.ts` — helper para criar/limpar usuários de teste com `SUPABASE_SERVICE_ROLE_KEY`

**Política de execução:** rodar em banco de teste (skip se `SUPABASE_SERVICE_ROLE_KEY` não estiver presente no env local).

## 2. Auditoria + correção dos bugs encontrados pelos testes

Cada falha vira correção imediata:
- RLS faltando em alguma tabela → migration adicional
- Trigger de propagação não disparando → ajuste no trigger
- Contadores do `CollaboratorPanel` somando registros que não deviam → corrigir queries com `.or('collaborator_id.eq...,responsible_id.eq...')`
- Comissões: garantir que `commission_splits` para `beneficiary_type='collaborator'` aparecem em `/colaborador/comissoes` (criar a aba se não existir)

## 3. Máscaras profissionais BR

Criar utilitários reutilizáveis e aplicar em **todos** os formulários (Clientes, Leads, Parceiros, Prestadores, Colaboradores, Perfil):

**Arquivos novos:**
- `src/lib/masks.ts` — funções `maskCPF`, `maskCNPJ`, `maskCPFCNPJ` (auto-detect), `maskCEP`, `maskPhoneBR` (fixo + celular 9 dígitos), `maskCurrencyBR`, `unmask`
- `src/lib/validators.ts` — `isValidCPF`, `isValidCNPJ`, `isValidCEP`, `isValidPhoneBR` (algoritmo de dígitos verificadores reais, não só regex)
- `src/components/ui/masked-input.tsx` — wrapper de `<Input>` que aceita `mask="cpf|cnpj|cpfcnpj|cep|phone|currency"`
- Integração com schemas Zod já existentes (refine com validators)
- Auto-fill de endereço via ViaCEP ao completar 8 dígitos no CEP

**Arquivos editados:** `ClientFormDialog.tsx`, `LeadFormDialog.tsx`, `PartnerFormDialog.tsx`, `ProviderFormDialog.tsx`, `EmployeeFormDialog.tsx`, `Perfil.tsx`, `ClienteOnboarding.tsx`.

## 4. Redesign Leads + Criar Cliente

Manter o tema admin claro premium (Linear/Attio/Stripe) que está na memória do projeto. Não tocar em paleta/fontes — só elevar composição:

**`/admin/leads`:**
- Header com busca proeminente + filtros como chips removíveis (não dropdowns soltos)
- Toggle Kanban/Tabela mais elegante (segmented control)
- Cards do Kanban: avatar do lead, badge de origem colorida, valor estimado em mono, próxima ação com ícone, footer com dias na coluna
- Coluna com contador + valor total no topo
- Empty states ilustrativos

**`ClientFormDialog`:**
- Dialog vira wizard de 3 passos (Dados básicos → Endereço/Documentos → Vínculos: colaborador, parceiro, prestador) com stepper no topo
- Cada passo com validação antes de avançar
- Resumo no último passo antes de salvar
- Em mobile: vira full-screen sheet com footer fixo

**`LeadFormDialog`:** mesmo padrão de wizard 2 passos (Contato → Qualificação).

---

## Detalhes técnicos

- **Triggers já existentes** (`propagate_client_collaborator`, `fill_client_product_responsible`, `fill_task_assigned_from_demand`) serão validados pelos testes — se houver gap, corrijo via migration.
- **ViaCEP** é endpoint público, sem chave.
- **Testes RLS** usam `createClient` com JWT manual (assinado pelo service role criando usuários temporários) — abordagem padrão pra testar policies sem mock.
- **Stepper** usa componentes existentes do shadcn (Progress + estado local), sem nova dependência.

## Ordem de execução

1. Setup de testes + suíte de isolamento → rodar → coletar falhas
2. Corrigir falhas de RLS/trigger (migrations)
3. Implementar máscaras + validators + aplicar em todos os forms
4. Redesign do Leads (página + kanban)
5. Redesign do ClientFormDialog e LeadFormDialog (wizard)
6. Rodar testes novamente até 100% verde
7. QA visual no mobile (375px) das telas refeitas

Posso seguir?