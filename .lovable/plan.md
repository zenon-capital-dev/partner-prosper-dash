Plano para deixar a aba Indicadores consistente, estável e sem os bugs atuais:

1. Reestruturar a página visualmente
- Trocar o layout antigo por `PageHero`, cards claros premium e tabela com `bg-white`, `border-slate-200/70`, `rounded-lg`, `shadow-sm`.
- Remover aparência escura/legada (`vx-card`, `muted` genérico em excesso) e alinhar com Parceiros/Prestadores.
- Criar modo lista e grid para facilitar leitura em desktop e mobile.

2. Corrigir busca, filtros e paginação
- Implementar busca normalizada sem acentos por nome, email, documento, telefone e PIX.
- Adicionar filtros: status ativo/inativo, acesso ao painel com/sem `user_id`, e situação financeira com pendências.
- Resetar paginação ao alterar busca, filtros ou ordenação.
- Mostrar chips de filtros ativos com opção de limpar individualmente.

3. Corrigir métricas e enriquecimento de dados
- Calcular comissões geradas, pagas, pendentes e clientes indicados a partir de `commission_splits` e `clients.referrer_id`.
- Evitar contagens erradas usando `Set` quando necessário.
- Ajustar KPIs para serem úteis e clicáveis: total, ativos, clientes indicados, comissões geradas, a pagar.

4. Melhorar tabela, ordenação e grid
- Adicionar `SortableTh` para ordenar por nome, clientes, comissões, pendente, percentual, status e recência.
- Tabela com colunas mais claras: indicador, contato, documento/PIX, comissão padrão, clientes, pago, a pagar, acesso e status.
- Cards no grid com avatar, contato, métricas principais e ações equivalentes à tabela.

5. Corrigir ações e segurança de UI
- Manter criação/edição/exclusão/ativação somente para `admin` e `admin_secondary`.
- Ao desativar indicador com clientes ou comissões pendentes, pedir confirmação explícita.
- Ao excluir, manter proteção contra vínculos existentes e sugerir desativar quando houver bloqueio.
- Invalidar todas as queries relacionadas após mutações: indicadores, splits, clientes e dashboard.

6. Fortalecer formulário
- Validar nome obrigatório, email válido, percentual entre 0 e 100, e CPF/CNPJ com tamanho plausível quando informado.
- Normalizar payload para evitar strings vazias no banco.
- Mensagens de erro mais claras e consistentes.

7. Exportação e estados da tela
- Adicionar exportação CSV respeitando filtros atuais, apenas para quem pode gerenciar.
- Criar loading skeletons para lista/grid.
- Melhorar empty state diferenciando “sem cadastro” de “nenhum resultado para os filtros”.

Arquivos previstos:
- `src/pages/Indicators.tsx`

Fora do escopo:
- Sem alteração em banco, RLS, `types.ts`, painel do indicador (`/indicador`) ou outras abas.