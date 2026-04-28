import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Handshake,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  UserPlus,
  Coins,
  FileUp,
  FileSignature,
  FolderKanban,
  Calendar,
  ChevronDown,
  Bell,
  Sparkles,
  Target,
  Zap,
  TrendingUp,
  Package,
  Trophy,
  Filter,
  Plus,
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
  LineChart,
  Line,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const C = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  c5: "hsl(var(--chart-5))",
  c6: "hsl(var(--chart-6))",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "12px",
  padding: "10px 12px",
  boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.16)",
};

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const activityMeta: Record<string, { icon: any; tone: string }> = {
  cliente: { icon: UserPlus, tone: "bg-primary/10 text-primary" },
  contrato: { icon: FileSignature, tone: "bg-success/10 text-success" },
  comissao: { icon: Coins, tone: "bg-warning/10 text-warning" },
  documento: { icon: FileUp, tone: "bg-info/10 text-info" },
  parceiro: { icon: Handshake, tone: "bg-[hsl(var(--chart-5))]/10 text-[hsl(var(--chart-5))]" },
  projeto: { icon: FolderKanban, tone: "bg-info/10 text-info" },
};

const sparkData = (seed: number) =>
  Array.from({ length: 16 }).map((_, i) => ({
    x: i,
    y: 22 + Math.abs(Math.sin(i * 0.6 + seed) * 28) + ((i * seed) % 7),
  }));

