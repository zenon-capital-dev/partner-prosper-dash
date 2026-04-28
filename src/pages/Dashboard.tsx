import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  Users,
  Handshake,
  Wallet,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  UserPlus,
  FileSignature,
  Coins,
  FileUp,
  Sparkles,
  Download,
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
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const palette = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

const activityMeta: Record<string, { icon: any; tone: string }> = {
  cliente: { icon: UserPlus, tone: "text-success bg-success/15" },
  contrato: { icon: FileSignature, tone: "text-info bg-info/15" },
  comissao: { icon: Coins, tone: "text-warning bg-warning/15" },
  documento: { icon: FileUp, tone: "text-info bg-info/15" },
  parceiro: { icon: Handshake, tone: "text-primary bg-primary/15" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clients, partners, sales, commissions] = await Promise.all([
        supabase.from("clients").select("id, status"),
        supabase.from("partners").select("id").eq("active", true),
        supabase.from("sales").select("amount, sale_date, status"),
        supabase.from("commissions").select("amount, status, paid_at"),
      ]);

      const totalRevenue = (sales.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const paidCommissions = (commissions.data ?? [])
        .filter((c) => c.status === "pago")
        .reduce((s, x) => s + Number(x.amount), 0);
      const pendingCommissions = (commissions.data ?? [])
        .filter((c) => c.status === "pendente")
        .reduce((s, x) => s + Number(x.amount), 0);

      return {
        clientsCount: clients.data?.length ?? 0,
        activeClients: (clients.data ?? []).filter((c) => c.status === "ativo").length,
        partnersCount: partners.data?.length ?? 0,
        totalRevenue,
        paidCommissions,
        pendingCommissions,
        salesCount: sales.data?.length ?? 0,
      };
    },
  });

  const { data: salesByMonth } = useQuery({
    queryKey: ["sales-by-month"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("amount, sale_date");
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const result = months.map((m) => ({ month: m, value: 0 }));
      (data ?? []).forEach((s) => {
        const d = new Date(s.sale_date);
        if (d.getFullYear() === new Date().getFullYear()) {
          result[d.getMonth()].value += Number(s.amount);
        }
      });
      return result;
    },
  });

  const { data: byCategory } = useQuery({
    queryKey: ["sales-by-category"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("amount, products(name, category_id, product_categories(name, color))");
      const map = new Map<string, { name: string; value: number; color: string }>();
      (data ?? []).forEach((s: any) => {
        const cat = s.products?.product_categories;
        if (!cat) return;
        const cur = map.get(cat.name) ?? { name: cat.name, value: 0, color: cat.color };
        cur.value += Number(s.amount);
        map.set(cat.name, cur);
      });
      const arr = Array.from(map.values());
      return arr.map((c, i) => ({ ...c, color: c.color || palette[i % palette.length] }));
    },
  });

  const { data: recentClients } = useQuery({
    queryKey: ["recent-clients"],
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
    queryKey: ["top-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commissions")
        .select("amount, partner_id, partners(full_name)");
      const map = new Map<string, { name: string; total: number; count: number }>();
      (data ?? []).forEach((c: any) => {
        if (!c.partners) return;
        const cur = map.get(c.partner_id) ?? { name: c.partners.full_name, total: 0, count: 0 };
        cur.total += Number(c.amount);
        cur.count += 1;
        map.set(c.partner_id, cur);
      });
      return Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["activities-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, action, description, created_at, entity_type")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const totalRevenue = stats?.totalRevenue ?? 0;
  const paid = stats?.paidCommissions ?? 0;
  const taxes = totalRevenue * 0.022;
  const net = totalRevenue - paid - taxes;

  const kpis = [
    { label: "Faturamento Total", value: formatBRL(totalRevenue), delta: "+18.2%", positive: true, icon: DollarSign, rail: "bg-success" },
    { label: "Clientes Ativos", value: String(stats?.activeClients ?? 0), delta: "+12.5%", positive: true, icon: Users, rail: "bg-info" },
    { label: "Parceiros Ativos", value: String(stats?.partnersCount ?? 0), delta: "+8.1%", positive: true, icon: Handshake, rail: "bg-warning" },
    { label: "Comissões Pagas", value: formatBRL(paid), delta: "+15.3%", positive: true, icon: Wallet, rail: "bg-destructive" },
  ];

  return (
    <div className="page-shell space-y-10">
      {/* Hero */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="vx-pill vx-pill-success">
              <span className="size-1.5 rounded-full bg-success" />
              Live
            </span>
            <span className="vx-pill vx-pill-muted">{period === "month" ? "Mensal" : period === "quarter" ? "Trimestral" : "Anual"}</span>
          </div>
          <h1 className="font-display text-[40px] sm:text-[56px] font-black tracking-[-0.04em] leading-[0.95]">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Bem-vindo de volta, {user?.email?.split("@")[0]}. Resumo da operação.
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <p className="vx-kpi-label">Faturamento {period === "month" ? "do mês" : period}</p>
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

      {/* KPI Strip with color rails */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-border/70 lg:divide-x lg:divide-border/70 -mx-5 sm:-mx-8">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="relative px-6 py-7 hover:bg-muted/25 transition-colors duration-[220ms]"
            >
              <span className={cn("absolute left-0 top-7 h-9 w-[3px] rounded-r-full", k.rail)} />
              <div className="flex items-center justify-between mb-4">
                <p className="vx-kpi-label">{k.label}</p>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="vx-kpi-value">{k.value}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold tabular-nums", k.positive ? "text-success" : "text-destructive")}>
                  {k.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {k.delta}
                </span>
                <span className="text-[11px] text-muted-foreground">vs. anterior</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="vx-segment">
          {(["month", "quarter", "year"] as const).map((p) => (
            <button key={p} className="vx-segment-item" data-active={period === p} onClick={() => setPeriod(p)}>
              {p === "month" ? "Mensal" : p === "quarter" ? "Trimestral" : "Anual"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="vx-pill">
            <Calendar className="size-3.5" /> 01/05 — 31/05
          </button>
          <button className="vx-pill hover:bg-muted/50 transition-colors">
            <Download className="size-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Faturamento area */}
        <div className="lg:col-span-8 vx-card p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="vx-kpi-label">Faturamento</p>
              <p className="font-display text-[28px] font-black tabular-nums tracking-[-0.04em] mt-1">
                {formatBRL(totalRevenue)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="vx-pill vx-pill-success">
                <ArrowUpRight className="size-3" /> +18.2%
              </span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={salesByMonth ?? []} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
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
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border) / 0.6)",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                  formatter={(v: number) => formatBRL(v)}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  fill="url(#grad-rev)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Por categoria */}
        <div className="lg:col-span-4 vx-card p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="vx-kpi-label">Por Produto</p>
            <button className="vx-icon-btn">
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          {byCategory && byCategory.length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {byCategory.map((c, i) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatBRL(v)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border) / 0.6)",
                        borderRadius: "10px",
                        fontSize: "12px",
                      }}
                    />
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
              <Sparkles className="size-7 mb-2 opacity-40" />
              <p className="text-sm">Sem vendas ainda</p>
              <p className="text-xs mt-1">Cadastre vendas para ver a distribuição.</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom: clientes / parceiros / financeiro */}
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
                  <tr key={c.id} className="group hover:bg-muted/20 transition-colors">
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
            <p className="vx-kpi-label">Top Parceiros</p>
            <button className="text-[11px] font-bold text-success hover:underline">Ver todos →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-bold">Parceiro</th>
                <th className="px-3 py-2.5 text-right font-bold">Comissões</th>
                <th className="px-5 py-2.5 text-right font-bold">Indic.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(topPartners ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Sem parceiros com comissão
                  </td>
                </tr>
              ) : (
                topPartners?.map((p, i) => (
                  <tr key={p.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="size-6 rounded-full ring-1 ring-border/60 text-[10px] font-black flex items-center justify-center tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-[13px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-[13px]">
                      {formatBRL(p.total)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground text-[13px] tabular-nums">
                      {p.count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
            </div>
          </div>
        </div>
      </section>

      {/* Atividades recentes */}
      <section className="vx-card p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="vx-kpi-label">Atividades Recentes</p>
          <button className="text-[11px] font-bold text-success hover:underline">Ver todas →</button>
        </div>
        {(activities ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade ainda.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {activities?.map((a: any) => {
              const meta = activityMeta[a.entity_type as string] || activityMeta.cliente;
              const Icon = meta.icon;
              return (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={cn("size-9 rounded-full flex items-center justify-center shrink-0", meta.tone)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">{a.action}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{a.description ?? "—"}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
