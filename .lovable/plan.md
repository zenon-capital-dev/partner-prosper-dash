# Plano de execução — Auditoria de 50 itens + Leads mobile

50 correções em uma só leva = altíssimo risco de quebrar coisas e impossível revisar. Vou **agrupar por domínio** e executar em ondas, começando pelo que dá retorno imediato (segurança + bugs que você já vê na tela). A página de Leads mobile entra na Onda 1 porque é visível agora.

---

## ONDA 1 — Crítico / Visível (faço primeiro, sem perguntar mais)

### A. Layout Leads (mobile + desktop)
Pelo print, o `PageHero` está empilhando vertical em desktop (CRM SALES PIPELINE / HOJE / 7 DIAS / 30 DIAS / MÊS / TUDO / KANBAN / TABELA / IMPORTAR CSV / NOVO LEAD tudo numa linha que quebra feio; título "Leads / Convidados" quebrando letra por letra). Vou:
- Reescrever o header da página `src/pages/Leads.tsx` com layout responsivo de verdade: título fluido (sem quebra agressiva), grupo de filtros de período em chip-row com scroll horizontal no mobile, grupo Kanban/Tabela colapsando em ícones, ações (CSV/Novo Lead) viram FAB no mobile.
- Stack vertical limpo < 768px, grid horizontal ≥ 768px.
- Cards de KPI: grid 2 colunas no mobile, 4 no desktop, com `min-w-0` e `truncate` corretos.
- Kanban: scroll horizontal por coluna no mobile (já é prática padrão).

### B. Segurança banco (itens 1, 6, 7, 28, 42, 50)
Migration única:
- **(1)** Revogar EXECUTE em `anon` de funções SECURITY DEFINER expostas; manter só `authenticated`.
- **(6)** Adicionar `ON DELETE CASCADE` em FKs órfãs (`client_timeline`, `lead_history`, `activity_logs.entity_id` lógico não-FK fica de fora).
- **(7)** Cron job `pg_cron` (ou função agendada) que arquiva `audit_logs` > 180 dias em `audit_logs_archive`.
- **(28)** Auditar triggers `propagate_client_collaborator` / `fill_client_product_responsible` pra garantir guarda contra recursão (já tem `IS DISTINCT FROM`, vou confirmar e adicionar `pg_trigger_depth() = 1` se faltar).
- **(42)** `CREATE UNIQUE INDEX` em `profiles(lower(email))`.
- **(50)** Função `private.require_admin()` chamada no topo de cada edge function (`invite-user`, `process-alerts`).

### C. Bugs de regra de negócio que corrompem dados (itens 3, 4, 21, 22, 23, 27, 39, 49)
Migration:
- **(3)** UNIQUE parcial em `clients(cpf_cnpj)` onde NOT NULL.
- **(4)** Normalizar enum `commission_status`: trigger `BEFORE UPDATE` que mapeia `paga`→`pago` (mantém compat, código novo só usa `pago`).
- **(21)** `ALTER TABLE commissions ALTER COLUMN sale_id SET NOT NULL` (após validar que não há órfãs).
- **(22)** CHECK trigger `percent BETWEEN 0 AND 100` em `commissions` e `commission_rules`.
- **(23)** Trigger: ao virar `status='pago'`, set `approval_date = COALESCE(approval_date, now())` e `paid_at = now()`.
- **(27)** UNIQUE em `commission_rules(partner_id, product_id, rule_type, active)` parcial onde `active=true`.
- **(39)** `lead_history`: trigger `AFTER INSERT/UPDATE` em `leads` que loga mudança de status/owner.
- **(49)** CHECK em filtros de data → frontend (validação cliente), pois CHECK em range cross-row é caro.

### D. Edge function de comissão (item 5)
Mover cálculo pro server: edge function `calc-commission` que recebe `sale_id` e retorna `amount` arredondado em centavos. Frontend só chama, nunca calcula.

---

## ONDA 2 — UX / consistência (próximo turno, após você aprovar Onda 1)

Itens 2, 11, 12, 13, 14, 15, 17, 18, 19, 20, 24, 25, 26, 29, 30, 33, 34, 35, 36, 37, 38, 40, 41, 43, 44, 45, 46, 47, 48.

Resumo dos blocos:
- **Leads → Cliente** (2): botão "Converter em Cliente" no `LeadFollowUpDialog` que cria `clients` com dados do lead + atualiza `converted_to_client_id`.
- **Forms** (8, 15, 18, 41, 43): máscara+validação telefone, CPF, PIX (CPF/email/telefone/UUID), `estimated_value="" → null`, `inputMode="decimal"` em moedas.
- **Selects/Switches** (33, 34): convenção: `null` no banco, `"__none__"` no select, helper `toNullSelect`/`fromNullSelect`.
- **Cores/badges** (17): `<StatusBadge tone>` único pra "pendente" em todo lugar.
- **Empty states** (35): componente `EmptyState` com ilustração SVG.
- **Mobile headers** (36): `truncate` + tooltip.
- **Debounce buscas** (14): hook `useDebounce` já existe, aplicar.
- **Reset paginação** (24): `useEffect` resetando page=1 em mudança de filtro.
- **CEP** (25): rodar lookup no submit também.
- **Datas** (30): util `formatDate` único, banir `toISOString` na UI.
- **Sidebar sync** (29): subscribe em `user_roles` via realtime + invalidate de `useAuth`.
- **Double toast** (45), **z-index modais** (46): auditoria pontual.

---

## ONDA 3 — Refactor / tech debt (depois)

Itens 9, 10, 16, 31, 32, 40 (índice), 44.
- Schema Zod único pra senha (8 chars mínimo).
- Glossário: padronizar `referrer` em tudo (banco usa) e remover `indicator`.
- `roles.ts`: mapa único `ROLE_LABEL`, `ROLE_HOME`, `ROLE_ABILITIES`.
- Safe delete em produtos (`deleted_at`).
- Enum `commission_type`: padronizar `percentual` (já é o do banco — corrigir TS).
- `CREATE INDEX client_products_service_provider_id_idx`.

---

## O que peço

Confirme que posso tocar **Onda 1 inteira agora** (Leads layout + migration de segurança + migration de regras de negócio + edge function de comissão). Onda 2 e 3 ficam pra próximos turnos pra você revisar em pedaços digeríveis.

Se preferir só Leads layout agora e o resto depois, me diz.
