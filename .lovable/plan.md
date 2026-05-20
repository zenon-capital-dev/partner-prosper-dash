Vou refatorar a aba Vendas no mesmo padrão das anteriores: visual claro premium do admin, busca/filtros confiáveis, KPIs coerentes e ações seguras.

Escopo:

1. Tema visual claro premium
- Trocar o shell dark/obsidian (`dark:bg-[#060608]`, classes `vx-card`, `text-foreground`, dark overrides) por fundo `bg-slate-50/60`, cards `bg-white border-slate-200/70 rounded-lg shadow-sm`.
- Remover gradientes pesados e classes `dark:` no admin.
- Tipografia Inter no texto, JetBrains Mono em números/valores.
- Pills de status com paletas claras (emerald/sky/amber/rose/slate) — sem dark.

2. Filtros e busca
- Normalizar busca por cliente, empresa, produto, parceiro, documento (sem acento, sem pontuação).
- Sincronizar range de período "HOJE/7/30/MÊS/TUDO" com inputs de data: quando o usuário escolhe data manual, sair do preset; range manual deve sobrescrever preset corretamente.
- Filtros: status, parceiro (com opção "Sem parceiro"), intervalo de datas.
- Chips de filtros ativos com X individual e "Limpar tudo".
- Resetar paginação ao mudar filtros (se aplicável).

3. Ordenação na tabela
- Cabeçalhos clicáveis para Data, Cliente, Produto, Parceiro, Valor, Comissão e Status.
- Indicador visual de ordenação ascendente/descendente.

4. KPIs e gráficos
- KPIs baseados em `filtered` (já é assim) — preservar mas no padrão claro.
- Gráfico de 30 dias: respeitar o range escolhido; ou deixar fixo "últimos 30 dias" mas etiquetado como tal e usando data local sem deslocamento de fuso.
- Distribuição por status e Top Parceiros mantendo cores claras.

5. Ações na linha (mais seguras)
- Esconder ações de gestão para quem não é admin (`canManage`).
- Validar transições de status: bloquear "Concluir" se já concluída; bloquear "Cancelar" em venda concluída sem confirmação extra.
- Confirmar mudanças destrutivas com `confirmAction`.
- Invalidar também queries relacionadas (commissions, payments) quando status muda.
- Tratar erros do Supabase mostrando toast `error.message`.

6. Exportação CSV
- Incluir colunas Parceiro, Comissão %, Comissão R$, Empresa.
- Escapar valores corretamente (já faz) e manter BOM UTF-8.
- Nome do arquivo com data: `vendas-YYYY-MM-DD.csv`.

7. Estados de carregamento e vazio
- Skeleton rows enquanto carrega.
- Empty state com ícone + mensagem contextual (com filtros vs sem dados).

8. Responsividade
- Tabela com `overflow-x-auto` e larguras mínimas, sem quebrar layout.
- Toolbar de filtros que empilha em telas pequenas.

9. Validação final
- Conferir tipos TS, console e dev-server após mudança.
- Não mexer no banco — dados consistentes já validados.

Fora do escopo: refatorar `SaleFormDialog` (que é outro componente) e mudar regras de comissão/triggers do banco.