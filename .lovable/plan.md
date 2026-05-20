## Sessão 2 — Visibilidade de dados + Segurança RLS

Continuação do plano de 50 bugs. Foco: garantir que dados criados apareçam corretamente em todas as abas/painéis e fechar brechas de segurança.

### Onda 2 — Visibilidade de dados entre abas

1. **Cliente → Colaborador**: ao criar/editar cliente com `collaborator_id`, garantir que apareça em `/colaborador` (Demandas + Clientes). Validar trigger `propagate_client_collaborator` em INSERT também (hoje só roda em UPDATE).
2. **Cliente → Prestador**: mesmo problema com `service_provider_id` em INSERT no `clients`.
3. **Demandas retroativas**: quando se altera `collaborator_id`/`service_provider_id` do cliente, propagar para `client_products` existentes (já existe parcial; revisar condições).
4. **Venda → ReferrerPanel**: indicador (`referrer_id`) não vê comissão dele. Ajustar `Commissions.tsx` e `ReferrerPanel` para filtrar por `referrer_id` OR `collaborator_id` OR `partner_id` conforme role.
5. **Commissions.tsx**: filtros para colaborador/indicador (hoje só `partner_id`).
6. **Payments**: incluir `partner_id`/`referrer_id` derivados da venda para o financeiro filtrar por beneficiário.
7. **Documents RLS**: colaborador e prestador não veem documentos das demandas atribuídas. Adicionar policies via `responsible_employee_id` / `service_provider_id`.
8. **Tasks**: usuário com `assigned_to` precisa ler/atualizar mesmo sem ser dono (`user_id`). Revisar policy.

### Onda 4 — Segurança

9. Revogar `EXECUTE` de `anon` em funções `SECURITY DEFINER` sensíveis (`create_notification`, `notify_admins`, `complete_client_onboarding`, `log_action`, `check_pending_commissions`, `check_overdue_documents`).
10. `create_notification` / `notify_admins`: exigir que o caller seja admin ou trigger interno (checar `auth.uid()` + `is_admin`).
11. Rodar `supabase--linter` ao final e corrigir warnings.

### Técnico

- **Migração única** cobrindo: triggers de propagação em INSERT, policies de `documents`/`tasks`, REVOKE de funções sensíveis.
- **Frontend**: `Commissions.tsx` (filtros), `ReferrerPanel`, `CollaboratorPanel` (Clientes/Documentos), `ProviderPanel` (Documentos).
- Sem mexer em layout/UI — só lógica de query e RLS.

### Fora desta sessão
- Onda 3 (flicker modal extra, skeletons) — já parcialmente coberto na Sessão 1.
- Ondas 5 e 6 (UX, cleanup) — próxima sessão.
