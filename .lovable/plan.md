## Plano: Painéis Premium (Colaborador, Prestador, Parceiro, Indicador, Cliente) + Fix exclusão de produto

### 1. Correção: Exclusão de Produto/Serviço
**Problema:** `delete().eq("id", p.id)` falha por FK (sales, client_products, commissions, etc.) — toast atual diz "Use Desativar", mas não há fallback real.

**Solução:**
- Criar RPC `admin_delete_product_cascade(_product_id uuid)` análoga a `admin_delete_client_cascade`: remove client_products, documents, tasks, product_steps, custom_fields, service_provider_products, collaborator_products vinculados; se houver venda concluída, recusa e retorna mensagem clara para desativar.
- Botão de exclusão passa a abrir AlertDialog: "Excluir definitivamente" vs "Apenas desativar (recomendado)".
- Adicionar coluna `active boolean` (já existe `is_active`) — usar essa flag.

### 2. Refatoração dos 5 Painéis — Conceito "Site Premium"
Cada painel vira uma **landing-app**: hero personalizado com saudação + KPIs grandes, seções em cards com glass/gradient sutis, navegação inferior fixa no mobile (bottom tab bar estilo iOS), header sticky compacto, animações suaves (Framer Motion fade/slide), tipografia Inter + JetBrains Mono nos números, paleta clara premium (indigo/violet accent sobre slate-50, igual ao admin já memorizado para esses usuários externos teremos um tema PRÓPRIO mais quente — slate-50 base + accent indigo-600 + gradientes pastel por papel).

Estrutura nova compartilhada:
- `src/components/panels/PanelShell.tsx` — layout responsivo (sidebar desktop / bottom-nav mobile + top header com avatar, notificações, busca)
- `src/components/panels/PanelHero.tsx` — hero com saudação dinâmica, métrica destaque, ilustração SVG por papel
- `src/components/panels/KpiCard.tsx`, `SectionCard.tsx`, `EmptyState.tsx`, `MobileBottomNav.tsx`
- Cores accent por papel: Colaborador=indigo, Prestador=teal, Parceiro=violet, Indicador=amber, Cliente=blue

#### 2.1 CollaboratorPanel (`/colaborador`)
- Hero: "Olá, {nome}" + tarefas hoje, demandas ativas, SLA crítico
- Tabs: Visão geral · Minhas Demandas · Tarefas · Clientes · Documentos · Perfil
- Cada demanda mostra cliente, produto, etapa atual, SLA, próxima ação — card com timeline mini
- Tarefas: kanban simplificado (A fazer / Em andamento / Concluído) com drag opcional, no mobile vira lista swipeable
- Sem link de indicação

#### 2.2 ProviderPanel (`/prestador`)
- Hero teal: demandas atribuídas, prazo médio, avaliação
- Tabs: Visão geral · Demandas · Reportar Status · Documentos · Faturamento · Perfil
- Form de reportar status com upload de comprovante
- Sem link de indicação

#### 2.3 PartnerPanel (`/parceiro`)
- Hero violet: comissões do mês, comissões pendentes, total pago
- Tabs: Visão geral · Meus Clientes · Comissões · Extrato · Perfil
- Gráfico simples (recharts) de comissões últimos 6 meses
- **Sem link/aba de indicação** (remover qualquer botão "Indicar")

#### 2.4 ReferrerPanel (`/indicador`)
- Hero amber: indicações ativas, conversão, ganhos
- Tabs: Visão geral · Minhas Indicações · Histórico · Perfil
- Sem botão "Nova Indicação WhatsApp" — apenas acompanhamento. Remover o link de indicação adicionado anteriormente.

#### 2.5 ClientPanel (`/cliente`)
- Hero blue: status do serviço atual, próxima ação requerida, % progresso
- Tabs: Visão geral · Meus Serviços · Documentos · Contratos · Pagamentos · Suporte · Perfil
- Documentos com upload drag-and-drop, status colorido, prazo
- Mobile: bottom nav com 5 ícones principais

### 3. Mobile
- Todos os painéis ganham `MobileBottomNav` com 5 itens fixos
- Header colapsa para 56px no mobile, esconde labels longos
- Cards full-width com padding reduzido (`px-4` no mobile vs `px-8` no desktop)
- Sidebar desktop vira Sheet (drawer) no mobile, acessível via menu hamburger
- Testar em 375px, 768px, 1280px

### 4. Arquivos a criar/editar
**Criar:**
- `src/components/panels/PanelShell.tsx`
- `src/components/panels/PanelHero.tsx`
- `src/components/panels/KpiCard.tsx`
- `src/components/panels/SectionCard.tsx`
- `src/components/panels/MobileBottomNav.tsx`
- `src/components/panels/EmptyState.tsx`
- `supabase/migrations/<ts>_admin_delete_product_cascade.sql`

**Reescrever do zero:**
- `src/pages/CollaboratorPanel.tsx`
- `src/pages/ProviderPanel.tsx`
- `src/pages/PartnerPanel.tsx`
- `src/pages/ReferrerPanel.tsx`
- `src/pages/ClientPanel.tsx`

**Editar:**
- `src/pages/Products.tsx` — novo dialog de exclusão (excluir cascade vs desativar)
- `src/pages/ProductDetail.tsx` — mesma lógica
- `src/index.css` — adicionar tokens de accent por papel (`--accent-collab`, `--accent-provider`, etc.)

### 5. Não-mudanças
- Admin (`/admin/*`) permanece intacto (tema claro premium B2B já aprovado)
- Esquema de banco existente não muda (apenas RPC nova)
- Auth e roteamento permanecem

### Diagrama de navegação mobile (todos os painéis)
```text
┌─────────────────────┐
│  Header (56px)      │ ← avatar, sino, menu
├─────────────────────┤
│                     │
│   Hero + conteúdo   │
│   (scroll)          │
│                     │
├─────────────────────┤
│ 🏠 📋 ✅ 📄 👤      │ ← bottom nav (64px, safe-area)
└─────────────────────┘
```

### Estimativa
~7 arquivos novos, 5 reescritos, 3 editados, 1 migração. Trabalho grande mas focado.