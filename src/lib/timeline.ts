import { supabase } from "@/integrations/supabase/client";

export type TimelineEventType =
  | "client_created"
  | "client_updated"
  | "sale_added"
  | "sale_status"
  | "document_requested"
  | "document_uploaded"
  | "document_approved"
  | "commission_paid"
  | "note_added"
  | "tag_added"
  | "contract_generated";

export async function logTimeline(
  clientId: string,
  eventType: TimelineEventType,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>,
) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("client_timeline").insert({
    client_id: clientId,
    user_id: userData.user?.id,
    event_type: eventType,
    title,
    description,
    metadata: metadata ?? {},
  });
}

export async function notifyAdmins(title: string, message: string, link?: string) {
  // Busca todos os admins e cria notificação para cada
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (!admins?.length) return;
  const rows = admins.map((a) => ({
    user_id: a.user_id,
    title,
    message,
    link: link ?? null,
    type: "info",
  }));
  await supabase.from("notifications").insert(rows);
}
