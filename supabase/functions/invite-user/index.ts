import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function validateServerPassword(pw: string): string | null {
  if (!pw || pw.length < 8) return "Senha precisa ter ao menos 8 caracteres";
  if (!/[A-Za-z]/.test(pw)) return "Senha precisa conter ao menos 1 letra";
  if (!/\d/.test(pw)) return "Senha precisa conter ao menos 1 número";
  return null;
}

type Role = "admin" | "admin_secondary" | "colaborador" | "vendedor" | "parceiro" | "prestador" | "indicador" | "cliente" | "lead";

interface Body {
  action?: "invite" | "set_password" | "update_profile" | "delete" | "list";
  // invite
  email?: string;
  full_name?: string;
  phone?: string;
  role?: Role;
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
  onboarding_completed?: boolean;
  manual_approval_required?: boolean;
  // generic
  user_id?: string;
  profile?: Record<string, any>;
  roles?: Role[];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const callerRoleSet = new Set((callerRoles ?? []).map((r: any) => r.role));
    const isAdmin = callerRoleSet.has("admin");
    const isAdminSecondary = callerRoleSet.has("admin_secondary");
    const canManage = isAdmin || isAdminSecondary;
    if (!canManage) return json({ error: "Apenas administradores podem gerenciar usuários" }, 403);

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action ?? "invite";

