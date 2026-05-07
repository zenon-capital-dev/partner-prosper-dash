# Plano de Implementação: CRM Premium e Gestão Operacional

Este plano visa transformar o sistema atual em uma plataforma robusta de gestão operacional "admin-first", seguindo rigorosamente as especificações detalhadas.

## 1. Refinamento do Banco de Dados (Schema)
*   Consolidar tabelas existentes (`profiles`, `clients`, `products`, `leads`, `partners`, `collaborators`, `service_providers`).
*   Garantir campos específicos solicitados (ex: origem do cliente, status detalhados de documentos e contratos).
*   Implementar triggers para atualização automática de status e logs de auditoria.
*   Ajustar políticas de RLS para garantir que cada perfil (parceiro, prestador, cliente) veja apenas seus dados.

## 2. Painel Administrativo (Admin-First)
*   **Dashboard Real**: Substituir dados estáticos por queries reais do Supabase.
*   **Métricas Detalhadas**: Implementar cards para todos os KPIs solicitados (faturamento, conversão, pendências críticas).
*   **Gráficos Avançados**: Integrar Recharts para visualização de receita, novos clientes e performance de leads.
*   **Filtros Globais**: Permitir filtrar o dashboard por período, produto, parceiro e colaborador.

## 3. Gestão de Clientes e Produtos
*   **Fluxo de Cadastro**: Formulário completo com abas (Dados Pessoais, Comerciais, Vínculos).
*   **Ficha do Cliente**: Página individual com visão 360º (Timeline, Documentos, Contratos, Financeiro).
*   **Produtos Multi-serviço**: Permitir que um cliente tenha múltiplos serviços com status e responsáveis independentes.

## 4. Leads e Parceiros
*   **Gestão de Leads**: Fluxo de prospecção com conversão manual para cliente.
*   **Sistema de Comissões**: Cálculo automático de comissões por parceiro/produto com aprovação manual do admin.
*   **Vínculos de Origem**: Rastreamento obrigatório de quem indicou cada cliente.

## 5. Operacional: Documentos e Contratos
*   **Workflow de Documentos**: Solicitação -> Envio (Cliente) -> Análise (Admin) -> Aprovação/Reprovação.
*   **Gestão de Contratos**: Upload e controle de status de assinatura.
*   **Tarefas e Pendências**: Sistema de tasks vinculadas a clientes e responsáveis internos.

## 6. Financeiro e Auditoria
*   **Fluxo de Caixa**: Registro de pagamentos recebidos e a pagar.
*   **Histórico Completo**: Registro de log para cada alteração de status ou dado sensível (Auditoria).

## 7. Painéis por Perfil
*   **Painel do Cliente**: Interface simplificada para envio de documentos e acompanhamento de status.
*   **Painel do Parceiro**: Foco em indicações, conversão e extrato de comissões.
*   **Painéis de Equipe**: Views específicas para colaboradores e prestadores gerenciarem suas filas de trabalho.

## Detalhes Técnicos
*   **Tech Stack**: React, Tailwind CSS, Shadcn UI, Supabase, Lucide React, Recharts.
*   **Estilo**: Dark mode sofisticado ("Stripe style") para o Admin; visual premium e limpo para os demais painéis.
*   **Arquitetura**: Componentes modulares para tabelas e formulários para facilitar manutenção.
