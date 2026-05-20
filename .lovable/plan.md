Vou refatorar a aba Serviços (rota `/produtos`, arquivo `src/pages/Products.tsx`) no mesmo padrão das anteriores.

Escopo:

1. Tema claro premium
- Remover classes `vx-card`, gradientes pesados, ring branco, sombras gigantes e tons aleatórios. Padronizar para `bg-white border-slate-200/70 rounded-lg shadow-sm`.
- Cabeçalho enxuto seguindo o resto do admin (sem o `radial-gradient` cheio).
- Tipografia Inter no texto, JetBrains Mono em números/preços.
- Pills/status em paletas claras (emerald/sky/amber/rose/slate).
- Esconder ações de gestão (criar/editar/excluir/desativar/categorias) para quem não é admin (`canManage = isAdmin || isAdminSecondary`).

2. Busca e filtros confiáveis
- Normalizar busca (sem acento, lowercase) cobrindo nome, descrição e nome da categoria.
- Filtros: status (Todos/Ativos/Inativos), categoria, tipo (recorrente/único), permite parceiro.
- Chips de filtros ativos com X individual e "Limpar tudo".
- Ordenação na visualização de tabela por Nome, Categoria, Preço, % Comissão, Parceiros, Vendas, Receita, Status (cabeçalhos clicáveis com indicador).

3. Cartão "Top Produtos por Receita"
- Corrigir o link para a categoria, somar receita usando o mesmo `usageStats`.
- Quando não há vendas, mostrar estado vazio amigável.
- Mostrar também ticket médio do produto (receita/vendas).

4. KPIs corretos
- Ticket médio: receita total / total de vendas (não / total de produtos).
- Mostrar contagem de inativos e produtos sem categoria.
- "Melhor oferta" só aparece se existir; caso contrário "—".

5. Grid de cards mais limpo
- Remover o bloco fake de avatares `[...Array(3)]` que sempre mostra "P/+" mesmo sem parceiros — substituir por contagem real `u.partners parceiros`.
- Mostrar badge de recorrente, badge "permite parceiro", SLA padrão.
- Trocar gradientes/recortes decorativos por layout limpo.

6. Tabela mais útil
- Adicionar coluna "Tipo" (recorrente/único) e SLA.
- Estado vazio com contexto (filtros ativos vs. catálogo vazio).
- Linhas com hover slate-50, sem `vx-mono` (usar `font-mono`).

7. Diálogo de categorias
- Validar duplicidade de nome/slug.
- Confirmar exclusão mostrando quantos produtos serão impactados.
- Editar nome/cor da categoria (não só criar/excluir).

8. Segurança de ações
- `handleDelete` já protege contra vínculos — manter, mas usar `confirmAction` com mensagem clara.
- `toggleActive` com confirmação ao desativar produto com vínculos.
- Invalidar queries relacionadas (`products-list`, `product-usage`, `categories`).

9. Estados de carregamento e vazio
- Skeleton cards/rows enquanto carrega.
- Empty state contextual com CTA "Novo serviço".

10. Validação final
- Conferir tipos TS, build, console e dev-server após mudança.
- Sem alterações de schema; reaproveitar `ProductFormDialog` e `ProductChecklistDialog` existentes.

Fora do escopo: refatorar `ProductFormDialog`/`ProductChecklistDialog` e mudar schema/triggers do banco.