# Alterações no banco (Supabase)

Esta pasta diz exatamente o que precisa mudar no banco e em que ordem, para o Lovable aplicar sem interpretar e nenhuma função se perder.

Repositório público: nunca colocar nome de cliente, valor de venda ou identificador de venda aqui.

## Regras para aplicar

1. Fazer backup do banco antes.
2. Seguir a ordem da tabela "Pendentes". Uma migration de cada vez.
3. Aplicar o conteúdo do arquivo `.sql` exatamente como está. Não reescrever, não resumir, não "corrigir", não juntar com outro arquivo.
4. Se der erro, parar. Não tentar de novo com o SQL alterado. Enviar a mensagem de erro completa.
5. Depois de cada migration, rodar [conferir-banco.sql](conferir-banco.sql). Ele só lê o banco e não altera nada.
6. Publicar o site somente depois que todas as pendentes estiverem aplicadas.

## Pendentes

Atualizado em 04/11/2026.

| Ordem | Arquivo a aplicar | O que faz | Instruções |
|---|---|---|---|
| 1 | `supabase/migrations/20261103260000_numero_unico_parcelas_metas.sql` | Parcelas geradas só no banco e fórmula única de metas | [ver](20261103260000-numero-unico.md) |
| 2 | `supabase/migrations/20261104120000_fluxo_de_caixa.sql` | Livro de caixa, com as 12 funções que a tela usa | [ver](20261104120000-fluxo-de-caixa.md) |

A ordem é obrigatória: a segunda depende da primeira.

## Já copiadas pelo Lovable: confirmar no banco

O Lovable copiou estas seis para `drizzle/migrations/`, com conteúdo idêntico ao de `supabase/migrations/`, e atualizou parte de `src/integrations/supabase/types.ts`. Isso indica que foram aplicadas, mas não prova. Quem confirma é o `conferir-banco.sql`.

| Arquivo em `supabase/migrations/` | Cópia em `drizzle/migrations/` |
|---|---|
| `20261103200000_sigilo_valores_parceiro_prestador.sql` | `0001_sigilo_valores_parceiro_prestador.sql` |
| `20261103210000_cofre_valores_demandas_contratos.sql` | `0002_cofre_valores_demandas_contratos.sql` |
| `20261103220000_cascata_deducoes.sql` | `0003_cascata_deducoes.sql` |
| `20261103230000_visibilidade_financeira.sql` | `0004_visibilidade_financeira.sql` |
| `20261103240000_base_liquida_liberacao_provisoes.sql` | `0005_base_liquida_liberacao_provisoes.sql` |
| `20261103250000_vendas_antigas_regra_nova.sql` | `0006_vendas_antigas_regra_nova.sql` |

Se o Lovable continuar usando `drizzle/migrations/`, as próximas devem ser `0007` (`20261103260000`) e `0008` (`20261104120000`), com o conteúdo igual ao original.

## Como ler o conferir-banco.sql

- Uma linha `RESUMO` por migration, por exemplo `18 de 18`.
- `OK`: o objeto existe.
- `FALTA`: o objeto não existe. A migration daquela linha não foi aplicada ou foi aplicada pela metade.
- `SEM RLS`: a tabela existe, mas sem proteção por linha. Avisar antes de publicar.

Limite: o script confirma que cada objeto existe, não que a função está na versão mais recente. Por isso a ordem das migrations não pode mudar.

## Para cada alteração nova

Toda mudança que mexer no banco entra nesta pasta no mesmo pull request, com um arquivo `AAAAMMDDHHMMSS-nome.md` contendo:

1. Arquivo `.sql` a aplicar e de qual migration ele depende.
2. Tudo o que muda: tabelas, colunas, funções, gatilhos, permissões e dados existentes.
3. O que acontece com os dados atuais e o que deixa de ser permitido.
4. Quais telas dependem da mudança.
5. Como conferir depois de aplicar e como voltar atrás.

A mudança também entra na tabela "Pendentes" e no `conferir-banco.sql`. Depois de confirmada no banco, ela sai de "Pendentes".
