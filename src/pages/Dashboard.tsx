import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

const palette = ["#6366F1", "#10B981", "#F59E0B", "#3B82F6", "#A855F7", "#EC4899"];

// ---------- KPI Card with sparkline ----------
function KpiCard({
  label,
  value,
  delta,
  positive = true,
  icon: Icon,
  tone,
  series,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  icon: any;
  tone: "violet" | "emerald" | "amber" | "sky";
  series: number[];
}) {
  const tones: Record<string, { bg: string; fg: string; line: string }> = {
    violet: { bg: "bg-[#EEF2FF]", fg: "text-[#6366F1]", line: "#6366F1" },
    emerald: { bg: "bg-[#ECFDF5]", fg: "text-[#10B981]", line: "#10B981" },
    amber: { bg: "bg-[#FEF3C7]", fg: "text-[#D97706]", line: "#F59E0B" },
    sky: { bg: "bg-[#E0F2FE]", fg: "text-[#0284C7]", line: "#3B82F6" },
  };
  const t = tones[tone];
  const data = series.map((v, i) => ({ i, v }));

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-vx-sm hover:shadow-vx-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-10 rounded-xl ${t.bg} ${t.fg} flex items-center justify-center`}>
          <Icon className="size-[18px]" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="font-display text-[26px] font-extrabold vx-mono leading-tight">{value}</p>
      <div className="flex items-end justify-between mt-3">
        <div>
          <div
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              positive ? "text-[#10B981]" : "text-destructive"
            }`}
          >
            {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {delta}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">vs. período anterior</p>
        </div>
        <div className="w-24 h-10">
          <ResponsiveContainer>
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={t.line}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ---------- Activity icon helper ----------
const activityMeta: Record<string, { icon: any; bg: string; fg: string }> = {
  cliente: { icon: UserPlus, bg: "bg-[#EEF2FF]", fg: "text-[#6366F1]" },
  contrato: { icon: FileSignature, bg: "bg-[#ECFDF5]", fg: "text-[#10B981]" },
  comissao: { icon: Coins, bg: "bg-[#FEF3C7]", fg: "text-[#D97706]" },
  documento: { icon: FileUp, bg: "bg-[#E0F2FE]", fg: "text-[#0284C7]" },
  parceiro: { icon: Handshake, bg: "bg-[#F3E8FF]", fg: "text-[#A855F7]" },
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
        supabase.from("sales").select("amount, sale_date, status, product_id"),
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
      // assign palette colors if missing
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

  const { data: lastSales } = useQuery({
    queryKey: ["last-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, status, created_at, clients(full_name, company), products(name, product_categories(name))")
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
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
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

  // mock sparklines until we compute real per-KPI series
  const spark = (seed: number) =>
    Array.from({ length: 12 }, (_, i) => Math.round(50 + Math.sin((i + seed) * 0.7) * 18 + i * 2));

  const totalRevenue = stats?.totalRevenue ?? 0;
  const paid = stats?.paidCommissions ?? 0;
  const taxes = totalRevenue * 0.022; // simple display only
  const net = totalRevenue - paid - taxes;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bem-vindo de volta, {user?.email?.split("@")[0]}! Aqui está o resumo do seu negócio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted/50 transition-colors">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="vx-mono">01/05/2026 — 31/05/2026</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Faturamento Total"
          value={formatBRL(totalRevenue)}
          delta="+18.2%"
          positive
          icon={DollarSign}
          tone="violet"
          series={spark(1)}
        />
        <KpiCard
          label="Clientes Ativos"
          value={String(stats?.activeClients ?? 0)}
          delta="+12.5%"
          positive
          icon={Users}
          tone="emerald"
          series={spark(3)}
        />
        <KpiCard
          label="Parceiros Ativos"
          value={String(stats?.partnersCount ?? 0)}
          delta="+8.1%"
          positive
          icon={Handshake}
          tone="amber"
          series={spark(5)}
        />
        <KpiCard
          label="Comissões Pagas"
          value={formatBRL(paid)}
          delta="+15.3%"
          positive
          icon={Wallet}
          tone="sky"
          series={spark(7)}
        />
      </div>

      {/* Middle row: chart + donut + activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Faturamento area chart */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 shadow-vx-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Faturamento</p>
              <p className="font-display text-2xl font-extrabold vx-mono mt-1">{formatBRL(totalRevenue)}</p>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="text-xs border border-border rounded-lg px-3 h-8 bg-background font-medium"
            >
              <option value="month">Mensal</option>
              <option value="quarter">Trimestral</option>
              <option value="year">Anual</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={salesByMonth ?? []} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
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
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    fontSize: "12px",
                    boxShadow: "var(--shadow-md)",
                  }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  fill="url(#grad-rev)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut por categoria */}
        <div className="lg:col-span-4 bg-card rounded-2xl border border-border p-6 shadow-vx-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Faturamento por Produto
            </p>
            <select className="text-xs border border-border rounded-lg px-3 h-8 bg-background font-medium">
              <option>Todos</option>
            </select>
          </div>
          {byCategory && byCategory.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="size-40 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke="hsl(var(--card))"
                      strokeWidth={3}
                    >
                      {byCategory.map((c, i) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatBRL(v)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "10px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5 min-w-0">
                {byCategory.map((c) => {
                  const total = byCategory.reduce((s, x) => s + x.value, 0);
                  const pct = total ? ((c.value / total) * 100).toFixed(1) : "0";
                  return (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-sm font-medium truncate">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{pct}%</p>
                        <p className="text-[11px] text-muted-foreground vx-mono">{formatBRL(c.value)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Sparkles className="size-8 mb-2 opacity-40" />
              <p className="text-sm">Sem vendas ainda</p>
              <p className="text-xs mt-1">Cadastre vendas para ver a distribuição.</p>
            </div>
          )}
        </div>

        {/* Atividades recentes */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border p-6 shadow-vx-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Atividades Recentes
            </p>
            <button className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          <div className="space-y-4">
            {(activities ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade ainda.</p>
            ) : (
              activities?.map((a: any) => {
                const type = (a.entity_type as string) || "cliente";
                const meta = activityMeta[type] || activityMeta.cliente;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`size-9 rounded-full ${meta.bg} ${meta.fg} flex items-center justify-center shrink-0`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium leading-tight truncate">{a.action}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.description ?? "—"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(a.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: ultimos clientes + top parceiros + resumo financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Ultimos clientes */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-border shadow-vx-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Últimos Clientes</p>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary">
              Ver todos
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-2.5 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Empresa</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-6 py-2.5 text-right font-semibold">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(recentClients ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      Nenhum cliente cadastrado ainda
                    </td>
                  </tr>
                ) : (
                  recentClients?.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center text-[11px] font-bold">
                            {initials(c.full_name)}
                          </div>
                          <span className="font-semibold text-[13px]">{c.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-[13px]">{c.company ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            c.status === "ativo"
                              ? "bg-[#ECFDF5] text-[#10B981]"
                              : c.status === "prospecto"
                              ? "bg-[#FEF3C7] text-[#D97706]"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground text-xs">
                        {timeAgo(c.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top parceiros */}
        <div className="lg:col-span-4 bg-card rounded-2xl border border-border shadow-vx-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top Parceiros</p>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary">
              Ver todos
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-2.5 text-left font-semibold">Parceiro</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Comissões</th>
                  <th className="px-6 py-2.5 text-right font-semibold">Indicações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(topPartners ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      Nenhum parceiro com comissão ainda
                    </td>
                  </tr>
                ) : (
                  topPartners?.map((p, i) => (
                    <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`size-7 rounded-lg text-[11px] font-extrabold flex items-center justify-center ${
                              i === 0
                                ? "bg-amber-100 text-amber-700"
                                : i === 1
                                ? "bg-slate-200 text-slate-700"
                                : i === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="font-semibold text-[13px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right vx-mono font-semibold text-[13px]">
                        {formatBRL(p.total)}
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground text-[13px]">{p.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-vx-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resumo Financeiro</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Faturamento Bruto</span>
              <span className="text-sm font-semibold vx-mono">{formatBRL(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Comissões</span>
              <span className="text-sm font-semibold vx-mono text-destructive">- {formatBRL(paid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Taxas</span>
              <span className="text-sm font-semibold vx-mono text-destructive">- {formatBRL(taxes)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="bg-primary-muted rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-primary">Faturamento Líquido</span>
              <span className="text-base font-extrabold vx-mono text-primary">{formatBRL(net)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
