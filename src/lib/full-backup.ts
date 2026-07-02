import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { toast } from "sonner";

/**
 * BACKUP COMPLETO E DETALHADO DA PLATAFORMA
 *
 * Diferente de um dump cru de tabelas, este backup produz PLANILHAS LEGÍVEIS
 * já categorizadas e com dados relacionados JÁ RESOLVIDOS (nome do cliente,
 * nome do parceiro, nome do produto, etc), com valores atuais e status.
 *
 * Respeita o RLS — para um backup 100% completo use uma conta admin.
 */

// ---------- utilitários ----------
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

async function safeAll(table: string): Promise<any[]> {
  try { return await fetchAll(table); } catch { return []; }
}

function mapBy<T extends Record<string, any>>(rows: T[], key = "id") {
  const m = new Map<string, T>();
  for (const r of rows) if (r?.[key]) m.set(String(r[key]), r);
  return m;
}

function money(v: any) {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function fmtDate(v: any) {
  if (!v) return "";
  try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return String(v); }
}
function fmtDateTime(v: any) {
  if (!v) return "";
  try { return new Date(v).toLocaleString("pt-BR"); } catch { return String(v); }
}

function sheetName(name: string) {
  return name.replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
}

function buildSheet(rows: any[], emptyMsg = "(sem registros ou sem permissão)") {
  if (!rows || rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[emptyMsg]]);
    ws["!cols"] = [{ wch: 50 }];
    return ws;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  ws["!cols"] = headers.map((h) => {
    let max = h.length;
    for (const row of rows) {
      const v = (row as any)[h];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
      if (max > 60) break;
    }
    return { wch: Math.min(Math.max(max + 2, 12), 60) };
  });
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
  (ws as any)["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

const statusPtCliente: Record<string, string> = {
  active: "Ativo",
  approved: "Aprovado",
  pending: "Pendente",
  inactive: "Inativo",
  churned: "Churn",
  lost: "Perdido",
};
const pt = (v: string | null | undefined, dict: Record<string, string>) =>
  v ? dict[v] ?? v : "";

// ---------- export principal ----------
export async function exportFullBackup(): Promise<void> {
  const tId = toast.loading("Preparando backup detalhado...");
  try {
    toast.loading("Baixando dados da plataforma...", { id: tId });

    // 1) Fetch em paralelo dos núcleos
    const [
      clients, employees, profiles, partners, providers, referrers,
      products, clientProducts, sales, payments, commissions, splits,
      expenses, leads, tasks, subscriptions, journeyStages,
    ] = await Promise.all([
      safeAll("clients"),
      safeAll("employees"),
      safeAll("profiles"),
      safeAll("partners"),
      safeAll("service_providers"),
      safeAll("referrers"),
      safeAll("products"),
      safeAll("client_products"),
      safeAll("sales"),
      safeAll("payments"),
      safeAll("commissions"),
      safeAll("commission_splits"),
      safeAll("expenses"),
      safeAll("leads"),
      safeAll("tasks"),
      safeAll("client_subscriptions"),
      safeAll("client_journey_stages"),
    ]);

    // 2) Lookup maps
    const clientById = mapBy(clients);
    const employeeById = mapBy(employees);
    const employeeByUserId = mapBy(employees, "user_id");
    const profileById = mapBy(profiles);
    const partnerById = mapBy(partners);
    const providerById = mapBy(providers);
    const referrerById = mapBy(referrers);
    const productById = mapBy(products);
    const stageById = mapBy(journeyStages);
    const saleById = mapBy(sales);
    const clientProductById = mapBy(clientProducts);

    const nameOfClient = (id: any) => clientById.get(String(id))?.full_name || "";
    const nameOfPartner = (id: any) => partnerById.get(String(id))?.name || "";
    const nameOfProvider = (id: any) => providerById.get(String(id))?.name || "";
    const nameOfProduct = (id: any) => productById.get(String(id))?.name || "";
    const nameOfReferrer = (id: any) => referrerById.get(String(id))?.name || "";
    const nameOfEmployeeByUser = (uid: any) => employeeByUserId.get(String(uid))?.name
      || profileById.get(String(uid))?.full_name || "";
    const nameOfEmployee = (id: any) => employeeById.get(String(id))?.name || "";

    const nameOfBeneficiary = (type: string | null, id: any) => {
      const t = (type || "").toLowerCase();
      if (!id) return "";
      if (t === "partner") return nameOfPartner(id);
      if (t === "provider" || t === "service_provider") return nameOfProvider(id);
      if (t === "referrer") return nameOfReferrer(id);
      if (t === "employee" || t === "collaborator") return nameOfEmployee(id) || nameOfEmployeeByUser(id);
      // fallback: tenta todos
      return nameOfPartner(id) || nameOfProvider(id) || nameOfEmployee(id) || nameOfReferrer(id) || nameOfEmployeeByUser(id);
    };

    const wb = XLSX.utils.book_new();

    // ---------- 01 Clientes aprovados / ativos ----------
    toast.loading("Montando clientes...", { id: tId });
    const clientesRow = (c: any) => ({
      "Nome": c.full_name || "",
      "Empresa": c.company || "",
      "Documento": c.document || "",
      "E-mail": c.email || "",
      "Telefone": c.phone || c.whatsapp || "",
      "Status": pt(c.status, statusPtCliente),
      "Etapa (Jornada)": stageById.get(String(c.journey_stage_id))?.name || "",
      "Parceiro": nameOfPartner(c.partner_id),
      "Indicador": nameOfReferrer(c.referrer_id || c.indicator_id),
      "Colaborador Resp.": nameOfEmployee(c.collaborator_id) || nameOfEmployeeByUser(c.responsible_id),
      "Prestador": nameOfProvider(c.service_provider_id || c.provider_id),
      "Valor Contrato (R$)": money(c.contract_value),
      "Valor Comissão (R$)": money(c.commission_value),
      "Status Pagamento": c.payment_status || "",
      "Cidade": c.city || c.address_city || "",
      "UF": c.state || c.address_state || "",
      "Origem": c.origin || c.source || "",
      "Health Score": c.health_score ?? "",
      "Risco de Churn": c.churn_risk ?? "",
      "Data Cadastro": fmtDateTime(c.created_at),
      "Data Entrada": fmtDate(c.entry_date),
      "Data Conclusão": fmtDate(c.completion_date),
    });

    const clientesAprovados = clients
      .filter((c) => ["active", "approved"].includes(String(c.status || "").toLowerCase()))
      .map(clientesRow);
    const clientesTodos = clients.map(clientesRow);

    XLSX.utils.book_append_sheet(wb, buildSheet(clientesAprovados, "(nenhum cliente ativo/aprovado)"), sheetName("01_Clientes_Ativos"));
    XLSX.utils.book_append_sheet(wb, buildSheet(clientesTodos), sheetName("02_Clientes_Todos"));

    // ---------- 03 Colaboradores ----------
    toast.loading("Montando colaboradores...", { id: tId });
    // total de comissões por colaborador (via splits + commissions.collaborator_id)
    const commByCollab: Record<string, { pend: number; pago: number; qtd: number }> = {};
    const addComm = (key: string, amount: number, status: string) => {
      const k = String(key);
      if (!commByCollab[k]) commByCollab[k] = { pend: 0, pago: 0, qtd: 0 };
      commByCollab[k].qtd += 1;
      if (String(status).toLowerCase() === "paid") commByCollab[k].pago += amount;
      else commByCollab[k].pend += amount;
    };
    for (const s of splits) {
      if (["employee", "collaborator"].includes(String(s.beneficiary_type).toLowerCase()) && s.beneficiary_id) {
        addComm(s.beneficiary_id, money(s.amount), s.status || "");
      }
    }
    for (const c of commissions) {
      if (c.collaborator_id) addComm(c.collaborator_id, money(c.amount || c.rule_value), c.workflow_status || c.status || "");
    }

    const colaboradores = employees.map((e: any) => {
      const stats = commByCollab[String(e.id)] || { pend: 0, pago: 0, qtd: 0 };
      const demandas = clientProducts.filter((cp) => cp.responsible_employee_id === e.user_id).length;
      return {
        "Nome": e.name || "",
        "E-mail": e.email || "",
        "Telefone": e.phone || "",
        "Função": e.function || e.role || "",
        "Status": e.status || "",
        "Acesso ao Sistema": e.has_system_access ? "Sim" : "Não",
        "Demandas Ativas": demandas,
        "Comissões (qtd)": stats.qtd,
        "Comissões Pendentes (R$)": money(stats.pend),
        "Comissões Pagas (R$)": money(stats.pago),
        "Cadastrado em": fmtDateTime(e.created_at),
      };
    });
    XLSX.utils.book_append_sheet(wb, buildSheet(colaboradores), sheetName("03_Colaboradores"));

    // ---------- 04 Parceiros ----------
    toast.loading("Montando parceiros...", { id: tId });
    const commByPartner: Record<string, { pend: number; pago: number; qtd: number }> = {};
    for (const s of splits) {
      if (String(s.beneficiary_type).toLowerCase() === "partner" && s.beneficiary_id) {
        const k = String(s.beneficiary_id);
        if (!commByPartner[k]) commByPartner[k] = { pend: 0, pago: 0, qtd: 0 };
        commByPartner[k].qtd += 1;
        if (String(s.status).toLowerCase() === "paid") commByPartner[k].pago += money(s.amount);
        else commByPartner[k].pend += money(s.amount);
      }
    }
    for (const c of commissions) {
      if (c.partner_id) {
        const k = String(c.partner_id);
        if (!commByPartner[k]) commByPartner[k] = { pend: 0, pago: 0, qtd: 0 };
        commByPartner[k].qtd += 1;
        const amt = money(c.amount || c.rule_value);
        if (String(c.workflow_status || c.status).toLowerCase() === "paid") commByPartner[k].pago += amt;
        else commByPartner[k].pend += amt;
      }
    }
    const parceiros = partners.map((p: any) => {
      const stats = commByPartner[String(p.id)] || { pend: 0, pago: 0, qtd: 0 };
      const clientesDoParceiro = clients.filter((c) => c.partner_id === p.id).length;
      return {
        "Nome": p.name || "",
        "E-mail": p.email || "",
        "Telefone": p.phone || "",
        "Documento": p.document || p.cnpj || "",
        "Status": p.status || "",
        "Clientes Indicados": clientesDoParceiro,
        "Comissões (qtd)": stats.qtd,
        "Comissões Pendentes (R$)": money(stats.pend),
        "Comissões Pagas (R$)": money(stats.pago),
        "Cadastrado em": fmtDateTime(p.created_at),
      };
    });
    XLSX.utils.book_append_sheet(wb, buildSheet(parceiros), sheetName("04_Parceiros"));

    // ---------- 05 Prestadores ----------
    toast.loading("Montando prestadores...", { id: tId });
    const commByProv: Record<string, { pend: number; pago: number; qtd: number }> = {};
    for (const s of splits) {
      const t = String(s.beneficiary_type).toLowerCase();
      if ((t === "provider" || t === "service_provider") && s.beneficiary_id) {
        const k = String(s.beneficiary_id);
        if (!commByProv[k]) commByProv[k] = { pend: 0, pago: 0, qtd: 0 };
        commByProv[k].qtd += 1;
        if (String(s.status).toLowerCase() === "paid") commByProv[k].pago += money(s.amount);
        else commByProv[k].pend += money(s.amount);
      }
    }
    for (const c of commissions) {
      if (c.service_provider_id) {
        const k = String(c.service_provider_id);
        if (!commByProv[k]) commByProv[k] = { pend: 0, pago: 0, qtd: 0 };
        commByProv[k].qtd += 1;
        const amt = money(c.amount || c.rule_value);
        if (String(c.workflow_status || c.status).toLowerCase() === "paid") commByProv[k].pago += amt;
        else commByProv[k].pend += amt;
      }
    }
    const prestadores = providers.map((p: any) => {
      const stats = commByProv[String(p.id)] || { pend: 0, pago: 0, qtd: 0 };
      const demandas = clientProducts.filter((cp) => cp.service_provider_id === p.id || cp.responsible_provider_id === p.id).length;
      return {
        "Nome": p.name || "",
        "E-mail": p.email || "",
        "Telefone": p.phone || "",
        "Especialidade": p.specialty || p.category || "",
        "Status": p.status || "",
        "Demandas Ativas": demandas,
        "Comissões (qtd)": stats.qtd,
        "Comissões Pendentes (R$)": money(stats.pend),
        "Comissões Pagas (R$)": money(stats.pago),
        "Cadastrado em": fmtDateTime(p.created_at),
      };
    });
    XLSX.utils.book_append_sheet(wb, buildSheet(prestadores), sheetName("05_Prestadores"));

    // ---------- 06 Serviços/Demandas ativas ----------
    toast.loading("Montando serviços ativos...", { id: tId });
    const servicos = clientProducts.map((cp: any) => ({
      "Cliente": nameOfClient(cp.client_id),
      "Produto/Serviço": cp.custom_product_name || nameOfProduct(cp.product_id),
      "Status": cp.status || "",
      "Prioridade": cp.priority || "",
      "Valor (R$)": money(cp.custom_value ?? cp.value),
      "Desconto (R$)": money(cp.discount),
      "Comissão Parceiro (R$)": money(cp.partner_commission),
      "Comissão Colaborador (R$)": money(cp.employee_commission),
      "Responsável (Colaborador)": nameOfEmployeeByUser(cp.responsible_employee_id),
      "Prestador": nameOfProvider(cp.service_provider_id || cp.responsible_provider_id),
      "Início": fmtDate(cp.start_date),
      "Fim": fmtDate(cp.end_date),
      "Prazo": fmtDate(cp.deadline),
      "SLA": cp.sla_status || "",
      "SLA Vence em": fmtDate(cp.sla_due_date),
      "Criado em": fmtDateTime(cp.created_at),
      "Atualizado em": fmtDateTime(cp.updated_at),
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(servicos), sheetName("06_Servicos_Demandas"));

    // ---------- 07 Vendas ----------
    toast.loading("Montando vendas...", { id: tId });
    const vendas = sales.map((s: any) => ({
      "Data": fmtDate(s.sale_date || s.created_at),
      "Cliente": nameOfClient(s.client_id),
      "Produto": nameOfProduct(s.product_id),
      "Valor (R$)": money(s.sale_value || s.value || s.amount),
      "Forma de Pagamento": s.payment_method || "",
      "Parceiro": nameOfPartner(s.partner_id),
      "Colaborador": nameOfEmployee(s.employee_id) || nameOfEmployeeByUser(s.created_by),
      "Status": s.status || "",
      "Observações": s.notes || "",
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(vendas), sheetName("07_Vendas"));

    // ---------- 08 Comissões (unificado) ----------
    toast.loading("Montando comissões...", { id: tId });
    const linhasSplits = splits.map((s: any) => {
      const sale = saleById.get(String(s.sale_id));
      return {
        "Origem": "Split",
        "Tipo Beneficiário": s.beneficiary_type || "",
        "Beneficiário": nameOfBeneficiary(s.beneficiary_type, s.beneficiary_id),
        "Cliente": nameOfClient(sale?.client_id),
        "Produto": nameOfProduct(sale?.product_id),
        "Valor Venda (R$)": money(sale?.sale_value || sale?.value),
        "%": s.percent ?? "",
        "Valor Comissão (R$)": money(s.amount),
        "Status": s.status || "",
        "Pago em": fmtDate(s.paid_at),
        "Forma Pagamento": s.payment_method || "",
        "Criado em": fmtDateTime(s.created_at),
      };
    });
    const linhasCommissions = commissions.map((c: any) => {
      const sale = saleById.get(String(c.sale_id));
      const cp = clientProductById.get(String(c.client_product_id));
      const cliente = nameOfClient(c.client_id || sale?.client_id || cp?.client_id);
      const beneficiario =
        (c.partner_id && nameOfPartner(c.partner_id)) ||
        (c.service_provider_id && nameOfProvider(c.service_provider_id)) ||
        (c.collaborator_id && (nameOfEmployee(c.collaborator_id) || nameOfEmployeeByUser(c.collaborator_id))) ||
        (c.referrer_id && nameOfReferrer(c.referrer_id)) || "";
      const tipo = c.partner_id ? "Parceiro"
        : c.service_provider_id ? "Prestador"
        : c.collaborator_id ? "Colaborador"
        : c.referrer_id ? "Indicador" : (c.commission_type || "");
      return {
        "Origem": "Comissão",
        "Tipo Beneficiário": tipo,
        "Beneficiário": beneficiario,
        "Cliente": cliente,
        "Produto": nameOfProduct(c.product_id || sale?.product_id || cp?.product_id),
        "Valor Venda (R$)": money(c.sale_value || sale?.sale_value),
        "%": c.percent ?? c.rule_value ?? "",
        "Valor Comissão (R$)": money(c.amount ?? c.rule_value),
        "Status": c.workflow_status || c.status || "",
        "Pago em": fmtDate(c.paid_at || c.payment_date),
        "Forma Pagamento": c.payment_method || "",
        "Criado em": fmtDateTime(c.created_at),
      };
    });
    const todasComissoes = [...linhasCommissions, ...linhasSplits];
    XLSX.utils.book_append_sheet(wb, buildSheet(todasComissoes), sheetName("08_Comissoes"));

    // ---------- 09 Pagamentos ----------
    toast.loading("Montando pagamentos...", { id: tId });
    const pagamentos = payments.map((p: any) => ({
      "Data": fmtDate(p.payment_date || p.paid_at || p.created_at),
      "Cliente": nameOfClient(p.client_id),
      "Valor (R$)": money(p.amount || p.value),
      "Forma": p.payment_method || p.method || "",
      "Status": p.status || "",
      "Referência": p.reference || p.description || "",
      "Observações": p.notes || "",
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(pagamentos), sheetName("09_Pagamentos"));

    // ---------- 10 Despesas ----------
    toast.loading("Montando despesas...", { id: tId });
    const despesas = expenses.map((e: any) => ({
      "Data": fmtDate(e.expense_date || e.due_date),
      "Descrição": e.description || "",
      "Categoria": e.category || "",
      "Subcategoria": e.subcategory || "",
      "Fornecedor": e.vendor || "",
      "Valor (R$)": money(e.amount),
      "Pago": e.paid ? "Sim" : "Não",
      "Pago em": fmtDate(e.paid_at),
      "Forma Pagamento": e.payment_method || "",
      "Mês Referência": e.reference_month || "",
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(despesas), sheetName("10_Despesas"));

    // ---------- 11 Catálogo de Produtos ----------
    toast.loading("Montando catálogo...", { id: tId });
    const catalogo = products.map((p: any) => ({
      "Produto": p.name || "",
      "Categoria": p.category || "",
      "Descrição": p.description || "",
      "Valor Base (R$)": money(p.price || p.base_price || p.value),
      "Comissão Parceiro (%)": p.partner_commission_percent ?? "",
      "Comissão Colaborador (%)": p.employee_commission_percent ?? p.collaborator_commission_percent ?? "",
      "Status": p.status || (p.active === false ? "Inativo" : "Ativo"),
      "Criado em": fmtDateTime(p.created_at),
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(catalogo), sheetName("11_Catalogo_Produtos"));

    // ---------- 12 Leads ----------
    toast.loading("Montando leads...", { id: tId });
    const leadsSheet = leads.map((l: any) => ({
      "Nome": l.name || l.full_name || "",
      "E-mail": l.email || "",
      "Telefone": l.phone || l.whatsapp || "",
      "Empresa": l.company || "",
      "Origem": l.source || l.origin || "",
      "Status": l.status || "",
      "Responsável": nameOfEmployeeByUser(l.assigned_to) || nameOfEmployee(l.employee_id),
      "Valor Estimado (R$)": money(l.estimated_value || l.value),
      "Criado em": fmtDateTime(l.created_at),
      "Última Interação": fmtDateTime(l.last_interaction_at || l.updated_at),
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(leadsSheet), sheetName("12_Leads"));

    // ---------- 13 Tarefas ----------
    toast.loading("Montando tarefas...", { id: tId });
    const tarefas = tasks.map((t: any) => ({
      "Título": t.title || "",
      "Descrição": t.description || "",
      "Status": t.status || "",
      "Prioridade": t.priority || "",
      "Responsável": nameOfEmployeeByUser(t.assigned_to) || nameOfEmployee(t.assigned_to),
      "Cliente": nameOfClient(t.client_id),
      "Vence em": fmtDate(t.due_date),
      "Criado em": fmtDateTime(t.created_at),
      "Concluído em": fmtDateTime(t.completed_at),
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(tarefas), sheetName("13_Tarefas"));

    // ---------- 14 Assinaturas ----------
    toast.loading("Montando assinaturas...", { id: tId });
    const assinaturas = subscriptions.map((s: any) => ({
      "Cliente": nameOfClient(s.client_id),
      "Produto": nameOfProduct(s.product_id),
      "Valor Mensal (R$)": money(s.monthly_value || s.amount),
      "Status": s.status || "",
      "Início": fmtDate(s.start_date),
      "Próxima Cobrança": fmtDate(s.next_billing_date),
      "Fim": fmtDate(s.end_date),
      "Forma Pagamento": s.payment_method || "",
    }));
    XLSX.utils.book_append_sheet(wb, buildSheet(assinaturas), sheetName("14_Assinaturas_Recorr"));

    // ---------- DUMP COMPLETO DE TODAS AS TABELAS (raw) ----------
    // Garante que, em caso de perda do site, TUDO que existe no banco
    // esteja preservado no arquivo — inclusive tabelas técnicas.
    const ALL_TABLES = [
      "activities","activity_logs","audit_logs","automation_logs","automation_rules",
      "chat_messages","client_collaborators","client_document_folder_providers",
      "client_document_folders","client_document_requests","client_interactions",
      "client_journey_stages","client_partners","client_product_delays",
      "client_product_pauses","client_product_providers","client_product_quality_checks",
      "client_product_status_reports","client_product_steps","client_products",
      "client_providers","client_referrers","client_stage_history","client_subscriptions",
      "client_support_ticket_messages","client_support_tickets","client_timeline",
      "clients","collaborator_products","commission_audit_log","commission_rules",
      "commission_splits","commissions","companies","company_contacts","contract_folders",
      "contract_history","contract_templates","contracts","daily_actions","demand_comments",
      "demand_deliveries","demand_request_messages","demand_requests","demand_shares",
      "document_history","document_requests","document_versions","documents","employees",
      "expenses","financial_alerts","lead_history","leads","message_templates","notes",
      "notification_preferences","notifications","nps_responses","onboarding_documents",
      "onboarding_history","partner_contracts","partner_materials","partner_products",
      "partner_support_ticket_messages","partner_support_tickets","partners",
      "payment_audit_log","payments","product_document_files","product_document_folders",
      "product_required_documents","product_steps","products","profiles","profit_reserves",
      "projects","proposal_items","proposals","provider_interactions","provider_schedule",
      "referrers","resource_pool_movements","resource_pools","sales","sales_goals",
      "service_assignments","service_provider_products","service_providers",
      "system_settings","task_checklist_items","task_comments","tasks","user_permissions",
      "user_roles",
    ];

    // Reuso do cache pra não refazer fetch das tabelas já baixadas
    const preFetched: Record<string, any[]> = {
      clients, employees, profiles, partners, service_providers: providers, referrers,
      products, client_products: clientProducts, sales, payments, commissions,
      commission_splits: splits, expenses, leads, tasks, client_subscriptions: subscriptions,
      client_journey_stages: journeyStages,
    };

    const flatten = (rows: any[]) => rows.map((r) => {
      const out: Record<string, any> = {};
      for (const k of Object.keys(r || {})) {
        const v = (r as any)[k];
        if (v === null || v === undefined) out[k] = "";
        else if (typeof v === "object") out[k] = JSON.stringify(v);
        else out[k] = v;
      }
      return out;
    });

    const rawSummary: { tabela: string; registros: number | string; status: string }[] = [];
    let idx = 0;
    for (const table of ALL_TABLES) {
      idx++;
      toast.loading(`Backup completo: ${table} (${idx}/${ALL_TABLES.length})...`, { id: tId });
      try {
        const rows = preFetched[table] ?? (await fetchAll(table));
        const ws = buildSheet(flatten(rows), "(vazia)");
        XLSX.utils.book_append_sheet(wb, ws, sheetName(`RAW_${table}`));
        rawSummary.push({ tabela: table, registros: rows.length, status: rows.length ? "ok" : "vazia" });
      } catch (e: any) {
        rawSummary.push({ tabela: table, registros: "—", status: `erro: ${e?.message || e}` });
      }
    }

    // ---------- 00 RESUMO EXECUTIVO ----------
    toast.loading("Gerando resumo...", { id: tId });
    const totalVendas = vendas.reduce((s, v) => s + (v["Valor (R$)"] as number), 0);
    const totalPagamentos = pagamentos.reduce((s, v) => s + (v["Valor (R$)"] as number), 0);
    const totalDespesas = despesas.reduce((s, v) => s + (v["Valor (R$)"] as number), 0);
    const totalComissoesPend = todasComissoes
      .filter((r) => !["paid", "pago"].includes(String(r["Status"]).toLowerCase()))
      .reduce((s, v) => s + (v["Valor Comissão (R$)"] as number), 0);
    const totalComissoesPagas = todasComissoes
      .filter((r) => ["paid", "pago"].includes(String(r["Status"]).toLowerCase()))
      .reduce((s, v) => s + (v["Valor Comissão (R$)"] as number), 0);

    const resumo = [
      ["BACKUP DETALHADO DA PLATAFORMA"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      [],
      ["═══ VOLUMES ═══"],
      ["Clientes (total)", clients.length],
      ["  → Ativos/Aprovados", clientesAprovados.length],
      ["Colaboradores", employees.length],
      ["Parceiros", partners.length],
      ["Prestadores", providers.length],
      ["Leads", leads.length],
      ["Produtos no catálogo", products.length],
      ["Serviços/Demandas", clientProducts.length],
      ["Vendas", sales.length],
      ["Pagamentos", payments.length],
      ["Comissões (linhas)", todasComissoes.length],
      ["Despesas", expenses.length],
      ["Tarefas", tasks.length],
      ["Assinaturas", subscriptions.length],
      [],
      ["═══ FINANCEIRO (R$) ═══"],
      ["Total em vendas", totalVendas],
      ["Total recebido (pagamentos)", totalPagamentos],
      ["Total em despesas", totalDespesas],
      ["Comissões pagas", totalComissoesPagas],
      ["Comissões pendentes", totalComissoesPend],
      ["Resultado (Pagamentos − Despesas − Comissões pagas)", money(totalPagamentos - totalDespesas - totalComissoesPagas)],
      [],
      ["═══ ÍNDICE DE ABAS ═══"],
      ["01_Clientes_Ativos", "Somente clientes com status Ativo/Aprovado"],
      ["02_Clientes_Todos", "Todos os clientes cadastrados"],
      ["03_Colaboradores", "Equipe interna + comissões acumuladas"],
      ["04_Parceiros", "Parceiros + clientes indicados + comissões"],
      ["05_Prestadores", "Prestadores + demandas + comissões"],
      ["06_Servicos_Demandas", "Serviços em execução por cliente"],
      ["07_Vendas", "Vendas registradas"],
      ["08_Comissoes", "Comissões (rules + splits) unificadas"],
      ["09_Pagamentos", "Pagamentos recebidos"],
      ["10_Despesas", "Despesas operacionais"],
      ["11_Catalogo_Produtos", "Catálogo de produtos/serviços"],
      ["12_Leads", "Leads no funil"],
      ["13_Tarefas", "Tarefas da equipe"],
      ["14_Assinaturas_Recorr", "Assinaturas / receita recorrente"],
    ];
    const resumoWs = XLSX.utils.aoa_to_sheet(resumo);
    resumoWs["!cols"] = [{ wch: 45 }, { wch: 45 }];
    (resumoWs as any)["!freeze"] = { xSplit: 0, ySplit: 3 };
    XLSX.utils.book_append_sheet(wb, resumoWs, "00_Resumo");
    wb.SheetNames = ["00_Resumo", ...wb.SheetNames.filter((n) => n !== "00_Resumo")];

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `backup-plataforma-${stamp}.xlsx`, { bookType: "xlsx" });

    toast.success(
      `Backup gerado: ${clients.length} clientes, ${sales.length} vendas, ${todasComissoes.length} linhas de comissão.`,
      { id: tId }
    );
  } catch (e: any) {
    toast.error(`Falha no backup: ${e?.message || e}`, { id: tId });
    throw e;
  }
}
