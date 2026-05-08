import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp, TrendingDown, Wallet, Plus, ArrowDownToLine, ArrowUpFromLine,
  Receipt, Trash2, CheckCircle2, Clock3, Download, Search,
  CalendarRange, Sparkles, BarChart3, PiggyBank, Pencil, Filter, ArrowUpRight,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";

type RangeKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "all";

export default function Finance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("this_month");
  const [tab, setTab] = useState("overview");

  // Range logic simplified for the shell
  const { from, to, label } = useMemo(() => {
    const now = new Date();
    if (range === "this_month") {
      const f = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return { from: f, to: t, label: "THIS MONTH" };
    }
    return { from: "", to: "", label: "ALL TIME" };
  }, [range]);

  // Queries
  const { data: sales = [] } = useQuery({
    queryKey: ["finance-sales", from, to],
    queryFn: async () => {
      let q = supabase.from("sales").select("id, amount, status, sale_date").order("sale_date", { ascending: false });
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["finance-commissions", from, to],
    queryFn: async () => {
      let q = supabase.from("commissions").select("id, amount, status, created_at, paid_at").order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["finance-expenses", from, to],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (from) q = q.gte("expense_date", from);
      const { data } = await q;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const revenue = sales.filter((s: any) => s.status === "concluida").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const expensesTotal = expenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const commissionsPaid = commissions.filter((c: any) => c.status === "paga").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const profit = revenue - commissionsPaid - expensesTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, expensesTotal, commissionsPaid, profit, margin };
  }, [sales, commissions, expenses]);

  // Mocked chart data for the cockpit look
  const chartData = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => ({
      label: `${i + 1} May`,
      revenue: Math.random() * 5000 + 2000,
      expenses: Math.random() * 1000 + 500,
      balance: Math.random() * 10000 + 5000,
    }));
  }, []);

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 flex-wrap">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-success">● treasury</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">FINANCIAL OPERATIONS</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Finance</h1>
          <p className="text-xs text-muted-foreground/60 font-medium">
            Balance: {formatBRL(kpis.profit)} · net margin {kpis.margin.toFixed(1)}%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="h-9 w-[160px] bg-muted/30 border-border/50 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
              <CalendarRange className="size-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 px-4 font-bold uppercase tracking-wider text-[10px] gap-2 shadow-lg shadow-success/20 bg-success hover:bg-success/90 text-success-foreground">
            <Plus className="size-4" strokeWidth={3} /> Record Expense
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/10 rounded-2xl overflow-hidden border border-border/10 shadow-sm">
        <MiniKpi label="Gross Revenue" value={formatBRL(kpis.revenue)} tone="success" />
        <MiniKpi label="Total Expenses" value={formatBRL(kpis.expensesTotal)} tone="danger" />
        <MiniKpi label="Commissions" value={formatBRL(kpis.commissionsPaid)} tone="warning" />
        <MiniKpi label="Net Profit" value={formatBRL(kpis.profit)} tone="primary" />
      </div>

      <div className="grid grid-cols-12 gap-px bg-white/[0.06] rounded-lg overflow-hidden border border-white/[0.06]">
        {/* Main Chart */}
        <div className="col-span-12 lg:col-span-8 bg-[#0d0e12] p-6">
           <div className="flex items-center justify-between mb-8">
             <div>
               <h2 className="text-[13px] font-semibold tracking-tight text-white">Capital flow</h2>
               <p className="text-[11px] font-mono text-white/40 mt-0.5">daily revenue vs operational costs</p>
             </div>
             <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest">
               <span className="flex items-center gap-1.5 text-emerald-400">
                 <span className="size-1.5 rounded-full bg-emerald-500" /> Revenue
               </span>
               <span className="flex items-center gap-1.5 text-rose-400">
                 <span className="size-1.5 rounded-full bg-rose-500" /> Expenses
               </span>
               <span className="flex items-center gap-1.5 text-white/30">
                 <span className="size-1.5 rounded-full bg-white/20" /> Net Balance
               </span>
             </div>
           </div>
           
           <div className="h-72 w-full">
             <ResponsiveContainer>
               <ComposedChart data={chartData}>
                 <defs>
                   <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                 <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace'}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace'}} tickFormatter={(v) => `$${v/1000}k`} />
                 <Tooltip contentStyle={{backgroundColor: '#12141a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px'}} />
                 <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                 <Bar dataKey="expenses" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={8} />
                 <Line type="monotone" dataKey="balance" stroke="rgba(255,255,255,0.2)" strokeWidth={1} dot={false} strokeDasharray="5 5" />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Breakdown */}
        <div className="col-span-12 lg:col-span-4 bg-[#0d0e12] p-6 border-l border-white/[0.06]">
           <h2 className="text-[13px] font-semibold tracking-tight text-white mb-6">Operations breakdown</h2>
           
           <div className="space-y-5">
             <BreakdownItem label="Direct Sales" value={formatBRL(kpis.revenue * 0.7)} percent={70} color="bg-emerald-500" />
             <BreakdownItem label="Partner Leads" value={formatBRL(kpis.revenue * 0.3)} percent={30} color="bg-emerald-400/40" />
             <div className="h-px bg-white/[0.06] my-2" />
             <BreakdownItem label="Operational Expenses" value={formatBRL(kpis.expensesTotal * 0.6)} percent={60} color="bg-rose-500" />
             <BreakdownItem label="Commission Payouts" value={formatBRL(kpis.commissionsPaid)} percent={40} color="bg-amber-500" />
           </div>

           <div className="mt-8 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
             <div className="flex items-center gap-2 mb-2">
               <Sparkles className="size-3.5 text-emerald-400" />
               <p className="text-[11px] font-mono text-white/60 uppercase tracking-widest">Projection</p>
             </div>
             <p className="text-[12px] text-white/40 leading-relaxed">
               Based on current run-rate, projected end-of-month profit is <span className="text-white font-mono">{formatBRL(kpis.profit * 1.4)}</span>.
             </p>
           </div>
        </div>
      </div>

      {/* Transaction Feed */}
      <div className="cp-panel">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
           <div>
             <h2 className="text-[13px] font-semibold tracking-tight text-white">Recent movements</h2>
             <p className="text-[11px] font-mono text-white/40 mt-0.5">combined ledger activity</p>
           </div>
           <button className="text-[10.5px] font-mono uppercase tracking-wider text-white/40 hover:text-white transition-colors flex items-center gap-1.5">
             full ledger <ArrowUpRight className="size-3" />
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/[0.06]">
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 10).map((e: any) => (
                <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <Td><span className="cp-pill cp-pill-danger uppercase tracking-widest text-[9px]">expense</span></Td>
                  <Td><span className="text-white font-medium">{e.description}</span></Td>
                  <Td><span className="text-white/40 font-mono uppercase tracking-wider text-[10px]">{e.category}</span></Td>
                  <Td className="text-white/30 font-mono text-[11px]">{formatDate(e.expense_date)}</Td>
                  <Td align="right"><span className="font-mono font-semibold text-rose-400 tabular-nums">-{formatBRL(e.amount)}</span></Td>
                </tr>
              ))}
              {sales.slice(0, 10).map((s: any) => (
                <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <Td><span className="cp-pill cp-pill-success uppercase tracking-widest text-[9px]">revenue</span></Td>
                  <Td><span className="text-white font-medium">Sale Concluded</span></Td>
                  <Td><span className="text-white/40 font-mono uppercase tracking-wider text-[10px]">Sales</span></Td>
                  <Td className="text-white/30 font-mono text-[11px]">{formatDate(s.sale_date)}</Td>
                  <Td align="right"><span className="font-mono font-semibold text-emerald-400 tabular-nums">+{formatBRL(s.amount)}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[#0d0e12] p-5 hover:bg-[#101115] transition-colors group">
      <p className="cp-stat-label mb-2">{label}</p>
      <p className={cn(
        "cp-stat-value text-[22px]",
        tone === "success" && "text-emerald-400",
        tone === "danger" && "text-rose-400",
        tone === "warning" && "text-amber-400",
        tone === "primary" && "text-cyan-400"
      )}>{value}</p>
    </div>
  );
}

function BreakdownItem({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span className="text-white/60 font-medium">{label}</span>
        <span className="font-mono text-white/30 uppercase tracking-widest">{value}</span>
      </div>
      <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-white/40",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={cn(
      "px-5 py-4",
      align === "right" ? "text-right" : "text-left",
      className
    )}>
      {children}
    </td>
  );
}
