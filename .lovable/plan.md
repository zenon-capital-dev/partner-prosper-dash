## Refatoração da aba Prestadores (`/prestadores`)

Mesma linha das abas Vendas, Serviços e Parceiros: limpar UI, normalizar filtros, corrigir cálculos, ordenar colunas, proteger ações e melhorar feedback. Escopo apenas frontend em `src/pages/Providers.tsx` — sem alterar schema, RLS ou edge functions.

### 1. Tema claro premium
- Remover gradientes/cards escuros (`from-indigo-500 via-indigo-500 to-indigo-600`, `bg-gradient-to-br from-indigo-500/20`, ring colorido no avatar, barra colorida no hover do card).
- Padronizar: fundo `bg-slate-50/60`, cards `bg-white border-slate-200/70 rounded-lg shadow-sm`, hover `hover:bg-slate-50`.
- Tipografia Inter + JetBrains Mono para números (`tabular-nums`).
- Avatar com `bg-indigo-50 text-indigo-700 border-slate-200/70` neutro (sem gradiente).
- Botão "Novo Prestador" sólido `bg-indigo-600 hover:bg-indigo-700` (sem gradiente).

### 2. Busca e filtros
- Helper `norm(s)` (NFD + lower) já usado nas outras abas.
- Busca cobre: nome, email, especialidade, documento (apenas dígitos), telefone (apenas dígitos), cidade/UF.
- Filtros existentes (status, especialidade) + novo filtro "Acesso ao painel" (com/sem login) baseado em `has_system_access` ou equivalente do schema.
- Chips de filtros ativos com X e botão "Limpar tudo".
- Reset de página ao mudar qualquer filtro.

### 3. KPIs corrigidos
- "Total da Rede", "Ativos", "Demandas em curso", "Clientes atendidos" (manter) + corrigir "Demandas em curso" para considerar apenas status realmente em andamento (excluir cancelado/arquivado, não só "concluído").
- Adicionar "Ticket médio" = `Σ revenue / total prestadores com receita` formatado em BRL.
- KPI clicável filtra status (Ativos/Inativos) como nas outras abas.

### 4. Tabela (lista) com ordenação
- Componente `SortableTh` (asc/desc/none) nas colunas: Prestador, Especialidade, Demandas (ativas), Clientes, Receita, Avaliação, Status.
- Adicionar coluna "Receita" (`_revenue` já calculado, faltando exibir).
- Hover `hover:bg-slate-50`, divisor `divide-slate-200/70`, header `bg-slate-50 text-slate-500`.
- Indicador de acesso ao painel (ícone discreto quando `has_system_access`).

### 5. Grid (cards)
- Reescrita do `ProviderCard` para o padrão claro: header com avatar + nome + especialidade, métricas em grid 3 col (Demandas / Clientes / Receita), badge Ativo/Inativo, rating discreto.
- Ações iguais à tabela (Delegar + dropdown ver/editar/ativar/excluir).
- Esconder ações de gestão se `!canManage` (`isAdmin || isAdminSecondary`).

### 6. Ações e segurança
- `canManage = isAdmin || isAdminSecondary` controla: botão "Novo", "Editar", "Ativar/Desativar", "Excluir", "Delegar".
- `removeProvider`: já bloqueia com vínculos; manter, mas mostrar contagem por tipo (demandas X / contratos Y) e oferecer botão "Desativar" no toast.
- `toggleActive`: confirmar antes de desativar prestador com demandas ativas (`_activeCount > 0`).
- Invalidar `["providers-rich"]`, `["dashboard"]` e `["demands"]` após mutações.

### 7. Exportação CSV
- Botão "Exportar" (admin) gera CSV com: nome, email, telefone, documento, especialidade, cidade/UF, demandas ativas, concluídas, clientes, receita, avaliação, status, acesso ao painel, criado_em.
- Respeita filtros atuais (exporta `filtered`, não a página).

### 8. Estados de loading/empty
- Skeletons para grid (cards) e lista (linhas).
- Empty state contextual: diferencia "nenhum cadastrado" de "nenhum bate com os filtros" (com botão "Limpar filtros").

### 9. Validação
- Tipos OK (sem alterar `types.ts`).
- Build limpo, sem warnings novos.
- Conferir `dev-server.log` e console do preview após implementar.
- Sem mudanças em `ProviderFormDialog`, `ProviderAssignDialog`, `ProviderDetail`, schema ou RLS.

### Fora do escopo
- Refatoração de `ProviderDetail.tsx`, `ProviderPanel.tsx`, `ProviderPerformance.tsx`, `ProviderReports.tsx`.
- Mudanças em diálogos de formulário/atribuição.
- Mudanças no banco de dados.

### Arquivos a editar
- `src/pages/Providers.tsx` (refatoração completa, ~400 linhas)
