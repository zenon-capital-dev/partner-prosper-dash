## Objetivo

Transformar o CRM em um sistema completo com **4 portais reais** (Admin, Cliente, Prestador, Parceiro), cada um com rotas, menus, telas internas com tabela + filtros + ações + página de detalhe, regras de acesso por papel e visual premium SaaS B2B unificado.

A lógica central:

```text
Cliente ─► Empresa ─► Produto/Pacote ─► Demanda
                                          ├── Documentos
                                          ├── Checklist / SLA
                                          ├── Prestador delegado
                                          ├── Financeiro
                                          └── Entrega
```

> Já existe muita coisa pronta no projeto (Clients, Demands, Documents, Commissions, Providers, Partners, ClientPanel, ProviderPanel, PartnerPanel, RLS por papel). O trabalho é **conectar, completar lacunas, padronizar visual e blindar o que falta**.

---

## 1. Portal ADMIN — `/admin/*` (AdminLayout)

Sidebar reorganizada em grupos:

- **Operação:** Dashboard, Cockpit, Demandas, Tarefas
- **Clientes:** Clientes, Empresas (novo), Cliente 360º (em `/clientes/:id`)
- **Catálogo:** Produtos, Pacotes (novo)
- **Rede:** Prestadores, Parceiros, Indicadores, Colaboradores
- **Financeiro:** Financeiro, Comissões, Contratos, Documentos
- **Sistema:** Relatórios, Auditoria, Usuários, Configurações, Automações

Telas que ganham refator de tabela densa + filtros + bulk actions + drawer de detalhe:
- Demandas, Clientes, Produtos, Documentos, Comissões, Contratos, Financeiro, Prestadores, Parceiros, Tarefas.

Telas novas:
- **Empresas** (`/empresas`) — lista de `companies` agrupadas por cliente com filtros e detalhe.
- **Pacotes** (`/pacotes`) — produtos compostos (vai usar `products` com flag `is_bundle` + tabela `product_bundle_items`).

Cliente 360º (`/clientes/:id`) — corrigir bug "não encontrado", garantir abas: Visão geral, Empresas, Demandas, Documentos, Financeiro, Contratos, Tarefas, Histórico.

---

## 2. Portal CLIENTE — `/cliente/*` (AppLayout)

Sidebar do cliente (substitui menu genérico atual):
- Início
- Meus Produtos / Demandas
- Documentos Pendentes
- Upload de Documentos
- Entregas
- Financeiro
- Contratos
- Suporte

Cada item vira uma rota dentro de `ClientPanel` (já tem tabs system) ou rotas separadas `/cliente/demandas`, `/cliente/documentos`, etc. Detalhe da demanda em `/cliente/demandas/:id`.

Regra: cliente só vê seus próprios registros (já garantido por RLS — vou auditar).

---

## 3. Portal PRESTADOR — `/prestador/*`

Sidebar:
- Início
- Minhas Demandas (kanban + lista)
- Detalhe da Demanda (`/prestador/demandas/:id`)
- Documentos Permitidos
- Checklist
- Reportar Status
- Solicitar Documento
- Pagamentos

Reuso de `DemandDetail` em modo prestador, com bloqueio de seções financeiras/parceiro.

---

## 4. Portal PARCEIRO — `/parceiro/*`

Sidebar:
- Início (funil indicados → contratos → comissões)
- Meus Indicados
- Comissões
- Extrato
- Pagamentos
- Contrato
- Link de Indicação
- Materiais

---

## 5. Visual SaaS B2B Premium (unificado)

- Tema **claro corporativo** padrão para Admin (sai do "dark futurista" que não agradou) com acento `indigo-600` + neutros graphite, tipografia Inter + JetBrains Mono para números.
- Sidebar: grupos colapsáveis, ícones lucide, item ativo com barra lateral azul + bg `slate-50`.
- Topbar: search global, breadcrumb, ações rápidas, sino, perfil.
- Padrão de página: `PageHeader` (título + subtítulo + ações) → KPIs (4 cards densos) → barra de filtros → tabela densa com zebra + hover + badges → drawer/sheet de detalhe.
- Componentes base novos: `DataTable`, `FilterBar`, `EntityDrawer`, `KpiCard`, `StatusBadge` premium.

---

## 6. Segurança / dados

- Migration de auditoria RLS para garantir:
  - `documents` sempre com `client_product_id` (trigger já existe).
  - Cliente não vê documento de outra demanda.
  - Prestador só vê demandas delegadas.
  - Parceiro só vê próprios indicados e comissões.
- Tabela nova `product_bundles` (id, product_id pai, child_product_id, qty) para pacotes.
- Seed de **dados demonstrativos** realistas (clientes, empresas, produtos, demandas, documentos, comissões) só se o banco estiver vazio — para que cada tela tenha conteúdo.

---

## 7. Correção do bug "não encontrado"

Auditar páginas de detalhe (`ClientDetail`, `PartnerDetail`, `ProviderDetail`, `DemandDetail`, `UsersPage` modal): muitas falham porque o `select` usa joins com FK que não existem mais ou RLS bloqueia. Vou:
1. Reproduzir cada uma.
2. Trocar `.single()` por `.maybeSingle()` e tratar null com tela "Não encontrado" decente.
3. Corrigir queries quebradas (campos renomeados, embeds inválidos).

---

## Entregáveis

1. **Migration**: tabela `product_bundles`, ajustes RLS, seed condicional.
2. **Design system**: novo tema claro corporativo no `index.css` + `tailwind.config.ts` + componentes `DataTable`, `FilterBar`, `KpiCard`, `EntityDrawer`.
3. **AdminSidebar** reorganizado em grupos + AdminHeader polido.
4. **Sidebars dedicados** para Cliente, Prestador, Parceiro (substituem `AppSidebar` genérico).
5. **Rotas novas**: `/empresas`, `/pacotes`, `/cliente/demandas/:id`, `/prestador/demandas/:id`, `/parceiro/materiais`, `/parceiro/link`.
6. **Refator das páginas** Admin (Clients, Products, Demands, Documents, Commissions, Contracts, Finance, Providers, Partners, Tasks) para o novo padrão denso.
7. **Refator dos painéis** Cliente, Prestador, Parceiro com sidebar própria e telas internas reais.
8. **Correção** das páginas de detalhe quebradas.

---

## Avisos importantes

- Esse escopo é **muito grande** (15+ telas refatoradas, 3 sidebars novas, novo design system, migrations, seed). Vou entregar em **uma sequência de commits coerentes**, começando pela base (design system + AdminSidebar + correção bug detalhe), depois cada portal.
- Antes de começar quero confirmar 2 coisas pra não retrabalhar:

**Perguntas:**
1. Posso **abandonar o "dark futurista"** atual do admin e migrar tudo (admin + portais) para um único tema claro corporativo SaaS B2B (estilo Linear/Attio)? Ou você quer manter dark no admin e claro nos portais?
2. Quer que eu **gere dados de demonstração** (seed de clientes/demandas/documentos fictícios) caso o banco esteja vazio, pra todas as telas terem conteúdo? Ou usar só os dados reais que já existem?