import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Require authenticated user
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    // getUser(token) valida o JWT no servidor e existe em qualquer versão do
    // supabase-js v2 (getClaims só chegou em versões mais novas do cliente).
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message } = await req.json()

    let reply = "";
    const lowerMessage = String(message ?? "").toLowerCase();

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
    console.error('[ai-assistant] internal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
