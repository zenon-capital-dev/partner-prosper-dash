# Diagnóstico

Os cards do painel admin estão zerados/quebrados porque **TODAS** as queries principais estão retornando `403 permission denied` — não é layout, é banco. Os logs de rede mostram:

- `permission denied for function has_role` (em `leads`)
- `permission denied for function is_partner_for_client` (em `clients`, `sales`, `payments`, `tasks`, `contracts`, `client_products`)
- `column document_requests.created_at does not exist` (a coluna correta é `requested_at`)
- `Could not find a relationship between 'activity_logs' and 'profiles'` (sem FK pro PostgREST embedar)

Confirmei no banco:
- `private.is_partner_for_client` → **NÃO tem GRANT EXECUTE para `authenticated`** (só postgres)
- `public.has_role` → **NÃO tem GRANT EXECUTE para `authenticated`** (só service_role/sandbox)
- `private.has_role` tem, mas as policies de várias tabelas chamam a versão `public.has_role` ou `is_partner_for_client`, que estão sem permissão.

Resultado: o admin loga (role=admin confirmado), mas qualquer policy que chame essas funções estoura 403, então o `useDashboardStats` recebe 0 em tudo e os cards ficam vazios — independente do filtro (HOJE/7D/30D).

# Correções

## 1. Migration SQL (núcleo do problema)
```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_partner_for_client(uuid) TO authenticated;
-- varrer outras funções do schema private usadas em policies e dar grant
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
```

## 2. `src/hooks/useDashboardStats.ts`
- Trocar `document_requests.created_at` → `requested_at` na ordenação/filtros.
- Remover o embed `profiles(full_name)` em `activity_logs` (não há FK). Fazer fetch separado dos profiles por `user_id` e juntar no client.

## 3. Verificar `Dashboard` admin (cards de período)
Depois das correções acima, HOJE/7D/30D vão refletir dados reais. Validar no preview.

# Próximo passo
Aplicar a migration de GRANTs e ajustar o hook. Posso implementar direto se confirmar.
