import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, Handshake, Wallet, Calendar, Download, MoreHorizontal } from "lucide-react";
import { formatBRL, timeAgo } from "@/lib/format";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clients, partners, sales, commissions] = await Promise.all([
        supabase.from("clients").select("id, status", { count: "exact" }),
        supabase.from("partners").select("id", { count: "exact" }).eq("active", true),
        supabase.from("sales").select("amount, sale_date, status, product_id"),
        supabase.from("commissions").select("amount, status, paid_at"),
      ]);

      const totalRevenue = (sales.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const paidCommissions = (commissions.data ?? []).filter((c) => c.status === "pago").reduce((s, x) => s + Number(x.amount), 0);
      const pendingCommissions = (commissions.data ?? []).filter((c) => c.status === "pendente").reduce((s, x) => s + Number(x.amount), 0);

      return {
        clientsCount: clients.count ?? 0,
        activeClients: (clients.data ?? []).filter((c) => c.status === "ativo").length,
        partnersCount: partners.count ?? 0,
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
      const result = months.map((m, i) => ({ month: m, value: 0 }));
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
      return Array.from(map.values());
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
      const map = new Map<string, { name: string; total: number }>();
      (data ?? []).forEach((c: any) => {
        if (!c.partners) return;
        const cur = map.get(c.partner_id) ?? { name: c.partners.full_name, total: 0 };
        cur.total += Number(c.amount);
        map.set(c.partner_id, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    },
  });

  const isEmpty = !stats || stats.clientsCount === 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação em tempo real."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="size-4" /> Este mês
            </Button>
            <Button size="sm" className="gap-2 bg-gradient-primary hover:opacity-90">
              <Download className="size-4" /> Exportar
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Faturamento Total" value={formatBRL(stats?.totalRevenue ?? 0)} icon={DollarSign} iconColor="primary" delta={{ value: "18.2%", positive: true }} />
        <StatCard label="Clientes Ativos" value={String(stats?.activeClients ?? 0)} icon={Users} iconColor="success" delta={{ value: "12.5%", positive: true }} />
        <StatCard label="Parceiros Ativos" value={String(stats?.partnersCount ?? 0)} icon={Handshake} iconColor="warning" delta={{ value: "8.1%", positive: true }} />
        <StatCard label="Comissões Pendentes" value={formatBRL(stats?.pendingCommissions ?? 0)} icon={Wallet} iconColor="info" delta={{ value: "3.4%", positive: false }} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 vx-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Faturamento</p>
              <p className="font-display text-2xl font-bold vx-mono mt-1">{formatBRL(stats?.totalRevenue ?? 0)}</p>
            </div>
            <select className="text-xs border border-border rounded-md px-3 h-8 bg-background">
              <option>Mensal</option>
              <option>Trimestral</option>
              <option>Anual</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByMonth ?? []} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="vx-card p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Por Categoria</p>
          </div>
          {byCategory && byCategory.length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: c.color }} />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="font-medium vx-mono">{formatBRL(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center text-muted-foreground">
              <p className="text-sm">Sem vendas ainda</p>
              <p className="text-xs mt-1">Cadastre vendas para ver a distribuição.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 vx-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">Últimos Clientes</p>
            <Button variant="ghost" size="sm" className="text-xs">Ver todos</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-6 py-3 text-left font-semibold">Empresa</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(recentClients ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm">Nenhum cliente cadastrado ainda</td></tr>
                ) : recentClients?.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary-muted text-primary flex items-center justify-center text-xs font-semibold">
                          {c.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                        </div>
                        <span className="font-medium">{c.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{c.company ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        c.status === "ativo" ? "bg-success-muted text-success" :
                        c.status === "prospecto" ? "bg-warning-muted text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground text-xs">{timeAgo(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="vx-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">Top Parceiros</p>
            <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="size-4" /></button>
          </div>
          <div className="p-2">
            {(topPartners ?? []).length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground text-sm">Nenhum parceiro com comissão</div>
            ) : topPartners?.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="size-6 rounded-md bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comissões geradas</p>
                  </div>
                </div>
                <span className="text-sm font-semibold vx-mono">{formatBRL(p.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isEmpty && (
        <div className="mt-8 vx-card p-8 text-center bg-gradient-to-br from-primary-muted/50 to-transparent border-primary/20">
          <p className="text-sm font-semibold mb-2">👋 Bem-vindo ao VENDX!</p>
          <p className="text-sm text-muted-foreground mb-4">Comece cadastrando seu primeiro cliente, parceiro ou produto.</p>
        </div>
      )}
    </div>
  );
}
