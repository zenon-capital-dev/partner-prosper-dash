import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { formatBRL } from "@/lib/format";
import {
  TrendingDown, TrendingUp, Wallet, AlertTriangle, CheckCircle2, Clock, Receipt,
  PieChart as PieIcon, Activity, ArrowUpRight, ArrowDownRight, Sparkles, Building2,
  CalendarClock, Landmark, Home, ChevronRight, CalendarRange,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { DateRangeField } from "@/components/DateRangeField";
import type { DateRange } from "react-day-picker";

const CATEGORY_PALETTE: Record<string, string> = {
  folha: "#6366f1", fornecedor: "#0ea5e9", ferramenta: "#8b5cf6", imposto: "#f43f5e",
  marketing: "#f59e0b", operacional: "#64748b", financeiro: "#10b981", outros: "#94a3b8",
  administrativa: "#a855f7", tecnologia: "#06b6d4", juridico: "#ec4899", infraestrutura: "#14b8a6",
};
const FALLBACK_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316"];

const ymd = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

type PeriodKey = "hoje" | "ontem" | "7d" | "15d" | "30d" | "mes" | "mes_ant" | "ano" | "tudo" | "custom";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoje: "Hoje", ontem: "Ontem", "7d": "7 dias", "15d": "15 dias", "30d": "30 dias",
  mes: "Este mês", mes_ant: "Mês anterior", ano: "Este ano", tudo: "Tudo", custom: "Personalizado",
};

function computeRange(key: PeriodKey, custom?: DateRange): { from: string; to: string } | null {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  switch (key) {
    case "hoje": return { from: ymd(now), to: ymd(now) };
    case "ontem": { const y = addDays(now, -1); return { from: ymd(y), to: ymd(y) }; }
    case "7d": return { from: ymd(addDays(now, -6)), to: ymd(now) };
    case "15d": return { from: ymd(addDays(now, -14)), to: ymd(now) };
    case "30d": return { from: ymd(addDays(now, -29)), to: ymd(now) };
    case "mes": return { from: ymd(startOfMonth(now)), to: ymd(endOfMonth(now)) };
    case "mes_ant": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: ymd(startOfMonth(prev)), to: ymd(endOfMonth(prev)) };
    }
    case "ano": return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    case "tudo": return null;
    case "custom":
      if (custom?.from) return { from: ymd(custom.from), to: ymd(custom.to || custom.from) };
      return null;
  }
}

