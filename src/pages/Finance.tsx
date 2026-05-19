import { useMemo, useState } from "react";
import { format, subDays, startOfMonth, startOfToday, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/PageHero";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp, TrendingDown, Wallet, Plus, ArrowDownToLine, ArrowUpFromLine,
  Receipt, Trash2, CheckCircle2, Clock3, Download, Search,
  CalendarRange, Sparkles, BarChart3, PiggyBank, Pencil, Filter, ArrowUpRight,
  Users, AlertCircle, CircleDollarSign,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";

type RangeKey = "HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO";

export default function Finance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [rangeKey, setRangeKey] = useState<RangeKey>("HOJE");
  const [tab, setTab] = useState("overview");

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Operacional",
    expense_date: new Date().toISOString().slice(0, 10),
  });

  const handleAddExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error("Preencha a descrição e o valor");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert({
        description: expenseForm.description,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        expense_date: expenseForm.expense_date,
      });
      if (error) throw error;
      toast.success("Despesa registrada com sucesso!");
      setIsExpenseOpen(false);
      setExpenseForm({
        description: "",
        amount: "",
        category: "Operacional",
        expense_date: new Date().toISOString().slice(0, 10),
      });
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (err: any) {
      toast.error("Erro ao salvar despesa: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { from, to } = useMemo(() => {
    const today = startOfToday();
    let start = today;
    let end = endOfDay(today);

    if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "30 DIAS") {
      start = subDays(today, 29);
    } else if (rangeKey === "MÊS") {
      start = startOfMonth(today);
    } else if (rangeKey === "TUDO") {
      return { from: "", to: "" };
    }
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }, [rangeKey]);

  const { data: sales = [] } = useQuery({
    queryKey: ["finance-sales", from, to],
    queryFn: async () => {
      let q = supabase.from("sales").select("id, amount, status, sale_date, products(name, product_categories(name))").order("sale_date", { ascending: false });
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
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

  const { data: splits = [] } = useQuery({
    queryKey: ["finance-splits", from, to],
    queryFn: async () => {
      let q = supabase.from("commission_splits").select("*, sales(clients(full_name), products(name))").order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      const { data } = await q;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const revenue = sales.filter((s: any) => s.status === "concluida" || s.status === "pago").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const expensesTotal = expenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const commissionsTotal = splits.reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const commissionsPaid = splits.filter((c: any) => c.status === "pago" || c.status === "paga").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const netCommission = revenue - commissionsTotal;
    const profit = netCommission - expensesTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, expensesTotal, commissionsPaid, commissionsTotal, profit, margin, netCommission };
  }, [sales, expenses, splits]);

  const chartData = useMemo(() => {
    const dailyMap: Record<string, { label: string; revenue: number; expenses: number; commissions: number }> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { label: formatDate(key), revenue: 0, expenses: 0, commissions: 0 };
    }
    sales.forEach((s: any) => {
      const key = s.sale_date?.slice(0, 10);
      if (dailyMap[key] && s.status === 'concluida') dailyMap[key].revenue += Number(s.amount || 0);
    });
    expenses.forEach((e: any) => {
      const key = e.expense_date?.slice(0, 10);
      if (dailyMap[key]) dailyMap[key].expenses += Number(e.amount || 0);
    });
    splits.forEach((c: any) => {
      const key = (c.paid_at || c.created_at)?.slice(0, 10);
      if (dailyMap[key]) dailyMap[key].commissions += Number(c.amount || 0);
    });
    return Object.values(dailyMap);
  }, [sales, expenses, splits]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0a0a0c] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 animate-in fade-in duration-700 admin-shell">
      <PageHero
        eyebrow="Tesouraria"
        category="Operações Financeiras"
        title="Financeiro"
        description={`Saldo atual: ${formatBRL(kpis.profit)} · Margem de lucro ${kpis.margin.toFixed(1)}%`}
        icon={<PiggyBank className="size-6" />}
        actions={
          <div className="flex bg-white dark:bg-card p-1 rounded-2xl border border-slate-200 dark:border-border shadow-sm mr-2">
            {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setRangeKey(k)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase",
                  rangeKey === k ? "bg-slate-900 dark:bg-primary text-white dark:text-primary-foreground shadow-lg" : "text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground"
                )}
              >
                {k}
              </button>
            ))}
          </div>
        }
        kpis={[
          { label: "Receita Bruta", value: formatBRL(kpis.revenue), tone: "success", icon: <TrendingUp className="size-4" /> },
          { label: "Comissões", value: formatBRL(kpis.commissionsTotal), tone: "warning", icon: <Wallet className="size-4" /> },
          { label: "Despesas", value: formatBRL(kpis.expensesTotal), tone: "danger", icon: <ArrowDownToLine className="size-4" /> },
          { label: "Saldo Líquido", value: formatBRL(kpis.profit), tone: "primary", icon: <PiggyBank className="size-4" /> },
          { label: "Margem Final", value: `${kpis.margin.toFixed(1)}%`, tone: "info", icon: <BarChart3 className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-8 pb-10 animate-in slide-in-from-bottom-4 duration-1000">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
           <Link to="/financeiro" className="bg-white dark:bg-card rounded-[24px] p-6 border border-slate-200 dark:border-border shadow-sm hover:shadow-lg transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">A RECEBER (7D)</p>
              <p className="text-2xl font-black text-slate-900 dark:text-foreground tracking-tight">R$ 0,00</p>
           </Link>
           <Link to="/financeiro" className="bg-white dark:bg-card rounded-[24px] p-6 border border-slate-200 dark:border-border shadow-sm hover:shadow-lg transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">INADIMPLÊNCIA</p>
              <p className="text-2xl font-black text-rose-600 tracking-tight">R$ 0,00</p>
           </Link>
           <Link to="/comissoes" className="bg-white dark:bg-card rounded-[24px] p-6 border border-slate-200 dark:border-border shadow-sm hover:shadow-lg transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">COMISSÕES A PAGAR</p>
              <p className="text-2xl font-black text-amber-600 tracking-tight">{formatBRL(kpis.commissionsTotal - kpis.commissionsPaid)}</p>
           </Link>
           <div className="bg-indigo-600 rounded-[24px] p-6 text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">LUCRO ESTIMADO</p>
                <p className="text-2xl font-black tracking-tight">{formatBRL(kpis.profit)}</p>
              </div>
              <button onClick={() => setIsExpenseOpen(true)} className="mt-2 text-[10px] font-black uppercase bg-white/20 py-2 rounded-lg hover:bg-white/30 transition-all flex items-center justify-center gap-2">
                <Plus className="size-3" /> Nova Despesa
              </button>
           </div>
        </div>

        <div className="col-span-12 lg:col-span-8 vx-card p-6 bg-white dark:bg-card">
            <h2 className="text-sm font-bold tracking-tight text-foreground mb-8">Fluxo de Caixa</h2>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.7, fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.7, fontSize: 10}} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={12} />
                  <Line type="monotone" dataKey="commissions" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
        </div>
      </div>

      <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddExpense} disabled={isSubmitting}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
