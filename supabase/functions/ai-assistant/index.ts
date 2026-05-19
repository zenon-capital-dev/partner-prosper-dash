import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/reflection@0.1.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, history, context } = await req.json()

    // Here we would typically integrate with an LLM provider (OpenAI, Anthropic, etc.)
    // For now, we'll return a helpful simulated response based on the CRM context
    
    let reply = "";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("ajuda") || lowerMessage.includes("help")) {
      reply = "Como assistente do CRM Prosper, posso te ajudar a navegar pelas seções de clientes, vendas e automações. O que você gostaria de fazer?";
    } else if (lowerMessage.includes("cliente")) {
      reply = "Você pode gerenciar seus clientes na seção 'Clientes'. Lá você verá a lista completa e o status de cada um.";
    } else if (lowerMessage.includes("venda")) {
      reply = "A seção de 'Vendas' mostra todas as transações fechadas e propostas em andamento.";
    } else {
      reply = `Entendi sua mensagem sobre "${message}". No momento estou sendo treinado para te dar respostas mais precisas sobre dados do CRM, mas já posso te ajudar com navegação básica.`;
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
