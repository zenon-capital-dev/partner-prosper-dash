import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Handshake,
  DollarSign,
  Wallet,
  ArrowUpRight,
  MoreHorizontal,
  UserPlus,
  Coins,
  FileUp,
  FileSignature,
  FolderKanban,
  Calendar,
  ChevronDown,
  Bell,
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
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  padding: "8px 10px",
  boxShadow: "0 4px 16px -4px hsl(var(--foreground) / 0.12)",
};

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const activityMeta: Record<string, { icon: any; tone: string }> = {
  cliente: { icon: UserPlus, tone: "bg-primary/10 text-primary" },
  contrato: { icon: FileSignature, tone: "bg-success/10 text-success" },
  comissao: { icon: Coins, tone: "bg-warning/10 text-warning" },
  documento: { icon: FileUp, tone: "bg-info/10 text-info" },
  parceiro: { icon: Handshake, tone: "bg-chart-5/10 text-[hsl(var(--chart-5))]" },
  projeto: { icon: FolderKanban, tone: "bg-info/10 text-info" },
};

// mock sparkline data per KPI (visual only)
const sparkData = (seed: number) =>
  Array.from({ length: 12 }).map((_, i) => ({
    x: i,
    y: 20 + Math.abs(Math.sin(i * 0.7 + seed) * 30) + Math.random() * 8,
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
        supabase.from("sales").select("amount"),
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
      };
    },
  });

  const { data: monthlySeries } = useQuery({
    queryKey: ["dash-monthly"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("amount, sale_date");
      const result = PT_MONTHS.map((m) => ({ month: m, faturamento: 0 }));
      const year = new Date().getFullYear();
      (data ?? []).forEach((s) => {
        const d = new Date(s.sale_date);
        if (d.getFullYear() === year) result[d.getMonth()].faturamento += Number(s.amount);
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
      const palette = [C.primary, C.success, C.warning, C.info, C.c5];
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
        .limit(5);
      return data ?? [];
    },
  });

  // derived
  const totalRevenue = stats?.totalRevenue ?? 0;
  const paid = stats?.paidCommissions ?? 0;
  const taxes = totalRevenue * 0.022;
  const net = totalRevenue - paid - taxes;

  const kpis = [
    {
      label: "Faturamento Total",
      value: formatBRL(totalRevenue),
      delta: "+18.2%",
      icon: DollarSign,
      tone: "bg-primary/10 text-primary",
      stroke: C.primary,
      seed: 1,
    },
    {
      label: "Clientes Ativos",
      value: String(stats?.clientsActive ?? 0),
      delta: "+12.5%",
      icon: Users,
      tone: "bg-success/10 text-success",
      stroke: C.success,
      seed: 2,
    },
    {
      label: "Parceiros Ativos",
      value: String(stats?.partnersActive ?? 0),
      delta: "+8.1%",
      icon: Handshake,
      tone: "bg-warning/10 text-warning",
      stroke: C.warning,
      seed: 3,
    },
    {
      label: "Comissões Pagas",
      value: formatBRL(paid),
      delta: "+15.3%",
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
          <h1 className="font-display text-[30px] font-bold tracking-tight leading-none">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Bem-vindo de volta, {user?.email?.split("@")[0] ?? "Admin"}! Aqui está o resumo do seu negócio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-border bg-card text-[13px] font-medium hover:bg-muted/50 transition-colors">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="tabular-nums">01/05/2024 — 31/05/2024</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          <button className="relative size-10 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors">
            <Bell className="size-4 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
              3
            </span>
          </button>
          <div className="size-10 rounded-full bg-muted text-foreground flex items-center justify-center text-[12px] font-bold border border-border">
            {initials(user?.email)}
          </div>
        </div>
      </header>

      {/* ===== KPI CARDS ===== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          const data = sparkData(k.seed);
          return (
            <div key={k.label} className="vx-card p-5">
              <div className="flex items-start gap-4">
                <div className={cn("size-12 rounded-full flex items-center justify-center shrink-0", k.tone)}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="font-display text-[26px] font-bold tabular-nums tracking-tight mt-1.5 truncate">
                    {k.value}
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between mt-3 gap-3">
                <div>
                  <p className="text-[12px] font-bold text-success tabular-nums">{k.delta}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">vs. período anterior</p>
                </div>
                <div className="h-10 w-24">
                  <ResponsiveContainer>
                    <LineChart data={data}>
                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke={k.stroke}
                        strokeWidth={1.75}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ===== ROW: FATURAMENTO + DONUT + ATIVIDADES ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Faturamento line */}
        <div className="lg:col-span-5 vx-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Faturamento
              </p>
              <p className="font-display text-[26px] font-bold tabular-nums tracking-tight mt-1">
                {formatBRL(totalRevenue)}
              </p>
            </div>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] font-medium hover:bg-muted/50 transition-colors">
              Mensal <ChevronDown className="size-3.5" />
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={monthlySeries ?? []} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-fat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => formatBRL(v)}
                  cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke={C.primary}
                  strokeWidth={2.5}
                  fill="url(#grad-fat)"
                  dot={{ r: 3, fill: C.primary, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Faturamento por produto (Donut) */}
        <div className="lg:col-span-4 vx-card p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Faturamento por Produto
            </p>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] font-medium hover:bg-muted/50 transition-colors">
              Todos <ChevronDown className="size-3.5" />
            </button>
          </div>
          {byCategory && byCategory.length > 0 ? (
            <div className="flex items-center gap-5">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={1}
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
              <div className="flex-1 space-y-3 min-w-0">
                {byCategory.map((c) => {
                  const pct = totalCat ? ((c.value / totalCat) * 100).toFixed(1) : "0";
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                          <span className="text-[13px] font-semibold truncate">{c.name}</span>
                        </div>
                        <span className="text-[13px] font-bold tabular-nums">{pct}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums ml-4 mt-0.5">
                        {formatBRL(c.value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              Sem vendas ainda
            </div>
          )}
        </div>

        {/* Atividades Recentes */}
        <div className="lg:col-span-3 vx-card p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-4">
            Atividades Recentes
          </p>
          <div className="space-y-4">
            {(activities ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade ainda.</p>
            ) : (
              activities?.map((a: any) => {
                const meta = activityMeta[a.entity_type as string] || activityMeta.cliente;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center shrink-0",
                        meta.tone,
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight truncate">{a.action}</p>
                      <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                        {a.description ?? "—"}
                      </p>
                    </div>
                    <span className="text-[10.5px] text-muted-foreground tabular-nums shrink-0">
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ===== ROW: TABELAS + RESUMO ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Últimos clientes */}
        <div className="lg:col-span-5 vx-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Últimos Clientes
            </p>
            <button className="text-[12px] font-semibold text-primary hover:underline">Ver todos</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
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
                    <td className="px-5 py-3.5 font-semibold text-[13px]">{c.full_name}</td>
                    <td className="px-3 py-3.5 text-muted-foreground text-[13px]">{c.company ?? "—"}</td>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          c.status === "ativo" && "bg-success/15 text-success",
                          c.status === "prospecto" && "bg-warning/15 text-warning",
                          c.status !== "ativo" && c.status !== "prospecto" && "bg-muted text-muted-foreground",
                        )}
                      >
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
        <div className="lg:col-span-4 vx-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Top Parceiros
            </p>
            <button className="text-[12px] font-semibold text-primary hover:underline">Ver todos</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-bold">Parceiro</th>
                <th className="px-3 py-2.5 text-right font-bold">Comissões</th>
                <th className="px-3 py-2.5 text-right font-bold">Total</th>
                <th className="px-5 py-2.5 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(topPartners ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Sem comissões ainda
                  </td>
                </tr>
              ) : (
                topPartners?.map((p, i) => (
                  <tr key={p.name + i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[13px]">{p.name}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-[13px]">{formatBRL(p.total)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground text-[13px]">
                      {p.count}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Resumo Financeiro */}
        <div className="lg:col-span-3 vx-card p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-5">
            Resumo Financeiro
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Faturamento Bruto</span>
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
            <div className="section-divider" />
            <div className="rounded-lg bg-primary/5 p-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-primary">Faturamento Líquido</span>
              <span className="font-display text-[16px] font-bold tabular-nums text-primary">
                {formatBRL(net)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
