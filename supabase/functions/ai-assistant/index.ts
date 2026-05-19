import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, history } = await req.json()

    // Respostas simuladas úteis para o contexto do CRM Prosper
    let reply = "";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("ajuda") || lowerMessage.includes("help")) {
      reply = "Olá! Como assistente de IA da Prosper, posso te ajudar a navegar pelo CRM. Você pode me perguntar sobre como gerenciar clientes, ver propostas ou configurar automações.";
    } else if (lowerMessage.includes("cliente")) {
      reply = "Para ver seus clientes, acesse o menu 'Clientes' na barra lateral. Lá você pode filtrar por status, ver o histórico de interações e editar informações cadastrais.";
    } else if (lowerMessage.includes("venda") || lowerMessage.includes("comercial")) {
      reply = "Na aba 'Comercial' você encontra Propostas, Vendas e Produtos. Se precisar de um relatório detalhado, vá em 'Inteligência' -> 'Relatórios'.";
    } else if (lowerMessage.includes("automação") || lowerMessage.includes("automacoes")) {
      reply = "As automações podem ser configuradas em 'Sistema' -> 'Automações'. Lá você define gatilhos para alertas de prazos, notificações de novos documentos e muito mais.";
    } else if (lowerMessage.includes("oi") || lowerMessage.includes("olá") || lowerMessage.includes("ola")) {
      reply = "Olá! Sou o assistente de IA do CRM Prosper. Em que posso ser útil hoje?";
    } else {
      reply = `Recebi sua mensagem: "${message}". No momento, estou aprendendo a consultar os dados reais do seu CRM para te dar respostas ainda mais precisas sobre faturamento, prazos e metas.`;
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
