## Diagnóstico

Três problemas independentes:

**1. Inconsistência de tamanho mínimo de senha**
- `src/lib/password.ts` e o login (`Auth.tsx` linha 17): exigem **8 caracteres**
- `src/components/provider/ProviderFormDialog.tsx` linha 185-186: label diz **"mín. 6 caracteres"**
- `supabase/functions/invite-user/index.ts` linha 109: valida **mínimo 6**

Resultado: admin cadastra prestador com senha de 6 dígitos, salva ok, mas quando o prestador tenta logar o formulário bloqueia com "mínimo 8".

**2. "Informações não salvas na ficha do prestador"**
Já está resolvido pelo fix anterior — a query embutida quebrava e ninguém abria detalhes corretos. Verifiquei no banco: o último prestador criado ("teste prestador af") tem nome, email, telefone, CNPJ e especialidade todos salvos. Quando você abrir a ficha agora a info aparece. Vou só confirmar visualmente após os outros ajustes, sem mexer em código.

**3. Link "Esqueci a senha" no login**
Existe em `src/pages/Auth.tsx` linha 244 + handler com `resetPasswordForEmail` (linha 52). Você já pediu pra remover — só admin pode resetar senha de outro usuário via tela de Usuários.

## Correções

### `src/lib/password.ts`
Nada muda — já está em 8 com letra+número. Continua como fonte única de verdade.

### `src/components/provider/ProviderFormDialog.tsx`
- Trocar label "Senha provisória (mín. 6 caracteres)" → "Senha provisória (mín. 8 caracteres, 1 letra e 1 número)"
- Trocar placeholder
- Adicionar validação com `validatePassword(form.access_password)` antes de chamar `invite-user`. Se falhar, `toast.error` listando os erros e aborta.

### `supabase/functions/invite-user/index.ts`
- Linha 109 (`set_password`): `< 6` → `< 8` + mensagem "Senha precisa ter ao menos 8 caracteres, 1 letra e 1 número" e checar regex letra+número
- Mesma validação no fluxo INVITE (linhas 190-203) quando `body.password` vem do cliente
- Centraliza em uma helper `validateServerPassword(pw)` no topo do arquivo pra não duplicar regra

### `src/pages/Auth.tsx`
- Remover o botão "Esqueci a senha" (linha ~244) e todo o estado/handler de reset (`resetPasswordForEmail`, possivelmente um modal/dialog associado)
- Manter o arquivo `src/pages/ResetPassword.tsx` e a rota `/reset-password` em `App.tsx` — admin ainda pode disparar set_password via painel de Usuários, e essa rota serve de fallback caso um link antigo seja aberto, mas sem ponto de entrada no login

### Outros lugares que pedem senha (varrer e alinhar a 8+letra+número)
- `src/pages/UsersPage.tsx` (drawer "criar usuário" e ação "redefinir senha")
- Qualquer outro form com `access_password` (Partners, Indicators, Collaborators, etc.) se existir

Vou usar `validatePassword` do `src/lib/password.ts` em todos os pontos do client pra ficar uma regra só.

## Arquivos a editar

- `src/components/provider/ProviderFormDialog.tsx`
- `supabase/functions/invite-user/index.ts`
- `src/pages/Auth.tsx`
- `src/pages/UsersPage.tsx` (se tiver criação/reset de senha)
- Quaisquer outros forms com `access_password` (verifico antes de editar)

## Validação

1. Tentar criar prestador com senha de 6 caracteres → form bloqueia com mensagem "mínimo 8 caracteres, 1 letra e 1 número"
2. Criar prestador com senha válida (ex.: `Teste1234`) → login do prestador funciona sem erro
3. Tela de login não tem mais "Esqueci a senha"
4. Abrir ficha do "teste prestador af" → todos os campos (email, telefone, CNPJ, especialidade) visíveis
