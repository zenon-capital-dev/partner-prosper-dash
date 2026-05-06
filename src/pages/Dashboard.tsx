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
  Calendar as CalendarIcon,
  Bell,
  Sparkles,
  Target,
  
  TrendingUp,
  Package,
  Trophy,
  Plus,
  CalendarDays,
  Clock,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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

const demoProducts = [
  { name: "CRM Enterprise", category: "Software", color: C.primary, avg: 42800 },
  { name: "Implantação Premium", category: "Serviços", color: C.success, avg: 28600 },
  { name: "Treinamento Comercial", category: "Educação", color: C.warning, avg: 18400 },
  { name: "Automação Financeira", category: "Operações", color: C.info, avg: 35200 },
  { name: "Suporte Platinum", category: "Recorrência", color: C.c5, avg: 22900 },
];

const demoPartners = ["Marina Costa", "Rafael Almeida", "Bruno Nogueira", "Camila Torres", "Felipe Duarte"];
const demoClients = [
  ["Helena Martins", "Atlas Energia"],
  ["João Ribeiro", "Nexa Foods"],
  ["Bianca Lopes", "Vértice Capital"],
  ["Caio Fernandes", "Orion Log"],
  ["Larissa Cunha", "BluePeak Tech"],
  ["Diego Ramos", "Prisma Health"],
  ["Sofia Barros", "Lumina Retail"],
];

function makeDemoDashboard(range: { from: Date; to: Date }, rangeKey: RangeKey) {
  const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000));
  const count = rangeKey === "today" ? 7 : rangeKey === "7d" ? 18 : 34;
  const sales = Array.from({ length: count }).map((_, i) => {
    const product = demoProducts[i % demoProducts.length];
    const date = new Date(range.from);
    date.setDate(date.getDate() + (i % days));
    date.setHours(9 + (i % 9), (i * 13) % 60, 0, 0);
    return {
      amount: Math.round(product.avg * (0.72 + ((i % 6) * 0.11))),
      sale_date: date.toISOString().slice(0, 10),
      status: i % 9 === 0 ? "pendente" : i % 7 === 0 ? "em_andamento" : "concluida",
      partner_id: `demo-partner-${i % demoPartners.length}`,
      products: {
        name: product.name,
        product_categories: { name: product.category, color: product.color },
      },
    };
  });

  const commissions = sales
    .filter((s) => s.status === "concluida")
    .map((s, i) => ({
      amount: Math.round(Number(s.amount) * 0.12),
      status: "paga",
      paid_at: new Date(new Date(s.sale_date).getTime() + 86400000).toISOString(),
      partner_id: s.partner_id,
      partners: { full_name: demoPartners[i % demoPartners.length], active: true },
    }));

  const clients = demoClients.slice(0, Math.min(demoClients.length, rangeKey === "today" ? 3 : 7)).map(([full_name, company], i) => {
    const created = new Date(range.to);
    created.setDate(created.getDate() - i);
    return { id: `demo-client-${i}`, full_name, company, status: i % 3 === 0 ? "prospecto" : "ativo", created_at: created.toISOString() };
  });

  const activities = [
    ["Venda concluída", "CRM Enterprise vendido para Atlas Energia", "contrato"],
    ["Novo cliente", "Nexa Foods entrou no funil comercial", "cliente"],
    ["Comissão paga", "Repasse liberado para Marina Costa", "comissao"],
    ["Documento enviado", "Contrato assinado anexado ao cliente", "documento"],
    ["Parceiro ativado", "Rafael Almeida começou nova campanha", "parceiro"],
    ["Projeto iniciado", "Implantação Premium em andamento", "projeto"],
  ].map(([action, description, entity_type], i) => {
    const created = new Date(range.to);
    created.setHours(created.getHours() - i * 4);
    return { id: `demo-activity-${i}`, action, description, entity_type, created_at: created.toISOString() };
  });

  return { sales, commissions, clients, activities, activePartners: 11 };
}

type RangeKey = "today" | "7d" | "30d" | "month" | "custom";

