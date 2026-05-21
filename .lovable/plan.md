# Limpeza geral: health score fora, topbar/busca/criar arrumados, dark mode premium, bugs de dados antigos

## 1. Tirar "Saúde / Health Score / Risco de Cancelamento" de tudo

Some por completo da interface (campo continua existindo no banco pra não quebrar nada, só não aparece mais):

- `src/components/clients/IntelligentSummary.tsx` — remove o bloco do Heart + score + churn risk
- `src/pages/ClientDetail.tsx` — remove o card de health score, o badge de risco e o `<EngagementCard />`
- `src/pages/DashboardAdmin.tsx` — remove qualquer widget que ainda mostre saúde
- `src/components/clients/ClientFormDialog.tsx` — já tirei na última passada, só conferir

## 2. Criação Rápida mais bonita e funcional

Redesenhar o dropdown `QuickCreateButton`:

- Largura maior (288px), padding mais respirado
- Cada item vira card com **ícone colorido em pill** (azul pra cliente, indigo pra demanda, âmbar pra documento, etc.) — não mais ícone cinza solto
- Header com gradiente sutil + descrição curta ("Atalhos para criar registros sem sair da tela")
- Atalho de teclado funcional: registrar listener global pra `C`, `D`, `T`, `U`, `K`, `P`, `R`, `F` (quando nenhum input estiver focado)
- Hover state premium com leve translate

## 3. Topbar mais clean + busca funcionando

**Por que a busca não funciona hoje**: o `AdminLayout` dispara um evento Cmd+K fake, mas o `<GlobalSearch />` **não está montado em lugar nenhum** dentro do shell admin. O componente só existe no `AppLayout` (portal do cliente). Resultado: clicar no campo de busca não faz nada.

Correção:
- Mover/montar `<GlobalSearch />` controlado dentro do `AdminLayout` (estado `searchOpen`, passado pro `AdminHeader`)
- `AdminHeader` chama `setSearchOpen(true)` direto no clique, sem hack de KeyboardEvent
- Atalho Cmd+K listener no próprio AdminLayout

Redesign visual do header:
- Reduzir poluição: remover o badge "Operação online" e o "Central Admin" (não agregam info útil, ocupam espaço)
- Campo de busca: maior (h-11), borda mais sutil, ícone à esquerda mais elegante, kbd hint refinado
- Espaçamento generoso entre breadcrumb, busca e ações
- Botões de ação (theme, chat, notif) padronizados em pills uniformes de 36px

## 4. Bugs de dados antigos ("scanner geral")

Auditoria nos fluxos de delete e nas listagens:

| Entidade | Onde verificar |
|---|---|
| Clients | `Clients.tsx` delete handler + selects em forms |
| Partners | `Partners.tsx`, `PartnerDetail.tsx`, todos `partners-select` queries |
| Collaborators | `Collaborators.tsx` delete + caches |
| Providers | `Providers.tsx`, `service-providers-select` |
| Referrers | `Indicators.tsx` |

Ações:
- Todo delete chama `qc.invalidateQueries()` para **todas** as queryKeys que referenciam aquela entidade (não só a lista da página atual)
- Selects que carregam parceiros/colaboradores/etc filtram `active=true` (alguns já fazem, outros não — vou padronizar)
- Listagens principais filtram `active=true` por padrão, com toggle "Mostrar inativos" pra admin
- Onde o delete é só soft-delete (set active=false), garantir que os triggers/queries dependentes (commissions, sales) também respeitem o flag

Não vou dropar dados existentes — só esconder corretamente. Se tiver órfãos no banco (ex.: partner_id apontando pra parceiro deletado), faço uma migration de cleanup opcional ao final.

## 5. Dark mode premium (azul escuro mais clarinho)

Hoje o dark está **quase preto puro** — agressivo e cansativo. Vou mudar a paleta CSS em `src/index.css`:

```css
.dark {
  --background: 222 28% 11%;     /* navy escuro suave (era ~5% lightness) */
  --card: 222 26% 14%;
  --popover: 222 26% 15%;
  --muted: 222 22% 18%;
  --accent: 222 22% 20%;
  --border: 222 20% 22%;
  --foreground: 220 15% 92%;
  --primary: 231 80% 64%;        /* indigo mais brilhante pra contrastar */
}
```

Tom = "Linear dark mode" — azul-marinho premium em vez de preto. Texto fica mais legível, cards se destacam do fundo, bordas visíveis sem agredir.

## Fora de escopo

- Reescrever inteiro nenhum dashboard
- Mudar o tema light (continua o admin claro premium)
- Renomear/remover colunas do banco (`health_score`, `churn_risk` ficam lá, só não aparecem)

Confirma que posso executar? Se quiser que eu mantenha health score em **alguma** tela específica (tipo só na ficha do cliente), me avisa antes.
