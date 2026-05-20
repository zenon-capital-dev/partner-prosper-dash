// Edge function: calc-commission
// Calcula e cria/atualiza comissões (parceiro + indicador + colaborador) para uma venda.
// Server-side, evita manipulação client-side de percentuais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  sale_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente para validar JWT do usuário
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uid = userData.user.id;

    // Service client para regras/writes
    const admin = createClient(supabaseUrl, serviceKey);

    // Valida permissão (admin OU criador da venda)
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .in("role", ["admin", "admin_secondary"])
      .maybeSingle();
    const isAdmin = !!roleRow;

    const body = (await req.json()) as Body;
    if (!body?.sale_id) {
      return new Response(JSON.stringify({ error: "sale_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sale, error: saleErr } = await admin
      .from("sales")
      .select(
        "id, client_id, product_id, partner_id, referrer_id, collaborator_id, amount, commission_percent, referrer_percent, collaborator_percent, created_by"
      )
      .eq("id", body.sale_id)
      .maybeSingle();

    if (saleErr || !sale) {
      return new Response(JSON.stringify({ error: "Sale not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin && sale.created_by !== uid) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca regra ativa para o parceiro+produto
    let rule: any = null;
    if (sale.partner_id) {
      const { data: r } = await admin
        .from("commission_rules")
        .select("*")
        .eq("partner_id", sale.partner_id)
        .eq("product_id", sale.product_id)
        .maybeSingle();
      rule = r;
    }

    // Apaga comissões antigas dessa venda e recria (idempotente)
    await admin.from("commissions").delete().eq("sale_id", sale.id);

    const inserts: any[] = [];
    const amount = Number(sale.amount ?? 0);

    // Parceiro
    if (sale.partner_id) {
      const percent =
        rule?.rule_type === "percentage" || rule?.rule_type === "percent"
          ? Number(rule.value)
          : Number(sale.commission_percent ?? 0);
      const value =
        rule?.rule_type === "fixed"
          ? Number(rule.value)
          : (amount * percent) / 100;
      inserts.push({
        sale_id: sale.id,
        partner_id: sale.partner_id,
        product_id: sale.product_id,
        client_id: sale.client_id,
        amount: value,
        percent,
        sale_value: amount,
        rule_type: rule?.rule_type ?? "percent",
        rule_value: rule?.value ?? percent,
        applied_rule_id: rule?.id ?? null,
        applied_rule_description: rule
          ? `Regra ${rule.rule_type} ${rule.value}`
          : "Percentual da venda",
        is_recurring: rule?.is_recurring ?? false,
        commission_type: "parceiro",
        status: "pendente",
      });
    }

    // Indicador
    if (sale.referrer_id && Number(sale.referrer_percent ?? 0) > 0) {
      const percent = Number(sale.referrer_percent);
      inserts.push({
        sale_id: sale.id,
        partner_id: sale.referrer_id,
        product_id: sale.product_id,
        client_id: sale.client_id,
        amount: (amount * percent) / 100,
        percent,
        sale_value: amount,
        rule_type: "percent",
        rule_value: percent,
        commission_type: "indicador",
        status: "pendente",
      });
    }

    // Colaborador
    if (sale.collaborator_id && Number(sale.collaborator_percent ?? 0) > 0) {
      const percent = Number(sale.collaborator_percent);
      inserts.push({
        sale_id: sale.id,
        partner_id: sale.collaborator_id,
        product_id: sale.product_id,
        client_id: sale.client_id,
        amount: (amount * percent) / 100,
        percent,
        sale_value: amount,
        rule_type: "percent",
        rule_value: percent,
        commission_type: "colaborador",
        status: "pendente",
      });
    }

    if (inserts.length === 0) {
      return new Response(JSON.stringify({ ok: true, created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insErr } = await admin
      .from("commissions")
      .insert(inserts)
      .select("id, amount, commission_type");

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, created: inserted?.length ?? 0, commissions: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
