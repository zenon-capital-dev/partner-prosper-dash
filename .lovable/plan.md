## Objetivo

Resolver de uma vez por todas (1) os bugs que aparecem ao abrir as abas do painel admin — cores escuras vazando, ações sem responder e drawers/modais travando — e (2) aplicar máscara CPF/CNPJ, CEP e telefone em **todos** os formulários, não só nos de cliente.

---

## Parte 1 — Bugs de UI nas abas

### 1.1. Cores escuras / tema errado vazando
Auditar todos os componentes admin (Parceiros, Indicadores, Clientes, Ficha do Cliente, Prestadores) e remover qualquer resquício de classes escuras herdadas do tema antigo. Padronizar 100% para o tema claro premium definido na memória do projeto:
- Fundo de página: `bg-slate-50/60`
- Cards: `bg-white border-slate-200/70 rounded-lg shadow-sm`
- Botões e badges com cores indigo/slate (sem violet/cyan/obsidian)
- Substituir qualquer `bg-zinc-900`, `bg-slate-900`, `bg-black`, `text-white` perdido em headers/abas internas

Arquivos prováveis de varredura:
- `src/pages/Partners.tsx`, `PartnerDetail.tsx`, `PartnerDetailDrawer.tsx`
- `src/pages/Indicators.tsx`
- `src/pages/Providers.tsx`, `ProviderDetail.tsx`
- `src/pages/Clients.tsx`, `ClientDetail.tsx` e `src/components/clients/tabs/*`

### 1.2. Botões/ações que não funcionam
Para cada página listada, verificar:
- Handlers de editar/excluir/salvar conectados aos botões corretos
- `confirmAction` envolvendo deletes
- Invalidação de queries do React Query após mutação (chaves corretas)
- Permissões `canManage = isAdmin || isAdminSecondary` aplicadas sem bloquear admin principal

### 1.3. Modais e drawers travando
- Confirmar que o overlay claro (`bg-slate-900/40 backdrop-blur-sm`) está aplicado em `dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx` (já feito)
- Garantir que `useBodyScrollCleanup` é chamado quando dialogs fecham, evitando scroll preso e cliques mortos
- Conferir `z-index` (usar `src/lib/z-index.ts`) para sheets sobre dialogs em abas que abrem detalhes dentro de detalhes (ex.: editar empresa dentro da ficha do cliente)
- Remover `pointer-events: none` residual em `body` após fechar modal (causa principal de "nada clica depois")

---

## Parte 2 — Máscaras BR em todos os campos

Aplicar `<MaskedInput mask="cpfcnpj|cep|phone" />` (já existe em `src/components/ui/masked-input.tsx`) em todos os formulários onde hoje ainda há `<Input>` cru. Salvar sempre só os dígitos (`onlyDigits`) e exibir formatado via `format-display.ts`.

Arquivos identificados na varredura que precisam migrar:

| Arquivo | Campos |
|---|---|
| `src/pages/UsersPage.tsx` | telefone, documento, CEP (form novo usuário + drawer endereço) |
| `src/pages/Partners.tsx` | documento, telefone |
| `src/pages/Indicators.tsx` | documento, telefone |
| `src/pages/Proposals.tsx` | recipientDocument (CPF/CNPJ) |
| `src/pages/Collaborators.tsx` | revisar telefone/documento |
| `src/components/leads/LeadFormDialog.tsx` | revisar documento (telefone já tem máscara) |
| `src/components/clients/CompanyContactsManager.tsx` | telefone do contato |
| `src/components/provider/ProviderAtuacao.tsx` | revisar se há campos de doc |

Padronizar também:
- Exibição em tabelas (`formatDoc`, `formatPhone`, `formatCEP`)
- Validação com `isValidCPFOrCNPJ` / `isValidPhoneBR` antes do submit
- Hook `useCepLookup` no campo CEP para preencher endereço automaticamente em todos os formulários com endereço (Usuários, Parceiros, Indicadores)

---

## Entrega final
- Varredura completa nas abas reclamadas (Parceiros, Indicadores, Clientes/Ficha, Prestadores e demais do menu admin)
- Tema 100% claro premium sem vazamento de cores escuras
- Modais/drawers abrindo, fechando e liberando a UI corretamente
- Máscaras CPF/CNPJ, CEP e telefone aplicadas em todos os formulários listados, com validação e busca de CEP onde fizer sentido
