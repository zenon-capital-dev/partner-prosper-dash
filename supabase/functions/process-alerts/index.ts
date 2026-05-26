import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Require authenticated admin caller
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("admin_secondary")) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Process Pending Commissions
    const { data: commissions, error: commError } = await admin
      .from("commissions")
      .select("id, amount, partners(full_name, email)")
      .in("status", ["gerada", "em_analise", "aprovada"])
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (commError) throw commError;

    // Get an admin to notify (simplified)
    const { data: adminUsers } = await admin.auth.admin.listUsers();
    const adminToNotify = adminUsers.users.find(u => u.user_metadata?.role === 'admin') || adminUsers.users[0];

    const alerts = [];

    for (const c of commissions || []) {
      const partnerName = c.partners?.full_name || "Parceiro";
      const message = `A comissão de ${partnerName} no valor de R$ ${c.amount} está pendente há mais de 7 dias.`;
      
      // Check if we already notified recently
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("title", "Comissão Pendente")
        .ilike("message", `%${partnerName}%`)
        .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!existing || existing.length === 0) {
        await admin.from("notifications").insert({
          user_id: adminToNotify?.id,
          title: "Comissão Pendente",
          message,
          type: "warning",
          link: "/commissions"
        });
        
        alerts.push({ type: 'commission', id: c.id, recipient: adminToNotify?.email });
      }
    }

    // 2. Process Overdue Documents
    const { data: docs, error: docError } = await admin
      .from("client_document_requests")
      .select("id, title, clients(full_name, email)")
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString());

    if (docError) throw docError;

    for (const d of docs || []) {
      const clientName = d.clients?.full_name || "Cliente";
      const message = `O documento "${d.title}" do cliente ${clientName} está com o prazo vencido.`;

      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("title", "Documento Atrasado")
        .ilike("message", `%${d.title}%`)
        .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!existing || existing.length === 0) {
        await admin.from("notifications").insert({
          user_id: adminToNotify?.id,
          title: "Documento Atrasado",
          message,
          type: "error",
          link: "/clients"
        });
        
        alerts.push({ type: 'document', id: d.id, recipient: adminToNotify?.email });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, alerts_processed: alerts.length, details: alerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error('[process-alerts] internal error:', e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
