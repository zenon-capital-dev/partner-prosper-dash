# Sessão 4 — Fechar tudo a 100%

Objetivo: zerar a lista de pendências (UX, segurança residual, cleanup, verificação automatizada) e entregar a plataforma sem débitos conhecidos.

## Bloco A — Verificação automatizada (primeiro)
Antes de mexer em código, rodar diagnóstico para confirmar o estado real:
1. `supabase--linter` — checar warnings de RLS/policies após as migrations recentes
2. `security--run_security_scan` — scan completo
3. `supabase--analytics_query` em `postgres_logs` (últimas 24h, severity error) para pegar erros silenciosos
4. Console logs do preview + network errors

Tudo que aparecer aqui entra na lista antes de fechar a sessão.

## Bloco B — UX / Polimento
5. **Skeletons consistentes** — substituir `animate-pulse` solto por `<Skeleton>` nos KPIs de Dashboard, Commissions, Payments, Sales, Clients
6. **Datepicker shadcn** no `SaleFormDialog` (substituir `<Input type="date">` por Popover+Calendar com `pointer-events-auto`)
7. **CEP** no `ClientFormDialog` — máscara `00000-000` + lookup ViaCEP auto-preenchendo endereço
8. **Flicker de modal** — `onOpenAutoFocus={e => e.preventDefault()}` nos dialogs com `ResponsiveContainer`, `React.memo` nos charts internos

## Bloco C — Padronização & cleanup
9. **Labels "referrer" → "Indicador"** — varrer telas internas (Sales, Payments, Reports) e padronizar
10. **Deprecar `client_products.responsible_id`** — comentário SQL + remover referências remanescentes no frontend (usar só `responsible_employee_id`)
11. **Log único** — decisão: manter `activity_logs` como fonte e congelar inserts diretos em `audit_logs` (trigger continua). Atualizar componentes de histórico para ler só `activity_logs`
12. **Documentos via `sale_id` direto** — auditar policy de `documents` e garantir que colaborador/prestador veem documentos vinculados a vendas sem demanda

## Bloco D — Validação final
13. Re-rodar `supabase--linter` e `security--run_security_scan`
14. Atualizar `security--update_memory` com posturas confirmadas
15. Smoke test manual no preview: criar venda → ver split → marcar pago → ver no painel do parceiro/colaborador

## Notas técnicas
- 1 migration (Bloco C item 10 + 12 se precisar ajustar policy)
- ~8–10 arquivos frontend (B + C)
- Sem mudanças de schema disruptivas; tudo backward-compatible
- Risco baixo — mudanças isoladas e cobertas pelo scan final

## Fora de escopo (deixar para depois se aparecer)
- Refator grande de componentes (Commissions.tsx tem 1000+ linhas mas funciona)
- Migração de termo "parceiro" no banco (só na UI)
- Testes automatizados (projeto não tem suite hoje)