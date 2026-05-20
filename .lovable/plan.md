Vou refatorar a aba Propostas para ficar no mesmo padrão das abas já revisadas: confiável, clara, responsiva e sem ações quebradas.

Escopo proposto:

1. Corrigir listagem, filtros e busca
- Normalizar busca por número da proposta, cliente, lead, empresa, e-mail e documento.
- Adicionar filtros úteis: status, validade e vínculo/destinatário.
- Adicionar chips de filtros ativos com opção de limpar tudo.
- Adicionar ordenação na tabela por número, destinatário, total, validade, status e criação.
- Corrigir estados de carregamento e vazio com skeleton/empty state adequado.
- Manter visual claro premium do admin: cards brancos, bordas slate suaves, sombra leve, sem dark/cyan/violet.

2. Corrigir regras de status e validade
- Evitar atualização automática agressiva que roda em loop ou altera propostas sem contexto visual.
- Marcar vencidas com lógica segura de data local, sem deslocamento de fuso.
- Exibir vencimento, dias restantes e propostas vencidas de forma clara.
- Proteger transições incoerentes, como converter proposta sem item válido ou sem cliente.

3. Melhorar criação e edição de propostas
- Corrigir seleção de destinatário para cliente, lead e manual; hoje lead existe no estado mas não aparece na UI.
- Ao selecionar cliente/lead, preencher dados do destinatário quando necessário.
- Validar e normalizar e-mail, documento, datas e valores numéricos.
- Impedir quantidade inválida, preço negativo, desconto negativo ou desconto maior que o subtotal do item.
- Melhorar layout do formulário para mobile e desktop, sem campos espremidos.
- Garantir que salvar edição não deixe proposta sem itens caso a reinserção falhe.

4. Melhorar itens, totais e cálculo financeiro
- Recalcular subtotal, descontos e total de modo consistente.
- Mostrar total por item com limite mínimo zero.
- Evitar NaN quando campos numéricos ficam vazios.
- Exibir resumo financeiro fixo e legível no formulário.

5. Corrigir ações críticas
- Esconder editar/excluir/mudar status/converter para usuários sem permissão de gestão.
- Adicionar confirmação mais clara para exclusão.
- Validar conversão em venda antes de gravar qualquer dado.
- Converter usando data local e valores corretos.
- Invalidar também queries de vendas e produtos contratados após conversão.
- Mostrar mensagens de erro mais humanas quando a base bloquear uma ação.

6. Melhorar visualização/impressão
- Polir o modal de visualização no padrão premium claro.
- Corrigir responsividade da tabela de itens dentro do preview.
- Exibir dados do destinatário, validade, status, itens e totais sem quebras visuais.
- Manter botão de impressão funcional e com área imprimível limpa.

7. Verificação final
- Revisar possíveis erros TypeScript no arquivo alterado.
- Conferir sinais do preview/dev-server após a mudança.
- Não alterar estrutura do banco neste primeiro passe, porque a tabela já existe e os dados reais estão íntegros.