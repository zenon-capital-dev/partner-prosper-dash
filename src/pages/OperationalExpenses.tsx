import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHero } from "@/components/PageHero";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { formatBRL } from "@/lib/format";
import {
  TrendingDown, Wallet, AlertTriangle, CheckCircle2, Clock, Receipt, PieChart as PieIcon, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const CATEGORY_LABELS: Record<string, string> = {
  operacional: "Operacional",
  administrativa: "Administrativa",
  marketing: "Marketing",
  tecnologia: "Tecnologia",
  impostos: "Impostos",
  juridico: "Jurídico/Contábil",
  infraestrutura: "Infraestrutura",
  outras: "Outras",
};

const CATEGORY_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#0ea5e9", "#8b5cf6", "#14b8a6", "#64748b",
];

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

export default function OperationalExpenses() {
  const { isAdmin } = useAuth();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["fin-expenses"],
    queryFn: async () =>
      (await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(600)).data ?? [],
    enabled: isAdmin,
  });

  const today = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0;
    const currentMonth = today.slice(0, 7);
    let monthTotal = 0;
    for (const e of expenses as any[]) {
      const v = Number(e.amount || 0);
      total += v;
      if (e.paid) paid += v;
      else {
        pending += v;
        const od = (e.due_date && e.due_date < today) || (!e.due_date && e.expense_date < today);
        if (od) overdue += v;
      }
      const ref = (e.reference_month || e.expense_date || "").slice(0, 7);
      if (ref === currentMonth) monthTotal += v;
    }
    return { total, paid, pending, overdue, monthTotal };
  }, [expenses, today]);

  const monthlySeries = useMemo(() => {
    const map = new Map<string, { pago: number; pendente: number }>();
    for (const e of expenses as any[]) {
      const ref = (e.reference_month || e.expense_date || "").slice(0, 7);
      if (!ref) continue;
      const cur = map.get(ref) || { pago: 0, pendente: 0 };
      const v = Number(e.amount || 0);
      if (e.paid) cur.pago += v; else cur.pendente += v;
      map.set(ref, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([ym, v]) => ({ mes: monthLabel(ym), pago: Math.round(v.pago), pendente: Math.round(v.pendente), total: Math.round(v.pago + v.pendente) }));
  }, [expenses]);

  const categorySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses as any[]) {
      const key = e.category || "outras";
      map.set(key, (map.get(key) || 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (!isAdmin) return <div className="p-8 text-sm text-slate-600">Acesso restrito.</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        icon={<TrendingDown className="size-5" />}
        title="Despesas Operacionais"
        description="Controle total dos gastos: lançamento, competência, vencimentos, categorias e impacto no lucro líquido."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Total geral" value={formatBRL(kpis.total)} tone="slate" icon={<Wallet className="size-4" />} />
        <KpiCard label="Mês atual" value={formatBRL(kpis.monthTotal)} tone="indigo" icon={<Receipt className="size-4" />} />
        <KpiCard label="Pagas" value={formatBRL(kpis.paid)} tone="emerald" icon={<CheckCircle2 className="size-4" />} />
        <KpiCard label="Pendentes" value={formatBRL(kpis.pending)} tone="amber" icon={<Clock className="size-4" />} />
        <KpiCard label="Vencidas" value={formatBRL(kpis.overdue)} tone="rose" icon={<AlertTriangle className="size-4" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Evolução mensal" subtitle="Últimos 8 meses de competência" icon={<BarChart3 className="size-4" />} className="lg:col-span-2">
          {monthlySeries.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number, k) => [formatBRL(Number(v)), k === "pago" ? "Pago" : "Pendente"]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pago" name="Pago" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pendente" name="Pendente" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por categoria" subtitle="Distribuição do gasto total" icon={<PieIcon className="size-4" />}>
          {categorySeries.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categorySeries} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {categorySeries.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: number) => formatBRL(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Tendência total" subtitle="Volume total de despesas por mês" icon={<TrendingDown className="size-4" />}>
        {monthlySeries.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlySeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: number) => formatBRL(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Tabela + dialog reutilizados (KPIs internos ocultos p/ não duplicar) */}
      {isLoading ? (
        <div className="bg-white border border-slate-200/70 rounded-lg p-8 text-center text-sm text-slate-500">Carregando despesas…</div>
      ) : (
        <ExpensesTab expenses={expenses as any[]} canManage={isAdmin} showKpis={false} />
      )}
    </div>
  );
}

function KpiCard({ label, value, tone, icon }: {
  label: string; value: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "indigo"; icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-700",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-white border-amber-200 text-amber-700",
    rose: "from-rose-50 to-white border-rose-200 text-rose-700",
    indigo: "from-indigo-50 to-white border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} border rounded-xl p-3.5 shadow-sm`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
        {icon} {label}
      </div>
      <div className="text-xl font-mono font-bold text-slate-900 mt-1.5 tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon, children, className = "" }: {
  title: string; subtitle?: string; icon?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200/70 rounded-xl p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-indigo-600">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
      Sem dados para exibir
    </div>
  );
}
