
## Objetivo

Consolidar o CRM em torno da entidade **Demanda** (`client_products`) — cada produto contratado por um cliente vira uma demanda independente, com prestador delegado, documentos, checklist, status, prazo, financeiro e histórico próprios. Cada papel (Admin, Cliente, Prestador, Parceiro) só enxerga o que lhe pertence — sem nenhum vazamento de dados entre painéis.

---

## 1. Modelo conceitual (já existente, vamos reforçar)

```text
Cliente ──┐
          │
Parceiro ─┼──► Demanda (client_products) ──► Documentos
          │         │                       ├─► Checklist (steps)
Produto ──┘         │                       ├─► Prestador delegado
                    │                       ├─► Financeiro (payments/commissions)
                    │                       ├─► Contratos
                    └──► Histórico/Atividade└─► Reportes de status
```

Tudo (documento, tarefa, pagamento, contrato, comissão) carrega `client_product_id`. Já temos isso parcialmente — vou garantir cobertura total via RLS.

---

## 2. Portal do Cliente — "Minhas Demandas"

Substitui o painel atual genérico por uma visão por demanda:

- **Home:** lista de demandas contratadas (cards premium, status pill, % checklist, prazo).
- **Detalhe da demanda:** abas
  - Visão geral (prestador responsável, prazo, próximos passos)
  - Documentos **apenas desta demanda** (upload + status)
  - Checklist visível ao cliente
  - Histórico
  - Financeiro (pagamentos desta demanda)
- Cliente **nunca** vê documentos de outra demanda nem outros clientes.

## 3. Portal do Prestador — "Demandas Delegadas"

- Lista somente `client_products` onde `service_provider_id = (sp do user)`.
- Abre a página de demanda em modo prestador:
  - Documentos da demanda (read + upload de entregáveis)
  - Checklist (marcar etapas)
  - Reportar status
  - Comentários internos
- **Sem** acesso a comissões, parceiro, outras demandas do cliente.

## 4. Portal do Parceiro — "Indicados & Comissões"

- Lista clientes onde `partner_id = parceiro_atual`.
- Para cada cliente: demandas vinculadas (apenas título/status/valor — sem documentos).
- Aba comissões já existe — garantir filtro por `partner_id`.

## 5. Portal Admin — visão completa

- Já tem `/cockpit`, `/demandas`, `/clientes/:id`. Vou conectar o **Delegar Prestador** direto na demanda e garantir que abrir uma demanda mostre todos os blocos (helpers `demand.loadAll` já prontos em `src/lib/demand.ts`).

---

## 6. Segurança (RLS) — auditoria e correções

Vou rodar uma migration que garante:

- `documents`: SELECT permitido se
  - admin, OU
  - cliente dono (`client.user_id = auth.uid()`), OU
  - prestador delegado (`is_delegated_provider(auth.uid(), client_product_id)`).
- `client_products`: mesma regra.
- `client_product_steps`, `client_product_status_reports`, `demand_comments`, `tasks` (quando `client_product_id` not null), `payments`: idem.
- `commissions` / `commission_splits`: parceiro só vê o próprio `partner_id`.
- Trigger já existe para forçar `client_product_id` em documents — manter.

## 7. Design — "nada comum"

Direção visual única por portal, mantendo o design system:

- **Admin:** denso, tipo cockpit (já em andamento).
- **Cliente:** layout em "linha do tempo" da demanda, com cards grandes, ícones de etapa, gradientes suaves.
- **Prestador:** visão "fila de trabalho" estilo Kanban + cronômetro de SLA.
- **Parceiro:** dashboard com gráfico de funil (indicados → contratos → comissões pagas).

Vou propor 3 direções via prototype para o portal do Cliente (o mais visual) antes de implementar — para você escolher.

---

## Entregáveis técnicos

1. Migration RLS unificada para documentos/demanda/financeiro por papel.
2. Refator `ClientPanel`: lista de demandas + nova página `/cliente/demandas/:id`.
3. Refator `ProviderPanel`: fila de demandas delegadas + reuso de `DemandDetail` em modo prestador.
4. Refator `PartnerPanel`: indicados + comissões filtradas.
5. Hook `useDemandAccess(demandId)` central para decidir o que mostrar por papel.
6. Após aprovação do plano: gerar 3 direções visuais para o portal do Cliente via `design--create_directions`.

---

## Pergunta antes de implementar

- O cliente faz **upload** de documentos por demanda, ou apenas **visualiza** o que o admin/prestador anexa? (afeta UI e RLS de INSERT)
- O parceiro pode ver o **status das demandas** dos indicados, ou só "fechou/não fechou"?
