Vou refatorar a aba Parceiros (`src/pages/Partners.tsx`) no mesmo padrão das anteriores.

Escopo:

1. Tema claro premium
- Trocar `page-shell`/gradientes pesados/cards inconsistentes pelo padrão `bg-slate-50/60` + cards `bg-white border-slate-200/70 rounded-lg shadow-sm`.
- PageHero mantém estética, mas sem botão com gradiente exagerado — usar `bg-indigo-600`.
- Tipografia Inter no texto, JetBrains Mono em números/valores.
- Esconder ações de gestão (novo/editar/desativar) para quem não é admin (`canManage = isAdmin || isAdminSecondary`).

2. Busca e filtros confiáveis
- Normalizar busca (sem acento, lowercase) cobrindo nome, email, documento, telefone/whatsapp (só dígitos) e chave PIX.
- Filtros: status (Todos/Ativos/Inativos), categoria (Indicador/Afiliado/Estratégico), com acesso ao painel (sim/não).
- Chips de filtros ativos com X individual e "Limpar tudo".
- Ordenação extra: por comissão pendente e por última atividade (created_at) — manter sort selector.

3. Tabela mais útil
- Cabeçalhos ordenáveis (Parceiro, Indicações, Ganhos, Pendente, %Comissão) com indicador asc/desc.
- Coluna "Categoria" com pill colorida.
- Indicador visual de "tem acesso ao painel" (chave).
- Hover slate-50, sem decorações extras.

4. Grid view consistente
- Mostrar pendente, % comissão, categoria, status ativo/inativo (badge).
- Mesmas ações (ver detalhe, editar, ativar/desativar) presentes na tabela.
- Card mais compacto e legível.

5. KPIs corretos
- Manter Total Rede, Indicações, Total Comissões, A Pagar.
- Adicionar "Ativos" e "Ticket médio por parceiro" (ganhos/parceiros ativos).
- Substituir contagem de indicações pelo número real de clientes únicos por parceiro (já vem de p.clients).

6. Estado vazio e loading
- Skeleton rows/cards enquanto carrega.
- Empty state com contexto (filtros ativos vs. nenhum parceiro cadastrado) e CTA "Novo parceiro" para admin.

7. Validações do diálogo de cadastro
- Validar email (formato) quando preenchido.
- Validar documento (CPF/CNPJ) com `onlyDigits` ≥ 11 quando preenchido, ou aceitar vazio.
- Validar % comissão entre 0 e 100.
- Avisar duplicidade por email ou documento entre parceiros existentes (cliente — não bloquear se admin confirmar).
- Senha de acesso ≥ 8 caracteres (mensagem dizia 8 mas validava 6); incluir botão "Copiar" visível além do gerador.
- Em edição, esconder bloco "Criar acesso" mas mostrar status `has_system_access` com botão de reset de senha em fase futura (sem mudar backend agora — só mostrar info).

8. Ações de linha mais seguras
- Confirmar ao desativar parceiro com comissões pendentes.
- Invalidar `partners-rich`, `commissions`, `dashboard`.
- Mostrar `error.message` real do Supabase.

9. Exportação CSV
- Adicionar botão "Exportar" com nome, email, telefone, documento, categoria, % comissão, clientes, total ganho, pendente, status, criado em.

10. Validação final
- Tipos TS, build limpo, console e dev-server ok.
- Sem mudanças de schema. Reaproveitar `PartnerDetailDrawer` existente.

Fora do escopo: refatorar `PartnerDetailDrawer`/`PartnerDetail.tsx` e edge function `invite-user`.