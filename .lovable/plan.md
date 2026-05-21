# Agenda Unificada — fundir Demandas + Atuações + Tarefas

## Decisão de arquitetura

Hoje existem 3 tabelas com propósitos sobrepostos:

| Tabela | Hoje serve para |
|---|---|
| `client_products` (Demandas) | Serviço vendido ao cliente, com SLA, etapas, status — é uma **entidade de negócio**, não um item de agenda |
| `daily_actions` (Atuações) | Ações comerciais agendadas por dia (ligação, follow-up) |
| `tasks` (Tarefas) | To-do interno com prioridade, responsável, vínculo a qualquer entidade |

**Plano**: consolidar tudo o que é "coisa que precisa ser feita em uma data" em **`tasks`** (já tem todos os campos: `client_id`, `due_date`, `priority`, `assigned_to`, `client_product_id`, `partner_id`, `provider_id`, etc). Demandas (`client_products`) **continuam existindo como entidade própria** (têm SLA, etapas, ligação a vendas/comissões — não dá pra fundir), mas aparecem na nova Agenda como **um tipo de item** ao lado de tarefas e reuniões.

Atuações migram pra `tasks` com tipo `ligacao` — tabela `daily_actions` fica obsoleta (não dropo, só paro de usar).

## 1. Banco (1 migration)

```sql
-- 1. Tipos novos
CREATE TYPE task_kind AS ENUM ('tarefa', 'reuniao', 'ligacao', 'pendencia_documento', 'lembrete', 'follow_up');

-- 2. Estender tasks
ALTER TABLE tasks 
  ADD COLUMN kind task_kind NOT NULL DEFAULT 'tarefa',
  ADD COLUMN location text,           -- pra reuniões (endereço/link)
  ADD COLUMN meeting_url text,        -- link Meet/Zoom
  ADD COLUMN duration_minutes int,    -- duração estimada
  ADD COLUMN reminder_minutes int,    -- avisar X min antes
  ADD COLUMN visible_to_client boolean DEFAULT false,
  ADD COLUMN outcome text;            -- resultado (pra ligações/reuniões pós-execução)

CREATE INDEX idx_tasks_kind ON tasks(kind);
CREATE INDEX idx_tasks_due_client ON tasks(due_date, client_id);

-- 3. Backfill daily_actions → tasks
INSERT INTO tasks (title, kind, client_id, client_product_id, due_date, priority, status_new, assigned_to, created_by, description, outcome, completed_at)
SELECT 
  'Ligação / contato', 'ligacao'::task_kind, client_id, client_product_id, scheduled_date::timestamptz, 
  priority::text, 
  CASE status WHEN 'executada' THEN 'concluido' WHEN 'cancelada' THEN 'cancelado' ELSE 'a_fazer' END::task_status_new,
  assigned_to, created_by, notes, COALESCE(result, execution_notes), executed_at
FROM daily_actions
WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.kind = 'ligacao' AND t.client_id = daily_actions.client_id AND t.due_date = daily_actions.scheduled_date::timestamptz);

-- 4. Trigger pra notificar quando vencendo hoje (cron job às 8h)
-- + reuso do notify_on_task_assign existente
```

## 2. Página única `/agenda`

Substitui no menu lateral: **Tarefas** e **Atuações** (Demandas continua com sua página separada, porque tem fluxo próprio de SLA/etapas/kanban de produção). A Agenda inclui demandas como **referência cruzada** (ver linha "Demanda XYZ: próximo prazo dia tal").

**Views (tabs no topo)**:
1. **Hoje** — agrupado por horário, destaque pro que está atrasado em vermelho no topo
2. **Esta semana** — timeline horizontal seg→dom
3. **Atrasados** — só o que passou e não tá concluído
4. **Próximos** — 30 dias à frente
5. **Calendário** — mês cheio, eventos clicáveis
6. **Kanban** — colunas a_fazer / em_andamento / aguardando / concluído
7. **Concluídos** — histórico com busca + filtro de período

