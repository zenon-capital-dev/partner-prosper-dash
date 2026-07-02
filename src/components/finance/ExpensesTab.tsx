import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw, TrendingDown, Wallet, AlertTriangle, Receipt, FileText, Tag, Calendar, CreditCard, Building2, StickyNote, Repeat, Banknote, Zap, Landmark, Coins } from "lucide-react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "folha", label: "Folha / Salários" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "ferramenta", label: "Ferramenta / Software" },
  { value: "imposto", label: "Imposto / Tributo" },
  { value: "marketing", label: "Marketing" },
  { value: "operacional", label: "Operacional" },
  { value: "financeiro", label: "Financeiro / Bancário" },
  { value: "outros", label: "Outros" },
];

const CAT_STYLE: Record<string, string> = {
  folha: "bg-indigo-50 text-indigo-700 border-indigo-200",
  fornecedor: "bg-blue-50 text-blue-700 border-blue-200",
  ferramenta: "bg-violet-50 text-violet-700 border-violet-200",
  imposto: "bg-rose-50 text-rose-700 border-rose-200",
  marketing: "bg-amber-50 text-amber-700 border-amber-200",
  operacional: "bg-slate-100 text-slate-700 border-slate-200",
  financeiro: "bg-emerald-50 text-emerald-700 border-emerald-200",
  outros: "bg-slate-50 text-slate-600 border-slate-200",
};

type Expense = {
  id: string;
  description: string;
  category: string;
  subcategory: string | null;
  amount: number;
  expense_date: string;
  reference_month: string | null;
  due_date: string | null;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  vendor: string | null;
  notes: string | null;
};

const ymNow = () => new Date().toISOString().slice(0, 7);
const ymdNow = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  description: "",
  category: "operacional",
  subcategory: "",
  amount: "",
  expense_date: ymdNow(),
  reference_month: ymNow(),
  due_date: "",
  paid: false,
  paid_at: "",
  payment_method: "pix",
  vendor: "",
  notes: "",
  recurringMonths: 1,
});

interface ExpensesTabProps {
  expenses?: Expense[];
  canManage?: boolean;
  showKpis?: boolean;
}

