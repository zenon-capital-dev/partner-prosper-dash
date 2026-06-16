import { useMemo, useState } from "react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarRange, Search, Download, TrendingUp, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";

type Payment = {
  id: string;
  client_id?: string;
  due_date?: string | null;
  amount?: number | null;
  amount_paid?: number | null;
  status?: string | null;
  paid_at?: string | null;
  clients?: { id: string; full_name?: string; company?: string } | null;
  products?: { name?: string } | null;
  client_products?: { custom_product_name?: string } | null;
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const OPEN_STATUSES = ["em_aberto", "pendente", "parcial", "parcialmente_pago"];
const PAID_STATUSES = ["pago", "paga"];
const isOpen = (s: any) => OPEN_STATUSES.includes(s);
const isPaid = (s: any) => PAID_STATUSES.includes(s);

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parseYM(key: string): { y: number; m: number } {
  const [y, m] = key.split("-").map(Number);
  return { y, m: m - 1 };
}
function todayYM() {
  const t = new Date();
  return ymKey(new Date(t.getFullYear(), t.getMonth(), 1));
}

export function RevenueMap({ payments }: { payments: Payment[] }) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("todos");
  const [horizon, setHorizon] = useState<"12" | "24" | "36" | "all">("all");

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    payments.forEach((p) => {
      if (p.clients?.id) m.set(p.clients.id, p.clients.company || p.clients.full_name || "—");
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (!p.due_date) return false;
      if (clientFilter !== "todos" && p.clients?.id !== clientFilter) return false;
      if (q) {
        const hay = `${p.clients?.full_name ?? ""} ${p.clients?.company ?? ""} ${p.products?.name ?? ""} ${p.client_products?.custom_product_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, search, clientFilter]);

  // monthly buckets
  const { months, totalsByMonth, byClient, grand } = useMemo(() => {
    const today = todayYM();
    const all: string[] = [];
    const totals = new Map<string, { total: number; received: number; open: number; overdue: number; count: number }>();
    const clientMap = new Map<string, { id: string; name: string; perMonth: Map<string, number>; total: number }>();
    let minKey: string | null = null;
    let maxKey: string | null = null;

    filtered.forEach((p) => {
      const d = new Date(p.due_date as string);
      if (Number.isNaN(d.getTime())) return;
      const key = ymKey(d);
      if (!minKey || key < minKey) minKey = key;
      if (!maxKey || key > maxKey) maxKey = key;
      const amount = Number(p.amount || 0);
      const paid = Number(p.amount_paid || 0);
      const isOverdue = isOpen(p.status) && key < today;
      const cur = totals.get(key) ?? { total: 0, received: 0, open: 0, overdue: 0, count: 0 };
      cur.total += amount;
      cur.count += 1;
      if (isPaid(p.status)) cur.received += paid > 0 ? paid : amount;
      else {
        cur.open += Math.max(amount - paid, 0);
        if (isOverdue) cur.overdue += Math.max(amount - paid, 0);
        if (paid > 0) cur.received += paid;
      }
      totals.set(key, cur);

      const cid = p.clients?.id || "_";
      const cname = p.clients?.company || p.clients?.full_name || "—";
      const c = clientMap.get(cid) ?? { id: cid, name: cname, perMonth: new Map<string, number>(), total: 0 };
      c.perMonth.set(key, (c.perMonth.get(key) ?? 0) + amount);
      c.total += amount;
      clientMap.set(cid, c);
    });

    // build month range
    let start: { y: number; m: number };
    let end: { y: number; m: number };
    if (horizon === "all") {
      if (!minKey || !maxKey) {
        const t = parseYM(today);
        start = t;
        end = { y: t.y, m: t.m + 11 };
      } else {
        start = parseYM(minKey < today ? minKey : today);
        end = parseYM(maxKey > today ? maxKey : today);
      }
    } else {
      const n = parseInt(horizon, 10);
      const t = parseYM(today);
      start = t;
      end = { y: t.y, m: t.m + n - 1 };
    }
    const months: string[] = [];
    const cur = new Date(start.y, start.m, 1);
    const endDate = new Date(end.y, end.m, 1);
    while (cur <= endDate) {
      months.push(ymKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }

    const grand = months.reduce(
      (acc, k) => {
        const t = totals.get(k);
        if (!t) return acc;
        acc.total += t.total;
        acc.received += t.received;
        acc.open += t.open;
        acc.overdue += t.overdue;
        acc.count += t.count;
        return acc;
      },
      { total: 0, received: 0, open: 0, overdue: 0, count: 0 }
    );

    const byClient = Array.from(clientMap.values()).sort((a, b) => b.total - a.total);

    return { months, totalsByMonth: totals, byClient, grand };
  }, [filtered, horizon]);

  const maxMonthly = useMemo(() => {
    let max = 0;
    months.forEach((k) => {
      const v = totalsByMonth.get(k)?.total ?? 0;
      if (v > max) max = v;
    });
    return max || 1;
  }, [months, totalsByMonth]);

  const exportCsv = () => {
    const header = ["Cliente", ...months.map((k) => {
      const { y, m } = parseYM(k);
      return `${MONTH_LABELS[m]}/${String(y).slice(2)}`;
    }), "Total"];
    const rows = byClient.map((c) => [
      c.name,
      ...months.map((k) => String(c.perMonth.get(k) ?? 0).replace(".", ",")),
      String(c.total).replace(".", ","),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mapa-receitas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = todayYM();

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KCard icon={TrendingUp} color="indigo" label="Total previsto" value={formatBRL(grand.total)} sub={`${grand.count} lançamentos`} />
        <KCard icon={CheckCircle2} color="emerald" label="Recebido" value={formatBRL(grand.received)} sub={grand.total > 0 ? `${Math.round((grand.received / grand.total) * 100)}% do total` : "—"} />
        <KCard icon={Clock} color="amber" label="Em aberto" value={formatBRL(grand.open)} sub={`Próximos meses`} />
        <KCard icon={AlertCircle} color="rose" label="Vencido" value={formatBRL(grand.overdue)} sub="Antes do mês atual" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input placeholder="Buscar por cliente, produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-slate-200" />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full lg:w-[240px] bg-white border-slate-200"><Users className="size-4 mr-2 text-slate-400" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={horizon} onValueChange={(v: any) => setHorizon(v)}>
          <SelectTrigger className="w-full lg:w-[200px] bg-white border-slate-200"><CalendarRange className="size-4 mr-2 text-slate-400" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="12">Próximos 12 meses</SelectItem>
            <SelectItem value="24">Próximos 24 meses</SelectItem>
            <SelectItem value="36">Próximos 36 meses</SelectItem>
            <SelectItem value="all">Tudo (até última receita)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} className="border-slate-200 bg-white"><Download className="size-4 mr-2" /> CSV</Button>
      </div>

      {/* Monthly summary strip */}
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/70 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Receitas por mês</h3>
          <span className="text-[11px] text-slate-500">{months.length} mês(es)</span>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-2 p-4 min-w-max">
            {months.map((k) => {
              const t = totalsByMonth.get(k) ?? { total: 0, received: 0, open: 0, overdue: 0, count: 0 };
              const { y, m } = parseYM(k);
              const isCurrent = k === today;
              const isPast = k < today;
              const heightPct = (t.total / maxMonthly) * 100;
              return (
                <div key={k} className={cn("flex-shrink-0 w-[88px] rounded-lg border p-2 transition-colors",
                  isCurrent ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50/30 hover:bg-slate-50")}>
                  <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", isCurrent ? "text-indigo-700" : "text-slate-500")}>
                    {MONTH_LABELS[m]}/{String(y).slice(2)}
                  </div>
                  <div className="h-12 flex items-end mb-1">
                    <div className={cn("w-full rounded-sm transition-all", t.overdue > 0 ? "bg-rose-400" : isPast ? "bg-emerald-400" : "bg-indigo-400")}
                         style={{ height: `${Math.max(heightPct, t.total > 0 ? 6 : 0)}%` }} />
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-slate-900 truncate">{t.total > 0 ? formatBRL(t.total) : "—"}</div>
                  <div className="text-[9px] text-slate-500 tabular-nums">{t.count} lanç.</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid clientes × meses */}
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/70 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Mapa por cliente × mês</h3>
          <span className="text-[11px] text-slate-500">{byClient.length} cliente(s)</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2 font-bold uppercase text-[10px] tracking-wider text-slate-600 border-b border-r border-slate-200 min-w-[200px]">Cliente</th>
                {months.map((k) => {
                  const { y, m } = parseYM(k);
                  const isCurrent = k === today;
                  return (
                    <th key={k} className={cn("text-right px-2 py-2 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 min-w-[90px]",
                      isCurrent ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-600")}>
                      {MONTH_LABELS[m]}/{String(y).slice(2)}
                    </th>
                  );
                })}
                <th className="sticky right-0 z-20 bg-slate-100 text-right px-3 py-2 font-bold uppercase text-[10px] tracking-wider text-slate-700 border-b border-l border-slate-200 min-w-[110px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {byClient.length === 0 ? (
                <tr><td colSpan={months.length + 2} className="text-center py-10 text-slate-500">Nenhuma receita encontrada.</td></tr>
              ) : byClient.map((c, i) => (
                <tr key={c.id} className={i % 2 ? "bg-slate-50/40" : "bg-white"}>
                  <td className={cn("sticky left-0 px-3 py-2 font-semibold text-slate-800 border-r border-slate-200 truncate max-w-[240px]",
                    i % 2 ? "bg-slate-50" : "bg-white")}>{c.name}</td>
                  {months.map((k) => {
                    const v = c.perMonth.get(k) ?? 0;
                    const isCurrent = k === today;
                    return (
                      <td key={k} className={cn("text-right px-2 py-2 font-mono tabular-nums",
                        isCurrent && "bg-indigo-50/50",
                        v === 0 && "text-slate-300")}>
                        {v > 0 ? formatBRL(v) : "—"}
                      </td>
                    );
                  })}
                  <td className={cn("sticky right-0 text-right px-3 py-2 font-mono font-bold tabular-nums text-slate-900 border-l border-slate-200",
                    i % 2 ? "bg-slate-100" : "bg-slate-50")}>{formatBRL(c.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-100 font-bold">
                <td className="sticky left-0 bg-slate-100 px-3 py-2 text-slate-900 border-r border-t border-slate-300 uppercase text-[10px] tracking-wider">Total</td>
                {months.map((k) => {
                  const t = totalsByMonth.get(k)?.total ?? 0;
                  return (
                    <td key={k} className="text-right px-2 py-2 font-mono tabular-nums text-slate-900 border-t border-slate-300">
                      {t > 0 ? formatBRL(t) : "—"}
                    </td>
                  );
                })}
                <td className="sticky right-0 bg-slate-200 text-right px-3 py-2 font-mono text-slate-900 border-l border-t border-slate-300">{formatBRL(grand.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function KCard({ icon: Icon, color, label, value, sub }: any) {
  const map: any = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("size-7 rounded-md flex items-center justify-center border", map[color])}>
          <Icon className="size-3.5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
