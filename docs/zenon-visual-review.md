# Identidade visual Zenon — revisão pendente

## Implementação

- Logos oficiais, sem redesenho, na navegação e no login; selo oficial nas versões compactas.
- Nome e favicon Zenon. Identificadores técnicos antigos mantidos por compatibilidade.
- Montserrat local para interface e Times New Roman local para títulos institucionais.
- Azul profundo, marfim e bronze nos padrões de navegação e login; tokens compartilhados de superfícies e contraste.
- Preferências de cores já salvas continuam prevalecendo. Somente DEFAULT_COLORS foi alterado no gerenciador, sem alterações nos efeitos, eventos ou persistência.
- Perfil operacional mantido no indicador separado da marca. Menus, rotas e ações preservados.
- Sem mudanças em backend, consultas, permissões, documentos, exportações ou migrations.

## Origem dos assets

Arquivo fornecido: mkt em zip.zip.

| Asset | Origem oficial |
|---|---|
| logo-white.png | LOGO _ ELEM BRANCO/Artboard 5.png |
| seal-white.png | LOGO _ ELEM BRANCO/Artboard 15.png |
| logo-black.png | LOGO _ ELEM PRETO/LOGO FINAL DOUGLAS-16.png |
| seal-black.png | LOGO _ ELEM PRETO/LOGO FINAL DOUGLAS-02.png |
| montserrat-variable.ttf | Montserrat-VariableFont_wght.ttf |
| times-new-roman.ttf | Times New Roman.ttf |
| times-new-roman-bold.ttf | Times New Roman Bold.ttf |

Assets copiados integralmente, sem recoloração ou recorte. Os selos compactos precisam de conferência de legibilidade em tamanho reduzido.

## Validação executada

- Build Vite concluído; avisos de chunks grandes, classe ease ambígua e PostCSS.
- Vitest: 7 testes passaram, 3 arquivos.
- Comparação AST dos atributos JSX funcionais nos componentes modificados: handlers, links, disabled, tipo, nome, required, value e checked preservados.
- Revisão do diff: sem arquivos de backend, migrations, auth, regras de negócio ou dependências alterados.

## Ambiente e limitações

O npm ci falha na base por divergência entre package.json e package-lock.json. Para a validação local foi usado npm install --package-lock=false --legacy-peer-deps --no-audit --no-fund. A dependência peer @testing-library/dom foi instalada localmente com --no-save --package-lock=false --legacy-peer-deps; não faz parte deste PR. Portanto a reprodutibilidade por npm ci ainda requer correção separada.

O navegador Chromium não iniciou: socket() failed: Operation not permitted. O download alternativo do navegador também falhou. Não há screenshots reais desta entrega, nem validação visual ou de navegação ponta a ponta.

O admin força tema claro no código existente, e o portal cliente também possui regras de tema claro. Essas regras foram preservadas. Preferências existentes podem apresentar cores diferentes dos padrões Zenon.

## Antes de aprovar

- Revisar login e telas dos quatro perfis no preview do PR.
- Conferir desktop 1440/1280, tablet 768 e celular 390, zoom 200%, menu aberto/recolhido, foco e dropdowns.
- Conferir contraste real, logo, tabelas, formulários, documentos e modais.
- Conferir temas disponíveis e preferências personalizadas.
- Capturar antes/depois equivalentes. Verificar também se o CSS compartilhado afeta impressão/exportação; essas saídas não foram testadas.
- Páginas com classes de cores fixas podem exigir ajustes locais após inspeção visual. Esta implementação centraliza a identidade, mas não certifica todas as rotas.

## Publicação

Manter como rascunho até a revisão visual. Integrar ao main somente após confirmação do usuário. Após aprovação, sincronizar o código no projeto Lovable correto e publicar pelo fluxo existente. Nenhuma migration é necessária. Não houve publicação nem alteração em produção.
