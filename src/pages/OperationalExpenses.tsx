import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { formatBRL } from "@/lib/format";
import {
  TrendingDown, TrendingUp, Wallet, AlertTriangle, CheckCircle2, Clock, Receipt,
  PieChart as PieIcon, Activity, ArrowUpRight, ArrowDownRight, Sparkles, Building2,
  CalendarClock, Landmark, ArrowRight, Home, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";

const CATEGORY_LABELS: Record<string, string> = {
  folha: "Folha / Salários",
  fornecedor: "Fornecedor",
  ferramenta: "Ferramenta / Software",
  imposto: "Imposto / Tributo",
  marketing: "Marketing",
  operacional: "Operacional",
  financeiro: "Financeiro / Bancário",
  outros: "Outros",
  administrativa: "Administrativa",
  tecnologia: "Tecnologia",
  juridico: "Jurídico / Contábil",
  infraestrutura: "Infraestrutura",
};

const CATEGORY_PALETTE: Record<string, string> = {
  folha: "#6366f1",
  fornecedor: "#0ea5e9",
  ferramenta: "#8b5cf6",
  imposto: "#f43f5e",
  marketing: "#f59e0b",
  operacional: "#64748b",
  financeiro: "#10b981",
  outros: "#94a3b8",
  administrativa: "#a855f7",
  tecnologia: "#06b6d4",
  juridico: "#ec4899",
  infraestrutura: "#14b8a6",
};

const FALLBACK_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316",
];

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

const monthFullLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

const daysUntil = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
};

