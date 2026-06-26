## Objetivo
Deixar óbvio para qualquer usuário (e para o consultor) que as funcionalidades já existem: **receita recorrente vs pontual** e **caixinhas de recursos/projetos**. Sem recriar nada, só reorganizar rótulos, destaques e navegação.

## O que vamos fazer

### 1. Receita / Tipo de receita (vendas e dashboard)
- **Vendas / VendaFormDialog**: trazer a seção "Tipo de Receita" para o topo do formulário, logo após o cliente e o produto, com rótulos mais didáticos:
  - "Avulso (na cabeça)" → "Pontual / Avulso"
  - "Recorrente (mensal)" → "MRR — Recorrência mensal"
  - Quando selecionar MRR, destacar o campo "Meses de vigência" com explicação em texto: "Período de vigência: o cliente será cobrado automaticamente por X meses."
- **Lista de Vendas**: mover a coluna/badges Tipo para a esquerda, junto ao status, e usar cores mais distintas (azul para MRR, cinza para Avulso).
- **Dashboard**: alterar labels dos minikpis para:
  - "MRR ATIVO" → "MRR Ativo (receita recorrente)"
  - "RECEITA NA CABEÇA (MÊS)" → "Receita Pontual (mês)"
  - Adicionar tooltip curto explicando cada um.
- **Finance Center / Mapa de Receitas**: adicionar legenda explicando "Recorrente = MRR ativo / Avulso = receita pontual".

### 2. Caixinhas de Recursos / Projetos
- **Sidebar**: renomear menu "Caixinhas" para "Caixinhas & Projetos" e movê-lo para a seção Financeiro, mas com ícone/coloração diferenciada para não parecer submenu escondido.
- **Página ResourcePools**: no topo, adicionar um header explicativo: "Acompanhe o quanto já arrecadou para cada projeto. Valores podem ser lançados manualmente ou creditados automaticamente quando uma venda vinculada é paga."
- **Cards das caixinhas**: deixar a barra de progresso maior e sempre visível, mostrar o status ("Em captação / Meta atingida / Iniciado") como badge colorido e incluir botão "+ Lançar valor" sempre visível.
- **SaleFormDialog**: deixar o campo "Projeto (Caixinha)" como Section própria, com ícone de cofrinho, e explicar: "Se vincular a uma caixinha, o valor líquido creditará automaticamente o projeto quando a venda for finalizada e paga."
- **Dashboard**: adicionar um card "Caixinha com maior progresso" ou link rápido para `/financeiro/caixinhas` dentro do GoalsPanel ou ao lado do MRR.

## O que NÃO vamos fazer
- Não criar tabelas novas.
- Não alterar lógica de geração de parcelas ou trigger de crédito automático.
- Não mudar cores fora do sistema de tokens (mantemos primary, indigo, emerald, slate).

## Critério de pronto
- Usuário abre o formulário de venda e vê imediatamente a escolha "Pontual vs Recorrente" com campo de vigência.
- Usuário abre o dashboard e entende o que é MRR e o que é receita pontual.
- Usuário abre o sidebar e encontra "Caixinhas & Projetos" sem procurar.