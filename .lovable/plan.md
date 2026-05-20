# Substituir Kanban arrastável por "Pipeline de Trabalho"

## Problema atual
O Kanban tem 8 colunas que rolam horizontalmente (terrível no mobile), exige drag-and-drop pra mudar status e o que aparece é "Solte um lead aqui" — zero utilidade pra rotina diária.

## Nova visão "Pipeline" — pensada pro dia a dia

Substitui o componente `LeadsKanban` por um **`LeadsPipeline`** com 3 partes empilhadas (sem arrastar nada):

### 1. Bloco "Pra agir hoje" (topo, sempre visível)
Lista compacta com os leads que pedem ação agora — ordenados por prioridade:
- Leads com `next_action_date` ≤ hoje
- Leads "Novo" sem contato há mais de 24h
- Leads em "Negociação" / "Proposta enviada" sem follow-up há 3+ dias
- Leads quentes (`close_probability ≥ 70%`)

Cada linha mostra: avatar, nome, status atual (badge), próxima ação, valor estimado, e 4 botões de ação rápida à direita:
- **WhatsApp** (abre wa.me com mensagem template)
- **Ligar** (tel:)
- **Mudar status** (Select inline — troca direto sem dialog)
- **Converter** (quando aplicável)

Se vazio: "Nada pendente. Bom trabalho!"

### 2. Funil agrupado (accordion)
Resto dos leads agrupados por status em accordions colapsáveis. Cada grupo mostra:
- Header: status + contagem + valor total (R$ somado dos `estimated_value`)
- Lista vertical das linhas (mesmo layout do bloco acima)
- Mudar status = Select inline (não tem drag, não tem "solte aqui")

Por padrão os grupos ativos (Novo, Em contato, Negociação) ficam abertos e Fechado/Perdido fechados.

### 3. Resumo lateral / topo do funil (KPI bar fina)
Barra horizontal com taxa de conversão por etapa:
`Novo 12 → Contato 8 (67%) → Proposta 5 (62%) → Fechado 2 (40%)`
Visual: barras finas indigo com % entre etapas. Ajuda o vendedor a ver onde está perdendo leads.

## Detalhes técnicos
- Novo arquivo: `src/components/leads/LeadsPipeline.tsx` (substitui `LeadsKanban` no botão "Kanban", que renomeio para **"Pipeline"**).
- Reusa o componente `StatusBadge` + `EmptyState` da Onda 2.
- Select inline usa `@/components/ui/select` com mutation otimista (mesma `moveLead` da versão atual, sem dragId/overCol).
- Mensagem template WhatsApp vem de `system_settings` se existir, senão padrão "Olá {nome}, tudo bem?".
- `LeadsKanban.tsx` antigo fica deletado.

## Mobile-first
- Tudo em coluna única vertical, nada de scroll horizontal.
- Botões de ação viram um menu "•••" abaixo de 640px pra economizar espaço.
- Accordions com header sticky.

Posso implementar?
