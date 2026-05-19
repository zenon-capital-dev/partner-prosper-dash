import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature, Target, Handshake,
  Plus, ArrowUpRight, Phone, CalendarClock, AlertTriangle, Bell,
  FileText, ChevronRight, Crown, Briefcase, ClipboardList, Sparkles,
  Mail, MessageSquare, UserPlus, PiggyBank, Receipt, BarChart3, Filter, Zap,
  Calendar as CalendarIcon, Wallet, TrendingUp as TrendUp,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadialBarChart, RadialBar, PolarAngleAxis,
  PieChart, Pie, Legend,
} from "recharts";

type Tone = "primary" | "success" | "warning" | "danger" | "info";

const toneColor: Record<Tone, { text: string; bg: string; border: string; chart: string; soft: string; grad: string; ring: string }> = {
  primary: { text: "text-indigo-800", bg: "bg-indigo-100", border: "border-indigo-200", chart: "#6366f1", soft: "bg-indigo-50", grad: "from-indigo-500 to-indigo-600", ring: "ring-indigo-200/60" },
  success: { text: "text-emerald-800", bg: "bg-emerald-100", border: "border-emerald-200", chart: "#10b981", soft: "bg-emerald-50", grad: "from-emerald-500 to-emerald-600", ring: "ring-emerald-200/60" },
  warning: { text: "text-amber-800", bg: "bg-amber-100", border: "border-amber-200", chart: "#f59e0b", soft: "bg-amber-50", grad: "from-amber-500 to-amber-600", ring: "ring-amber-200/60" },
  danger: { text: "text-rose-800", bg: "bg-rose-100", border: "border-rose-200", chart: "#f43f5e", soft: "bg-rose-50", grad: "from-rose-500 to-rose-600", ring: "ring-rose-200/60" },
  info: { text: "text-sky-600", bg: "bg-sky-100", border: "border-sky-200", chart: "#0ea5e9", soft: "bg-sky-50", grad: "from-sky-500 to-sky-600", ring: "ring-sky-200/60" },
};

const statusLabel: Record<string, { label: string; tone: Tone }> = {
  aguardando_inicio: { label: "Aguardando", tone: "warning" },
  em_andamento: { label: "Em andamento", tone: "info" },
  concluido: { label: "Concluído", tone: "success" },
  atrasado: { label: "Atrasado", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "danger" },
  pausado: { label: "Pausado", tone: "warning" },
};

