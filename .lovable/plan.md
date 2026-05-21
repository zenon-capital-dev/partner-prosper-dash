## O que está errado hoje

No formulário de criar colaborador (`src/pages/Collaborators.tsx` → `CreateCollaboratorDialog`):

1. **Login e senha** — o campo "Senha inicial" existe mas está marcado como *opcional* e escondido no final. Quem não preenche acaba caindo no fluxo "enviar convite por e-mail" — e como o serviço de e-mail nem sempre entrega, o colaborador fica sem conseguir entrar. Além disso a validação do backend exige **letra + número + 8 caracteres**, mas o formulário só fala em "8 caracteres", então o erro aparece como um toast genérico.

2. **Dados faltando** — hoje só pede Nome, E-mail, Telefone, Função, Observações. Faltam campos importantes que a tabela `profiles` já suporta: CPF, endereço completo (CEP/rua/número/bairro/cidade/UF), cargo, setor/departamento, data de admissão.

## Solução proposta

Refazer o `CreateCollaboratorDialog` em **2 abas** com tudo do colaborador num lugar só:

### Aba 1 — Dados do colaborador
- **Identificação** (obrigatório): Nome completo, CPF (com máscara), E-mail, Telefone
- **Cargo e setor**: Cargo (ex: "Analista de operações"), Setor/Departamento (ex: "Comercial"), Data de admissão
- **Endereço**: CEP (com lookup automático já existente no projeto via `useCepLookup`), Rua, Número, Complemento, Bairro, Cidade, UF
- **Observações internas**: textarea livre

### Aba 2 — Acesso ao sistema
- **Função** (radio cards visuais): Colaborador / Admin Secundário / Admin
- **Permitir login** (switch). Se desligado, esconde os campos de senha — colaborador fica só como cadastro interno.
- **Definir senha agora** (obrigatório quando login está ligado):
   - Campo Senha (mín. 8 caracteres, 1 letra, 1 número) — com regras visíveis em tempo real (✓ verde / ✗ vermelho conforme digita)
   - Campo Confirmar senha
   - Botão "Gerar senha forte" que preenche automaticamente
- Aviso claro: *"Esta será a senha de primeiro acesso. O colaborador pode trocar depois em Perfil."*

### Após criar
- Tela de confirmação mostrando **e-mail + senha juntos**, com botão "Copiar credenciais" (formato `email | senha`) — facilita mandar pro colaborador no WhatsApp.
- Botão "Cadastrar outro" e "Fechar".

## Mudanças técnicas

- **`src/pages/Collaborators.tsx`**: substituir o `CreateCollaboratorDialog` pelo novo dialog em 2 abas. Validação local com mensagens claras (não só toast).
- **`supabase/functions/invite-user/index.ts`**: receber e gravar os novos campos (`document_number`, endereço, `position`, `department`, `admission_date`) no upsert de `profiles`. Manter compatibilidade com o resto do sistema.
- **Migration**: adicionar colunas `position` (text), `department` (text), `admission_date` (date) na tabela `profiles` — não existem hoje.
- O fluxo de "enviar convite por e-mail sem senha" será **removido da UI de colaborador** (continua disponível no painel de usuários se precisar). Para colaborador, senha sempre é setada na hora — assim 100% das contas criadas conseguem logar.

## Fora do escopo

- Importação em lote de colaboradores via CSV.
- Foto de perfil no momento do cadastro (continua editável depois em Perfil).
- Alterar o dialog de **editar** colaborador agora (faço numa próxima se quiser).
