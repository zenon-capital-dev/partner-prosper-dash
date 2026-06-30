## Auditoria dos 9 pontos do painel parceiro + ajustes globais

### 1. Materiais — botão Baixar não baixa (print 1)
`src/pages/PartnerPanel.tsx` (aba Materiais) — botão chama `window.open` direto da URL do storage. Trocar pelo `downloadFile()` de `src/lib/download.ts` (mesmo helper já usado nos contratos) para forçar `Content-Disposition: attachment`. Aplicar também em qualquer outro botão "Baixar" do painel parceiro (extratos, comissões, contratos, documentos do cliente).

### 2. Contratos parceiro — área para assinar (prints 2 e 5)
`src/pages/PartnerPanel.tsx` aba Contratos hoje só mostra "Aguardando envio pela nossa equipe". Vou ler `partner_contracts` (campos `signed_contract_url`, `signed_nda_url`, `contract_file_url`, `nda_file_url`) e renderizar:
- Quando admin enviou o original → botão **Baixar original** + bloco **Enviar assinado** (upload p/ bucket `partner-contracts`, grava `signed_*_url`).
- Quando parceiro já enviou assinado → status "Enviado para análise" + botão baixar a versão assinada + permitir reenvio.
- Status sincronizado com print 5 (já existe parcialmente, mas falta o input de upload).

### 3. Abrir chamado de suporte erro "Parceiro não encontrado" (print 3)
`src/pages/PartnerPanel.tsx` linha 319/396 lança esse erro quando o `partner` da query inicial não foi carregado ainda (ou quando o registro em `partners` não está ligado ao `auth.uid()`). Corrigir:
- Resolver o `partner_id` via `partners.user_id = auth.uid()` antes do submit (await direto, não depender de cache).
- Se realmente não houver registro, criar fallback claro (ticket fica com `partner_id = null` + `created_by_user_id`) ou exibir erro amigável com instruções, não toast genérico.

### 4. Rota da solicitação Zenon → Parceiro (print 4 e 6)
Hoje o dialog "Nova solicitação de documento" só tem destinatários Cliente/Colab/Prestador. Falta **Parceiro**. Em `DocumentDialog` (Central de Documentos):
- Adicionar 4ª aba "Parceiro" no seletor de destinatário, com combo de parceiros.
- Gravar `document_requests` com `partner_id` (criar coluna se não existir; verificar schema).
- Parceiro vê em `PartnerPanel` aba Documentos — adicionar listagem + upload.
- Corrigir também por que a solicitação para Cliente não chegou (print 6): provavelmente filtragem por `client_id` ↔ `clients.user_id` no portal do cliente está quebrada. Auditar query do `ClientPanel` aba documentos e RLS de `document_requests` para `auth.uid() = clients.user_id`.

### 5. Parceiro Documentos — sem onde anexar (print 5/parceiro)
Em `PartnerPanel.tsx` aba "Documentos dos clientes" hoje só lista. Adicionar:
- Bloco "Meus documentos solicitados" (lista de `document_requests` direcionadas a este parceiro) com botão **Enviar arquivo** (upload para `documents` bucket + atualiza request para `enviado`).

### 6. Aba Zenon (admin Central Documentos) — layout + opção Parceiro + erro upload do cliente (prints 7 e 8)
- `DocumentDialog`: redesenhar o seletor de destinatário (4 cards limpos: Cliente, Colab, Prestador, Parceiro com ícone + descrição) e melhorar densidade do form (grid 2-col, espaçamento, cards agrupados "Destinatário / Documento / Prazo / Arquivo").
- Corrigir erro de upload na aba Clientes (print 8): provavelmente path do storage usa `client.id` mas RLS espera `clients.user_id`. Verificar `client_document_requests` upload em `ClientDocumentsTab` e ajustar path/policy.

### 7. Editar Venda — receita mensal não aparece + layout (print 9)
`src/components/sales/SaleFormDialog.tsx`:
- O toggle Avulso/Recorrente existe (linha 562/576) mas só aparece em modo criação; verificar condição e habilitar também na edição (`if (sale) form.revenue_type` é carregado mas o bloco visual pode estar oculto por flag). Garantir que aparece sempre.
- Refinar o layout do form: cabeçalho com Bruto/Líquido fica desalinhado, grid de campos com colunas desbalanceadas. Alinhar com `grid-cols-2` consistente, padding uniforme, separar seções com `Card` + título único, mover campo "Meses de recorrência" para logo abaixo do toggle.

### Entrega
Implementação direta após aprovação, em um único passe, sem migrações arriscadas (apenas verificar/ajustar RLS de `document_requests` se necessário e potencialmente adicionar coluna `partner_id` em `document_requests` se ainda não existir).