export default function DashboardAdmin() {
  const { user } = useAuth();
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "PERSONALIZADO">("HOJE");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [customOpen, setCustomOpen] = useState(false);

  // Helper: today in Brasília
  const brasiliaToday = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
    return new Date(y, m - 1, d);
  }, []);

  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = brasiliaToday.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const timeNow = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date());

  // ===== Queries =====
  const { data: clients = [] } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name, status, source, created_at, health_score, sale_value, contract_value, phone, email")).data ?? [],
  });
  const { data: clientProducts = [] } = useQuery({
    queryKey: ["dash-demands"],
    queryFn: async () => (await supabase.from("client_products").select("id, status, deadline, service_provider_id, product_id, value, created_at, client_id, priority, sla_status").order("deadline", { ascending: true, nullsFirst: false })).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => (await supabase.from("sales").select("id, amount, sale_date, status, product_id, partner_id, client_id, created_at").order("sale_date", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["dash-leads"],
    queryFn: async () => (await supabase.from("leads").select("id, full_name, company, status, estimated_value, close_probability, next_action, next_action_date, source, created_at, converted_to_client_id").order("next_action_date", { ascending: true, nullsFirst: false }).limit(100)).data ?? [],
  });
  const { data: proposals = [] } = useQuery({
    queryKey: ["dash-proposals"],
    queryFn: async () => (await supabase.from("proposals").select("id, status, total, created_at, sent_at, approved_at, valid_until").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => (await supabase.from("payments").select("amount, status, due_date, client_id").order("due_date", { ascending: true })).data ?? [],
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["dash-commissions"],
    queryFn: async () => (await supabase.from("commissions").select("amount, status, partner_id, created_at")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["dash-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, status, client_id, name, amount, created_at").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () => (await supabase.from("tasks").select("id, title, due_date, priority, status_new, assigned_to, created_at").order("due_date", { ascending: true, nullsFirst: false }).limit(20)).data ?? [],
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["dash-partners"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name, active")).data ?? [],
  });

  // ===== Stats =====
  const stats = useMemo(() => {
    const now = new Date();
    const brNow = brasiliaToday;

    // Compute date range as ISO strings (YYYY-MM-DD) for reliable comparison
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    let rangeStart = new Date(brNow);
    let rangeEnd = new Date(brNow);
    if (rangeKey === "HOJE") {
      // both start and end = today
    } else if (rangeKey === "7 DIAS") {
      rangeStart = new Date(brNow); rangeStart.setDate(brNow.getDate() - 6);
    } else if (rangeKey === "30 DIAS") {
      rangeStart = new Date(brNow); rangeStart.setDate(brNow.getDate() - 29);
    } else if (rangeKey === "MÊS") {
      rangeStart = new Date(brNow.getFullYear(), brNow.getMonth(), 1);
    } else if (rangeKey === "PERSONALIZADO") {
      if (customRange.from) rangeStart = customRange.from;
      if (customRange.to) rangeEnd = customRange.to;
    }
    const startISO = toISO(rangeStart);
    const endISO = toISO(rangeEnd);
    const startOfRange = rangeStart;

    const M = brNow.getMonth();
    const Y = brNow.getFullYear();
    const startMonth = new Date(Y, M, 1);
    const startLast = new Date(Y, M - 1, 1);
    const endLast = new Date(Y, M, 0);

    // Filter sales by range using ISO date comparison
    const inRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return false;
      const d = String(dateStr).slice(0, 10);
      return d >= startISO && d <= endISO;
    };
    const filteredSales = sales.filter((s: any) => inRange(s.sale_date));

    const monthSales = sales.filter((s: any) => s.sale_date && new Date(s.sale_date) >= startMonth);
    const lastMonthSales = sales.filter((s: any) => {
      const d = s.sale_date ? new Date(s.sale_date) : null;
      return d && d >= startLast && d <= endLast;
    });
    const monthRevenue = monthSales.reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const lastMonthRevenue = lastMonthSales.reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const revenueDelta = lastMonthRevenue > 0
      ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : monthRevenue > 0 ? 100 : 0;
    const avgTicket = monthSales.length > 0 ? monthRevenue / monthSales.length : 0;

    // KPIs based on range
    const rangeRevenue = filteredSales.reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const rangeNewClients = clients.filter((c: any) => c.created_at && new Date(c.created_at) >= startOfRange).length;
    const rangeSalesCount = filteredSales.length;

    const activeClients = clients.filter((c: any) => c.status === "ativo").length;
    const newClientsMonth = clients.filter((c: any) => c.created_at && new Date(c.created_at) >= startMonth).length;
    const churnRisk = clients.filter((c: any) => (c.health_score ?? 100) < 50).length;

    const inProgress = clientProducts.filter((p: any) => p.status === "em_andamento").length;
    const awaiting = clientProducts.filter((p: any) => p.status === "aguardando_inicio").length;
    const completed = clientProducts.filter((p: any) => p.status === "concluido").length;
    const delayed = clientProducts.filter((p: any) =>
      p.status === "atrasado" ||
      (p.deadline && new Date(p.deadline) < now && !["concluido", "cancelado"].includes(p.status))
    ).length;

    const LOST = ["perdido", "lost", "descartado", "cancelado"];
    const WON = ["ganho", "won", "convertido", "fechado"];
    const activeLeads = leads.filter((l: any) =>
      !LOST.includes(String(l.status || "").toLowerCase()) &&
      !WON.includes(String(l.status || "").toLowerCase()) &&
      !l.converted_to_client_id
    );
    const wonLeads = leads.filter((l: any) => WON.includes(String(l.status || "").toLowerCase()) || l.converted_to_client_id);
    const weightedPipeline = activeLeads.reduce(
      (a, l: any) => a + (Number(l.estimated_value || 0) * (Number(l.close_probability || 0) / 100)), 0
    );
    const totalPipeline = activeLeads.reduce((a, l: any) => a + Number(l.estimated_value || 0), 0);
    const conversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

    const overduePayments = payments.filter((p: any) =>
      p.status === "vencido" ||
      (["em_aberto", "pendente", "parcial"].includes(p.status) && p.due_date && new Date(p.due_date) < now)
    );
    const overdueAmount = overduePayments.reduce((a, p: any) => a + Number(p.amount || 0), 0);
    const upcomingPayments = payments.filter((p: any) => {
      if (!p.due_date || !["em_aberto", "pendente", "parcial"].includes(p.status)) return false;
      const d = new Date(p.due_date);
      const in7 = new Date(now.getTime() + 7 * 86400000);
      return d >= now && d <= in7;
    });
    const upcomingAmount = upcomingPayments.reduce((a, p: any) => a + Number(p.amount || 0), 0);

    const pendingCommissions = commissions
      .filter((c: any) => c.status === "pendente")
      .reduce((a, c: any) => a + Number(c.amount || 0), 0);

    // Revenue 12 months
    const revenue12m = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(Y, M - (11 - i), 1);
      const next = new Date(Y, M - (11 - i) + 1, 1);
      const total = sales.filter((s: any) =>
        s.sale_date && new Date(s.sale_date) >= d && new Date(s.sale_date) < next
      ).reduce((a, s: any) => a + Number(s.amount || 0), 0);
      const count = sales.filter((s: any) =>
        s.sale_date && new Date(s.sale_date) >= d && new Date(s.sale_date) < next
      ).length;
      return {
        name: d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
        receita: total,
        deals: count,
        meta: Math.round(total * 1.15 + 10000),
      };
    });

    // Pipeline by stage
    const stageOrder = ["novo", "qualificado", "proposta", "negociacao", "ganho"];
    const stageLabels: Record<string, string> = {
      novo: "Novos", qualificado: "Qualificados", proposta: "Proposta enviada",
      negociacao: "Negociação", ganho: "Fechados",
    };
    const pipelineByStage = stageOrder.map((s) => {
      const filtered = leads.filter((l: any) => String(l.status || "").toLowerCase() === s);
      return {
        name: stageLabels[s],
        value: filtered.reduce((a, l: any) => a + Number(l.estimated_value || 0), 0),
        count: filtered.length,
      };
    });

    // Demands by status
    const demandsByStatus = [
      { name: "Em andamento", value: inProgress, tone: "info" as Tone, color: "#38bdf8" },
      { name: "Aguardando", value: awaiting, tone: "warning" as Tone, color: "#fbbf24" },
      { name: "Concluídas", value: completed, tone: "success" as Tone, color: "#34d399" },
      { name: "Atrasadas", value: delayed, tone: "danger" as Tone, color: "#fb7185" },
    ];

    // Source breakdown
    const sourceMap = new Map<string, number>();
    clients.forEach((c: any) => {
      const k = c.source || "manual";
      sourceMap.set(k, (sourceMap.get(k) || 0) + 1);
    });
    const sourceData = Array.from(sourceMap.entries())
      .map(([k, v]) => ({ name: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Alerts
    const alerts: Array<{ id: string; title: string; sub: string; tone: Tone; icon: any; href: string }> = [];
    const contractsAwaiting = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    if (contractsAwaiting > 0) alerts.push({ id: "c1", title: "Contratos aguardando assinatura", sub: `${contractsAwaiting} contratos parados`, tone: "warning", icon: FileSignature, href: "/contratos" });
    const staleLeads = activeLeads.filter((l: any) => l.next_action_date && new Date(l.next_action_date) < now).length;
    if (staleLeads > 0) alerts.push({ id: "l1", title: "Follow-ups atrasados", sub: `${staleLeads} negociações esfriando`, tone: "danger", icon: CalendarClock, href: "/leads" });
    if (delayed > 0) alerts.push({ id: "d1", title: "Entregas em atraso", sub: `${delayed} demandas estouraram o prazo`, tone: "danger", icon: Clock, href: "/demandas" });
    if (overdueAmount > 0) alerts.push({ id: "p1", title: "Inadimplência detectada", sub: `${formatBRL(overdueAmount)} em ${overduePayments.length} título(s)`, tone: "danger", icon: CreditCard, href: "/financeiro" });
    if (churnRisk > 0) alerts.push({ id: "ch", title: "Clientes em risco de cancelamento", sub: `${churnRisk} contas com engajamento baixo`, tone: "warning", icon: AlertTriangle, href: "/clientes" });
    if (upcomingPayments.length > 0) alerts.push({ id: "up", title: "Recebíveis nos próximos 7 dias", sub: `${formatBRL(upcomingAmount)} previstos`, tone: "info", icon: PiggyBank, href: "/financeiro" });

    const upcomingActions = activeLeads
      .filter((l: any) => l.next_action_date)
      .sort((a: any, b: any) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime())
      .slice(0, 6);

    const urgentDemands = clientProducts
      .filter((p: any) => !["concluido", "cancelado"].includes(p.status))
      .sort((a: any, b: any) => (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity))
      .slice(0, 7);

    const recentSales = filteredSales.slice(0, 6).map((s: any) => {
      const client = clients.find((c: any) => c.id === s.client_id);
      return { ...s, clientName: client?.full_name || "Cliente removido" };
    });

    const topClients = clients
      .map((c: any) => ({ ...c, _value: Number(c.contract_value || c.sale_value || 0) }))
      .filter((c: any) => c._value > 0)
      .sort((a: any, b: any) => b._value - a._value)
      .slice(0, 6);

    const inRangeTs = (s?: string | null) => {
      if (!s) return false;
      const d = String(s).slice(0, 10);
      return d >= startISO && d <= endISO;
    };
    const recentActivity = [
      ...proposals.filter((p: any) => inRangeTs(p.created_at)).map((p: any) => ({ id: `p-${p.id}`, title: "Proposta enviada", sub: formatBRL(p.total), at: p.sent_at || p.created_at, icon: FileText, tone: "info" as Tone })),
      ...leads.filter((l: any) => inRangeTs(l.created_at)).map((l: any) => ({ id: `l-${l.id}`, title: "Nova negociação", sub: l.full_name, at: l.created_at, icon: Target, tone: "primary" as Tone })),
      ...sales.filter((s: any) => inRangeTs(s.sale_date || s.created_at)).map((s: any) => ({ id: `s-${s.id}`, title: "Venda registrada", sub: formatBRL(s.amount), at: s.sale_date || s.created_at, icon: CircleDollarSign, tone: "success" as Tone })),
      ...contracts.filter((c: any) => inRangeTs(c.created_at)).map((c: any) => ({ id: `c-${c.id}`, title: "Contrato " + (c.status || "criado"), sub: c.name, at: c.created_at, icon: FileSignature, tone: "primary" as Tone })),
    ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 9);

    const todayTasks = tasks.filter((t: any) => {
      if (t.status_new === "done") return false;
      if (!t.due_date) return true;
      const d = new Date(t.due_date);
      return d.toDateString() === now.toDateString() || d < now;
    }).slice(0, 6);

    // Provider/partner performance: top partners by commissions
    const partnerCommissionMap = new Map<string, number>();
    commissions.forEach((c: any) => {
      if (!c.partner_id) return;
      partnerCommissionMap.set(c.partner_id, (partnerCommissionMap.get(c.partner_id) || 0) + Number(c.amount || 0));
    });
    const topPartners = Array.from(partnerCommissionMap.entries())
      .map(([pid, amt]) => {
        const p = partners.find((x: any) => x.id === pid);
        return { id: pid, name: p?.full_name || "Parceiro", amount: amt };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Conversion goal radial
    const conversionGoal = [{ name: "Conversão", value: conversionRate, fill: conversionRate >= 25 ? "#34d399" : "#fbbf24" }];

    return {
      rangeRevenue, rangeNewClients, rangeSalesCount, rangeKey,
      monthRevenue, lastMonthRevenue, revenueDelta, avgTicket,
      activeClients, newClientsMonth, churnRisk,
      inProgress, awaiting, completed, delayed,
      weightedPipeline, totalPipeline, conversionRate,
      activeLeads, wonLeads, monthSalesCount: monthSales.length,
      overdueAmount, overduePayments, upcomingAmount, upcomingPayments,
      pendingCommissions, contractsAwaiting,
      revenue12m, pipelineByStage, demandsByStatus, sourceData,
      alerts, upcomingActions, urgentDemands, recentSales, topClients, recentActivity, todayTasks, topPartners,
      conversionGoal,
    };
  }, [clients, clientProducts, sales, payments, leads, proposals, contracts, commissions, partners, tasks, rangeKey, customRange, brasiliaToday]);

  // Sparkline data per KPI
  const revSpark = stats.revenue12m.slice(-7).map((d) => ({ v: d.receita }));
  const dealsSpark = stats.revenue12m.slice(-7).map((d) => ({ v: d.deals }));

  return (
    <div className="relative min-h-full bg-[#fafbfc]">
      <div className="relative px-4 sm:px-6 lg:px-10 py-6 lg:py-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">

        {/* ============ HEADER ============ */}
        <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-2">
              <Sparkles className="size-3 text-indigo-500" />
              <span>Painel Executivo</span>
              <span className="size-1 rounded-full bg-slate-300" />
              <span className="capitalize">{today} · {timeNow}</span>
            </div>
            <h1 className="text-[26px] lg:text-[30px] font-bold text-slate-900 tracking-tight leading-tight">
              {greeting}, <span className="text-indigo-600">{firstName}</span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-1.5 font-medium">
              Resumo consolidado · {stats.activeClients} clientes ativos · {stats.activeLeads.length} negociações · {stats.delayed} atrasos
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-lg bg-white border border-slate-200 p-1 shadow-sm">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setRangeKey(p)}
                  className={cn(
                    "px-3 h-7 rounded-md text-[11px] font-semibold tracking-tight transition-all whitespace-nowrap",
                    rangeKey === p ? "bg-slate-50 text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {p}
                </button>
              ))}
              <Popover open={customOpen} onOpenChange={setCustomOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => { setRangeKey("PERSONALIZADO"); setCustomOpen(true); }}
                    className={cn(
                      "px-2.5 h-7 rounded-md text-[11px] font-semibold transition-all inline-flex items-center gap-1",
                      rangeKey === "PERSONALIZADO" ? "bg-slate-50 text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <CalendarIcon className="size-3" />
                    {rangeKey === "PERSONALIZADO" && customRange.from && customRange.to
                      ? `${format(customRange.from, "dd/MM")}–${format(customRange.to, "dd/MM")}`
                      : "Custom"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: customRange.from, to: customRange.to }}
                    onSelect={(r: any) => {
                      setCustomRange({ from: r?.from, to: r?.to });
                      if (r?.from && r?.to) setCustomOpen(false);
                    }}
                    locale={ptBR}
                    numberOfMonths={2}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Link to="/vendas?new=1" className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all">
              <Plus className="size-3.5" /> Registrar Venda
            </Link>
            <button className="size-9 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 transition-all relative shadow-sm">
              <Bell className="size-4" />
              {stats.alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 size-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">{stats.alerts.length}</span>
              )}
            </button>
          </div>
        </header>

        {/* ============ PRIMARY KPIs ============ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <Kpi
            label="Receita do Período"
            value={formatBRL(stats.rangeRevenue)}
            delta={stats.revenueDelta}
            caption={rangeKey === "HOJE" ? "Total hoje" : `Últimos ${rangeKey}`}
            icon={CircleDollarSign}
            tone="primary"
            spark={revSpark}
          />
          <Kpi
            label="Novos Clientes"
            value={stats.rangeNewClients.toString()}
            delta={stats.rangeNewClients > 0 ? 100 : 0}
            caption={`${rangeKey === "HOJE" ? "Iniciados hoje" : "No período"}`}
            icon={Users}
            tone="info"
            spark={dealsSpark}
          />
          <Kpi
            label="Taxa de Conversão"
            value={`${stats.conversionRate}%`}
            delta={stats.conversionRate - 25}
            caption="Leads convertidos em clientes"
            icon={Target}
            tone="success"
            spark={dealsSpark}
          />
          <Kpi
            label="Ticket Médio"
            value={formatBRL(stats.avgTicket)}
            delta={stats.rangeSalesCount > 0 ? 8 : 0}
            caption={`${stats.rangeSalesCount} venda(s) no período`}
            icon={Receipt}
            tone="warning"
            spark={revSpark}
          />
        </section>

        {/* ============ SECONDARY METRICS ============ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Mini label="Contratos abertos" value={stats.contractsAwaiting.toString()} href="/contratos" />
          <Mini label="Docs pendentes" value={clientProducts.filter((p: any) => p.status === "aguardando_inicio").length.toString()} href="/documentos" />
          <Mini label="Tarefas atrasadas" value={stats.todayTasks.length.toString()} href="/tarefas" accent={stats.todayTasks.length > 0 ? "danger" : undefined} />
          <Mini label="Comissões a pagar" value={formatBRL(stats.pendingCommissions)} href="/comissoes" />
          <Mini label="Pipeline ponderado" value={formatBRL(stats.weightedPipeline)} href="/leads" />
          <Mini label="Total clientes" value={clients.length.toString()} href="/clientes" />
        </section>

        {/* ============ REVENUE CHART + ALERTS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-8">
            <CardHeader
              title="Fluxo de Receita Mensal"
              subtitle="Receita realizada vs. meta projetada"
              right={
                <div className="flex items-center gap-4 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="size-2 rounded-full bg-indigo-500" />Realizado</span>
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="size-2 rounded-full bg-slate-300" />Meta</span>
                </div>
              }
            />
            <div className="h-[280px] mt-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenue12m} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18}/>
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ecf1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `R$ ${v/1000}k`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="meta" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="receita" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorRev)" dot={{ r: 3, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader
              title="Alertas Críticos"
              subtitle="Itens que precisam de atenção"
              right={stats.alerts.length > 0 ? <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold">{stats.alerts.length} NOVOS</span> : null}
            />
            <div className="mt-4 space-y-2">
              {stats.alerts.length > 0 ? stats.alerts.slice(0, 4).map((a) => (
                <Link key={a.id} to={a.href} className="group flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all">
                  <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", toneColor[a.tone].soft, toneColor[a.tone].text)}>
                    <a.icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-slate-900 truncate leading-tight">{a.title}</p>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">{a.sub}</p>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 group-hover:text-indigo-500 transition-colors mt-0.5" />
                </Link>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="size-6 text-emerald-500" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900">Operação saudável</p>
                  <p className="text-[11px] text-slate-500 mt-1">Nenhum risco detectado</p>
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* ============ PIPELINE + DEMANDS + SOURCE ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-5">
            <CardHeader title="Funil de Vendas" subtitle="Distribuição por etapa" right={<Link to="/vendas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Abrir CRM →</Link>} />
            <div className="space-y-3 mt-4">
              {stats.pipelineByStage.map((stage, i) => {
                const max = Math.max(...stats.pipelineByStage.map((s) => s.value), 1);
                const pct = (stage.value / max) * 100;
                const colors = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#f43f5e"];
                return (
                  <div key={stage.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium text-slate-700">{stage.name}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        <span className="text-slate-900 font-semibold">{stage.count}</span> · {formatBRL(stage.value)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: colors[i] || "#6366f1" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Demandas por Status" subtitle="Distribuição operacional" right={<Link to="/demandas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Ver todas →</Link>} />
            <div className="flex items-center gap-5 mt-2">
              <div className="w-[130px] h-[130px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stats.demandsByStatus} innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                      {stats.demandsByStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {stats.demandsByStatus.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11.5px] text-slate-600 truncate">{d.name}</span>
                    </div>
                    <span className="text-[12px] font-semibold text-slate-900 tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title="Origem de Clientes" subtitle="Top canais de aquisição" />
            <div className="space-y-3 mt-4">
              {stats.sourceData.length > 0 ? stats.sourceData.slice(0, 5).map((s) => {
                const max = stats.sourceData[0].value;
                const pct = (s.value / max) * 100;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-600 capitalize truncate">{s.name.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{s.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : <Empty label="Sem dados de origem" />}
            </div>
          </Card>
        </section>

        {/* ============ RECENT SALES + URGENT DEMANDS + TASKS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-5">
            <CardHeader title="Vendas Recentes" subtitle="Últimos fechamentos" right={<Link to="/vendas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Ver todas →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.recentSales.length > 0 ? stats.recentSales.slice(0, 6).map((s: any) => {
                const isPaid = s.status === "concluida" || s.status === "pago";
                return (
                  <Link to="/vendas" key={s.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className={cn("size-9 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0", isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                      {s.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-900 truncate">{s.clientName}</p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">
                        {s.sale_date ? new Date(s.sale_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12.5px] font-bold text-slate-900 tabular-nums">{formatBRL(s.amount)}</p>
                      <span className={cn("inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                        {isPaid ? "Pago" : "Pendente"}
                      </span>
                    </div>
                  </Link>
                );
              }) : <Empty label="Nenhuma venda no período" />}
            </div>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Demandas Urgentes" subtitle="Próximas do prazo" right={<Link to="/demandas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Gerenciar →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.urgentDemands.length > 0 ? stats.urgentDemands.slice(0, 6).map((d: any) => {
                const overdue = d.deadline && new Date(d.deadline) < new Date();
                const client = clients.find((c: any) => c.id === d.client_id);
                const st = statusLabel[d.status] || { label: d.status, tone: "info" as Tone };
                return (
                  <div key={d.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={cn("size-2 rounded-full shrink-0", overdue ? "bg-rose-500" : "bg-slate-300")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-900 truncate">{client?.full_name || `Demanda #${d.id.slice(0, 6)}`}</p>
                      <p className="text-[10.5px] text-slate-500 truncate">
                        Prazo {d.deadline ? new Date(d.deadline).toLocaleDateString("pt-BR") : "—"} · {formatBRL(d.value || 0)}
                      </p>
                    </div>
                    <span className={cn("text-[9.5px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0", toneColor[st.tone].soft, toneColor[st.tone].text)}>
                      {st.label}
                    </span>
                  </div>
                );
              }) : <Empty label="Nenhuma demanda urgente" />}
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title="Tarefas de Hoje" subtitle="Pendentes & em atraso" right={<Link to="/tarefas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Todas →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.todayTasks.length > 0 ? stats.todayTasks.map((t: any) => {
                const overdue = t.due_date && new Date(t.due_date) < new Date();
                return (
                  <div key={t.id} className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <button className="size-4 rounded border border-slate-300 hover:border-indigo-500 transition-colors shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[12px] font-medium truncate", overdue ? "text-rose-700" : "text-slate-800")}>{t.title}</p>
                      {t.due_date && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
                      )}
                    </div>
                  </div>
                );
              }) : <Empty label="Nenhuma tarefa" />}
            </div>
          </Card>
        </section>

        {/* ============ FOLLOW-UPS + TOP CLIENTS + ACTIVITY ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-4">
            <CardHeader title="Próximos Follow-ups" subtitle="Negociações agendadas" right={<Link to="/vendas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Agenda →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.upcomingActions.length > 0 ? stats.upcomingActions.slice(0, 5).map((l: any) => {
                const d = new Date(l.next_action_date);
                const overdue = d < new Date();
                return (
                  <div key={l.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className={cn("size-10 rounded-lg flex flex-col items-center justify-center shrink-0", overdue ? "bg-rose-50" : "bg-indigo-50")}>
                      <span className={cn("text-[8.5px] font-bold uppercase leading-none", overdue ? "text-rose-700" : "text-indigo-700")}>{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                      <span className="text-[13px] font-bold text-slate-900 leading-none mt-0.5 tabular-nums">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-900 truncate">{l.full_name}</p>
                      <p className="text-[10.5px] text-slate-500 truncate mt-0.5">{l.next_action || "Follow-up"} · {l.company || "—"}</p>
                    </div>
                    {l.estimated_value > 0 && (
                      <span className="text-[11px] text-emerald-700 font-semibold tabular-nums shrink-0">{formatBRL(l.estimated_value)}</span>
                    )}
                  </div>
                );
              }) : <Empty label="Sem follow-ups agendados" />}
            </div>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Top Clientes" subtitle="Maior valor de carteira" right={<Link to="/clientes" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Carteira →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.topClients.length > 0 ? stats.topClients.slice(0, 6).map((c: any, i: number) => (
                <Link to={`/clientes/${c.id}`} key={c.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums w-5">{(i + 1).toString().padStart(2, "0")}</span>
                  <div className="size-8 rounded-full bg-indigo-50 flex items-center justify-center text-[11px] font-bold text-indigo-700 shrink-0">
                    {c.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-900 truncate">{c.full_name}</p>
                    <p className="text-[10.5px] text-slate-500 truncate">Health {c.health_score ?? "—"}/100 · {c.status}</p>
                  </div>
                  <span className="text-[12px] font-bold text-emerald-700 tabular-nums shrink-0">{formatBRL(c._value)}</span>
                </Link>
              )) : <Empty label="Sem clientes com valor" />}
            </div>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Atividade Recente" subtitle="Fluxo do sistema" right={<Link to="/auditoria" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Histórico →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.recentActivity.length > 0 ? stats.recentActivity.slice(0, 6).map((act) => {
                const dt = new Date(act.at);
                return (
                  <div key={act.id} className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", toneColor[act.tone].soft, toneColor[act.tone].text)}>
                      <act.icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900 truncate leading-tight">{act.title}</p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 truncate">{act.sub}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0 mt-0.5">
                      {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                );
              }) : <Empty label="Sem atividade recente" />}
            </div>
          </Card>
        </section>

        {/* ============ FINANCIAL + PARTNERS + QUICK ACTIONS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-5">
            <CardHeader title="Resumo Financeiro" subtitle="Visão consolidada do caixa" right={<Link to="/financeiro" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Central →</Link>} />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <FinanceTile icon={PiggyBank} label="A receber (7d)" value={formatBRL(stats.upcomingAmount)} sub={`${stats.upcomingPayments.length} título(s)`} tone="success" />
              <FinanceTile icon={FileWarning} label="Inadimplência" value={formatBRL(stats.overdueAmount)} sub={`${stats.overduePayments.length} vencido(s)`} tone="danger" />
              <FinanceTile icon={Handshake} label="Comissões" value={formatBRL(stats.pendingCommissions)} sub="A liberar" tone="primary" />
              <FinanceTile icon={FileSignature} label="Contratos" value={stats.contractsAwaiting.toString()} sub="Aguardando" tone="warning" />
            </div>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Top Parceiros" subtitle="Maior volume em comissões" right={<Link to="/parceiros" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Rede →</Link>} />
            <div className="mt-3 -mx-1">
              {stats.topPartners.length > 0 ? stats.topPartners.map((p, i) => {
                const max = stats.topPartners[0].amount;
                const pct = (p.amount / max) * 100;
                return (
                  <Link to={`/parceiros/${p.id}`} key={p.id} className="block px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums w-5">{(i + 1).toString().padStart(2, "0")}</span>
                      <p className="text-[12px] font-semibold text-slate-900 truncate flex-1">{p.name}</p>
                      <span className="text-[12px] text-emerald-700 font-bold tabular-nums">{formatBRL(p.amount)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden ml-8">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              }) : <Empty label="Sem comissões registradas" />}
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title="Ações Rápidas" subtitle="Criar em um clique" />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <QuickAction to="/leads?new=1" icon={UserPlus} label="Novo lead" />
              <QuickAction to="/vendas?new=1" icon={CircleDollarSign} label="Venda" />
              <QuickAction to="/propostas?new=1" icon={FileText} label="Proposta" />
              <QuickAction to="/contratos?new=1" icon={FileSignature} label="Contrato" />
              <QuickAction to="/tarefas?new=1" icon={ClipboardList} label="Tarefa" />
              <QuickAction to="/templates" icon={MessageSquare} label="Templates" />
            </div>
          </Card>
        </section>

        <div className="pt-2 flex items-center justify-center gap-3 text-[10px] tracking-[0.25em] uppercase text-slate-400 font-semibold">
          <div className="h-px w-10 bg-slate-200" />
          VendxCRM · {new Date().getFullYear()}
          <div className="h-px w-10 bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(255,255,255,0.98)",
  border: "1px solid #e8ecf1",
  borderRadius: "10px",
  fontSize: "11px",
  color: "#0f172a",
  boxShadow: "0 10px 40px rgba(15,23,42,0.08)",
  padding: "8px 12px",
};

/* ============ Components ============ */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[14px] font-bold text-slate-900 tracking-tight leading-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function Kpi({ label, value, delta, caption, icon: Icon, tone, spark }: {
  label: string; value: string; delta: number; caption: string; icon: any; tone: Tone; spark: Array<{ v: number }>;
}) {
  const t = toneColor[tone];
  const up = delta >= 0;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
      <div className="absolute bottom-0 right-0 left-0 h-16 opacity-[0.06] pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark}>
            <Area type="monotone" dataKey="v" stroke={t.chart} fill={t.chart} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
          <div className={cn("size-9 rounded-lg flex items-center justify-center", t.soft, t.text)}>
            <Icon className="size-4" strokeWidth={2.2} />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono text-[26px] font-bold text-slate-900 tracking-tight tabular-nums leading-none">{value}</span>
          <span className={cn(
            "text-[10.5px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5",
            up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          )}>
            {up ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {up ? "+" : ""}{delta.toFixed(1)}%
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium">{caption}</p>
      </div>
    </div>
  );
}

function Mini({ label, value, href, accent }: { label: string; value: string; href: string; accent?: "danger" | "success" }) {
  return (
    <Link to={href} className="group bg-white border border-slate-200/70 rounded-lg px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</span>
        {accent === "danger" && <span className="size-1.5 rounded-full bg-rose-500" />}
      </div>
      <span className={cn(
        "font-mono text-[16px] font-bold tabular-nums mt-1 truncate",
        accent === "danger" ? "text-rose-700" : "text-slate-900"
      )}>{value}</span>
    </Link>
  );
}

function FinanceTile({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: string; sub: string; tone: Tone;
}) {
  const t = toneColor[tone];
  return (
    <div className="rounded-lg bg-slate-50/60 border border-slate-200/60 p-3.5 hover:bg-white hover:shadow-sm transition-all">
      <div className={cn("size-8 rounded-lg flex items-center justify-center mb-2.5", t.soft, t.text)}>
        <Icon className="size-4" strokeWidth={2.2} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-mono text-[15px] font-bold text-slate-900 tabular-nums mt-1 truncate">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="group flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-slate-50/60 border border-slate-200/60 hover:bg-indigo-50 hover:border-indigo-200 transition-all">
      <Icon className="size-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
      <span className="text-[10.5px] font-semibold text-slate-700 group-hover:text-indigo-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-10 text-center">
      <CheckCircle2 className="size-6 mx-auto text-slate-300 mb-2" />
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
