# CRM inteiro: mapa do banco

Retrato completo do banco do CRM, de ponta a ponta. Serve para o Lovable saber o que precisa existir, em qual migration está a versão que vale e qual tela depende de cada coisa.

Levantamento de 04/11/2026, sobre a branch `main`.

## Nunca repetir todas as migrations

**Não rode as migrations de `supabase/migrations/` de novo em sequência no banco de produção.** Elas são o histórico do banco, não uma lista de pendências.

A migration `20260521201011_6b0fd385-df71-4df6-8ca3-d525ae8f1b8f.sql` esvazia as tabelas operacionais com `TRUNCATE` e remove usuários. Repetir essa migration apagaria os dados reais.

Aplique somente o que estiver em "Pendentes" no [README principal](../README.md).

## O que tem nesta pasta

| Arquivo | Conteúdo |
|---|---|
| [lacunas.md](lacunas.md) | **Comece aqui.** O que falta, o que está em risco e quem resolve |
| [conferir-crm-inteiro.sql](conferir-crm-inteiro.sql) | Compara o banco real com tudo abaixo. Só lê |
| [tabelas.md](tabelas.md) | 113 tabelas e 1.454 colunas |
| [funcoes.md](funcoes.md) | 210 funções, com a migration e a linha da versão final |
| [gatilhos.md](gatilhos.md) | 200 gatilhos |
| [politicas.md](politicas.md) | 405 políticas de acesso |
| [outros.md](outros.md) | Views, enums, pastas de arquivos, tempo real, edge functions e índices |
| [telas.md](telas.md) | O que cada arquivo do sistema usa do banco |

## Como usar

1. Fazer backup do banco, direto no banco. O backup do menu do sistema não serve para isso: ver [lacunas.md](lacunas.md).
2. Rodar `conferir-crm-inteiro.sql` e guardar o resultado.
3. Para cada linha `FALTA`, seguir [lacunas.md](lacunas.md). Se não estiver lá, procurar a versão final do objeto nos arquivos desta pasta.
4. Rodar o script de novo. O resultado esperado é não sobrar nenhuma linha `FALTA`.

## Como ler o resultado

| Situação | Significado | O que fazer |
|---|---|---|
| `RESUMO` | Total conferido por tipo, por exemplo `funcao: 210 de 210` | Olhar primeiro |
| `FALTA` | Existe nas migrations, não existe no banco | Aplicar a migration indicada, se estiver em "Pendentes". Se não estiver, avisar antes |
| `VERSAO DIFERENTE` | A função existe, mas o corpo não é igual ao da versão final | Comparar com a linha indicada em [funcoes.md](funcoes.md) antes de mudar |
| `SEM RLS` | A tabela está sem proteção por linha | Avisar antes de publicar |
| `SO NO BANCO` | Existe no banco, mas em nenhuma migration | Não apagar. Registrar em uma migration, para não se perder |

Os objetos das duas migrations pendentes vão aparecer como `FALTA` ou `VERSAO DIFERENTE` até serem aplicadas. Algumas linhas `SO NO BANCO` são esperadas, porque vieram de migrations com laços dinâmicos: ver [lacunas.md](lacunas.md).

## Como foi feito

- Leitura, em ordem, das 381 migrations de `supabase/migrations/` e de `drizzle/migrations/0000_collab_fk_doc_shares_support.sql`, acompanhando cada criação, alteração e remoção até o estado final.
- Leitura de todos os arquivos de `src/` e `supabase/functions/`, exceto testes, para saber o que cada um usa.
- Comparação com `src/integrations/supabase/types.ts`, que o Lovable gera a partir do banco.

## O que foi verificado

- **Tabelas e colunas:** as 107 tabelas do `types.ts` batem coluna por coluna com as migrations. As diferenças são as 6 tabelas do caixa e 2 colunas de `sales`, que são das migrations pendentes.
- **Funções:** todas as chamadas pelo sistema têm definição em migration. Os gatilhos apontam para funções que existem.

## O que não foi verificado

- **Banco real:** não tenho acesso a ele. Este mapa vem do repositório, e o estado real só se confirma rodando o script.
- **Script:** `conferir-crm-inteiro.sql` ainda não foi executado em nenhum Postgres. Se der erro de sintaxe, envie a mensagem. O banco não corre risco, porque o script só lê.
- **Conteúdo das políticas:** esta pasta lista quais políticas existem, não se cada regra de acesso está correta.
- **Colunas no código:** só foram conferidas as escritas de forma literal nas consultas.
