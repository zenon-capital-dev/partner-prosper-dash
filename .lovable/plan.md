# Plano: Compartilhamento em massa, Suporte para todos e painéis renovados

## 0. Correções urgentes (vistas nas prints)
- **Erro ao salvar Venda e Cliente** ("collaborator_id_fkey"): o campo Colaborador manda o ID do login da pessoa, mas o sistema espera o ID do cadastro de colaborador. Ajustar a lista de colaboradores nos formulários de Venda e Cliente para usar o cadastro correto (e converter automaticamente quando vier o ID do login), assim Nova Venda e Novo Cliente voltam a salvar.

## 1. Compartilhar documentos com vários prestadores de uma vez
- Na pasta de documentos do cliente/demanda: marcar vários arquivos (ou a pasta inteira / "TODOS OS DOC") e clicar **"Compartilhar com prestadores"**.
- Abre uma janela para escolher **vários prestadores de uma vez** (busca por nome, empresa, especialidade + "selecionar todos").
- Opções: permitir download, mensagem, prazo de expiração.
- Cada prestador recebe notificação e vê os documentos numa nova aba **"Documentos compartilhados"** do painel dele, sem ver quem mais recebeu.
- Lista de "Já compartilhado" com status (enviado / visualizou) e botão de revogar.
- Também disponível dentro da demanda (já existe parte disso — será ampliado para escolher arquivos específicos).

## 2. Suporte para Colaboradores e Prestadores
- Nova aba **Suporte** no painel do Colaborador e do Prestador: abrir chamado (assunto, categoria, prioridade, anexo) e conversar com a equipe.
- No admin, em **Suporte**, novas abas **Colaboradores** e **Prestadores**, com o mesmo modelo de fila (Fila, Meus, Pendentes, Em andamento, Fechado).
- Notificação para admins em novo chamado/mensagem e para o usuário quando o admin responder.

## 3. Painéis renovados (Colaborador e Prestador)
- **Início**: cartões com números reais clicáveis (Demandas abertas, SLA atrasado em vermelho, Tarefas, Vencem hoje), lista "Para agora" priorizada por atraso, demandas em destaque com cores de status, atividade recente.
- **Demandas**: lista com filtros (status, cliente, atraso), cores por status, acesso rápido aos documentos da demanda.
- **Tarefas**: agrupadas por Hoje / Atrasadas / Próximas, concluir com um clique.
- **Documentos**: pastas por cliente + "Compartilhados comigo".
- **Perfil** mais completo e **Suporte** (item 2).
- Visual mais refinado e consistente (tema claro premium), estados vazios melhores, carregamento com esqueleto, tudo funcionando bem no celular.
- No admin, telas de **Colaboradores** e **Prestadores** com cartões de desempenho (demandas ativas, atrasos, entregas no mês) e ações rápidas.

## 4. Verificação
- Testar de verdade: criar venda e cliente com colaborador; compartilhar 3 arquivos com 2 prestadores e conferir no painel de cada um; abrir chamado como colaborador e prestador e responder como admin.

## Detalhes técnicos
- FK `sales/clients.collaborator_id -> employees.id`: corrigir selects nos formulários (`SaleFormDialog`, `ClientFormDialog`) para usar `employees.id`.
- Nova tabela `document_shares` (document_id, provider_id, shared_by, can_download, expires_at, message, viewed_at) com GRANTs + RLS: admin gerencia; prestador lê só os seus (via `is_provider_owner`). Política de leitura em `storage.objects` para arquivos compartilhados não expirados. Trigger de notificação.
- Generalizar suporte: tabelas `support_tickets` / `support_ticket_messages` com `requester_role` ('colaborador'|'prestador'), RLS por `requester_id = auth.uid()` + admin; triggers de notificação reaproveitando `notify_admins`.
- Componentes novos: `BulkShareDocumentsDialog`, `SharedWithMeDocuments`, `SupportCenter` (usuário) e reaproveitar `SupportThread` no admin; refatorar `CollaboratorPanel.tsx` e `ProviderPanel.tsx` em subcomponentes menores.
