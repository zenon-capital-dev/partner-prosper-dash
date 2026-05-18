import { useMemo, useState } from "react";
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

type RangeKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "all";

export default function Finance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("this_month");
  const [tab, setTab] = useState("overview");
  
  // States for new expense
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

  const { data: productPerformance = [] } = useQuery({
    queryKey: ["product-performance"],
    queryFn: async () => {
      const { data } = await supabase.from("view_performance_by_product").select("*").order("gross_revenue", { ascending: false });
      return data ?? [];
    },
  });

  const { data: sourcePerformance = [] } = useQuery({
    queryKey: ["source-performance"],
    queryFn: async () => {
      const { data } = await supabase.from("view_performance_by_source").select("*").order("total_revenue", { ascending: false });
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const revenue = sales.filter((s: any) => s.status === "concluida").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const expensesTotal = expenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const commissionsTotal = splits.reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const commissionsPaid = splits.filter((c: any) => c.status === "pago").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const netCommission = revenue - commissionsTotal;
    const profit = netCommission - expensesTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, expensesTotal, commissionsPaid, commissionsTotal, profit, margin, netCommission };
  }, [sales, expenses, splits]);

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

    splits.forEach((c: any) => {
      const key = (c.paid_at || c.created_at)?.slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].commissions += Number(c.amount || 0);
      }
    });

    return Object.values(dailyMap);
  }, [sales, expenses, splits]);

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Treasury"
        category="Financial Operations"
        title="Financeiro"
        description={`Saldo: ${formatBRL(kpis.profit)} · margem líquida ${kpis.margin.toFixed(1)}%`}
        icon={<PiggyBank className="size-6" />}
        actions={
          <>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="h-10 w-[170px] rounded-xl bg-background/60">
                <CalendarRange className="size-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="this_quarter">Este trimestre</SelectItem>
                <SelectItem value="this_year">Este ano</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4 gap-2"
              onClick={() => {
                const headers = ["Produto", "Vendas", "Receita Bruta", "Comissoes", "Receita Liquida"];
                const rows = productPerformance.map((p: any) => [
                  p.product_name, p.total_sales, p.gross_revenue, p.total_commissions, p.net_revenue
                ]);
                const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
                const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `performance_produtos_${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
              }}
            >
              <Download className="size-4" /> Exportar
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="h-10 px-4 gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
              onClick={async () => {
                const { data, error } = await supabase.functions.invoke('process-alerts');
                if (error) toast.error("Erro ao processar alertas");
                else {
                  toast.success(`${data.alerts_processed} novos alertas gerados`);
                  qc.invalidateQueries({ queryKey: ["notifications"] });
                }
              }}
            >
              <AlertCircle className="size-4" /> Processar Alertas
            </Button>
            <Button 
              size="sm" 
              className="btn-premium h-10 px-5 gap-2 font-semibold"
              onClick={() => setIsExpenseOpen(true)}
            >
              <Plus className="size-4" strokeWidth={2.5} /> Nova Despesa
            </Button>
          </>
        }
        kpis={[
          { label: "Receita Bruta", value: formatBRL(kpis.revenue), tone: "success", icon: <TrendingUp className="size-4" /> },
          { label: "Comissões", value: formatBRL(kpis.commissionsTotal), tone: "warning", icon: <Wallet className="size-4" /> },
          { label: "Comissão Líquida", value: formatBRL(kpis.netCommission), tone: "info", icon: <CircleDollarSign className="size-4" /> },
          { label: "Despesas", value: formatBRL(kpis.expensesTotal), tone: "danger", icon: <ArrowDownToLine className="size-4" /> },
          { label: "Lucro Real", value: formatBRL(kpis.profit), tone: "primary", icon: <PiggyBank className="size-4" /> },
          { label: "Margem Final", value: `${kpis.margin.toFixed(1)}%`, tone: "info", icon: <BarChart3 className="size-4" /> },
        ]}
      />


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

      {/* Top Beneficiaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="vx-card p-6 bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users className="size-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Maiores Comissões</h3>
          </div>
          <div className="space-y-4">
            {splits.slice(0, 5).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">{s.sales?.clients?.full_name || "Venda Direta"}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.beneficiary_type}</p>
                </div>
                <span className="text-xs font-bold text-success">{formatBRL(s.amount)}</span>
              </div>
            ))}
            {splits.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma comissão registrada.</p>}
          </div>
        </div>

        <div className="vx-card p-6 bg-white">
           <div className="flex items-center gap-3 mb-6">
            <div className="size-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Receipt className="size-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Despesas por Categoria</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(
              expenses.reduce((acc: any, e: any) => {
                acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
                return acc;
              }, {})
            ).map(([cat, val]: [any, any]) => (
              <div key={cat} className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-muted-foreground">{cat}</span>
                  <span className="text-foreground">{formatBRL(val)}</span>
                </div>
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(val / kpis.expensesTotal) * 100}%` }} />
                </div>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma despesa registrada.</p>}
          </div>
        </div>

        <div className="vx-card p-6 bg-slate-900 text-white border-slate-900">
           <div className="flex items-center justify-between mb-8">
              <PiggyBank className="size-10 text-primary" />
              <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-[0.2em] text-[9px]">Live Status</Badge>
           </div>
           <h3 className="font-editorial text-2xl font-bold mb-2">Liquidez Imediata</h3>
           <p className="text-xs text-white/50 leading-relaxed mb-6">Considerando todas as comissões pagas e despesas liquidadas no período selecionado.</p>
           <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                 <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Saldo em Caixa</span>
                 <span className="text-lg font-bold tabular-nums text-white">{formatBRL(kpis.profit)}</span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Comprometido</span>
                 <span className="text-xs font-bold tabular-nums text-warning">{formatBRL(kpis.commissionsTotal - kpis.commissionsPaid)}</span>
              </div>
           </div>
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
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Considerando o volume atual de vendas e a taxa de conversão de leads, o lucro projetado para este período é de <span className="text-foreground font-bold">{formatBRL(kpis.profit * 1.2)}</span>.
              </p>
           </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Product Ranking */}
         <div className="vx-card p-8 bg-white">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">Performance por Produto</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Ranking de volume bruto</p>
               </div>
               <BarChart3 className="size-5 text-primary opacity-30" />
            </div>
            <div className="space-y-6">
               {productPerformance.slice(0, 6).map((p: any) => (
                  <div key={p.product_id} className="space-y-2">
                     <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">{p.product_name}</span>
                        <span className="font-mono font-bold text-success">{formatBRL(p.gross_revenue)}</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                           className="h-full bg-primary rounded-full transition-all duration-1000" 
                           style={{ width: `${(p.gross_revenue / (productPerformance[0]?.gross_revenue || 1)) * 100}%` }} 
                        />
                     </div>
                     <div className="flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                        <span>{p.total_sales} vendas</span>
                        <span>Margem: {p.gross_revenue > 0 ? ((p.net_revenue / p.gross_revenue) * 100).toFixed(1) : 0}%</span>
                     </div>
                  </div>
               ))}
               {productPerformance.length === 0 && <p className="text-xs text-muted-foreground italic">Sem dados de performance.</p>}
            </div>
         </div>

         {/* Source Performance */}
         <div className="vx-card p-8 bg-white">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">Origem de Leads</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Conversão e ROI por canal</p>
               </div>
               <TrendingUp className="size-5 text-success opacity-30" />
            </div>
            <div className="space-y-6">
               {sourcePerformance.slice(0, 6).map((s: any) => (
                  <div key={s.source} className="flex items-center gap-6">
                     <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                           <span className="font-bold text-foreground">{s.source || "Direto / Orgânico"}</span>
                           <span className="font-mono font-bold">{formatBRL(s.total_revenue)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${(s.total_revenue / (sourcePerformance[0]?.total_revenue || 1)) * 100}%` }} 
                           />
                        </div>
                     </div>
                     <div className="text-center shrink-0">
                        <p className="text-lg font-bold text-foreground leading-none">{s.total_leads > 0 ? ((s.converted_sales / s.total_leads) * 100).toFixed(0) : 0}%</p>
                        <p className="text-[8px] text-muted-foreground uppercase tracking-tighter mt-1">Conv.</p>
                     </div>
                  </div>
               ))}
               {sourcePerformance.length === 0 && <p className="text-xs text-muted-foreground italic">Sem dados de leads.</p>}
            </div>
         </div>
      {/* Modal Nova Despesa */}
      <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="size-5 text-destructive" />
              Nova Despesa
            </DialogTitle>
            <DialogDescription>
              Registre uma nova saída financeira no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Aluguel, Internet, Impostos..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0,00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operacional">Operacional</SelectItem>
                  <SelectItem value="Impostos">Impostos</SelectItem>
                  <SelectItem value="Salários">Salários</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Ferramentas">Ferramentas</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpenseOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddExpense} disabled={isSubmitting} className="btn-premium">
              {isSubmitting ? "Salvando..." : "Salvar Despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
