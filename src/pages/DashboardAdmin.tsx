import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Wallet, Clock,
  CheckCircle2, AlertCircle, FileWarning, CreditCard, FileSignature,
  ArrowRight, BarChart3, Heart, Plus, Calendar, Bell, ArrowUpRight,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart as RePieChart, Pie, Cell,
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

    // Receita do mês
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

    // Revenue chart — últimos 6 meses
    const revenue6m = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(thisYear, thisMonth - (5 - i), 1);
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const total = sales
        .filter((s: any) => s.sale_date && new Date(s.sale_date).getMonth() === d.getMonth() && new Date(s.sale_date).getFullYear() === d.getFullYear())
        .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);
      return { name: label, value: total };
    });

    // Status distribution
    const statusMap: Record<string, number> = {};
    clientProducts.forEach((p: any) => {
      const k = p.status || "indefinido";
      statusMap[k] = (statusMap[k] || 0) + 1;
    });
    const statusData = Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Critical alerts
    const alerts: Array<{ id: string; title: string; sub: string; tone: Tone; link: string; icon: any }> = [];
    if (delayed > 0) alerts.push({ id: "delayed", title: `${delayed} demandas atrasadas`, sub: "Prazo vencido sem conclusão", tone: "danger", link: "/demandas", icon: Clock });
    if (overduePayments.length > 0) alerts.push({ id: "overdue", title: `${overduePayments.length} pagamentos vencidos`, sub: formatBRL(overdueAmount) + " em atraso", tone: "danger", link: "/financeiro", icon: CreditCard });
    if (docsPending > 0) alerts.push({ id: "docs", title: `${docsPending} documentos pendentes`, sub: "Aguardando análise", tone: "warning", link: "/documentos", icon: FileWarning });
    const noProvider = clientProducts.filter((p: any) => !p.service_provider_id && !["concluido", "cancelado"].includes(p.status)).length;
    if (noProvider > 0) alerts.push({ id: "noprov", title: `${noProvider} demandas sem prestador`, sub: "Necessária delegação", tone: "warning", link: "/demandas", icon: AlertCircle });
    const contractsAwaiting = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    if (contractsAwaiting > 0) alerts.push({ id: "contracts", title: `${contractsAwaiting} contratos aguardando`, sub: "Assinatura pendente", tone: "info", link: "/contratos", icon: FileSignature });

    // Urgent demands (priority urgente or close to deadline)
    const urgentDemands = clientProducts
      .filter((p: any) => !["concluido", "cancelado"].includes(p.status))
      .map((p: any) => {
        const dl = p.deadline ? new Date(p.deadline) : null;
        const daysLeft = dl ? Math.floor((dl.getTime() - now.getTime()) / 86400000) : 999;
        return { ...p, daysLeft };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 6);

    // Recent activity (mix from tasks, documents, demands)
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

    // Tasks overdue & urgent
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
      activeClients,
      delayed,
      docsPending,
    };
  }, [clients, clientProducts, sales, payments, commissions, documents, contracts, dashTasks]);

  const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];

  const isLoading = loadingClients || loadingDemands;

  return (
    <div className="page-shell space-y-7 animate-fade-up">
      <Breadcrumbs />

      {/* ===== Executive Header ===== */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pb-5 border-b border-border">
        <div className="space-y-2 min-w-0">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/90">
            <span className="size-1 rounded-full bg-primary" /> Executive Cockpit
          </span>
          <h1 className="font-display text-[28px] lg:text-[32px] font-semibold tracking-tight text-foreground leading-tight">
            {greeting}, <span className="text-primary capitalize">{firstName}</span>.
          </h1>
          <p className="text-[13.5px] text-muted-foreground capitalize flex items-center gap-2">
            <Calendar className="size-3.5" /> {today}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/relatorios"
            className="h-9 px-3 inline-flex items-center gap-2 rounded-md border border-border bg-card hover:border-foreground/20 transition-colors text-[12.5px] font-semibold text-foreground"
          >
            <BarChart3 className="size-4 text-muted-foreground" /> Relatórios
          </Link>
          <Link
            to="/vendas?new=1"
            className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[12.5px] font-semibold shadow-sm"
          >
            <Plus className="size-4" strokeWidth={2.4} /> Nova venda
          </Link>
        </div>
      </header>

      {/* ===== Day Summary Strip ===== */}
      <DaySummary
        summary={[
          { label: "Receita hoje", value: formatBRL(
            sales.filter((s: any) => s.sale_date && new Date(s.sale_date).toDateString() === new Date().toDateString())
                 .reduce((a, s: any) => a + Number(s.amount || 0), 0)
          ), tone: "primary" },
          { label: "Tarefas vencidas", value: String(stats.tasksOverdue.length), tone: stats.tasksOverdue.length ? "danger" : "neutral" },
          { label: "Tarefas urgentes", value: String(stats.tasksUrgent.length), tone: stats.tasksUrgent.length ? "warning" : "neutral" },
          { label: "Alertas críticos", value: String(stats.alerts.filter(a => a.tone === "danger").length), tone: stats.alerts.filter(a => a.tone === "danger").length ? "danger" : "neutral" },
        ]}
      />

      {/* ===== KPI GRID ===== */}
      <section>
        <SectionTitle title="Indicadores principais" hint="Visão consolidada da operação" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="vx-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="size-7 rounded-md" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-6 w-1/2" />
                </div>
              ))
            : stats.kpis.map((kpi, i) => <KpiCard key={i} {...kpi} />)}
        </div>
      </section>

      {/* ===== Revenue + Critical Alerts ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 vx-card p-5">
          <CardHeader
            title="Receita mensal"
            subtitle="Evolução dos últimos 6 meses"
            icon={<TrendingUp className="size-4" />}
            right={<span className="text-[11px] font-semibold text-foreground tabular-nums">{formatBRL(stats.monthRevenue)}<span className="text-muted-foreground/70 font-normal ml-1">este mês</span></span>}
          />
          <div className="h-[260px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue6m} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                  formatter={(v: any) => formatBRL(Number(v))}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="vx-card p-5 flex flex-col">
          <CardHeader
            title="Alertas críticos"
            subtitle="Situações que exigem atenção"
            icon={<Bell className="size-4 text-destructive" />}
            right={<span className="vx-pill vx-pill-danger">{stats.alerts.length}</span>}
          />
          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[260px] pr-1">
            {stats.alerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Tudo em dia" subtitle="Sem alertas críticos no momento" />
            ) : (
              stats.alerts.map((a) => (
                <Link
                  key={a.id}
                  to={a.link}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:border-foreground/20 bg-card transition-colors"
                  )}
                >
                  <div className={cn("size-7 rounded-md flex items-center justify-center shrink-0", toneStyles[a.tone].bg, toneStyles[a.tone].fg)}>
                    <a.icon className="size-3.5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-foreground truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{a.sub}</p>
                  </div>
                  <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ===== Urgent Demands + Status Distribution ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 vx-card p-5">
          <CardHeader
            title="Demandas urgentes"
            subtitle="Próximas do prazo ou em atraso"
            icon={<Clock className="size-4 text-warning" />}
            right={<Link to="/demandas" className="text-[11.5px] font-semibold text-primary hover:underline">Ver todas →</Link>}
          />
          <div className="vx-table-wrap !rounded-md">
            <table className="vx-table">
              <thead className="vx-table-head">
                <tr>
                  <th className="vx-table-cell !py-2.5">Demanda</th>
                  <th className="vx-table-cell !py-2.5">Status</th>
                  <th className="vx-table-cell !py-2.5 text-right">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {stats.urgentDemands.length === 0 ? (
                  <tr><td colSpan={3} className="vx-table-cell text-center text-muted-foreground py-8">Nenhuma demanda urgente.</td></tr>
                ) : (
                  stats.urgentDemands.map((d: any) => {
                    const tone: Tone = d.daysLeft < 0 ? "danger" : d.daysLeft <= 3 ? "warning" : "info";
                    return (
                      <tr key={d.id} className="vx-table-row">
                        <td className="vx-table-cell !py-2.5">
                          <Link to={`/demandas/${d.id}`} className="text-[13px] font-medium text-foreground hover:text-primary truncate block max-w-[280px]">
                            #{String(d.id).slice(0, 8)}
                          </Link>
                        </td>
                        <td className="vx-table-cell !py-2.5">
                          <span className="vx-pill capitalize">{String(d.status || "").replace(/_/g, " ")}</span>
                        </td>
                        <td className={cn("vx-table-cell !py-2.5 text-right text-[12.5px] font-semibold tabular-nums", toneStyles[tone].fg)}>
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

        <div className="vx-card p-5">
          <CardHeader
            title="Distribuição de status"
            subtitle="Demandas por estágio"
            icon={<Activity className="size-4 text-info" />}
          />
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>
                  {stats.statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {stats.statusData.slice(0, 5).map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-[11.5px]">
                <span className="size-2 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="capitalize text-muted-foreground flex-1 truncate">{s.name.replace(/_/g, " ")}</span>
                <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Recent Activity + Next Tasks ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="vx-card p-5">
          <CardHeader
            title="Atividade recente"
            subtitle="Eventos das últimas horas"
            icon={<Activity className="size-4 text-primary" />}
          />
          <div className="space-y-1">
            {stats.activity.length === 0 ? (
              <EmptyState icon={Activity} title="Sem atividade recente" />
            ) : (
              stats.activity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
                  <div className={cn("size-7 rounded-md flex items-center justify-center shrink-0", toneStyles[a.tone].bg, toneStyles[a.tone].fg)}>
                    <a.icon className="size-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-foreground truncate capitalize">{String(a.title).replace(/_/g, " ")}</p>
                    <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider">{a.type}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {a.at ? new Date(a.at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="vx-card p-5">
          <CardHeader
            title="Próximas ações"
            subtitle="Tarefas vencidas e urgentes"
            icon={<AlertCircle className="size-4 text-warning" />}
            right={<Link to="/tarefas" className="text-[11.5px] font-semibold text-primary hover:underline">Ver todas →</Link>}
          />
          <div className="space-y-1">
            {[...stats.tasksOverdue, ...stats.tasksUrgent].slice(0, 7).length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Sem ações pendentes" subtitle="Você está em dia" />
            ) : (
              [...stats.tasksOverdue.map((t: any) => ({ ...t, _tone: "danger" as Tone })),
               ...stats.tasksUrgent.filter((t: any) => !stats.tasksOverdue.find((o: any) => o.id === t.id))
                                  .map((t: any) => ({ ...t, _tone: "warning" as Tone }))]
                .slice(0, 7)
                .map((t: any) => (
                  <Link key={t.id} to="/tarefas" className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors">
                    <span className={cn("size-1.5 rounded-full shrink-0", toneStyles[t._tone].bar)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-foreground truncate">{t.title}</p>
                      <p className="text-[10.5px] text-muted-foreground tabular-nums">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "Sem prazo"} · <span className="capitalize">{t.priority}</span>
                      </p>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                  </Link>
                ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   Sub-components — premium, compact, dense
   ============================================================ */

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h2>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function CardHeader({
  title, subtitle, icon, right,
}: { title: string; subtitle?: string; icon?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <div className="size-7 rounded-md bg-muted/70 border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold text-foreground tracking-tight leading-tight">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 mt-0.5">{right}</div>}
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
    <div className={cn(
      "relative vx-card p-4 transition-colors hover:border-foreground/15 overflow-hidden group"
    )}>
      <span className={cn("absolute left-0 top-3 bottom-3 w-[2px] rounded-r opacity-60 group-hover:opacity-100 transition-opacity", ts.bar)} />
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80 truncate pr-2">{label}</p>
        <div className={cn("size-7 rounded-md flex items-center justify-center shrink-0", ts.bg, ts.fg)}>
          <Icon className="size-3.5" strokeWidth={2.2} />
        </div>
      </div>
      <p className="font-display text-[22px] font-semibold tracking-tight text-foreground tabular-nums leading-none truncate">{value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] min-h-[16px]">
        {delta != null ? (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-semibold tabular-nums",
            positive && "text-success",
            negative && "text-destructive",
            !positive && !negative && "text-muted-foreground"
          )}>
            {positive ? <TrendingUp className="size-3" /> : negative ? <TrendingDown className="size-3" /> : null}
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
          </span>
        ) : null}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
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
