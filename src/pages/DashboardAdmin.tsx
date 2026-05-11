import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Wallet, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature, Target, Handshake, Briefcase,
  BarChart3, Plus, Bell, ArrowUpRight, ArrowRight, AlertCircle, Phone, MapPin, CalendarClock,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
} from "recharts";

/* ============================================================
   Premium Executive Dashboard
   ============================================================ */

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<Tone, { bg: string; fg: string; ring: string; bar: string }> = {
  primary: { bg: "bg-primary/8", fg: "text-primary", ring: "ring-primary/15", bar: "bg-primary" },
  success: { bg: "bg-success-muted", fg: "text-success", ring: "ring-success/20", bar: "bg-success" },
  warning: { bg: "bg-warning-muted", fg: "text-warning", ring: "ring-warning/20", bar: "bg-warning" },
  danger:  { bg: "bg-destructive-muted", fg: "text-destructive", ring: "ring-destructive/20", bar: "bg-destructive" },
  info:    { bg: "bg-info-muted", fg: "text-info", ring: "ring-info/20", bar: "bg-info" },
  neutral: { bg: "bg-muted", fg: "text-foreground", ring: "ring-border", bar: "bg-foreground/40" },
};

export default function DashboardAdmin() {
  const { user } = useAuth();
  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  // ===== Queries =====
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, status, source, origin, created_at, health_score")).data ?? [],
  });
  const { data: clientProducts = [], isLoading: loadingDemands } = useQuery({
    queryKey: ["dash-demands"],
    queryFn: async () => (await supabase.from("client_products").select("id, status, deadline, service_provider_id, product_id, value, created_at")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => (await supabase.from("sales").select("amount, sale_date, status, product_id, partner_id")).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["dash-leads"],
    queryFn: async () => (await supabase.from("leads").select("id, full_name, company, status, estimated_value, close_probability, next_action, next_action_date, source, created_at, converted_to_client_id").order("next_action_date", { ascending: true, nullsFirst: false }).limit(120)).data ?? [],
  });
  const { data: proposals = [] } = useQuery({
    queryKey: ["dash-proposals"],
    queryFn: async () => (await supabase.from("proposals").select("id, status, total, created_at, sent_at, approved_at, valid_until")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => (await supabase.from("payments").select("amount, status, due_date")).data ?? [],
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["dash-commissions"],
    queryFn: async () => (await supabase.from("commissions").select("amount, status, partner_id, partner:partners(full_name)")).data ?? [],
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["dash-documents"],
    queryFn: async () => (await supabase.from("documents").select("id, status, name, created_at, client_id").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["dash-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, status, client_id")).data ?? [],
  });
  const { data: dashTasks = [] } = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () =>
      (await supabase
        .from("tasks")
        .select("id, title, due_date, priority, status_new, assigned_to, created_at")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(60)
      ).data ?? [],
  });

  // ===== Stats =====
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = new Date(thisYear, thisMonth - 1, 1);

    const monthRevenue = sales
      .filter((s: any) => {
        if (!s.sale_date) return false;
        const d = new Date(s.sale_date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);

    const lastMonthRevenue = sales
      .filter((s: any) => {
        if (!s.sale_date) return false;
        const d = new Date(s.sale_date);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      })
      .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);

    const revenueDelta = lastMonthRevenue > 0
      ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : null;

    const activeClients = clients.filter((c: any) => c.status === "ativo").length;
    const totalClients = clients.length;

    const inProgress = clientProducts.filter((p: any) => p.status === "em_andamento").length;
    const delayed = clientProducts.filter((p: any) =>
      p.status === "atrasado" ||
      (p.deadline && new Date(p.deadline) < now && !["concluido", "cancelado"].includes(p.status))
    ).length;

    const docsPending = documents.filter((d: any) => ["solicitado", "enviado", "em_analise"].includes(d.status)).length;
    const commissionsToPay = commissions.filter((c: any) => c.status === "pendente")
      .reduce((acc, c: any) => acc + Number(c.amount || 0), 0);
    const overduePayments = payments.filter((p: any) =>
      p.status === "vencido" ||
      (["em_aberto", "pendente", "parcial"].includes(p.status) && p.due_date && new Date(p.due_date) < now)
    );
    const overdueAmount = overduePayments.reduce((a, p: any) => a + Number(p.amount || 0), 0);

    // ===== Pipeline & Negociações =====
    const LOST_STATUSES = ["perdido", "lost", "descartado", "cancelado"];
    const WON_STATUSES = ["ganho", "won", "convertido", "fechado"];
    const activeLeads = leads.filter((l: any) =>
      !LOST_STATUSES.includes(String(l.status || "").toLowerCase()) &&
      !WON_STATUSES.includes(String(l.status || "").toLowerCase()) &&
      !l.converted_to_client_id
    );
    const pipelineValue = activeLeads.reduce((a, l: any) => a + Number(l.estimated_value || 0), 0);
    const weightedPipeline = activeLeads.reduce(
      (a, l: any) => a + (Number(l.estimated_value || 0) * (Number(l.close_probability || 0) / 100)),
      0
    );

    const wonLeads = leads.filter((l: any) =>
      WON_STATUSES.includes(String(l.status || "").toLowerCase()) || l.converted_to_client_id
    );
    const lostLeads = leads.filter((l: any) => LOST_STATUSES.includes(String(l.status || "").toLowerCase()));
    const closedDeals = wonLeads.length + lostLeads.length;
    const winRate = closedDeals > 0 ? (wonLeads.length / closedDeals) * 100 : null;

    const closedSales = sales.filter((s: any) => Number(s.amount || 0) > 0);
    const avgTicket = closedSales.length > 0
      ? closedSales.reduce((a, s: any) => a + Number(s.amount || 0), 0) / closedSales.length
      : 0;

    // Proposals
    const proposalsSentMonth = proposals.filter((p: any) => {
      const d = p.sent_at ? new Date(p.sent_at) : null;
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const proposalsOpen = proposals.filter((p: any) =>
      ["enviada", "enviado", "visualizada", "em_analise", "em_negociacao", "pending", "sent"].includes(String(p.status || "").toLowerCase())
    );
    const proposalsOpenValue = proposalsOpen.reduce((a, p: any) => a + Number(p.total || 0), 0);

    // Reuniões / próximas ações do funil
    const upcomingActions = activeLeads
      .filter((l: any) => l.next_action_date)
      .map((l: any) => {
        const d = new Date(l.next_action_date);
        const daysLeft = Math.floor((d.getTime() - now.getTime()) / 86400000);
        return { ...l, daysLeft };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 7);

    const thisWeekMeetings = activeLeads.filter((l: any) => {
      if (!l.next_action_date) return false;
      const d = new Date(l.next_action_date);
      const diff = Math.floor((d.getTime() - now.getTime()) / 86400000);
      return diff >= 0 && diff <= 7;
    }).length;

    const newClientsMonth = clients.filter((c: any) => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const revenue6m = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(thisYear, thisMonth - (5 - i), 1);
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const total = sales
        .filter((s: any) => s.sale_date && new Date(s.sale_date).getMonth() === d.getMonth() && new Date(s.sale_date).getFullYear() === d.getFullYear())
        .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);
      return { name: label, value: total };
    });

    // Funil de vendas — agrupa leads por status
    const FUNNEL_ORDER = ["novo", "contato", "qualificado", "reuniao", "proposta", "negociacao", "ganho"];
    const funnelMap: Record<string, number> = {};
    leads.forEach((l: any) => {
      const k = String(l.status || "indefinido").toLowerCase();
      if (LOST_STATUSES.includes(k)) return;
      funnelMap[k] = (funnelMap[k] || 0) + 1;
    });
    const funnelData = Object.entries(funnelMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const ai = FUNNEL_ORDER.indexOf(a.name);
        const bi = FUNNEL_ORDER.indexOf(b.name);
        if (ai === -1 && bi === -1) return b.value - a.value;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

    const alerts: Array<{ id: string; title: string; sub: string; tone: Tone; link: string; icon: any }> = [];
    const contractsAwaiting = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    if (contractsAwaiting > 0) alerts.push({ id: "contracts", title: `${contractsAwaiting} contratos para assinar`, sub: "Aguardando assinatura do cliente", tone: "warning", link: "/contratos", icon: FileSignature });
    const proposalsExpiringSoon = proposals.filter((p: any) => {
      if (!p.valid_until || ["aprovada", "rejeitada", "convertida"].includes(String(p.status || "").toLowerCase())) return false;
      const d = new Date(p.valid_until);
      const days = Math.floor((d.getTime() - now.getTime()) / 86400000);
      return days >= 0 && days <= 5;
    }).length;
    if (proposalsExpiringSoon > 0) alerts.push({ id: "prop-exp", title: `${proposalsExpiringSoon} propostas expirando`, sub: "Validade < 5 dias", tone: "warning", link: "/propostas", icon: FileWarning });
    const staleLeads = activeLeads.filter((l: any) => {
      if (!l.next_action_date) return false;
      return new Date(l.next_action_date) < now;
    }).length;
    if (staleLeads > 0) alerts.push({ id: "stale", title: `${staleLeads} negociações sem follow-up`, sub: "Próxima ação vencida", tone: "danger", link: "/leads", icon: CalendarClock });
    if (delayed > 0) alerts.push({ id: "delayed", title: `${delayed} entregas atrasadas`, sub: "Pós-venda em risco", tone: "danger", link: "/demandas", icon: Clock });
    if (overduePayments.length > 0) alerts.push({ id: "overdue", title: `${overduePayments.length} pagamentos vencidos`, sub: formatBRL(overdueAmount) + " em atraso", tone: "danger", link: "/financeiro", icon: CreditCard });
    if (docsPending > 0) alerts.push({ id: "docs", title: `${docsPending} documentos pendentes`, sub: "Aguardando análise", tone: "info", link: "/documentos", icon: FileWarning });

    const urgentDemands = clientProducts
      .filter((p: any) => !["concluido", "cancelado"].includes(p.status))
      .map((p: any) => {
        const dl = p.deadline ? new Date(p.deadline) : null;
        const daysLeft = dl ? Math.floor((dl.getTime() - now.getTime()) / 86400000) : 999;
        return { ...p, daysLeft };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 6);

    const activity = [
      ...proposals.slice(0, 5).map((p: any) => ({
        id: `prop-${p.id}`, type: "Proposta", title: `${String(p.status || "rascunho").replace(/_/g, " ")} · ${formatBRL(Number(p.total || 0))}`, at: p.sent_at || p.created_at, icon: FileWarning, tone: "info" as Tone,
      })),
      ...leads.slice(0, 5).map((l: any) => ({
        id: `lead-${l.id}`, type: "Negociação", title: `${l.full_name || "Lead"}${l.company ? " · " + l.company : ""}`, at: l.created_at, icon: Target, tone: "primary" as Tone,
      })),
    ]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 8);

    const tasksOverdue = dashTasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && !["concluida", "cancelada"].includes(t.status_new));
    const tasksUrgent = dashTasks.filter((t: any) => t.priority === "urgente" && !["concluida", "cancelada"].includes(t.status_new));

    return {
      kpis: [
        { label: "Receita fechada (mês)", value: formatBRL(monthRevenue), delta: revenueDelta, icon: CircleDollarSign, tone: "primary" as Tone, hint: "vs. mês anterior" },
        { label: "Pipeline ponderado", value: formatBRL(weightedPipeline), delta: null, icon: Target, tone: "info" as Tone, hint: `${formatBRL(pipelineValue)} bruto` },
        { label: "Ticket médio", value: avgTicket > 0 ? formatBRL(avgTicket) : "—", delta: null, icon: Wallet, tone: "success" as Tone, hint: `${closedSales.length} fechamentos` },
        { label: "Taxa de conversão", value: winRate != null ? winRate.toFixed(1) + "%" : "—", delta: null, icon: TrendingUp, tone: (winRate != null && winRate >= 30 ? "success" : winRate != null && winRate >= 15 ? "warning" : "danger") as Tone, hint: `${wonLeads.length} ganhos / ${closedDeals} fechados` },
        { label: "Negociações ativas", value: String(activeLeads.length), delta: null, icon: Handshake, tone: "primary" as Tone, hint: `${thisWeekMeetings} reuniões nesta semana` },
        { label: "Propostas em aberto", value: String(proposalsOpen.length), delta: null, icon: FileSignature, tone: "warning" as Tone, hint: formatBRL(proposalsOpenValue) },
        { label: "Carteira ativa", value: String(activeClients), delta: null, icon: Users, tone: "info" as Tone, hint: `${newClientsMonth} novos este mês · ${totalClients} total` },
        { label: "Pagamentos vencidos", value: formatBRL(overdueAmount), delta: null, icon: CreditCard, tone: "danger" as Tone, hint: `${overduePayments.length} cobranças` },
      ],
      revenue6m,
      funnelData,
      alerts,
      urgentDemands,
      upcomingActions,
      activity,
      tasksOverdue,
      tasksUrgent,
      monthRevenue,
      proposalsSentMonth,
      commissionsToPay,
    };
  }, [clients, clientProducts, sales, payments, commissions, documents, contracts, dashTasks, leads, proposals]);

  const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];

  const isLoading = loadingClients || loadingDemands;

  const todaysRevenue = sales
    .filter((s: any) => s.sale_date && new Date(s.sale_date).toDateString() === new Date().toDateString())
    .reduce((a, s: any) => a + Number(s.amount || 0), 0);

  return (
    <div className="px-5 lg:px-8 py-6 lg:py-8 space-y-6 animate-fade-up max-w-[1640px] mx-auto">
      {/* === EXECUTIVE HEADER === */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Ao vivo</span>
            </span>
            <span className="text-[11px] text-white/40 capitalize tabular-nums">{today}</span>
          </div>
          <h1 className="font-display text-[26px] lg:text-[30px] font-semibold tracking-tight text-white leading-tight">
            {greeting}, <span className="capitalize">{firstName}</span>.
          </h1>
          <p className="text-[13px] text-white/50 max-w-xl">
            Pipeline ponderado · {stats.upcomingActions.length} follow-ups na fila · {stats.alerts.length} alertas ativos
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            to="/leads?new=1"
            className="h-10 px-3.5 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors text-[12.5px] font-semibold text-white/85"
          >
            <Target className="size-3.5 text-white/55" /> Nova negociação
          </Link>
          <Link
            to="/propostas?new=1"
            className="h-10 px-3.5 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors text-[12.5px] font-semibold text-white/85"
          >
            <FileSignature className="size-3.5 text-white/55" /> Nova proposta
          </Link>
          <Link
            to="/vendas?new=1"
            className="h-10 px-4 inline-flex items-center gap-2 rounded-lg text-[12.5px] font-semibold text-white transition-all bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_4px_20px_-6px_rgba(129,140,248,0.6)]"
          >
            <Handshake className="size-3.5" strokeWidth={2.5} /> Registrar fechamento
          </Link>
        </div>
      </header>

      {/* === KPI STRIP === */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <Skeleton className="h-3 w-2/3 bg-white/5" />
                <Skeleton className="h-7 w-1/2 bg-white/5" />
                <Skeleton className="h-3 w-3/4 bg-white/5" />
              </div>
            ))
          : stats.kpis.slice(0, 8).map((kpi, i) => <KpiCard key={i} {...kpi} />)}
      </section>

      {/* === MAIN GRID: Chart + Alerts === */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <TrendingUp className="size-3.5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Receita fechada</h3>
                <p className="text-[11px] text-white/45">Fechamentos dos últimos 6 meses</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Este mês</p>
              <p className="text-[15px] font-bold text-white tabular-nums">{formatBRL(stats.monthRevenue)}</p>
            </div>
          </div>
          <div className="h-[280px] p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue6m} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(250 90% 70%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(250 90% 70%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 100% / 0.06)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(0 0% 100% / 0.45)" }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(0 0% 100% / 0.45)" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid hsl(0 0% 100% / 0.1)", background: "hsl(240 30% 8%)", fontSize: 12, color: "white" }}
                  formatter={(v: any) => formatBRL(Number(v))}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(250 90% 75%)" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts */}
        <div className="rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <Bell className="size-3.5 text-rose-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Alertas críticos</h3>
                <p className="text-[11px] text-white/45">Atenção imediata</p>
              </div>
            </div>
            <span className="text-[10px] font-bold tabular-nums px-2 h-5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25 flex items-center">{stats.alerts.length}</span>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto max-h-[300px] flex-1">
            {stats.alerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Tudo em dia" subtitle="Sem alertas no momento" />
            ) : (
              stats.alerts.map((a) => {
                const toneBg: Record<Tone, string> = { primary: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25", success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", warning: "bg-amber-500/15 text-amber-300 border-amber-500/25", danger: "bg-rose-500/15 text-rose-300 border-rose-500/25", info: "bg-sky-500/15 text-sky-300 border-sky-500/25", neutral: "bg-white/[0.04] text-white/60 border-white/[0.08]" };
                return (
                  <Link
                    key={a.id}
                    to={a.link}
                    className="group flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0 border", toneBg[a.tone])}>
                      <a.icon className="size-3.5" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-white truncate">{a.title}</p>
                      <p className="text-[11px] text-white/45 truncate">{a.sub}</p>
                    </div>
                    <ArrowUpRight className="size-3.5 text-white/30 group-hover:text-white/70 transition-colors shrink-0" />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* === FOLLOW-UPS + FUNIL === */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <CalendarClock className="size-3.5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Próximas reuniões & follow-ups</h3>
                <p className="text-[11px] text-white/45">Negociações com ação programada</p>
              </div>
            </div>
            <Link to="/leads" className="text-[11.5px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1">
              Ver pipeline <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 border-b border-white/[0.05]">
                  <th className="text-left px-5 py-2.5 font-bold">Negociação</th>
                  <th className="text-left px-5 py-2.5 font-bold">Próxima ação</th>
                  <th className="text-right px-5 py-2.5 font-bold">Valor</th>
                  <th className="text-right px-5 py-2.5 font-bold">Quando</th>
                </tr>
              </thead>
              <tbody>
                {stats.upcomingActions.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-white/40 text-[12.5px]">Nenhuma ação agendada. <Link to="/leads" className="text-indigo-300 hover:underline">Programar follow-up →</Link></td></tr>
                ) : (
                  stats.upcomingActions.map((l: any) => {
                    const tone: Tone = l.daysLeft < 0 ? "danger" : l.daysLeft === 0 ? "warning" : l.daysLeft <= 3 ? "info" : "neutral";
                    const toneText: Record<Tone, string> = { danger: "text-rose-300", warning: "text-amber-300", info: "text-sky-300", success: "text-emerald-300", primary: "text-indigo-300", neutral: "text-white/55" };
                    const value = Number(l.estimated_value || 0);
                    const prob = Number(l.close_probability || 0);
                    return (
                      <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors last:border-0">
                        <td className="px-5 py-3">
                          <Link to={`/leads/${l.id}`} className="block min-w-0 max-w-[260px]">
                            <p className="text-[12.5px] font-semibold text-white truncate hover:text-indigo-300 transition-colors">{l.full_name || "Lead"}</p>
                            <p className="text-[11px] text-white/45 truncate">{l.company || "—"}</p>
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[12px] text-white/85 truncate max-w-[240px]">{l.next_action || "Follow-up"}</p>
                          {prob > 0 && (
                            <p className="text-[10.5px] text-white/45 mt-0.5">Prob. {prob}%</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-[12.5px] font-semibold tabular-nums text-white">{value > 0 ? formatBRL(value) : "—"}</p>
                        </td>
                        <td className={cn("px-5 py-3 text-right text-[12.5px] font-semibold tabular-nums", toneText[tone])}>
                          {l.daysLeft < 0 ? `${Math.abs(l.daysLeft)}d em atraso` : l.daysLeft === 0 ? "Hoje" : l.daysLeft === 1 ? "Amanhã" : `em ${l.daysLeft}d`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Funil de vendas */}
        <div className="rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[0.05]">
            <div className="size-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Target className="size-3.5 text-violet-300" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white tracking-tight">Funil de vendas</h3>
              <p className="text-[11px] text-white/45">Negociações por estágio</p>
            </div>
          </div>
          <div className="p-4">
            {stats.funnelData.length === 0 ? (
              <EmptyState icon={Target} title="Sem negociações" subtitle="Cadastre seu primeiro lead" />
            ) : (
              <div className="space-y-2.5">
                {(() => {
                  const max = Math.max(...stats.funnelData.map((s: any) => s.value), 1);
                  return stats.funnelData.map((s: any, i: number) => {
                    const pct = (s.value / max) * 100;
                    return (
                      <div key={s.name} className="space-y-1">
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="capitalize text-white/75 font-medium truncate">{s.name.replace(/_/g, " ")}</span>
                          <span className="font-bold tabular-nums text-white">{s.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                            style={{ width: `${pct}%`, opacity: 0.4 + (i / stats.funnelData.length) * 0.6 }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === ENTREGAS PÓS-VENDA === */}
      {stats.urgentDemands.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Briefcase className="size-3.5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Entregas pós-venda em risco</h3>
                <p className="text-[11px] text-white/45">Demandas próximas do prazo ou atrasadas</p>
              </div>
            </div>
            <Link to="/demandas" className="text-[11.5px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1">
              Ver todas <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04]">
            {stats.urgentDemands.map((d: any) => {
              const tone: Tone = d.daysLeft < 0 ? "danger" : d.daysLeft <= 3 ? "warning" : "info";
              const toneText: Record<Tone, string> = { danger: "text-rose-300", warning: "text-amber-300", info: "text-sky-300", success: "text-emerald-300", primary: "text-indigo-300", neutral: "text-white/55" };
              return (
                <Link key={d.id} to={`/demandas/${d.id}`} className="bg-[hsl(240_30%_7%)] hover:bg-white/[0.02] transition-colors p-4 flex items-center justify-between gap-3 group">
                  <div className="min-w-0">
                    <p className="text-[12px] font-mono font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">#{String(d.id).slice(0, 8)}</p>
                    <p className="text-[11px] text-white/45 capitalize truncate">{String(d.status || "").replace(/_/g, " ")}</p>
                  </div>
                  <span className={cn("text-[12px] font-semibold tabular-nums shrink-0", toneText[tone])}>
                    {d.deadline ? (d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d atraso` : d.daysLeft === 0 ? "Hoje" : `${d.daysLeft}d`) : "—"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* === ACTIVITY + TASKS === */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[0.05]">
            <div className="size-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <Activity className="size-3.5 text-indigo-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold text-white tracking-tight">Atividade recente</h3>
              <p className="text-[11px] text-white/45">Eventos das últimas horas</p>
            </div>
          </div>
          <div className="p-3 space-y-0.5">
            {stats.activity.length === 0 ? (
              <EmptyState icon={Activity} title="Sem atividade recente" />
            ) : (
              stats.activity.map((a) => {
                const toneBg: Record<Tone, string> = { primary: "bg-indigo-500/15 text-indigo-300", success: "bg-emerald-500/15 text-emerald-300", warning: "bg-amber-500/15 text-amber-300", danger: "bg-rose-500/15 text-rose-300", info: "bg-sky-500/15 text-sky-300", neutral: "bg-white/[0.04] text-white/60" };
                return (
                  <div key={a.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0", toneBg[a.tone])}>
                      <a.icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-white truncate capitalize">{String(a.title).replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">{a.type}</p>
                    </div>
                    <span className="text-[10.5px] text-white/40 tabular-nums shrink-0">
                      {a.at ? new Date(a.at).toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <AlertCircle className="size-3.5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Próximas ações</h3>
                <p className="text-[11px] text-white/45">Vencidas e urgentes</p>
              </div>
            </div>
            <Link to="/tarefas" className="text-[11.5px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1">
              Ver todas <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="p-3 space-y-0.5">
            {[...stats.tasksOverdue, ...stats.tasksUrgent].slice(0, 7).length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Sem ações pendentes" subtitle="Você está em dia" />
            ) : (
              [...stats.tasksOverdue.map((t: any) => ({ ...t, _tone: "danger" as Tone })),
               ...stats.tasksUrgent.filter((t: any) => !stats.tasksOverdue.find((o: any) => o.id === t.id))
                                  .map((t: any) => ({ ...t, _tone: "warning" as Tone }))]
                .slice(0, 7)
                .map((t: any) => {
                  const bar: Record<Tone, string> = { danger: "bg-rose-400", warning: "bg-amber-400", info: "bg-sky-400", success: "bg-emerald-400", primary: "bg-indigo-400", neutral: "bg-white/40" };
                  return (
                    <Link key={t.id} to="/tarefas" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <span className={cn("size-1.5 rounded-full shrink-0", bar[t._tone as Tone])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-white truncate">{t.title}</p>
                        <p className="text-[10.5px] text-white/40 tabular-nums">
                          {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "Sem prazo"} · <span className="capitalize">{t.priority}</span>
                        </p>
                      </div>
                      <ArrowRight className="size-3.5 text-white/30 shrink-0" />
                    </Link>
                  );
                })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h2>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, tone, hint, delta,
}: {
  label: string; value: string; icon: any; tone: Tone; hint?: string; delta?: number | null;
}) {
  const toneAccent: Record<Tone, { bar: string; iconBg: string; iconFg: string }> = {
    primary: { bar: "bg-indigo-400", iconBg: "bg-indigo-500/15 border-indigo-500/25", iconFg: "text-indigo-300" },
    success: { bar: "bg-emerald-400", iconBg: "bg-emerald-500/15 border-emerald-500/25", iconFg: "text-emerald-300" },
    warning: { bar: "bg-amber-400", iconBg: "bg-amber-500/15 border-amber-500/25", iconFg: "text-amber-300" },
    danger:  { bar: "bg-rose-400", iconBg: "bg-rose-500/15 border-rose-500/25", iconFg: "text-rose-300" },
    info:    { bar: "bg-sky-400", iconBg: "bg-sky-500/15 border-sky-500/25", iconFg: "text-sky-300" },
    neutral: { bar: "bg-white/40", iconBg: "bg-white/[0.05] border-white/[0.08]", iconFg: "text-white/60" },
  };
  const acc = toneAccent[tone];
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.55)] backdrop-blur-xl p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[hsl(240_30%_8%_/_0.7)] overflow-hidden">
      <span className={cn("absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity", acc.bar)} />
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 truncate pr-2">{label}</p>
        <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0 border", acc.iconBg, acc.iconFg)}>
          <Icon className="size-3.5" strokeWidth={2.2} />
        </div>
      </div>
      <p className="font-display text-[24px] lg:text-[26px] font-bold tracking-tight text-white tabular-nums leading-none truncate">{value}</p>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] min-h-[16px]">
        {delta != null ? (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-semibold tabular-nums px-1.5 py-0.5 rounded text-[10.5px]",
            positive && "text-emerald-300 bg-emerald-500/10",
            negative && "text-rose-300 bg-rose-500/10",
            !positive && !negative && "text-white/40 bg-white/[0.04]"
          )}>
            {positive ? <TrendingUp className="size-2.5" /> : negative ? <TrendingDown className="size-2.5" /> : null}
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
          </span>
        ) : null}
        {hint && <span className="text-white/40 truncate">{hint}</span>}
      </div>
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent: "indigo" | "rose" | "amber" | "emerald" | "slate" }) {
  const accentMap: Record<string, string> = {
    indigo: "from-indigo-400 to-purple-400 shadow-indigo-500/30",
    rose: "from-rose-400 to-pink-400 shadow-rose-500/30",
    amber: "from-amber-300 to-orange-400 shadow-amber-500/30",
    emerald: "from-emerald-300 to-teal-400 shadow-emerald-500/30",
    slate: "from-white/60 to-white/40 shadow-white/10",
  };
  return (
    <div className="vx-card p-5 group">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-white/40 mb-2 truncate">{label}</p>
      <p className={cn("font-display text-2xl lg:text-[28px] font-bold tracking-tight tabular-nums leading-none bg-gradient-to-br bg-clip-text text-transparent", accentMap[accent])}>
        {value}
      </p>
    </div>
  );
}

function DaySummary({
  summary,
}: {
  summary: Array<{ label: string; value: string; tone: Tone }>;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
      {summary.map((s, i) => {
        const ts = toneStyles[s.tone];
        return (
          <div key={i} className="bg-card px-4 py-3 flex items-center gap-3">
            <span className={cn("size-1.5 rounded-full shrink-0", ts.bar)} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 truncate">{s.label}</p>
              <p className={cn("text-[15px] font-semibold tabular-nums leading-tight mt-0.5 truncate", ts.fg)}>{s.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-muted-foreground">
      <Icon className="size-8 mb-2 opacity-40" />
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-[11.5px] mt-0.5">{subtitle}</p>}
    </div>
  );
}
