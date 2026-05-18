import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature, Target, Handshake,
  Plus, ArrowUpRight, Phone, CalendarClock, AlertTriangle, Bell,
  FileText, ChevronRight, Crown, Briefcase, ClipboardList, Sparkles,
  Mail, MessageSquare, UserPlus, PiggyBank, Receipt, BarChart3, Filter, Zap,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
  const [rangeKey, setRangeKey] = useState("HOJE");
  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const timeNow = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

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
    // Brasilia Time (UTC-3)
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    
    const startOfRange = new Date(brNow);
    if (rangeKey === "HOJE") {
      startOfRange.setHours(0, 0, 0, 0);
    } else if (rangeKey === "7 DIAS") {
      startOfRange.setDate(brNow.getDate() - 7);
      startOfRange.setHours(0, 0, 0, 0);
    } else if (rangeKey === "30 DIAS") {
      startOfRange.setDate(brNow.getDate() - 30);
      startOfRange.setHours(0, 0, 0, 0);
    } else { // MÊS
      startOfRange.setDate(1);
      startOfRange.setHours(0, 0, 0, 0);
    }

    const M = brNow.getMonth();
    const Y = brNow.getFullYear();
    const startMonth = new Date(Y, M, 1);
    const startLast = new Date(Y, M - 1, 1);
    const endLast = new Date(Y, M, 0);

    // Filter sales by range
    const filteredSales = sales.filter((s: any) => {
      if (!s.sale_date) return false;
      const d = new Date(s.sale_date);
      return d >= startOfRange && d <= brNow;
    });

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

    const recentActivity = [
      ...proposals.filter((p: any) => new Date(p.created_at) >= startOfRange).map((p: any) => ({ id: `p-${p.id}`, title: "Proposta enviada", sub: formatBRL(p.total), at: p.sent_at || p.created_at, icon: FileText, tone: "info" as Tone })),
      ...leads.filter((l: any) => new Date(l.created_at) >= startOfRange).map((l: any) => ({ id: `l-${l.id}`, title: "Nova negociação", sub: l.full_name, at: l.created_at, icon: Target, tone: "primary" as Tone })),
      ...sales.filter((s: any) => new Date(s.sale_date || s.created_at) >= startOfRange).map((s: any) => ({ id: `s-${s.id}`, title: "Venda registrada", sub: formatBRL(s.amount), at: s.sale_date || s.created_at, icon: CircleDollarSign, tone: "success" as Tone })),
      ...contracts.filter((c: any) => new Date(c.created_at) >= startOfRange).map((c: any) => ({ id: `c-${c.id}`, title: "Contrato " + (c.status || "criado"), sub: c.name, at: c.created_at, icon: FileSignature, tone: "primary" as Tone })),
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
  }, [clients, clientProducts, sales, payments, leads, proposals, contracts, commissions, partners, tasks]);

  // Sparkline data per KPI
  const revSpark = stats.revenue12m.slice(-7).map((d) => ({ v: d.receita }));
  const dealsSpark = stats.revenue12m.slice(-7).map((d) => ({ v: d.deals }));

  return (
    <div className="relative min-h-full bg-transparent">
      <div className="relative p-3 sm:p-5 lg:p-7 space-y-5 max-w-[1680px] mx-auto animate-in fade-in duration-500">

        {/* ============ EXECUTIVE HEADER ============ */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="size-10 sm:size-12 rounded-lg bg-primary flex items-center justify-center shadow-sm ring-1 ring-primary/15">
                  <Crown className="size-4 sm:size-5 text-primary-foreground" strokeWidth={2.2} />
                </div>
                <div className="absolute -bottom-1 -right-1 size-3 sm:size-4 rounded-full bg-emerald-400 ring-2 ring-white shadow-md" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] sm:text-[10.5px] uppercase tracking-[0.18em] sm:tracking-[0.22em] font-bold text-slate-600 flex-wrap">
                  <CalendarClock className="size-3" />
                  <span>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase()}</span>
                  <span className="size-1 rounded-full bg-slate-300" />
                  <Sparkles className="size-3 text-primary" />
                  <span className="text-primary">Painel de Comando</span>
                </div>
                <h1 className="text-[18px] sm:text-[22px] lg:text-[26px] font-bold text-slate-950 tracking-tight mt-1 leading-tight">
                  {greeting}, <span className="text-primary">{firstName}</span>
                </h1>
                <p className="text-[11px] sm:text-[12px] text-slate-800 mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> {stats.activeClients} ativos</span>
                  <span className="text-slate-300">·</span>
                  <span><span className="text-indigo-800 font-semibold">{stats.activeLeads.length}</span> negociações</span>
                  <span className="text-slate-300">·</span>
                  <span><span className="text-amber-800 font-semibold">{stats.delayed}</span> atrasos</span>
                  <span className="text-slate-300">·</span>
                  <span><span className="text-rose-800 font-semibold">{stats.overduePayments.length}</span> inadimplentes</span>
                  <span className="hidden sm:inline text-slate-300">·</span>
                  <span className="hidden sm:inline text-slate-800 capitalize">{today}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="inline-flex items-center rounded-lg bg-card border border-border p-1 shadow-sm overflow-x-auto">
                {["HOJE", "7 DIAS", "30 DIAS", "MÊS"].map((p) => (
                  <button 
                    key={p} 
                    onClick={() => setRangeKey(p)}
                    className={cn(
                      "px-2.5 sm:px-3 h-7 rounded-lg text-[10px] font-bold tracking-wider transition-all whitespace-nowrap", 
                      rangeKey === p ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-800 hover:text-slate-950"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Link to="/leads?new=1" className="hidden sm:flex h-10 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[11.5px] font-semibold text-slate-700 items-center gap-1.5 transition-all shadow-sm">
                <Plus className="size-3.5" /> Negociação
              </Link>
              <Link to="/vendas?new=1" className="h-10 px-3 sm:px-4 rounded-lg bg-primary hover:bg-primary/90 text-[11px] sm:text-[11.5px] font-bold text-primary-foreground flex items-center gap-1.5 shadow-sm ring-1 ring-primary/15 transition-all">
                <TrendingUp className="size-3.5" /> <span className="hidden xs:inline sm:inline">Registrar fechamento</span><span className="xs:hidden sm:hidden">Fechar</span>
              </Link>
              <button className="size-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-800 hover:text-slate-950 transition-all relative shadow-sm">
                <Bell className="size-4" />
                {stats.alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">{stats.alerts.length}</span>
                )}
              </button>
            </div>
          </div>
        </header>

{/* Quick Terminal removido — ações rápidas já estão no header e na seção dedicada abaixo */}

        {/* ============ KPI HERO (4 PREMIUM) ============ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <KpiPremium label="Receita Bruta" value={formatBRL(stats.monthRevenue)} delta={`${stats.revenueDelta >= 0 ? "+" : ""}${stats.revenueDelta.toFixed(1)}%`} up={stats.revenueDelta >= 0} icon={CircleDollarSign} tone="primary" sparkData={revSpark} caption={`Mês atual vs anterior`} progress={Math.min(100, Math.round((stats.monthRevenue / 150000) * 100))} />
          <KpiPremium label="Aquisição" value={stats.newClientsMonth.toString()} delta={`+${stats.newClientsMonth}`} up={stats.newClientsMonth > 0} icon={Users} tone="primary" sparkData={dealsSpark} caption={`Novos contratos fechados`} progress={78} />
          <KpiPremium label="Taxa de Conversão" value={`${stats.conversionRate}%`} delta={stats.conversionRate >= 25 ? "Ótima" : "Revisar"} up={stats.conversionRate >= 25} icon={Target} tone="success" sparkData={dealsSpark} caption={`Leads em clientes`} progress={stats.conversionRate} />
          <KpiPremium label="Ticket Médio" value={formatBRL(stats.avgTicket)} delta={`${stats.monthSalesCount} vendas`} up={stats.monthSalesCount > 0} icon={Receipt} tone="info" sparkData={revSpark} caption="Por transação" progress={65} />
        </section>

        {/* ============ MINI METRIC PILLS ============ */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricPill label="Contratos abertos" value={stats.contractsAwaiting.toString()} tone="primary" icon={FileSignature} href="/contratos" />
          <MetricPill label="Docs pendentes" value={(clientProducts.filter((p: any) => p.status === "aguardando_inicio").length).toString()} tone="warning" icon={FileText} href="/documentos" />
          <MetricPill label="Tarefas em atraso" value={stats.todayTasks.length.toString()} tone="danger" icon={Clock} href="/tarefas" />
          <MetricPill label="Comissões a pagar" value={formatBRL(stats.pendingCommissions)} tone="success" icon={Handshake} href="/comissoes" />
          <MetricPill label="Pipeline ponderado" value={formatBRL(stats.weightedPipeline)} tone="info" icon={Activity} href="/leads" />
          <MetricPill label="Total clientes" value={clients.length.toString()} tone="primary" icon={Users} href="/clientes" />
        </section>

        {/* ============ ROW: REVENUE CHART + ALERTS + CONVERSION GOAL ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Revenue 12m */}
          <Card className="lg:col-span-8 min-h-[400px] flex flex-col p-6">
            <CardHeader
              eyebrow="Inteligência de Negócio"
              title="Fluxo de Receita Mensal × Metas Projetadas"
              right={
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                    <span className="text-slate-600">Receita Real</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full border border-slate-400" />
                    <span className="text-slate-600">Meta Estabelecida</span>
                  </div>
                </div>
              }
            />
            <div className="flex-1 mt-4 -mx-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenue12m} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "currentColor", fontSize: 10, fontWeight: 600 }} 
                    className="text-slate-600"
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "currentColor", fontSize: 10, fontWeight: 500 }}
                    className="text-slate-600"
                    tickFormatter={(v) => `R$ ${v/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' 
                    }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="meta" 
                    stroke="#94a3b8" 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                    fill="transparent" 
                    dot={false}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="receita" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                    dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Right Column: Status & Conversion */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card className="flex-1 p-6">
              <CardHeader
                eyebrow="Urgente"
                title="Centro de Alertas"
                right={<span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-tighter animate-pulse">{stats.alerts.length} Críticos</span>}
              />
              <div className="mt-4 space-y-3">
                {stats.alerts.length > 0 ? stats.alerts.slice(0, 4).map((a) => (
                  <Link key={a.id} to={a.href} className="group flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
                    <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", toneColor[a.tone].bg, toneColor[a.tone].text)}>
                      <a.icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-slate-950 leading-none">{a.title}</h4>
                      <p className="text-[11px] text-slate-800 mt-1.5 truncate">{a.sub}</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </Link>
                )) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                      <CheckCircle2 className="size-8 text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-950">Operação Saudável</p>
                    <p className="text-xs text-slate-800 mt-1">Nenhum risco imediato detectado</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-500">Taxa de Conversão</p>
                <Target className="size-4 text-slate-300" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-3xl font-black text-slate-950 tabular-nums tracking-tighter">
                    {stats.conversionRate}%
                  </h3>
                  <p className="text-[11px] text-slate-800 mt-1">
                    Meta global: <span className="font-bold text-indigo-800">25.0%</span>
                  </p>
                </div>
                <div className="size-16 relative">
                  <ResponsiveContainer>
                    <RadialBarChart innerRadius="70%" outerRadius="100%" data={stats.conversionGoal} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar background={{ fill: "#f1f5f9" }} dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>
        </section>


        {/* ============ ROW: PIPELINE FUNNEL + DEMANDS DONUT + ORIGEM ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-5 min-h-[280px]">
            <CardHeader eyebrow="Comercial" title="Funil de vendas" right={<Link to="/vendas" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Abrir CRM</Link>} />
            <div className="space-y-2 mt-1">
              {stats.pipelineByStage.map((stage, i) => {
                const max = Math.max(...stats.pipelineByStage.map((s) => s.value), 1);
                const pct = (stage.value / max) * 100;
                const tones: Tone[] = ["info", "primary", "success", "warning", "danger"];
                return (
                  <div key={stage.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-700">{stage.name}</span>
                      <span className="text-[10.5px] text-slate-800 tabular-nums">{stage.count} · <span className="text-slate-700 font-semibold">{formatBRL(stage.value)}</span></span>
                    </div>
                    <div className="h-7 rounded-md bg-slate-50 border border-slate-100 overflow-hidden relative">
                      <div
                        className={cn("h-full transition-all duration-1000", toneColor[tones[i]].bg)}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="lg:col-span-4 min-h-[280px] flex flex-col">
            <CardHeader eyebrow="Operação" title="Demandas por status" right={<Link to="/demandas" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Ver todas</Link>} />
            <div className="flex-1 flex items-center gap-4">
              <div className="w-[140px] h-[140px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={stats.demandsByStatus}
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.demandsByStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {stats.demandsByStatus.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] text-slate-700 truncate">{d.name}</span>
                    </div>
                    <span className="text-[11.5px] font-bold text-slate-950 tabular-nums">{d.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <p className="text-[9.5px] uppercase tracking-widest text-slate-800 font-bold">Total</p>
                  <p className="text-lg font-bold text-slate-950 tabular-nums">{stats.demandsByStatus.reduce((a, d) => a + d.value, 0)}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-3 min-h-[280px]">
            <CardHeader eyebrow="Aquisição" title="Origem dos clientes" />
            <div className="space-y-2.5 mt-1">
              {stats.sourceData.length > 0 ? stats.sourceData.map((s, i) => {
                const max = stats.sourceData[0].value;
                const pct = (s.value / max) * 100;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-[10.5px] mb-1">
                      <span className="text-slate-700 capitalize truncate">{s.name.replace(/_/g, " ")}</span>
                      <span className="font-bold text-slate-950 tabular-nums">{s.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-50 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : <Empty label="Sem dados de origem" />}
            </div>
          </Card>
        </section>

        {/* ============ ROW: TABLES — RECENT SALES + URGENT DEMANDS + TASKS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Recent sales table */}
          <Card className="lg:col-span-5">
            <CardHeader eyebrow="Fechamentos" title="Vendas recentes" right={<Link to="/vendas" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Ver tudo</Link>} />
            <div className="overflow-hidden -mx-1">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[9.5px] uppercase tracking-widest text-slate-800 font-bold">
                    <th className="text-left py-2 px-2 font-bold">Cliente</th>
                    <th className="text-left py-2 px-2 font-bold">Data</th>
                    <th className="text-right py-2 px-2 font-bold">Valor</th>
                    <th className="text-right py-2 px-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSales.length > 0 ? stats.recentSales.map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-6 rounded-md bg-gradient-to-br from-indigo-500/15 to-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-700">
                            {s.clientName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-800 font-medium truncate max-w-[120px]">{s.clientName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-800 tabular-nums">
                        {s.sale_date ? new Date(s.sale_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-950 font-semibold tabular-nums">{formatBRL(s.amount)}</td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={cn("text-[9.5px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider", s.status === "pago" ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/25" : "bg-amber-500/10 text-amber-800 border-amber-500/25")}>
                          {s.status || "pendente"}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}><Empty label="Nenhuma venda registrada" /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Urgent demands */}
          <Card className="lg:col-span-4">
            <CardHeader eyebrow="Operação" title="Demandas urgentes" right={<Link to="/demandas" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Gerenciar</Link>} />
            <div className="space-y-1.5">
              {stats.urgentDemands.length > 0 ? stats.urgentDemands.map((d: any) => {
                const overdue = d.deadline && new Date(d.deadline) < new Date();
                const client = clients.find((c: any) => c.id === d.client_id);
                const st = statusLabel[d.status] || { label: d.status, tone: "info" as Tone };
                return (
                  <div key={d.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={cn("size-2 rounded-full shrink-0", overdue ? "bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.6)]" : "bg-zinc-600")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-950 truncate">{client?.full_name || `Demanda #${d.id.slice(0, 6)}`}</p>
                      <p className="text-[9.5px] text-slate-800 truncate">
                        Prazo {d.deadline ? new Date(d.deadline).toLocaleDateString("pt-BR") : "—"} · {formatBRL(d.value || 0)}
                      </p>
                    </div>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider shrink-0", toneColor[st.tone].bg, toneColor[st.tone].text, toneColor[st.tone].border)}>
                      {st.label}
                    </span>
                  </div>
                );
              }) : <Empty label="Nenhuma demanda urgente" />}
            </div>
          </Card>

          {/* Today tasks / reminders */}
          <Card className="lg:col-span-3">
            <CardHeader eyebrow="Hoje" title="Tarefas & lembretes" right={<Link to="/tarefas" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Tudo</Link>} />
            <div className="space-y-1.5">
              {stats.todayTasks.length > 0 ? stats.todayTasks.map((t: any) => {
                const overdue = t.due_date && new Date(t.due_date) < new Date();
                const pTone: Tone = t.priority === "alta" ? "danger" : t.priority === "media" ? "warning" : "info";
                return (
                  <div key={t.id} className="flex items-start gap-2 p-1.5 rounded-md hover:bg-slate-50 transition-colors">
                    <button className="size-4 rounded border border-slate-300 hover:border-indigo-400 hover:bg-indigo-500/10 transition-colors shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[11px] font-medium truncate", overdue ? "text-rose-700" : "text-slate-800")}>{t.title}</p>
                      <p className="text-[9px] text-slate-800 mt-0.5 flex items-center gap-1.5">
                        {t.due_date && <><CalendarClock className="size-2.5" />{new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>}
                        {t.priority && <span className={cn("size-1 rounded-full ml-1", toneColor[pTone].bg.replace("/10", "/60"))} />}
                      </p>
                    </div>
                  </div>
                );
              }) : <Empty label="Nenhuma tarefa pendente" />}
            </div>
          </Card>
        </section>

        {/* ============ ROW: FOLLOW-UPS + TOP CLIENTS + ACTIVITY ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Follow-ups / próximas ações */}
          <Card className="lg:col-span-4">
            <CardHeader eyebrow="Comercial" title="Próximos follow-ups" right={<Link to="/vendas" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Agenda</Link>} />
            <div className="space-y-2">
              {stats.upcomingActions.length > 0 ? stats.upcomingActions.map((l: any) => {
                const d = new Date(l.next_action_date);
                const overdue = d < new Date();
                return (
                  <div key={l.id} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={cn("size-10 rounded-lg flex flex-col items-center justify-center shrink-0 border", overdue ? "bg-rose-500/10 border-rose-500/25" : "bg-indigo-500/10 border-indigo-500/25")}>
                      <span className={cn("text-[8px] font-bold uppercase leading-none", overdue ? "text-rose-800" : "text-indigo-800")}>{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                      <span className="text-[12px] font-bold text-slate-950 leading-none mt-0.5 tabular-nums">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold text-slate-950 truncate">{l.full_name}</p>
                      <p className="text-[10px] text-slate-800 truncate mt-0.5">{l.next_action || "Follow-up agendado"} · {l.company || "—"}</p>
                      {l.estimated_value > 0 && (
                        <p className="text-[10px] text-emerald-800 font-medium tabular-nums mt-0.5">{formatBRL(l.estimated_value)} · {l.close_probability}% prob.</p>
                      )}
                    </div>
                    <button className="size-7 rounded-md bg-slate-50 hover:bg-indigo-500/20 border border-slate-200 flex items-center justify-center text-slate-800 hover:text-indigo-800 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                      <Phone className="size-3" />
                    </button>
                  </div>
                );
              }) : <Empty label="Sem follow-ups agendados" />}
            </div>
          </Card>

          {/* Top clients */}
          <Card className="lg:col-span-4">
            <CardHeader eyebrow="Carteira" title="Top clientes por valor" right={<Link to="/clientes" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Carteira</Link>} />
            <div className="space-y-1.5">
              {stats.topClients.length > 0 ? stats.topClients.map((c: any, i: number) => (
                <Link to={`/clientes/${c.id}`} key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-[10px] font-bold text-slate-600 tabular-nums w-4">{(i + 1).toString().padStart(2, "0")}</span>
                  <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500/15 to-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                    {c.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-950 truncate">{c.full_name}</p>
                    <p className="text-[9.5px] text-slate-800 truncate">Engajamento {c.health_score ?? "—"}/100 · {c.status}</p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 tabular-nums">{formatBRL(c._value)}</span>
                </Link>
              )) : <Empty label="Sem clientes com valor" />}
            </div>
          </Card>

          {/* Activity feed */}
          <Card className="lg:col-span-4">
            <CardHeader eyebrow="Auditoria" title="Fluxo recente" right={<Link to="/auditoria" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Histórico</Link>} />
            <div className="relative mt-2">
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentActivity.map((act, idx) => (
                    <div key={act.id} className="group relative pl-8 pb-4 last:pb-0">
                      {/* Timeline Line */}
                      {idx !== stats.recentActivity.length - 1 && (
                        <div className="absolute left-[11px] top-7 bottom-0 w-px bg-slate-100 group-hover:bg-indigo-100 transition-colors" />
                      )}
                      
                      {/* Icon / Marker */}
                      <div className={cn(
                        "absolute left-0 top-1 size-[22px] rounded-lg flex items-center justify-center border shadow-sm transition-all group-hover:scale-110",
                        toneColor[act.tone].bg, toneColor[act.tone].border, toneColor[act.tone].text
                      )}>
                        <act.icon className="size-3" strokeWidth={2.5} />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11.5px] font-bold text-slate-950 leading-tight">{act.title}</p>
                          <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 tabular-nums">
                            {new Date(act.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {new Date(act.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-600 line-clamp-1 group-hover:text-slate-900 transition-colors">{act.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty label="Sem atividade no período selecionado" />}
            </div>
          </Card>
        </section>

        {/* ============ ROW: FINANCIAL SUMMARY + TOP PARTNERS + QUICK ACTIONS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Financial summary */}
          <Card className="lg:col-span-5">
            <CardHeader eyebrow="Financeiro" title="Resumo financeiro" right={<Link to="/financeiro" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Central</Link>} />
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric icon={PiggyBank} label="A receber 7 dias" value={formatBRL(stats.upcomingAmount)} sub={`${stats.upcomingPayments.length} título(s)`} tone="success" />
              <MiniMetric icon={FileWarning} label="Inadimplente" value={formatBRL(stats.overdueAmount)} sub={`${stats.overduePayments.length} título(s)`} tone="danger" />
              <MiniMetric icon={Handshake} label="Comissões a pagar" value={formatBRL(stats.pendingCommissions)} sub="Aguardando liberação" tone="primary" />
              <MiniMetric icon={FileSignature} label="Contratos pendentes" value={stats.contractsAwaiting.toString()} sub="Aguardando assinatura" tone="warning" />
            </div>
          </Card>

          {/* Top partners */}
          <Card className="lg:col-span-4">
            <CardHeader eyebrow="Parcerias" title="Top parceiros por comissão" right={<Link to="/parceiros" className="text-[10px] font-bold text-indigo-800 hover:text-indigo-700 uppercase tracking-wider">Rede</Link>} />
            <div className="space-y-2">
              {stats.topPartners.length > 0 ? stats.topPartners.map((p, i) => {
                const max = stats.topPartners[0].amount;
                const pct = (p.amount / max) * 100;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-bold text-slate-600 tabular-nums w-3">{i + 1}</span>
                        <span className="text-slate-800 font-medium truncate">{p.name}</span>
                      </div>
                      <span className="text-emerald-800 font-bold tabular-nums">{formatBRL(p.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-50">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : <Empty label="Sem comissões registradas" />}
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="lg:col-span-3">
            <CardHeader eyebrow="Atalhos" title="Ações rápidas" />
            <div className="grid grid-cols-2 gap-2">
              <QuickAction to="/leads?new=1" icon={UserPlus} label="Novo lead" />
              <QuickAction to="/vendas?new=1" icon={CircleDollarSign} label="Venda" />
              <QuickAction to="/propostas?new=1" icon={FileText} label="Proposta" />
              <QuickAction to="/contratos?new=1" icon={FileSignature} label="Contrato" />
              <QuickAction to="/tarefas?new=1" icon={ClipboardList} label="Tarefa" />
              <QuickAction to="/templates" icon={MessageSquare} label="Templates" />
            </div>
          </Card>
        </section>

        <div className="pt-2 flex items-center justify-center gap-2 text-[9px] tracking-[0.3em] uppercase text-slate-600">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-300" />
          Prosper CRM · {new Date().getFullYear()}
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-300" />
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: "10px",
  fontSize: "11px",
  color: "#0f172a",
  boxShadow: "0 10px 40px rgba(15,23,42,0.12)",
};

/* ============ Components ============ */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm", className)}>
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      {children}
    </div>
  );
}

function CardHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
      <div>
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground">{eyebrow}</p>
        <h3 className="text-[13.5px] font-semibold text-foreground mt-0.5 tracking-tight">{title}</h3>
      </div>
      {right}
    </div>
  );
}

function KpiPremium({ label, value, delta, up, icon: Icon, tone, sparkData, caption, progress }: {
  label: string; value: string; delta: string; up: boolean; icon: any; tone: Tone;
  sparkData: Array<{ v: number }>; caption: string; progress: number;
}) {
  const t = toneColor[tone];
  return (
    <div className={cn(
      "group relative p-5 rounded-lg border transition-all duration-300",
      "bg-card hover:shadow-md",
      t.border,
      t.soft,
      "overflow-hidden"
    )}>
      <div className="absolute bottom-0 right-0 w-3/4 h-24 opacity-5 group-hover:opacity-15 transition-all duration-700 translate-y-4 group-hover:translate-y-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <Area type="monotone" dataKey="v" stroke={t.chart} fill={t.chart} strokeWidth={4} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="relative flex items-start justify-between mb-6">
        <div className={cn("p-4 rounded-2xl shadow-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", t.bg, t.text)}>
          <Icon className="size-6" />
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full border shadow-sm backdrop-blur-md",
          up 
            ? "text-emerald-800 bg-emerald-50 border-emerald-100" 
            : "text-rose-800 bg-rose-50 border-rose-100"
        )}>
          {up ? <ArrowUpRight className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {delta}
        </div>
      </div>
      <div className="relative space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">{label}</p>
        <h3 className="text-3xl lg:text-4xl font-black text-slate-950 tracking-tighter leading-none tabular-nums">{value}</h3>
        <p className="text-[11px] font-bold text-slate-600 tracking-tight">{caption}</p>
      </div>
      <div className="relative mt-8 pt-5 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Índice de Crescimento</span>
          <span className="text-[11px] font-black text-slate-950">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", t.grad)} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, tone, icon: Icon, href, pulse }: { label: string; value: string; tone: Tone; icon: any; href: string; pulse?: boolean }) {
  const t = toneColor[tone];
  return (
    <Link to={href} className={cn(
      "group relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
      "bg-card shadow-sm hover:shadow-md",
      t.border, "hover:bg-slate-50"
    )}>
      <div className={cn(
        "size-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:shadow-sm",
        t.bg, t.text
      )}>
        <Icon className={cn("size-6", pulse && "animate-pulse")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 truncate">{label}</p>
        <p className="text-xl font-black text-slate-950 tracking-tighter truncate tabular-nums">{value}</p>
      </div>
      <ChevronRight className="size-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
      {pulse && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
          </span>
        </div>
      )}
    </Link>
  );
}

function Kpi({ label, value, delta, up, icon: Icon, tone }: {
  label: string; value: string; delta: string; up: boolean; icon: any; tone: Tone;
}) {
  const t = toneColor[tone];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition-all shadow-sm">
      <div className={cn("absolute -top-6 -right-6 size-16 rounded-full blur-2xl opacity-40", t.bg)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className={cn("size-7 rounded-lg flex items-center justify-center border", t.bg, t.border, t.text)}>
            <Icon className="size-3.5" strokeWidth={2} />
          </div>
          <div className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8.5px] font-bold border tabular-nums", up ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200")}>
            {up ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {delta}
          </div>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-800 leading-tight">{label}</p>
        <p className="text-[16px] lg:text-[18px] font-bold text-slate-950 tabular-nums tracking-tight mt-0.5 leading-none">{value}</p>
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: string; sub: string; tone: Tone;
}) {
  const t = toneColor[tone];
  return (
    <div className={cn("p-3 rounded-xl bg-slate-50 border", t.border)}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("size-6 rounded-md flex items-center justify-center", t.bg, t.text)}>
          <Icon className="size-3" />
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-800">{label}</p>
      </div>
      <p className="text-[16px] font-bold text-slate-950 tabular-nums leading-none">{value}</p>
      <p className="text-[9.5px] text-slate-800 mt-1">{sub}</p>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="group flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all">
      <Icon className="size-4 text-slate-800 group-hover:text-indigo-800 transition-colors" />
      <span className="text-[10px] font-semibold text-slate-700 group-hover:text-indigo-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function Legend2({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-800">
      <span className={cn("inline-block w-3 h-0.5 rounded", dashed && "border-t border-dashed bg-transparent")} style={{ backgroundColor: dashed ? "transparent" : color, borderColor: dashed ? color : "transparent" }} />
      {label}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-8 text-center">
      <CheckCircle2 className="size-7 mx-auto text-slate-300 mb-2" />
      <p className="text-[10.5px] text-slate-800 italic">{label}</p>
    </div>
  );
}
