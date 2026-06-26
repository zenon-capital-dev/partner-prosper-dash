# Plano de Ajustes — Pontos 01 a 15

Diagnóstico em sete grupos. Cada grupo lista o que já existe, o que falta e a ação concreta.

---

## A — Painel de Metas, Esteira e Status "Fechado" (01, 10, 13)

**Estado atual**
- `GoalsPanel` já existe (`src/components/dashboard/GoalsPanel.tsx`) e está montado no `Dashboard.tsx`, mas pode não estar aparecendo por filtro de período / role. Tabela `sales_goals` existe.
- Esteira de atendimento (`/esteira`, `ClientJourney.tsx`, tabela `client_journey_stages`) já criada, mas não está vinculada visualmente ao card do cliente nem ao dashboard.
- Status do cliente não tem o estágio "Fechado" explícito separando MRR vs avulso.

**Ações**
1. Garantir que `GoalsPanel` renderiza no Dashboard para admin/super_admin, com fallback (empty state + CTA "Criar meta") quando não há metas no mês.
2. Adicionar mini-widget "Esteira" no Dashboard mostrando contagem por estágio (link para `/esteira`).
3. Adicionar coluna `is_closed` (boolean) em `clients` + badge "Fechado" no `ClientJourneyBadge` quando o cliente tem ao menos uma venda finalizada.

---

## B — Receita recorrente vs avulsa e data de fechamento (11, 14)

**Estado atual**
- Migration já aplicada: `sales.revenue_type`, `recurrence_months`, `recurrence_start`, `closed_at` + trigger.
- `SaleFormDialog` já gera mensalidades recorrentes.
- `useDashboardStats` já usa `closed_at` para faturamento.

**Ações (refinos pendentes)**
1. Em `Sales.tsx`: adicionar filtro/abas "Recorrente | Avulso | Todas" e coluna visível "Tipo" + "Início recorrência".
2. KPIs do Dashboard: separar três cards — *Faturamento total*, *MRR ativo* (soma de recorrentes finalizadas com `recurrence_start <= hoje <= recurrence_start + recurrence_months`), *Receita na cabeça* (avulsas finalizadas no mês).
3. `FinanceCenter > Mapa de receitas`: empilhar duas séries (recorrente vs avulsa) no heatmap.

---

## C — Caixinhas de Recursos e Projetos (02, 15)

**Estado atual**
- `ResourcePools.tsx` + tabelas `resource_pools` / `resource_pool_movements` já existem com tipo "Projeto".

**Ações**
1. Em `Projects.tsx`: ao abrir um projeto, mostrar caixinha vinculada (saldo, movimentações) e botão "Criar caixinha" se não houver.
2. Adicionar presets rápidos no cabeçalho do `ResourcePools`: "Zenon", "Escritório", "Funcionários" (cria pool com tipo correto em 1 clique).
3. Lançar venda finalizada de um projeto credita automaticamente a caixinha do projeto (trigger DB: ao inserir `payments` com `sale.project_id` setado e `paid_at` não nulo, insere `resource_pool_movements` tipo `entrada`).

---

## D — Documentos, upload pelo admin e compartilhamento (03, 04, 09)

**Estado atual**
- `documents.source` já existe (email/whatsapp/upload).
- `demand_shares` + `DemandShareDialog` criados.
- `demand_requests` + `DemandRequestsPanel` criados (prestador → cliente).

**Ações pendentes**
1. Em `ClientDocuments.tsx`: botão "Anexar em nome do cliente" abrindo `DocumentDialog` com seletor de origem (Email / WhatsApp / Upload manual) e campo "Recebido em".
2. Validar que `DemandShareDialog` está acessível na aba Demandas do cliente (botão "Compartilhar" no card da demanda) e que o link público abre sem revelar outros prestadores (rota `/share/:token` sem listar destinatários).
3. Em `ProviderPanel.tsx`: garantir que `RequestDocumentDialog` envia direto ao cliente sem aprovação intermediária (status inicial = `enviado`, não `pendente_aprovacao`).

---

## E — Acessos, agenda do parceiro e condução do cliente (05, 07, 08)

**Estado atual**
- Role `super_admin` criada.
- `PartnerPanel` tem aba Agenda integrada.

**Ações pendentes**
1. Revisar `PartnerPanel` Agenda: confirmar que usa o mesmo componente `Agenda.tsx` com filtro `responsible_partner_id = auth.uid()`.
2. "Condução do cliente": adicionar barra superior persistente em `ClientDetail.tsx` mostrando estágio atual da esteira + próximo passo sugerido + botão "Avançar estágio".
3. Limitar `/admin/usuarios` a `super_admin` (já feito) e adicionar aviso no topo da página.

---

## F — Notificações por e-mail (06)

**Ação**
1. Em `Settings.tsx` aba "Notificações", expor switches por evento (novo lead, doc recebido, pagamento, demanda atrasada) gravando em `system_settings`.
2. Verificar edge function `process-alerts` — confirmar envio via Resend e logar último disparo.

---

## G — Layout da aba Vendas (12)

**Estado**: já movemos "Ações" para a esquerda de "Status".

**Ação**: confirmar visualmente após deploy e ajustar largura das colunas se necessário (sem nova lógica).

---

## Ordem de execução sugerida

1. **Sprint 1 (rápidas)**: G (confirmar), F (toggles), A.1/A.2 (widgets dashboard), D.1 (upload em nome do cliente).
2. **Sprint 2 (médias)**: B.1/B.2/B.3 (refino recorrente), E.2 (barra de condução), A.3 (status Fechado).
3. **Sprint 3 (estruturais)**: C.1/C.2/C.3 (caixinhas ↔ projetos com trigger), D.2/D.3 (compartilhamento anônimo + prestador→cliente sem aprovação), E.1 (validar agenda parceiro).

## Detalhes técnicos

- Migrations novas: `clients.is_closed`, trigger `payments → resource_pool_movements`, índices em `sales(closed_at, revenue_type)`.
- Componentes novos: `JourneyMiniWidget.tsx`, `ClientJourneyBar.tsx`, `NotificationToggles.tsx`.
- Sem mudanças de tema: manter painel admin claro (Linear/Attio).
- Backup (`full-backup.ts`): adicionar novas colunas automaticamente (já usa `select *`).

Confirma para eu iniciar pela Sprint 1?
