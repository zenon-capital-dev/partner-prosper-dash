# Arrumar o cadastro de cliente (e o que vem junto)

## Diagnóstico do que tá quebrado hoje

Olhando o `ClientFormDialog.tsx` e o banco, achei o seguinte:

1. **Campos de comissão no cliente não geram comissão nenhuma.** Os campos "Comissão parceiro/indicador/colaborador (%)" e "Valor do contrato" são salvos em colunas da tabela `clients`, mas o sistema só gera comissão e split quando existe uma **venda** (`sales`) — pelos triggers `handle_new_sale` e `handle_sale_splits`. Ou seja: preencher comissão no cliente nunca virou comissão nenhuma. Por isso "parceiro/indicador/colaborador não funciona realmente".
2. **"Salvando..." infinito**: quando algo falha depois do insert (ex.: insert em `onboarding_documents`, ou edge function `invite-user` retorna erro de rede sem mensagem clara), o botão fica preso ou exibe toast estranho. Algumas branches saem com `setSubmitting(false)` certinho, outras dependem do toast e o estado de loading não some se o `invoke` travar.
3. **Onboarding não funciona direito**: o form coleta "Etapas Obrigatórias" e "Aprovação Manual", mas isso **não é persistido em lugar nenhum**. `manual_approval_required` é enviado ao `invite-user`, e mesmo assim só funciona se o cliente tiver `user_id` (o que só acontece quando "Criar acesso" está ligado). Sem acesso = nada do onboarding existe.
4. **Comissão quando muda de pendente → pago não divide certo**: o trigger `sync_commission_split_status` só roda quando o status da `commissions` muda; quando o `payments` vira "pago", o `maybe_release_commission` muda `workflow_status` (não `status`), então o split não é marcado como pago. Resultado: split fica eternamente "pendente" mesmo com pagamento confirmado.
5. **Muito campo inútil** no form: `health_score`, `churn_risk`, `tags`, "Engajamento", lista de status com 19 opções, "Comissão (R$)" solto, "Valor do contrato" (que pertence à venda, não ao cliente), `service_provider_id` (delegar prestador é feito por demanda via `DelegateProviderDialog`).

## O que vou fazer

### 1. Simplificar drasticamente o `ClientFormDialog`

Manter só o que faz sentido **para cadastrar um cliente** (dados pessoais + acesso + onboarding). Tudo que é de **venda/comissão** sai daqui e vai pro fluxo de venda (`Sales`), que é onde funciona de verdade.

**Mantém:**
- Dados pessoais: Nome*, Email, Telefone, CPF/CNPJ, Empresa, Nascimento
- Endereço com CEP (lookup automático)
- Origem do cliente, Status (lista enxuta: `novo_cliente`, `ativo`, `inativo`, `cancelado`)
- Parceiro / Indicador / Colaborador responsáveis (só vínculo, **sem campos de %**)
- Observações internas
- Criar acesso ao painel (email + senha, igual hoje)
- Pendências de documentos (templates + customizados) — agora gravando em `onboarding_documents` **mesmo sem user_id**, e aparecendo quando o cliente logar
- Configuração de onboarding (etapas obrigatórias + aprovação manual)

**Remove do form do cliente:**
- Valor do contrato, Comissão (R$), Comissão parceiro %, Comissão indicador %, Comissão colaborador %, Status de pagamento → tudo isso pertence a **Venda**, não a Cliente
- Prestador de serviço (já existe `DelegateProviderDialog` por demanda)
- Engajamento, Risco, Tags (movido para edição na ficha do cliente, não no cadastro)
- Lista de 19 status reduzida pra 4

### 2. Persistir o onboarding de verdade

- Salvar `mandatory_steps` (jsonb) e `manual_approval_required` numa nova coluna em `clients` (não depende de profile/user_id).
- `ClientOnboarding.tsx` passa a ler `mandatory_steps` do cliente e só mostrar as etapas marcadas.
- `complete_client_onboarding()` respeita `manual_approval_required` (se true, marca como `aguardando_aprovacao` ao invés de `completo`).

### 3. Acabar com o "Salvando..." infinito

- Envolver o `submit` em `try/catch/finally`, com `setSubmitting(false)` no `finally` — garantido.
- Timeout de 15s no `supabase.functions.invoke("invite-user")` (Promise.race) — se travar, mostra erro e libera o botão.
- Mesmo padrão aplicado nos outros dialogs de criação que têm `Salvando...` (Produtos, Vendas, Colaboradores, Demandas, Tarefas) — varredura rápida pra padronizar.

### 4. Corrigir o split de comissão quando paga

Migration ajustando o trigger `maybe_release_commission` para, além de mudar `workflow_status`, **também atualizar `status` da commission para `pago` e marcar `paid_at`** quando o payment vira pago. Aí o `sync_commission_split_status` propaga corretamente para `commission_splits`.

Adicionalmente: se o payment volta de pago → pendente, reverter commission para `pendente` e split também.

### 5. Limpar colunas mortas (opcional, não destrutivo)

Não vou dropar colunas do banco (risco de quebrar algo). Apenas paro de gravar/ler campos que ninguém usa. O schema fica "sujo" mas estável; podemos limpar depois com calma.

## Arquivos afetados

- `src/components/clients/ClientFormDialog.tsx` — reescrita enxuta
- `src/pages/ClientOnboarding.tsx` — ler `mandatory_steps`
- `supabase/migrations/*` — adicionar `clients.mandatory_steps` + `clients.manual_approval_required`; corrigir trigger `maybe_release_commission`; atualizar `complete_client_onboarding()`
- Varredura: `ProductFormDialog`, `SaleFormDialog`, `CreateCollaboratorDialog`, `TaskFormDialog`, `DemandFormDialog` → padronizar try/finally + timeout no invoke

## Fora de escopo (pra não inchar)

- Reformatar a tabela de listagem de clientes
- Mexer no fluxo de venda em si (só corrige o split)
- Dropar colunas legadas do banco
- Refatorar `DelegateProviderDialog`

Confirma se posso seguir assim? Se quiser que eu mantenha algum campo que estou removendo (ex.: tags no cadastro), me avisa antes.
