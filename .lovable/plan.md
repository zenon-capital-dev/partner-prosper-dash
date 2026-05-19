# Refazer o Painel do Colaborador

## O que está errado hoje

O colaborador hoje cai dentro do `/admin` (AdminLayout aceita `colaborador` no `RouteGuard`) e enxerga um painel praticamente idêntico ao admin. Não é isso que você quer.

## O que vai virar

Colaborador = staff interno operacional. Painel próprio em `/colaborador`, parecido com o do prestador (focado em demandas que estão na mão dele), com algumas funções a mais. O `/admin` fica bloqueado pra ele, exceto a página de **Clientes em modo leitura**.

---

## Painel novo `/colaborador`

Estrutura espelhada no `/prestador` (tabs no topo, layout limpo):

1. **Dashboard** — cards resumo: minhas demandas abertas, tarefas pendentes hoje, prazos vencendo, últimas mensagens
2. **Minhas Demandas** — lista das `client_products` onde ele é o responsável (`assigned_to = auth.uid()`); abre detalhe com etapas, comentários, status
3. **Minhas Tarefas** — `tasks` atribuídas a ele, com checklist + prazo
4. **Clientes** — leitura dos clientes vinculados às demandas dele (nome, contato, status) — sem editar
5. **Documentos** — docs das demandas que ele toca, com upload quando faz sentido
6. **Perfil** — dados pessoais e troca de senha

Sidebar lateral enxuta (não a do admin), mesma estética clara que o /admin usa.

## Acesso ao /admin

- Tentou ir em `/admin`, `/vendas`, `/financeiro`, etc → redireciona pro `/colaborador`
- Exceção: `/clientes` (lista) e `/clientes/:id` (ficha) ficam acessíveis **só leitura** — botões de criar/editar/excluir somem, ações ficam desabilitadas

## Backend / RLS

Migração ajustando policies pra garantir que mesmo via API direta o colaborador só veja o dele:

- `client_products`: SELECT permitido quando `assigned_to = auth.uid()` (mantém regra do admin separada)
- `tasks`: SELECT/UPDATE quando `assigned_to = auth.uid()`
- `clients`: SELECT permitido quando existe ao menos uma demanda dele atrelada àquele cliente
- `documents`: SELECT atrelado às demandas dele
- INSERT/UPDATE/DELETE de parceiros, leads, prestadores, vendas, comissões, contratos → bloqueado pra colaborador (já está, vou só revalidar)

## Roteamento

- `RoleHome`: `isColaborador` agora vai pra `/colaborador` (não mais `/admin`)
- `AdminLayout`: remover `colaborador` do `RouteGuard.allow`; criar exceção só pras rotas `/clientes*` aceitando colaborador em modo readonly
- `/clientes` (Clients.tsx + ClientDetail.tsx): detectar `isColaborador` e esconder/desabilitar tudo que escreve

## Arquivos tocados

```text
novo:    src/pages/CollaboratorPanel.tsx      (painel real, hoje é só redirect)
novo:    src/components/collaborator/CollaboratorSidebar.tsx
editar:  src/components/RoleHome.tsx          (colaborador → /colaborador)
editar:  src/components/admin/AdminLayout.tsx (allow só admin/admin_secondary/vendedor; exceção /clientes p/ colaborador readonly)
editar:  src/pages/Clients.tsx                (modo readonly se isColaborador)
editar:  src/pages/ClientDetail.tsx           (modo readonly se isColaborador)
editar:  src/App.tsx                          (rotas /colaborador e /colaborador/:tab)
migração: ajustar RLS de client_products / tasks / clients / documents pra colaborador
```

---

## Resumo executivo

Colaborador deixa de morar no /admin. Ganha um portal próprio focado em demandas dele (igual ao do prestador, com tarefas e leitura de clientes a mais). A única coisa que ele continua vendo do /admin é a listagem de clientes, em leitura. Tudo travado também no banco via RLS.
