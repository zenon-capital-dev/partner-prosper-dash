# Bug visual: sidebar vazando atrás do modal

## Causa raiz
Conflito de `z-index` no painel admin:
- `AdminLayout.tsx` linha 81: wrapper da sidebar com `z-50`
- `AdminSidebar.tsx` linha 102: sidebar interna com `z-50`
- `dialog.tsx` (Radix overlay e content): ambos em `z-50`

Como a sidebar está fora do portal do Dialog mas no mesmo nível de empilhamento (z-50), partes dela (divisórias brancas entre seções, ícones, bordas) se misturam com o backdrop preto/transparente do modal, criando as listras horizontais brancas vistas no print.

## Correção
Rebaixar a sidebar para `z-30` (e o wrapper para `z-30`), mantendo o Dialog em `z-50`. Isso garante que QUALQUER modal/dialog sempre fique acima da sidebar sem competição.

## Arquivos alterados
1. `src/components/admin/AdminLayout.tsx` — wrapper sidebar `z-50` → `z-30`
2. `src/components/admin/AdminSidebar.tsx` — sidebar `z-50` → `z-30`

## Validação
- Verificar que sidebar continua acima do conteúdo principal (header tem seu próprio z-index menor)
- Verificar abertura de Dialog (Nova venda) e Sheet (mobile menu) no preview
- Verificar que dropdowns/popovers continuam funcionando

## Risco
Baixíssimo. Apenas 2 valores de classe Tailwind. Reversível em 5s.