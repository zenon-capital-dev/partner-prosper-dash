# Onda 3 — Refactor & Tech Debt + Fix Header Leads

## Fix imediato — Header de Leads bugado

**Problema** (screenshot anexado): no viewport ~1327px o `PageHero` quebra em duas colunas (`xl:flex-row` em 1280px), os botões de ação (Hoje/7d/30d/Mês/Tudo + Kanban/Tabela + Importar CSV + Novo Lead) ocupam ~70% da largura e o título "Leads / Convidados" fica espremido em uma coluna de ~140px, quebrando letra por letra.

**Correção em `src/components/PageHero.tsx`:**
- Subir o breakpoint de `xl:flex-row` (1280) para `2xl:flex-row` (1536) — abaixo disso, ações vão para baixo do título naturalmente.
- Adicionar `min-w-[480px]` na coluna de ações quando em row, garantindo que se ela não couber junto, quebra.
- Remover `break-words` do `<h1>` (deixa só `text-balance`) — não precisa mais quebrar letra por letra porque o container vai ter largura adequada.

Sem alterar nenhuma página consumidora.

## Onda 3 — Refactor

### Lote 1 — Catálogos centralizados
- **`src/lib/roles.ts`**: enum `Role`, helpers `isAdmin(user)`, `isPartner(user)`, `isCollaborator(user)`, `canWriteClient(user)`. Migrar `src/hooks/useAuth.tsx` e os 10 consumidores listados acima para usar esses helpers — elimina checagens espalhadas com strings mágicas (`role === "admin"`).
- **`src/lib/schemas.ts`**: schemas Zod compartilhados (`clientSchema`, `leadSchema`, `partnerSchema`, `saleSchema`) reutilizando `validators.ts`. Senha mínima passa para **8 caracteres** com regra: 1 letra + 1 número.
- **`src/lib/glossary.ts`**: dicionário central `{ status_lead, status_demanda, status_comissao, tipo_regra, ... } → label PT-BR`. Substitui maps locais espalhados em ~6 páginas.
- **`src/lib/enums.ts`**: re-exporta enums do banco (`commission_status`, `sale_status`, `lead_status`) como const arrays tipadas — única fonte de verdade no front.

### Lote 2 — Segurança & senha
- Atualizar `src/pages/Auth.tsx` e `src/pages/Signup.tsx`: senha mínima 8 caracteres + 1 letra + 1 número, feedback visual de força.
- Adicionar `src/lib/password.ts` com helper `validatePassword()` reutilizável.

### Lote 3 — Manutenção do banco
- Migration: extension `pg_cron` + job diário que arquiva `audit_logs` com mais de 180 dias para `audit_logs_archive` (mesma estrutura, sem RLS de write, só leitura admin).
- Migration: índices que faltam — `commissions(status, partner_id)`, `leads(status, owner_id)`, `tasks(assigned_to, status)`.

### Lote 4 — Limpeza
- Remover código morto identificado: imports não usados, componentes órfãos (varredura com `knip` ou manual rápida nos arquivos da pasta `src/components`).
- Padronizar nomenclatura `referrer` vs `indicator` — escolher `referrer` (já é o nome no banco) e fazer rename nos pontos onde "indicator" aparece no frontend.

## Detalhes técnicos
- Arquivos novos: `src/lib/{roles,schemas,glossary,enums,password}.ts`
- Arquivos editados: `useAuth.tsx`, `Auth.tsx`, `Signup.tsx`, `PageHero.tsx`, ~10 componentes para migrar para `roles.ts` e `glossary.ts`.
- 2 migrations (cron + índices). Nenhuma migration mexe em dados existentes.

## Ordem
1. **Fix Leads header** (1 arquivo, imediato)
2. Lote 1 (catálogos) → 3. Lote 2 (senha) → 4. Lote 3 (migrations) → 5. Lote 4 (limpeza)

Posso começar?
