Vou corrigir isso em três frentes, sem mascarar erro:

1. **Produto não pode quebrar vendas existentes**
   - Trocar a ação “Excluir” de produto usado por vendas/demandas/contratos/leads para **arquivar/desativar com segurança**.
   - Antes de excluir, checar vínculos em `sales`, `client_products`, `contracts`, `commissions`, `documents`, `leads`, `payments`, etc.
   - Se houver vínculo, não chamar `.delete()`; mostrar mensagem clara e desativar o produto para ele sair das listas ativas sem perder histórico financeiro.
   - Ajustar o banco para permitir histórico preservado onde fizer sentido, evitando erro cru tipo `sales_product_id_fkey` na tela.

2. **Comunicação correta entre admin, parceiro, colaborador e demandas**
   - Revisar e corrigir os fluxos de criação/conversão:
     - Lead com colaborador responsável vira cliente com `collaborator_id` e `responsible_id` corretos.
     - A demanda criada na conversão recebe `responsible_employee_id`.
     - Tarefa criada na conversão recebe `assigned_to` do colaborador correto.
     - Cliente criado com colaborador propaga para demandas novas e antigas sem responsável.
   - Criar/ajustar triggers de banco para manter esses vínculos mesmo que alguma tela esqueça de enviar o campo.
   - Auditar as queries do `CollaboratorPanel` para ele ver e contar apenas clientes, demandas, tarefas e documentos vinculados ao próprio usuário.
   - Rodar consultas de verificação para achar registros já existentes sem responsável e corrigir via migration/SQL seguro quando for regra estrutural.

3. **Mobile admin de verdade, começando pela página de Leads e aplicando globalmente**
   - Reestruturar `/leads` para mobile:
     - Header com ações em scroll horizontal controlado.
     - Filtros e busca em largura total.
     - Kanban com colunas que não cortam, scroll horizontal suave e cards legíveis.
     - Tabela com scroll horizontal e paginação responsiva.
   - Corrigir modais de Leads/conversão/produtos para:
     - `max-height` real em `100svh`.
     - Scroll interno funcional.
     - Footer/botões sempre alcançáveis no celular.
     - Grids `grid-cols-2` virando 1 coluna no mobile.
   - Revisar componentes base (`Dialog`, `Select`, `Dropdown`, `Popover`, `Sheet`, `Tabs`, `Table`) para menus e opções não ficarem cortados.

4. **Validação final**
   - Testar o fluxo real: criar lead/cliente com colaborador, converter lead, criar demanda, criar tarefa, abrir conta do colaborador e validar contagens/listas.
   - Testar mobile em viewport pequeno na página de Leads e principais telas admin afetadas.
   - Confirmar que excluir produto usado não quebra mais e vira arquivamento/desativação segura.