    // ---------- LIST ----------
    if (action === "list") {
      const [{ data: profiles }, { data: rolesData }, authList] = await Promise.all([
        admin.from("profiles").select("*").order("created_at", { ascending: false }),
        admin.from("user_roles").select("user_id, role"),
        admin.auth.admin.listUsers({ perPage: 1000 }),
      ]);

      const [{ data: clients }, { data: partners }, { data: providers }, { data: referrers }] = await Promise.all([
        admin.from("clients").select("id, full_name, user_id"),
        admin.from("partners").select("id, full_name, user_id"),
        admin.from("service_providers").select("id, full_name, user_id"),
        admin.from("referrers").select("id, full_name, user_id"),
      ]);

      const authUsers = authList?.data?.users ?? [];
      const byId = new Map(authUsers.map((u: any) => [u.id, u]));

      const enriched = (profiles ?? []).map((p: any) => {
        const auth = byId.get(p.id);
        return {
          ...p,
          roles: (rolesData ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
          last_sign_in_at: auth?.last_sign_in_at ?? null,
          email_confirmed_at: auth?.email_confirmed_at ?? null,
          auth_created_at: auth?.created_at ?? null,
          links: {
            clients: (clients ?? []).filter((c: any) => c.user_id === p.id).map((c: any) => ({ id: c.id, name: c.full_name })),
            partners: (partners ?? []).filter((c: any) => c.user_id === p.id).map((c: any) => ({ id: c.id, name: c.full_name })),
            providers: (providers ?? []).filter((c: any) => c.user_id === p.id).map((c: any) => ({ id: c.id, name: c.full_name })),
            referrers: (referrers ?? []).filter((c: any) => c.user_id === p.id).map((c: any) => ({ id: c.id, name: c.full_name })),
          },
        };
      });
      return json({ ok: true, users: enriched });
    }

    // ---------- SET PASSWORD ----------
    if (action === "set_password") {
      if (!body.user_id || !body.password) return json({ error: "user_id e password obrigatórios" }, 400);
      const pwErr = validateServerPassword(String(body.password));
      if (pwErr) return json({ error: pwErr }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password: body.password,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- UPDATE PROFILE ----------
    if (action === "update_profile") {
      if (!body.user_id) return json({ error: "user_id obrigatório" }, 400);
      const profile = body.profile ?? {};
      // Whitelist editable fields
      const allowed = [
        "full_name", "email", "phone", "avatar_url", "document_number",
        "address_street", "address_number", "address_complement", "address_neighborhood",
        "address_city", "address_state", "address_zip_code", "address_zip",
        "active", "has_system_access", "internal_notes",
        "manual_approval_required", "onboarding_completed", "onboarding_step",
      ];
      const update: Record<string, any> = {};
      for (const k of allowed) if (k in profile) update[k] = profile[k];

      if (Object.keys(update).length > 0) {
        const { error } = await admin.from("profiles").update(update).eq("id", body.user_id);
        if (error) return json({ error: error.message }, 400);
      }

      // If email changed in profile, also sync on auth
      if (update.email) {
        await admin.auth.admin.updateUserById(body.user_id, { email: update.email, email_confirm: true });
      }

      // Roles replacement (optional)
      if (Array.isArray(body.roles)) {
        // Block admin_secondary from promoting/demoting admins
        if (!isAdmin) {
          const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", body.user_id);
          const targetIsAdmin = (targetRoles ?? []).some((r: any) => r.role === "admin");
          const wantsAdmin = body.roles.includes("admin");
          if (targetIsAdmin || wantsAdmin) {
            return json({ error: "Apenas o admin principal pode gerenciar admins" }, 403);
          }
        }
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        const inserts = body.roles.filter(Boolean).map((r) => ({ user_id: body.user_id!, role: r }));
        if (inserts.length) {
          const { error } = await admin.from("user_roles").insert(inserts);
          if (error) return json({ error: error.message }, 400);
        }
      }

      return json({ ok: true });
    }

    // ---------- DELETE ----------
    if (action === "delete") {
      if (!body.user_id) return json({ error: "user_id obrigatório" }, 400);
      if (body.user_id === userData.user.id) return json({ error: "Você não pode excluir sua própria conta" }, 400);
      if (!isAdmin) {
        const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", body.user_id);
        const targetIsAdmin = (targetRoles ?? []).some((r: any) => r.role === "admin");
        if (targetIsAdmin) return json({ error: "Apenas o admin principal pode excluir outro admin" }, 403);
      }
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- INVITE (default) ----------
    if (!body.email || !body.role) return json({ error: "email e role obrigatórios" }, 400);
    if (body.password) {
      const pwErr = validateServerPassword(String(body.password));
      if (pwErr) return json({ error: pwErr }, 400);
    }

    let userId: string | null = null;
    let tempPassword: string | null = null;

    const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingList?.users?.find((u: any) => u.email?.toLowerCase() === body.email!.toLowerCase());

    if (existing) {
      userId = existing.id;
      if (body.password) {
        await admin.auth.admin.updateUserById(userId, { password: body.password, email_confirm: true });
        tempPassword = body.password;
      }
    } else if (body.password) {
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

    await admin.from("profiles").upsert({
      id: userId,
      email: body.email,
      full_name: body.full_name ?? body.email,
      phone: body.phone ?? null,
      has_system_access: body.has_system_access ?? true,
      internal_notes: body.internal_notes ?? null,
      onboarding_completed: body.role === "cliente" ? (body.onboarding_completed ?? true) : undefined,
      onboarding_step: body.role === "cliente" && (body.onboarding_completed ?? true) ? 5 : undefined,
      manual_approval_required: body.role === "cliente" ? (body.manual_approval_required ?? false) : undefined,
    });

    // Only admin can grant admin role
    if (body.role === "admin" && !isAdmin) {
      return json({ error: "Apenas o admin principal pode promover a admin" }, 403);
    }

    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: body.role });

    if (body.link_client_id) {
      await admin.from("clients").update({
        user_id: userId,
        ...(body.role === "cliente" && (body.onboarding_completed ?? true)
          ? { onboarding_status: "concluido", onboarding_progress: 100, onboarding_completed_at: new Date().toISOString() }
          : {}),
      }).eq("id", body.link_client_id);
    }
    if (body.link_partner_id) await admin.from("partners").update({ user_id: userId }).eq("id", body.link_partner_id);
    if (body.link_referrer_id) await admin.from("referrers").update({ user_id: userId }).eq("id", body.link_referrer_id);
    if (body.link_service_provider_id || (body.link_type === "service_provider" && body.link_id)) {
      const id = body.link_service_provider_id ?? body.link_id!;
      await admin.from("service_providers").update({ user_id: userId }).eq("id", id);
    }
    if (body.link_type === "client" && body.link_id) {
      await admin.from("clients").update({
        user_id: userId,
        ...(body.role === "cliente" && (body.onboarding_completed ?? true)
          ? { onboarding_status: "concluido", onboarding_progress: 100, onboarding_completed_at: new Date().toISOString() }
          : {}),
      }).eq("id", body.link_id);
    }
    if (body.link_type === "partner" && body.link_id) {
      await admin.from("partners").update({ user_id: userId }).eq("id", body.link_id);
    }

    return json({ ok: true, user_id: userId, temp_password: tempPassword });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
