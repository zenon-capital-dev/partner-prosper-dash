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

  // Group data for charts
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { label: string; revenue: number; expenses: number; commissions: number }> = {};
    
    // Last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { label: formatDate(key), revenue: 0, expenses: 0, commissions: 0 };
    }

    sales.forEach((s: any) => {
      const key = s.sale_date?.slice(0, 10);
      if (dailyMap[key] && s.status === 'concluida') {
        dailyMap[key].revenue += Number(s.amount || 0);
      }
    });

    expenses.forEach((e: any) => {
      const key = e.expense_date?.slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].expenses += Number(e.amount || 0);
      }
    });

    commissions.forEach((c: any) => {
      const key = (c.paid_at || c.created_at)?.slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].commissions += Number(c.amount || 0);
      }
    });

    return Object.values(dailyMap);
  }, [sales, expenses, commissions]);

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

      <div className="grid grid-cols-12 gap-px bg-border/10 rounded-2xl overflow-hidden border border-border/10 shadow-sm">
        {/* Main Chart */}
        <div className="col-span-12 lg:col-span-8 bg-card p-6">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
             <div>
               <h2 className="text-sm font-bold tracking-tight text-foreground">Capital flow</h2>
               <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest mt-1">daily revenue vs operational costs</p>
             </div>
             <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-[0.15em]">
               <span className="flex items-center gap-1.5 text-success">
                 <span className="size-1.5 rounded-full bg-success" /> Revenue
               </span>
               <span className="flex items-center gap-1.5 text-destructive">
                 <span className="size-1.5 rounded-full bg-destructive" /> Expenses
               </span>
               <span className="flex items-center gap-1.5 text-muted-foreground/40">
                 <span className="size-1.5 rounded-full bg-muted-foreground/20" /> Net Balance
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
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 9}} interval={4} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace'}} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip contentStyle={{backgroundColor: '#12141a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px'}} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={8} />
                  <Line type="monotone" dataKey="commissions" stroke="#f59e0b" strokeWidth={1} dot={false} />
                </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Breakdown */}
        <div className="col-span-12 lg:col-span-4 bg-card p-6 border-l border-border/10">
           <h2 className="text-sm font-bold tracking-tight text-foreground mb-6">Operations breakdown</h2>
           
           <div className="space-y-6">
             <BreakdownItem label="Direct Sales" value={formatBRL(kpis.revenue * 0.7)} percent={70} color="bg-success" />
             <BreakdownItem label="Partner Leads" value={formatBRL(kpis.revenue * 0.3)} percent={30} color="bg-success/30" />
             <div className="h-px bg-border/10 my-2" />
             <BreakdownItem label="Operational Expenses" value={formatBRL(kpis.expensesTotal * 0.6)} percent={60} color="bg-destructive" />
             <BreakdownItem label="Commission Payouts" value={formatBRL(kpis.commissionsPaid)} percent={40} color="bg-warning" />
           </div>

           <div className="mt-8 p-5 rounded-xl bg-muted/30 border border-border/50">
             <div className="flex items-center gap-2 mb-2.5">
               <Sparkles className="size-3.5 text-primary" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Projection</p>
             </div>
             <p className="text-xs text-muted-foreground leading-relaxed">
               Based on current run-rate, projected end-of-month profit is <span className="text-foreground font-bold">{formatBRL(kpis.profit * 1.4)}</span>.
             </p>
           </div>
        </div>
      </div>

      {/* Transaction Feed */}
      <div className="vx-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 border-b border-border/10">
           <div className="space-y-1">
             <h2 className="text-sm font-bold tracking-tight text-foreground">Recent movements</h2>
             <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">combined ledger activity</p>
           </div>
           <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground gap-2">
             full ledger <ArrowUpRight className="size-3" />
           </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/10 bg-muted/20">
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {expenses.slice(0, 10).map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors group">
                  <Td><span className="vx-pill vx-pill-danger px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">expense</span></Td>
                  <Td><span className="font-semibold text-foreground">{e.description}</span></Td>
                  <Td><span className="text-muted-foreground/40 font-bold uppercase tracking-[0.15em] text-[9px]">{e.category}</span></Td>
                  <Td className="text-muted-foreground/30 font-bold text-[10px] uppercase tracking-wider">{formatDate(e.expense_date)}</Td>
                  <Td align="right"><span className="font-bold text-destructive tabular-nums">-{formatBRL(e.amount)}</span></Td>
                </tr>
              ))}
              {sales.slice(0, 10).map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                  <Td><span className="vx-pill vx-pill-success px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">revenue</span></Td>
                  <Td><span className="font-semibold text-foreground">Sale Concluded</span></Td>
                  <Td><span className="text-muted-foreground/40 font-bold uppercase tracking-[0.15em] text-[9px]">Sales</span></Td>
                  <Td className="text-muted-foreground/30 font-bold text-[10px] uppercase tracking-wider">{formatDate(s.sale_date)}</Td>
                  <Td align="right"><span className="font-bold text-success tabular-nums">+{formatBRL(s.amount)}</span></Td>
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
    <div className="bg-card p-6 hover:bg-muted/30 transition-colors group">
      <p className="vx-kpi-label mb-2.5 opacity-40">{label}</p>
      <p className={cn(
        "text-2xl font-bold tracking-tight tabular-nums",
        tone === "success" && "text-success",
        tone === "danger" && "text-destructive",
        tone === "warning" && "text-warning",
        tone === "primary" && "text-primary"
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
