import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const targets = [
    "cliente@teste.com",
    "parceiro@teste.com",
    "colaborador@teste.com",
    "prestador@teste.com",
  ];
  const out: Record<string, string> = {};
  for (const email of targets) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list?.users.find((x) => x.email === email);
    if (!u) { out[email] = "not_found"; continue; }
    const { error } = await admin.auth.admin.updateUserById(u.id, {
      password: "Teste@2026",
      email_confirm: true,
    });
    out[email] = error ? `err:${error.message}` : "ok";
  }
  return new Response(JSON.stringify(out), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
