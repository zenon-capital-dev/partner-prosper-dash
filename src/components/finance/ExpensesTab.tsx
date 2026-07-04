import { useEffect, useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw, TrendingDown, Wallet, AlertTriangle, Receipt, FileText, Tag, Calendar, CreditCard, Building2, StickyNote, Repeat, Banknote, Zap, Landmark, Coins, Settings2, Paperclip, Upload, X, ExternalLink, Loader2 } from "lucide-react";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { ManageExpenseCategoriesDialog } from "@/components/finance/ManageExpenseCategoriesDialog";
import { getCurrentUserId } from "@/lib/current-user";


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
  receipt_url: string | null;
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
  receipt_url: "" as string,
});

interface ExpensesTabProps {
  expenses?: Expense[];
  canManage?: boolean;
  showKpis?: boolean;
  disableInternalDateFilter?: boolean;
  hideFilters?: boolean;
  hideNewButton?: boolean;
  openNewSignal?: number;
}

export function ExpensesTab({ expenses: expensesProp, canManage = true, showKpis = true, disableInternalDateFilter = false, hideFilters = false, hideNewButton = false, openNewSignal }: ExpensesTabProps = {}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [month, setMonth] = useState<string>(ymNow());
  const [category, setCategory] = useState<string>("todas");
  const [status, setStatus] = useState<"todos" | "pago" | "pendente" | "vencidas">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [manageOpen, setManageOpen] = useState(false);
  const cats = useExpenseCategories();
  const CATEGORIES = cats.visible;
  const categoryLabel = (v: string) => cats.labelOf(v);
  const categoryColor = (v: string) => cats.colorOf(v);


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
      if (!disableInternalDateFilter) {
        const ref = (e.reference_month || e.expense_date || "").slice(0, 7);
        if (month && ref !== month) return false;
      }
      if (category !== "todas" && e.category !== category) return false;
      if (status === "pago" && !e.paid) return false;
      if (status === "pendente" && e.paid) return false;
      if (status === "vencidas" && (e.paid || !(e.due_date && e.due_date < today))) return false;
      return true;
    });
  }, [rows, month, category, status, today, disableInternalDateFilter]);

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

  // Permite abrir o diálogo a partir de um botão externo (ex.: "Nova despesa" no topo da página).
  useEffect(() => {
    if (openNewSignal !== undefined && openNewSignal > 0) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewSignal]);

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
      receipt_url: e.receipt_url ?? "",
    });
    setDialogOpen(true);
  }

  // Upload de comprovante para o bucket privado. Devolve a "path" salva no storage.
  const [uploading, setUploading] = useState(false);
  async function handleReceiptUpload(file: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo grande demais (máx 15 MB)");
    setUploading(true);
    try {
      const uid = await getCurrentUserId();
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${uid ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("expense-receipts").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) throw error;
      setForm((f) => ({ ...f, receipt_url: path }));
      toast.success("Comprovante anexado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao subir comprovante");
    } finally {
      setUploading(false);
    }
  }
  async function removeReceipt() {
    if (!form.receipt_url) return;
    try {
      await supabase.storage.from("expense-receipts").remove([form.receipt_url]);
    } catch {}
    setForm((f) => ({ ...f, receipt_url: "" }));
  }
  async function openReceipt(path: string) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) return toast.error("Não foi possível abrir o comprovante");
    window.open(data.signedUrl, "_blank");
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
      receipt_url: form.receipt_url || null,
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
          // Comprovante anexa só à primeira parcela para não duplicar o arquivo.
          receipt_url: i === 0 ? base.receipt_url : null,
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
      {!hideFilters && (
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 flex flex-wrap items-end gap-3">
        {!disableInternalDateFilter && (
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-slate-500">Mês de referência</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 mt-1 w-[160px]" />
          </div>
        )}
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-slate-500">Categoria</Label>
          <div className="flex items-center gap-1 mt-1">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <>
                <Button
                  type="button" variant="outline" size="icon"
                  className="h-9 w-9 rounded-lg border-slate-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                  title="Adicionar / gerenciar categorias"
                  onClick={() => setManageOpen(true)}
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  type="button" variant="outline" size="icon"
                  className="h-9 w-9 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Editar / remover categorias"
                  onClick={() => setManageOpen(true)}
                >
                  <Settings2 className="size-4" />
                </Button>
              </>
            )}
          </div>
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
        {canManage && !hideNewButton && (
          <div className="ml-auto">
            <Button onClick={openNew} className="gap-1"><Plus className="size-4" /> Nova despesa</Button>
          </div>
        )}
      </div>
      )}


      {/* Por categoria */}
      {byCategory.length > 0 && (
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Total por categoria</p>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, val]) => (
              <div key={cat} className="px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-2 bg-white" style={{ borderColor: categoryColor(cat) + "55", color: categoryColor(cat) }}>
                <span className="size-2 rounded-full" style={{ background: categoryColor(cat) }} />
                <span className="text-slate-800">{categoryLabel(cat)}</span>

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
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {e.description}
                          {e.receipt_url && (
                            <button
                              type="button"
                              onClick={() => openReceipt(e.receipt_url!)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded px-1.5 py-0.5"
                              title="Ver comprovante"
                            >
                              <Paperclip className="size-3" /> comprovante
                            </button>
                          )}
                        </div>
                        {e.notes && <div className="text-[10.5px] text-slate-500 truncate max-w-[280px]">{e.notes}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] font-semibold border bg-white" style={{ borderColor: categoryColor(e.category) + "66", color: categoryColor(e.category) }}>
                          <span className="size-1.5 rounded-full mr-1" style={{ background: categoryColor(e.category) }} />
                          {categoryLabel(e.category)}
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

      {/* Dialog premium */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                {editing ? <Pencil className="size-5" /> : <Plus className="size-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight text-white">
                  {editing ? "Editar despesa" : "Nova despesa operacional"}
                </DialogTitle>
                <DialogDescription className="text-indigo-100 text-[12.5px] mt-0.5">
                  Toda despesa entra no cálculo do saldo líquido da Zenon no mês de referência.
                </DialogDescription>
              </div>
              {form.amount && Number(form.amount) > 0 && (
                <div className="text-right shrink-0 bg-white/10 rounded-lg px-3 py-2 backdrop-blur">
                  <p className="text-[9.5px] uppercase tracking-widest text-indigo-200 font-bold">Valor</p>
                  <p className="font-mono text-lg font-bold tabular-nums">{formatBRL(Number(form.amount))}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* 1. Identificação */}
            <section>
              <SectionTitle icon={<FileText className="size-3.5" />} label="Identificação" />
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">Descrição *</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ex.: Aluguel escritório abril"
                    className="h-10 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <Building2 className="size-3" /> Fornecedor
                    </Label>
                    <Input
                      value={form.vendor}
                      onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                      placeholder="Empresa / pessoa"
                      className="h-10 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Subcategoria</Label>
                    <Input
                      value={form.subcategory}
                      onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                      placeholder="Opcional"
                      className="h-10 mt-1"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Categoria (chips) */}
            <section>
              <SectionTitle icon={<Tag className="size-3.5" />} label="Categoria *" />
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const active = form.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: c.value })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
                        active
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                          : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Financeiro */}
            <section>
              <SectionTitle icon={<Coins className="size-3.5" />} label="Financeiro" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-700">Valor (R$) *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-slate-400 pointer-events-none">R$</span>
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0,00"
                      className="h-11 pl-10 font-mono text-right text-lg font-bold tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="size-3" /> Competência
                  </Label>
                  <Input
                    type="month"
                    value={form.reference_month}
                    onChange={(e) => setForm({ ...form, reference_month: e.target.value })}
                    className="h-10 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">Vencimento</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="h-10 mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-700">Data do lançamento</Label>
                  <Input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="h-10 mt-1"
                  />
                </div>
              </div>

              <div className="mt-3">
                <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mb-1.5">
                  <CreditCard className="size-3" /> Forma de pagamento
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { value: "pix", label: "PIX", icon: Zap },
                    { value: "boleto", label: "Boleto", icon: Receipt },
                    { value: "ted", label: "TED", icon: Landmark },
                    { value: "cartao", label: "Cartão", icon: CreditCard },
                    { value: "debito_automatico", label: "Débito", icon: RotateCcw },
                    { value: "dinheiro", label: "Dinheiro", icon: Banknote },
                  ].map((m) => {
                    const Icon = m.icon;
                    const active = form.payment_method === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setForm({ ...form, payment_method: m.value })}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-[10.5px] font-semibold transition-all",
                          active
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40",
                        )}
                      >
                        <Icon className="size-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 4. Status */}
            <section>
              <SectionTitle icon={<CheckCircle2 className="size-3.5" />} label="Status de pagamento" />
              <div className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                form.paid ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40",
              )}>
                <Switch
                  checked={form.paid}
                  onCheckedChange={(v) => setForm({ ...form, paid: v, paid_at: v ? (form.paid_at || form.expense_date) : "" })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {form.paid ? "Marcada como paga" : "Ainda não foi paga"}
                  </p>
                  <p className="text-[10.5px] text-slate-500">
                    {form.paid ? "Vai entrar imediatamente no saldo líquido do mês." : "Fica em pendências até você marcar como paga."}
                  </p>
                </div>
                {form.paid && (
                  <Input
                    type="date"
                    value={form.paid_at}
                    onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                    className="h-9 w-[150px] bg-white"
                  />
                )}
              </div>
            </section>

            {/* 5. Recorrência */}
            {!editing && (
              <section>
                <SectionTitle icon={<Repeat className="size-3.5" />} label="Recorrência (opcional)" />
                <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-3">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number" min={1} max={36}
                      value={form.recurringMonths}
                      onChange={(e) => setForm({ ...form, recurringMonths: Number(e.target.value) || 1 })}
                      className="h-10 w-24 font-mono text-center text-lg font-bold tabular-nums bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900">
                        {form.recurringMonths > 1 ? `${form.recurringMonths} meses consecutivos` : "Sem recorrência"}
                      </p>
                      <p className="text-[10.5px] text-slate-600">
                        Cria uma cópia por mês a partir da competência (ex.: 12 = ano inteiro).
                      </p>
                    </div>
                  </div>
                  {form.recurringMonths > 1 && Number(form.amount) > 0 && (
                    <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center justify-between text-[11.5px]">
                      <span className="text-slate-600">Impacto total ao longo do período:</span>
                      <span className="font-mono font-bold text-indigo-700 tabular-nums">
                        {formatBRL(Number(form.amount) * form.recurringMonths)}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 6. Observações */}
            <section>
              <SectionTitle icon={<StickyNote className="size-3.5" />} label="Observações (opcional)" />
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas internas, comprovante, contrato…"
              />
            </section>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {editing ? <><Pencil className="size-4" /> Salvar alterações</> : <><Plus className="size-4" /> Criar despesa</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageExpenseCategoriesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </div>

  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 text-[10.5px] uppercase tracking-[0.15em] font-bold text-slate-500">
      <span className="text-indigo-500">{icon}</span>
      {label}
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
