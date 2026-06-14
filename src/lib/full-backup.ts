import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// Todas as tabelas relevantes para um backup completo.
// Se uma tabela não puder ser lida pelo usuário (RLS), ela é ignorada com aviso.
const TABLES: string[] = [
  "profiles",
  "user_roles",
  "clients",
  "companies",
  "company_contacts",
  "client_partners",
  "client_referrers",
  "client_collaborators",
  "client_providers",
  "client_subscriptions",
  "client_interactions",
  "client_timeline",
  "products",
  "product_steps",
  "product_required_documents",
  "client_products",
  "client_product_steps",
  "client_product_providers",
  "client_product_pauses",
  "client_product_delays",
  "client_product_quality_checks",
  "client_product_status_reports",
  "sales",
  "payments",
  "commissions",
  "commission_splits",
  "commission_rules",
  "expenses",
  "financial_alerts",
  "partners",
  "partner_products",
  "partner_contracts",
  "partner_materials",
  "referrers",
  "service_providers",
  "service_provider_products",
  "provider_interactions",
  "provider_schedule",
  "service_assignments",
  "collaborator_products",
  "employees",
  "leads",
  "lead_history",
  "tasks",
  "task_checklist_items",
  "task_comments",
  "documents",
  "document_requests",
  "document_versions",
  "document_history",
  "client_document_requests",
  "onboarding_documents",
  "onboarding_history",
  "contracts",
  "contract_history",
  "contract_templates",
  "proposals",
  "proposal_items",
  "projects",
  "notes",
  "notifications",
  "message_templates",
  "nps_responses",
  "daily_actions",
  "activities",
  "activity_logs",
  "audit_logs",
  "automation_rules",
  "automation_logs",
  "demand_comments",
  "demand_deliveries",
  "chat_messages",
  "system_settings",
];

const PAGE = 1000;

async function fetchAll(table: string): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  // 50k linhas de teto por tabela como guarda contra loops infinitos.
  while (from < 50_000) {
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function toSheet(rows: any[]) {
  if (!rows || rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([["(sem registros)"]]);
  }
  // Achatar valores complexos (jsonb/arrays) para string para caber em célula.
  const flat = rows.map((r) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(r)) {
      const v = (r as any)[k];
      if (v === null || v === undefined) out[k] = "";
      else if (typeof v === "object") out[k] = JSON.stringify(v);
      else out[k] = v;
    }
    return out;
  });
  return XLSX.utils.json_to_sheet(flat);
}

function sheetName(name: string) {
  // Excel: máx 31 chars, sem : \ / ? * [ ]
  return name.replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
}

export async function exportFullBackup(): Promise<void> {
  const tId = toast.loading("Preparando backup completo...");
  const wb = XLSX.utils.book_new();
  const summary: { tabela: string; registros: number | string; status: string }[] = [];

  let done = 0;
  for (const table of TABLES) {
    done++;
    toast.loading(`Exportando ${table} (${done}/${TABLES.length})...`, { id: tId });
    try {
      const rows = await fetchAll(table);
      XLSX.utils.book_append_sheet(wb, toSheet(rows), sheetName(table));
      summary.push({ tabela: table, registros: rows.length, status: "ok" });
    } catch (e: any) {
      summary.push({ tabela: table, registros: "—", status: `erro: ${e.message || e}` });
    }
  }

  // Folha de resumo no início
  const summarySheet = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, summarySheet, "_resumo");
  // Move para a primeira posição
  wb.SheetNames = ["_resumo", ...wb.SheetNames.filter((n) => n !== "_resumo")];

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `backup-completo-${stamp}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });

  const errors = summary.filter((s) => s.status !== "ok").length;
  toast.success(
    errors > 0
      ? `Backup gerado (${TABLES.length - errors}/${TABLES.length} tabelas — veja a aba _resumo).`
      : `Backup completo gerado: ${filename}`,
    { id: tId }
  );
}
