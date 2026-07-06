import { formatBR as format, nowBR, formatBRDate, formatBRDateTime, formatBRTime } from "@/lib/datetime";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CircleDollarSign, Users, Clock, FileSignature, Target, Plus, ArrowUpRight,
  FileText, ChevronRight, UserPlus,
  Receipt, Wallet, ClipboardList, CheckCircle2,
  TrendingUp, TrendingDown, Activity, Zap, Sparkles,
  CalendarCheck, AlertCircle, MessageSquare, AlertTriangle
} from "lucide-react";

// Format Date as YYYY-MM-DD using LOCAL components — avoids timezone shift
// from toISOString() (which converts to UTC and breaks day labels in BRT).
const toLocalISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
import { formatBRL } from "@/lib/format";
import { useMemo, useState, useEffect, useDeferredValue, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { paymentSaleIsFinalized, saleIsFinalized } from "@/lib/financial";
import { RevenueByStage } from "@/components/finance/RevenueByStage";
import { StageFilterBar } from "@/components/filters/StageFilterBar";
import { useStageMatcher } from "@/hooks/useSharedStageFilter";
;
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const parseLocalDate = (value?: string | null) => {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  const [hour = 0, minute = 0] = (timePart?.slice(0, 5).split(":").map(Number) ?? []);
  return new Date(year, month - 1, day, hour, minute);
};

const dateOnly = (value?: string | null) => value?.slice(0, 10) ?? "";

const BRASILIA_TZ = "America/Sao_Paulo";
const brasiliaTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: BRASILIA_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const formatBrasiliaTime = (value: string) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return brasiliaTimeFmt.format(d);
};

