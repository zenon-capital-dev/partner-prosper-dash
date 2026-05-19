Plano de correção completo:

1. Página de Leads no mobile
- Reestruturar o topo da página para não “vazar” para fora da tela: filtros de data, alternância Kanban/Tabela, Importar CSV e Novo Lead precisam quebrar em linhas úteis ou virar trilhas roláveis sem cortar conteúdo.
- No mobile, trocar o Kanban de colunas largas por uma experiência usável: cards empilhados por etapa/acordeão ou colunas com largura calculada e scroll evidente, sem deixar botões escondidos fora da tela.
- Ajustar a barra de busca/filtros para ocupar 100% da largura em telas pequenas.
- Corrigir tabela/lista para mobile com cards ou scroll horizontal controlado, sem texto esmagado.
- Remover classes hardcoded que brigam com o tema premium claro do admin e padronizar com tokens semânticos.

2. Modais e formulários do admin
- Corrigir `DialogContent`, `DialogFooter`, `Select`, `Dropdown`, `Popover` e `Sheet` para terem altura máxima real, scroll interno funcional e rodapé acessível no mobile.
- Ajustar formulários de criação/edição que ainda usam `grid-cols-2` fixo para `grid-cols-1 sm:grid-cols-2`.
- Priorizar os modais mais críticos: Novo Lead, Converter Lead, Novo Cliente, Adicionar Produto/Demanda, Tarefas, Comissões, Usuários, Colaboradores, Indicadores, Financeiro, Documentos e Demand Detail.
- Garantir que botões de salvar/cancelar nunca fiquem cortados atrás do fim da viewport.

3. Comunicação correta entre Admin, Parceiro, Indicador, Colaborador, Prestador e Cliente
- Corrigir a conversão de Lead em Cliente: quando o lead tiver colaborador responsável, o cliente, a demanda criada e a primeira tarefa devem receber o mesmo vínculo automaticamente.
- Corrigir criação/edição de Cliente: ao selecionar colaborador responsável, o vínculo deve alimentar cliente, demandas relacionadas e registros derivados quando aplicável.
- Corrigir Adicionar Produto/Demanda: se o cliente já tem colaborador, a demanda deve herdar esse colaborador por padrão; se o admin escolher outro colaborador, esse colaborador vira o responsável da demanda.
- Corrigir consultas do painel do colaborador para contar apenas registros vinculados ao usuário logado por `clients.collaborator_id`, `clients.responsible_id`, `client_products.responsible_employee_id`, `tasks.assigned_to` ou vínculos indiretos válidos via demanda/cliente.

4. Regras de banco para impedir o bug de voltar
- Criar uma migration com triggers/funções seguras para preencher automaticamente `client_products.responsible_employee_id` a partir do colaborador do cliente quando uma demanda for criada sem responsável.
- Ao atualizar o colaborador de um cliente, propagar para demandas sem responsável ou com o responsável anterior do cliente, sem sobrescrever demandas que foram atribuídas manualmente a outro colaborador.
- Garantir políticas de acesso para colaborador sem abrir dados de outros colaboradores.
- Revisar políticas de `clients`, `client_products`, `tasks`, `documents`, `contracts`, `payments`, `sales` e `commissions` para que cada perfil veja somente o que está vinculado a ele.

5. Auditoria e validação
- Rodar consultas de auditoria no banco para encontrar clientes/demandas/tarefas desalinhados e corrigir inconsistências existentes.
- Validar no preview em mobile 390x844 e desktop: Leads, Clientes, Demandas, Tarefas e modais principais.
- Validar o fluxo real: criar cliente com colaborador, adicionar demanda, converter lead com colaborador e confirmar que tudo aparece no painel do colaborador e nas telas relacionadas.

Arquivos que devem ser alterados:
- `src/pages/Leads.tsx`
- `src/components/leads/LeadsKanban.tsx`
- `src/components/leads/LeadFormDialog.tsx`
- `src/components/leads/ConvertLeadDialog.tsx`
- `src/components/clients/ClientFormDialog.tsx`
- `src/components/clients/AddProductDialog.tsx`
- `src/pages/CollaboratorPanel.tsx`
- `src/index.css`
- componentes base de UI necessários: `dialog`, `select`, `dropdown-menu`, `popover`, `sheet`, `tabs`, `table`
- nova migration de permissões/propagação de vínculos no backend