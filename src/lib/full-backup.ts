import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { toast } from "sonner";

/**
 * Backup completo da plataforma em uma única planilha .xlsx.
 *
 * Organização: as tabelas são agrupadas por área de negócio e ganham um
 * prefixo numérico (01_, 02_, ...) para aparecerem na ordem certa no Excel.
 * Cada grupo tem uma cor identificadora no nome da aba e uma linha no resumo.
 *
 * Limitações: o backup respeita o RLS — só exporta o que o usuário logado
 * pode ler. Para um backup 100% completo, use uma conta admin.
 */

type Group = {
  key: string;
  label: string;
  tables: string[];
};

// Ordem e agrupamento "amigável" — espelha a navegação do sistema.
const GROUPS: Group[] = [
  {
    key: "01_Usuarios",
    label: "Usuários & Permissões",
    tables: ["profiles", "user_roles", "user_permissions", "employees"],
  },
  {
    key: "02_Clientes",
    label: "Clientes",
    tables: [
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
    ],
  },
  {
    key: "03_Produtos",
    label: "Catálogo de Produtos",
    tables: ["products", "product_steps", "product_required_documents"],
  },
  {
    key: "04_Demandas",
    label: "Demandas (Produtos do Cliente)",
    tables: [
      "client_products",
      "client_product_steps",
      "client_product_providers",
      "client_product_pauses",
      "client_product_delays",
      "client_product_quality_checks",
      "client_product_status_reports",
      "demand_comments",
      "demand_deliveries",
    ],
  },
  {
    key: "05_Vendas",
    label: "Vendas & Financeiro",
    tables: [
      "sales",
      "payments",
      "commissions",
      "commission_splits",
      "commission_rules",
      "expenses",
      "financial_alerts",
    ],
  },
  {
    key: "06_Parceiros",
    label: "Parceiros",
    tables: ["partners", "partner_products", "partner_contracts", "partner_materials", "referrers"],
  },
  {
    key: "07_Prestadores",
    label: "Prestadores de Serviço",
    tables: [
      "service_providers",
      "service_provider_products",
      "provider_interactions",
      "provider_schedule",
      "service_assignments",
      "collaborator_products",
    ],
  },
  {
    key: "08_Leads",
    label: "Leads & Propostas",
    tables: ["leads", "lead_history", "proposals", "proposal_items"],
  },
  {
    key: "09_Tarefas",
    label: "Tarefas",
    tables: ["tasks", "task_checklist_items", "task_comments", "daily_actions"],
  },
  {
    key: "10_Documentos",
    label: "Documentos & Contratos",
    tables: [
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
    ],
  },
  {
    key: "11_Projetos",
    label: "Projetos & Notas",
    tables: ["projects", "notes"],
  },
  {
    key: "12_Comunicacao",
    label: "Comunicação & Notificações",
    tables: ["notifications", "message_templates", "chat_messages", "nps_responses"],
  },
  {
    key: "13_Sistema",
    label: "Sistema, Automação & Auditoria",
    tables: [
      "activities",
      "activity_logs",
      "audit_logs",
      "automation_rules",
      "automation_logs",
      "system_settings",
    ],
  },
];

const PAGE = 1000;
const HARD_CAP = 200_000;

async function fetchAll(table: string): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  while (from < HARD_CAP) {
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as any[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function flatten(rows: any[]) {
  return rows.map((r) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(r)) {
      const v = (r as any)[k];
      if (v === null || v === undefined) out[k] = "";
      else if (v instanceof Date) out[k] = v.toISOString();
      else if (typeof v === "object") out[k] = JSON.stringify(v);
      else out[k] = v;
    }
    return out;
  });
}

function buildSheet(rows: any[]) {
  if (!rows || rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["(sem registros ou sem permissão de leitura)"]]);
    ws["!cols"] = [{ wch: 50 }];
    return ws;
  }
  const flat = flatten(rows);
  const ws = XLSX.utils.json_to_sheet(flat);

  // Largura automática (cap em 60) baseada no maior valor da coluna.
  const headers = Object.keys(flat[0]);
  ws["!cols"] = headers.map((h) => {
    let max = h.length;
    for (const row of flat) {
      const v = row[h];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
      if (max > 60) break;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 60) };
  });
  // Congela cabeçalho
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  (ws as any)["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

function sheetName(name: string) {
  // Excel: máx 31 chars, sem : \ / ? * [ ]
  return name.replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
}

export async function exportFullBackup(): Promise<void> {
  const tId = toast.loading("Preparando backup completo...");
  const wb = XLSX.utils.book_new();

  const summary: {
    grupo: string;
    tabela: string;
    aba: string;
    registros: number | string;
    status: string;
  }[] = [];

  const totalTables = GROUPS.reduce((s, g) => s + g.tables.length, 0);
  let done = 0;

  for (const group of GROUPS) {
    for (const table of group.tables) {
      done++;
      toast.loading(`Exportando ${table} (${done}/${totalTables})...`, { id: tId });
      const abaNome = sheetName(`${group.key.slice(0, 2)}_${table}`);
      try {
        const rows = await fetchAll(table);
        XLSX.utils.book_append_sheet(wb, buildSheet(rows), abaNome);
        summary.push({
          grupo: group.label,
          tabela: table,
          aba: abaNome,
          registros: rows.length,
          status: rows.length > 0 ? "ok" : "vazia",
        });
      } catch (e: any) {
        summary.push({
          grupo: group.label,
          tabela: table,
          aba: abaNome,
          registros: "—",
          status: `erro: ${e?.message || e}`,
        });
      }
    }
  }

  // Resumo geral
  const totalRegistros = summary.reduce(
    (s, r) => s + (typeof r.registros === "number" ? r.registros : 0),
    0
  );
  const erros = summary.filter((s) => s.status.startsWith("erro")).length;
  const vazias = summary.filter((s) => s.status === "vazia").length;

  const header = [
    ["BACKUP COMPLETO DA PLATAFORMA"],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    ["Total de tabelas", totalTables],
    ["Total de registros", totalRegistros],
    ["Tabelas vazias", vazias],
    ["Tabelas com erro/sem permissão", erros],
    [],
    ["Grupo", "Tabela", "Aba", "Registros", "Status"],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(header);
  XLSX.utils.sheet_add_json(summarySheet, summary, {
    origin: "A9",
    skipHeader: true,
    header: ["grupo", "tabela", "aba", "registros", "status"],
  });
  summarySheet["!cols"] = [
    { wch: 32 },
    { wch: 30 },
    { wch: 34 },
    { wch: 12 },
    { wch: 40 },
  ];
  summarySheet["!freeze"] = { xSplit: 0, ySplit: 8 };

  XLSX.utils.book_append_sheet(wb, summarySheet, "00_Resumo");
  // Reordena para deixar o resumo primeiro.
  wb.SheetNames = ["00_Resumo", ...wb.SheetNames.filter((n) => n !== "00_Resumo")];

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `backup-plataforma-${stamp}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });

  toast.success(
    erros > 0
      ? `Backup gerado com ${erros} aviso(s). Veja a aba 00_Resumo.`
      : `Backup completo gerado: ${totalRegistros} registros em ${totalTables} tabelas.`,
    { id: tId }
  );
}
