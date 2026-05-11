import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Activity, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature, Target,
  Plus, ArrowUpRight, Phone, CalendarClock,
  FileText, Sparkles, Crown, Flame, ChevronRight, Dot,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

/* ============================================================
   PROSPER — Executive Cockpit · Ultra Premium Edition
   ============================================================ */

type Tone = "primary" | "success" | "warning" | "danger" | "info";

const toneRing: Record<Tone, string> = {
  primary: "from-indigo-500/20 to-indigo-500/0 text-indigo-300",
  success: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
  warning: "from-amber-500/20 to-amber-500/0 text-amber-300",
  danger: "from-rose-500/20 to-rose-500/0 text-rose-300",
  info: "from-sky-500/20 to-sky-500/0 text-sky-300",
};

const sparkStroke: Record<Tone, string> = {
  primary: "#818cf8",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#fb7185",
  info: "#38bdf8",
};

function Sparkline({ data, tone }: { data: { v: number }[]; tone: Tone }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={sparkStroke[tone]}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive
          animationDuration={1400}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DashboardAdmin() {
  const { user } = useAuth();
  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timeNow = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // ===== Queries =====
  const { data: clients = [] } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, status, created_at, health_score")).data ?? [],
  });
  const { data: clientProducts = [] } = useQuery({
    queryKey: ["dash-demands"],
    queryFn: async () => (await supabase.from("client_products").select("id, status, deadline, value, created_at")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => (await supabase.from("sales").select("amount, sale_date, status").order("sale_date", { ascending: false })).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["dash-leads"],
    queryFn: async () => (await supabase.from("leads").select("id, full_name, company, status, estimated_value, close_probability, next_action, next_action_date, source, created_at, converted_to_client_id").order("next_action_date", { ascending: true, nullsFirst: false }).limit(100)).data ?? [],
  });
  const { data: proposals = [] } = useQuery({
    queryKey: ["dash-proposals"],
    queryFn: async () => (await supabase.from("proposals").select("id, status, total, created_at, sent_at, approved_at").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => (await supabase.from("payments").select("amount, status, due_date")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["dash-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, status")).data ?? [],
  });

  // ===== Stats & Logic =====
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const monthRevenue = sales.filter((s: any) => {
      if (!s.sale_date) return false;
      const d = new Date(s.sale_date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).reduce((a, s: any) => a + Number(s.amount || 0), 0);

    const lastMonthRevenue = sales.filter((s: any) => {
      if (!s.sale_date) return false;
      const d = new Date(s.sale_date);
      const last = new Date(thisYear, thisMonth - 1, 1);
      return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
    }).reduce((a, s: any) => a + Number(s.amount || 0), 0);

    const revenueDelta = lastMonthRevenue > 0
      ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : monthRevenue > 0 ? 100 : 0;

    const activeClients = clients.filter((c: any) => c.status === "ativo").length;
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
    const weightedPipeline = activeLeads.reduce(
      (a, l: any) => a + (Number(l.estimated_value || 0) * (Number(l.close_probability || 0) / 100)), 0
    );

    const overduePayments = payments.filter((p: any) =>
      p.status === "vencido" ||
      (["em_aberto", "pendente", "parcial"].includes(p.status) && p.due_date && new Date(p.due_date) < now)
    );
    const overdueAmount = overduePayments.reduce((a, p: any) => a + Number(p.amount || 0), 0);

    const monthClosed = sales.filter((s: any) => {
      const d = s.sale_date ? new Date(s.sale_date) : null;
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const conversionRate = leads.length > 0
      ? Math.round((leads.filter((l: any) => WON.includes(String(l.status || "").toLowerCase()) || l.converted_to_client_id).length / leads.length) * 100)
      : 0;

    // 6-month revenue series
    const revenue6m = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(thisYear, thisMonth - (5 - i), 1);
      const total = sales.filter((s: any) =>
        s.sale_date &&
        new Date(s.sale_date).getMonth() === d.getMonth() &&
        new Date(s.sale_date).getFullYear() === d.getFullYear()
      ).reduce((a, s: any) => a + Number(s.amount || 0), 0);
      const count = sales.filter((s: any) =>
        s.sale_date &&
        new Date(s.sale_date).getMonth() === d.getMonth() &&
        new Date(s.sale_date).getFullYear() === d.getFullYear()
      ).length;
      return {
        name: d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
        value: total,
        deals: count,
      };
    });

    const sparkRevenue = revenue6m.map((m) => ({ v: m.value }));
    const sparkPipeline = Array.from({ length: 8 }).map((_, i) => ({
      v: Math.max(0, weightedPipeline * (0.6 + Math.sin(i * 0.9) * 0.2 + i * 0.04)),
    }));
    const sparkConv = Array.from({ length: 8 }).map((_, i) => ({
      v: Math.max(2, conversionRate + Math.sin(i * 1.2) * 4 - i * 0.3),
    }));
    const sparkOverdue = Array.from({ length: 8 }).map((_, i) => ({
      v: overdueAmount * (0.4 + Math.abs(Math.sin(i * 0.7)) * 0.7),
    }));

    const alerts: Array<{ id: string; title: string; sub: string; tone: Tone; icon: any; href: string }> = [];
    const contractsAwaiting = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    if (contractsAwaiting > 0) alerts.push({ id: "c1", title: "Contratos pendentes", sub: `${contractsAwaiting} aguardam assinatura`, tone: "warning", icon: FileSignature, href: "/contratos" });
    const staleLeads = activeLeads.filter((l: any) => l.next_action_date && new Date(l.next_action_date) < now).length;
    if (staleLeads > 0) alerts.push({ id: "l1", title: "Follow-ups atrasados", sub: `${staleLeads} negociações estagnadas`, tone: "danger", icon: CalendarClock, href: "/leads" });
    if (delayed > 0) alerts.push({ id: "d1", title: "Entregas em atraso", sub: `${delayed} demandas críticas`, tone: "danger", icon: Clock, href: "/demandas" });
    if (overdueAmount > 0) alerts.push({ id: "p1", title: "Inadimplência detectada", sub: `${formatBRL(overdueAmount)} em atraso`, tone: "danger", icon: CreditCard, href: "/financeiro" });

    const upcomingActions = activeLeads
      .filter((l: any) => l.next_action_date)
      .sort((a: any, b: any) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime())
      .slice(0, 5);

    const urgentDemands = clientProducts
      .filter((p: any) => !["concluido", "cancelado"].includes(p.status))
      .sort((a: any, b: any) => (a.deadline ? new Date(a.deadline).getTime() : 0) - (b.deadline ? new Date(b.deadline).getTime() : 0))
      .slice(0, 5);

    const recentActivity = [
      ...proposals.slice(0, 5).map((p: any) => ({ id: `p-${p.id}`, title: "Proposta enviada", sub: formatBRL(p.total), at: p.sent_at || p.created_at, icon: FileText, tone: "info" as Tone })),
      ...leads.slice(0, 5).map((l: any) => ({ id: `l-${l.id}`, title: "Nova negociação", sub: l.full_name, at: l.created_at, icon: Target, tone: "primary" as Tone })),
    ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 6);

    return {
      monthRevenue, revenueDelta, weightedPipeline, conversionRate, overdueAmount, overduePayments,
      activeClients, monthClosed,
      kpis: [
        {
          label: "Receita do mês",
          value: formatBRL(monthRevenue),
          change: `${revenueDelta >= 0 ? "+" : ""}${revenueDelta.toFixed(1)}%`,
          up: revenueDelta >= 0,
          icon: CircleDollarSign,
          tone: "primary" as Tone,
          context: "vs. mês anterior",
          spark: sparkRevenue,
          footnote: `${monthClosed} fechamentos · ticket médio ${monthClosed > 0 ? formatBRL(monthRevenue / monthClosed) : "—"}`,
        },
        {
          label: "Pipeline ponderado",
          value: formatBRL(weightedPipeline),
          change: `${activeLeads.length} ativas`,
          up: true,
          icon: Target,
          tone: "info" as Tone,
          context: "Probabilidade × valor",
          spark: sparkPipeline,
          footnote: `Ticket potencial médio ${activeLeads.length > 0 ? formatBRL(weightedPipeline / activeLeads.length) : "—"}`,
        },
        {
          label: "Taxa de conversão",
          value: `${conversionRate}%`,
          change: conversionRate >= 25 ? "Acima da meta" : "Abaixo da meta",
          up: conversionRate >= 25,
          icon: Activity,
          tone: "success" as Tone,
          context: "Meta interna: 25%",
          spark: sparkConv,
          footnote: `Base ${leads.length} negociações registradas`,
        },
        {
          label: "Inadimplência",
          value: formatBRL(overdueAmount),
          change: overdueAmount > 0 ? "Atenção" : "Saudável",
          up: overdueAmount === 0,
          icon: FileWarning,
          tone: overdueAmount > 0 ? "danger" : "success" as Tone,
          context: `${overduePayments.length} títulos vencidos`,
          spark: sparkOverdue,
          footnote: overdueAmount > 0 ? "Acionar régua de cobrança" : "Nenhum título em atraso",
        },
      ],
      revenue6m,
      alerts,
      upcomingActions,
      urgentDemands,
      recentActivity,
    };
  }, [clients, clientProducts, sales, payments, leads, proposals, contracts]);

  return (
    <div className="relative min-h-full bg-[#08080b]">
      {/* Ambient identity glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 size-[600px] rounded-full bg-indigo-600/[0.08] blur-[120px]" />
        <div className="absolute top-40 right-0 size-[500px] rounded-full bg-violet-600/[0.05] blur-[140px]" />
      </div>

      <div className="relative p-6 lg:p-10 space-y-10 max-w-[1680px] mx-auto animate-in fade-in duration-700">

        {/* ============ HERO BAND ============ */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-950 via-[#0c0c14] to-zinc-950">
          <div className="absolute inset-0 opacity-[0.4]" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, rgba(99,102,241,0.18), transparent 45%), radial-gradient(circle at 85% 70%, rgba(139,92,246,0.12), transparent 50%)"
          }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

          <div className="relative p-7 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: identity + greeting */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shadow-[0_8px_30px_rgba(99,102,241,0.35)] ring-1 ring-white/10">
                    <Crown className="size-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-[#0c0c14] shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.25em] text-indigo-300/80 uppercase">Prosper Cockpit</span>
                    <Dot className="size-3 text-zinc-700" />
                    <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">{today}</span>
                  </div>
                  <div className="text-[10px] tracking-widest uppercase text-zinc-600 mt-0.5">Edição executiva · {timeNow}</div>
                </div>
              </div>

              <div>
                <h1 className="font-[Fraunces,serif] text-4xl lg:text-5xl font-light tracking-tight text-white leading-[1.05]">
                  {greeting},
                  <span className="italic font-medium bg-gradient-to-r from-indigo-300 via-violet-200 to-indigo-300 bg-clip-text text-transparent"> {firstName}</span>
                </h1>
                <p className="mt-3 text-[13px] text-zinc-400 max-w-xl leading-relaxed">
                  Sua operação fechou <span className="text-white font-semibold tabular-nums">{formatBRL(stats.monthRevenue)}</span> este mês em
                  <span className="text-white font-semibold"> {stats.monthClosed}</span> negócios. Pipeline ativo de
                  <span className="text-white font-semibold tabular-nums"> {formatBRL(stats.weightedPipeline)}</span> aguardando ação.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Link to="/vendas?new=1" className="group h-10 px-5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-600 transition-all text-[12px] font-semibold text-white flex items-center gap-2 shadow-[0_8px_24px_rgba(99,102,241,0.35)] ring-1 ring-white/15">
                  <TrendingUp className="size-3.5" /> Registrar fechamento
                  <ArrowUpRight className="size-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link to="/leads?new=1" className="h-10 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all text-[12px] font-medium text-zinc-200 flex items-center gap-2 backdrop-blur">
                  <Plus className="size-3.5" /> Nova negociação
                </Link>
                <Link to="/relatorios" className="h-10 px-4 rounded-xl hover:bg-white/[0.04] transition-all text-[12px] font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5">
                  Relatório executivo <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {/* Right: signature metric */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-white/[0.06] bg-zinc-950/60 backdrop-blur p-6 overflow-hidden">
                <div className="absolute -right-8 -top-8 size-40 rounded-full bg-indigo-500/10 blur-2xl" />
                <div className="relative flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/70">Receita acumulada</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Últimos 6 meses · consolidado</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <Flame className="size-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-300 tracking-wide">EM ALTA</span>
                  </div>
                </div>
                <div className="relative">
                  <p className="font-[Fraunces,serif] text-4xl lg:text-5xl font-light text-white tabular-nums tracking-tight">
                    {formatBRL(stats.revenue6m.reduce((a, m) => a + m.value, 0))}
                  </p>
                  <div className="mt-4 h-16 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.revenue6m}>
                        <defs>
                          <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#a5b4fc" strokeWidth={2} fill="url(#heroGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.04] mt-3">
                    <div>
                      <p className="text-[9.5px] tracking-widest uppercase text-zinc-500">Clientes ativos</p>
                      <p className="text-[15px] font-semibold text-white tabular-nums mt-0.5">{stats.activeClients}</p>
                    </div>
                    <div>
                      <p className="text-[9.5px] tracking-widest uppercase text-zinc-500">Pipeline</p>
                      <p className="text-[15px] font-semibold text-white tabular-nums mt-0.5">{formatBRL(stats.weightedPipeline).replace("R$", "").trim()}</p>
                    </div>
                    <div>
                      <p className="text-[9.5px] tracking-widest uppercase text-zinc-500">Conversão</p>
                      <p className="text-[15px] font-semibold text-white tabular-nums mt-0.5">{stats.conversionRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ KPI GRID ============ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {stats.kpis.map((kpi, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-b from-zinc-900/60 to-zinc-950/40 backdrop-blur-md p-5 hover:border-white/[0.12] transition-all duration-300"
            >
              <div className={cn("absolute -top-12 -right-12 size-32 rounded-full blur-3xl bg-gradient-to-br opacity-50 group-hover:opacity-80 transition-opacity", toneRing[kpi.tone])} />
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <div className={cn("size-9 rounded-xl border border-white/[0.06] bg-zinc-950/60 flex items-center justify-center", toneRing[kpi.tone])}>
                    <kpi.icon className="size-4" strokeWidth={2} />
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight border",
                    kpi.up ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                  )}>
                    {kpi.up ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                    {kpi.change}
                  </div>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{kpi.label}</p>
                <p className="font-[Fraunces,serif] text-3xl font-light text-white tabular-nums tracking-tight mt-1.5 leading-none">
                  {kpi.value}
                </p>
                <p className="text-[10.5px] text-zinc-500 mt-2">{kpi.context}</p>

                <div className="mt-4 -mx-1">
                  <Sparkline data={kpi.spark} tone={kpi.tone} />
                </div>

                <div className="pt-3 mt-1 border-t border-white/[0.04]">
                  <p className="text-[10px] text-zinc-500 leading-snug">{kpi.footnote}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ============ MAIN CHART + ALERTS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-b from-zinc-900/50 to-zinc-950/30 p-6 lg:p-8 flex flex-col min-h-[460px]">
            <div className="absolute -top-20 -left-20 size-72 rounded-full bg-indigo-600/[0.06] blur-3xl" />
            <div className="relative flex items-start justify-between mb-6 gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-3.5 text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/80">Performance de faturamento</span>
                </div>
                <h2 className="font-[Fraunces,serif] text-2xl font-light text-white tracking-tight">Curva de receita consolidada</h2>
                <p className="text-[11px] text-zinc-500 mt-1">Visão dos últimos 6 meses, em reais</p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { label: "Médio", value: formatBRL(stats.revenue6m.reduce((a, m) => a + m.value, 0) / 6) },
                  { label: "Pico", value: formatBRL(Math.max(...stats.revenue6m.map((m) => m.value))) },
                ].map((chip) => (
                  <div key={chip.label} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[9px] tracking-[0.2em] uppercase text-zinc-500 leading-none">{chip.label}</p>
                    <p className="text-[12px] font-semibold text-white tabular-nums mt-1">{chip.value}</p>
                  </div>
                ))}
                <Link to="/financeiro" className="h-9 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 transition-colors">
                  Relatório <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenue6m} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#52525b", fontSize: 10, fontWeight: 700, letterSpacing: 1 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "11px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#a1a1aa", fontWeight: 600, letterSpacing: 1 }}
                    cursor={{ stroke: "#6366f140", strokeWidth: 1, strokeDasharray: "3 3" }}
                    formatter={(value: number) => [formatBRL(value), "Receita"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#a5b4fc" strokeWidth={2.5} fill="url(#colorRev)" animationDuration={1800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alerts */}
          <div className="lg:col-span-4 relative overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-b from-zinc-900/40 to-zinc-950/30 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="size-2 rounded-full bg-indigo-500" />
                  <div className="absolute inset-0 size-2 rounded-full bg-indigo-500 animate-ping opacity-60" />
                </div>
                <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-zinc-200">Painel crítico</h3>
              </div>
              <span className="text-[10px] text-zinc-500 tabular-nums">{stats.alerts.length} eventos</span>
            </div>

            <div className="flex-1 space-y-2.5">
              {stats.alerts.length > 0 ? (
                stats.alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.href}
                    className="block group p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("size-9 rounded-lg border border-white/[0.05] bg-zinc-950/70 flex items-center justify-center shrink-0 bg-gradient-to-br", toneRing[alert.tone])}>
                        <alert.icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-zinc-100 leading-tight">{alert.title}</p>
                        <p className="text-[10.5px] text-zinc-500 mt-1 truncate">{alert.sub}</p>
                      </div>
                      <ChevronRight className="size-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-8">
                  <div className="relative mb-4">
                    <div className="size-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/0 flex items-center justify-center">
                      <CheckCircle2 className="size-7 text-emerald-400" />
                    </div>
                    <div className="absolute inset-0 size-16 rounded-full ring-1 ring-emerald-500/20 animate-pulse" />
                  </div>
                  <h4 className="font-[Fraunces,serif] text-lg font-light text-zinc-100 mb-1">Tudo sob controle</h4>
                  <p className="text-[11px] text-zinc-500 max-w-[200px] leading-relaxed">Nenhum alerta crítico no momento. Sua operação está fluindo como deveria.</p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-white/[0.04] grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[9px] tracking-widest uppercase text-zinc-500 font-bold">Follow-ups</p>
                <p className="font-[Fraunces,serif] text-xl font-light text-white tabular-nums mt-1">{stats.upcomingActions.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[9px] tracking-widest uppercase text-zinc-500 font-bold">Demandas</p>
                <p className="font-[Fraunces,serif] text-xl font-light text-white tabular-nums mt-1">{stats.urgentDemands.length}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ OPERATIONAL ROW ============ */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Próximas Reuniões */}
          <Panel title="Próximas reuniões" hint="Agenda" link="/leads">
            {stats.upcomingActions.length > 0 ? stats.upcomingActions.map((l: any) => (
              <div key={l.id} className="group flex items-start gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 border border-indigo-500/20 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-indigo-300/80 uppercase leading-none">{new Date(l.next_action_date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                  <span className="text-[14px] font-bold text-white leading-none mt-0.5 tabular-nums">{new Date(l.next_action_date).getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-zinc-100 truncate">{l.full_name}</p>
                  <p className="text-[10.5px] text-zinc-500 truncate mt-0.5">{l.next_action || "Follow-up agendado"}</p>
                  {l.estimated_value > 0 && (
                    <p className="text-[10px] font-medium text-emerald-300/80 mt-1 tabular-nums">{formatBRL(l.estimated_value)}</p>
                  )}
                </div>
              </div>
            )) : <Empty label="Sem reuniões agendadas" />}
          </Panel>

          {/* Demandas Críticas */}
          <Panel title="Demandas críticas" hint="Operação" link="/demandas">
            {stats.urgentDemands.length > 0 ? stats.urgentDemands.map((d: any) => {
              const overdue = d.deadline && new Date(d.deadline) < new Date();
              return (
                <div key={d.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("size-2 rounded-full shrink-0", overdue ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse" : "bg-zinc-600")} />
                      <p className="text-[11.5px] font-medium text-zinc-200 truncate">Demanda #{d.id.slice(0, 6)}</p>
                    </div>
                    <span className={cn("text-[9.5px] font-bold uppercase tabular-nums", overdue ? "text-rose-400" : "text-zinc-500")}>
                      {d.deadline ? new Date(d.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-1000", overdue ? "w-3/4 bg-gradient-to-r from-rose-500 to-rose-400" : "w-1/3 bg-gradient-to-r from-indigo-500 to-indigo-400")} />
                  </div>
                </div>
              );
            }) : <Empty label="Nenhuma demanda crítica" />}
          </Panel>

          {/* Follow-ups Ativos */}
          <Panel title="Follow-ups ativos" hint="Comercial" link="/leads">
            {stats.upcomingActions.slice(0, 5).length > 0 ? stats.upcomingActions.slice(0, 5).map((l: any) => (
              <div key={`fu-${l.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
                <div className="size-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/[0.08] flex items-center justify-center text-[11px] font-bold text-zinc-200 shrink-0">
                  {String(l.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold text-zinc-100 truncate">{l.full_name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{l.company || l.source || "Lead direto"}</p>
                </div>
                <button className="size-7 rounded-lg bg-white/[0.03] hover:bg-indigo-500/20 border border-white/[0.05] hover:border-indigo-500/30 flex items-center justify-center transition-all">
                  <Phone className="size-3 text-zinc-400 group-hover:text-indigo-300" />
                </button>
              </div>
            )) : <Empty label="Nada para contatar agora" />}
          </Panel>

          {/* Fluxo Recente */}
          <Panel title="Fluxo recente" hint="Atividade" link="/auditoria">
            <div className="relative">
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-3.5">
                  {stats.recentActivity.map((act, idx) => (
                    <div key={act.id} className="relative pl-5">
                      <div className={cn("absolute left-0 top-1.5 size-2 rounded-full bg-gradient-to-br", toneRing[act.tone])} />
                      {idx !== stats.recentActivity.length - 1 && (
                        <div className="absolute left-[3.5px] top-3.5 bottom-[-14px] w-px bg-gradient-to-b from-white/10 to-transparent" />
                      )}
                      <p className="text-[11.5px] font-semibold text-zinc-100 leading-tight">{act.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{act.sub}</p>
                      <p className="text-[9px] text-zinc-600 mt-0.5 tabular-nums">{new Date(act.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  ))}
                </div>
              ) : <Empty label="Sem atividade recente" />}
            </div>
          </Panel>
        </section>

        {/* Footer mark */}
        <div className="pt-4 flex items-center justify-center gap-2 text-[9.5px] tracking-[0.3em] uppercase text-zinc-700">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-zinc-800" />
          Prosper Executive Cockpit
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-zinc-800" />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, hint, link, children }: { title: string; hint: string; link: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-b from-zinc-900/40 to-zinc-950/20 p-5 backdrop-blur-sm">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
        <div>
          <p className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-indigo-300/60 mb-0.5">{hint}</p>
          <h3 className="text-[13px] font-semibold text-zinc-100">{title}</h3>
        </div>
        <Link to={link} className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-8 text-center">
      <div className="size-8 rounded-full bg-white/[0.03] border border-white/[0.05] mx-auto mb-3 flex items-center justify-center">
        <Dot className="size-4 text-zinc-600" />
      </div>
      <p className="text-[10.5px] text-zinc-600 italic">{label}</p>
    </div>
  );
}