function makeRange(key: RangeKey, custom?: { from?: Date; to?: Date }): { from: Date; to: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Hoje" };
    case "7d": {
      const f = new Date(now); f.setDate(f.getDate() - 6);
      return { from: startOfDay(f), to: endOfDay(now), label: "Últimos 7 dias" };
    }
    case "30d": {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      return { from: startOfDay(f), to: endOfDay(now), label: "Últimos 30 dias" };
    }
    case "custom": {
      const f = custom?.from ? startOfDay(custom.from) : startOfDay(now);
      const t = custom?.to   ? endOfDay(custom.to)     : endOfDay(now);
      const sameDay = f.toDateString() === t.toDateString();
      const lab = sameDay
        ? format(f, "dd 'de' MMM", { locale: ptBR })
        : `${format(f, "dd MMM", { locale: ptBR })} – ${format(t, "dd MMM", { locale: ptBR })}`;
      return { from: f, to: t, label: lab };
    }
    case "month":
    default: {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: f, to: t, label: format(now, "MMMM 'de' yyyy", { locale: ptBR }) };
    }
  }
}

export default function Dashboard() {
  const { user } = useAuth();

  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const range = useMemo(
    () => makeRange(rangeKey, { from: customFrom, to: customTo }),
    [rangeKey, customFrom, customTo]
  );

  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const fromDate = range.from.toISOString().slice(0, 10);
  const toDate = range.to.toISOString().slice(0, 10);

  // ===== queries =====
  const { data: rangeSales } = useQuery({
    queryKey: ["dash-r-sales", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("amount, sale_date, status, partner_id, products(name, product_categories(name, color))")
        .gte("sale_date", fromDate)
        .lte("sale_date", toDate);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rangeCommissions } = useQuery({
    queryKey: ["dash-r-comms", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("amount, status, paid_at, partner_id, partners(full_name, active)");
      if (error) throw error;
      return (data ?? []).filter((c: any) => {
        if (!c.paid_at) return false;
        const d = new Date(c.paid_at).getTime();
        return d >= range.from.getTime() && d <= range.to.getTime();
      });
    },
  });

  const { data: rangeClients } = useQuery({
    queryKey: ["dash-r-clients", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, company, status, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allTimePartners } = useQuery({
    queryKey: ["dash-partners-active"],
    queryFn: async () => {
      const { count, error } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: rangeActivities } = useQuery({
    queryKey: ["dash-r-activities", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, action, description, created_at, entity_type")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const demo = useMemo(() => makeDemoDashboard(range, rangeKey), [range, rangeKey]);
  const useDemoData = !rangeSales?.length || !rangeClients?.length || !rangeActivities?.length;

  // ===== Aggregations =====
  const aggregated = useMemo(() => {
    const sales = useDemoData ? demo.sales : rangeSales ?? [];
    const comms = useDemoData ? demo.commissions : rangeCommissions ?? [];
    const clients = useDemoData ? demo.clients : rangeClients ?? [];
    const activities = useDemoData ? demo.activities : rangeActivities ?? [];

    const totalRevenue = sales.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = comms.reduce((s, x: any) => s + Number(x.amount), 0);
    const newClients = clients.length;
    const concluidas = sales.filter((s: any) => s.status === "concluida").length;

    const palette = [C.primary, C.success, C.warning, C.info, C.c5, C.c6];
    const catMap = new Map<string, { name: string; value: number; color: string }>();
    let i = 0;
    sales.forEach((s: any) => {
      const cat = s.products?.product_categories;
      const key = cat?.name ?? "Outros";
      const color = cat?.color ?? palette[i++ % palette.length];
      const cur = catMap.get(key) ?? { name: key, value: 0, color };
      cur.value += Number(s.amount);
      catMap.set(key, cur);
    });

    const prodMap = new Map<string, { name: string; total: number; count: number }>();
    sales.forEach((s: any) => {
      const n = s.products?.name;
      if (!n) return;
      const cur = prodMap.get(n) ?? { name: n, total: 0, count: 0 };
      cur.total += Number(s.amount);
      cur.count += 1;
      prodMap.set(n, cur);
    });

    const partMap = new Map<string, { name: string; total: number; count: number; active: boolean }>();
    comms.forEach((c: any) => {
      if (!c.partners) return;
      const cur = partMap.get(c.partner_id) ?? { name: c.partners.full_name, total: 0, count: 0, active: c.partners.active };
      cur.total += Number(c.amount);
      cur.count += 1;
      partMap.set(c.partner_id, cur);
    });

    // Buckets pra área (Hoje = por hora; demais = por dia)
    const isToday = rangeKey === "today";
    const buckets: { key: string; label: string; faturamento: number; comissoes: number }[] = [];
    if (isToday) {
      for (let h = 0; h < 24; h += 2) {
        buckets.push({ key: `${h}`, label: `${String(h).padStart(2, "0")}h`, faturamento: 0, comissoes: 0 });
      }
      sales.forEach((s: any) => {
        const d = new Date(s.sale_date);
        const idx = Math.floor(d.getHours() / 2);
        if (buckets[idx]) buckets[idx].faturamento += Number(s.amount);
      });
      comms.forEach((c: any) => {
        const d = new Date(c.paid_at);
        const idx = Math.floor(d.getHours() / 2);
        if (buckets[idx]) buckets[idx].comissoes += Number(c.amount);
      });
    } else {
      const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000));
      for (let i = 0; i < days; i++) {
        const d = new Date(range.from);
        d.setDate(d.getDate() + i);
        buckets.push({
          key: d.toISOString().slice(0, 10),
          label: format(d, days > 14 ? "dd" : "dd/MM", { locale: ptBR }),
          faturamento: 0,
          comissoes: 0,
        });
      }
      sales.forEach((s: any) => {
        const k = String(s.sale_date).slice(0, 10);
        const b = buckets.find((b) => b.key === k);
        if (b) b.faturamento += Number(s.amount);
      });
      comms.forEach((c: any) => {
        const k = new Date(c.paid_at).toISOString().slice(0, 10);
        const b = buckets.find((b) => b.key === k);
        if (b) b.comissoes += Number(c.amount);
      });
    }

    return {
      sales,
      totalRevenue,
      paid,
      newClients,
      concluidas,
      clients,
      activities,
      categories: Array.from(catMap.values()),
      topProducts: Array.from(prodMap.values()).sort((a, b) => b.total - a.total).slice(0, 5),
      topPartners: Array.from(partMap.values()).sort((a, b) => b.total - a.total).slice(0, 5),
      buckets,
    };
  }, [rangeSales, rangeCommissions, rangeClients, rangeActivities, rangeKey, range.from, range.to, useDemoData, demo]);

  const totalRevenue = aggregated.totalRevenue;
  const paid = aggregated.paid;
  const taxes = totalRevenue * 0.022;
  const net = totalRevenue - paid - taxes;
  const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

  // Goal scales with the range type
  const goal = rangeKey === "today" ? 25_000 : rangeKey === "7d" ? 120_000 : 500_000;
  const goalPct = Math.min(100, Math.round((totalRevenue / goal) * 100));
  const totalCat = aggregated.categories.reduce((s, x) => s + x.value, 0);
  const ticketMedio = aggregated.sales.length ? totalRevenue / aggregated.sales.length : 0;
  const peakBucket = aggregated.buckets.reduce((a, b) => (b.faturamento > a.faturamento ? b : a), aggregated.buckets[0] ?? { label: "—", faturamento: 0, comissoes: 0, key: "" });
  const topCategory = [...aggregated.categories].sort((a, b) => b.value - a.value)[0];
  const goalRemaining = Math.max(0, goal - totalRevenue);
  const onTrack = goalPct >= 90;

  const labelSuffix = range.label;

  const kpis = [
    {
      label: `Faturamento · ${labelSuffix}`,
      value: formatBRL(totalRevenue),
      delta: "+18.2%",
      positive: true,
      icon: DollarSign,
      tone: "bg-primary/10 text-primary",
      stroke: C.primary,
      seed: 1,
    },
    {
      label: `Novos Clientes`,
      value: String(aggregated.newClients),
      delta: "+12.5%",
      positive: true,
      icon: Users,
      tone: "bg-success/10 text-success",
      stroke: C.success,
      seed: 2,
    },
    {
      label: "Parceiros Ativos",
      value: String(useDemoData ? demo.activePartners : allTimePartners ?? 0),
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

  const animKey = `${rangeKey}-${fromDate}-${toDate}`;

  const presets: { key: RangeKey; label: string; icon: any }[] = [
    { key: "today", label: "Hoje", icon: Clock },
    { key: "7d", label: "7 dias", icon: TrendingUp },
    { key: "30d", label: "30 dias", icon: CalendarDays },
    { key: "month", label: "Este mês", icon: CalendarIcon },
  ];

  return (
    <div className="page-shell space-y-6">
      {/* ===== HEADER ===== */}
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="vx-live-dot" />
            Painel administrativo
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            {(() => {
              const h = new Date().getHours();
              const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
              const name = (user?.user_metadata?.full_name as string)?.split(" ")[0] ?? "";
              return name ? `${greeting}, ${name}` : greeting;
            })()}
          </h1>
          <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
            <CalendarDays className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{range.label}</span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="tabular-nums">{aggregated.sales.length} vendas</span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="tabular-nums">{aggregated.newClients} novos clientes</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period segmented control */}
          <div className="vx-segment !p-0.5">
            {presets.map((p) => {
              const Icon = p.icon;
              const active = rangeKey === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setRangeKey(p.key)}
                  data-active={active}
                  className="vx-segment-item !flex items-center gap-1.5"
                >
                  <Icon className="size-3.5" />
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                data-active={rangeKey === "custom"}
                className={cn(
                  "inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] font-semibold transition-colors",
                  rangeKey === "custom"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted/50"
                )}
              >
                <CalendarIcon className="size-3.5" />
                {rangeKey === "custom" && customFrom
                  ? customTo && customTo.toDateString() !== customFrom.toDateString()
                    ? `${format(customFrom, "dd/MM")} – ${format(customTo, "dd/MM")}`
                    : format(customFrom, "dd 'de' MMM", { locale: ptBR })
                  : "Personalizado"}
                <ChevronDown className="size-3.5 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={{ from: customFrom, to: customTo }}
                onSelect={(r: any) => {
                  setCustomFrom(r?.from);
                  setCustomTo(r?.to);
                  if (r?.from) setRangeKey("custom");
                }}
                numberOfMonths={2}
                locale={ptBR}
                className="p-3 pointer-events-auto"
              />
              <div className="flex items-center justify-end gap-2 p-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => { setCustomFrom(undefined); setCustomTo(undefined); setRangeKey("month"); }}>
                  Limpar
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <button className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-bold hover:bg-foreground/90 transition-colors shadow-sm">
            <Plus className="size-4" /> Novo registro
          </button>
        </div>
      </header>

      {/* ===== KPI CARDS ===== */}
      <section key={`kpi-${animKey}`} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k, idx) => {
          const Icon = k.icon;
          const data = sparkData(k.seed);
          return (
            <div
              key={k.label}
              className="vx-card vx-card-hover vx-card-accent vx-card-glow p-5 relative overflow-hidden vx-animate-in group"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Ambient color wash */}
              <div
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.10] pointer-events-none blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]"
                style={{ background: `radial-gradient(circle, ${k.stroke}, transparent 65%)` }}
              />
              <div className="flex items-start gap-4 relative">
                <div className="vx-tile size-12">
                  <Icon className="size-[18px] relative z-10" strokeWidth={2.25} style={{ color: k.stroke }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="vx-eyebrow truncate">{k.label}</p>
                  <p className="vx-numeral text-[28px] mt-2 truncate">{k.value}</p>
                </div>
              </div>
              <div className="flex items-end justify-between mt-4 gap-3 relative">
                <div className="flex flex-col gap-1.5">
                  <span className={cn("vx-chip", k.positive ? "vx-chip-up" : "vx-chip-down")}>
                    {k.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {k.delta}
                  </span>
                  <p className="text-[10.5px] text-muted-foreground">vs. período anterior</p>
                </div>
                <div className="h-12 w-32">
                  <ResponsiveContainer>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id={`spark-${k.seed}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={k.stroke} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={k.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="y" stroke={k.stroke} strokeWidth={2} fill={`url(#spark-${k.seed})`} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ===== ROW: AREA + DONUT + META ===== */}
      <section key={`row1-${animKey}`} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Faturamento ao longo do período */}
        <div className="lg:col-span-7 vx-card vx-card-hover vx-card-accent p-5 vx-animate-in relative overflow-hidden">
          <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full bg-primary/[0.07] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-12 w-64 h-64 rounded-full bg-[hsl(var(--chart-5))]/[0.06] blur-3xl pointer-events-none" />

          {/* Header com mini-stats */}
          <div className="flex items-start justify-between mb-5 flex-wrap gap-4 relative">
            <div>
              <p className="vx-eyebrow vx-eyebrow-dot">Receita · {range.label}</p>
              <div className="flex items-baseline gap-2.5 mt-2">
                <p className="vx-numeral text-[34px] bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                  {formatBRL(totalRevenue)}
                </p>
                <span className="vx-chip vx-chip-up">
                  <ArrowUpRight className="size-3" /> +18.2%
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                  <span className="text-[11px] text-muted-foreground font-medium">Faturamento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive/80" />
                  <span className="text-[11px] text-muted-foreground font-medium">Comissões</span>
                </div>
              </div>
            </div>

            {/* Mini-stats grid */}
            <div className="flex items-stretch gap-2">
              {[
                { label: "Ticket médio", value: formatBRL(ticketMedio), icon: Coins, color: C.warning },
                { label: "Pico", value: peakBucket?.label ?? "—", sub: formatBRL(peakBucket?.faturamento ?? 0), icon: TrendingUp, color: C.success },
                { label: "Vendas", value: String(aggregated.sales.length), icon: Package, color: C.info },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-xl border border-border/70 bg-background/40 backdrop-blur-sm px-3 py-2 min-w-[88px] hover:border-border transition-colors">
                    <div className="flex items-center gap-1.5">
                      <Icon className="size-3" style={{ color: s.color }} strokeWidth={2.5} />
                      <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="vx-numeral text-[14px] mt-1">{s.value}</p>
                    {s.sub && <p className="text-[9.5px] text-muted-foreground tabular-nums mt-0.5">{s.sub}</p>}
                  </div>
                );
              })}
              <button className="vx-icon-btn self-start"><MoreHorizontal className="size-4" /></button>
            </div>
          </div>

          <div className="h-72 relative">
            <ResponsiveContainer>
              <AreaChart data={aggregated.buckets} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-fat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.55} />
                    <stop offset="50%" stopColor={C.primary} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-com" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.destructive} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.destructive} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="line-fat" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={C.c5} stopOpacity={1} />
                  </linearGradient>
                  <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border) / 0.6)" />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={aggregated.buckets.length > 14 ? 2 : 0}
                  dy={6}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10.5} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => formatBRL(v)}
                  cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1.25, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="url(#line-fat)"
                  strokeWidth={3}
                  fill="url(#grad-fat)"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2.5, stroke: "hsl(var(--card))", fill: C.primary }}
                  animationDuration={900}
                  filter="url(#glow-line)"
                />
                <Area
                  type="monotone"
                  dataKey="comissoes"
                  stroke={C.destructive}
                  strokeWidth={1.75}
                  fill="url(#grad-com)"
                  dot={false}
                  animationDuration={900}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut por categoria */}
        <div className="lg:col-span-3 vx-card vx-card-hover vx-card-accent p-5 vx-animate-in relative overflow-hidden flex flex-col" style={{ animationDelay: "60ms" }}>
          <div className="absolute -top-20 -right-20 size-40 rounded-full bg-primary/[0.08] blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between mb-3 relative">
            <div>
              <p className="vx-eyebrow vx-eyebrow-dot">Por Categoria</p>
              {topCategory && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Líder: <span className="font-bold text-foreground">{topCategory.name}</span>
                </p>
              )}
            </div>
            <button className="vx-icon-btn"><MoreHorizontal className="size-4" /></button>
          </div>
          {aggregated.categories.length > 0 ? (
            <>
              <div className="h-48 relative">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="size-28 rounded-full" style={{ background: `radial-gradient(circle, ${topCategory?.color ?? C.primary}33, transparent 70%)` }} />
                </div>
                <ResponsiveContainer>
                  <PieChart>
                    <defs>
                      {aggregated.categories.map((c, i) => (
                        <linearGradient key={i} id={`pie-${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={c.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={c.color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    {/* Track ring */}
                    <Pie data={[{ v: 1 }]} dataKey="v" innerRadius={82} outerRadius={86} fill="hsl(var(--muted) / 0.4)" stroke="none" isAnimationActive={false} />
                    <Pie
                      data={aggregated.categories}
                      dataKey="value"
                      innerRadius={56}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="hsl(var(--card))"
                      strokeWidth={3}
                      animationDuration={800}
                      cornerRadius={4}
                    >
                      {aggregated.categories.map((_, i) => <Cell key={i} fill={`url(#pie-${i})`} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Total</span>
                  <span className="vx-numeral text-[18px] mt-1 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{formatBRL(totalCat)}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 tabular-nums">{aggregated.categories.length} categorias</span>
                </div>
              </div>
              <div className="space-y-2.5 mt-2">
                {aggregated.categories.slice(0, 4).map((c) => {
                  const pct = totalCat ? (c.value / totalCat) * 100 : 0;
                  return (
                    <div key={c.name} className="group/cat">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2.5 rounded-[5px] shrink-0 ring-1 ring-inset ring-white/10"
                            style={{ background: c.color, boxShadow: `0 0 8px ${c.color}66` }}
                          />
                          <span className="text-[12px] font-semibold truncate">{c.name}</span>
                        </div>
                        <span className="text-[11.5px] font-bold tabular-nums">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: `${c.color}1f` }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.color}, ${c.color}aa)`, boxShadow: `0 0 6px ${c.color}99` }}
                        />
                      </div>
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
        <div className="lg:col-span-2 vx-card vx-card-hover vx-card-accent p-5 relative overflow-hidden vx-animate-in flex flex-col" style={{ animationDelay: "120ms" }}>
          <div className="absolute -top-20 -right-20 size-44 rounded-full bg-primary/[0.14] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 size-40 rounded-full bg-[hsl(var(--chart-5))]/[0.10] blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2 relative">
            <p className="vx-eyebrow vx-eyebrow-dot">Meta</p>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset",
              onTrack
                ? "bg-success/10 text-success ring-success/25"
                : "bg-warning/10 text-warning ring-warning/25"
            )}>
              <span className="size-1 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
              {onTrack ? "No ritmo" : "Atenção"}
            </span>
          </div>

          <div className="h-40 relative">
            {/* Decorative outer ring */}
            <div className="absolute inset-2 rounded-full border border-dashed border-border/60 pointer-events-none" />
            <ResponsiveContainer>
              <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="98%" barSize={11} data={[{ name: "meta", value: goalPct, fill: C.primary }]} startAngle={90} endAngle={-270}>
                <defs>
                  <linearGradient id="grad-meta" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={C.primary} />
                    <stop offset="100%" stopColor={C.c5} />
                  </linearGradient>
                  <filter id="glow-meta" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: "hsl(var(--muted) / 0.5)" }}
                  dataKey="value"
                  cornerRadius={20}
                  fill="url(#grad-meta)"
                  animationDuration={1100}
                  filter="url(#glow-meta)"
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="vx-numeral text-[30px] bg-gradient-to-br from-primary to-[hsl(var(--chart-5))] bg-clip-text text-transparent">
                {goalPct}<span className="text-[16px] opacity-70">%</span>
              </span>
              <span className="text-[9.5px] text-muted-foreground font-bold uppercase tracking-[0.14em] mt-0.5">atingido</span>
            </div>
          </div>

          <div className="mt-3 vx-divider-soft relative" />
          <div className="space-y-2 mt-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Meta</span>
              <span className="text-[12px] font-bold tabular-nums">{formatBRL(goal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Realizado</span>
              <span className="text-[12px] font-bold tabular-nums text-primary">{formatBRL(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Faltam</span>
              <span className={cn("text-[12px] font-bold tabular-nums", goalRemaining > 0 ? "text-warning" : "text-success")}>
                {formatBRL(goalRemaining)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ROW: TOP PRODUTOS + ATIVIDADES + RESUMO ===== */}
      <section key={`row2-${animKey}`} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Produtos */}
        <div className="lg:col-span-5 vx-card vx-card-hover vx-card-accent p-5 vx-animate-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="vx-eyebrow vx-eyebrow-dot">Top Produtos</p>
              <p className="vx-numeral text-[18px] mt-2">
                {aggregated.topProducts.length} <span className="text-muted-foreground font-semibold text-[13px] tracking-normal">produtos vendidos</span>
              </p>
            </div>
            <button className="text-[11px] font-semibold text-primary hover:underline">Ver todos →</button>
          </div>
          <div className="space-y-4">
            {aggregated.topProducts.length === 0 ? (
              <div className="py-10 text-center">
                <Package className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sem produtos no período</p>
              </div>
            ) : (
              aggregated.topProducts.map((p, i) => {
                const max = Math.max(...aggregated.topProducts.map((x) => x.total));
                const w = max ? (p.total / max) * 100 : 0;
                const colors = [C.primary, C.success, C.warning, C.info, C.c5];
                const rankClass = i === 0 ? "vx-rank vx-rank-1" : i === 1 ? "vx-rank vx-rank-2" : i === 2 ? "vx-rank vx-rank-3" : "vx-rank";
                return (
                  <div key={p.name} className="group/row">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={rankClass}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate leading-tight">{p.name}</p>
                          <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5">{p.count} vendas</p>
                        </div>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums">{formatBRL(p.total)}</span>
                    </div>
                    <div className="vx-track">
                      <div
                        className="vx-track-fill"
                        style={{
                          width: `${w}%`,
                          background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}cc)`,
                          color: colors[i],
                          boxShadow: `0 0 10px ${colors[i]}66`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Atividades */}
        <div className="lg:col-span-4 vx-card vx-card-hover vx-card-accent p-5 vx-animate-in" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="vx-eyebrow vx-eyebrow-dot">Atividades · {range.label}</p>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-success">
              <span className="vx-live-dot" /> Live
            </span>
          </div>
          <div className="vx-timeline space-y-3.5 max-h-[340px] overflow-y-auto pr-1 -mr-1 pl-0.5">
            {aggregated.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade no período.</p>
            ) : (
              aggregated.activities.slice(0, 10).map((a: any) => {
                const meta = activityMeta[a.entity_type as string] || activityMeta.cliente;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-start gap-3 relative">
                    <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-card relative z-10", meta.tone)}>
                      <Icon className="size-3.5" strokeWidth={2.25} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-[12.5px] font-semibold leading-tight truncate">{a.action}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.description ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-1 tabular-nums">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="lg:col-span-3 vx-card vx-card-hover vx-card-accent p-5 relative overflow-hidden vx-animate-in" style={{ animationDelay: "120ms" }}>
          <div className="absolute -top-16 -right-16 size-40 rounded-full bg-primary/[0.10] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 size-40 rounded-full bg-[hsl(var(--chart-5))]/[0.06] blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-5 relative">
            <div className="vx-tile size-7">
              <Target className="size-3.5 relative z-10 text-primary" />
            </div>
            <p className="vx-eyebrow">Resumo Financeiro</p>
          </div>
          <div className="space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground">Faturamento Bruto</span>
              <span className="text-[13px] font-bold tabular-nums">{formatBRL(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground">Comissões</span>
              <span className="text-[13px] font-bold tabular-nums text-destructive">−{formatBRL(paid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground">Taxas (2,2%)</span>
              <span className="text-[13px] font-bold tabular-nums text-destructive">−{formatBRL(taxes)}</span>
            </div>
            <div className="vx-divider-soft my-1" />
            <div className="rounded-2xl bg-gradient-to-br from-primary/[0.14] via-primary/[0.06] to-[hsl(var(--chart-5))]/[0.08] border border-primary/20 p-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 size-24 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between relative">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Líquido</span>
                <span className="vx-numeral text-[20px] bg-gradient-to-br from-primary to-[hsl(var(--chart-5))] bg-clip-text text-transparent">
                  {formatBRL(net)}
                </span>
              </div>
              <div className="vx-track mt-3 relative" style={{ background: "hsl(var(--primary) / 0.18)" }}>
                <div
                  className="vx-track-fill"
                  style={{
                    width: `${Math.min(100, margin)}%`,
                    background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-5)))`,
                  }}
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-2 tabular-nums relative">
                Margem <span className="font-bold text-foreground">{margin.toFixed(1)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ROW: CLIENTES + TOP PARCEIROS ===== */}
      <section key={`row3-${animKey}`} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Clientes (no período) */}
        <div className="lg:col-span-7 vx-card vx-card-hover vx-card-accent overflow-hidden vx-animate-in">
          <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-gradient-to-r from-card via-card to-muted/20">
            <div>
              <p className="vx-eyebrow vx-eyebrow-dot">Novos clientes · {range.label}</p>
              <p className="text-[12px] text-muted-foreground mt-1.5 tabular-nums">
                <span className="font-bold text-foreground">{aggregated.clients.length}</span> cadastrados
              </p>
            </div>
            <button className="text-[12px] font-semibold text-primary hover:underline">Ver todos →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground bg-muted/25">
                <th className="px-5 py-2.5 text-left font-bold">Cliente</th>
                <th className="px-3 py-2.5 text-left font-bold">Empresa</th>
                <th className="px-3 py-2.5 text-left font-bold">Status</th>
                <th className="px-5 py-2.5 text-right font-bold">Cadastrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {aggregated.clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhum cliente cadastrado no período
                  </td>
                </tr>
              ) : (
                aggregated.clients.slice(0, 7).map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/25 transition-colors group/row">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="vx-avatar size-9">
                          {initials(c.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px] leading-tight truncate">{c.full_name}</p>
                          <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5 group-hover/row:text-foreground/70 transition-colors">
                            #{String(c.id).slice(-6).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-foreground/80 text-[13px] font-medium">{c.company ?? "—"}</td>
                    <td className="px-3 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                        c.status === "ativo" && "bg-success/12 text-success ring-success/20",
                        c.status === "prospecto" && "bg-warning/12 text-warning ring-warning/25",
                        c.status !== "ativo" && c.status !== "prospecto" && "bg-muted text-muted-foreground ring-border")}>
                        <span className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground text-[12px] tabular-nums">
                      {timeAgo(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Top parceiros */}
        <div className="lg:col-span-5 vx-card vx-card-hover vx-card-accent overflow-hidden vx-animate-in" style={{ animationDelay: "60ms" }}>
          <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-gradient-to-r from-card via-card to-muted/20">
            <div>
              <p className="vx-eyebrow vx-eyebrow-dot">Top Parceiros · {range.label}</p>
              <p className="text-[12px] text-muted-foreground mt-1.5">
                Ranking por volume de comissões
              </p>
            </div>
            <button className="text-[12px] font-semibold text-primary hover:underline">Ver todos →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground bg-muted/25">
                <th className="px-5 py-2.5 text-left font-bold">Parceiro</th>
                <th className="px-3 py-2.5 text-right font-bold">Comissões</th>
                <th className="px-5 py-2.5 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {aggregated.topPartners.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Sem comissões no período
                  </td>
                </tr>
              ) : (
                aggregated.topPartners.map((p, i) => {
                  const rankClass = i === 0 ? "vx-rank vx-rank-1" : i === 1 ? "vx-rank vx-rank-2" : i === 2 ? "vx-rank vx-rank-3" : "vx-rank";
                  return (
                    <tr key={p.name + i} className="hover:bg-muted/25 transition-colors group/row">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {i < 3 ? (
                            <span className={rankClass}>
                              <Trophy className="size-3" />
                            </span>
                          ) : (
                            <span className={rankClass}>{i + 1}</span>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-[13px] leading-tight truncate">{p.name}</p>
                            <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5">{p.count} repasses</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums font-bold text-[13px]">{formatBRL(p.total)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", p.active ? "bg-success/12 text-success ring-success/20" : "bg-muted text-muted-foreground ring-border")}>
                          <span className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
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
      </section>
    </div>
  );
}
