import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const users = [
    { email: "teste.cliente@demo.com",   role: "cliente",   full_name: "Cliente Teste" },
    { email: "teste.parceiro@demo.com",  role: "parceiro",  full_name: "Parceiro Teste" },
    { email: "teste.prestador@demo.com", role: "prestador", full_name: "Prestador Teste" },
    { email: "teste.indicador@demo.com", role: "indicador", full_name: "Indicador Teste" },
    { email: "teste.colab@demo.com",     role: "colaborador", full_name: "Colaborador Teste" },
  ];
  const password = "Teste@1234";
  const out: any[] = [];

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });

  for (const u of users) {
    const existing = list?.users?.find((x: any) => x.email?.toLowerCase() === u.email);
    let id = existing?.id;
    if (id) {
      await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email, password, email_confirm: true, user_metadata: { full_name: u.full_name },
      });
      if (error) { out.push({ email: u.email, error: error.message }); continue; }
      id = data.user!.id;
    }
    await admin.from("profiles").upsert({ id, email: u.email, full_name: u.full_name, has_system_access: true });
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.from("user_roles").insert({ user_id: id, role: u.role });

    // Link to entity records so panels have data
    if (u.role === "cliente") {
      const { data: c } = await admin.from("clients").insert({
        full_name: u.full_name, email: u.email, user_id: id,
        onboarding_status: "concluido", onboarding_progress: 100, onboarding_completed_at: new Date().toISOString(),
      }).select("id").single();
      out.push({ ...u, password, user_id: id, client_id: c?.id });
    } else if (u.role === "parceiro") {
      const { data: p } = await admin.from("partners").insert({ full_name: u.full_name, email: u.email, user_id: id }).select("id").single();
      out.push({ ...u, password, user_id: id, partner_id: p?.id });
    } else if (u.role === "prestador") {
      const { data: sp } = await admin.from("service_providers").insert({ full_name: u.full_name, email: u.email, user_id: id }).select("id").single();
      out.push({ ...u, password, user_id: id, provider_id: sp?.id });
    } else if (u.role === "indicador") {
      const { data: r } = await admin.from("referrers").insert({ full_name: u.full_name, email: u.email, user_id: id }).select("id").single();
      out.push({ ...u, password, user_id: id, referrer_id: r?.id });
    } else {
      out.push({ ...u, password, user_id: id });
    }
  }

  return new Response(JSON.stringify({ ok: true, password, users: out }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
