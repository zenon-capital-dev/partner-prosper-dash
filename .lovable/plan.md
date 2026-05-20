## Diagnóstico atual

Auditei o código dos 8 formulários (Lead, Cliente, Venda, Serviço, Parceiro, Prestador, Indicador, Colaborador) contra o schema do banco e as policies RLS.

**Resultado da auditoria estática:**
- Schema: todas as colunas que os forms enviam EXISTEM nas respectivas tabelas.
- RLS: usuário admin (seu caso) tem policies `ALL` em todas as tabelas relevantes.
- Triggers: os triggers de venda → comissão/pagamento/client_product já estão em produção e validados.

Ou seja, estruturalmente nada está obviamente quebrado. Sem um erro concreto (mensagem, campo específico, passo que falha), corrigir "tudo" às cegas pode introduzir regressões. Por isso a próxima rodada precisa ser baseada em **teste real** em vez de re-escrita preventiva.

## O que vou fazer

### 1. Smoke-test automatizado de cada form
Para cada uma das 8 tabelas, vou rodar um INSERT real com o mesmo payload que o frontend envia (cliente com parceiro+indicador+colaborador+prestador, venda com 3 splits, etc.), simulando o admin logado. Qualquer FK quebrada, default ausente, trigger com erro ou coluna faltando aparece aqui.

### 2. Verificação dos dropdowns de vínculo
Para cada form que tem vínculo (cliente→parceiro/indicador/colaborador/prestador, lead→parceiro/produto/indicador, venda→cliente/produto/3 splits), abrir a página real no preview e confirmar que:
- O dropdown LISTA as opções cadastradas
- Ao salvar, o valor escolhido CHEGA na coluna correta
- Ao reabrir a ficha, o vínculo APARECE selecionado

### 3. Correção das falhas encontradas
Para cada falha real (não suposta), uma correção mínima:
- Coluna faltando → migration `ADD COLUMN IF NOT EXISTS`
- Form enviando campo errado → ajuste no payload
- Dropdown vazio → corrigir a query da listagem
- Vínculo não persiste → corrigir o nome da coluna no insert

### 4. Hardening do form de Parceiro (único ponto frágil encontrado na auditoria estática)
`src/pages/Partners.tsx` faz `supabase.from("partners").insert(form)` — joga o objeto inteiro do estado. Se algum dia adicionarmos um campo só-UI, vira erro. Vou trocar por payload explícito com apenas as colunas reais da tabela (`full_name, email, phone, whatsapp, document, pix_key, bank_name, bank_agency, bank_account, partner_category, commission_percent, notes, active, has_system_access`).

## O que NÃO vou fazer agora

- Reescrever forms que já estão alinhados ao schema (não há ganho real)
- Adicionar novas funcionalidades que você não pediu
- Alterar RLS (já está correta para admin)
- Mexer em triggers de venda/comissão (estão funcionando)

## Entrega

Depois de implementar:
1. Lista do que estava efetivamente quebrado e foi corrigido
2. Lista do que foi testado e está OK
3. Se algo continuar com sintoma específico do seu lado, você me passa o erro/passo e eu corrijo cirurgicamente

## Detalhes técnicos

- Smoke-test via `supabase--read_query` + `supabase--insert` simulando admin
- Correções via `supabase--migration` (banco) e edits TS pontuais (frontend)
- Sem mudança de tema/visual — só funcionalidade
