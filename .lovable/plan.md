Plano para deixar a aba Colaboradores no mesmo padrão premium das demais (Parceiros, Prestadores, Indicadores), sem mexer em RLS, schema ou edge functions.

1. Cabeçalho e visual
- Trocar o header artesanal por `PageHero` (ícone, eyebrow, KPIs clicáveis).
- Aplicar tema claro premium: `bg-white border-slate-200/70 rounded-lg shadow-sm`, tipografia Inter + JetBrains Mono nos números.
- Botão primário `bg-indigo-600`, ações secundárias outline.

2. Busca, filtros e paginação
- Busca normalizada (sem acento) por nome, e-mail, telefone e observações.
- Filtros: função (admin / admin_secondary / colaborador / todos), status (ativo / inativo / todos) e acesso ao sistema (com / sem / todos).
- Chips de filtros ativos com X e botão "Limpar tudo".
- Reset de paginação ao alterar busca, filtros ou ordenação.

3. KPIs reais
- Total, ativos, com acesso ao sistema e admins. Clicáveis para aplicar filtro correspondente.

4. Tabela com ordenação e segurança
- `SortableTh` para nome, função, status, acesso e criação.
- Ações restritas a `isAdmin || isAdminSecondary` (`canManage`). Colaborador comum só vê a lista.
- Bloquear auto-rebaixamento/auto-exclusão do próprio usuário e impedir remover/rebaixar o último admin (validação no front; banco continua sendo a fonte de verdade).
- Confirmação ao desativar / remover acesso ao sistema de um admin.
- Invalidar queries relacionadas (`collaborators-list`, `dashboard`) após mutações.

5. Modo grid alternativo (opcional)
- Cards com avatar, função, status, contato e ações rápidas — mesmo layout dos prestadores/indicadores.

6. Diálogos
- Mesmo dialog branco premium, inputs consistentes.
- Validar e-mail, nome obrigatório e função.
- Continuar usando a edge function `invite-user` para criação; apenas reorganizar visual e mensagens.
- Botão "Copiar senha" mantém comportamento atual.

7. Estados
- Skeletons claros para lista (e grid se ativado).
- Empty state diferenciando "sem cadastro" de "sem resultado para os filtros".

8. Exportação CSV
- Exportar lista filtrada (nome, e-mail, telefone, função, status, acesso, criado em) para admins.

Arquivos previstos:
- `src/pages/Collaborators.tsx`

Fora do escopo:
- Sem alterações em banco, RLS, edge functions, `types.ts`, painel do colaborador (`/colaborador`) ou outras abas.