export default function DashboardAdmin() {
  const { user } = useAuth();
  const [rangeKeyImmediate, setRangeKey] = useState<"HOJE" | "7D" | "30D" | "MÊS">("HOJE");
  // Debounce: queries só refazem após o React assentar — evita refetch em
  // cliques rápidos consecutivos entre os botões de range.
  const rangeKey = useDeferredValue(rangeKeyImmediate);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const brasiliaToday = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
    return new Date(y, m - 1, d);
  }, []);

  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = parseInt(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()), 10);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

  const STALE = 60_000; // 1 min — evita refetch agressivo ao trocar de aba/foco

  // Filtro compartilhado por Estágio da Jornada. Quando ativo, precisamos calcular
  // as métricas no cliente (o RPC agregado não conhece o filtro), então habilitamos
  // as queries locais e trocamos a fonte para `computedStats`.
  const { matchesClientId, isActive: stageActive, stageIds: sharedStageIds } = useStageMatcher();

  const { data: dashboardStats, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ["admin-dashboard-snapshot", rangeKey],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_snapshot", { p_range_key: rangeKey });
      if (error) throw error;
      const raw = data ?? {};
      return {
        ...raw,
        chartData: raw.chartData ?? [],
        demandsByStatus: (raw.demandsByStatus ?? []).filter(Boolean),
        leadsByStage: raw.leadsByStage ?? [],
        recentSales: raw.recentSales ?? [],
        topClients: raw.topClients ?? [],
        todayTasksList: raw.todayTasksList ?? [],
        todayDemandsList: raw.todayDemandsList ?? [],
        todayDocsList: raw.todayDocsList ?? [],
        todayContractsList: raw.todayContractsList ?? [],
        todayAgendaList: raw.todayAgendaList ?? [],
        activityLogs: raw.activityLogs ?? [],
      };
    },
  });

  const { data: _rawClients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ["dash-clients"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("clients").select("id, full_name, status, created_at").order("created_at", { ascending: false }).limit(300)).data ?? []
  });
  const { data: _rawClientProducts = [], isLoading: isLoadingDemands } = useQuery({
    queryKey: ["dash-demands"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("client_products").select("id, status, client_id, custom_product_name, deadline, sla_due_date, end_date, created_at").order("created_at", { ascending: false }).limit(300)).data ?? []
  });
  const { data: _rawSales = [], isLoading: isLoadingSales } = useQuery({
    queryKey: ["dash-sales", rangeKey],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => {
      let query = supabase.from("sales").select("id, sale_date, amount, client_id, status, zenon_cost, provider_cost").eq("status", "concluida").order("sale_date", { ascending: false }).limit(300);

      let rangeStart = new Date(brasiliaToday);
      const rangeEnd = new Date(brasiliaToday);

      if (rangeKey === "7D") rangeStart.setDate(brasiliaToday.getDate() - 6);
      else if (rangeKey === "30D") rangeStart.setDate(brasiliaToday.getDate() - 29);
      else if (rangeKey === "MÊS") rangeStart = new Date(brasiliaToday.getFullYear(), brasiliaToday.getMonth(), 1);

      const fetchStart = new Date(rangeStart);
      const periodDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1);
      fetchStart.setDate(fetchStart.getDate() - periodDays);

      const { data, error } = await query.gte("sale_date", toLocalISO(fetchStart)).lte("sale_date", toLocalISO(rangeEnd));
      if (error) throw error;
      return data ?? [];
    }
  });
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ["dash-leads"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("leads").select("id, status, estimated_value, created_at").order("created_at", { ascending: false }).limit(300)).data ?? []
  });
  const { data: commissions = [], isLoading: isLoadingCommissions } = useQuery({
    queryKey: ["dash-commissions"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => {
      const [splits, comms] = await Promise.all([
        supabase.from("commission_splits").select("id, sale_id, beneficiary_type, beneficiary_id, percent, amount, status, paid_at, created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("commissions").select("id, sale_id, partner_id, collaborator_id, referrer_id, amount, percent, status, workflow_status, paid_at, created_at").order("created_at", { ascending: false }).limit(300),
      ]);
      const splitsData = (splits.data ?? []).map((s: any) => ({
        id: s.id, sale_id: s.sale_id,
        partner_id: s.beneficiary_type === "partner" ? s.beneficiary_id : null,
        collaborator_id: s.beneficiary_type === "collaborator" ? s.beneficiary_id : null,
        referrer_id: s.beneficiary_type === "referrer" ? s.beneficiary_id : null,
        provider_id: s.beneficiary_type === "service_provider" ? s.beneficiary_id : null,
        amount: s.amount, percent: s.percent, status: s.status, workflow_status: s.status, paid_at: s.paid_at, created_at: s.created_at,
      }));
      const splitKeys = new Set(splitsData.map((s: any) => `${s.sale_id}|${s.partner_id || s.collaborator_id || s.referrer_id || s.provider_id || ""}`));
      const manualRows = (comms.data ?? []).filter((c: any) =>
        !splitKeys.has(`${c.sale_id}|${c.partner_id || c.collaborator_id || c.referrer_id || c.service_provider_id || ""}`)
      );
      return [...splitsData, ...manualRows];
    }
  });
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["dash-tasks"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("tasks").select("id, title, status, status_new, due_date, created_at").order("created_at", { ascending: false }).limit(300)).data ?? []
  });
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery({
    queryKey: ["dash-contracts"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("contracts").select("id, status, name, created_at").order("created_at", { ascending: false }).limit(300)).data ?? []
  });
  const { data: _rawDocRequests = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ["dash-doc-requests"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("documents").select("id, status, created_at, name, client_id, due_date").order("created_at", { ascending: false }).limit(300)).data ?? []
  });

  const { data: _rawAgendaInteractions = [], isLoading: isLoadingAgenda } = useQuery({
    queryKey: ["dash-agenda-today"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => {
      const today = toLocalISO(brasiliaToday);
      const { data } = await supabase.from("client_interactions").select("id, client_id, next_action_at, next_action_note, status").eq("next_action_at", today).eq("status", "pendente");
      return data ?? [];
    }
  });

  const { data: _rawPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ["dash-payments"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => {
      const data = (await supabase.from("payments").select("id, sale_id, client_id, status, amount, amount_paid, due_date, paid_at, sales(id, status)").in("status", ["pendente", "em_aberto", "parcialmente_pago", "atrasado", "vencido", "pago"]).limit(500)).data ?? [];
      return (data as any[]).filter(paymentSaleIsFinalized);
    }
  });

  const { data: activityLogs = [], isLoading: isLoadingActivity } = useQuery({
    queryKey: ["dash-activity"],
    staleTime: STALE,
    enabled: stageActive,
    queryFn: async () => (await supabase.from("activity_logs").select("id, action, entity_type, entity_id, created_at, user_id, new_data").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  // Imposto configurável via system_settings (key=tax_rate_percent). Default 0.
  const { data: taxRate = 0 } = useQuery({
    queryKey: ["dash-tax-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "tax_rate_percent").maybeSingle();
      const v: any = data?.value;
      const n = Number(typeof v === "object" ? v?.value : v);
      return Number.isFinite(n) ? n : 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Render progressively: only block on the essentials (clients + demands). Outras seções mostram skeleton individual.
  const isGlobalLoading = isLoadingDashboard;

  


  const computedStats = useMemo(() => {
    const toISO = toLocalISO;
    let rangeStart = new Date(brasiliaToday);
    const rangeEnd = new Date(brasiliaToday);
    if (rangeKey === "7D") rangeStart.setDate(brasiliaToday.getDate() - 6);
    else if (rangeKey === "30D") rangeStart.setDate(brasiliaToday.getDate() - 29);
    else if (rangeKey === "MÊS") rangeStart = new Date(brasiliaToday.getFullYear(), brasiliaToday.getMonth(), 1);
    const startISO = toISO(rangeStart);
    const endISO = toISO(rangeEnd);
    const todayISO = toISO(brasiliaToday);

    // Aplica o filtro compartilhado de Estágio da Jornada (via client_id) a todos
    // os conjuntos que serão agregados adiante — shadow os arrays do escopo externo.
    // Quando o filtro está desativado, matchesClientId() retorna sempre true.
    const clients = _rawClients.filter((c: any) => matchesClientId(c.id));
    const clientProducts = _rawClientProducts.filter((p: any) => matchesClientId(p.client_id));
    const sales = _rawSales.filter((s: any) => matchesClientId(s.client_id));
    const payments = _rawPayments.filter((p: any) => matchesClientId(p.client_id));
    const docRequests = _rawDocRequests.filter((d: any) => matchesClientId(d.client_id));
    const agendaInteractions = _rawAgendaInteractions.filter((i: any) => matchesClientId(i.client_id));

    const filteredSales = sales.filter((s: any) => s.sale_date && s.sale_date >= startISO && s.sale_date <= endISO);
    const rangeRevenue = filteredSales.reduce((a, s: any) => a + Number(s.amount || 0), 0);

    const periodDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1);
    const prevStart = new Date(rangeStart); prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(rangeStart); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevRevenue = sales
      .filter((s: any) => s.sale_date && s.sale_date >= toISO(prevStart) && s.sale_date <= toISO(prevEnd))
      .reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const revenueDelta = prevRevenue > 0 ? ((rangeRevenue - prevRevenue) / prevRevenue) * 100 : (rangeRevenue > 0 ? 100 : 0);
    const avgTicket = filteredSales.length > 0 ? rangeRevenue / filteredSales.length : 0;

    const activeClients = clients.filter((c: any) => c.status === "ativo").length;
    const newClientsRange = clients.filter((c: any) => c.created_at && c.created_at.slice(0,10) >= startISO).length;

    const isDoneDemand = (s: string) => ["concluido", "concluida", "cancelado", "cancelada"].includes(s);
    const demandDueISO = (p: any) => p.deadline || p.sla_due_date || p.end_date;
    const delayedDemands = clientProducts.filter((p: any) => {
      if (isDoneDemand(p.status)) return false;
      if (p.status === "atrasado") return true;
      const due = demandDueISO(p);
      return due && dateOnly(due) < todayISO;
    }).length;
    const activeDemands = clientProducts.filter((p: any) => ["em_andamento", "aguardando_inicio", "em_execucao", "pausado", "ajuste_solicitado"].includes(p.status)).length;
    const completedDemands = clientProducts.filter((p: any) => p.status === "concluido" || p.status === "concluida").length;

    const pipelineTotal = leads.reduce((a, l: any) => a + Number(l.estimated_value || 0), 0);
    const wonLeads = leads.filter((l: any) => l.status === "ganho" || l.status === "convertido").length;
    const lostLeads = leads.filter((l: any) => l.status === "perdido").length;
    const conversionRate = leads.length > 0 ? (wonLeads / leads.length) * 100 : 0;

    const openContracts = contracts.filter((c: any) => ["criado", "enviado", "aguardando_assinatura"].includes(c.status)).length;
    const waitingSignatureContracts = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    const pendingDocs = docRequests.filter((d: any) => ["solicitado", "pendente_correcao", "pendente", "enviado", "em_analise"].includes(d.status)).length;
    const taskStatus = (t: any) => t.status_new || t.status;
    const isTaskOpen = (t: any) => !["concluida", "cancelada", "completed", "done", "cancelled"].includes(taskStatus(t));
    const overdueTasks = tasks.filter((t: any) => isTaskOpen(t) && t.due_date && dateOnly(t.due_date) < todayISO).length;
    const todayTasks = tasks.filter((t: any) => isTaskOpen(t) && t.due_date && dateOnly(t.due_date) === todayISO).length;
    const openTasks = tasks.filter(isTaskOpen).length;

    const in7d = new Date(brasiliaToday); in7d.setDate(brasiliaToday.getDate() + 7);
    const in7ISO = toISO(in7d);
    const receivable7d = payments
      .filter((p: any) => ["pendente", "em_aberto", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date >= todayISO && p.due_date <= in7ISO)
      .reduce((a, p: any) => a + (Number(p.amount || 0) - Number(p.amount_paid || 0)), 0);
    const receivable7dCount = payments.filter((p: any) => ["pendente", "em_aberto", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date >= todayISO && p.due_date <= in7ISO).length;
    const overdueAmount = payments
      .filter((p: any) => ["pendente", "em_aberto", "atrasado", "vencido", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date < todayISO)
      .reduce((a, p: any) => a + (Number(p.amount || 0) - Number(p.amount_paid || 0)), 0);
    const overdueCount = payments.filter((p: any) => ["pendente", "em_aberto", "atrasado", "vencido", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date < todayISO).length;
    const receivedTotal = payments.filter((p: any) => p.status === "pago").reduce((a, p: any) => a + Number(p.amount_paid || 0), 0);

    const paymentReceived = (p: any) => {
      const paidAmount = Number(p.amount_paid || 0);
      if (paidAmount > 0) return paidAmount;
      return ["pago", "parcial", "parcialmente_pago"].includes(String(p.status || "")) ? Number(p.amount || 0) : 0;
    };
    const receivedBySale = new Map<string, number>();
    payments.forEach((p: any) => {
      const received = paymentReceived(p);
      if (received <= 0 || !p.sale_id) return;
      receivedBySale.set(p.sale_id, (receivedBySale.get(p.sale_id) || 0) + received);
    });
    const salesById = new Map(sales.map((s: any) => [s.id, s]));
    // Regra de caixa: só reconhecemos custos/comissões/impostos proporcionalmente ao que efetivamente ENTROU do cliente.
    // Se não temos informação da venda (não carregada na página) devolvemos 0 para NUNCA deduzir 100% de uma comissão sem base.
    const saleRatio = (saleId: string) => {
      const sale: any = salesById.get(saleId);
      if (!sale) return 0;
      const amount = Number(sale?.amount || 0);
      if (!saleIsFinalized(sale) || amount <= 0) return 0;
      return Math.max(0, Math.min(1, (receivedBySale.get(saleId) || 0) / amount));
    };
    const commissionReleased = (c: any) => (c.sale_id ? Number(c.amount || 0) * saleRatio(c.sale_id) : 0);
    const commissionsToPay = commissions
      .filter((c: any) => ["pendente", "gerada", "em_analise", "aprovada", "pending"].includes(c.status))
      .reduce((a, c: any) => a + commissionReleased(c), 0);
    const commissionsCount = commissions.filter((c: any) => ["pendente", "gerada", "em_analise", "aprovada", "pending"].includes(c.status)).length;

    // Receita Bruta = total vendido (contratado) no período
    const grossRevenue = rangeRevenue;
    // Recebido no período (caixa) referente às vendas do período
    const periodSaleIds = new Set(filteredSales.map((s: any) => s.id));
    const periodReceived = payments
      .filter((p: any) => p.sale_id && periodSaleIds.has(p.sale_id))
      .reduce((a: number, p: any) => a + paymentReceived(p), 0);
    // Custos internos (Zenon + Prestador) reconhecidos SÓ na proporção do recebido
    const periodSalesCosts = filteredSales
      .filter((s: any) => s.status !== "cancelada")
      .reduce((a, s: any) => a + (Number(s.zenon_cost || 0) + Number(s.provider_cost || 0)) * saleRatio(s.id), 0);
    // Comissões das vendas do período — também prorateadas pelo recebido
    const periodCommissions = commissions
      .filter((c: any) => c.sale_id && periodSaleIds.has(c.sale_id))
      .reduce((a, c: any) => a + commissionReleased(c), 0);
    // Comissões já pagas (apenas para outras métricas)
    const commissionsPaid = commissions
      .filter((c: any) => ["pago", "paga"].includes(c.status) || ["pago", "paga"].includes(c.workflow_status))
      .reduce((a, c: any) => a + commissionReleased(c), 0);
    // Impostos incidem sobre o que efetivamente entrou em caixa
    const periodTaxes = periodReceived * (Number(taxRate) || 0) / 100;
    // Receita Líquida (caixa) = Recebido no período − custos proporcionais − comissões proporcionais − impostos sobre recebido
    const netRevenue = periodReceived - periodSalesCosts - periodCommissions - periodTaxes;
    // Estimativa de receita = total a receber (todos os pagamentos em aberto, não apenas 7d)
    const estimatedRevenue = payments
      .filter((p: any) => ["pendente", "em_aberto", "atrasado", "vencido", "parcialmente_pago"].includes(p.status))
      .reduce((a, p: any) => a + (Number(p.amount || 0) - Number(p.amount_paid || 0)), 0);
    const estimatedRevenueCount = payments.filter((p: any) => ["pendente", "em_aberto", "atrasado", "vencido", "parcialmente_pago"].includes(p.status)).length;

    // Chart length matches the selected range exactly (HOJE = últimos 7 dias para contexto).
    const len =
      rangeKey === "HOJE" ? 7 :
      rangeKey === "7D" ? 7 :
      rangeKey === "30D" ? 30 :
      /* MÊS */ (brasiliaToday.getDate());
    const chartData = Array.from({ length: len }).map((_, i) => {
      const d = new Date(brasiliaToday); d.setDate(brasiliaToday.getDate() - (len - 1 - i));
      const iso = toISO(d);
      const value = sales.filter((s: any) => s.sale_date === iso).reduce((a, s: any) => a + Number(s.amount || 0), 0);
      return { name: String(d.getDate()).padStart(2, "0"), fullDate: format(d, "dd/MM/yyyy"), value, isToday: iso === todayISO };
    });

    // ============ PRÓXIMAS AÇÕES E PENDÊNCIAS ============
    const todayTasksList = tasks
      .filter((t: any) => isTaskOpen(t) && t.due_date && dateOnly(t.due_date) === todayISO)
      .slice(0, 5)
      .map((t: any) => ({ 
        id: t.id, 
        title: t.title || "Tarefa sem título", 
        time: t.due_date ? formatBrasiliaTime(t.due_date) : null,
        isOverdue: t.due_date ? new Date(t.due_date) < new Date() : false
      }));

    const todayDemandsList = clientProducts
      .filter((p: any) => {
        if (isDoneDemand(p.status)) return false;
        const due = demandDueISO(p);
        return due && dateOnly(due) === todayISO;
      })
      .slice(0, 5)
      .map((p: any) => {
        const client = clients.find((c: any) => c.id === p.client_id);
        const product = clientProducts.find((x: any) => x.id === p.id);
        return { id: p.id, title: client?.full_name || "Cliente", subtitle: product?.custom_product_name || "Serviço" };
      });

    const todayAgendaList = agendaInteractions.map((i: any) => {
      const client = clients.find((c: any) => c.id === i.client_id);
      return { 
        id: i.id, 
        title: client?.full_name || "Cliente", 
        subtitle: i.next_action_note || "Ação agendada",
        isOverdue: i.next_action_at && i.status === "pendente" && new Date(i.next_action_at) < new Date()
      };
    });


    const todayDocsList = docRequests
      .filter((d: any) => ["solicitado", "pendente", "enviado", "em_analise", "pendente_correcao"].includes(d.status))
      .slice(0, 5)
      .map((d: any) => {
        const client = clients.find((c: any) => c.id === d.client_id);
        return { id: d.id, title: d.name || d.request_title || "Documento", subtitle: client?.full_name || "Cliente" };
      });

    const todayContractsList = contracts
      .filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status))
      .slice(0, 5)
      .map((c: any) => ({ id: c.id, title: c.name || "Contrato", subtitle: "Aguardando assinatura" }));

    const todayPendingCount =
      todayTasksList.length + todayDemandsList.length + todayDocsList.length + todayContractsList.length + todayAgendaList.length;


    const demandsByStatus = [
      { name: "Em andamento", value: clientProducts.filter((p: any) => ["em_andamento", "em_execucao", "ajuste_solicitado"].includes(p.status)).length, color: "#4f46e5" },
      { name: "Aguardando", value: clientProducts.filter((p: any) => p.status === "aguardando_inicio").length, color: "#f59e0b" },
      { name: "Concluídas", value: completedDemands, color: "#10b981" },
      { name: "Atrasadas", value: delayedDemands, color: "#f43f5e" },
      { name: "Pausadas", value: clientProducts.filter((p: any) => p.status === "pausado").length, color: "#94a3b8" },
    ].filter(d => d.value > 0);

    const leadsByStage = [
      { name: "Novos", value: leads.filter((l: any) => l.status === "novo" || l.status === "new").length },
      { name: "Qualificados", value: leads.filter((l: any) => l.status === "qualificado").length },
      { name: "Proposta", value: leads.filter((l: any) => l.status === "proposta" || l.status === "negociacao").length },
      { name: "Ganhos", value: wonLeads },
    ];

    const recentSalesEnriched = filteredSales.slice(0, 7).map((s: any) => ({
      ...s,
      client: clients.find((c: any) => c.id === s.client_id)?.full_name || "Cliente",
    }));

    const clientRevenue: Record<string, number> = {};
    sales.forEach((s: any) => { if (s.client_id) clientRevenue[s.client_id] = (clientRevenue[s.client_id] || 0) + Number(s.amount || 0); });
    const topClients = Object.entries(clientRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, total]) => ({
      id, name: clients.find((c: any) => c.id === id)?.full_name || "Cliente", total,
    }));
    const maxTopClient = topClients[0]?.total || 1;

    const totalDemands = clientProducts.length || 1;
    const healthy = clientProducts.filter((p: any) => p.status !== "atrasado").length;
    const healthScore = Math.round((healthy / totalDemands) * 100);

    return {
      rangeRevenue, revenueDelta, prevRevenue, avgTicket,
      activeClients, totalClients: clients.length, newClientsRange,
      delayedDemands, activeDemands, completedDemands,
      pipelineTotal, leadsCount: leads.length, wonLeads, lostLeads, conversionRate,
      openContracts, waitingSignatureContracts, pendingDocs, overdueTasks, todayTasks, openTasks,
      commissionsToPay, commissionsCount,
      receivable7d, receivable7dCount, overdueAmount, overdueCount, receivedTotal,
      grossRevenue, netRevenue, periodReceived, commissionsPaid, periodCommissions, periodTaxes, periodSalesCosts, taxRate: Number(taxRate) || 0, estimatedRevenue, estimatedRevenueCount,
      chartData, demandsByStatus, leadsByStage,
      recentSales: recentSalesEnriched, topClients, maxTopClient, healthScore,
      salesCount: filteredSales.length,
      todayTasksList, todayDemandsList, todayDocsList, todayContractsList, todayPendingCount, todayAgendaList,
    };
  }, [_rawClients, _rawClientProducts, _rawSales, leads, commissions, tasks, contracts, _rawDocRequests, _rawPayments, _rawAgendaInteractions, rangeKey, brasiliaToday, taxRate, matchesClientId]);

  // Quando o filtro de estágio está ativo, as métricas precisam vir do cálculo
  // local (que já respeita `matchesClientId`), pois o RPC agregado do painel
  // desconhece o filtro. Fora disso, mantemos o snapshot do servidor.
  const stats: any = stageActive ? computedStats : (dashboardStats ?? computedStats);

  return (
    <div className="min-h-dvh bg-background text-foreground admin-shell overflow-x-hidden">
      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10 pb-14 space-y-6 sm:space-y-8 animate-in fade-in duration-700">

        {/* ============ HEADER ============ */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">Painel ativo</span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] text-slate-500 capitalize font-semibold truncate max-w-[150px] sm:max-w-none">{todayLabel}</span>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-[32px] sm:text-[36px] lg:text-[44px] font-bold tracking-[-0.025em] text-slate-900 leading-[1.1]">
                {greeting}, <span className="text-indigo-600">{firstName}</span>.
              </h1>
              <p className="text-[13.5px] sm:text-[14px] text-slate-600 leading-relaxed max-w-xl">
                Visão consolidada de receita, operação e pipeline. Tudo o que importa, em um único lugar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 scrollbar-none shrink-0">
            <StageFilterBar />
            <div className="inline-flex items-center bg-white border border-slate-200/80 rounded-xl p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0">
              {(["HOJE", "7D", "30D", "MÊS"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-[11.5px] font-bold transition-all tracking-wide shrink-0",
                    rangeKeyImmediate === k
                      ? "bg-slate-900 text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.3)]"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Link
              to="/vendas?new=1"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-[13px] shadow-[0_2px_4px_rgba(79,70,229,0.25),0_8px_24px_-6px_rgba(79,70,229,0.4)] hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shrink-0"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span className="whitespace-nowrap">Nova venda</span>
            </Link>
          </div>
        </header>

        {/* Banner de atraso — largura total, fora do header, para não competir com o título */}
        {(stats.todayTasksList.filter((t: any) => t.isOverdue).length + (stats.todayAgendaList as any[]).filter(i => i.isOverdue).length) > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-[0_4px_12px_-4px_rgba(244,63,94,0.2)]">
              <div className="size-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-rose-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em]">Atenção imediata</p>
                <p className="text-[14px] sm:text-[15px] font-bold text-rose-950 whitespace-nowrap overflow-hidden text-ellipsis">
                  {stats.todayTasksList.filter((t: any) => t.isOverdue).length + (stats.todayAgendaList as any[]).filter(i => i.isOverdue).length} pendências com horário atrasado
                </p>
              </div>
            </div>
          </div>
        )}


        {/* ============ HERO BAND — Featured Revenue + 3 KPIs ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Featured Revenue Card with sparkline */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(79,70,229,0.18)]">
            {/* subtle gradient wash */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_55%)] pointer-events-none" />
            <div className="relative p-6 lg:p-7 flex flex-col h-full">
              {isGlobalLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12">
                  <div className="size-10 rounded-full border-2 border-indigo-600/20 border-t-indigo-600 animate-spin" />
                  <p className="text-[12px] text-slate-400 font-medium animate-pulse">Carregando dados financeiros...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(79,70,229,0.45)]">
                          <CircleDollarSign className="size-4 text-white stroke-[2.2]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Receita no período</p>
                          <p className="text-[11px] text-slate-400 font-medium">{stats.salesCount} venda(s)</p>
                        </div>
                      </div>
                    </div>
                    <DeltaBadge value={stats.revenueDelta} />
                  </div>

                  <div className="flex items-baseline gap-2 mb-0.5">
                    <p className="font-display text-[36px] lg:text-[42px] font-bold tabular-nums leading-tight tracking-[-0.03em] text-slate-900">
                      {formatBRL(stats.rangeRevenue)}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    vs. <span className="text-slate-700 font-semibold tabular-nums">{formatBRL(stats.prevRevenue)}</span> período anterior
                  </p>

                  {/* sparkline */}
                  <div className="mt-4 h-[120px] -mx-2">
                    {mounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData} margin={{ top: 5, right: 8, left: 8, bottom: 4 }}>
                          <defs>
                            <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="fullDate"
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                            minTickGap={24}
                            tickFormatter={(v: string) => v?.slice(0, 5) ?? ""}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px -12px rgba(15,23,42,0.18)', padding: '6px 8px', backgroundColor: '#fff', fontSize: '11px' }}
                            labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullDate ?? ""}
                            formatter={(v: any) => [formatBRL(Number(v)), "Receita"]}
                            cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '3 3' }}
                          />
                          <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill="url(#heroGrad)" dot={{ r: 2.5, strokeWidth: 0, fill: "#4f46e5" }} activeDot={{ r: 4, strokeWidth: 0, fill: "#4f46e5" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* footer stats */}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <Link to="/financeiro/central?tab=recebidos" className="block hover:bg-emerald-50/40 rounded-lg -m-1 p-1 transition-colors">
                      <FooterStat label="Receita Bruta" value={formatBRL(stats.grossRevenue)} accent="emerald" />
                    </Link>
                    <Link to="/financeiro/central?tab=relatorios" className="block hover:bg-indigo-50/40 rounded-lg -m-1 p-1 transition-colors">
                      <FooterStat
                        label="Receita Líquida"
                        value={formatBRL(stats.netRevenue)}
                        accent={stats.netRevenue < 0 ? "rose" : undefined}
                        hint={`Recebido ${formatBRL(stats.periodReceived)} · −${formatBRL(stats.periodSalesCosts)} custos · −${formatBRL(stats.periodCommissions)} com. · −${formatBRL(stats.periodTaxes)} imp.${stats.taxRate ? ` (${stats.taxRate}%)` : ""}`}
                      />
                    </Link>
                    <Link to="/financeiro/central?tab=a_receber" className="block hover:bg-amber-50/40 rounded-lg -m-1 p-1 transition-colors">
                      <FooterStat label={`Estimativa (${stats.estimatedRevenueCount})`} value={formatBRL(stats.estimatedRevenue)} accent={stats.estimatedRevenue > 0 ? "rose" : undefined} />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
                    <FooterStat label="Ticket médio" value={formatBRL(stats.avgTicket)} />
                    <FooterStat label="A receber 7d" value={formatBRL(stats.receivable7d)} />
                    <FooterStat label="Inadimplência" value={formatBRL(stats.overdueAmount)} accent={stats.overdueAmount > 0 ? "rose" : undefined} />
                  </div>
                </>
              )}
            </div>
          </div>


          {/* Side KPIs grid */}
          <div className="lg:col-span-4 grid grid-cols-1 gap-4">
            <SideKpi
              label="Clientes ativos"
              value={isGlobalLoading ? "..." : stats.activeClients.toString()}
              sub={isGlobalLoading ? "Carregando..." : `${stats.newClientsRange} novos · ${stats.totalClients} totais`}
              icon={Users}
              accent="emerald"
            />
            <SideKpi
              label="Pipeline aberto"
              value={isGlobalLoading ? "..." : formatBRL(stats.pipelineTotal)}
              sub={isGlobalLoading ? "Carregando..." : `${stats.leadsCount} leads · ${stats.conversionRate.toFixed(1)}% conv.`}
              icon={Target}
              accent="indigo"
              compact
            />

          </div>
        </section>

        {/* ============ HOJE — PENDÊNCIAS DO DIA ============ */}
        <TodayBoard
          loading={isGlobalLoading}
          dateLabel={todayLabel}
          totalCount={stats.todayPendingCount}
          tasks={stats.todayTasksList}
          demands={stats.todayDemandsList}
          docs={stats.todayDocsList}
          contracts={stats.todayContractsList}
          agenda={stats.todayAgendaList}
        />

        {/* ============ OPERATIONAL ROW ============ */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MiniStat label="Demandas atrasadas" value={isGlobalLoading ? "-" : stats.delayedDemands} hint={isGlobalLoading ? "..." : `${stats.activeDemands} ativas`} icon={Clock} to="/demandas" negative={!isGlobalLoading && stats.delayedDemands > 0} />
            <MiniStat label="Contratos abertos" value={isGlobalLoading ? "-" : stats.openContracts} hint={isGlobalLoading ? "..." : `${stats.waitingSignatureContracts} aguardando`} icon={FileSignature} to="/contratos" />
            <MiniStat label="Docs pendentes" value={isGlobalLoading ? "-" : stats.pendingDocs} hint="Solicitações" icon={FileText} to="/documentos" />
            <MiniStat label="Tarefas atrasadas" value={isGlobalLoading ? "-" : stats.overdueTasks} hint={isGlobalLoading ? "..." : `${stats.todayTasks} hoje`} icon={ClipboardList} to="/tarefas" negative={!isGlobalLoading && stats.overdueTasks > 0} />
            <MiniStat label="Comissões" value={isGlobalLoading ? "-" : formatBRL(stats.commissionsToPay)} hint={isGlobalLoading ? "..." : `${stats.commissionsCount} lançamentos`} icon={Wallet} to="/comissoes" />

        </section>

        {/* ============ REVENUE BY STAGE ============ */}
        <section className="grid grid-cols-1">
          <RevenueByStage payments={(_rawPayments as any[]).filter((p: any) => matchesClientId(p.client_id))} />
        </section>



        {/* ============ CHART + STATUS PIE ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Performance comercial"
              subtitle={isGlobalLoading ? "Calculando performance..." : `Receita diária · ${rangeKey === "HOJE" ? "últimos 7 dias" : rangeKey === "7D" ? "últimos 7 dias" : rangeKey === "30D" ? "últimos 30 dias" : "mês atual"}`}
              right={
                <Link to="/financeiro" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
                  Central financeira <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
            <div className="h-[320px] w-full px-3 pb-3">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={8} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} width={60} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px -12px rgba(15,23,42,0.18)', padding: '12px 14px', backgroundColor: '#fff', fontSize: '12px' }}
                      labelStyle={{ color: '#64748b', fontWeight: 600, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                      formatter={(v: any) => [formatBRL(Number(v)), "Receita"]}
                      cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 3' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: "#4f46e5" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Status das demandas" subtitle={isGlobalLoading ? "Carregando demandas..." : "Distribuição operacional"} />
            <div className="px-6 pb-6">
              <div className="h-[200px] w-full flex items-center justify-center relative">
                {isGlobalLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="size-6 border-2 border-indigo-600/20 border-t-indigo-600 animate-spin rounded-full" />
                  </div>
                ) : mounted && stats.demandsByStatus.length > 0 ? (

                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.demandsByStatus} innerRadius={62} outerRadius={88} paddingAngle={2.5} dataKey="value" stroke="none">
                          {stats.demandsByStatus.map((e, i) => (<Cell key={i} fill={e.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="font-display text-[28px] font-bold tabular-nums text-slate-900 leading-none">
                        {stats.demandsByStatus.reduce((a, x) => a + x.value, 0)}
                      </p>
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500 mt-1">Total</p>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-slate-400 font-medium">Sem demandas registradas</p>
                )}
              </div>
              <div className="space-y-2.5 mt-4">
                {!isGlobalLoading && stats.demandsByStatus.length > 0 ? stats.demandsByStatus.map((s) => {

                  const total = stats.demandsByStatus.reduce((a, x) => a + x.value, 0);
                  const pct = total > 0 ? (s.value / total) * 100 : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between text-[12.5px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="font-semibold text-slate-700 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
                        <span className="font-display font-bold text-slate-900 tabular-nums w-7 text-right">{s.value}</span>
                      </div>
                    </div>
                  );
                }) : null}
              </div>
            </div>
          </Card>
        </section>

        {/* ============ VENDAS RECENTES + FUNIL ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Vendas recentes"
              subtitle={isGlobalLoading ? "Carregando histórico..." : "Últimas transações registradas no período"}

              right={<Link to="/vendas" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Ver todas <ArrowUpRight className="size-3.5" /></Link>}
            />
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {isGlobalLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="size-6 border-2 border-indigo-600/20 border-t-indigo-600 animate-spin rounded-full" />
                </div>
              ) : stats.recentSales.length > 0 ? stats.recentSales.map((s: any, i: number) => (

                <Link to="/vendas" key={i} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors group">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200 flex items-center justify-center text-slate-700 font-bold text-[14px] shrink-0">
                      {String(s.client || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-slate-900 truncate">{s.client}</p>
                      <p className="text-[11.5px] text-slate-500 font-medium">{s.sale_date ? format(new Date(s.sale_date), "dd 'de' MMM, yyyy", { locale: ptBR }) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-display text-[15px] font-bold text-slate-900 tabular-nums leading-none">{formatBRL(s.amount)}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1.5">● Confirmado</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              )) : (
                <EmptyRow message="Nenhuma venda no período selecionado" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Funil de leads" subtitle={isGlobalLoading ? "..." : `${stats.conversionRate.toFixed(1)}% taxa de conversão`} />
            <div className="px-6 pb-4 space-y-3.5">
              {isGlobalLoading ? (
                <div className="py-8 flex justify-center">
                   <div className="size-5 border-2 border-indigo-600/20 border-t-indigo-600 animate-spin rounded-full" />
                </div>
              ) : stats.leadsByStage.map((stage, i) => {

                const max = Math.max(...stats.leadsByStage.map(s => s.value), 1);
                const pct = (stage.value / max) * 100;
                const opacity = 0.45 + (i * 0.18);
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                      <span className="font-semibold text-slate-700">{stage.name}</span>
                      <span className="font-display font-bold tabular-nums text-slate-900">{stage.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-700"
                        style={{ width: `${Math.max(pct, 4)}%`, opacity }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-100 px-6 py-3.5 flex items-center justify-between text-[11.5px] bg-slate-50/40">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                <TrendingUp className="size-3.5" /> {stats.wonLeads} ganhos
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold">
                <TrendingDown className="size-3.5" /> {stats.lostLeads} perdidos
              </span>
            </div>
          </Card>
        </section>

        {/* ============ TOP CLIENTES + ATIVIDADES + ATALHOS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Top clientes" subtitle="Maior receita acumulada" />
            <div className="px-6 pb-5 pt-1 space-y-3">
              {isGlobalLoading ? (
                <div className="py-8 flex justify-center">
                   <div className="size-5 border-2 border-indigo-600/20 border-t-indigo-600 animate-spin rounded-full" />
                </div>
              ) : stats.topClients.length > 0 ? stats.topClients.map((c, i) => {

                const pct = (c.total / stats.maxTopClient) * 100;
                const medal = ["bg-amber-500", "bg-slate-400", "bg-amber-700/70", "bg-slate-300", "bg-slate-300"];
                return (
                  <Link to={`/clientes/${c.id}`} key={c.id} className="block group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn("size-5 rounded-md text-white text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0", medal[i])}>
                          {i + 1}
                        </span>
                        <span className="text-[12.5px] font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{c.name}</span>
                      </div>
                      <span className="font-display text-[12px] font-bold tabular-nums text-slate-900 shrink-0">{formatBRL(c.total)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              }) : (
                <EmptyRow message="Sem dados de receita" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Atividades recentes" subtitle="Eventos do sistema" right={<Link to="/auditoria" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Log <ArrowUpRight className="size-3.5" /></Link>} />
            <div className="divide-y divide-slate-100 border-t border-slate-100 max-h-[340px] overflow-y-auto">
              {isGlobalLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="size-6 border-2 border-indigo-600/20 border-t-indigo-600 animate-spin rounded-full" />
                </div>
              ) : activityLogs.length > 0 ? activityLogs.map((a: any) => (

                <div key={a.id} className="px-6 py-3">
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3.5 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{a.action}</p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {a.profiles?.full_name || "Sistema"} · {a.entity_type}
                      </p>
                    </div>
                    <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums shrink-0">
                      {format(new Date(a.created_at), "HH:mm")}
                    </span>
                  </div>
                </div>
              )) : (
                <EmptyRow message="Nenhuma atividade recente" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Atalhos rápidos" subtitle="Crie em um clique" right={<Sparkles className="size-3.5 text-indigo-500" />} />
            <div className="px-6 pb-6 grid grid-cols-2 gap-2.5">
              <Shortcut label="Novo lead" to="/leads?new=1" icon={UserPlus} />
              <Shortcut label="Tarefa" to="/tarefas?new=1" icon={ClipboardList} />
              <Shortcut label="Contrato" to="/contratos?new=1" icon={FileSignature} />
              <Shortcut label="Documento" to="/documentos" icon={FileText} />
              <Shortcut label="Cliente" to="/clientes?new=1" icon={Users} />
              <Shortcut label="Comissão" to="/comissoes" icon={Receipt} />
            </div>
            <div className="border-t border-slate-100 px-6 py-3.5 bg-gradient-to-r from-indigo-50/60 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="size-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11.5px] font-semibold text-slate-700">{stats.openTasks} tarefa(s) ativa(s)</span>
              </div>
              <Link to="/tarefas" className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 shrink-0">
                Abrir <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </Card>
        </section>

      </div>
    </div>
  );
}

/* ============ COMPONENTS ============ */

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn(
      "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.06)] overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4">
      <div className="min-w-0">
        <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-slate-900">{title}</h3>
        {subtitle && <p className="text-[12px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full font-bold tabular-nums text-[11.5px] ring-1",
      positive ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60" : "bg-rose-50 text-rose-700 ring-rose-200/60"
    )}>
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

function FooterStat({ label, value, accent, hint }: { label: string; value: string; accent?: "emerald" | "rose"; hint?: string }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={cn("font-display text-[15px] font-bold tabular-nums mt-1 leading-none", color)}>{value}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-1 leading-tight tabular-nums">{hint}</p>}
    </div>
  );
}

function SideKpi({ label, value, sub, icon: Icon, accent, compact }: { label: string; value: string; sub: string; icon: any; accent: "indigo" | "emerald" | "rose" | "slate"; compact?: boolean }) {
  const accents: Record<string, { iconBg: string; iconColor: string; ring: string; dot: string; gradient: string }> = {
    indigo: { iconBg: "bg-indigo-50", iconColor: "text-indigo-600", ring: "ring-indigo-100", dot: "bg-indigo-500", gradient: "from-indigo-50/50" },
    emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", ring: "ring-emerald-100", dot: "bg-emerald-500", gradient: "from-emerald-50/50" },
    rose: { iconBg: "bg-rose-50", iconColor: "text-rose-600", ring: "ring-rose-100", dot: "bg-rose-500", gradient: "from-rose-50/50" },
    slate: { iconBg: "bg-slate-100", iconColor: "text-slate-600", ring: "ring-slate-200", dot: "bg-slate-400", gradient: "from-slate-50/50" },
  };
  const a = accents[accent];
  return (
    <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] hover:border-slate-300/80 transition-all flex flex-col min-h-[140px] overflow-hidden">
      {/* Decorative gradient background */}
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none", a.gradient)} />
      
      <div className="relative flex items-center justify-between z-10">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-1 rounded-full", a.dot)} />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</span>
        </span>
        <div className={cn("size-7 rounded-lg flex items-center justify-center ring-1 transition-transform group-hover:scale-105", a.iconBg, a.iconColor, a.ring)}>
          <Icon className="size-3.5 stroke-[2]" />
        </div>
      </div>

      <div className="relative flex-1 flex flex-col justify-end py-1 z-10">
        <p className={cn(
          "font-display font-bold tabular-nums leading-none tracking-[-0.02em] text-slate-900 group-hover:translate-x-1 transition-transform",
          compact ? "text-[26px]" : "text-[30px]"
        )}>
          {value}
        </p>
        <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">{sub}</p>
      </div>

      <div className="relative pt-2 mt-auto border-t border-slate-100 flex items-center justify-between z-10">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Atualizado</span>
        <span className={cn("inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider", a.iconColor)}>
          <span className={cn("size-1 rounded-full animate-pulse", a.dot)} />
          ao vivo
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, icon: Icon, to, negative }: { label: string; value: string | number; hint: string; icon: any; to: string; negative?: boolean }) {
  return (
    <Link to={to} className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300/80 hover:shadow-[0_4px_14px_-6px_rgba(15,23,42,0.1)] transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          "size-7 rounded-lg flex items-center justify-center ring-1",
          negative && Number(value) > 0 ? "bg-rose-50 text-rose-600 ring-rose-100" : "bg-slate-50 text-slate-600 ring-slate-100"
        )}>
          <Icon className="size-3.5 stroke-[2.2]" />
        </div>
        <ChevronRight className="size-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-[0.14em] mb-1 truncate">{label}</p>
      <p className={cn(
        "font-display text-[20px] font-bold tracking-[-0.02em] tabular-nums leading-none",
        negative && Number(value) > 0 ? "text-rose-600" : "text-slate-900"
      )}>{value}</p>
      <p className="text-[11px] font-medium text-slate-500 mt-1.5 truncate opacity-80">{hint}</p>
    </Link>
  );
}

function Shortcut({ label, to, icon: Icon }: { label: string; to: string; icon: any }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-start justify-between gap-2.5 p-3 rounded-xl border border-slate-200/70 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 hover:shadow-[0_2px_8px_-2px_rgba(79,70,229,0.15)] transition-all min-h-[88px]"
    >
      <div className="size-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
        <Icon className="size-4 stroke-[2.2]" />
      </div>
      <span className="text-[12px] font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{label}</span>
    </Link>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-[12px] text-slate-400 font-medium">{message}</p>
    </div>
  );
}

function TodayBoard({
  loading, dateLabel, totalCount, tasks, demands, docs, contracts, agenda,
}: {
  loading: boolean;
  dateLabel: string;
  totalCount: number;
  tasks: { id: string; title: string; time: string | null }[];
  demands: { id: string; title: string; subtitle: string }[];
  docs: { id: string; title: string; subtitle: string }[];
  contracts: { id: string; title: string; subtitle: string }[];
  agenda: { id: string; title: string; subtitle: string }[];
}) {
  const cols: {
    key: string;
    label: string;
    count: number;
    to: string;
    icon: any;
    accent: string;
    items: { id: string; title: string; sub?: string | null }[];
  }[] = [
    {
      key: "tasks", label: "Tarefas de hoje", count: tasks.length, to: "/tarefas",
      icon: ClipboardList, accent: "indigo",
      items: tasks.map(t => ({ id: t.id, title: t.title, sub: t.time })),
    },
    {
      key: "agenda", label: "Agenda (Atendimentos)", count: agenda.length, to: "/demandas",
      icon: MessageSquare, accent: "emerald",
      items: agenda.map(i => ({ id: i.id, title: i.title, sub: i.subtitle })),
    },
    {
      key: "demands", label: "Demandas com prazo hoje", count: demands.length, to: "/demandas",
      icon: Clock, accent: "amber",
      items: demands.map(d => ({ id: d.id, title: d.title, sub: d.subtitle })),
    },
    {
      key: "docs", label: "Documentos para revisar", count: docs.length, to: "/documentos",
      icon: FileText, accent: "sky",
      items: docs.map(d => ({ id: d.id, title: d.title, sub: d.subtitle })),
    },
    {
      key: "contracts", label: "Contratos aguardando", count: contracts.length, to: "/contratos",
      icon: FileSignature, accent: "violet",
      items: contracts.map(c => ({ id: c.id, title: c.title, sub: c.subtitle })),
    },
  ];

  const accentMap: Record<string, { bg: string; text: string; ring: string; chip: string }> = {
    indigo:  { bg: "bg-indigo-50",  text: "text-indigo-600",  ring: "ring-indigo-100",  chip: "bg-indigo-100 text-indigo-700" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-600",   ring: "ring-amber-100",   chip: "bg-amber-100 text-amber-700" },
    sky:     { bg: "bg-sky-50",     text: "text-sky-600",     ring: "ring-sky-100",     chip: "bg-sky-100 text-sky-700" },
    violet:  { bg: "bg-violet-50",  text: "text-violet-600",  ring: "ring-violet-100",  chip: "bg-violet-100 text-violet-700" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", chip: "bg-emerald-100 text-emerald-700" },
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.06)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(79,70,229,0.4)]">
            <CalendarCheck className="size-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-slate-900">Pendências de hoje</h3>
            <p className="text-[12px] text-slate-500 font-medium capitalize truncate">{dateLabel}</p>
          </div>
        </div>
        <div className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold tabular-nums text-[12px] ring-1",
          totalCount > 0 ? "bg-rose-50 text-rose-700 ring-rose-200/60" : "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
        )}>
          {totalCount > 0 ? <AlertCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {loading ? "..." : `${totalCount} ${totalCount === 1 ? "pendência" : "pendências"}`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {cols.map((c) => {
          const a = accentMap[c.accent];
          return (
            <div key={c.key} className="p-5 min-h-[200px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("size-7 rounded-lg ring-1 flex items-center justify-center shrink-0", a.bg, a.text, a.ring)}>
                    <c.icon className="size-3.5 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-600 truncate">{c.label}</span>
                </div>
                <span className={cn("inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md text-[11px] font-bold tabular-nums", a.chip)}>
                  {loading ? "·" : c.count}
                </span>
              </div>

              <div className="flex-1 space-y-1.5">
                {loading ? (
                  <div className="py-4 flex justify-center">
                    <div className="size-4 border-2 border-indigo-600/20 border-t-indigo-600 animate-spin rounded-full" />
                  </div>
                ) : c.items.length > 0 ? c.items.map((it) => (
                  <Link
                    to={c.to}
                    key={it.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <span className="text-[12.5px] font-semibold text-slate-700 truncate group-hover:text-slate-900">{it.title}</span>
                    {it.sub ? (
                      <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums shrink-0">{it.sub}</span>
                    ) : null}
                  </Link>
                )) : (
                  <p className="text-[12px] text-slate-400 font-medium py-3">Nada pendente.</p>
                )}
              </div>

              <Link to={c.to} className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-indigo-600 hover:text-indigo-700">
                Abrir <ArrowUpRight className="size-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
