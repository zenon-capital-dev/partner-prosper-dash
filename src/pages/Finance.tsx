import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp, TrendingDown, Wallet, Plus, ArrowDownToLine, ArrowUpFromLine,
  Receipt, Trash2, CheckCircle2, Clock3, XCircle, Download, Search,
  CalendarRange, Sparkles, BarChart3, PiggyBank, Pencil,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

type RangeKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "all";

const CATEGORY_OPTIONS = [
  { value: "operacional", label: "Operacional", color: "hsl(var(--primary))" },
  { value: "marketing", label: "Marketing", color: "hsl(var(--info))" },
  { value: "folha", label: "Folha de pagamento", color: "hsl(var(--warning))" },
  { value: "infraestrutura", label: "Infraestrutura / Cloud", color: "hsl(280 70% 60%)" },
  { value: "impostos", label: "Impostos / Taxas", color: "hsl(var(--destructive))" },
  { value: "comissoes", label: "Comissões", color: "hsl(var(--success))" },
  { value: "outros", label: "Outros", color: "hsl(var(--muted-foreground))" },
];

const catColor = (c: string) => CATEGORY_OPTIONS.find((x) => x.value === c)?.color ?? "hsl(var(--muted-foreground))";
const catLabel = (c: string) => CATEGORY_OPTIONS.find((x) => x.value === c)?.label ?? c;