**Filtros sempre visíveis**: tipo (tarefa/reunião/ligação/pendência doc), cliente, responsável, prioridade, "só meus".

**Card de item** (compacto, legível):
- Pill com ícone+cor do tipo (📋 tarefa, 📅 reunião, 📞 ligação, 📄 pendência doc)
- Título + cliente (com link pra ficha)
- Horário + duração se houver
- Responsável (avatar)
- Badge SLA: "Hoje 14h" / "Atrasou 2 dias" / "Em 3 dias"
- Ações inline: ✓ Concluir | ⏰ Reagendar | ✏️ Editar | 🗑️

**Botão "Criar" único** abre dialog com:
- Tipo (radio): Tarefa / Reunião / Ligação / Pendência de documento / Lembrete
- Campos dinâmicos por tipo:
  - Reunião → data+hora, duração, local/link, participantes
  - Ligação → cliente obrigatório, melhor horário, notas
  - Pendência doc → cliente, qual documento (lista de templates + custom), prazo
  - Tarefa → genérica
- Vincular a cliente (autocomplete) — quando preenchido, aparece automaticamente na ficha do cliente
- Responsável (default = eu)
- Prioridade
- Lembrete (opção: 15min / 1h / 1 dia antes — gera notificação)

## 3. Linha do tempo no ClientDetail

Nova aba **"Atividades"** no `ClientDetail.tsx` agregando, em ordem cronológica reversa:
- Reuniões realizadas/agendadas
- Ligações com resultado
- Documentos solicitados/recebidos
- Demandas iniciadas/concluídas
- Pagamentos / contratos assinados (do audit log já existente)

Botão "+ Agendar reunião" / "+ Pedir documento" inline na aba.

## 4. Notificações

- Trigger ao criar/atribuir → já existe (`notify_on_task_assign`)
- Cron diário 8h: notifica responsável dos itens **do dia** e dos **atrasados**
- `reminder_minutes` antes do evento (reunião): notifica em tempo real via Edge Function chamada por pg_cron

## 5. Rotas e menu

- `/agenda` — nova página
- `/tarefas` → redirect `/agenda`
- `/atuacoes` → redirect `/agenda?tipo=ligacao`
- `/demandas` continua igual (fluxo de produção é diferente)
- Sidebar passa a ter: **Demandas** + **Agenda** (em vez de Demandas+Atuações+Tarefas)
- QuickCreate: "Nova Tarefa" + "Nova Reunião" + "Nova Ligação" + "Pedir documento"

## 6. Detalhe de implementação

| Arquivo | Ação |
|---|---|
| Migration nova | enum, colunas, índices, backfill |
| `src/pages/Agenda.tsx` | **nova** página com 7 views |
| `src/components/agenda/AgendaItemCard.tsx` | card universal |
| `src/components/agenda/CreateAgendaItemDialog.tsx` | dialog único com switch de tipo |
| `src/components/agenda/AgendaCalendar.tsx` | view mês |
| `src/components/agenda/AgendaWeek.tsx` | view semana |
| `src/components/agenda/AgendaKanban.tsx` | view kanban |
| `src/components/clients/tabs/ClientTimelineTab.tsx` | **nova** aba no ClientDetail |
| `src/App.tsx` | rota /agenda + redirects |
| `src/components/admin/AdminSidebar.tsx` | remove Tarefas/Atuações, adiciona Agenda |
| `src/pages/Tasks.tsx`, `src/pages/Atuacoes.tsx` | mantidos por compatibilidade interna mas sem link no menu (podem ser apagados depois) |
| `src/components/QuickCreateButton.tsx` | adiciona Reunião + Pedir doc |
| Cron job (pg_cron) | aviso diário de pendências do dia |

## Fora de escopo

- Não migrar demandas (`client_products`) — entidade diferente, mantém fluxo próprio
- Não dropar `daily_actions` agora — só backfill + parar de escrever; remoção em migration futura
- Integração com Google Calendar / Outlook (pode vir depois)

Posso executar?
