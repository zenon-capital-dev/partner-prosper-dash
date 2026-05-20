## Sessão 3 — Visibilidade de comissões + RLS + UX/cleanup

Cobre Ondas 2, 5 e 6 do plano de 50 bugs.

### Bloco A — Visibilidade (alto impacto)

1. **Commissions.tsx (admin)** — trocar a query base de `commissions` para `commission_splits` (com join em `sales→clients/products`) para mostrar parceiro + indicador + colaborador em uma única lista. Coluna nova "Beneficiário (tipo)". Mantém filtros e ações em massa.
2. **Payments** — preencher `partner_id`/`referrer_id` derivados no INSERT do trigger `handle_new_sale` (assim financeiro pode filtrar por beneficiário sem joins extras). Adicionar colunas se não existirem.
3. **Demandas retroativas** — `propagate_client_collaborator/provider` agora também propaga em UPDATE de `NULL→valor` (hoje só pega `OLD=valor`).
4. **Tasks INSERT** — adicionar policy para colaborador criar subtarefa em demanda atribuída.
5. **Documentos via sale_id** — confirmar policy para colaborador/prestador ver documentos vinculados só por `sale_id` (sem `client_product_id`).

### Bloco B — Segurança/UX

6. **`ClientFormDialog.or()`** — escapar vírgulas no input com `.replace(/,/g,'\\,')` ou usar `.ilike` separados.
7. **SaleFormDialog** — validar `amount > 0`; Select vazio (placeholder); datepicker controlado.
8. **CEP** — máscara + lookup ViaCEP no `ClientFormDialog` (se não existir).
9. **Flicker modal extra** — adicionar `<DialogContent>` com `onOpenAutoFocus` + envolver charts em `React.memo` para evitar recompute durante lock do body.
10. **KPI skeletons** — substituir `animate-pulse` cru por `<Skeleton>` consistente.

### Bloco C — Cleanup

11. Deprecar coluna `client_products.responsible_id` (manter, marcar como NÃO USAR em comentário; remover usos restantes).
12. Padronizar nomenclatura `referrer` em UI (hoje aparece "indicador" e "referrer").
13. Decidir log único: manter `activity_logs` (já usado) e congelar `audit_logs` para inserts diretos (trigger continua).
14. Remover edge function `calc-commission` se não referenciada.

### Técnico

- **1 migração** (Bloco A: trocar Commissions a fonte, adicionar colunas em payments, ajustar propagate, policy de tasks).
- **Edits frontend** (Blocos B/C): ~6 arquivos.
- Rodar `supabase--linter` ao fim.

### Risco

- Trocar a fonte de Commissions.tsx pode quebrar ações em massa (status workflow só existe em `commissions`). Mitigação: manter aba "Splits" nova e aba "Parceiros (legado)" com a tabela antiga, ou abstrair pra view unificada. Vou implementar como **view unificada** `v_commissions_unified` para minimizar churn.
