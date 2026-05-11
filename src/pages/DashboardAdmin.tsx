import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Wallet, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature,
  BarChart3, Plus, Calendar, Bell, ArrowUpRight, ArrowRight, AlertCircle, Heart,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
} from "recharts";
import { PremiumCard } from "@/components/ui/PremiumCard";

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

    const healthScores = clients.map((c: any) => Number(c.health_score || 0)).filter((v) => v > 0);
    const avgHealth = healthScores.length
      ? healthScores.reduce((a, v) => a + v, 0) / healthScores.length
      : 0;

    const revenue6m = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(thisYear, thisMonth - (5 - i), 1);
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const total = sales
        .filter((s: any) => s.sale_date && new Date(s.sale_date).getMonth() === d.getMonth() && new Date(s.sale_date).getFullYear() === d.getFullYear())
        .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);
      return { name: label, value: total };
    });

    const statusMap: Record<string, number> = {};
    clientProducts.forEach((p: any) => {
      const k = p.status || "indefinido";
      statusMap[k] = (statusMap[k] || 0) + 1;
    });
    const statusData = Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const alerts: Array<{ id: string; title: string; sub: string; tone: Tone; link: string; icon: any }> = [];
    if (delayed > 0) alerts.push({ id: "delayed", title: `${delayed} demandas atrasadas`, sub: "Prazo vencido sem conclusão", tone: "danger", link: "/demandas", icon: Clock });
    if (overduePayments.length > 0) alerts.push({ id: "overdue", title: `${overduePayments.length} pagamentos vencidos`, sub: formatBRL(overdueAmount) + " em atraso", tone: "danger", link: "/financeiro", icon: CreditCard });
    if (docsPending > 0) alerts.push({ id: "docs", title: `${docsPending} documentos pendentes`, sub: "Aguardando análise", tone: "warning", link: "/documentos", icon: FileWarning });
    const noProvider = clientProducts.filter((p: any) => !p.service_provider_id && !["concluido", "cancelado"].includes(p.status)).length;
    if (noProvider > 0) alerts.push({ id: "noprov", title: `${noProvider} demandas sem prestador`, sub: "Necessária delegação", tone: "warning", link: "/demandas", icon: AlertCircle });
    const contractsAwaiting = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    if (contractsAwaiting > 0) alerts.push({ id: "contracts", title: `${contractsAwaiting} contratos aguardando`, sub: "Assinatura pendente", tone: "info", link: "/contratos", icon: FileSignature });

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
      ...documents.slice(0, 5).map((d: any) => ({
        id: `doc-${d.id}`, type: "Documento", title: d.name || "Documento", at: d.created_at, icon: FileWarning, tone: "info" as Tone,
      })),
      ...clientProducts
        .slice()
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((d: any) => ({
          id: `dem-${d.id}`, type: "Demanda", title: d.status || "Nova demanda", at: d.created_at, icon: Activity, tone: "primary" as Tone,
        })),
    ]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 8);

    const tasksOverdue = dashTasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && !["concluida", "cancelada"].includes(t.status_new));
    const tasksUrgent = dashTasks.filter((t: any) => t.priority === "urgente" && !["concluida", "cancelada"].includes(t.status_new));

    return {
      kpis: [
        { label: "Receita do mês", value: formatBRL(monthRevenue), delta: revenueDelta, icon: CircleDollarSign, tone: "primary" as Tone, hint: "vs. mês anterior" },
        { label: "Clientes ativos", value: String(activeClients), delta: null, icon: Users, tone: "success" as Tone, hint: `de ${totalClients} totais` },
        { label: "Demandas em andamento", value: String(inProgress), delta: null, icon: Activity, tone: "info" as Tone, hint: "operação ativa" },
        { label: "Demandas atrasadas", value: String(delayed), delta: null, icon: Clock, tone: "danger" as Tone, hint: "prazo vencido" },
        { label: "Documentos pendentes", value: String(docsPending), delta: null, icon: FileWarning, tone: "warning" as Tone, hint: "aguardando análise" },
        { label: "Comissões a pagar", value: formatBRL(commissionsToPay), delta: null, icon: Wallet, tone: "warning" as Tone, hint: `${commissions.filter((c: any) => c.status === "pendente").length} pendentes` },
        { label: "Pagamentos vencidos", value: formatBRL(overdueAmount), delta: null, icon: CreditCard, tone: "danger" as Tone, hint: `${overduePayments.length} cobranças` },
        { label: "Health score médio", value: avgHealth ? avgHealth.toFixed(1) : "—", delta: null, icon: Heart, tone: (avgHealth >= 7 ? "success" : avgHealth >= 4 ? "warning" : "danger") as Tone, hint: "saúde da carteira" },
      ],
      revenue6m,
      statusData,
      alerts,
      urgentDemands,
      activity,
      tasksOverdue,
      tasksUrgent,
      monthRevenue,
    };
  }, [clients, clientProducts, sales, payments, commissions, documents, contracts, dashTasks]);

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
            Visão consolidada da operação · {stats.alerts.length} alertas ativos · {stats.tasksOverdue.length} tarefas vencidas
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/relatorios"
            className="h-10 px-3.5 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors text-[12.5px] font-semibold text-white/85"
          >
            <BarChart3 className="size-3.5 text-white/55" /> Relatórios
          </Link>
          <Link
            to="/vendas?new=1"
            className="h-10 px-4 inline-flex items-center gap-2 rounded-lg text-[12.5px] font-semibold text-white transition-all bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_4px_20px_-6px_rgba(129,140,248,0.6)]"
          >
            <Plus className="size-3.5" strokeWidth={2.5} /> Nova venda
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
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Receita mensal</h3>
                <p className="text-[11px] text-white/45">Últimos 6 meses</p>
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

      {/* === DEMANDS + PIPELINE === */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Clock className="size-3.5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-white tracking-tight">Demandas urgentes</h3>
                <p className="text-[11px] text-white/45">Próximas do prazo ou em atraso</p>
              </div>
            </div>
            <Link to="/demandas" className="text-[11.5px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1">
              Ver todas <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 border-b border-white/[0.05]">
                  <th className="text-left px-5 py-2.5 font-bold">Demanda</th>
                  <th className="text-left px-5 py-2.5 font-bold">Status</th>
                  <th className="text-right px-5 py-2.5 font-bold">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {stats.urgentDemands.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-white/40 text-[12.5px]">Nenhuma demanda urgente.</td></tr>
                ) : (
                  stats.urgentDemands.map((d: any) => {
                    const tone: Tone = d.daysLeft < 0 ? "danger" : d.daysLeft <= 3 ? "warning" : "info";
                    const toneText: Record<Tone, string> = { danger: "text-rose-300", warning: "text-amber-300", info: "text-sky-300", success: "text-emerald-300", primary: "text-indigo-300", neutral: "text-white/60" };
                    return (
                      <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors last:border-0">
                        <td className="px-5 py-3">
                          <Link to={`/demandas/${d.id}`} className="text-[12.5px] font-semibold text-white hover:text-indigo-300 transition-colors font-mono">
                            #{String(d.id).slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[10.5px] font-semibold bg-white/[0.04] border border-white/[0.08] text-white/70 capitalize">
                            <span className="size-1.5 rounded-full bg-current opacity-70" />
                            {String(d.status || "").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className={cn("px-5 py-3 text-right text-[12.5px] font-semibold tabular-nums", toneText[tone])}>
                          {d.deadline ? (d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d em atraso` : d.daysLeft === 0 ? "Hoje" : `${d.daysLeft}d`) : "Sem prazo"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline / Distribution */}
        <div className="rounded-xl border border-white/[0.06] bg-[hsl(240_30%_7%_/_0.6)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[0.05]">
            <div className="size-7 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <Activity className="size-3.5 text-sky-300" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white tracking-tight">Pipeline</h3>
              <p className="text-[11px] text-white/45">Demandas por estágio</p>
            </div>
          </div>
          <div className="p-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                    {stats.statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(0 0% 100% / 0.1)", background: "hsl(240 30% 8%)", fontSize: 12, color: "white" }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5">
              {stats.statusData.slice(0, 5).map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-[11.5px]">
                  <span className="size-2 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="capitalize text-white/60 flex-1 truncate">{s.name.replace(/_/g, " ")}</span>
                  <span className="font-semibold tabular-nums text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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
  const ts = toneStyles[tone];
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  return (
    <div className="relative vx-card p-6 overflow-hidden group">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40 truncate pr-2">{label}</p>
        <div className={cn("size-9 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-md border border-white/10", ts.bg, ts.fg)}>
          <Icon className="size-4" strokeWidth={2.2} />
        </div>
      </div>
      <p className="font-display text-[34px] lg:text-[40px] font-bold tracking-tighter text-white tabular-nums leading-none truncate">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-[12px] min-h-[18px]">
        {delta != null ? (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-semibold tabular-nums px-2 py-0.5 rounded-md backdrop-blur",
            positive && "text-emerald-300 bg-emerald-500/10",
            negative && "text-rose-300 bg-rose-500/10",
            !positive && !negative && "text-white/40 bg-white/[0.04]"
          )}>
            {positive ? <TrendingUp className="size-3" /> : negative ? <TrendingDown className="size-3" /> : null}
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
