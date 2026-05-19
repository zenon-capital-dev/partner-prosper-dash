
## Objetivo

Garantir que toda criação (Cliente, Lead, Colaborador, Indicador/Referrer, Prestador, Parceiro) salve corretamente, que os vínculos cliente ↔ parceiro / indicador / colaborador / prestador se propaguem para todos os painéis (Admin, Painel do Cliente, Colaborador, Prestador, Indicador, Parceiro), e que isso esteja coberto por testes automatizados.

---

## Bugs identificados na auditoria

1. **Cliente → Prestador não aparece no painel do prestador até ter demanda.**
   `ClientFormDialog` grava `clients.service_provider_id`, mas o `ProviderPanel` consulta apenas `client_products.service_provider_id`. Não há trigger que copie `clients.service_provider_id` para o `client_products` ao criar/atualizar.

2. **Trocar o prestador padrão de um cliente não atualiza as demandas existentes.**
   Existe `propagate_client_collaborator` para `collaborator_id`, mas não há equivalente para `service_provider_id`.

3. **Tela "Detalhes do cliente" (Overview) não mostra o Indicador (referrer).**
   Mostra Parceiro, Colaborador e Prestador, mas o referrer é exibido junto do "Parceiro/Indicador" usando `client.partners?.full_name`, que sempre vem do `partner_id` — quando só há `referrer_id`, aparece "Nenhum".

4. **Falta tela visível no painel do prestador para clientes vinculados sem demanda ainda.**
   Hoje o prestador só "existe" para o cliente via demandas; corrigir os triggers (item 1) resolve isso.

5. **Falta cobertura de testes.** Os fluxos de criação e vinculação não têm testes automatizados.

---

## Correções

### 1. Banco (migração SQL)

- Função `fill_client_product_provider()` + trigger `BEFORE INSERT` em `client_products`:
  preenche `service_provider_id` a partir de `clients.service_provider_id` quando nulo.
- Função `propagate_client_provider()` + trigger `AFTER UPDATE OF service_provider_id` em `clients`:
  atualiza `client_products.service_provider_id` em demandas que estavam apontando para o prestador anterior (ou nulas).
- RLS de `client_products` — confirmar que o prestador (`is_provider_owner(auth.uid(), service_provider_id)`) lê suas demandas (já existe).

### 2. Frontend

**`src/components/clients/tabs/ClientOverview.tsx`**
- Buscar e exibir o Indicador (referrer) separadamente do Parceiro:
  - "Parceiro" usa `client.partners?.full_name`.
  - "Indicador" busca em `referrers` por `client.referrer_id` e exibe.
- Garantir que Colaborador / Prestador / Indicador / Parceiro apareçam todos no card de vínculos.

**`src/components/clients/ClientFormDialog.tsx`**
- Após salvar, invalidar todas as queries afetadas:
  `["clients"]`, `["client", id]`, `["collab-*"]`, `["provider-*"]`, `["referrer-*"]`, `["partner-*"]`, `["demands"]`, `["tasks"]`, `["commissions"]`.

**`src/pages/ClientDetail.tsx`**
- Trazer `referrer_id` e o relacionamento `referrers(full_name)` no select inicial do cliente, para a UI ter os dados sem precisar de fetch extra.

### 3. Testes automatizados (Vitest + Testing Library)

Mock leve do `supabase-js` (uma `MockSupabase` em `src/test/mocks/supabase.ts`) que simula tabelas em memória com chains `.from().select/insert/update/delete().eq()` para os casos usados nos forms. Reutilizar em todos os testes.

**Suite de criação** (`src/test/forms/`):
- `client-form.test.tsx` — renderiza `ClientFormDialog`, preenche dados, vincula parceiro+indicador+colaborador+prestador; verifica chamadas `insert` com IDs corretos e `update responsible_employee_id` nas demandas.
- `lead-form.test.tsx` — cria lead com indicador/colaborador; verifica payload.
- `provider-form.test.tsx` — cria prestador; verifica que aparece como opção em `ClientFormDialog` no próximo render.
- `collaborator-form.test.tsx` — cria colaborador (profile + user_roles).
- `indicator-form.test.tsx` — cria referrer com pix_key, document, commission_percent.

**Suite de vinculação** (`src/test/linking/`):
- `client-to-collaborator.test.ts` — cria cliente com `collaborator_id`; simula a propagação (mock do trigger) e valida que aparece em `assignedClients` do `CollaboratorPanel` e nas demandas.
- `client-to-provider.test.ts` — cria cliente + demanda; valida que `client_products.service_provider_id` é preenchido (mock do trigger novo) e que aparece em `ProviderPanel.clientProducts`.
- `client-to-referrer.test.ts` — cria cliente com `referrer_id`; valida que aparece em `ReferrerPanel.clients`.
- `client-overview-display.test.tsx` — renderiza `ClientOverview` com client mockado vinculado aos 4 papéis; espera que cada nome apareça na tela.

**Smoke do scroll/cleanup (já feito):** `src/test/body-scroll-cleanup.test.ts`.

Rodar com `bunx vitest run` e corrigir o que quebrar.

---

## Arquivos

**Migração**
- Nova migração SQL com as duas funções/triggers (item 1).

**Editados**
- `src/components/clients/tabs/ClientOverview.tsx` — exibe Indicador separado.
- `src/components/clients/ClientFormDialog.tsx` — invalida queries amplas após salvar.
- `src/pages/ClientDetail.tsx` — select inclui `referrer_id` e join `referrers(full_name)`.

**Novos**
- `src/test/mocks/supabase.ts`
- `src/test/forms/*.test.tsx` (5 arquivos)
- `src/test/linking/*.test.ts(x)` (4 arquivos)

---

## Validação final

- `bunx vitest run` → todos passam.
- Abrir preview: criar um cliente vinculado a parceiro + indicador + colaborador + prestador e conferir visualmente que aparece nos 4 painéis e na tela de detalhes do cliente.
- Reportar ao usuário a lista exata de bugs encontrados e corrigidos.

Posso seguir?
