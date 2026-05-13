import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "admin" | "admin_secondary" | "colaborador" | "parceiro" | "prestador" | "cliente" | "lead";

interface Body {
  email: string;
  full_name?: string;
  phone?: string;
  role: Role;
  send_invite?: boolean;
  password?: string;
  has_system_access?: boolean;
  internal_notes?: string;
  link_client_id?: string;
  link_partner_id?: string;
  link_referrer_id?: string;
  link_service_provider_id?: string;
  link_type?: "client" | "partner" | "referrer" | "service_provider";
  link_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admin pode convidar usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as Body;
    if (!body.email || !body.role) {
      return new Response(JSON.stringify({ error: "email e role obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Try invite (sends email with set-password link) OR create with password
    let userId: string | null = null;
    let tempPassword: string | null = null;

    // Check if user already exists (by email)
    const { data: existingList } = await admin.auth.admin.listUsers();
    const existing = existingList?.users?.find((u: any) => u.email?.toLowerCase() === body.email.toLowerCase());

    if (existing) {
      userId = existing.id;
      if (body.password) {
        await admin.auth.admin.updateUserById(userId, { password: body.password, email_confirm: true });
        tempPassword = body.password;
      }
    } else if (body.password) {
      // Admin definiu senha personalizada
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name ?? body.email },
      });
      if (cErr) throw cErr;
      userId = created.user!.id;
      tempPassword = body.password;
    } else if (body.send_invite !== false) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(body.email, {
        data: { full_name: body.full_name ?? body.email },
      });
      if (invErr) {
        // fallback: create with temp password
        tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: body.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: body.full_name ?? body.email },
        });
        if (cErr) throw cErr;
        userId = created.user!.id;
      } else {
        userId = inv.user!.id;
      }
    } else {
      tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: body.full_name ?? body.email },
      });
      if (cErr) throw cErr;
      userId = created.user!.id;
    }

    // Ensure profile (handle_new_user trigger should make it; just upsert phone/name)
    await admin.from("profiles").upsert({
      id: userId,
      email: body.email,
      full_name: body.full_name ?? body.email,
      phone: body.phone ?? null,
      has_system_access: body.has_system_access ?? true,
      internal_notes: body.internal_notes ?? null,
    });

    // Set role: clear existing then set chosen
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: body.role });

    // Link to entity
    if (body.link_client_id) {
      await admin.from("clients").update({ user_id: userId }).eq("id", body.link_client_id);
    }
    if (body.link_partner_id) {
      await admin.from("partners").update({ user_id: userId }).eq("id", body.link_partner_id);
    }
    if (body.link_referrer_id) {
      await admin.from("referrers").update({ user_id: userId }).eq("id", body.link_referrer_id);
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, temp_password: tempPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