export default function Dashboard() {
  const { user } = useAuth();

  // ---------- queries ----------
  const { data: stats } = useQuery({
    queryKey: ["dash-core"],
    queryFn: async () => {
      const [clients, partners, sales, commissions] = await Promise.all([
        supabase.from("clients").select("id, status"),
        supabase.from("partners").select("id").eq("active", true),
        supabase.from("sales").select("amount, sale_date"),
        supabase.from("commissions").select("amount, status"),
      ]);

      const totalRevenue = (sales.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const paidCommissions = (commissions.data ?? [])
        .filter((c) => c.status === "pago")
        .reduce((s, x) => s + Number(x.amount), 0);

      return {
        clientsActive: (clients.data ?? []).filter((c) => c.status === "ativo").length,
        partnersActive: partners.data?.length ?? 0,
        totalRevenue,
        paidCommissions,
        salesCount: sales.data?.length ?? 0,
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

  const { data: byCategory } = useQuery({
    queryKey: ["dash-by-cat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("amount, products(product_categories(name, color))");
      const map = new Map<string, { name: string; value: number; color: string }>();
      const palette = [C.primary, C.success, C.warning, C.info, C.c5, C.c6];
      let i = 0;
      (data ?? []).forEach((s: any) => {
        const cat = s.products?.product_categories;
        if (!cat) return;
        const cur = map.get(cat.name) ?? {
          name: cat.name,
          value: 0,
          color: cat.color || palette[i++ % palette.length],
        };
        cur.value += Number(s.amount);
        map.set(cat.name, cur);
      });
      return Array.from(map.values());
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["dash-top-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("amount, products(name)");
      const map = new Map<string, { name: string; total: number; count: number }>();
      (data ?? []).forEach((s: any) => {
        if (!s.products?.name) return;
        const cur = map.get(s.products.name) ?? { name: s.products.name, total: 0, count: 0 };
        cur.total += Number(s.amount);
        cur.count += 1;
        map.set(s.products.name, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 4);
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
        .select("amount, partner_id, partners(full_name, active)");
      const map = new Map<string, { name: string; total: number; count: number; active: boolean }>();
      (data ?? []).forEach((c: any) => {
        if (!c.partners) return;
        const cur = map.get(c.partner_id) ?? {
          name: c.partners.full_name,
          total: 0,
          count: 0,
          active: c.partners.active,
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

  // derived
  const totalRevenue = stats?.totalRevenue ?? 0;
  const paid = stats?.paidCommissions ?? 0;
  const taxes = totalRevenue * 0.022;
  const net = totalRevenue - paid - taxes;
  const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

  // Meta mock (visual)
  const goal = 500_000;
  const goalPct = Math.min(100, Math.round((totalRevenue / goal) * 100));

  // Heatmap dos últimos 7 meses (visual)
  const heatmap = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      const idx = d.getMonth();
      const v = monthlySeries?.[idx]?.faturamento ?? 0;
      return { label: PT_MONTHS[idx], value: v };
    });
  }, [monthlySeries]);
  const heatmapMax = Math.max(1, ...heatmap.map((h) => h.value));

  const kpis = [
    {
      label: "Faturamento Total",
      value: formatBRL(totalRevenue),
      delta: "+18.2%",
      positive: true,
      icon: DollarSign,
      tone: "bg-primary/10 text-primary",
      stroke: C.primary,
      seed: 1,
    },
    {
      label: "Clientes Ativos",
      value: String(stats?.clientsActive ?? 0),
      delta: "+12.5%",
      positive: true,
      icon: Users,
      tone: "bg-success/10 text-success",
      stroke: C.success,
      seed: 2,
    },
    {
      label: "Parceiros Ativos",
      value: String(stats?.partnersActive ?? 0),
      delta: "+8.1%",
      positive: true,
      icon: Handshake,
      tone: "bg-warning/10 text-warning",
      stroke: C.warning,
      seed: 3,
    },
    {
      label: "Comissões Pagas",
      value: formatBRL(paid),
      delta: "+15.3%",
      positive: true,
      icon: Wallet,
      tone: "bg-info/10 text-info",
      stroke: C.info,
      seed: 4,
    },
  ];

  const totalCat = (byCategory ?? []).reduce((s, x) => s + x.value, 0);

  return (
    <div className="page-shell space-y-6">
      {/* ===== HEADER ===== */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="vx-pill vx-pill-success">
              <span className="vx-dot bg-success animate-pulse" /> Live
            </span>
            <span className="vx-pill vx-pill-muted">
              <Sparkles className="size-3" /> IA Insights
            </span>
          </div>
          <h1 className="font-display text-[34px] font-bold tracking-[-0.02em] leading-none">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Bem-vindo de volta, <span className="font-semibold text-foreground">{user?.email?.split("@")[0] ?? "Admin"}</span>! Aqui está o resumo do seu negócio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-border bg-card text-[13px] font-medium hover:bg-muted/50 transition-colors">
            <Filter className="size-4 text-muted-foreground" />
            <span>Filtros</span>
          </button>
          <button className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-border bg-card text-[13px] font-medium hover:bg-muted/50 transition-colors">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="tabular-nums">01/05 — 31/05/2024</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          <button className="relative size-10 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors">
            <Bell className="size-4 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
              3
            </span>
          </button>
          <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-foreground text-background text-[13px] font-bold hover:bg-foreground/90 transition-colors">
            <Plus className="size-4" /> Novo
          </button>
        </div>
      </header>

      {/* ===== KPI CARDS ===== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          const data = sparkData(k.seed);
          return (
            <div key={k.label} className="vx-card vx-card-hover p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.04] pointer-events-none" style={{ background: `radial-gradient(circle at 70% 30%, ${k.stroke}, transparent 70%)` }} />
              <div className="flex items-start gap-4 relative">
                <div className={cn("size-12 rounded-2xl flex items-center justify-center shrink-0", k.tone)}>
                  <Icon className="size-5" strokeWidth={2.25} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="font-display text-[26px] font-bold tabular-nums tracking-[-0.025em] mt-1.5 truncate">
                    {k.value}
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between mt-3 gap-3 relative">
                <div>
                  <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-bold tabular-nums", k.positive ? "text-success" : "text-destructive")}>
                    {k.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {k.delta}
                  </span>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">vs. período anterior</p>
                </div>
                <div className="h-10 w-28">
                  <ResponsiveContainer>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id={`spark-${k.seed}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={k.stroke} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={k.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="y" stroke={k.stroke} strokeWidth={1.75} fill={`url(#spark-${k.seed})`} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ===== ROW: FATURAMENTO + DONUT + META RADIAL ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Faturamento (área grande) */}
        <div className="lg:col-span-7 vx-card vx-card-hover p-5">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Faturamento × Comissões
              </p>
              <p className="font-display text-[28px] font-bold tabular-nums tracking-[-0.025em] mt-1">
                {formatBRL(totalRevenue)}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="text-[11px] text-muted-foreground font-medium">Faturamento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive" />
                  <span className="text-[11px] text-muted-foreground font-medium">Comissões</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="vx-segment">
                <button className="vx-segment-item" data-active="false">D</button>
                <button className="vx-segment-item" data-active="false">S</button>
                <button className="vx-segment-item" data-active="true">M</button>
                <button className="vx-segment-item" data-active="false">A</button>
              </div>
              <button className="vx-icon-btn"><MoreHorizontal className="size-4" /></button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={monthlySeries ?? []} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-fat-main" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-com-main" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.destructive} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={C.destructive} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey="faturamento" stroke={C.primary} strokeWidth={2.5} fill="url(#grad-fat-main)" dot={{ r: 3, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }} isAnimationActive={false} />
                <Area type="monotone" dataKey="comissoes" stroke={C.destructive} strokeWidth={1.75} fill="url(#grad-com-main)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut por produto */}
        <div className="lg:col-span-3 vx-card vx-card-hover p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Por Produto
            </p>
            <button className="vx-icon-btn"><MoreHorizontal className="size-4" /></button>
          </div>
          {byCategory && byCategory.length > 0 ? (
            <>
              <div className="h-40 relative">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive={false}>
                      {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="font-display text-[16px] font-bold tabular-nums">{formatBRL(totalCat)}</span>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                {byCategory.slice(0, 4).map((c) => {
                  const pct = totalCat ? ((c.value / totalCat) * 100).toFixed(1) : "0";
                  return (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-[12px] font-semibold truncate">{c.name}</span>
                      </div>
                      <span className="text-[12px] font-bold tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              Sem vendas ainda
            </div>
          )}
        </div>

        {/* Meta radial */}
        <div className="lg:col-span-2 vx-card vx-card-hover p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3 relative">
            Meta do Mês
          </p>
          <div className="h-32 relative">
            <ResponsiveContainer>
              <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%" barSize={9} data={[{ name: "meta", value: goalPct, fill: C.primary }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={20} isAnimationActive={false} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-display text-[24px] font-bold tabular-nums tracking-tight">{goalPct}%</span>
              <span className="text-[10px] text-muted-foreground font-semibold">atingido</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Meta</span>
              <span className="text-[12px] font-bold tabular-nums">{formatBRL(goal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Faltam</span>
              <span className="text-[12px] font-bold tabular-nums text-warning">{formatBRL(Math.max(0, goal - totalRevenue))}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ROW: BARRAS EMPILHADAS + TOP PRODUTOS + ATIVIDADES ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Performance mensal (barras) */}
        <div className="lg:col-span-5 vx-card vx-card-hover p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Performance Mensal
              </p>
              <p className="font-display text-[20px] font-bold tabular-nums tracking-tight mt-1">
                {formatBRL(net)} <span className="text-[12px] font-normal text-muted-foreground">líquido</span>
              </p>
            </div>
            <span className="vx-pill vx-pill-success">
              <TrendingUp className="size-3" /> +22.4%
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={monthlySeries ?? []} margin={{ left: -8, right: 4, top: 8, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="faturamento" fill={C.primary} radius={[6, 6, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="liquido" fill={C.success} radius={[6, 6, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /><span className="text-[11px] text-muted-foreground">Bruto</span></div>
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /><span className="text-[11px] text-muted-foreground">Líquido</span></div>
          </div>
        </div>

        {/* Top Produtos */}
        <div className="lg:col-span-4 vx-card vx-card-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Top Produtos
            </p>
            <button className="text-[11px] font-semibold text-primary hover:underline">Ver todos</button>
          </div>
          <div className="space-y-3.5">
            {(topProducts ?? []).length === 0 ? (
              <div className="py-8 text-center">
                <Package className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sem produtos vendidos</p>
              </div>
            ) : (
              topProducts?.map((p, i) => {
                const max = Math.max(...(topProducts ?? []).map((x) => x.total));
                const w = max ? (p.total / max) * 100 : 0;
                const colors = [C.primary, C.success, C.warning, C.info];
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-[13px] font-semibold truncate">{p.name}</span>
                      </div>
                      <span className="text-[12px] font-bold tabular-nums">{formatBRL(p.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: colors[i] }} />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-1 tabular-nums">{p.count} vendas</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Atividades Recentes */}
        <div className="lg:col-span-3 vx-card vx-card-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Atividades
            </p>
            <span className="vx-pill vx-pill-primary">
              <Zap className="size-2.5" /> Live
            </span>
          </div>
          <div className="space-y-3.5">
            {(activities ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade ainda.</p>
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
                      <p className="text-[12.5px] font-semibold leading-tight truncate">{a.action}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.description ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ===== ROW: HEATMAP + TABELAS ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Heatmap simples */}
        <div className="lg:col-span-12 vx-card vx-card-hover p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Mapa de Faturamento — Últimos 7 meses
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">Intensidade representa volume relativo</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-2">menos</span>
              {[0.15, 0.3, 0.5, 0.7, 0.95].map((o) => (
                <span key={o} className="size-3 rounded" style={{ background: `hsl(var(--primary) / ${o})` }} />
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">mais</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmap.map((h, i) => {
              const intensity = h.value / heatmapMax;
              return (
                <div key={i} className="vx-card p-3 text-center transition-transform hover:scale-[1.02]" style={{ background: `hsl(var(--primary) / ${0.06 + intensity * 0.18})`, borderColor: `hsl(var(--primary) / ${0.1 + intensity * 0.3})` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h.label}</p>
                  <p className="font-display text-[18px] font-bold tabular-nums tracking-tight mt-1">{formatBRL(h.value)}</p>
                  <div className="h-1 rounded-full bg-primary/15 mt-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(intensity * 100, 4)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== ROW: TABELAS + RESUMO FINANCEIRO ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Últimos clientes */}
        <div className="lg:col-span-5 vx-card vx-card-hover overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Últimos Clientes
            </p>
            <button className="text-[12px] font-semibold text-primary hover:underline">Ver todos</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground bg-muted/30">
                <th className="px-5 py-2.5 text-left font-bold">Cliente</th>
                <th className="px-3 py-2.5 text-left font-bold">Empresa</th>
                <th className="px-3 py-2.5 text-left font-bold">Status</th>
                <th className="px-5 py-2.5 text-right font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentClients ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhum cliente cadastrado ainda
                  </td>
                </tr>
              ) : (
                recentClients?.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                          {initials(c.full_name)}
                        </div>
                        <span className="font-semibold text-[13px]">{c.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground text-[13px]">{c.company ?? "—"}</td>
                    <td className="px-3 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        c.status === "ativo" && "bg-success/15 text-success",
                        c.status === "prospecto" && "bg-warning/15 text-warning",
                        c.status !== "ativo" && c.status !== "prospecto" && "bg-muted text-muted-foreground")}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button className="size-7 rounded-md hover:bg-muted inline-flex items-center justify-center text-muted-foreground">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Top parceiros */}
        <div className="lg:col-span-4 vx-card vx-card-hover overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Top Parceiros
            </p>
            <button className="text-[12px] font-semibold text-primary hover:underline">Ver todos</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground bg-muted/30">
                <th className="px-5 py-2.5 text-left font-bold">Parceiro</th>
                <th className="px-3 py-2.5 text-right font-bold">Comissões</th>
                <th className="px-5 py-2.5 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(topPartners ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Sem comissões ainda
                  </td>
                </tr>
              ) : (
                topPartners?.map((p, i) => {
                  const trophyColor = ["text-warning", "text-muted-foreground", "text-[#CD7F32]"][i] || "text-muted-foreground";
                  return (
                    <tr key={p.name + i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {i < 3 ? (
                            <Trophy className={cn("size-4", trophyColor)} />
                          ) : (
                            <span className="size-5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                              {i + 1}
                            </span>
                          )}
                          <span className="font-semibold text-[13px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums font-bold text-[13px]">{formatBRL(p.total)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Resumo Financeiro */}
        <div className="lg:col-span-3 vx-card vx-card-hover p-5 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 size-32 rounded-full bg-primary/[0.06] blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-5 relative">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Target className="size-3.5" />
            </div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Resumo Financeiro
            </p>
          </div>
          <div className="space-y-3.5 relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Faturamento Bruto</span>
              <span className="text-[13px] font-bold tabular-nums">{formatBRL(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Comissões</span>
              <span className="text-[13px] font-bold tabular-nums text-destructive">−{formatBRL(paid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Taxas (2,2%)</span>
              <span className="text-[13px] font-bold tabular-nums text-destructive">−{formatBRL(taxes)}</span>
            </div>
            <div className="section-divider" />
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/[0.04] border border-primary/15 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-primary">Líquido</span>
                <span className="font-display text-[18px] font-bold tabular-nums text-primary tracking-tight">
                  {formatBRL(net)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-primary/15 mt-2.5 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, margin)}%` }} />
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-2 tabular-nums">Margem {margin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