function labelForRange(key: PeriodKey, r: { from: string; to: string } | null): string {
  if (!r) return "Todo o histórico";
  const fromD = new Date(r.from + "T00:00:00"); const toD = new Date(r.to + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (r.from === r.to) return fromD.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return `${fmt(fromD)} — ${fmt(toD)} · ${toD.getFullYear()}`;
}

const dayKey = (e: any) => (e.expense_date || e.reference_month || "").slice(0, 10);

export default function OperationalExpenses() {
  const { isAdmin } = useAuth();
  const cats = useExpenseCategories();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["fin-expenses"],
    queryFn: async () =>
      (await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(2000)).data ?? [],
    enabled: isAdmin,
  });

  const range = useMemo(() => computeRange(period, customRange), [period, customRange]);

  const today = ymd(new Date());

  // Filtrado pelo período selecionado — todos os KPIs, gráficos e a lista abaixo respeitam esse filtro.
  const filtered = useMemo(() => {
    if (!range) return expenses as any[];
    return (expenses as any[]).filter((e) => {
      const d = dayKey(e);
      return d >= range.from && d <= range.to;
    });
  }, [expenses, range]);

  // Para comparação: mesmo tamanho de janela imediatamente anterior
  const prevFiltered = useMemo(() => {
    if (!range) return [];
    const from = new Date(range.from + "T00:00:00");
    const to = new Date(range.to + "T00:00:00");
    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));
    const pf = ymd(prevFrom), pt = ymd(prevTo);
    return (expenses as any[]).filter((e) => { const d = dayKey(e); return d >= pf && d <= pt; });
  }, [expenses, range]);

  const kpis = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0, paidCount = 0;
    for (const e of filtered) {
      const v = Number(e.amount || 0);
      total += v;
      if (e.paid) { paid += v; paidCount++; }
      else {
        pending += v;
        const od = (e.due_date && e.due_date < today) || (!e.due_date && e.expense_date < today);
        if (od) overdue += v;
      }
    }
    const prevTotal = prevFiltered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    return { total, paid, pending, overdue, paidCount, count: filtered.length, prevTotal, delta };
  }, [filtered, prevFiltered, today]);

  // Série diária para o gráfico dentro do período (agrupada por dia)
  const dailySeries = useMemo(() => {
    if (!range) {
      // Fallback: mensal
      const map = new Map<string, number>();
      for (const e of filtered) {
        const k = (e.reference_month || e.expense_date || "").slice(0, 7);
        if (!k) continue;
        map.set(k, (map.get(k) || 0) + Number(e.amount || 0));
      }
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
        label: new Date(k + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        total: Math.round(v),
      }));
    }
    const map = new Map<string, number>();
    for (const e of filtered) {
      const k = dayKey(e); if (!k) continue;
      map.set(k, (map.get(k) || 0) + Number(e.amount || 0));
    }
    // Preencher todos os dias para linha contínua
    const from = new Date(range.from + "T00:00:00");
    const to = new Date(range.to + "T00:00:00");
    const out: { label: string; total: number; day: string }[] = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const k = ymd(d);
      out.push({
        day: k,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        total: Math.round(map.get(k) || 0),
      });
    }
    return out;
  }, [filtered, range]);

  const categorySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const key = e.category || "outros";
      map.set(key, (map.get(key) || 0) + Number(e.amount || 0));
    }
    const arr = Array.from(map.entries())
      .map(([k, v]) => ({
        key: k, name: cats.labelOf(k), value: Math.round(v),
        color: cats.colorOf(k) || CATEGORY_PALETTE[k] || FALLBACK_COLORS[0],
      }))
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    return arr.map((x, i) => ({ ...x, pct: (x.value / total) * 100, color: x.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));
  }, [filtered, cats]);

  const topVendors = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const v = (e.vendor || "").trim(); if (!v) continue;
      const cur = map.get(v) || { total: 0, count: 0 };
      cur.total += Number(e.amount || 0); cur.count += 1;
      map.set(v, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([name, v]) => ({ name, total: v.total, count: v.count }));
  }, [filtered]);

  const upcoming = useMemo(() => {
    return (expenses as any[])
      .filter((e) => !e.paid && e.due_date && e.due_date >= today)
      .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
      .slice(0, 5);
  }, [expenses, today]);

  if (!isAdmin) return <div className="p-8 text-sm text-slate-600">Acesso restrito.</div>;

  const positiveDelta = kpis.delta > 0.1;  // gasto subiu => ruim
  const negativeDelta = kpis.delta < -0.1; // gasto caiu => bom

  return (
    <div className="min-h-full bg-slate-50/40">
      {/* HERO / SUMMARY — estilo Mobills */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-6 pb-8">
          <nav className="flex items-center gap-1.5 text-xs text-indigo-200/80 mb-5">
            <Link to="/" className="hover:text-white inline-flex items-center gap-1">
              <Home className="size-3" /> Início
            </Link>
            <ChevronRight className="size-3" />
            <span>Financeiro</span>
            <ChevronRight className="size-3" />
            <span className="text-white font-medium">Despesas operacionais</span>
          </nav>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-indigo-200">
                  Despesas · {PERIOD_LABELS[period]}
                </span>
                <span className="size-1 rounded-full bg-indigo-300/60" />
                <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-indigo-100 inline-flex items-center gap-1">
                  <CalendarRange className="size-3" /> {labelForRange(period, range)}
                </span>
              </div>
              <p className="font-mono text-[44px] lg:text-[52px] leading-none font-bold tabular-nums tracking-tight">
                {formatBRL(kpis.total)}
              </p>
              <div className="flex items-center gap-3 mt-3 text-sm text-indigo-100">
                <span>{kpis.count} lançamento{kpis.count !== 1 ? "s" : ""}</span>
                {kpis.prevTotal > 0 && (
                  <>
                    <span className="text-indigo-300">·</span>
                    <span className={cn(
                      "inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md text-xs",
                      positiveDelta ? "bg-rose-500/20 text-rose-100" :
                      negativeDelta ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-indigo-100"
                    )}>
                      {positiveDelta ? <ArrowUpRight className="size-3" /> :
                       negativeDelta ? <ArrowDownRight className="size-3" /> : null}
                      {Math.abs(kpis.delta).toFixed(1)}% vs. período anterior
                    </span>
                    <span className="text-indigo-200 text-xs">({formatBRL(kpis.prevTotal)})</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Pagas" value={formatBRL(kpis.paid)} tone="emerald" icon={<CheckCircle2 />} />
              <MiniStat label="Pendentes" value={formatBRL(kpis.pending)} tone="amber" icon={<Clock />} />
              <MiniStat label="Vencidas" value={formatBRL(kpis.overdue)} tone="rose" icon={<AlertTriangle />} urgent={kpis.overdue > 0} />
            </div>
          </div>
        </div>

        {/* Period pills — sticky feel */}
        <div className="bg-white/5 backdrop-blur border-t border-white/10">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-10 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {(["hoje", "ontem", "7d", "15d", "30d", "mes", "mes_ant", "ano", "tudo"] as PeriodKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={cn(
                  "shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
                  period === k
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-indigo-100 hover:bg-white/10"
                )}
              >
                {PERIOD_LABELS[k]}
              </button>
            ))}
            <div className={cn(
              "shrink-0 flex items-center gap-1 pl-2 ml-1 border-l",
              period === "custom" ? "border-white/40" : "border-white/20"
            )}>
              <button
                onClick={() => setPeriod("custom")}
                className={cn(
                  "shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5",
                  period === "custom"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-indigo-100 hover:bg-white/10"
                )}
              >
                <CalendarRange className="size-3.5" /> Personalizado
              </button>
              {period === "custom" && (
                <div className="ml-1">
                  <DateRangeField
                    value={customRange}
                    onChange={(r) => setCustomRange(r)}
                    placeholder="Escolher datas"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">
        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <PremiumCard
            title="Fluxo do período"
            subtitle={labelForRange(period, range)}
            icon={<Activity />}
            className="xl:col-span-2"
          >
            {dailySeries.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailySeries} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9", opacity: 0.5 }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 6px 24px -8px rgba(15,23,42,0.15)" }}
                    labelStyle={{ fontWeight: 700, color: "#0f172a" }}
                    formatter={(v: number) => [formatBRL(Number(v)), "Total"]}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </PremiumCard>

          <PremiumCard
            title="Por categoria"
            subtitle="Distribuição no período"
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
            subtitle="Onde o caixa foi mais consumido no período"
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
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, c.pct)}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PremiumCard>

          <PremiumCard
            title="Próximos vencimentos"
            subtitle="Independente do filtro de período"
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
                  const d = new Date(e.due_date + "T00:00:00");
                  const days = Math.round((d.getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
                  const urgent = days <= 3;
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200/70 hover:bg-slate-50/60 transition-colors">
                      <div className={cn(
                        "size-10 rounded-lg flex flex-col items-center justify-center shrink-0 font-mono font-bold border",
                        urgent ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      )}>
                        <span className="text-[9px] uppercase leading-none opacity-70">D+</span>
                        <span className="text-sm leading-none">{days}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{e.description}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {e.vendor ? `${e.vendor} · ` : ""}
                          {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
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

        {/* Top fornecedores */}
        {topVendors.length > 0 && (
          <PremiumCard title="Top fornecedores" subtitle="Maiores destinos do caixa no período" icon={<Building2 />}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
              {topVendors.map((v, i) => (
                <div key={v.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200/70">
                  <span className="size-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{v.name}</p>
                    <p className="text-[10.5px] text-slate-500">{v.count} lançamento{v.count !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-900 tabular-nums shrink-0">{formatBRL(v.total)}</span>
                </div>
              ))}
            </div>
          </PremiumCard>
        )}

        {/* Lançamentos — respeitam o filtro de período do topo */}
        {isLoading ? (
          <div className="bg-white border border-slate-200/70 rounded-xl p-10 text-center text-sm text-slate-500 shadow-sm">
            Carregando despesas…
          </div>
        ) : (
          <ExpensesTab expenses={filtered as any[]} canManage={isAdmin} showKpis={false} disableInternalDateFilter />
        )}
      </div>
    </div>
  );
}

/* ────────────────────── UI PRIMITIVES ────────────────────── */

function MiniStat({ label, value, tone, icon, urgent }: {
  label: string; value: string; tone: "emerald" | "amber" | "rose"; icon: React.ReactNode; urgent?: boolean;
}) {
  const toneMap: Record<string, { chip: string; iconCls: string }> = {
    emerald: { chip: "bg-emerald-400/20 text-emerald-50", iconCls: "text-emerald-200" },
    amber: { chip: "bg-amber-400/20 text-amber-50", iconCls: "text-amber-200" },
    rose: { chip: "bg-rose-400/20 text-rose-50", iconCls: "text-rose-100" },
  };
  const t = toneMap[tone];
  return (
    <div className={cn(
      "min-w-[130px] rounded-xl border border-white/15 bg-white/5 backdrop-blur px-3.5 py-2.5",
      urgent && "ring-2 ring-rose-400/60 animate-pulse"
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("size-4 [&>svg]:size-3.5", t.iconCls)}>{icon}</span>
        <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-100">{label}</span>
      </div>
      <p className={cn("font-mono text-base font-bold tabular-nums text-white", t.chip && "")}>{value}</p>
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

function EmptyState() {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-center">
      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
        <PieIcon className="size-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-500">Sem dados no período</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Ajuste o filtro acima ou lance uma nova despesa</p>
    </div>
  );
}
