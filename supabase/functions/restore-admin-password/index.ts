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
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = list?.users.find((x) => x.email === "admin@admin.com");
  if (!u) return new Response(JSON.stringify({ status: "not_found" }), { headers: { ...cors, "content-type": "application/json" } });
  const { error } = await admin.auth.admin.updateUserById(u.id, {
    password: "admin123",
    email_confirm: true,
  });
  return new Response(JSON.stringify({ status: error ? `err:${error.message}` : "ok" }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
