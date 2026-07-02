import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { subDays, startOfMonth, startOfToday, endOfDay, eachDayOfInterval, eachMonthOfInterval, subMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";
import {
  PiggyBank, TrendingUp, Wallet, ArrowDownToLine, BarChart3, Plus, Pencil, Trash2,
  Search, Download, X, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Receipt, CheckCircle2, Clock3,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, BarChart,
} from "recharts";
import { cn } from "@/lib/utils";
import { usePageSize } from "@/hooks/usePageSize";
import { saleIsFinalized } from "@/lib/financial";

type RangeKey = "HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO";
type SortDir = "asc" | "desc";

const norm = (s: any) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const EXPENSE_CATEGORIES = ["Operacional", "Marketing", "Pessoal", "Impostos", "Outros"];

const SALE_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida: { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const SPLIT_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pago: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const WORKFLOW_STATUS: Record<string, { label: string; cls: string }> = {
  aguardando_confirmacao: { label: "Aguardando Confirmação", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  em_analise: { label: "Em Análise", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  aprovada: { label: "Aprovada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejeitada: { label: "Rejeitada", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const BENEFICIARY_LABEL: Record<string, string> = {
  partner: "Parceiro",
  collaborator: "Colaborador",
  referrer: "Indicador",
};

const downloadCsv = (filename: string, headers: string[], rows: any[][]) => {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

function SortableTh({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;
  return (
    <th className={cn("px-4 py-3 select-none text-[11px] uppercase tracking-wider font-semibold text-slate-500", align === "center" && "text-center", align === "right" && "text-right")}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-slate-700 transition-colors", active && "text-indigo-700")}>
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

export default function Finance() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [rangeKey, setRangeKey] = useState<RangeKey>("TUDO");
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [salesStatus, setSalesStatus] = useState<string>("all");
  const [expenseCategory, setExpenseCategory] = useState<string>("all");
  const [splitStatus, setSplitStatus] = useState<string>("all");
  const [reportMonths, setReportMonths] = useState<number>(6);

  // sort & pagination
  const [salesSort, setSalesSort] = useState<{k: string; d: SortDir}>({k: "sale_date", d: "desc"});
  const [expSort, setExpSort] = useState<{k: string; d: SortDir}>({k: "expense_date", d: "desc"});
  const [splitSort, setSplitSort] = useState<{k: string; d: SortDir}>({k: "created_at", d: "desc"});
  const [salesPage, setSalesPage] = useState(1);
  const [expPage, setExpPage] = useState(1);
  const [splitPage, setSplitPage] = useState(1);
  const { pageSize: __ps, setPageSize } = usePageSize();
  const PAGE_SIZE = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;

  // expense dialog
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [expForm, setExpForm] = useState({
    description: "", amount: "", category: "Operacional",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  const { from, to } = useMemo(() => {
    const today = startOfToday();
    let start = today;
    const end = endOfDay(today);
    if (rangeKey === "7 DIAS") start = subDays(today, 6);
    else if (rangeKey === "30 DIAS") start = subDays(today, 29);
    else if (rangeKey === "MÊS") start = startOfMonth(today);
    else if (rangeKey === "TUDO") return { from: "", to: "" };
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }, [rangeKey]);

  const { data: sales = [], isLoading: lSales } = useQuery({
    queryKey: ["finance-sales", from, to],
    queryFn: async () => {
      let q = supabase.from("sales")
        .select("id, amount, zenon_cost, provider_cost, status, sale_date, paid_at, payment_method, clients(full_name), products(name)")
        .eq("status", "concluida")
        .order("sale_date", { ascending: false })
        .limit(300);
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses = [], isLoading: lExp } = useQuery({
    queryKey: ["finance-expenses", from, to],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(300);
      if (from) q = q.gte("expense_date", from);
      if (to) q = q.lte("expense_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: splits = [], isLoading: lSplits } = useQuery({
    queryKey: ["finance-splits", from, to],
    queryFn: async () => {
      // Busca comissões (commissions) em vez de commission_splits (se for o caso da estrutura atual)
      // Vou tentar buscar da tabela 'commissions' que parece ser a principal agora
      const { data, error } = await supabase.from("commissions")
        .select(`
          *,
          sales:sale_id(status, sale_date, clients(full_name), products(name)),
          partners:partner_id(full_name),
          referrers:referrer_id(full_name),
          collaborator:profiles!collaborator_id(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(300);
      
      if (error) {
        console.error("Erro ao buscar comissões:", error);
        return [];
      }
      
      let rows = (data ?? []).filter((c: any) => !c.sale_id || saleIsFinalized(c.sales));
      if (from && to) {
        rows = rows.filter((c: any) => {
          const date = (c.paid_at || c.created_at || "").slice(0, 10);
          return date >= from && date <= to;
        });
      }
      return rows;
    },
  });

  // KPIs corretos
  const kpis = useMemo(() => {
    const revenue = sales
      .filter((s: any) => s.status === "concluida")
      .reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const receivable = sales
      .filter((s: any) => s.status === "pendente")
      .reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
    const salesCosts = sales
      .filter((s: any) => saleIsFinalized(s))
      .reduce((a: number, s: any) => a + Number(s.zenon_cost || 0) + Number(s.provider_cost || 0), 0);
    const expensesTotal = expenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const commissionsPaid = splits
      .filter((c: any) => c.status === "pago")
      .reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const commissionsPending = splits
      .filter((c: any) => c.status === "pendente")
      .reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const profit = revenue - commissionsPaid - expensesTotal - salesCosts;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, receivable, expensesTotal, commissionsPaid, commissionsPending, salesCosts, profit, margin };
  }, [sales, expenses, splits]);

  // Chart - buckets dependem do range
  const chartData = useMemo(() => {
    const useMonthly = rangeKey === "TUDO";
    let start: Date, end: Date;
    if (rangeKey === "TUDO") {
      const dates = [
        ...sales.map((s: any) => s.sale_date),
        ...expenses.map((e: any) => e.expense_date),
        ...splits.map((c: any) => c.paid_at || c.created_at),
      ].filter(Boolean).map((d: string) => new Date(d));
      if (!dates.length) return [];
      start = startOfMonth(new Date(Math.min(...dates.map((d) => d.getTime()))));
      end = endOfMonth(new Date(Math.max(...dates.map((d) => d.getTime()))));
    } else {
      start = new Date(from);
      end = new Date(to);
    }
    const map: Record<string, { label: string; revenue: number; expenses: number; commissions: number }> = {};
    if (useMonthly) {
      eachMonthOfInterval({ start, end }).forEach((d) => {
        const key = format(d, "yyyy-MM");
        map[key] = { label: format(d, "MMM/yy", { locale: ptBR }), revenue: 0, expenses: 0, commissions: 0 };
      });
    } else {
      eachDayOfInterval({ start, end }).forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        map[key] = { label: format(d, "dd/MM"), revenue: 0, expenses: 0, commissions: 0 };
      });
    }
    const k = (iso?: string | null) => {
      if (!iso) return "";
      return useMonthly ? iso.slice(0, 7) : iso.slice(0, 10);
    };
    sales.forEach((s: any) => {
      if (s.status !== "concluida") return;
      const key = k(s.sale_date);
      if (map[key]) map[key].revenue += Number(s.amount || 0);
    });
    expenses.forEach((e: any) => {
      const key = k(e.expense_date);
      if (map[key]) map[key].expenses += Number(e.amount || 0);
    });
    splits.forEach((c: any) => {
      if (c.status === "cancelado") return;
      const key = k(c.paid_at || c.created_at);
      if (map[key]) map[key].commissions += Number(c.amount || 0);
    });
    return Object.values(map);
  }, [sales, expenses, splits, rangeKey, from, to]);

  // Monthly report
  const monthlyReport = useMemo(() => {
    const end = startOfToday();
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(end), reportMonths - 1), end });
    return months.map((m) => {
      const ms = format(m, "yyyy-MM");
      const monthSales = sales.filter((s: any) => (s.sale_date || "").slice(0,7) === ms);
      const rev = monthSales.filter((s: any) => s.status === "concluida").reduce((a:number,s:any)=>a+Number(s.amount||0),0);
      const sCosts = monthSales.filter((s: any) => s.status !== "cancelada").reduce((a:number,s:any)=>a+Number(s.zenon_cost||0)+Number(s.provider_cost||0),0);
      const exp = expenses.filter((e: any) => (e.expense_date || "").slice(0,7) === ms).reduce((a:number,e:any)=>a+Number(e.amount||0),0);
      const com = splits.filter((c: any) => c.status === "pago" && ((c.paid_at||"").slice(0,7) === ms)).reduce((a:number,c:any)=>a+Number(c.amount||0),0);
      const profit = rev - com - exp - sCosts;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      return { month: format(m, "MMM/yy", { locale: ptBR }), revenue: rev, expenses: exp, commissions: com, profit, margin };
    });
  }, [sales, expenses, splits, reportMonths]);

  // Alerts
  const alerts = useMemo(() => {
    const list: { msg: string; tab: string }[] = [];
    if (kpis.expensesTotal > kpis.revenue && kpis.revenue > 0) list.push({ msg: `Despesas (${formatBRL(kpis.expensesTotal)}) superam a receita (${formatBRL(kpis.revenue)})`, tab: "expenses" });
    if (kpis.commissionsPending > 0) list.push({ msg: `${formatBRL(kpis.commissionsPending)} em comissões pendentes de pagamento`, tab: "commissions" });
    if (kpis.receivable > 0) list.push({ msg: `${formatBRL(kpis.receivable)} a receber em vendas pendentes`, tab: "sales" });
    return list;
  }, [kpis]);

  // Filtered + sorted lists
  const salesFiltered = useMemo(() => {
    const q = norm(search);
    let r = sales.filter((s: any) => {
      if (salesStatus !== "all" && s.status !== salesStatus) return false;
      if (!q) return true;
      return norm(s.clients?.full_name).includes(q) || norm(s.products?.name).includes(q) || norm(s.payment_method).includes(q);
    });
    r = [...r].sort((a: any, b: any) => {
      const dir = salesSort.d === "asc" ? 1 : -1;
      const get = (x: any) => {
        if (salesSort.k === "amount") return Number(x.amount || 0);
        if (salesSort.k === "client") return norm(x.clients?.full_name);
        if (salesSort.k === "product") return norm(x.products?.name);
        if (salesSort.k === "status") return x.status;
        return x.sale_date || "";
      };
      const va = get(a), vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
    return r;
  }, [sales, search, salesStatus, salesSort]);

  const expensesFiltered = useMemo(() => {
    const q = norm(search);
    let r = expenses.filter((e: any) => {
      if (expenseCategory !== "all" && e.category !== expenseCategory) return false;
      if (!q) return true;
      return norm(e.description).includes(q) || norm(e.category).includes(q);
    });
    r = [...r].sort((a: any, b: any) => {
      const dir = expSort.d === "asc" ? 1 : -1;
      const get = (x: any) => {
        if (expSort.k === "amount") return Number(x.amount || 0);
        if (expSort.k === "description") return norm(x.description);
        if (expSort.k === "category") return x.category;
        return x.expense_date || "";
      };
      const va = get(a), vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
    return r;
  }, [expenses, search, expenseCategory, expSort]);

  const splitsFiltered = useMemo(() => {
    const q = norm(search);
    let r = splits.filter((c: any) => {
      if (splitStatus !== "all" && c.status !== splitStatus) return false;
      if (!q) return true;
      const beneficiaryName = norm(c.partners?.full_name || c.referrers?.full_name || c.collaborator?.full_name || "");
      return norm(c.sales?.clients?.full_name).includes(q) || 
             norm(c.sales?.products?.name).includes(q) || 
             beneficiaryName.includes(q);
    });
    r = [...r].sort((a: any, b: any) => {
      const dir = splitSort.d === "asc" ? 1 : -1;
      const get = (x: any) => {
        if (splitSort.k === "amount") return Number(x.amount || 0);
        if (splitSort.k === "status") return x.status;
        if (splitSort.k === "beneficiary") return x.partners?.full_name || x.referrers?.full_name || x.collaborator?.full_name || "";
        return x.created_at || "";
      };
      const va = get(a), vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
    return r;
  }, [splits, search, splitStatus, splitSort]);

  const salesPaged = salesFiltered.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  const expPaged = expensesFiltered.slice((expPage - 1) * PAGE_SIZE, expPage * PAGE_SIZE);
  const splitPaged = splitsFiltered.slice((splitPage - 1) * PAGE_SIZE, splitPage * PAGE_SIZE);

  const toggleSort = (s: any, set: any, k: string) =>
    set({ k, d: s.k === k && s.d === "desc" ? "asc" : "desc" });

  // Expense actions
  const openNewExpense = () => {
    setEditingExpense(null);
    setExpForm({ description: "", amount: "", category: "Operacional", expense_date: new Date().toISOString().slice(0, 10) });
    setExpDialogOpen(true);
  };
  const openEditExpense = (e: any) => {
    setEditingExpense(e);
    setExpForm({ description: e.description, amount: String(e.amount), category: e.category, expense_date: e.expense_date });
    setExpDialogOpen(true);
  };
  const saveExpense = async () => {
    const description = expForm.description.trim();
    const amount = Number(expForm.amount);
    if (description.length < 3) {
      toast.error("Descrição deve ter pelo menos 3 caracteres");
      return;
    }
    if (description.length > 200) {
      toast.error("Descrição muito longa (máx. 200 caracteres)");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }
    if (amount > 1_000_000_000) {
      toast.error("Valor acima do limite permitido");
      return;
    }
    const dateObj = new Date(expForm.expense_date);
    if (isNaN(dateObj.getTime())) {
      toast.error("Data inválida");
      return;
    }
    if (expForm.expense_date > new Date().toISOString().slice(0, 10)) {
      toast.error("Data não pode ser futura");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { description, amount, category: expForm.category, expense_date: expForm.expense_date };
      const { error } = editingExpense
        ? await supabase.from("expenses").update(payload).eq("id", editingExpense.id)
        : await supabase.from("expenses").insert(payload);
      if (error) throw error;
      toast.success(editingExpense ? "Despesa atualizada" : "Despesa registrada");
      setExpDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };
  const deleteExpense = async (e: any) => {
    const ok = await confirmAction({
      title: "Excluir despesa?",
      description: `Esta ação não pode ser desfeita. Despesa: ${e.description} (${formatBRL(e.amount)})`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Despesa excluída");
    qc.invalidateQueries({ queryKey: ["finance-expenses"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const markSplitPaid = async (c: any) => {
    const beneficiaryName = c.partners?.full_name || c.referrers?.full_name || c.collaborator?.full_name || "Beneficiário";
    const ok = await confirmAction({
      title: "Marcar comissão como paga?",
      description: `Beneficiário: ${beneficiaryName} — Valor: ${formatBRL(c.amount)}`,
      confirmText: "Confirmar pagamento",
    });
    if (!ok) return;
    const { error } = await supabase.from("commissions")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Comissão paga");
    qc.invalidateQueries({ queryKey: ["finance-splits"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const exportSalesCsv = () => downloadCsv(`vendas_${Date.now()}.csv`,
    ["Data", "Cliente", "Produto", "Valor", "Status", "Método"],
    salesFiltered.map((s: any) => [
      formatDate(s.sale_date), s.clients?.full_name || "", s.products?.name || "",
      Number(s.amount || 0).toFixed(2), SALE_STATUS[s.status]?.label || s.status, s.payment_method || "",
    ]));
  const exportExpensesCsv = () => downloadCsv(`despesas_${Date.now()}.csv`,
    ["Data", "Descrição", "Categoria", "Valor"],
    expensesFiltered.map((e: any) => [
      formatDate(e.expense_date), e.description, e.category, Number(e.amount || 0).toFixed(2),
    ]));
  const exportSplitsCsv = () => downloadCsv(`comissoes_${Date.now()}.csv`,
    ["Criada", "Cliente", "Produto", "Beneficiário", "Tipo", "Valor", "Status", "Paga em"],
    splitsFiltered.map((c: any) => [
      formatDate(c.created_at), c.sales?.clients?.full_name || "", c.sales?.products?.name || "",
      c.beneficiary_id, BENEFICIARY_LABEL[c.beneficiary_type] || c.beneficiary_type,
      Number(c.amount || 0).toFixed(2), SPLIT_STATUS[c.status]?.label || c.status,
      c.paid_at ? formatDate(c.paid_at) : "",
    ]));
  const exportReportCsv = () => downloadCsv(`relatorio_${Date.now()}.csv`,
    ["Mês", "Receita", "Despesas", "Comissões", "Lucro", "Margem %"],
    monthlyReport.map((r) => [r.month, r.revenue.toFixed(2), r.expenses.toFixed(2), r.commissions.toFixed(2), r.profit.toFixed(2), r.margin.toFixed(1)]));

  const KpiCard = ({ label, value, tone, icon, onClick, mono = true }: any) => (
    <button onClick={onClick} className={cn("bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 text-left hover:shadow-md hover:border-indigo-200 transition-all")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={cn("p-1.5 rounded-md",
          tone === "success" && "bg-emerald-50 text-emerald-600",
          tone === "warning" && "bg-amber-50 text-amber-600",
          tone === "danger" && "bg-rose-50 text-rose-600",
          tone === "info" && "bg-sky-50 text-sky-600",
          tone === "primary" && "bg-indigo-50 text-indigo-600",
        )}>{icon}</span>
      </div>
      <p className={cn("text-xl font-bold text-slate-900 tracking-tight", mono && "font-mono")}>{value}</p>
    </button>
  );

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (rangeKey !== "TUDO") activeFilters.push({ label: `Período: ${rangeKey}`, clear: () => setRangeKey("TUDO") });
  if (search) activeFilters.push({ label: `Busca: ${search}`, clear: () => setSearch("") });
  if (tab === "sales" && salesStatus !== "all") activeFilters.push({ label: `Status: ${SALE_STATUS[salesStatus]?.label}`, clear: () => setSalesStatus("all") });
  if (tab === "expenses" && expenseCategory !== "all") activeFilters.push({ label: `Categoria: ${expenseCategory}`, clear: () => setExpenseCategory("all") });
  if (tab === "commissions" && splitStatus !== "all") activeFilters.push({ label: `Status: ${SPLIT_STATUS[splitStatus]?.label}`, clear: () => setSplitStatus("all") });

  return (
    <div className="min-h-dvh bg-slate-50/60 font-sans">
      <PageHero
        eyebrow="Tesouraria"
        category="Operações Financeiras"
        title="Faturamento"
        description={`Lucro líquido ${formatBRL(kpis.profit)} · Margem ${kpis.margin.toFixed(1)}%`}
        icon={<PiggyBank className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200/70 rounded-lg p-0.5 shadow-sm">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button key={k} onClick={() => setRangeKey(k)}
                  className={cn("px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-all",
                    rangeKey === k ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>
                  {k}
                </button>
              ))}
            </div>
            {canManage && (
              <Button onClick={openNewExpense} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Nova despesa
              </Button>
            )}
          </div>
        }
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-6 pb-10">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Receita Bruta" value={formatBRL(kpis.revenue)} tone="success" icon={<TrendingUp className="size-3.5" />} onClick={() => setTab("sales")} />
          <KpiCard label="A Receber" value={formatBRL(kpis.receivable)} tone="warning" icon={<Clock3 className="size-3.5" />} onClick={() => { setSalesStatus("pendente"); setTab("sales"); }} />
          <KpiCard label="Comissões Pagas" value={formatBRL(kpis.commissionsPaid)} tone="info" icon={<Wallet className="size-3.5" />} onClick={() => { setSplitStatus("pago"); setTab("commissions"); }} />
          <KpiCard label="Despesas" value={formatBRL(kpis.expensesTotal)} tone="danger" icon={<ArrowDownToLine className="size-3.5" />} onClick={() => setTab("expenses")} />
          <KpiCard label="Lucro Líquido" value={formatBRL(kpis.profit)} tone="primary" icon={<PiggyBank className="size-3.5" />} onClick={() => setTab("overview")} />
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200/70 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="size-4" />
              <span className="text-sm font-semibold">Atenção</span>
            </div>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-sm text-amber-900 flex items-center justify-between gap-3">
                  <span>• {a.msg}</span>
                  <button onClick={() => setTab(a.tab)} className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline">Ver</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Filtros:</span>
            {activeFilters.map((f, i) => (
              <Badge key={i} variant="outline" className="bg-white border-slate-200 text-slate-700 gap-1.5">
                {f.label}
                <button onClick={f.clear}><X className="size-3" /></button>
              </Badge>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white border border-slate-200/70 rounded-lg p-1 h-auto flex-wrap justify-start overflow-x-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              <BarChart3 className="size-3.5 mr-1.5" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Vendas <span className="ml-1.5 text-[10px] font-mono opacity-60">{sales.length}</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Despesas <span className="ml-1.5 text-[10px] font-mono opacity-60">{expenses.length}</span>
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Comissões <span className="ml-1.5 text-[10px] font-mono opacity-60">{splits.length}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Search bar for table tabs */}
          {tab !== "overview" && tab !== "reports" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 bg-white border-slate-200" />
              </div>
              {tab === "sales" && (
                <Select value={salesStatus} onValueChange={setSalesStatus}>
                  <SelectTrigger className="w-44 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {tab === "expenses" && (
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger className="w-44 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {tab === "commissions" && (
                <Select value={splitStatus} onValueChange={setSplitStatus}>
                  <SelectTrigger className="w-44 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={
                tab === "sales" ? exportSalesCsv : tab === "expenses" ? exportExpensesCsv : exportSplitsCsv
              } className="border-slate-200">
                <Download className="size-3.5 mr-1.5" /> CSV
              </Button>
            </div>
          )}

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4">
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-slate-900">Fluxo de Caixa</h2>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-indigo-600" /> Receita</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-500" /> Despesas</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" /> Comissões</span>
                </div>
              </div>
              {(lSales || lExp || lSplits) ? (
                <Skeleton className="h-[320px] w-full" />
              ) : chartData.length === 0 ? (
                <div className="h-[320px] flex flex-col items-center justify-center text-slate-400">
                  <BarChart3 className="size-10 mb-2 opacity-40" />
                  <p className="text-sm">Sem dados no período selecionado</p>
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: 12 }}
                        formatter={(v: any) => formatBRL(Number(v))}
                      />
                      <Area type="monotone" dataKey="revenue" name="Receita" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.12} />
                      <Bar dataKey="expenses" name="Despesas" fill="#f43f5e" radius={[3, 3, 0, 0]} barSize={14} />
                      <Line type="monotone" dataKey="commissions" name="Comissões" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SALES */}
          <TabsContent value="sales" className="mt-4">
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              {lSales ? (
                <div className="p-6 space-y-3">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : salesFiltered.length === 0 ? (
                <EmptyState hasData={sales.length > 0} label="venda" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                          <SortableTh label="Data" k="sale_date" sortKey={salesSort.k} sortDir={salesSort.d} onSort={(k: string) => toggleSort(salesSort, setSalesSort, k)} />
                          <SortableTh label="Cliente" k="client" sortKey={salesSort.k} sortDir={salesSort.d} onSort={(k: string) => toggleSort(salesSort, setSalesSort, k)} />
                          <SortableTh label="Produto" k="product" sortKey={salesSort.k} sortDir={salesSort.d} onSort={(k: string) => toggleSort(salesSort, setSalesSort, k)} />
                          <SortableTh label="Valor" k="amount" sortKey={salesSort.k} sortDir={salesSort.d} onSort={(k: string) => toggleSort(salesSort, setSalesSort, k)} align="right" />
                          <SortableTh label="Status" k="status" sortKey={salesSort.k} sortDir={salesSort.d} onSort={(k: string) => toggleSort(salesSort, setSalesSort, k)} />
                        </tr>
                      </thead>
                      <tbody>
                        {salesPaged.map((s: any) => (
                          <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-slate-700 font-mono text-xs">{formatDate(s.sale_date)}</td>
                            <td className="px-4 py-3 text-slate-900 font-medium">{s.clients?.full_name || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{s.products?.name || "—"}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatBRL(s.amount)}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={SALE_STATUS[s.status]?.cls || ""}>{SALE_STATUS[s.status]?.label || s.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 border-t border-slate-200">
                    <PaginationControl currentPage={salesPage} totalPages={Math.max(1, Math.ceil(salesFiltered.length / PAGE_SIZE))} onPageChange={setSalesPage} pageSize={__ps} onPageSizeChange={setPageSize} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* EXPENSES */}
          <TabsContent value="expenses" className="mt-4">
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              {lExp ? (
                <div className="p-6 space-y-3">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : expensesFiltered.length === 0 ? (
                <EmptyState hasData={expenses.length > 0} label="despesa" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                          <SortableTh label="Data" k="expense_date" sortKey={expSort.k} sortDir={expSort.d} onSort={(k: string) => toggleSort(expSort, setExpSort, k)} />
                          <SortableTh label="Descrição" k="description" sortKey={expSort.k} sortDir={expSort.d} onSort={(k: string) => toggleSort(expSort, setExpSort, k)} />
                          <SortableTh label="Categoria" k="category" sortKey={expSort.k} sortDir={expSort.d} onSort={(k: string) => toggleSort(expSort, setExpSort, k)} />
                          <SortableTh label="Valor" k="amount" sortKey={expSort.k} sortDir={expSort.d} onSort={(k: string) => toggleSort(expSort, setExpSort, k)} align="right" />
                          {canManage && <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {expPaged.map((e: any) => (
                          <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-slate-700 font-mono text-xs">{formatDate(e.expense_date)}</td>
                            <td className="px-4 py-3 text-slate-900 font-medium">{e.description}</td>
                            <td className="px-4 py-3"><Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{e.category}</Badge></td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600">{formatBRL(e.amount)}</td>
                            {canManage && (
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex gap-1">
                                  <Button variant="ghost" size="icon" aria-label="Editar despesa" className="size-7" onClick={() => openEditExpense(e)}><Pencil className="size-3.5" /></Button>
                                  <Button variant="ghost" size="icon" aria-label="Excluir despesa" className="size-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => deleteExpense(e)}><Trash2 className="size-3.5" /></Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 border-t border-slate-200">
                    <PaginationControl currentPage={expPage} totalPages={Math.max(1, Math.ceil(expensesFiltered.length / PAGE_SIZE))} onPageChange={setExpPage} pageSize={__ps} onPageSizeChange={setPageSize} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* COMMISSIONS */}
          <TabsContent value="commissions" className="mt-4">
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              {lSplits ? (
                <div className="p-6 space-y-3">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : splitsFiltered.length === 0 ? (
                <EmptyState hasData={splits.length > 0} label="comissão" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                          <SortableTh label="Criada" k="created_at" sortKey={splitSort.k} sortDir={splitSort.d} onSort={(k: string) => toggleSort(splitSort, setSplitSort, k)} />
                          <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cliente / Produto</th>
                          <SortableTh label="Beneficiário" k="beneficiary" sortKey={splitSort.k} sortDir={splitSort.d} onSort={(k: string) => toggleSort(splitSort, setSplitSort, k)} />
                          <SortableTh label="Valor" k="amount" sortKey={splitSort.k} sortDir={splitSort.d} onSort={(k: string) => toggleSort(splitSort, setSplitSort, k)} align="right" />
                          <SortableTh label="Status" k="status" sortKey={splitSort.k} sortDir={splitSort.d} onSort={(k: string) => toggleSort(splitSort, setSplitSort, k)} />
                          {canManage && <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {splitPaged.map((c: any) => (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-slate-700 font-mono text-xs">{formatDate(c.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="text-slate-900 font-medium">{c.sales?.clients?.full_name || "—"}</div>
                              <div className="text-xs text-slate-500">{c.sales?.products?.name || "—"}</div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-slate-900 font-medium">
                                {c.partners?.full_name || c.referrers?.full_name || c.collaborator?.full_name || "—"}
                              </p>
                              <Badge variant="outline" className="text-[9px] h-4 px-1 uppercase tracking-tighter">
                                {c.partner_id ? "Parceiro" : c.referrer_id ? "Indicador" : "Colaborador"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatBRL(c.amount)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className={SPLIT_STATUS[c.status]?.cls || ""}>{SPLIT_STATUS[c.status]?.label || c.status}</Badge>
                                {c.workflow_status && (
                                  <Badge variant="outline" className={cn("text-[9px] h-4", WORKFLOW_STATUS[c.workflow_status]?.cls)}>
                                    {WORKFLOW_STATUS[c.workflow_status]?.label}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            {canManage && (
                              <td className="px-4 py-3 text-right">
                                {c.status === "pendente" && (
                                  <Button size="sm" variant="ghost" className="text-emerald-700 hover:bg-emerald-50" onClick={() => markSplitPaid(c)}>
                                    <CheckCircle2 className="size-3.5 mr-1" /> Pagar
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 border-t border-slate-200">
                    <PaginationControl currentPage={splitPage} totalPages={Math.max(1, Math.ceil(splitsFiltered.length / PAGE_SIZE))} onPageChange={setSplitPage} pageSize={__ps} onPageSizeChange={setPageSize} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-600">Período:</Label>
                <Select value={String(reportMonths)} onValueChange={(v) => setReportMonths(Number(v))}>
                  <SelectTrigger className="w-36 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meses</SelectItem>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={exportReportCsv} className="border-slate-200">
                <Download className="size-3.5 mr-1.5" /> CSV
              </Button>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Comparativo mensal</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyReport}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: any) => formatBRL(Number(v))} />
                    <Bar dataKey="revenue" name="Receita" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name="Despesas" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="commissions" name="Comissões" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Mês</th>
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Receita</th>
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Despesas</th>
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Comissões</th>
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Lucro</th>
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.map((r) => (
                      <tr key={r.month} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-900 font-medium capitalize">{r.month}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatBRL(r.revenue)}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600">{formatBRL(r.expenses)}</td>
                        <td className="px-4 py-3 text-right font-mono text-amber-700">{formatBRL(r.commissions)}</td>
                        <td className={cn("px-4 py-3 text-right font-mono font-bold", r.profit >= 0 ? "text-slate-900" : "text-rose-700")}>{formatBRL(r.profit)}</td>
                        <td className={cn("px-4 py-3 text-right font-mono", r.margin >= 0 ? "text-slate-700" : "text-rose-600")}>{r.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Expense Dialog */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
            <DialogDescription>Registre uma despesa operacional da empresa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="Ex.: Aluguel do escritório" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => setExpForm({ ...expForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" max={new Date().toISOString().slice(0,10)} value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0,00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveExpense} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? "Salvando..." : editingExpense ? "Salvar alterações" : "Registrar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ hasData, label }: { hasData: boolean; label: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-slate-400">
      <Receipt className="size-10 mb-2 opacity-40" />
      <p className="text-sm font-medium text-slate-600">
        {hasData ? `Nenhuma ${label} corresponde aos filtros` : `Nenhuma ${label} cadastrada`}
      </p>
      <p className="text-xs mt-1">{hasData ? "Ajuste a busca ou filtros para ver mais resultados" : "Os dados aparecerão aqui assim que forem registrados"}</p>
    </div>
  );
}
