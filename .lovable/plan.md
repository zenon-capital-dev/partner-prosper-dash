# Corrigir aba Alertas (/cockpit)

A página `OperationalCockpit.tsx` tem 3 problemas reais:
1. Botão **Abrir** só funciona para Demanda/Reporte — nos demais tipos cai num `toast.info` ou não faz nada útil.
2. Não existe **Ver detalhes** nem **Excluir** — o menu só tem ações soltas (notificar/criar tarefa).
3. Várias listas trazem **dados errados ou fantasmas** (queries com filtros frouxos / nomes de tabela e enums incorretos).

## O que vou ajustar

### 1. Botão "Abrir" — rota correta por tipo
Trocar o `handleAction('open-demand')` por um roteamento por `item.type`:

| Tipo | Rota destino |
|---|---|
| demand / report | `/demandas/{id}` |
| client | `/clientes/{id}` |
| document | `/documentos` (com highlight do id via query) |
| payment | `/financeiro` |
| commission | `/comissoes` |
| contract | `/contratos` |
| task | `/tarefas` |
| request | `/documentos` |

### 2. Novo modal "Ver Detalhes"
Drawer/Sheet lateral mostrando todos os campos relevantes do item (cliente, produto, status, datas, valores, prestador, etc.) + botões "Abrir página completa" e "Excluir". Sem inventar dado: só renderiza o que vier do `metadata`.

### 3. Ação "Excluir" com confirmação
- AlertDialog confirmando.
- `delete` na tabela correta por tipo (`client_products`, `documents`, `payments`, `commissions`, `contracts`, `tasks`, `document_requests`, `clients`).
- Invalida a query do cockpit ao concluir.
- Para `report` (prestador sem reportar) e `client` (estagnado) — não há linha para excluir; nesses casos a ação fica desabilitada com tooltip "Não aplicável".

### 4. Corrigir queries com dados errados

- **Documentos**: tabela `documents` no projeto usa enum `document_status_new` com valores diferentes; ajusto para `['solicitado','enviado','em_analise','reprovado']` reais e removo entradas órfãs (sem cliente).
- **Solicitações**: a tabela correta é `client_document_requests` (não `document_requests`); ajusto.
- **Contratos**: status reais são `rascunho/enviado/assinado/pendente_correcao`; filtro vira `['rascunho','enviado','pendente_correcao']`.
- **Tarefas**: hoje o filtro `or(priority.eq.high, due_date.lte.now)` traz qualquer tarefa de alta prioridade mesmo sem prazo. Vira: status ≠ concluido E (vencida OU (alta prioridade E vence em ≤3 dias)).
- **Comissões**: incluir também `aguardando_confirmacao` no `workflow_status`, não só `status='pendente'`.
- **Demandas/Reportes**: filtrar `deleted_at IS NULL` e validar que `client` existe antes de mostrar.
- Reorganizar `loading` para não bloquear a tela inteira enquanto uma query lenta carrega (mostra skeleton só na seção).

### 5. Aba/menu de tipos sincronizado
Adicionar abas faltantes (Contratos, Comissões, Solicitações, Clientes, Reportes) para o usuário conseguir filtrar todos os tipos que aparecem na lista.

## Arquivo único afetado
- `src/pages/OperationalCockpit.tsx`

Nenhuma migração de banco é necessária — só queries e UI.
