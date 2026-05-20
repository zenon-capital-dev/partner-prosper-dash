# Onda 2 — UX e Consistência

Objetivo: eliminar inconsistências visuais/comportamentais entre páginas e melhorar a experiência de uso, sem mexer em regras de negócio. Tudo frontend, exceto o `calc-commission` (edge function).

## Lote 1 — Inputs e máscaras
- Criar `src/lib/masks.ts` com helpers: `maskPhoneBR`, `maskCPF`, `maskCNPJ`, `maskCpfCnpj`, `maskCEP`, `maskPIX` (auto-detecta CPF/CNPJ/email/telefone/chave aleatória).
- Aplicar em todos os formulários: Cliente (cpf_cnpj, phone, cep), Lead (phone, cpf_cnpj), Parceiro (cpf_cnpj, pix_key, phone), Colaborador (cpf, phone).
- Integração CEP: novo hook `useCepLookup` (ViaCEP) que preenche endereço/cidade/uf ao perder foco no campo CEP.

## Lote 2 — Validação e datas
- Schema Zod compartilhado em `src/lib/schemas.ts` (campos comuns: email, phone, cpf_cnpj, cep, datas).
- Validar `data_final >= data_inicial` em todos os filtros de período (Leads, Financeiro, Comissões, Dashboard, Relatórios) — mensagem inline e bloqueio do submit.
- Componente `DateRangeField` reutilizável usando shadcn Calendar com `pointer-events-auto`.

## Lote 3 — Convenções de UI
- Padronizar `Select` x `Switch` x `RadioGroup`:
  - Switch só para boolean on/off
  - Select para >3 opções
  - RadioGroup para 2–3 opções visíveis
  Auditar e ajustar 4 formulários divergentes (Parceiro, Produto, Comissão, Cliente).
- Badges de status: um único componente `StatusBadge` com mapa `status → variant/label` por domínio (lead, comissão, financeiro, demanda).
- Empty states: componente `EmptyState` (ícone + título + descrição + CTA) aplicado em todas as listas vazias.

## Lote 4 — Mobile e navegação
- Headers mobile: padronizar `PageHero` em telas <768px (título truncado, ações em `Sheet`/dropdown).
- Z-index: revisar `Dialog`/`Select`/`Popover`/`DropdownMenu` — definir camadas em `src/lib/z-index.ts` e aplicar (`z-modal=50`, `z-popover=60`, `z-tooltip=70`).
- Sidebar sync: ao navegar via NavLink, grupo do item ativo abre automaticamente; estado de collapsed persistido em localStorage.
- Toast duplicado: criar wrapper `notify()` em `src/lib/notify.ts` que faz dedupe por id; substituir chamadas diretas de `toast.success`/`toast.error` em mutations.

## Lote 5 — Performance e listas
- Debounce de busca (300ms) em todas as listas (Clientes, Leads, Parceiros, Demandas, Tarefas, Comissões) via hook `useDebouncedValue`.
- Reset de página ao mudar filtro/busca em todas as tabelas paginadas.
- Skeleton loading uniforme (`<TableSkeleton rows={n} />`) substituindo spinners ad-hoc.

## Lote 6 — Comissão server-side
- Nova edge function `calc-commission`: recebe `{ sale_id }`, lê regra ativa (`commission_rules`), calcula valor e cria/atualiza linhas em `commissions` (indicador + parceiro).
- Frontend chama a function ao criar/editar venda; remove cálculo client-side de `SaleForm` e `CommissionForm`.
- `verify_jwt = true` + checagem `has_role(uid,'admin') OR uid = sale.created_by`.

## Detalhes técnicos
- Arquivos novos: `src/lib/{masks,schemas,notify,z-index}.ts`, `src/hooks/{useCepLookup,useDebouncedValue}.ts`, `src/components/{StatusBadge,EmptyState,DateRangeField,TableSkeleton}.tsx`, `supabase/functions/calc-commission/index.ts`.
- Arquivos editados (estimativa): ~25 formulários/listas + `PageHero`, `AppSidebar`.
- Nenhuma migration nesta onda (regras de negócio já foram cobertas na Onda 1).

## Ordem de execução sugerida
1. Lote 1 + 2 (base reutilizável) → 2. Lote 3 (consistência visual) → 3. Lote 4 (mobile/nav) → 4. Lote 5 (perf) → 5. Lote 6 (edge function).

Posso executar tudo de uma vez, ou prefere quebrar em 2 entregas (Lotes 1–3 primeiro, depois 4–6)?
