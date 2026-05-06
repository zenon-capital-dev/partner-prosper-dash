
O pedido é grande — entregar tudo de uma vez vai resultar em código superficial. Proponho dividir em **3 fases** e começar pela Fase 1 já neste fluxo. Você aprova e eu sigo.

---

## Diagnóstico rápido

O sistema já tem boa base no banco: `clients`, `partners`, `products`, `sales`, `commissions`, `documents`, `projects`, `user_roles`, `profiles`, `expenses`, `notifications`, `activities`, `client_timeline`, `partner_products`. Falta:

1. Visual do Login e do Dashboard ainda parecem "demo / IA" (gradientes exagerados, ícone Sparkles, copy genérica).
2. Não existe fluxo de **criar login para o cliente** direto pelo admin (hoje depende do cliente se cadastrar).
3. Não existe modelo claro de **indicador** (pessoa que indica mas não é parceiro formal) separado de **colaborador**.
4. Comissão hoje é só do `partner_id` da venda — não cobre cenário de **cliente trazido por indicador + colaborador interno** com % diferente para cada um.
5. Não há **catálogo de produtos do cliente** (quais produtos cada cliente tem ativos hoje, com renovação, valor, status).

---

## Fase 1 — Visual premium "feito do zero" (esta entrega)

Sem cara de IA, tipografia nítida, paleta consistente.

- **Login (`/auth`)**: remover imagem/ícones que parecem AI-generated. Layout split limpo: lado esquerdo com identidade visual sólida (mockup vetorial de painel feito em SVG/HTML, sem imagem gerada), KPIs e depoimento. Lado direito form clean. Sem "Sparkles", sem "Powered by AI".
- **Dashboard**: header refinado (sem gradiente no título), KPIs com micro-sparklines mais discretas, espaçamento maior, sem glow/blur residual, foco em legibilidade 4K/8K (font smoothing, line-height, tabular-nums consistente).
- **Sidebar**: já está boa — só pequenos ajustes de densidade e hierarquia.
- **Tokens**: ajustar `index.css` para tons mais sóbrios (cinzas reais, primário um pouco mais escuro), remover sombras coloridas residuais.

## Fase 2 — Modelo de dados completo de assessoria

Migração única que adiciona:

- Tabela **`referrers`** (indicadores) — pessoas físicas que só indicam, com PIX, % padrão, sem login obrigatório.
- Coluna **`referrer_id`** em `clients` e `sales`.
- Coluna **`collaborator_id`** em `sales` (colaborador interno que fechou).
- Tabela **`commission_splits`** (sale_id, beneficiary_type ['partner'|'referrer'|'collaborator'], beneficiary_id, percent, amount, status). Trigger gera splits automaticamente conforme a venda.
- Tabela **`client_subscriptions`** (cliente × produto × valor × ciclo × próxima cobrança × status). Permite ver "quais produtos cada cliente tem".
- View materializada **`v_client_360`** para a tela de detalhe do cliente.

## Fase 3 — Telas e fluxos novos

- **Convidar cliente** direto do admin: botão na página do cliente que cria o `auth.user` via Edge Function (com service role) e envia email de definição de senha. Acaba o cadastro manual.
- **Página `/indicadores`** completa (CRUD + ranking + comissões a pagar).
- **Página do cliente reformulada**: aba "Produtos contratados", aba "Indicado por", aba "Colaborador responsável", aba "Financeiro / próximas renovações".
- **Página `/financeiro`**: a pagar (splits pendentes), a receber (subscriptions do mês), DRE simples (receita − comissões − despesas).
- **Pipeline kanban** opcional na Fase 3.

---

## Detalhe técnico da Fase 1 (o que vou codar agora se você aprovar)

```text
src/pages/Auth.tsx        → reescrever (remover authHero, Sparkles, copy AI)
src/assets/auth-hero.jpg  → deletar (não usar mais imagem gerada)
src/index.css             → ajustar tokens primary/sombras, remover gradientes residuais
src/pages/Dashboard.tsx   → header limpo, KPIs refinados, sem bg-clip-text gradient
src/components/AppSidebar.tsx → micro ajustes de tipografia/espaçamento
```

Critério de pronto da Fase 1: abrir `/auth` e `/` e a tela parecer feita por uma equipe de design sênior — sem nada que grite "gerado por IA".

---

**Me confirma:**

1. Pode começar a **Fase 1 (visual)** agora?
2. A modelagem da Fase 2 (indicador ≠ colaborador ≠ parceiro, splits de comissão) reflete o seu negócio? Algo a ajustar antes de eu mexer no banco?
