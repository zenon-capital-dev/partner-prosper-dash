# Auditoria: 50 bugs / inconsistências encontradas

Categorizei tudo em **6 ondas** de correção. Começo pela #1 (crítico: dados duplicados/quebrados) e #4 (piscar do modal) porque são os de maior impacto imediato.

---

## ONDA 1 — Bugs críticos de dados (salva errado / duplica)

1. **Comissões duplicadas em toda venda novo cadastro.** `SaleFormDialog` insere comissões manualmente (linhas 140-175) **E** existe trigger `handle_new_sale` no banco que também insere — toda venda gera comissão dobrada. **Fix:** remover o insert manual no frontend, deixar só o trigger.
2. **Splits duplicados.** Há `generate_commission_splits` **e** `handle_sale_splits` — dois triggers fazendo a mesma coisa. **Fix:** dropar `handle_sale_splits`.
3. **`ClientFormDialog` escreve em `profiles.id` usando o id do CLIENTE (não do auth.user).** Linhas 214-218: `supabase.from("profiles").update({ onboarding_completed, ... }).eq("id", clientId)`. `profiles.id` = `auth.users.id`, não `clients.id`. Resultado: campos de onboarding **nunca salvam** ou sujam profile de outro usuário com mesmo UUID. **Fix:** ler `clients.user_id` e usar ele no `.eq`.
4. **Verificação de duplicidade de cliente vulnerável a injeção PostgREST e quebra com email vazio.** Linha 146: `.or(\`email.eq.${form.email}${cleanDoc ? \`,document.eq.${cleanDoc}\` : ""}\`)` — vírgulas/pontos no input quebram o filtro. **Fix:** validar antes, usar `.or` só com valores escapados (ou duas queries separadas).
5. **Falta UNIQUE constraint em `clients.document` e `clients.email`.** Mesmo com a checagem do app, dois cadastros simultâneos passam. **Fix:** índice único parcial `WHERE document IS NOT NULL`.
6. **`SaleFormDialog` não cria comissão para colaborador** (só parceiro e indicador no fallback manual — mesmo bug que vai sumir com fix #1, mas precisa garantir que `handle_new_sale` cubra os 3).
7. **Trigger `handle_new_sale` não gera comissão para indicador nem colaborador**, só `partner`. **Fix:** estender o trigger.
8. **Mistura `pago` vs `paga` no enum** — `FinanceCenter` linhas 332-339 filtra `status !== "pago" && status !== "paga"` em vários lugares. **Fix:** padronizar enum `commission_status` para `pago` e migrar dados antigos.
9. **`sync_commission_split_status`** só sincroniza split quando `beneficiary_type='partner' AND beneficiary_id=NEW.partner_id` — splits de referrer/collaborator nunca atualizam quando a comissão é paga. **Fix:** sincronizar pelo `sale_id` cobrindo todos beneficiários.
10. **`maybe_release_commission`** dispara em update de `payments.status` mas só altera `workflow_status`. O `status` da comissão permanece `pendente` para sempre. **Fix:** atualizar ambos ou alinhar leitura.
11. **`payments` gerados em toda venda com vencimento fixo `CURRENT_DATE + 3 days`** — ignora `sla_start_date` ou data customizada. **Fix:** usar `sale.payment_due_date` quando existir.
12. **`set_client_product_sla`** quebra se produto não tiver SLA — ok, mas `populate_client_product_from_template` é `SET search_path TO 'public'` sem `SECURITY DEFINER` e tenta `auth.uid()` — falha silenciosa para usuários sem privilégio.

## ONDA 2 — Fluxo Cliente → demais abas (não aparece pra quem deveria)

13. **Cliente recém-criado com `collaborator_id` setado não aparece pro colaborador** porque a query do painel filtra `responsible_id` (campo antigo) **OU** `collaborator_id` mas o form salva `responsible_id = form.collaborator_id` — duplica info. **Fix:** consolidar em `collaborator_id` e remover `responsible_id` em todo lugar.
14. **Cliente com `service_provider_id` setado não aparece pro prestador.** `ProviderPanel` busca pelo `service_provider_id` da tabela `clients` mas o form do cliente não está propagando para `client_products` quando o cliente é novo (apenas em update via trigger `propagate_client_provider`). **Fix:** garantir que `fill_client_product_provider` rode em INSERT também (já existe trigger BEFORE INSERT, mas não está atachado).
15. **Demandas pré-existentes não recebem `responsible_employee_id` retroativo** ao trocar colaborador do cliente — `propagate_client_collaborator` só roda em UPDATE de `clients`. OK, mas se você cria cliente com colaborador, e DEPOIS cria demandas via outra tela que não preenche, o trigger `fill_client_product_responsible` resolve — **confirmar que o trigger BEFORE INSERT existe** (na DB function existe a função mas não vi trigger anexado).
16. **Venda nova com indicador não cria entrada visível em `ReferrerPanel`** — painel busca `commission_splits` mas o trigger duplicado (#2) gera 2 splits, ou nenhum se o referrer_percent vier zero por engano.
17. **Faturamento/`payments` não mostra `partner_id` nem `collaborator_id`** — joins em `Finance.tsx` não trazem nomes. Resultado: comissionados não veem suas vendas em "a receber".
18. **`Commissions.tsx` filtra por `partner_id` apenas** quando o usuário é parceiro/indicador — indicador/colaborador não veem suas comissões nessa tela. **Fix:** filtrar por `beneficiary_id = auth.uid()` em `commission_splits`.
19. **Cliente criado por parceiro/indicador não puxa o `partner_id` automaticamente** do usuário logado (apenas se manualmente selecionado).
20. **Documentos enviados pelo cliente não aparecem pro prestador** — `documents` tem RLS mas falta policy "providers can view documents of delegated demands".
21. **Tasks com `assigned_to` setado para colaborador não aparecem na aba `Tarefas`** do CollaboratorPanel quando a task foi criada por trigger (`populate_client_product_from_template`) — o trigger usa `auth.uid()` em vez de `responsible_employee_id`.
22. **Audit log "Cliente Criado" mostra `user_id NULL`** quando criado via edge function (sem JWT). Falta passar header `x-user-id` ou ler do JWT.

## ONDA 3 — Bug do "piscar atrás do modal"

23. **CAUSA RAIZ:** Radix `Dialog` adiciona `padding-right` no `<body>` e `overflow:hidden` ao abrir, para compensar o scrollbar. Isso encolhe a viewport, e `ResponsiveContainer` do Recharts (gráfico em `Sales.tsx` linha 234) re-mensura → redesenha do zero → "pisca". O `animate-in slide-in-from-bottom` em cards filhos também reanima.
   **Fix:** adicionar `html { scrollbar-gutter: stable; }` no `index.css` (uma linha resolve em todas as páginas). Alternativa: setar `overflow-y: scroll` no html.
24. **Z-index conflitando** entre `Select` dentro do `Dialog` (popover do select aparece atrás em algumas resoluções). **Fix:** usar tokens de `src/lib/z-index.ts`.
25. **Animação `animate-pulse` no loading da tabela** + reflow do modal = duplica o piscar. Trocar por `TableSkeleton`.

## ONDA 4 — Segurança, RLS e validação

26. **Funções SECURITY DEFINER executáveis por `anon`.** `is_admin()`, `has_role()`, `check_is_admin()`, `check_user_role()` — `REVOKE EXECUTE ... FROM anon`.
27. **`create_notification` SECURITY DEFINER aceita `p_user_id` arbitrário** — qualquer usuário autenticado pode criar notificação pra outro. Adicionar check de role admin.
28. **`notify_admins` permite título/mensagem com qualquer string** — risco de injection visual. Limitar tamanho.
29. **Edge functions sem validação de admin no body** — `calc-commission` valida só JWT mas não papel. Adicionar `is_admin()` check.
30. **Signup: política de senha fraca em alguns formulários** — `Auth.tsx` está ok (8 chars), mas `ResetPassword` confia só no client-side. Reforçar via `auth.config`.
31. **`audit_logs` cresce infinito** — sem job de archive. Criar materialized view e job de purga >180d.
32. **`profiles` exposto via SELECT pública** em algumas policies — checar `profiles_public` view.
33. **RLS de `documents` permite cliente ver docs de outro cliente** se `client_id` for nulo. Adicionar `AND client_id IS NOT NULL`.

## ONDA 5 — UX, layout, validação de formulário

34. **Header de Leads quebra letra-a-letra** em mobile pequeno (já vimos — `PageHero` ajustado).
35. **Datepicker permite data final < inicial** em filtros de Finance e Commissions.
36. **Filtros de status case-sensitive** em alguns lugares (`"Novo"` vs `"novo"`).
37. **Toasts duplicados** ao salvar (uso de `toast.success` + invalidate causa re-render). Já existe `notify` com dedup — aplicar.
38. **`CEP` não preenche endereço** em `ClientFormDialog` — hook `useCepLookup` criado mas não conectado.
39. **Telefone aceita só dígitos mas máscara visual está bugada** ao colar.
40. **`Conversão de Lead em Cliente`** já existe (`ConvertLeadDialog`), mas botão não aparece na tabela de Leads em telas <768px (escondido pelo `opacity-0`).
41. **Modal de "Nova venda" fecha ao clicar fora mesmo com campos preenchidos** — perde dados. Adicionar `onInteractOutside={(e)=>e.preventDefault()}` quando dirty.
42. **`Select` de cliente em SaleFormDialog não tem busca** — com 100+ clientes vira inutilizável. Trocar por Combobox.
43. **`amount` em vendas aceita string vazia** mas o cálculo faz `Number("") = 0` silencioso.
44. **Loading de KPIs no Dashboard** mostra "0" em vez de skeleton — parece bug de dado.

## ONDA 6 — Limpeza e consistência

45. **Campo `responsible_id` em `clients`** redundante com `collaborator_id` — deprecar.
46. **`beneficiary_type` usa `'referrer'`** mas alguns componentes esperam `'indicator'`. Padronizar para `referrer`.
47. **Dois nomes pra "indicador"**: `referrer` no banco, `indicator` em alguns componentes do frontend.
48. **Edge function `calc-commission` redundante** depois do fix #1 — manter só pra recálculo manual.
49. **`handle_new_sale` cria payment sempre** mesmo se venda for `cancelada`. Adicionar guard.
50. **Logs duplicados**: `log_activity` insere em `audit_logs` E `activity_logs`. Decidir uma fonte.

---

## Como vou executar

**Sessão 1 (agora, se aprovar):** Onda 1 (#1, #2, #3) + Onda 3 (#23) + Onda 2 (#13, #14, #21).
São os bugs que estão concretamente fazendo "dado não aparecer". Vou:

- Criar migration única que: dropa trigger duplicado de splits, estende `handle_new_sale` p/ referrer+collaborator, padroniza enum `pago`, corrige `sync_commission_split_status`, anexa triggers faltantes (`fill_client_product_provider`, `fill_client_product_responsible`).
- Editar `SaleFormDialog.tsx` removendo insert manual de comissões.
- Editar `ClientFormDialog.tsx` corrigindo o update de profiles (usar user_id correto).
- Adicionar `html { scrollbar-gutter: stable; }` em `src/index.css`.
- Ajustar `CollaboratorPanel` para parar de usar `responsible_id`.

**Sessão 2:** Onda 2 restante + Onda 4 (RLS/segurança).
**Sessão 3:** Onda 5 (UX) + Onda 6 (limpeza).

Posso seguir com a **Sessão 1** agora?
