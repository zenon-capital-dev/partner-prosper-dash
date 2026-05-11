Finalizar o CRM com uma revisão completa de arquitetura, funcionalidades, permissões, layout e experiência de uso para os 4 perfis de usuários.

### 1. Refinamento de Interface e Experiência (UX/UI Premium)
- **Consistência Visual**: Garantir que todos os dashboards (Admin, Cliente, Prestador, Parceiro) utilizem os mesmos tokens de design premium (sombras vx-lg, gradientes sutis, PageHeader padronizado).
- **Feedback Visual**: Implementar estados de carregamento (Skeletons) e estados vazios (Empty States) elegantes em todas as listagens.
- **Micro-interações**: Adicionar animações suaves de fade-in e hover em cards e botões.

### 2. Painel Administrativo (Equipe Interna)
- **Dashboard Executivo**: Criar uma visão de alto nível com KPIs de faturamento, novos clientes, demandas críticas e performance da equipe.
- **Cockpit Operacional**: Refinar a central de comando para que a equipe possa agir rapidamente em bloqueios (documentos reprovados, SLAs vencendo).
- **Gestão de Usuários**: Garantir que a atribuição de papéis e permissões esteja intuitiva.

### 3. Portal do Cliente (Transparência e Confiança)
- **Área do Produto**: Detalhar cada serviço contratado com checklist de progresso, documentos necessários e histórico de interações.
- **Central de Suporte**: Facilitar o contato direto e a visualização de prazos.
- **Simplificação**: Remover jargões internos e focar no que o cliente precisa saber para se sentir seguro.

### 4. Portal do Prestador (Execução e Produtividade)
- **Central de Demandas**: Focar na execução com cards claros, cronômetros de SLA e área de reporte simplificada.
- **Financeiro**: Visualização clara de valores a receber por serviço executado.

### 5. Portal do Parceiro/Afiliado (Crescimento e Conversão)
- **Link de Indicação**: Área de cópia rápida do link e monitoramento de cliques/conversões.
- **Extrato de Comissões**: Tabela detalhada com status de pagamento (Pendente, Liberada, Paga).

### 6. Arquitetura e Segurança (Robustez SaaS)
- **Revisão de Permissões (RLS)**: Garantir que as políticas do Supabase protejam os dados de forma que cada perfil só veja o que lhe compete.
- **Otimização de Performance**: Revisar o uso de React Query para garantir que os dados sejam atualizados em tempo real sem excesso de chamadas.

---

### Detalhes Técnicos (Para Desenvolvedores)
- **Componentes**: Padronização do `PageHeader` e `PremiumCard`.
- **Hooks**: Centralização da lógica de papéis no `useAuth`.
- **Database**: Implementação de triggers para atualização de status e auditoria.
- **Estilos**: Uso intensivo de classes customizadas no `tailwind.config.ts` e `index.css`.
