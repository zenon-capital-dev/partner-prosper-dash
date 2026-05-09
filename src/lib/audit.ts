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
    
    // We try to log even if user is null (e.g. login attempt)
    // but the DB constraint might require user_id if we didn't make it nullable.
    // In our migration, user_id is REFERENCES auth.users(id), but doesn't have NOT NULL.
    
    await supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata || {},
    });
  } catch (error) {
    console.warn("Audit log failed:", error);
  }
}
