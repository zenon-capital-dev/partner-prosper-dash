# Corrigir aba Demandas (/demandas)

A página atual (`src/pages/Demands.tsx`) tem 4 bugs reais:

1. **Botão "Nova Demanda" não cria nada** — apenas faz `navigate("/clientes")`, jogando o usuário para a lista de clientes.
2. **Filtro padrão "HOJE" esconde tudo** — filtra por `created_at = hoje`, então quase nenhuma demanda aparece. Pior: o filtro de período se aplica à data de criação da demanda, não à atividade.
3. **Kanban quebrado** — as 8 colunas usam status (`aguardando_inicio`, `aguardando_documentos`, `em_analise`, `em_execucao`, `pendente_cliente`, `pendente_prestador`, `aguardando_aprovacao_final`, `concluido`) que **não existem** nos dados (no banco hoje as demandas têm `em_andamento`, `pausado`, `concluido`, `cancelado`). Resultado: nenhum card aparece nas colunas e mover uma demanda grava um status inválido.
4. **Mistura `deadline` x `sla_due_date`** — a lista mostra `deadline`, o filtro de prazo lê `sla_due_date`, então o filtro nunca casa.

## O que vou ajustar (somente UI / queries — sem migração)

### 1. Dialog "Nova Demanda" real
- Reaproveitar `AddProductDialog` (que já cria `client_products` + `sales` + steps).
- Antes do dialog abrir, mostrar uma etapa de **seleção de cliente** com busca (`SearchableCombobox` ou Select com lista de clientes).
- Depois de escolher o cliente, abre o `AddProductDialog` com `clientId`.
- Ao concluir, invalidar `["admin-demands"]`.

### 2. Período padrão e semântica
- Trocar default para **"30 DIAS"** (faz mais sentido para central operacional).
- O filtro de período passa a usar `updated_at` (atividade), e não `created_at`. Mantém "TUDO" como hoje.

### 3. Status reais + Kanban funcional
- Trocar as colunas do Kanban para os status que existem de fato:
  `aguardando_inicio`, `em_andamento`, `pausado`, `concluido`, `cancelado`.
- Adicionar **agrupamento tolerante**: qualquer status fora dessa lista cai numa coluna "Outros" para o usuário enxergar e poder mover.
- O select de filtro de status passa a refletir esses valores reais.
- O drag-and-drop continua gravando o `status` em `client_products`.

### 4. Filtro de prazo coerente
- Padronizar em `sla_due_date OR deadline` (usa o que estiver preenchido) tanto no display da lista/kanban quanto no filtro "Atrasado / Hoje / Semana".

### 5. Pequenas correções de UX
- Após criar uma demanda, manter o usuário na aba "Demandas operacionais" e dar foco na nova linha (toast com link "Abrir").
- Mostrar mensagem clara quando o filtro do período esconde dados ("Nenhuma demanda nos últimos 30 dias — ver TUDO").

## Arquivos afetados
- `src/pages/Demands.tsx` (principal)
- `src/components/clients/AddProductDialog.tsx` (sem mudança de lógica — só será reutilizado; se precisar aceitar um `onCreated` callback, adiciono prop opcional)
- Novo: `src/components/demands/NewDemandDialog.tsx` (wrapper de seleção de cliente + AddProductDialog)

Nenhuma alteração de banco/RLS é necessária — as policies de `client_products` já permitem admin criar/editar/excluir.
