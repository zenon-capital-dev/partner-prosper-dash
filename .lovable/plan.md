# Sincronizar Vendas → Produtos do Cliente

## Causa raiz
`sales` (vendas registradas) e `client_products` (pipeline de entrega/demandas) são tabelas separadas e nunca se conversam.
- `SaleFormDialog` → só insere em `sales`
- `IntelligentSummary`, tab "Produtos/Demandas", dashboard → leem de `client_products`
Resultado: registrar uma venda NÃO faz o cliente "ter" o produto em lugar nenhum da UI.

## Solução: trigger no banco + backfill

Criar 1 trigger Postgres que, ao inserir uma `sales` (status `concluida` ou `pendente`), gera automaticamente uma linha em `client_products` vinculada (`client_id`, `product_id`, `status='em_andamento'`, `sale_id` referência). Isso garante:
- Frontend não muda (continua lendo `client_products`)
- Resumo Inteligente, tab Produtos, dashboard e todos os contadores passam a refletir vendas
- Histórico futuro de vendas → cria pipeline automaticamente

### Comportamento do trigger
- `INSERT` em `sales` com `status IN ('pendente','concluida')` → cria `client_products` (se ainda não existir um vinculado àquela `sale_id`)
- `UPDATE sales SET status='cancelada'` → marca `client_product` correspondente como `status='cancelado'`
- Se já houver `client_product` para essa `sale_id` (caso de update), não duplica

### Backfill
Para as vendas já existentes (2 no banco) sem `client_product`, criar as linhas correspondentes em uma única instrução `INSERT ... SELECT`.

## Mudanças

### 1 Migration (única)
```sql
-- Adiciona coluna sale_id em client_products (opcional, para rastrear origem)
ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_products_sale_id_uniq
  ON public.client_products(sale_id) WHERE sale_id IS NOT NULL;

-- Função: cria client_product a partir de uma sale
CREATE OR REPLACE FUNCTION public.sync_sale_to_client_product() ...

-- Triggers AFTER INSERT e AFTER UPDATE em sales

-- Backfill das vendas existentes
INSERT INTO client_products (client_id, product_id, status, sale_id, ...)
SELECT s.client_id, s.product_id,
       CASE WHEN s.status='cancelada' THEN 'cancelado' ELSE 'em_andamento' END,
       s.id, ...
FROM sales s
LEFT JOIN client_products cp ON cp.sale_id = s.id
WHERE cp.id IS NULL AND s.product_id IS NOT NULL;
```

### Nenhuma mudança em frontend
O `IntelligentSummary.tsx` continua igual. Conta `client_products` ativos como hoje.

## Validação
1. Aplicar migration
2. Conferir no banco: `SELECT COUNT(*) FROM client_products` deve subir para refletir vendas existentes
3. Abrir ficha do "Cliente E2E" no preview → resumo deve mostrar produtos ativos > 0
4. Criar uma nova venda pelo modal → recarregar a ficha → contador atualiza

## Risco
Baixo. Trigger é idempotente (não duplica). Backfill é seguro (LEFT JOIN garante que não recria). RLS de `client_products` já existe e cobre os novos registros.

## Fora de escopo
- Refatorar UI para mostrar vendas e demandas separadamente (decisão de produto)
- Migrar demandas órfãs (`client_products` sem `sale_id`) — ficam como estão