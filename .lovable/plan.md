
## Tópicos 07–10 — Plano de entrega

### 07 — Agenda no painel do Parceiro
- Reaproveitar o componente `Agenda.tsx` (já usado no admin).
- Criar rota `/parceiro/agenda` em `App.tsx` dentro do `PartnerPanel`.
- Adicionar item "Agenda" na sidebar do parceiro (`PartnerSidebar.tsx`).
- Ajustar a página Agenda para filtrar tasks/eventos do parceiro logado quando ele não for admin (`partner_id` vinculado ao user via tabela `partners.user_id` → clientes desse parceiro).
- Permitir ao parceiro criar tarefa apenas para clientes da carteira dele.

### 08 — Integração de acessos (cliente ⇄ parceiro ⇄ prestador)
Objetivo: cada ator vê em um lugar só as demandas onde está envolvido, com comunicação cruzada.
- Criar componente `SharedDemandView.tsx` reutilizável que mostra: status, documentos, conversas, próximos passos, prestadores envolvidos (anônimo para outros prestadores conforme tópico 04).
- Padronizar o cabeçalho da demanda nos três painéis (admin, parceiro, prestador, cliente) com os mesmos campos.
- Adicionar no painel do parceiro a aba "Demandas dos meus clientes" usando o mesmo componente.
- Adicionar no painel do cliente badge "tem prestador trabalhando" quando houver `demand_shares` com status `aceitou`.
- Notificações cruzadas: ao prestador aceitar/atualizar status, notificar cliente + parceiro.

### 09 — Prestador solicita documentos / informação ao cliente
Banco:
- Reusar `documents` (já tem `provider_id`) — permitir prestador inserir `document` com `client_id` + `client_product_id` direto, sem aprovação prévia. Atualizar policy de INSERT.
- Criar tabela `demand_requests` (tipo "chamado/solicitação" entre prestador/parceiro/cliente):
  - `id, client_product_id, requested_by (uuid), requested_role (text), target_role (text: cliente|prestador|parceiro|admin), kind (documento|informacao|duvida), title, description, status (aberta|respondida|resolvida|cancelada), response, responded_by, responded_at, created_at, updated_at`.
  - RLS: envolvidos na demanda (cliente dono, prestador via `demand_shares` ou `client_products.service_provider_id`, parceiro via `clients.partner_id`, admin) podem ler/escrever.
  - Trigger gera notificação para o `target_role`.
- UI:
  - Componente `DemandRequestsPanel.tsx` (lista + criar + responder) reutilizável.
  - Integrar na aba demanda do prestador (`/prestador`), do cliente (`/portal-cliente`) e do parceiro.

### 10 — Esteira de atendimento (pipeline)
Banco:
- Reusar `product_steps` (estrutura já existe) mas adicionar tabela `client_journey_stages` para a esteira global do cliente (não por produto):
  - `id, name, position, color, is_terminal, description, created_at`.
- Adicionar `clients.journey_stage_id` (FK opcional) e `clients.journey_updated_at`.
- Trigger: ao mover de stage, gravar em `client_timeline`.
- Seed inicial: Captação → Diagnóstico → Proposta → Onboarding → Em atendimento → Entrega → Pós-venda.

UI:
- Nova página `src/pages/ClientJourney.tsx` no admin (rota `/esteira`), em formato Kanban com colunas = stages, cards = clientes (arrastar para mover).
- Configurar stages em `Settings` (nova aba "Esteira").
- Mostrar stage atual no header do `ClientDetail.tsx` e no portal do cliente (barra de progresso).

### Ordem de execução
1. Migração: `demand_requests`, `client_journey_stages`, `clients.journey_stage_id`, policies, triggers, seed.
2. Hooks/queries.
3. Componentes (`DemandRequestsPanel`, `ClientJourney`, `SharedDemandView`).
4. Rotas + sidebars (parceiro agenda, esteira admin).
5. Integração em painéis cliente/parceiro/prestador.

### Observações
- Aceitação: parceiro **comercial full na carteira** = parceiro com flag `is_full_carteira` em `partners`. Vou adicionar o campo e usá-lo para liberar criar/editar tasks da agenda.
- Email continua fora do escopo, conforme combinado.
- Sem alterar visual; manter tema claro premium do admin.

Confirma para eu começar pela migração?
