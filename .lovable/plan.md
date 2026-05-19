
## Objetivo

Deixar a plataforma 100% funcional no mobile, com listas paginadas e roláveis sem travamento, scroll consistente após abrir/fechar modais, remoção do widget de AI, e testes E2E que provem que um cliente vinculado a indicador/colaborador/prestador aparece corretamente em todos os painéis envolvidos.

---

## 1. Scroll e layout no mobile (admin + colaborador + prestador)

**Problema atual:** ao fechar Dialog/Sheet/Select do Radix, o `body` pode ficar com `pointer-events: none` ou `overflow: hidden`, travando o scroll. Em telas mobile, várias páginas usam `h-screen`/`overflow-hidden` no container, cortando conteúdo.

**Correções:**
- Criar `src/hooks/use-body-scroll-lock-cleanup.ts` que observa fechamento de overlays Radix e força limpeza de `body.style.pointerEvents` e `body.style.overflow` após 100 ms.
- Aplicar globalmente em `src/App.tsx`.
- Revisar containers das páginas admin (`Clients`, `Demands`, `Financial`, `Commissions`, `Providers`, `Indicators`, `Leads`, `Tasks`) trocando `h-screen overflow-hidden` por `min-h-screen` com áreas roláveis internas (`overflow-y-auto` apenas em listas/tabelas).
- Tabelas grandes ganham wrapper `<div className="overflow-x-auto -mx-4 sm:mx-0">` + versão card no mobile (`md:hidden` cards / `hidden md:block` tabela) onde ainda não existir.
- Modais (`Dialog`, `Sheet`) com conteúdo longo: garantir `max-h-[90vh] overflow-y-auto` no `DialogContent`/`SheetContent`.

## 2. Paginação e filtros das listas

Padronizar nas páginas Clientes, Demandas, Financeiro, Comissões, Parceiros, Indicadores:
- Hook `usePagination` (novo, em `src/hooks/use-pagination.ts`) com page/pageSize/total.
- Componente `PaginationBar` reutilizável (já existe `ui/pagination`, criar wrapper `src/components/common/PaginationBar.tsx`).
- Default `pageSize = 20` desktop, `10` mobile (via `useIsMobile`).
- Filtros (busca, status, responsável) ficam num `<Sheet>` no mobile e numa barra inline no desktop — componente `src/components/common/FiltersBar.tsx`.
- Reset de página ao mudar filtro.

## 3. Remover widget de AI

- Localizar e remover componente de AI Assistant (provavelmente `src/components/ai/*` ou botão flutuante no `AdminLayout`). Remover import, rota e dependências órfãs.

## 4. Fluxo de vínculos cliente → indicador/colaborador/prestador

**Verificação de banco (já existem triggers):**
- `trg_propagate_client_collaborator`: ao mudar `clients.collaborator_id`, propaga para `client_products.responsible_employee_id` e `tasks.assigned_to`.
- Confirmar via SQL que existe trigger equivalente para `indicator_id` e que demandas com prestador (`provider_id` em `client_products`) ficam visíveis no painel do prestador.
- Se faltar, criar trigger `trg_propagate_client_indicator` e ajustar RLS de `client_products` para incluir `EXISTS (clients WHERE indicator_id = auth.uid())`.

**UI:**
- No `ClientFormDialog` (passo Vínculos): exibir selects de Indicador, Colaborador responsável e Prestador padrão. Ao salvar, gravar nas colunas corretas e disparar refetch global (`queryClient.invalidateQueries(['clients','demands','tasks','commissions'])`).
- Garantir que os painéis `/colaborador`, `/prestador` e `/indicador` consultam pelas colunas certas (auditar queries em `CollaboratorPanel`, `ProviderPanel`, `IndicatorPanel`).

## 5. Testes E2E (Vitest + Testing Library, viewport mobile simulado)

Criar `src/test/e2e/`:
- `client-linking-flow.test.tsx`: cria cliente via `ClientFormDialog`, vincula a indicador X, colaborador Y, prestador Z. Faz login mock como cada um e verifica que o cliente aparece em:
  - Admin → Clientes, Demandas, Comissões.
  - Colaborador Y → Minhas Demandas, Clientes (read-only), Tarefas.
  - Indicador X → Meus Indicados, Comissões.
  - Prestador Z → Demandas atribuídas.
- `mobile-scroll.test.tsx`: renderiza páginas-chave em viewport 375px, abre/fecha Dialog/Sheet/Select e verifica que `document.body.style.pointerEvents !== 'none'` e que o scroll do container continua funcional.
- `pagination.test.tsx`: lista com 35 itens em mobile mostra 10 + paginação; ao filtrar, volta para página 1.

Configurar `vitest.config.ts` com setup já existente, adicionar `happy-dom` ou continuar com `jsdom`.

## 6. Validação final

- Rodar `vitest run` e corrigir falhas.
- Inspeção visual no preview mobile (375×812) das páginas listadas.
- Conferir console sem erros e network sem 4xx/5xx em fluxos críticos.

---

## Arquivos previstos

**Novos**
- `src/hooks/use-body-scroll-lock-cleanup.ts`
- `src/hooks/use-pagination.ts`
- `src/components/common/PaginationBar.tsx`
- `src/components/common/FiltersBar.tsx`
- `src/test/e2e/client-linking-flow.test.tsx`
- `src/test/e2e/mobile-scroll.test.tsx`
- `src/test/e2e/pagination.test.tsx`

**Editados**
- `src/App.tsx` (cleanup global)
- `src/pages/Clients.tsx`, `Demands.tsx`, `Financial.tsx`, `Commissions.tsx`, `Providers.tsx`, `Indicators.tsx`, `Leads.tsx`, `Tasks.tsx`
- `src/components/clients/ClientFormDialog.tsx` (refetch + vínculos)
- Painéis: `CollaboratorPanel.tsx`, `ProviderPanel.tsx`, `IndicatorPanel.tsx` (queries auditadas)
- Layout admin (remover botão AI)

**Migração SQL** (se faltarem triggers/RLS)
- Trigger de propagação para `indicator_id`
- Ajuste de RLS em `client_products` para indicador

Posso seguir?
