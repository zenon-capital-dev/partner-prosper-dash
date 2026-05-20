## Aba Usuários — Reformulação completa

Refatorar `src/pages/UsersPage.tsx` + edge function `invite-user` para resolver bugs, aplicar o tema light premium do admin e mudar o fluxo de reset de senha (admin define a senha, não envia email).

### Bugs e problemas atuais
- UI ainda usa `vx-card`, `bg-muted/40`, `font-display`, `bg-primary-muted` (fora do padrão indigo/slate do admin).
- Lista mostra só 6 colunas — falta documento, endereço, papéis múltiplos, vínculo (cliente/parceiro/prestador), último acesso, data de criação legível.
- Não dá pra **editar** detalhes do usuário (nome, telefone, documento, endereço, notas, status). Só dá pra trocar papel e ativar/desativar.
- Select de papel não inclui `vendedor`/`indicador` (mas a PRIORITY array tenta usar).
- "Resetar senha" hoje **envia email** — o usuário quer **definir senha manualmente** ali mesmo.
- `setRole` apaga TODOS os papéis (mesmo se o usuário tem múltiplos) — só deveria substituir o papel principal.
- Após convidar, o form é resetado pra `{ active: true }` perdendo `send_invite/has_system_access`.
- Sem confirmação em ações destrutivas (desativar, bloquear login, reset senha).
- Sem paginação, sem loading skeleton, sem empty state, busca não normaliza acentos.
- Sem filtros (por papel, status, com/sem acesso).
- Sem botão de copiar email, sem visualização de "último login" (vem de `auth.users.last_sign_in_at`).
- Edge function `invite-user` não tem ação separada de "set password" — vou adicionar.

### Plano

**1. Edge function `invite-user` — adicionar modo `action`**
- Aceitar `action: "invite" | "set_password" | "update_profile" | "delete"` (default `"invite"` mantém retrocompatibilidade).
- `set_password`: admin envia `user_id` + `password` → chama `auth.admin.updateUserById` com senha + `email_confirm: true`. Retorna sucesso.
- `update_profile`: admin envia `user_id` + campos → upsert em `profiles` (todos os campos editáveis).
- `delete`: admin envia `user_id` → `auth.admin.deleteUser` (cascade limpa profile/roles).
- Retornar também `last_sign_in_at` no listUsers para enriquecer a query do front.

**2. Nova edge function `list-users-detailed` (ou estender `invite-user` com `action: "list"`)**
- Service role faz `auth.admin.listUsers()` + join com `profiles` + `user_roles` + vínculos (`clients/partners/referrers/service_providers` por `user_id`).
- Retorna last_sign_in_at, email_confirmed_at, todos os campos do profile, papéis, e vínculos.
- Só admin pode chamar.

**3. `src/pages/UsersPage.tsx` — UI premium + funcionalidades**

Header & tema:
- `PageHero` com KPIs clicáveis: Total, Ativos, Com acesso, Admins, Sem papel (cada um vira filtro).
- Fundo `bg-slate-50/60`, card `bg-white border-slate-200/70 rounded-lg shadow-sm`, Inter + JetBrains Mono em datas/ids. Zero `vx-card`/`font-display`/`bg-muted/*`.

Toolbar:
- Busca com `norm()` (sem acento, case-insensitive) sobre nome/email/telefone/documento.
- Filtros: papel (multi), status (ativo/inativo), acesso (com/sem), último login (nunca / >30d / <7d).
- Chips de filtros ativos removíveis.
- Botão "+ Novo usuário".

Tabela:
- Colunas: Usuário (avatar+nome+email), Telefone, Documento, Papéis (todos os badges), Vínculo (cliente X / parceiro Y / prestador Z com link), Último acesso, Status (ativo + acesso), Ações.
- `SortableTh` em nome, email, último acesso, criado em.
- `PaginationControl` (20/página), skeleton no loading, empty state.

Linha → click abre **Drawer "Detalhes do usuário"** com TODOS os campos:
- Aba "Dados pessoais": nome, email, telefone, documento, avatar_url — editáveis.
- Aba "Endereço": street/number/complement/neighborhood/city/state/zip — editáveis.
- Aba "Acesso & papéis": papel principal (select), papéis adicionais (multi), `active`, `has_system_access`, `manual_approval_required`, `onboarding_completed/step`, `internal_notes`.
- Aba "Segurança": **Definir nova senha** (input + confirmar + botão "Salvar senha" via `set_password`), Copiar senha gerada, Botão "Gerar senha forte".
- Aba "Vínculos & metadados": last_sign_in_at, email_confirmed_at, created_at, vínculos com cliente/parceiro/prestador (read-only com link).
- Footer do drawer: "Salvar alterações" (chama `update_profile`), "Excluir usuário" (com `confirmAction`).

Ações inline na tabela (DropdownMenu):
- Ver detalhes (abre drawer).
- Ativar/Desativar (com `confirmAction`).
- Liberar/Bloquear login (com `confirmAction`).
- **Definir senha agora** → mini-dialog: input nova senha + confirmar + botão. Chama `set_password`. Mostra toast "Senha alterada — informe ao usuário: XXXX" com botão copiar. **Não envia email.**
- Copiar email.
- Excluir usuário (com `confirmAction` dupla — digitar email para confirmar).

Diálogo "Novo usuário":
- Mesmos campos atuais + Documento + Endereço opcional.
- Toggle "Definir senha agora" (default ON) vs "Enviar email de convite".
- Se "definir senha agora": campo senha + botão "gerar". Resultado mostra senha em destaque com copiar.

Permissões:
- `canManage = isAdmin || isAdminSecondary`. `admin_secondary` pode editar mas não excluir admins nem promover a admin.

**4. Limpezas**
- Remover `setRole` ingênuo — usar mutation via `update_profile` action ou direto em `user_roles` mas preservando múltiplos papéis (substituir só o primário marcado).
- Padronizar `roleLabel`/`roleClass` adicionando `vendedor`/`indicador`/`admin_secondary` que faltam.
- `useDebounce` em busca, query invalidation em `["users-detailed"]` e `["dashboard"]` após cada mutação.

### Arquivos afetados
- `src/pages/UsersPage.tsx` (reescrita)
- `supabase/functions/invite-user/index.ts` (adicionar actions `set_password`, `update_profile`, `delete`, `list`)
- Possível novo arquivo: `src/components/users/UserDetailsDrawer.tsx` (drawer extraído pra manter o page legível)

### Fora de escopo
- Mexer em RLS de `profiles` (já permite admin total access).
- Tabela `user_roles` schema (já suporta múltiplos papéis).
- Outros painéis (colaborador, prestador).