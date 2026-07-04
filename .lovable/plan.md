Vou tratar os 5 pontos do print em sequência. Antes de codar, preciso confirmar alguns detalhes para não fazer errado.

## 1. Dashboard/Início do Prestador — status coloridos nas demandas
Nos cards da tela "Demandas atribuídas" (print 1), aplicar cor semântica no badge de status + borda lateral do card:
- **Vermelho** → SLA vencido (data limite passou) OU status "atrasado"
- **Âmbar** → SLA próximo do vencimento (≤ 3 dias) OU "aguardando cliente" há muito tempo
- **Azul** → "em andamento" no prazo
- **Cinza** → "aguardando início"
- **Verde** → "concluído"

Escopo: `src/pages/ProviderPanel.tsx` (lista de demandas). Sem mudança de lógica de negócio.

## 2. Prestador não consegue lançar "Entrega" (print 2)
Na tela de detalhe da demanda, aba **Entregas**, o prestador só vê "Nenhuma entrega formalizada" e não tem botão para criar. Vou habilitar o botão "Nova entrega" para o prestador responsável pela demanda, respeitando RLS (`client_products.provider_id = auth.uid()` ou responsável). Preciso confirmar 1 coisa:

**Pergunta:** a entrega precisa passar por aprovação do admin antes de virar "entregue", ou o prestador marca direto como entregue e o cliente/admin só visualiza?

## 3. Portal do Cliente — pasta "TODOS OS DOC" (print 3)
Na tela de Documentos do cliente, além das pastas por categoria (FATURAMENTO FISCAL, GERENCIAL, SALES…), adicionar uma pasta virtual fixa no topo chamada **"Todos os documentos"** que lista todos os arquivos do cliente independente da categoria, ordenados por data desc. É só uma view agregada — não cria pasta física no storage.

Escopo: `src/pages/ClientPortal*` / componente de documentos do cliente.

## 4. Admin — flag "Venda finalizada" vs "Em negociação" (print 4)
Hoje toda venda cadastrada já entra no fluxo (gera pendências, aparece em "atuar no cliente"). Precisa separar **projeção** de **venda efetivada**.

Proposta:
- Adicionar coluna `is_finalized boolean default false` (ou usar um enum `sale_stage`: `negociacao | finalizada | perdida`) na tabela `sales`.
- Cards, esteira, financeiro, dashboards do admin passam a **ignorar** vendas com `is_finalized=false` nas métricas de "a atuar / pendências / receita a realizar".
- Vendas em negociação aparecem apenas em uma aba/filtro **"Pipeline / Em negociação"**.
- Botão "Finalizar venda" no detalhe da venda muda a flag e dispara a geração das parcelas/comissões/tarefas (o que hoje acontece na criação).

**Pergunta:** vendas já existentes hoje devem ser marcadas como `finalizada` (mantém tudo como está) ou como `em negociação` (você revisa uma a uma)?

## 5. Central Financeira — filtro por mês fechado (print 5)
Substituir/complementar o seletor atual ("Mês atual", "Últimos 30", etc.) por um **seletor de mês** (Junho/2026, Julho/2026, Agosto/2026…) que filtra todos os KPIs, gráficos e abas da Central por competência daquele mês fechado. Mantém "Mês atual" como opção default.

Escopo: `src/pages/CentralFinanceira*` ou equivalente.

---

## Ordem de execução sugerida
1. Rápidos e independentes: (1) cores no dashboard prestador, (3) pasta "Todos os documentos", (5) filtro por mês.
2. Médio: (2) liberar entrega para prestador.
3. Maior impacto (schema + várias telas): (4) flag venda finalizada.

Posso começar pelos 3 rápidos em paralelo enquanto você responde as 2 perguntas (item 2 e 4). Confirma?