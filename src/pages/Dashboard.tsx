import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  FolderKanban,
  CalendarClock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  UserPlus,
  Coins,
  FileUp,
  Handshake,
  FileSignature,
  TrendingUp,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Calendar,
} from "lucide-react";
import { formatBRL, timeAgo, initials } from "@/lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const C = {
  success: "hsl(var(--success))",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  c5: "hsl(var(--chart-5))",
  c6: "hsl(var(--chart-6))",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border) / 0.7)",
  borderRadius: "10px",
  fontSize: "12px",
  padding: "8px 10px",
};

const activityMeta: Record<string, { icon: any; tone: string }> = {
  cliente: { icon: UserPlus, tone: "text-success bg-success/15" },
  projeto: { icon: FolderKanban, tone: "text-info bg-info/15" },
  contrato: { icon: FileSignature, tone: "text-info bg-info/15" },
  comissao: { icon: Coins, tone: "text-warning bg-warning/15" },
  documento: { icon: FileUp, tone: "text-info bg-info/15" },
  parceiro: { icon: Handshake, tone: "text-primary bg-primary/15" },
};

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  // ---------- queries ----------
  const { data: stats } = useQuery({
    queryKey: ["dash-core"],
    queryFn: async () => {
      const [clients, partners, sales, commissions, projects] = await Promise.all([
        supabase.from("clients").select("id, status, created_at"),
        supabase.from("partners").select("id, partner_type").eq("active", true),
        supabase.from("sales").select("amount, sale_date, status"),
        supabase.from("commissions").select("amount, status, paid_at"),
        supabase.from("projects").select("id, status, amount, start_date, due_date"),
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const allProjects = projects.data ?? [];
      const activeProjects = allProjects.filter((p) => p.status === "ativo" || p.status === "em_andamento");
      const expectedThisMonth = allProjects
        .filter((p) => p.status === "previsto")
        .filter((p) => {
          const d = new Date(p.start_date);
          return d >= monthStart && d < monthEnd;
        });
      const expectedThisMonthValue = expectedThisMonth.reduce((s, p) => s + Number(p.amount), 0);

      const totalRevenue = (sales.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const paidCommissions = (commissions.data ?? [])
        .filter((c) => c.status === "pago")
        .reduce((s, x) => s + Number(x.amount), 0);

      return {
        clientsTotal: clients.data?.length ?? 0,
        clientsActive: (clients.data ?? []).filter((c) => c.status === "ativo").length,
        partnersTotal: partners.data?.length ?? 0,
        parceiros: (partners.data ?? []).filter((p: any) => p.partner_type === "parceiro").length,
        indicadores: (partners.data ?? []).filter((p: any) => p.partner_type === "indicador").length,
        projectsActive: activeProjects.length,
        projectsExpectedMonth: expectedThisMonth.length,
        projectsExpectedMonthValue: expectedThisMonthValue,
        projectsPipelineValue: allProjects.filter((p) => p.status !== "concluido" && p.status !== "cancelado").reduce((s, p) => s + Number(p.amount), 0),
        totalRevenue,
        paidCommissions,
        salesCount: sales.data?.length ?? 0,
        // distribution for funnel
        projectsByStatus: ["previsto", "ativo", "em_andamento", "concluido", "cancelado"].map((st) => ({
          status: st,
          count: allProjects.filter((p) => p.status === st).length,
          amount: allProjects.filter((p) => p.status === st).reduce((s, p) => s + Number(p.amount), 0),
        })),
      };
    },
  });

  const { data: monthlySeries } = useQuery({
    queryKey: ["dash-monthly"],
    queryFn: async () => {
      const [salesRes, commRes] = await Promise.all([
        supabase.from("sales").select("amount, sale_date"),
        supabase.from("commissions").select("amount, paid_at, status"),
      ]);
      const result = PT_MONTHS.map((m) => ({ month: m, faturamento: 0, comissoes: 0, liquido: 0 }));
      const year = new Date().getFullYear();
      (salesRes.data ?? []).forEach((s) => {
        const d = new Date(s.sale_date);
        if (d.getFullYear() === year) result[d.getMonth()].faturamento += Number(s.amount);
      });
      (commRes.data ?? []).forEach((c) => {
        if (c.status !== "pago" || !c.paid_at) return;
        const d = new Date(c.paid_at);
        if (d.getFullYear() === year) result[d.getMonth()].comissoes += Number(c.amount);
      });
      result.forEach((r) => (r.liquido = r.faturamento - r.comissoes));
      return result;
    },
  });

  const { data: clientsGrowth } = useQuery({
    queryKey: ["dash-clients-growth"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("created_at");
      const result = PT_MONTHS.map((m) => ({ month: m, novos: 0 }));
      const year = new Date().getFullYear();
      (data ?? []).forEach((c) => {
        const d = new Date(c.created_at);
        if (d.getFullYear() === year) result[d.getMonth()].novos += 1;
      });
      return result;
    },
  });

  const { data: byCategory } = useQuery({
    queryKey: ["dash-by-cat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("amount, products(product_categories(name, color))");
      const map = new Map<string, { name: string; value: number; color: string }>();
      const palette = [C.success, C.info, C.warning, C.destructive, C.c5, C.c6];
      let i = 0;
      (data ?? []).forEach((s: any) => {
        const cat = s.products?.product_categories;
        if (!cat) return;
        const cur = map.get(cat.name) ?? { name: cat.name, value: 0, color: cat.color || palette[i++ % palette.length] };
        cur.value += Number(s.amount);
        map.set(cat.name, cur);
      });
      return Array.from(map.values());
    },
  });

  const { data: recentClients } = useQuery({
    queryKey: ["dash-recent-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: topPartners } = useQuery({
    queryKey: ["dash-top-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commissions")
        .select("amount, partner_id, partners(full_name, partner_type)");
      const map = new Map<string, { name: string; total: number; count: number; type: string }>();
      (data ?? []).forEach((c: any) => {
        if (!c.partners) return;
        const cur = map.get(c.partner_id) ?? {
          name: c.partners.full_name,
          total: 0,
          count: 0,
          type: c.partners.partner_type ?? "parceiro",
        };
        cur.total += Number(c.amount);
        cur.count += 1;
        map.set(c.partner_id, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["dash-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, action, description, created_at, entity_type")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  // ---------- derived ----------
  const totalRevenue = stats?.totalRevenue ?? 0;
  const paid = stats?.paidCommissions ?? 0;
  const taxes = totalRevenue * 0.022;
  const net = totalRevenue - paid - taxes;
  const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

  const kpis = [
    {
      label: "Clientes Ativos",
      value: String(stats?.clientsActive ?? 0),
      sub: `${stats?.clientsTotal ?? 0} no total`,
      delta: "+12.5%",
      positive: true,
      icon: Users,
      rail: "bg-success",
    },
    {
      label: "Projetos Ativos",
      value: String(stats?.projectsActive ?? 0),
      sub: `${formatBRL(stats?.projectsPipelineValue ?? 0)} em pipeline`,
      delta: "+8.4%",
      positive: true,
      icon: FolderKanban,
      rail: "bg-info",
    },
    {
      label: "Previstos (mês)",
      value: String(stats?.projectsExpectedMonth ?? 0),
      sub: formatBRL(stats?.projectsExpectedMonthValue ?? 0),
      delta: "+22.1%",
      positive: true,
      icon: CalendarClock,
      rail: "bg-warning",
    },
    {
      label: "Faturamento",
      value: formatBRL(totalRevenue),
      sub: `Margem ${margin.toFixed(1)}%`,
      delta: "+18.2%",
      positive: true,
      icon: DollarSign,
      rail: "bg-destructive",
    },
  ];

  // pipeline / funnel data
  const funnelLabels: Record<string, string> = {
    previsto: "Previsto",
    ativo: "Ativo",
    em_andamento: "Em andamento",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };
  const funnelTones: Record<string, string> = {
    previsto: "bg-warning",
    ativo: "bg-info",
    em_andamento: "bg-success",
    concluido: "bg-primary",
    cancelado: "bg-destructive",
  };
  const funnel = (stats?.projectsByStatus ?? []).filter((s) => s.status !== "cancelado");
  const funnelMax = Math.max(1, ...funnel.map((f) => f.amount));

  return (
    <div className="page-shell space-y-10">
      {/* ===== HERO ===== */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="vx-pill vx-pill-success">
              <span className="size-1.5 rounded-full bg-success" /> Live
            </span>
            <span className="vx-pill vx-pill-muted">
              {period === "month" ? "Mensal" : period === "quarter" ? "Trimestral" : "Anual"}
            </span>
          </div>
          <h1 className="font-display text-[40px] sm:text-[56px] font-black tracking-[-0.04em] leading-[0.95]">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Olá, {user?.email?.split("@")[0]}. Visão geral da operação em tempo real.
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <p className="vx-kpi-label">Faturamento total</p>
          <p className="font-display text-[64px] sm:text-[78px] font-black tracking-[-0.06em] tabular-nums leading-none">
            {formatBRL(totalRevenue)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="vx-pill vx-pill-success">
              <ArrowUpRight className="size-3" /> +18.2%
            </span>
            <span className="text-xs text-muted-foreground">vs. período anterior</span>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ===== KPI STRIP ===== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-border/70 lg:divide-x lg:divide-border/70 -mx-5 sm:-mx-8">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="relative px-6 py-7 hover:bg-muted/25 transition-colors duration-[220ms]">
              <span className={cn("absolute left-0 top-7 h-9 w-[3px] rounded-r-full", k.rail)} />
              <div className="flex items-center justify-between mb-4">
                <p className="vx-kpi-label">{k.label}</p>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="vx-kpi-value">{k.value}</p>
              <div className="flex items-center justify-between mt-3 gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-bold tabular-nums",
                    k.positive ? "text-success" : "text-destructive",
                  )}
                >
                  {k.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {k.delta}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">{k.sub}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ===== TOOLBAR ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="vx-segment">
          {(["month", "quarter", "year"] as const).map((p) => (
            <button key={p} className="vx-segment-item" data-active={period === p} onClick={() => setPeriod(p)}>
              {p === "month" ? "Mensal" : p === "quarter" ? "Trimestral" : "Anual"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="vx-pill hover:bg-muted/50 transition-colors">
            <Calendar className="size-3.5" /> Últimos 12 meses
          </button>
          <button className="vx-pill hover:bg-muted/50 transition-colors">
            <Download className="size-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* ===== ROW 1: AREA CHART + DONUT ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Faturamento vs Comissões */}
        <div className="lg:col-span-8 vx-card p-6">
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <p className="vx-kpi-label">Faturamento × Comissões</p>
              <p className="font-display text-[28px] font-black tabular-nums tracking-[-0.04em] mt-1">
                {formatBRL(totalRevenue)}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success" />
                  <span className="text-[11px] text-muted-foreground font-medium">Faturamento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive" />
                  <span className="text-[11px] text-muted-foreground font-medium">Comissões</span>
                </div>
              </div>
            </div>
            <span className="vx-pill vx-pill-success">
              <TrendingUp className="size-3" /> +18.2%
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={monthlySeries ?? []} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-fat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.success} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-com" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.destructive} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={C.destructive} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="faturamento" stroke={C.success} strokeWidth={2} fill="url(#grad-fat)" isAnimationActive={false} />
                <Area type="monotone" dataKey="comissoes" stroke={C.destructive} strokeWidth={1.5} fill="url(#grad-com)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Categoria */}
        <div className="lg:col-span-4 vx-card p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="vx-kpi-label">Por Categoria</p>
            <button className="vx-icon-btn">
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          {byCategory && byCategory.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {byCategory.map((c, i) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 mt-4">
                {byCategory.map((c) => {
                  const total = byCategory.reduce((s, x) => s + x.value, 0);
                  const pct = total ? ((c.value / total) * 100).toFixed(1) : "0";
                  return (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-[13px] font-medium truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{formatBRL(c.value)}</span>
                        <span className="text-[12px] font-bold tabular-nums w-12 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Target className="size-7 mb-2 opacity-40" />
              <p className="text-sm">Sem vendas ainda</p>
              <p className="text-xs mt-1">Cadastre vendas para ver a distribuição.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== ROW 2: PIPELINE FUNIL + CRESCIMENTO + LIQUIDO ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Pipeline funnel */}
        <div className="lg:col-span-5 vx-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="vx-kpi-label">Pipeline de Projetos</p>
              <p className="font-display text-[22px] font-black tabular-nums tracking-[-0.04em] mt-1">
                {formatBRL(stats?.projectsPipelineValue ?? 0)}
              </p>
            </div>
            <span className="vx-pill vx-pill-info">
              {(stats?.projectsByStatus ?? []).reduce((s, x) => s + x.count, 0)} projetos
            </span>
          </div>
          <div className="space-y-3">
            {funnel.map((f) => {
              const w = (f.amount / funnelMax) * 100;
              return (
                <div key={f.status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", funnelTones[f.status])} />
                      <span className="text-[12px] font-semibold">{funnelLabels[f.status]}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">({f.count})</span>
                    </div>
                    <span className="text-[12px] font-bold tabular-nums">{formatBRL(f.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div className={cn("h-full rounded-full", funnelTones[f.status])} style={{ width: `${Math.max(w, 2)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Crescimento de clientes (bar) */}
        <div className="lg:col-span-4 vx-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="vx-kpi-label">Novos Clientes</p>
              <p className="font-display text-[22px] font-black tabular-nums tracking-[-0.04em] mt-1">
                {(clientsGrowth ?? []).reduce((s, x) => s + x.novos, 0)}
              </p>
            </div>
            <span className="vx-pill vx-pill-success">
              <ArrowUpRight className="size-3" /> +12.5%
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={clientsGrowth ?? []} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="novos" fill={C.info} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="lg:col-span-3 vx-card p-5 border-t-2 border-t-success">
          <p className="vx-kpi-label mb-5">Resumo Financeiro</p>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Bruto</span>
              <span className="text-[13px] font-bold tabular-nums">{formatBRL(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Comissões</span>
              <span className="text-[13px] font-bold tabular-nums text-destructive">−{formatBRL(paid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Taxas</span>
              <span className="text-[13px] font-bold tabular-nums text-destructive">−{formatBRL(taxes)}</span>
            </div>
            <div className="section-divider !my-4" />
            <div>
              <p className="vx-kpi-label">Líquido</p>
              <p className="font-display text-[28px] font-black tabular-nums tracking-[-0.04em] text-success mt-1">
                {formatBRL(net)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">Margem {margin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ROW 3: LINHA LUCRO LÍQUIDO MENSAL (full width) ===== */}
      <section className="vx-card p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <p className="vx-kpi-label">Lucro Líquido Mensal</p>
            <p className="font-display text-[22px] font-black tabular-nums tracking-[-0.04em] mt-1">{formatBRL(net)}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" />
              <span className="text-muted-foreground font-medium">Líquido</span>
            </div>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={monthlySeries ?? []} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="liquido"
                stroke={C.success}
                strokeWidth={2.5}
                dot={{ r: 3, fill: C.success, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ===== ROW 4: TABELAS LADO A LADO ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Últimos clientes */}
        <div className="lg:col-span-5 vx-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <p className="vx-kpi-label">Últimos Clientes</p>
            <button className="text-[11px] font-bold text-success hover:underline">Ver todos →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-bold">Cliente</th>
                <th className="px-3 py-2.5 text-left font-bold">Empresa</th>
                <th className="px-3 py-2.5 text-left font-bold">Status</th>
                <th className="px-5 py-2.5 text-right font-bold">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(recentClients ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhum cliente cadastrado ainda
                  </td>
                </tr>
              ) : (
                recentClients?.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-muted text-foreground flex items-center justify-center text-[11px] font-bold">
                          {initials(c.full_name)}
                        </div>
                        <span className="font-semibold text-[13px]">{c.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-[13px]">{c.company ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "vx-pill",
                          c.status === "ativo" && "vx-pill-success",
                          c.status === "prospecto" && "vx-pill-warning",
                          c.status !== "ativo" && c.status !== "prospecto" && "vx-pill-muted",
                        )}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground text-xs tabular-nums">
                      {timeAgo(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Top parceiros */}
        <div className="lg:col-span-4 vx-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <p className="vx-kpi-label">Top Parceiros & Indicadores</p>
            <button className="text-[11px] font-bold text-success hover:underline">Ver todos →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-bold">Pessoa</th>
                <th className="px-3 py-2.5 text-right font-bold">Comissões</th>
                <th className="px-5 py-2.5 text-right font-bold">Indic.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(topPartners ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Sem comissões ainda
                  </td>
                </tr>
              ) : (
                topPartners?.map((p, i) => (
                  <tr key={p.name + i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="size-6 rounded-full ring-1 ring-border/60 text-[10px] font-black flex items-center justify-center tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px] truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {p.type === "indicador" ? "Indicador" : "Parceiro"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-[13px]">{formatBRL(p.total)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground text-[13px] tabular-nums">{p.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Atividades */}
        <div className="lg:col-span-3 vx-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <p className="vx-kpi-label">Atividades</p>
            <button className="text-[11px] font-bold text-success hover:underline">Ver →</button>
          </div>
          <div className="p-4 space-y-3.5">
            {(activities ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade ainda.</p>
            ) : (
              activities?.map((a: any) => {
                const meta = activityMeta[a.entity_type as string] || activityMeta.cliente;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0", meta.tone)}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold leading-tight truncate">{a.action}</p>
                      <p className="text-[10.5px] text-muted-foreground truncate">{a.description ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ===== ROW 5: BADGES DE SAÚDE ===== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle2, label: "Comissões em dia", value: "98%", tone: "text-success bg-success/15" },
          { icon: Clock, label: "Tempo médio fechamento", value: "12d", tone: "text-info bg-info/15" },
          { icon: AlertCircle, label: "Documentos pendentes", value: String((stats?.projectsExpectedMonth ?? 0)), tone: "text-warning bg-warning/15" },
          { icon: Target, label: "Meta do mês", value: "76%", tone: "text-primary bg-primary/15" },
        ].map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.label} className="vx-card p-4 flex items-center gap-3">
              <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", b.tone)}>
                <Icon className="size-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground truncate">{b.label}</p>
                <p className="font-display text-[22px] font-black tabular-nums tracking-[-0.04em] mt-0.5">{b.value}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
