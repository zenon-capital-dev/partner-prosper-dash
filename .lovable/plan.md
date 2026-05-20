## Diagnóstico

O prestador "teste prestador af" foi salvo com sucesso na tabela `service_providers` (verificado via SQL). O problema está só na **leitura**.

A query em `src/pages/Providers.tsx` (linhas 73–87) faz:

```ts
supabase.from("service_providers").select(`
  *,
  client_products(id, status, value, clients(id, full_name)),
  contracts(id, status)
`)
```

A tabela `client_products` tem **duas FKs** apontando para `service_providers`:
- `client_products_service_provider_id_fkey` (service_provider_id)
- `client_products_responsible_provider_id_fkey` (responsible_provider_id)

Por isso o PostgREST devolve o erro `PGRST201 — Could not embed because more than one relationship was found`. A query inteira falha, o react-query devolve `data = []`, e a lista renderiza vazia (nenhum prestador aparece, nem os antigos nem os novos).

Confirmado com curl direto no endpoint REST — resposta literal:
```
"Could not embed because more than one relationship was found for 'service_providers' and 'client_products'"
```

## Correção

**Arquivo:** `src/pages/Providers.tsx` (única mudança necessária)

Desambiguar o embed apontando explicitamente para a FK correta (`service_provider_id`, que é a que representa "prestador atualmente delegado àquela demanda"):

```ts
.select(`
  *,
  client_products!client_products_service_provider_id_fkey(
    id, status, value, clients(id, full_name)
  ),
  contracts(id, status)
`)
```

Nada mais muda — a transformação `enriched` continua iterando `p.client_products` igual.

## Sobre o dropdown "Delegar prestador"

A query do `DelegateProviderDialog` é simples (`select("id, name, specialty, email").eq("active", true)`) e não tem embed ambíguo, então funciona. Se o prestador novo não apareceu lá antes do F5, era só cache do react-query (`["service-providers-active"]` não é invalidado quando se cria pela página de Prestadores). Depois de recarregar a página, ele aparece — vou confirmar isso após o fix da lista principal e, se ainda houver problema, adiciono invalidação cruzada no `onSuccess` do `ProviderFormDialog`.

## Validação

1. Abrir `/admin/prestadores` → os 4 prestadores devem aparecer, incluindo "teste prestador af".
2. Abrir a ficha de um cliente → "Delegar prestador" → o dropdown lista o mesmo.
3. Criar um novo prestador de teste → ele aparece imediatamente sem precisar de F5.
