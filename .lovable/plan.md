## Escopo

Vamos reorganizar a ficha do cliente (admin), o painel do cliente e o painel do prestador. O trabalho é grande e será dividido em **5 etapas**, executadas em sequência. Cada etapa termina com algo testável.

---

### Etapa 1 — Documentos por Produto (Admin + Cliente)

**Admin → Cliente → aba Documentos**
- Agrupar documentos por produto contratado (Tributário, Contabilidade, Jurídico, etc.).
- Para cada documento exibir: nome, produto, status, obrigatório/opcional, arquivo, data envio, quem enviou, observações.
- Status: `nao_solicitado`, `solicitado`, `enviado`, `em_analise`, `rejeitado`, `aprovado`.
- Ações: aprovar, rejeitar (com motivo), comentar, solicitar reenvio.
- Botão "Solicitar documento" já vinculado ao produto.

**Painel do Cliente → Documentos**
- Mesma estrutura agrupada por produto.
- Cliente só envia arquivo dentro do produto correto.
- Mostra status, observações do admin e prazo.

**Banco**
- Adicionar à tabela `documents`: `is_required` (bool), `uploaded_by_role`.
- Migrar enum `document_status_new` para incluir `nao_solicitado`, `em_analise` se faltarem.

---

### Etapa 2 — Prestadores Delegados (Admin)

**Nova aba "Prestadores" na ficha do cliente**
- Tabela: Produto · Prestador delegado · Status produto · Data delegação · Prazo · Último reporte · Ações.
- Ação: trocar prestador (dialog com lista de service_providers).
- Usa `client_products.service_provider_id` (já existe).
- Adiciona campo `delegated_at` em `client_products`.

---

### Etapa 3 — Financeiro do Cliente

**Refinar aba Financeiro**
- Lista de produtos contratados com valor unitário e total.
- Resumo: total contratado, pago, pendente.
- Por parcela: forma de pagamento, vencimento, status (`pago`, `parcial`, `pendente`, `vencido`, `cancelado`, `reembolsado`).
- Comissões relacionadas e parceiro indicador.

---

### Etapa 4 — Contratos + Histórico

**Contratos**
- Anexar contrato com: nome, tipo, produto vinculado, data assinatura, status, arquivo, observações.
- Status: `aguardando_assinatura`, `assinado`, `vencido`, `cancelado`.

**Histórico (timeline)**
- Garantir triggers/inserts em `client_timeline` para todos os eventos listados (criação, produto adicionado, documento solicitado/enviado/aprovado/rejeitado, prestador delegado, status alterado, pagamento, comissão, contrato, observação).

---

### Etapa 5 — Painel do Prestador (com isolamento)

**Dashboard do Prestador**
- Cards: total delegadas, em andamento, pendentes, aguardando docs, atrasadas, concluídas.

**"Minhas Demandas"**
- Tabela: Cliente · Empresa · Produto · Status · Prazo · Docs recebidos · Última atualização.
- Cada linha = um `client_product` delegado a ele (RLS já garante isolamento via `is_delegated_provider`).

**Detalhe da Demanda**
- Mostra apenas o produto delegado: cliente (nome+empresa), status, documentos **somente daquele produto**, checklist (`client_product_steps`), histórico, campo de reporte de status, solicitar documento adicional, observações.
- Status que prestador pode reportar: `em_analise`, `aguardando_documentos`, `documento_insuficiente`, `pendente_cliente`, `em_execucao`, `aguardando_validacao`, `finalizado`, `atencao_admin`.
- Cada reporte vira um registro em `client_product_status_reports` e notifica o admin (trigger já existe).

---

## Detalhes técnicos

- Reaproveitar tabelas existentes: `documents`, `client_products`, `client_product_steps`, `client_product_status_reports`, `payments`, `contracts`, `client_timeline`.
- Migrações novas: campos `is_required`, `delegated_at`, possíveis valores de enum extras.
- RLS já cobre isolamento do prestador via função `is_delegated_provider`. Vamos confirmar e ajustar se necessário.
- Frontend: refatorar `ClientDocuments.tsx`, criar `ClientProvidersTab.tsx`, ajustar `ClientFinancial`, `ClientContracts`, `ClientHistory`, `ClientPanel.tsx`, `ProviderPanel.tsx`.

---

## Como vamos trabalhar

Vou começar pela **Etapa 1 (Documentos por Produto)** assim que você aprovar este plano. Ao terminar, mostro o resultado e seguimos para a próxima. Se preferir outra ordem, me avise.