export default function Finance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("this_month");
  const [tab, setTab] = useState("overview");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [expenseForm, setExpenseForm] = useState<any>({
    description: "", amount: "", category: "operacional",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCatFilter, setExpenseCatFilter] = useState("todos");

  // Range
  const { from, to, label } = useMemo(() => getRange(range), [range]);

  // ----- Queries -----
  const { data: sales = [] } = useQuery({
    queryKey: ["finance-sales", from, to],
    queryFn: async () => {
      let q = supabase.from("sales").select("id, amount, status, sale_date, commission_percent, partner_id, products(name), clients(full_name)").order("sale_date", { ascending: false });
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["finance-commissions", from, to],
    queryFn: async () => {
      let q = supabase.from("commissions").select("id, amount, status, created_at, paid_at, partners(full_name)").order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["finance-expenses", from, to],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (from) q = q.gte("expense_date", from);
      if (to) q = q.lte("expense_date", to);
      const { data } = await q;
      return data ?? [];
    },
  });

  // ----- KPIs -----
  const kpis = useMemo(() => {
    const revenue = sales.filter((s: any) => s.status === "concluida").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const pendingRevenue = sales.filter((s: any) => s.status !== "cancelada" && s.status !== "concluida").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const commissionsPaid = commissions.filter((c: any) => c.status === "paga").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const commissionsPending = commissions.filter((c: any) => c.status === "pendente").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const expensesTotal = expenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const profit = revenue - commissionsPaid - expensesTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, pendingRevenue, commissionsPaid, commissionsPending, expensesTotal, profit, margin };
  }, [sales, commissions, expenses]);

  // ----- Cashflow chart (daily aggregate) -----
  const cashflow = useMemo(() => {
    if (!from || !to) return [];
    const start = new Date(from);
    const end = new Date(to);
    const days: { date: string; label: string; receita: number; despesa: number; comissao: number; saldo: number }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""),
        receita: 0, despesa: 0, comissao: 0, saldo: 0,
      });
    }
    sales.forEach((s: any) => {
      if (s.status !== "concluida") return;
      const d = days.find((x) => x.date === s.sale_date);
      if (d) d.receita += Number(s.amount || 0);
    });
    commissions.forEach((c: any) => {
      if (c.status !== "paga" || !c.paid_at) return;
      const dateKey = c.paid_at.slice(0, 10);
      const d = days.find((x) => x.date === dateKey);
      if (d) d.comissao += Number(c.amount || 0);
    });
    expenses.forEach((e: any) => {
      const d = days.find((x) => x.date === e.expense_date);
      if (d) d.despesa += Number(e.amount || 0);
    });
    let acc = 0;
    days.forEach((d) => { acc += d.receita - d.despesa - d.comissao; d.saldo = acc; });
    // Reduce x-axis density when too many days
    if (days.length > 31) {
      // weekly buckets
      const weeks: any[] = [];
      for (let i = 0; i < days.length; i += 7) {
        const slice = days.slice(i, i + 7);
        weeks.push({
          label: slice[0].label,
          receita: slice.reduce((a, d) => a + d.receita, 0),
          despesa: slice.reduce((a, d) => a + d.despesa, 0),
          comissao: slice.reduce((a, d) => a + d.comissao, 0),
          saldo: slice[slice.length - 1].saldo,
        });
      }
      return weeks;
    }
    return days;
  }, [from, to, sales, commissions, expenses]);

  // ----- Category breakdown -----
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e: any) => {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries()).map(([category, value]) => ({
      name: catLabel(category), category, value, color: catColor(category),
    })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ----- Filtered expenses table -----
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e: any) => {
      if (expenseCatFilter !== "todos" && e.category !== expenseCatFilter) return false;
      if (expenseSearch) {
        const q = expenseSearch.toLowerCase();
        if (!e.description?.toLowerCase().includes(q) && !catLabel(e.category).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [expenses, expenseSearch, expenseCatFilter]);

  // ----- Mutations -----
  const openNewExpense = () => {
    setEditingExpense(null);
    setExpenseForm({ description: "", amount: "", category: "operacional", expense_date: new Date().toISOString().slice(0, 10) });
    setExpenseOpen(true);
  };
  const openEditExpense = (e: any) => {
    setEditingExpense(e);
    setExpenseForm({ description: e.description, amount: e.amount, category: e.category, expense_date: e.expense_date });
    setExpenseOpen(true);
  };
  const submitExpense = async () => {
    if (!expenseForm.description.trim()) { toast.error("Descrição obrigatória"); return; }
    if (!Number(expenseForm.amount)) { toast.error("Valor inválido"); return; }
    const payload = {
      description: expenseForm.description.trim(),
      amount: Number(expenseForm.amount),
      category: expenseForm.category,
      expense_date: expenseForm.expense_date,
      created_by: user?.id,
    };
    const { error } = editingExpense
      ? await supabase.from("expenses").update(payload).eq("id", editingExpense.id)
      : await supabase.from("expenses").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingExpense ? "Despesa atualizada" : "Despesa registrada");
    setExpenseOpen(false);
    qc.invalidateQueries({ queryKey: ["finance-expenses"] });
  };
  const deleteExpense = async (id: string) => {
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Despesa excluída"); qc.invalidateQueries({ queryKey: ["finance-expenses"] }); }
  };

  const exportCSV = () => {
    const rows = [
      ["Data", "Categoria", "Descrição", "Valor"],
      ...filteredExpenses.map((e: any) => [e.expense_date, catLabel(e.category), e.description, Number(e.amount).toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `despesas_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-5">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas, comissões pagas, lucro e fluxo de caixa em tempo real."
        actions={
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="h-9 w-[170px] text-xs">
                <CalendarRange className="size-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="this_quarter">Este trimestre</SelectItem>
                <SelectItem value="this_year">Este ano</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openNewExpense} className="gap-2 bg-gradient-primary hover:opacity-90">
              <Plus className="size-4" /> Nova Despesa
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground -mt-2">
        Período: <span className="font-semibold text-foreground">{label}</span>
        {from && to && <span className="ml-1">({formatDate(from)} → {formatDate(to)})</span>}
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          icon={TrendingUp} label="Receita realizada"
          value={formatBRL(kpis.revenue)}
          sub={kpis.pendingRevenue > 0 ? `+ ${formatBRL(kpis.pendingRevenue)} a confirmar` : undefined}
          tone="success" highlight
        />
        <Kpi
          icon={TrendingDown} label="Despesas operacionais"
          value={formatBRL(kpis.expensesTotal)}
          sub={`${expenses.length} lançamento(s)`}
          tone="destructive"
        />
        <Kpi
          icon={Wallet} label="Comissões pagas"
          value={formatBRL(kpis.commissionsPaid)}
          sub={kpis.commissionsPending > 0 ? `+ ${formatBRL(kpis.commissionsPending)} a pagar` : undefined}
          tone="warning"
        />
        <Kpi
          icon={PiggyBank} label="Lucro líquido"
          value={formatBRL(kpis.profit)}
          sub={`Margem ${kpis.margin.toFixed(1)}%`}
          tone={kpis.profit >= 0 ? "success" : "destructive"}
          highlight
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="size-3.5" /> Visão geral</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5"><Receipt className="size-3.5" /> Despesas <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{expenses.length}</Badge></TabsTrigger>
          <TabsTrigger value="commissions" className="gap-1.5"><Wallet className="size-3.5" /> Comissões</TabsTrigger>
        </TabsList>

        {/* ===================== OVERVIEW ===================== */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Cashflow */}
          <div className="vx-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-display text-base font-semibold">Fluxo de caixa</p>
                <p className="text-[11px] text-muted-foreground">Receita, despesa, comissões pagas e saldo acumulado</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> Receita</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> Despesa</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warning" /> Comissão</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> Saldo</span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <ComposedChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => formatBRL(v)}
                  />
                  <Bar dataKey="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comissao" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Receita acumulada */}
            <div className="vx-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display text-base font-semibold">Receita acumulada</p>
                  <p className="text-[11px] text-muted-foreground">Saldo líquido ao longo do período</p>
                </div>
                <Badge variant={kpis.profit >= 0 ? "default" : "destructive"} className="text-[10px]">
                  Saldo final: {formatBRL(cashflow[cashflow.length - 1]?.saldo ?? 0)}
                </Badge>
              </div>
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="finBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => formatBRL(v)} />
                    <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#finBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie despesas por categoria */}
            <div className="vx-card p-5">
              <p className="font-display text-base font-semibold">Despesas por categoria</p>
              <p className="text-[11px] text-muted-foreground">Distribuição dos custos</p>
              {expensesByCategory.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                  <Receipt className="size-8 opacity-40 mb-2" />
                  <p className="text-xs">Sem despesas no período</p>
                </div>
              ) : (
                <>
                  <div className="h-44 mt-2">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                          {expensesByCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => formatBRL(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 mt-2">
                    {expensesByCategory.slice(0, 4).map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c.color }} /> {c.name}</span>
                        <span className="vx-mono font-semibold">{formatBRL(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Resumo bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SummaryCard
              icon={ArrowUpFromLine} title="Entradas"
              tone="success"
              items={[
                { label: "Vendas concluídas", value: kpis.revenue, count: sales.filter((s: any) => s.status === "concluida").length },
                { label: "A receber (pend./andam.)", value: kpis.pendingRevenue, muted: true },
              ]}
            />
            <SummaryCard
              icon={ArrowDownToLine} title="Saídas"
              tone="destructive"
              items={[
                { label: "Despesas pagas", value: kpis.expensesTotal, count: expenses.length },
                { label: "Comissões pagas", value: kpis.commissionsPaid, count: commissions.filter((c: any) => c.status === "paga").length },
                { label: "Comissões a pagar", value: kpis.commissionsPending, muted: true },
              ]}
            />
            <SummaryCard
              icon={PiggyBank} title="Resultado"
              tone={kpis.profit >= 0 ? "success" : "destructive"}
              items={[
                { label: "Lucro líquido", value: kpis.profit, strong: true },
                { label: "Margem", value: `${kpis.margin.toFixed(1)}%`, isText: true },
              ]}
            />
          </div>
        </TabsContent>

        {/* ===================== EXPENSES ===================== */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="vx-card p-3 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} placeholder="Buscar descrição ou categoria..." className="pl-9 h-9" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={expenseCatFilter} onValueChange={setExpenseCatFilter}>
                <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 gap-1 text-xs"><Download className="size-3" /> CSV</Button>
            </div>
          </div>

          <div className="vx-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 text-left font-semibold">Data</th>
                    <th className="px-6 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-6 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-6 py-3 text-right font-semibold">Valor</th>
                    <th className="px-6 py-3 text-right font-semibold w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-16 text-center">
                      <Receipt className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm font-medium">Nenhuma despesa</p>
                      <p className="text-xs text-muted-foreground mt-1">Lance sua primeira despesa do período</p>
                      <Button size="sm" onClick={openNewExpense} className="mt-4 gap-2 bg-gradient-primary"><Plus className="size-4" /> Nova despesa</Button>
                    </td></tr>
                  ) : filteredExpenses.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/30 group">
                      <td className="px-6 py-3 text-xs text-muted-foreground vx-mono">{formatDate(e.expense_date)}</td>
                      <td className="px-6 py-3 font-medium">{e.description}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase" style={{ background: `${catColor(e.category)}1a`, color: catColor(e.category) }}>
                          <span className="size-1.5 rounded-full bg-current" /> {catLabel(e.category)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right vx-mono font-semibold text-destructive">- {formatBRL(e.amount)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => openEditExpense(e)}><Pencil className="size-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="size-8 p-0 text-destructive" onClick={() => deleteExpense(e.id)}><Trash2 className="size-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredExpenses.length > 0 && (
                  <tfoot className="bg-muted/30 font-semibold">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-xs uppercase text-muted-foreground">Total</td>
                      <td className="px-6 py-3 text-right vx-mono text-destructive">- {formatBRL(filteredExpenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ===================== COMMISSIONS QUICK VIEW ===================== */}
        <TabsContent value="commissions" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Kpi icon={CheckCircle2} label="Pagas no período" value={formatBRL(kpis.commissionsPaid)} sub={`${commissions.filter((c: any) => c.status === "paga").length} comissões`} tone="success" />
            <Kpi icon={Clock3} label="A pagar" value={formatBRL(kpis.commissionsPending)} sub={`${commissions.filter((c: any) => c.status === "pendente").length} comissões`} tone="warning" />
            <Kpi icon={XCircle} label="Canceladas" value={formatBRL(commissions.filter((c: any) => c.status === "cancelado").reduce((a: number, c: any) => a + Number(c.amount || 0), 0))} tone="destructive" />
          </div>
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Comissões do período</p>
              <a href="/comissoes" className="text-xs text-primary hover:underline">Ir para Comissões →</a>
            </div>
            {commissions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Sem comissões no período</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 text-left font-semibold">Data</th>
                    <th className="px-6 py-3 text-left font-semibold">Indicador</th>
                    <th className="px-6 py-3 text-right font-semibold">Valor</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.slice(0, 20).map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-3 font-medium">{c.partners?.full_name ?? "—"}</td>
                      <td className="px-6 py-3 text-right vx-mono font-semibold">{formatBRL(c.amount)}</td>
                      <td className="px-6 py-3">
                        <Badge variant={c.status === "paga" ? "default" : c.status === "cancelado" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingExpense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
            <DialogDescription>Lance uma despesa operacional para acompanhar o caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex: Servidor AWS, anúncios Google..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancelar</Button>
            <Button onClick={submitExpense} className="bg-gradient-primary gap-2">
              <Sparkles className="size-4" /> {editingExpense ? "Salvar alterações" : "Lançar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ HELPERS ============ */
function getRange(key: RangeKey): { from: string; to: string; label: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "this_month") {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: "Este mês" };
  }
  if (key === "last_month") {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)), label: "Mês passado" };
  }
  if (key === "this_quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)), label: `T${q + 1}/${now.getFullYear()}` };
  }
  if (key === "this_year") {
    return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(new Date(now.getFullYear(), 11, 31)), label: `${now.getFullYear()}` };
  }
  return { from: "2020-01-01", to: fmt(new Date(now.getFullYear(), 11, 31)), label: "Tudo" };
}

function Kpi({ icon: Icon, label, value, sub, tone, highlight = false }: any) {
  const map: any = {
    primary: { color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20" },
    success: { color: "text-success", bg: "bg-success-muted", ring: "ring-success/20" },
    warning: { color: "text-warning", bg: "bg-warning-muted", ring: "ring-warning/20" },
    info: { color: "text-info", bg: "bg-info-muted", ring: "ring-info/20" },
    destructive: { color: "text-destructive", bg: "bg-destructive-muted", ring: "ring-destructive/20" },
  };
  const t = map[tone] ?? map.primary;
  return (
    <div className={`vx-card p-4 ${highlight ? `ring-1 ${t.ring}` : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className={`font-display text-2xl font-bold vx-mono mt-1 truncate ${t.color}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`size-9 rounded-md flex items-center justify-center ${t.bg} ${t.color}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, items, tone }: any) {
  const map: any = {
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
  };
  return (
    <div className="vx-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`size-8 rounded-md bg-muted/40 flex items-center justify-center ${map[tone] ?? ""}`}>
          <Icon className="size-4" />
        </div>
        <p className="font-display font-semibold">{title}</p>
      </div>
      <div className="space-y-2">
        {items.map((i: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <div>
              <span className={`text-muted-foreground ${i.muted ? "text-xs" : ""}`}>{i.label}</span>
              {i.count !== undefined && <span className="text-[10px] text-muted-foreground ml-1.5">({i.count})</span>}
            </div>
            <span className={`vx-mono ${i.strong ? "font-bold text-base " + (map[tone] ?? "") : "font-semibold"} ${i.muted ? "text-muted-foreground" : ""}`}>
              {i.isText ? i.value : formatBRL(i.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
