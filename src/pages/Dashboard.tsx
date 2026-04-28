import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
  Target,
  Zap,
  TrendingUp,
  Package,
  Trophy,
  Filter,
  Plus,
  Activity as ActivityIcon,
  CalendarDays,
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
const PT_MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PT_DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

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

  // ===== State: month + selected day =====
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // null = full month

  const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewMonth, viewYear]);

  const monthLabel = `${PT_MONTHS_FULL[viewMonth]} ${viewYear}`;
  const monthStart = useMemo(() => new Date(viewYear, viewMonth, 1), [viewMonth, viewYear]);
  const monthEnd = useMemo(() => new Date(viewYear, viewMonth + 1, 0, 23, 59, 59), [viewMonth, viewYear]);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const monthEndIso = monthEnd.toISOString().slice(0, 10);

  function inSelectedRange(d: Date) {
    if (selectedDay) {
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === selectedDay;
    }
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  }

  // ===== queries — all month-bound =====
  const { data: monthSales } = useQuery({
    queryKey: ["dash-month-sales", viewYear, viewMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("amount, sale_date, status, partner_id, products(name, product_categories(name, color))")
        .gte("sale_date", monthStartIso)
        .lte("sale_date", monthEndIso);
      return data ?? [];
    },
  });

  const { data: monthCommissions } = useQuery({
    queryKey: ["dash-month-comms", viewYear, viewMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("commissions")
        .select("amount, status, paid_at, partner_id, partners(full_name, active)");
      return (data ?? []).filter((c: any) => {
        if (!c.paid_at) return false;
        const d = new Date(c.paid_at);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      });
    },
  });

  const { data: monthClients } = useQuery({
    queryKey: ["dash-month-clients", viewYear, viewMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company, status, created_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allTimePartners } = useQuery({
    queryKey: ["dash-partners-active"],
    queryFn: async () => {
      const { count } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("active", true);
      return count ?? 0;
    },
  });

  const { data: monthActivities } = useQuery({
    queryKey: ["dash-month-activities", viewYear, viewMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, action, description, created_at, entity_type")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
  });

  // ===== Per-day buckets for the month =====
  const perDay = useMemo(() => {
    const out = Array.from({ length: daysInMonth }).map((_, i) => ({
      day: i + 1,
      label: String(i + 1).padStart(2, "0"),
      faturamento: 0,
      comissoes: 0,
      clientes: 0,
      vendas: 0,
    }));
    (monthSales ?? []).forEach((s: any) => {
      const d = new Date(s.sale_date);
      const idx = d.getDate() - 1;
      if (out[idx]) {
        out[idx].faturamento += Number(s.amount);
        out[idx].vendas += 1;
      }
    });
    (monthCommissions ?? []).forEach((c: any) => {
      const d = new Date(c.paid_at);
      const idx = d.getDate() - 1;
      if (out[idx]) out[idx].comissoes += Number(c.amount);
    });
    (monthClients ?? []).forEach((c: any) => {
      const d = new Date(c.created_at);
      const idx = d.getDate() - 1;
      if (out[idx]) out[idx].clientes += 1;
    });
    return out;
  }, [monthSales, monthCommissions, monthClients, daysInMonth]);

  const maxDayRev = Math.max(1, ...perDay.map((d) => d.faturamento));

  // ===== Filtered KPIs (by selectedDay) =====
  const filtered = useMemo(() => {
    const sales = (monthSales ?? []).filter((s: any) => inSelectedRange(new Date(s.sale_date)));
    const comms = (monthCommissions ?? []).filter((c: any) => inSelectedRange(new Date(c.paid_at)));
    const clients = (monthClients ?? []).filter((c: any) => inSelectedRange(new Date(c.created_at)));
    const activities = (monthActivities ?? []).filter((a: any) => inSelectedRange(new Date(a.created_at)));

    const totalRevenue = sales.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = comms.reduce((s, x: any) => s + Number(x.amount), 0);
    const newClients = clients.length;
    const concluidas = sales.filter((s: any) => s.status === "concluida").length;

    // top categories
    const catMap = new Map<string, { name: string; value: number; color: string }>();
    const palette = [C.primary, C.success, C.warning, C.info, C.c5, C.c6];
    let i = 0;
    sales.forEach((s: any) => {
      const cat = s.products?.product_categories;
      const key = cat?.name ?? "Outros";
      const color = cat?.color ?? palette[i++ % palette.length];
      const cur = catMap.get(key) ?? { name: key, value: 0, color };
      cur.value += Number(s.amount);
      catMap.set(key, cur);
    });

    // top products
    const prodMap = new Map<string, { name: string; total: number; count: number }>();
    sales.forEach((s: any) => {
      const n = s.products?.name;
      if (!n) return;
      const cur = prodMap.get(n) ?? { name: n, total: 0, count: 0 };
      cur.total += Number(s.amount);
      cur.count += 1;
      prodMap.set(n, cur);
    });

    // top partners
    const partMap = new Map<string, { name: string; total: number; count: number; active: boolean }>();
    comms.forEach((c: any) => {
      if (!c.partners) return;
      const cur = partMap.get(c.partner_id) ?? { name: c.partners.full_name, total: 0, count: 0, active: c.partners.active };
      cur.total += Number(c.amount);
      cur.count += 1;
      partMap.set(c.partner_id, cur);
    });

    return {
      sales,
      totalRevenue,
      paid,
      newClients,
      concluidas,
      clients,
      activities,
      categories: Array.from(catMap.values()),
      topProducts: Array.from(prodMap.values()).sort((a, b) => b.total - a.total).slice(0, 4),
      topPartners: Array.from(partMap.values()).sort((a, b) => b.total - a.total).slice(0, 5),
    };
  }, [monthSales, monthCommissions, monthClients, monthActivities, selectedDay, viewYear, viewMonth]);

  const totalRevenue = filtered.totalRevenue;
  const paid = filtered.paid;
  const taxes = totalRevenue * 0.022;
  const net = totalRevenue - paid - taxes;
  const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

  const goal = 500_000;
  const goalPct = Math.min(100, Math.round((totalRevenue / goal) * 100));
  const totalCat = filtered.categories.reduce((s, x) => s + x.value, 0);

  const kpis = [
    {
      label: selectedDay ? "Faturamento do Dia" : "Faturamento do Mês",
      value: formatBRL(totalRevenue),
      delta: "+18.2%",
      positive: true,
      icon: DollarSign,
      tone: "bg-primary/10 text-primary",
      stroke: C.primary,
      seed: 1,
    },
    {
      label: selectedDay ? "Novos Clientes" : "Clientes do Mês",
      value: String(filtered.newClients),
      delta: "+12.5%",
      positive: true,
      icon: Users,
      tone: "bg-success/10 text-success",
      stroke: C.success,
      seed: 2,
    },
    {
      label: "Parceiros Ativos",
      value: String(allTimePartners ?? 0),
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

  // Animation key to retrigger when day changes
  const animKey = `${viewYear}-${viewMonth}-${selectedDay ?? "all"}`;

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDay(null);
  }

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
            <span className="vx-pill vx-pill-primary">
              <CalendarDays className="size-3" /> {selectedDay ? `Dia ${String(selectedDay).padStart(2, "0")}/${String(viewMonth + 1).padStart(2, "0")}` : "Mês inteiro"}
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
          {/* Day filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-border bg-card text-[13px] font-medium hover:bg-muted/50 transition-colors">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="tabular-nums">
                  {selectedDay ? `Dia ${String(selectedDay).padStart(2, "0")}` : "Mês inteiro"}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <button
                onClick={() => setSelectedDay(null)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-[13px] font-medium mb-1 flex items-center justify-between",
                  selectedDay === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <span>Mês inteiro</span>
                <span className="text-[11px] opacity-70 tabular-nums">{formatBRL(perDay.reduce((s, d) => s + d.faturamento, 0))}</span>
              </button>
              {today.getMonth() === viewMonth && today.getFullYear() === viewYear && (
                <button
                  onClick={() => setSelectedDay(today.getDate())}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-[13px] font-medium mb-1 flex items-center justify-between",
                    selectedDay === today.getDate() ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  <span>Hoje · dia {today.getDate()}</span>
                  <span className="text-[11px] opacity-70 tabular-nums">{formatBRL(perDay[today.getDate() - 1]?.faturamento ?? 0)}</span>
                </button>
              )}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 pt-2 pb-1">Selecione um dia</div>
              <div className="grid grid-cols-7 gap-1 p-1 max-h-[220px] overflow-y-auto">
                {perDay.map((d) => {
                  const isActive = selectedDay === d.day;
                  const isToday = d.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                  const hasData = d.faturamento > 0;
                  return (
                    <button
                      key={d.day}
                      onClick={() => setSelectedDay(d.day)}
                      className={cn(
                        "relative h-9 rounded-md text-[12px] font-semibold tabular-nums transition-colors flex items-center justify-center",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : hasData
                            ? "bg-primary/10 text-foreground hover:bg-primary/20"
                            : "text-muted-foreground hover:bg-muted",
                        isToday && !isActive && "ring-1 ring-primary/40"
                      )}
                      title={`Dia ${d.label} — ${formatBRL(d.faturamento)} · ${d.vendas} vendas`}
                    >
                      {d.label}
                      {hasData && !isActive && (
                        <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="inline-flex items-center h-10 rounded-lg border border-border bg-card overflow-hidden">
            <button onClick={() => shiftMonth(-1)} className="size-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <div className="px-3 inline-flex items-center gap-2 text-[13px] font-semibold tabular-nums">
              <Calendar className="size-4 text-muted-foreground" />
              {monthLabel}
            </div>
            <button onClick={() => shiftMonth(1)} className="size-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>
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

      {/* ===== KPI CARDS (animated when day changes) ===== */}
      <section key={`kpi-${animKey}`} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k, idx) => {
          const Icon = k.icon;
          const data = sparkData(k.seed);
          return (
            <div
              key={k.label}
              className="vx-card vx-card-hover p-5 relative overflow-hidden vx-animate-in"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
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

      {/* ===== ROW: PER-DAY CHART + DONUT + META ===== */}
      <section key={`row1-${animKey}`} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Per-day faturamento */}
        <div className="lg:col-span-7 vx-card vx-card-hover p-5 vx-animate-in">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Faturamento Diário · {monthLabel}
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
            <button className="vx-icon-btn"><MoreHorizontal className="size-4" /></button>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={perDay} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-fat-day" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-com-day" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.destructive} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={C.destructive} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => formatBRL(v)}
                  labelFormatter={(l) => `Dia ${l}`}
                  cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area type="monotone" dataKey="faturamento" stroke={C.primary} strokeWidth={2.5} fill="url(#grad-fat-day)" dot={{ r: 2.5, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }} isAnimationActive={true} animationDuration={700} />
                <Area type="monotone" dataKey="comissoes" stroke={C.destructive} strokeWidth={1.75} fill="url(#grad-com-day)" dot={false} isAnimationActive={true} animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut por categoria */}
        <div className="lg:col-span-3 vx-card vx-card-hover p-5 vx-animate-in" style={{ animationDelay: "60ms" }}>
          <div className="flex items-start justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Por Categoria
            </p>
            <button className="vx-icon-btn"><MoreHorizontal className="size-4" /></button>
          </div>
          {filtered.categories.length > 0 ? (
            <>
              <div className="h-40 relative">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={filtered.categories} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive={true} animationDuration={600}>
                      {filtered.categories.map((c, i) => <Cell key={i} fill={c.color} />)}
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
                {filtered.categories.slice(0, 4).map((c) => {
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
              Sem vendas no período
            </div>
          )}
        </div>

        {/* Meta radial */}
        <div className="lg:col-span-2 vx-card vx-card-hover p-5 relative overflow-hidden vx-animate-in" style={{ animationDelay: "120ms" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3 relative">
            Meta do Mês
          </p>
          <div className="h-32 relative">
            <ResponsiveContainer>
              <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%" barSize={9} data={[{ name: "meta", value: goalPct, fill: C.primary }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={20} isAnimationActive={true} animationDuration={800} />
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

      {/* ===== ROW: PER-DAY BARS + TOP PRODUTOS + ATIVIDADES ===== */}
      <section key={`row2-${animKey}`} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 vx-card vx-card-hover p-5 vx-animate-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Vendas por Dia
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
              <BarChart data={perDay} margin={{ left: -8, right: 4, top: 8, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} labelFormatter={(l) => `Dia ${l}`} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="faturamento" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={true} animationDuration={700}>
                  {perDay.map((d) => (
                    <Cell key={d.day} fill={selectedDay === d.day ? C.primary : `hsl(var(--primary) / ${0.45 + (d.faturamento / maxDayRev) * 0.55})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Produtos */}
        <div className="lg:col-span-4 vx-card vx-card-hover p-5 vx-animate-in" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Top Produtos
            </p>
            <button className="text-[11px] font-semibold text-primary hover:underline">Ver todos</button>
          </div>
          <div className="space-y-3.5">
            {filtered.topProducts.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sem produtos no período</p>
              </div>
            ) : (
              filtered.topProducts.map((p, i) => {
                const max = Math.max(...filtered.topProducts.map((x) => x.total));
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
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, background: colors[i] }} />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-1 tabular-nums">{p.count} vendas</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Atividades */}
        <div className="lg:col-span-3 vx-card vx-card-hover p-5 vx-animate-in" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Atividades
            </p>
            <span className="vx-pill vx-pill-primary">
              <Zap className="size-2.5" /> Live
            </span>
          </div>
          <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
            {filtered.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade no período.</p>
            ) : (
              filtered.activities.slice(0, 8).map((a: any) => {
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

      {/* ===== ROW: TABELAS + RESUMO FINANCEIRO ===== */}
      <section key={`row3-${animKey}`} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Clientes (no período) */}
        <div className="lg:col-span-5 vx-card vx-card-hover overflow-hidden vx-animate-in">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {selectedDay ? `Clientes do dia ${selectedDay}` : "Clientes do mês"}
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
              {filtered.clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhum cliente no período
                  </td>
                </tr>
              ) : (
                filtered.clients.slice(0, 6).map((c: any) => (
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
        <div className="lg:col-span-4 vx-card vx-card-hover overflow-hidden vx-animate-in" style={{ animationDelay: "60ms" }}>
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
              {filtered.topPartners.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Sem comissões no período
                  </td>
                </tr>
              ) : (
                filtered.topPartners.map((p, i) => {
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
        <div className="lg:col-span-3 vx-card vx-card-hover p-5 relative overflow-hidden vx-animate-in" style={{ animationDelay: "120ms" }}>
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
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(100, margin)}%` }} />
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-2 tabular-nums">Margem {margin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