export function ExpensesTab({ expenses: expensesProp, canManage = true, showKpis = true }: ExpensesTabProps = {}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [month, setMonth] = useState<string>(ymNow());
  const [category, setCategory] = useState<string>("todas");
  const [status, setStatus] = useState<"todos" | "pago" | "pendente" | "vencidas">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: fetched = [], isLoading } = useQuery({
    queryKey: ["fin-expenses-tab"],
    enabled: !expensesProp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
  const rows: Expense[] = expensesProp ?? fetched;

  const today = ymdNow();
  const filtered = useMemo(() => {
    return rows.filter((e) => {
      const ref = (e.reference_month || e.expense_date || "").slice(0, 7);
      if (month && ref !== month) return false;
      if (category !== "todas" && e.category !== category) return false;
      if (status === "pago" && !e.paid) return false;
      if (status === "pendente" && e.paid) return false;
      if (status === "vencidas" && (e.paid || !(e.due_date && e.due_date < today))) return false;
      return true;
    });
  }, [rows, month, category, status, today]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const paid = filtered.filter((e) => e.paid).reduce((s, e) => s + Number(e.amount || 0), 0);
    const pending = filtered.filter((e) => !e.paid).reduce((s, e) => s + Number(e.amount || 0), 0);
    const overdue = filtered
      .filter((e) => !e.paid && e.due_date && e.due_date < today)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return { total, paid, pending, overdue };
  }, [filtered, today]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      description: e.description,
      category: e.category,
      subcategory: e.subcategory ?? "",
      amount: String(e.amount ?? ""),
      expense_date: e.expense_date,
      reference_month: (e.reference_month ?? e.expense_date ?? "").slice(0, 7),
      due_date: e.due_date ?? "",
      paid: !!e.paid,
      paid_at: e.paid_at ?? "",
      payment_method: e.payment_method ?? "pix",
      vendor: e.vendor ?? "",
      notes: e.notes ?? "",
      recurringMonths: 1,
    });
    setDialogOpen(true);
  }

  async function save() {
    const amount = Number(form.amount);
    if (!form.description.trim()) return toast.error("Informe a descrição");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Valor inválido");
    const base = {
      description: form.description.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      amount,
      expense_date: form.expense_date || ymdNow(),
      due_date: form.due_date || null,
      paid: !!form.paid,
      paid_at: form.paid ? (form.paid_at || form.expense_date || ymdNow()) : null,
      payment_method: form.payment_method || null,
      vendor: form.vendor.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase
        .from("expenses")
        .update({ ...base, reference_month: `${form.reference_month}-01` } as any)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Despesa atualizada");
    } else {
      const months = Math.max(1, Math.min(36, Number(form.recurringMonths) || 1));
      const rowsToInsert: any[] = [];
      const [yy, mm] = form.reference_month.split("-").map(Number);
      for (let i = 0; i < months; i++) {
        const d = new Date(Date.UTC(yy, (mm - 1) + i, 1));
        const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        rowsToInsert.push({
          ...base,
          reference_month: `${ym}-01`,
          created_by: user?.id ?? null,
          // future recurrences start unpaid
          paid: i === 0 ? base.paid : false,
          paid_at: i === 0 ? base.paid_at : null,
        });
      }
      const { error } = await supabase.from("expenses").insert(rowsToInsert as any);
      if (error) return toast.error(error.message);
      toast.success(months > 1 ? `${months} despesas criadas` : "Despesa criada");
    }
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["fin-expenses-tab"] });
    qc.invalidateQueries({ queryKey: ["fin-expenses"] });
  }

  async function togglePaid(e: Expense) {
    const nextPaid = !e.paid;
    const { error } = await supabase
      .from("expenses")
      .update({ paid: nextPaid, paid_at: nextPaid ? ymdNow() : null } as any)
      .eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(nextPaid ? "Despesa marcada como paga" : "Pagamento revertido");
    qc.invalidateQueries({ queryKey: ["fin-expenses-tab"] });
    qc.invalidateQueries({ queryKey: ["fin-expenses"] });
  }

  async function remove(e: Expense) {
    if (!confirm(`Excluir "${e.description}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Despesa excluída");
    qc.invalidateQueries({ queryKey: ["fin-expenses-tab"] });
    qc.invalidateQueries({ queryKey: ["fin-expenses"] });
  }

  return (
    <div className="space-y-4">
      {showKpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Total no filtro" value={formatBRL(kpis.total)} icon={TrendingDown} tone="slate" />
          <Kpi label="Pago" value={formatBRL(kpis.paid)} icon={CheckCircle2} tone="emerald" />
          <Kpi label="Pendente" value={formatBRL(kpis.pending)} icon={Wallet} tone="amber" />
          <Kpi label="Vencidas" value={formatBRL(kpis.overdue)} icon={AlertTriangle} tone="rose" />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-slate-500">Mês de referência</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 mt-1 w-[160px]" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-slate-500">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 mt-1 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-slate-500">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-9 mt-1 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pagas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="vencidas">Vencidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <div className="ml-auto">
            <Button onClick={openNew} className="gap-1"><Plus className="size-4" /> Nova despesa</Button>
          </div>
        )}
      </div>

      {/* Por categoria */}
      {byCategory.length > 0 && (
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Total por categoria</p>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, val]) => (
              <div key={cat} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-2", CAT_STYLE[cat] ?? CAT_STYLE.outros)}>
                <span>{CATEGORIES.find((c) => c.value === cat)?.label ?? cat}</span>
                <span className="font-mono font-bold">{formatBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
          <Receipt className="size-3.5 text-slate-500" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Lançamentos ({filtered.length})</p>
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-sm text-slate-500 text-center">Nenhuma despesa no filtro atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10.5px] uppercase text-slate-500 font-bold">
                <tr>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2">Categoria</th>
                  <th className="text-left px-3 py-2">Fornecedor</th>
                  <th className="text-left px-3 py-2">Competência</th>
                  <th className="text-left px-3 py-2">Vencimento</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => {
                  const overdue = !e.paid && e.due_date && e.due_date < today;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{e.description}</div>
                        {e.notes && <div className="text-[10.5px] text-slate-500 truncate max-w-[280px]">{e.notes}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", CAT_STYLE[e.category] ?? CAT_STYLE.outros)}>
                          {CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                        </Badge>
                        {e.subcategory && <div className="text-[10px] text-slate-500 mt-0.5">{e.subcategory}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{e.vendor || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{(e.reference_month || e.expense_date || "").slice(0, 7)}</td>
                      <td className={cn("px-3 py-2", overdue ? "text-rose-600 font-semibold" : "text-slate-700")}>
                        {e.due_date ? formatDate(e.due_date) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatBRL(e.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {e.paid ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Pago</Badge>
                        ) : overdue ? (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Vencida</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {canManage && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => togglePaid(e)} title={e.paid ? "Reverter" : "Marcar como paga"}>
                              {e.paid ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5 text-emerald-600" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(e)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-rose-600 hover:text-rose-700" onClick={() => remove(e)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle>
            <DialogDescription>Controle avulsas e recorrentes. Entra no saldo líquido da Zenon no mês de referência.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel escritório" className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Subcategoria</Label>
              <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-9 mt-1 font-mono text-right" />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Mês de competência</Label>
              <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data do lançamento</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="debito_automatico">Débito automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3 rounded-md border border-slate-200 p-2.5">
              <Switch checked={form.paid} onCheckedChange={(v) => setForm({ ...form, paid: v, paid_at: v ? (form.paid_at || form.expense_date) : "" })} />
              <div className="flex-1">
                <p className="text-xs font-semibold">Já foi paga</p>
                <p className="text-[10px] text-slate-500">Marque para lançar como paga na data abaixo.</p>
              </div>
              {form.paid && (
                <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} className="h-8 w-[150px]" />
              )}
            </div>
            {!editing && (
              <div className="col-span-2 rounded-md border border-indigo-100 bg-indigo-50/50 p-2.5">
                <Label className="text-xs font-semibold text-indigo-900">Recorrência (meses)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={1} max={36} value={form.recurringMonths}
                    onChange={(e) => setForm({ ...form, recurringMonths: Number(e.target.value) || 1 })}
                    className="h-9 w-24 font-mono text-right" />
                  <p className="text-[11px] text-slate-600">Cria uma cópia por mês a partir da competência (ex.: 12 = ano inteiro).</p>
                </div>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const map = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    emerald: "bg-emerald-50/70 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50/70 border-amber-200 text-amber-800",
    rose: "bg-rose-50/70 border-rose-200 text-rose-800",
  } as const;
  const icon = {
    slate: "text-slate-500",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  } as const;
  return (
    <div className={cn("rounded-lg border shadow-sm p-3 flex items-center gap-3", map[tone])}>
      <div className={cn("size-9 rounded-md bg-white/70 flex items-center justify-center", icon[tone])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wider font-semibold opacity-70">{label}</p>
        <p className="text-lg font-bold font-mono tabular-nums">{value}</p>
      </div>
    </div>
  );
}
