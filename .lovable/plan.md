Vou revisar a aba **Leads** com foco em estabilidade, consistência visual do admin claro premium e fluxo real de vendas.

## O que será corrigido

1. **Filtros e busca confiáveis**
   - Corrigir dependência do `useMemo` para usar `debouncedSearch` corretamente.
   - Normalizar busca por telefone/WhatsApp, permitindo encontrar com ou sem máscara.
   - Melhorar busca por nome, empresa, email, origem, produto, parceiro e responsável.
   - Resetar paginação ao trocar busca, período e visualização.

2. **Status e KPIs sem inconsistência**
   - Unificar status aceitos na página e no pipeline.
   - Corrigir KPIs que contam apenas alguns status e podem ficar errados.
   - Tornar KPIs clicáveis para filtrar rapidamente por etapa relevante.
   - Adicionar chip de filtro ativo com opção de limpar.

3. **Pipeline funcionando melhor**
   - Exibir leads com status desconhecido em uma etapa segura em vez de sumirem.
   - Ordenar leads por urgência: follow-up vencido/hoje, lead quente, próximo follow-up, mais recente.
   - Melhorar estado vazio e estado de carregamento do pipeline.
   - Remover classes e tons desalinhados com o tema claro premium do admin.

4. **Tabela mais profissional**
   - Adicionar ordenação por lead, status, origem/produto e data.
   - Corrigir layout visual para `bg-white`, bordas `slate-200/70`, sombra leve e sem dark/gradiente pesado.
   - Melhorar empty states: diferenciar “sem leads cadastrados” de “nenhum resultado com filtros”.
   - Manter paginação coerente com filtros e ordenação.

5. **Formulário de lead robusto**
   - Normalizar email e telefones antes de salvar.
   - Validar probabilidade entre 0 e 100.
   - Evitar duplicidade considerando email/telefone em qualquer status aberto, não só `Novo`.
   - Ajustar visual do diálogo para o padrão claro premium.

6. **Follow-up sem bug de fuso e com dados corretos**
   - Salvar `next_action` e `next_action_date` também no lead, para aparecer imediatamente na fila “Pra agir hoje”.
   - Criar a tarefa com `status_new: "a_fazer"`, prioridade compatível e data sem deslocamento inesperado.
   - Invalidar queries de leads e tarefas após agendar.

7. **Conversão em cliente mais segura**
   - Validar produto quando “Criar produto contratado” estiver ativo.
   - Usar datas locais em campos `date` para evitar deslocamento.
   - Tratar erros parciais com mensagens mais claras.
   - Atualizar visual do modal para o padrão claro premium.

8. **Importação CSV menos frágil**
   - Melhorar parser para lidar com aspas e vírgulas dentro de campos.
   - Normalizar telefone/WhatsApp e email.
   - Mostrar quantas linhas válidas/inválidas serão importadas.
   - Evitar importação de linhas sem nome.

## Arquivos previstos

- `src/pages/Leads.tsx`
- `src/components/leads/LeadsPipeline.tsx`
- `src/components/leads/LeadFormDialog.tsx`
- `src/components/leads/LeadFollowUpDialog.tsx`
- `src/components/leads/ConvertLeadDialog.tsx`
- `src/components/leads/LeadsCsvImport.tsx`

## Fora do escopo

- Alterar estrutura do banco.
- Criar nova tela de detalhe de lead.
- Mudar regras comerciais de comissão/contrato além de validações para evitar erro.