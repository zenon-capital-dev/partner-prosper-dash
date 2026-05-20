## Reformulação do cadastro de Serviço (Produto)

Vou reconstruir o dialog "Novo Serviço" e transformar a ficha do produto em um **hub completo** — depois de criado, o serviço abre uma página própria onde dá pra setar tudo (prestadores habilitados, colaboradores, cliente, contrato vinculado, etc.) sem precisar abrir outras telas.

---

### 1. Remover Categoria de tudo

- Apagar aba/seleção de Categoria do dialog
- Apagar botão "Categorias" e o modal de gestão na página `/produtos`
- Apagar filtro de categoria nos chips
- Apagar coluna "Categoria" das tabelas/cards
- Apagar tabela `product_categories` + coluna `category_id` em `products` (migration)

### 2. Dialog "Novo Serviço" enxuto (3 abas só)

**Aba 1 — Identificação** (criação rápida)
- Nome do serviço *
- Descrição curta (visível pra cliente e prestador)
- Switches: Ativo · Recorrente · Permite parceiros
- Botão "Criar Serviço" salva o mínimo e abre a ficha completa

**Aba 2 — Operação**
- Documentos exigidos (chips com Enter)
- Etapas do processo (checklist)
- SLA: dias + tipo (úteis/corridos)
- Status inicial da demanda

**Aba 3 — Financeiro**
- Valor padrão (R$)
- Tipo de cobrança: único / mensal / anual / **parcelado**
- Se parcelado: nº de parcelas padrão · valor de entrada · dia de vencimento
- Comissão parceiro (%) · Comissão colaborador (%) · Pagamento ao prestador (R$)

**Remover:**
- Aba Comunicação inteira (mensagens viram template global em outro lugar)
- Aba Automação inteira (campos customizados e tarefas automáticas — pouco uso)
- Cards "Sugestões rápidas" no topo
- Campo "Tipo de prestador recomendado" (texto livre que ninguém preenche)

### 3. Ficha do Serviço — nova rota `/produtos/:id`

Depois de criar, clicar num serviço abre uma página dedicada (não mais só o dialog de edição). Layout com header + 5 abas:

**Header**
- Ícone + Nome + status (Ativo/Inativo)
- KPIs em linha: Vendas totais · Receita gerada · Demandas ativas · Prestadores habilitados · Ticket médio
- Ações: Editar · Duplicar · Desativar/Ativar · Excluir

**Aba "Visão Geral"**
- Resumo dos dados (descrição, valor, SLA, tipo cobrança)
- Gráfico de vendas dos últimos 90 dias
- Últimas 5 demandas geradas

**Aba "Prestadores"** ← uma das peças que falta
- Lista de prestadores habilitados a atender esse serviço (tabela `partner_products` reaproveitada → renomeada conceitualmente)
- Botão "Vincular prestador" → busca de prestadores ativos
- Por linha: nome, especialidade, % comissão custom, valor custom, ativo, ações (remover)
- Tabela técnica nova: `service_provider_products` (provider_id + product_id + commission_percent + custom_value + active)

**Aba "Colaboradores"** ← outra peça que falta
- Lista de colaboradores internos habilitados a executar
- Botão "Vincular colaborador"
- Tabela nova: `collaborator_products` (collaborator_id + product_id + active)

**Aba "Clientes"**
- Lista de clientes que já compraram esse serviço (read-only, vem de `sales`/`client_products`)
- Clique vai pra ficha do cliente

**Aba "Contrato vinculado"**
- Upload/seleção de modelo de contrato padrão pra esse serviço
- Quando o serviço for vendido, esse modelo já vem pré-selecionado na geração do contrato
- Tabela nova: `contract_templates` (id, name, file_path, content, active) — coluna `default_contract_template_id` em `products`

**Aba "Operação"**
- Edita documentos exigidos, etapas (checklist), SLA — espelha o que está no dialog mas in-place

### 4. Lista `/produtos`

- Tirar coluna Categoria e filtros relacionados
- Trocar clique do nome: em vez de abrir dialog de edição, **navegar pra `/produtos/:id`**
- Manter "Novo Serviço" → dialog rápido (só aba Identificação) → ao salvar redireciona pra ficha

### 5. Backend (migrations necessárias)

```sql
-- 1. Remover dependência de categoria
ALTER TABLE products DROP COLUMN category_id;
DROP TABLE product_categories CASCADE;

-- 2. Novas tabelas de vínculo
CREATE TABLE service_provider_products (...);  -- prestador ↔ produto
CREATE TABLE collaborator_products (...);       -- colaborador ↔ produto
CREATE TABLE contract_templates (...);          -- modelos de contrato

-- 3. Novas colunas em products
ALTER TABLE products
  ADD COLUMN default_contract_template_id uuid,
  ADD COLUMN installments_count int,
  ADD COLUMN installments_entry numeric,
  ADD COLUMN installments_due_day int;

-- 4. RLS: só admin/admin_secondary gerencia; prestador/colaborador SELECT do que está vinculado a ele
```

### 6. O que sai do escopo agora

- Mensagens automáticas de boas-vindas (WhatsApp/e-mail) — vira projeto separado
- Imagem/capa do serviço — vira projeto separado
- Campos personalizados e tarefas automáticas — descontinuados

---

**Resumo:** dialog enxuto pra criar rápido, ficha completa em `/produtos/:id` com 5 abas pra fazer **tudo** sobre o serviço sem sair da tela (incluindo amarrar prestador, colaborador, cliente e contrato). Categoria some por completo.