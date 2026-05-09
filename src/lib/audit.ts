import { supabase } from "@/integrations/supabase/client";

export type AuditAction = 
  | "LOGIN" 
  | "LOGOUT" 
  | "DOCUMENT_DOWNLOAD" 
  | "DOCUMENT_VIEW" 
  | "PAGE_VIEW"
  | "SEARCH"
  | "EXPORT_DATA";

export async function logAudit(action: AuditAction, entityType: string, entityId?: string, metadata?: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get IP address if possible (from a public API or just leave it for the trigger if we were using RPC)
    // Actually, for manual logging, we might want to use an RPC that does the same as the trigger
    // but without needing a table event.
    
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata,
      // IP address will be captured by a DB trigger on INSERT if we use an RPC, 
      // but here we are inserting directly. 
      // The trigger we created 'log_activity' is only on specific tables.
      // Let's create a trigger on audit_logs itself to capture IP on every insert if not provided.
    });
  } catch (error) {
    console.error("Error logging audit:", error);
  }
}
