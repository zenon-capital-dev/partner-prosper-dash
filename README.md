# VENDX CRM

CRM completo para gestão de vendas multi-produto (Financeiro, Jurídico, Seguros, Consultoria).

## Stack
React 18 + Vite + TypeScript + Tailwind + shadcn/ui · Backend: Supabase (Postgres + Auth + Storage + RLS).

## Rodar localmente
```bash
npm install
npm run dev
```

## Variáveis (.env)
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
VITE_SUPABASE_PROJECT_ID=seu-projeto
```

## Build
```bash
npm run build
```
Gera a pasta `dist/` com arquivos estáticos.

## Deploy Hostinger (cPanel)
1. `npm run build`
2. cPanel → Gerenciador de Arquivos → `public_html`
3. Faça upload de **todo o conteúdo da pasta `dist/`** (incluindo o `.htaccess` que já vai junto via `public/`)
4. Pronto. Não precisa de VPS, Node nem PHP.

## Primeiro acesso
- Email: `admin@admin.com` · Senha: `admin123` (troque depois)
- Novos usuários se cadastram em `/auth` → admin define o papel em **Configurações → Usuários**

## Funcionalidades
- Dashboard com KPIs e gráficos
- Clientes com tags, timeline, documentos e ações
- Parceiros com área própria e ranking
- Comissões automáticas (trigger no banco)
- Relatórios PDF + Excel com filtros
- Busca global, notificações em tempo real, dark mode
- Recuperação de senha
- RLS em todas as tabelas, HIBP ativo