export default function OperationalExpenses() {
  const { isAdmin } = useAuth();
  const cats = useExpenseCategories();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["fin-expenses"],
    queryFn: async () =>
      (await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(1000)).data ?? [],
    enabled: isAdmin,
  });

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const prevMonth = (() => {
    const d = new Date(currentMonth + "-01T00:00:00");
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const kpis = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0;
    let monthTotal = 0, prevMonthTotal = 0;
    let paidCount = 0;
    for (const e of expenses as any[]) {
      const v = Number(e.amount || 0);
      total += v;
      if (e.paid) { paid += v; paidCount++; }
      else {
        pending += v;
        const od = (e.due_date && e.due_date < today) || (!e.due_date && e.expense_date < today);
        if (od) overdue += v;
      }
      const ref = (e.reference_month || e.expense_date || "").slice(0, 7);
      if (ref === currentMonth) monthTotal += v;
      if (ref === prevMonth) prevMonthTotal += v;
    }
    const monthDelta = prevMonthTotal > 0 ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
    return { total, paid, pending, overdue, monthTotal, prevMonthTotal, monthDelta, count: expenses.length, paidCount };
  }, [expenses, today, currentMonth, prevMonth]);

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
      .slice(-12)
      .map(([ym, v]) => ({
        ym,
        mes: monthLabel(ym),
        pago: Math.round(v.pago),
        pendente: Math.round(v.pendente),
        total: Math.round(v.pago + v.pendente),
      }));
  }, [expenses]);

  const categorySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses as any[]) {
      const key = e.category || "outros";
      map.set(key, (map.get(key) || 0) + Number(e.amount || 0));
    }
    const arr = Array.from(map.entries())
      .map(([k, v]) => ({
        key: k,
        name: cats.labelOf(k),
        value: Math.round(v),
        color: cats.colorOf(k) || CATEGORY_PALETTE[k] || FALLBACK_COLORS[0],
      }))
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    return arr.map((x, i) => ({ ...x, pct: (x.value / total) * 100, color: x.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));
  }, [expenses, cats]);

  const topVendors = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of expenses as any[]) {
      const v = (e.vendor || "").trim();
      if (!v) continue;
      const cur = map.get(v) || { total: 0, count: 0 };
      cur.total += Number(e.amount || 0);
      cur.count += 1;
      map.set(v, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, v]) => ({ name, total: v.total, count: v.count }));
  }, [expenses]);

  const upcoming = useMemo(() => {
    return (expenses as any[])
      .filter((e) => !e.paid && e.due_date && e.due_date >= today)
      .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
      .slice(0, 5);
  }, [expenses, today]);

  if (!isAdmin) return <div className="p-8 text-sm text-slate-600">Acesso restrito.</div>;

  return (
    <div className="min-h-full bg-slate-50/40">
      {/* HERO */}
      <div className="border-b border-slate-200/70 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-7">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
            <Link to="/" className="hover:text-slate-900 inline-flex items-center gap-1">
              <Home className="size-3" /> Início
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-slate-500">Financeiro</span>
            <ChevronRight className="size-3" />
            <span className="text-slate-900 font-medium">Despesas operacionais</span>
          </nav>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                <TrendingDown className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-slate-500">Financeiro · Custos</span>
                  <span className="size-1 rounded-full bg-slate-300" />
                  <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-indigo-600 inline-flex items-center gap-1">
                    <Sparkles className="size-3" /> {monthFullLabel(currentMonth)}
                  </span>
                </div>
                <h1 className="font-display text-[32px] lg:text-[36px] font-bold tracking-[-0.02em] text-slate-900 leading-tight">
                  Despesas Operacionais
                </h1>
                <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
                  Todo custo que sai do caixa da operação — folha, ferramentas, impostos, fornecedores.
                  Impacta diretamente o lucro líquido da Zenon.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10.5px] uppercase tracking-widest text-slate-400 font-semibold">Total lançado</p>
                <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">{formatBRL(kpis.total)}</p>
                <p className="text-[10.5px] text-slate-500 mt-0.5">{kpis.count} lançamento{kpis.count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <PremiumKpi
            label="Mês atual"
            value={formatBRL(kpis.monthTotal)}
            sub={`vs. ${formatBRL(kpis.prevMonthTotal)} anterior`}
            delta={kpis.monthDelta}
            icon={<Receipt />}
            tone="indigo"
            featured
          />
          <PremiumKpi
            label="Pagas"
            value={formatBRL(kpis.paid)}
            sub={`${kpis.paidCount} lançamento${kpis.paidCount !== 1 ? "s" : ""}`}
            icon={<CheckCircle2 />}
            tone="emerald"
          />
          <PremiumKpi
            label="Pendentes"
            value={formatBRL(kpis.pending)}
            sub="aguardando pagamento"
            icon={<Clock />}
            tone="amber"
          />
          <PremiumKpi
            label="Vencidas"
            value={formatBRL(kpis.overdue)}
            sub="atenção imediata"
            icon={<AlertTriangle />}
            tone="rose"
            urgent={kpis.overdue > 0}
          />
          <PremiumKpi
            label="Total geral"
            value={formatBRL(kpis.total)}
            sub="histórico completo"
            icon={<Wallet />}
            tone="slate"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <PremiumCard
            title="Evolução mensal"
            subtitle="Fluxo de despesas por competência, últimos 12 meses"
            icon={<Activity />}
            className="xl:col-span-2"
          >
            {monthlySeries.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlySeries} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPago" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9", opacity: 0.5 }}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 6px 24px -8px rgba(15,23,42,0.15)",
                      padding: "10px 12px",
                    }}
                    labelStyle={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}
                    formatter={(v: number, k) => [formatBRL(Number(v)), k === "pago" ? "Pago" : "Pendente"]}
                  />
                  <Area type="monotone" dataKey="pago" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#gradPago)" />
                  <Area type="monotone" dataKey="pendente" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="url(#gradPend)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 pt-3 mt-3 border-t border-slate-100 text-[11px]">
              <LegendDot color="#10b981" label="Pago" />
              <LegendDot color="#f59e0b" label="Pendente" />
            </div>
          </PremiumCard>

          <PremiumCard
            title="Composição por categoria"
            subtitle="Distribuição do gasto histórico"
            icon={<PieIcon />}
          >
            {categorySeries.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categorySeries} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}>
                        {categorySeries.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                        formatter={(v: number) => formatBRL(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Total</p>
                    <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">{formatBRL(kpis.total)}</p>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {categorySeries.slice(0, 5).map((c) => (
                    <div key={c.key} className="flex items-center gap-2 text-[11.5px]">
                      <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-slate-700 truncate flex-1">{c.name}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">{c.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PremiumCard>
        </div>

        {/* Ranking + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PremiumCard
            title="Ranking de categorias"
            subtitle="Onde a operação mais consome caixa"
            icon={<Landmark />}
          >
            {categorySeries.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3 pt-1">
                {categorySeries.slice(0, 6).map((c, i) => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-mono font-bold text-[10px]">
                          {i + 1}
                        </span>
                        <span className="font-medium text-slate-800 truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums font-semibold text-slate-900">{formatBRL(c.value)}</span>
                        <span className="text-[10.5px] font-mono text-slate-500 tabular-nums w-11 text-right">{c.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, c.pct)}%`, background: c.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PremiumCard>

          <PremiumCard
            title="Próximos vencimentos"
            subtitle="Contas pendentes que ainda não venceram"
            icon={<CalendarClock />}
          >
            {upcoming.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhum vencimento à vista</p>
                <p className="text-xs text-slate-500 mt-1">Tudo em dia por aqui.</p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {upcoming.map((e) => {
                  const days = daysUntil(e.due_date);
                  const urgent = days <= 3;
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200/70 hover:bg-slate-50/60 transition-colors">
                      <div className={cn(
                        "size-10 rounded-lg flex flex-col items-center justify-center shrink-0 font-mono font-bold border",
                        urgent
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      )}>
                        <span className="text-[9px] uppercase leading-none opacity-70">D+</span>
                        <span className="text-sm leading-none">{days}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{e.description}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {e.vendor ? `${e.vendor} · ` : ""}
                          {new Date(e.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">{formatBRL(e.amount)}</p>
                        <p className={cn("text-[10px] font-semibold uppercase tracking-wider", urgent ? "text-rose-600" : "text-slate-500")}>
                          {urgent ? "urgente" : "em dia"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PremiumCard>
        </div>

        {/* Top fornecedores + Tendência */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PremiumCard
            title="Top fornecedores"
            subtitle="Maiores destinos do caixa"
            icon={<Building2 />}
          >
            {topVendors.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-2 pt-1">
                {topVendors.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-3 py-1.5 border-b last:border-b-0 border-slate-100">
                    <span className="size-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{v.name}</p>
                      <p className="text-[10.5px] text-slate-500">{v.count} lançamento{v.count !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums shrink-0">{formatBRL(v.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </PremiumCard>

          <PremiumCard
            title="Tendência total"
            subtitle="Somatório mensal de despesas"
            icon={<TrendingDown />}
            className="lg:col-span-2"
          >
            {monthlySeries.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlySeries} margin={{ top: 10, right: 20, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number) => formatBRL(Number(v))}
                  />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </PremiumCard>
        </div>

        {/* Lançamentos */}
        {isLoading ? (
          <div className="bg-white border border-slate-200/70 rounded-xl p-10 text-center text-sm text-slate-500 shadow-sm">
            Carregando despesas…
          </div>
        ) : (
          <ExpensesTab expenses={expenses as any[]} canManage={isAdmin} showKpis={false} />
        )}
      </div>
    </div>
  );
}

/* ────────────────────── UI PRIMITIVES ────────────────────── */

function PremiumKpi({
  label, value, sub, delta, icon, tone, featured, urgent,
}: {
  label: string; value: string; sub?: string; delta?: number;
  icon: React.ReactNode;
  tone: "slate" | "emerald" | "amber" | "rose" | "indigo";
  featured?: boolean; urgent?: boolean;
}) {
  const toneMap: Record<string, { bg: string; icon: string; ring: string }> = {
    slate:   { bg: "bg-slate-50", icon: "text-slate-600 bg-white", ring: "ring-slate-200/70" },
    emerald: { bg: "bg-emerald-50/50", icon: "text-emerald-600 bg-white", ring: "ring-emerald-100" },
    amber:   { bg: "bg-amber-50/50", icon: "text-amber-600 bg-white", ring: "ring-amber-100" },
    rose:    { bg: "bg-rose-50/50", icon: "text-rose-600 bg-white", ring: "ring-rose-100" },
    indigo:  { bg: "bg-gradient-to-br from-indigo-600 to-indigo-800 text-white", icon: "text-indigo-100 bg-white/10", ring: "ring-indigo-500/30" },
  };
  const t = toneMap[tone];
  const isDark = tone === "indigo" && featured;

  return (
    <div className={cn(
      "relative rounded-xl border border-slate-200/70 shadow-sm p-4 overflow-hidden ring-1",
      t.bg, t.ring,
      urgent && "animate-pulse ring-rose-300",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-[10px] uppercase tracking-[0.15em] font-bold", isDark ? "text-indigo-200" : "text-slate-500")}>
            {label}
          </p>
          <p className={cn(
            "font-mono font-bold tabular-nums mt-1.5",
            featured ? "text-2xl" : "text-xl",
            isDark ? "text-white" : "text-slate-900",
          )}>
            {value}
          </p>
        </div>
        <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0 [&>svg]:size-4", t.icon)}>
          {icon}
        </div>
      </div>
      {(sub || delta !== undefined) && (
        <div className="flex items-center gap-2 mt-2">
          {delta !== undefined && Math.abs(delta) > 0.1 && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded",
              delta > 0
                ? (isDark ? "bg-rose-400/20 text-rose-100" : "bg-rose-50 text-rose-700")
                : (isDark ? "bg-emerald-400/20 text-emerald-100" : "bg-emerald-50 text-emerald-700"),
            )}>
              {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {sub && (
            <p className={cn("text-[10.5px] truncate", isDark ? "text-indigo-200" : "text-slate-500")}>{sub}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PremiumCard({
  title, subtitle, icon, children, className = "",
}: {
  title: string; subtitle?: string; icon?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("bg-white border border-slate-200/70 rounded-xl shadow-sm p-5 flex flex-col", className)}>
      <div className="flex items-start gap-3 mb-3">
        {icon && (
          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center [&>svg]:size-4 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold text-slate-900 tracking-tight leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      <span className="font-medium">{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-center">
      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
        <PieIcon className="size-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-500">Sem dados para exibir</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Comece lançando sua primeira despesa</p>
    </div>
  );
}
