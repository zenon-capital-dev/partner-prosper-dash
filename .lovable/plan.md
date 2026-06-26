## Auditoria + finalização dos 15 pontos

A maior parte (1–5, 7, 9–15) já foi entregue em sprints anteriores. Este plano: (a) audita o que está vivo, (b) fecha os 3 gaps reais que sobraram, (c) faz checagem 100% antes de devolver.

### Status atual de cada ponto

| # | Tema | Estado | Ação |
|---|------|--------|------|
| 01 | Painel de metas comercial | ✅ Pronto (`/sales-goals` + `GoalsPanel` no Dashboard) | Verificar |
| 02 | Caixinhas Zenon/Escritório/Funcionários | ✅ Pronto (`/caixinhas` + presets) | Verificar |
| 03 | Upload de doc no acesso do cliente (Email/WhatsApp) | ✅ Pronto (`source` em `ClientDocuments`) | Verificar |
| 04 | Compartilhar demanda anônima com prestadores | ✅ Pronto (`demand_shares` + `DemandShareDialog`) | Verificar |
| 05 | Acesso só-meu (super admin) | ✅ Pronto (role `super_admin` + guard em `/usuarios`) | Verificar |
| **06** | **Notificações por e-mail** | ❌ **GAP — só notifica in-app hoje** | **Implementar** |
| 07 | Agenda no parceiro comercial | ✅ Pronto (`PartnerPanel` aba Agenda) | Verificar |
| **08** | **Acessos não se conversam (prestador/parceiro/cliente)** | ⚠️ **Parcial — falta hub unificado de demanda** | **Implementar** |
| 09 | Prestador solicita doc/info ao cliente sem aprovação | ✅ Pronto (`RequestDocumentDialog` + `demand_requests`) | Verificar |
| 10 | Esteira de atendimento | ✅ Pronto (`/esteira` Kanban + conversão lead→cliente) | Verificar |
| 11 | Receita mensal vs na cabeça + vigência | ✅ Pronto (`revenue_type`, parcelas MRR, mapa empilhado) | Verificar |
| 12 | Ações à esquerda do status em Vendas | ✅ Pronto | Verificar |
| 13 | Painel de metas no Dash + status "Fechado" | ✅ Pronto (`GoalsPanel` + `is_closed` automático) | Verificar |
| 14 | Venda só conta quando finalizada | ✅ Pronto (`closed_at` + trigger) | Verificar |
| 15 | Caixinha de projetos com valor arrecadado | ✅ Pronto (`project_id` em vendas + trigger de crédito) | Verificar |

### Gaps a fechar nesta entrega

**Gap 1 — Ponto 06: notificações por e-mail**
- Recomendar **Lovable Emails** (built-in) ou usar conector **Resend** (workspace já pode estar conectado).
- Criar edge function `send-email-notification` que dispara quando uma `notifications` é inserida (trigger `pg_net` → função).
- Tabela `email_preferences` por usuário com toggle por tipo (demand_request, document, contract, sale, lead, commission, task).
- Tela em **Configurações → Notificações** para o usuário ligar/desligar canais.
- Template HTML base com logo/título/CTA → link interno.

**Gap 2 — Ponto 08: hub unificado de demanda**
- Criar componente `DemandHub` reutilizável que aparece em 3 painéis (cliente, parceiro, prestador) mostrando **a mesma timeline** da demanda: comentários (`demand_comments`), pedidos (`demand_requests`), docs (`documents`), status reports.
- No painel do cliente: aba "Minhas Demandas" → ao abrir, ver tudo num feed só, com identidade dos participantes mascarada conforme `demand_shares` (prestadores anônimos entre si).
- Reaproveita as tabelas que já existem; é um agregador de UI, não schema novo.

**Gap 3 — Verificação 100%**
- Rodar `supabase--linter` para erros de segurança/schema.
- Smoke test via Playwright headless: login admin, abrir `/dashboard`, `/esteira`, `/caixinhas`, `/sales-goals`, `/financeiro` (Mapa), `/vendas` com filtro MRR, criar uma venda recorrente com projeto vinculado, e capturar screenshots.
- Checar TS via `tsgo` automático no build.
- Listar warnings residuais conhecidos (Supabase: HIBP/OTP) que dependem de toggle do usuário.

### Detalhes técnicos (Gap 1 — e-mail)

```text
notifications INSERT
   └─ trigger pg_net → POST edge fn /send-email-notification
                              ├─ checa email_preferences[user_id][type]
                              ├─ busca auth.users.email
                              └─ Resend gateway: from=Zenon <no-reply@…>, html template
```

Tabelas:
- `email_preferences(user_id PK, demand_request bool, document bool, contract bool, sale bool, lead bool, commission bool, task bool, marketing bool default false)` — defaults `true` exceto marketing.

Edge function: `supabase/functions/send-email-notification/index.ts` usando o conector Resend (gateway Lovable).

### Detalhes técnicos (Gap 2 — hub)

- `src/components/demands/DemandHub.tsx`: props `{ clientProductId, viewerRole }`.
- Tabs internas: **Conversa** (comments+requests intercalados por data), **Documentos**, **Status**, **Participantes** (mascarado se viewerRole=prestador e share anônimo).
- Embutir em: `ClientPanel` (já tem demandas), `PartnerPanel`, `ProviderPanel` aba "Atuação", `ClientDetail` (admin vê tudo cru).

### Saída esperada

- 2 migrações novas (email_preferences + trigger pg_net opcional).
- 1 edge function nova.
- 1 componente novo + 4 integrações.
- Screenshots de smoke test anexados na resposta.
- Lista final do que ficou 100% e do que depende de ação do usuário (ex: conectar Resend, ativar HIBP).

### Confirmações necessárias antes de implementar

1. **E-mail (ponto 06):** posso usar **Resend** via conector Lovable? (alternativa: Lovable Emails built-in). Se sim, o domínio `from` será `onboarding@resend.dev` até você verificar domínio próprio.
2. **Hub de demanda (ponto 08):** ok manter as 3 abas existentes e só adicionar o `DemandHub` como aba "Visão unificada", ou prefere substituir as abas atuais pelo hub?
