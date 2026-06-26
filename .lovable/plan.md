# Plano de entrega — 5 tópicos

Vou implementar os 5 itens em sequência, cada um isolado num commit lógico. Abaixo o que entra em cada um. **Ignorando envio de e-mail**, conforme combinado.

---

## 01 — Painel de Metas Comerciais (esteira → números)

**O que faz:** painel novo em `/admin/metas-comerciais` (e card no dashboard) que pega a esteira de atendimento (leads → propostas → vendas → clientes ativos) e converte em números vs meta.

**Tabela nova:** `sales_goals` (período mensal, tipo: leads/propostas/vendas/receita, valor_meta, responsável opcional).

**Cálculo (realizado):**
- Leads → `COUNT(leads)` no período
- Propostas → `COUNT(proposals)` 
- Vendas → `COUNT(sales)` + `SUM(sales.amount)`
- Conversão % entre cada etapa

**UI:** cards com barra de progresso (realizado/meta), gauge de conversão por etapa, filtro de mês/responsável. Tema admin claro (Linear/Attio).

---

## 02 — Caixinhas de Recursos (metas Zenon / Escritório / Funcionários)

**O que faz:** "caixinhas" = cofres virtuais com saldo acumulado por finalidade, alimentados por % de receita ou aporte manual.

**Tabela nova:** `resource_pools` (nome, tipo, meta_valor, saldo_atual, regra_alimentacao_json) + `resource_pool_movements` (pool_id, tipo: entrada/saida, valor, descrição, referência).

**UI:** página `/admin/caixinhas` com grid de caixinhas (saldo / meta / %), botão "Lançar movimento", histórico por caixinha. Aporte manual nesta entrega; automação por % de receita fica de gancho preparado (`regra_alimentacao_json`) sem job automático ainda.

---

## 03 — Upload de documentos pelo admin no acesso do cliente

**O que faz:** hoje só o cliente envia. Vou liberar o admin/colaborador a **fazer upload em nome do cliente** dentro da ficha do cliente (`ClientDocumentsTab` / `ClientFichaTabs`) e também na ficha da demanda.

**Mudanças:**
- Botão "Anexar documento recebido (e-mail/WhatsApp)" na aba Documentos do cliente e na demanda.
- Campo `source` em `documents` (`client_upload` | `admin_upload` | `email` | `whatsapp`) para rastrear origem.
- Policy: admin e colaborador responsável podem inserir; cliente continua vendo normal.

Sem mexer em integração de e-mail.

---

## 04 — Demandas compartilhadas com prestadores (anônimo entre eles)

**O que faz:** numa demanda (ex.: crédito), o admin convida N prestadores. Cada prestador vê os documentos e dados da demanda, **mas não vê a lista de outros prestadores convidados**.

**Tabela nova:** `demand_shares` (client_product_id, provider_id, invited_by, status: convidado/visualizou/aceitou/recusou, can_download bool).

**RLS chave:**
- Prestador SELECT em `demand_shares` apenas onde `provider_id = auth.uid()` → ele só enxerga a própria linha, nunca os concorrentes.
- Prestador SELECT em `documents` da demanda via função `security definer` que confere se existe share dele para aquele `client_product_id`.
- Admin enxerga tudo.

**UI:**
- Na demanda: botão "Compartilhar com prestadores" → multi-select de prestadores → cria N shares.
- Painel do prestador: nova aba "Demandas abertas" mostrando shares dele, sem contagem ou nome de outros convidados.

---

## 05 — Super-admin (acesso exclusivo do dono)

**O que faz:** novo papel `super_admin` no enum `app_role`, acima de `admin`. Apenas o super_admin pode:
- Criar/remover outros admins e colaboradores
- Acessar `/admin/usuarios` para gerenciar papéis
- Ver auditoria global

Admin comum perde a capacidade de promover gente a admin (continua operando o resto). O usuário atual (você) é promovido a `super_admin` via migração inicial usando o `auth.uid()` do e-mail informado.

**Pergunta antes de migrar:** preciso do **e-mail da sua conta** para marcar como `super_admin` na migração. Sem isso eu deixo a migração pronta e você me passa o e-mail no próximo turno.

---

## Ordem de execução

1. Migrações SQL (todas as tabelas + enum + policies) em uma leva
2. Item 05 (super_admin) — base de permissões
3. Item 03 (upload admin) — pequeno, libera valor rápido
4. Item 04 (demandas compartilhadas) — backend + UI
5. Item 01 (metas comerciais) — UI nova
6. Item 02 (caixinhas) — UI nova

## Confirmações que preciso antes de codar

1. **E-mail da sua conta** para virar `super_admin` (item 05).
2. **Item 02 — caixinhas**: por enquanto só aporte manual, tudo bem? (automação por % de receita fica como próxima fase)
3. **Item 01 — metas**: meta é por **mês** e por **tipo** (leads/propostas/vendas/receita), correto? Ou quer meta por **vendedor** também já nesta entrega?
