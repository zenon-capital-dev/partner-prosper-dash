import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";
import { confirmAction } from "@/lib/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { usePageSize } from "@/hooks/usePageSize";
import { EmptyState } from "@/components/EmptyState";
import {
  Plus, Search, Pencil, Trash2, CheckCircle2, Clock, TrendingDown,
  Filter, X, Download, Receipt, Calendar, DollarSign,
} from "lucide-react";

type Expense = {
  id: string;
  description: string;
  category: string;
  subcategory?: string | null;
  amount: number;
  expense_date: string;
  reference_month?: string | null;
  due_date?: string | null;
  paid: boolean;
  paid_at?: string | null;
  payment_method?: string | null;
  vendor?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
  created_at: string;
};

const CATEGORY_OPTIONS = [
  { value: "operacional", label: "Operacional" },
  { value: "administrativa", label: "Administrativa" },
  { value: "marketing", label: "Marketing" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "impostos", label: "Impostos" },
  { value: "juridico", label: "Jurídico/Contábil" },
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "outras", label: "Outras" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito_automatico", label: "Débito automático" },
];

const ymOf = (d?: string | null) => (d ? d.slice(0, 7) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthIso = (d?: string | null) => {
  const base = d ? new Date(d) : new Date();
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-01`;
};

interface Props {
  expenses: Expense[];
  canManage: boolean;
}

export function ExpensesTab({ expenses, canManage }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pago" | "pendente" | "vencido">("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState<string>(""); // yyyy-mm
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);
  const { pageSize: __ps, setPageSize } = usePageSize();
  const PAGE_SIZE = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;

  const today = todayIso();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (expenses as Expense[])
      .filter((e) => {
        if (q) {
          const hay = `${e.description ?? ""} ${e.vendor ?? ""} ${e.notes ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (categoryFilter !== "todos" && e.category !== categoryFilter) return false;
        if (monthFilter) {
          const ref = ymOf(e.reference_month || e.expense_date);
          if (ref !== monthFilter) return false;
        }
        if (statusFilter === "pago" && !e.paid) return false;
        if (statusFilter === "pendente" && e.paid) return false;
        if (statusFilter === "vencido") {
          const isOverdue = !e.paid && ((e.due_date && e.due_date < today) || (!e.due_date && e.expense_date < today));
          if (!isOverdue) return false;
        }
        return true;
      });
  }, [expenses, search, statusFilter, categoryFilter, monthFilter, today]);

  const totals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0;
    for (const e of filtered) {
      const v = Number(e.amount || 0);
      total += v;
      if (e.paid) paid += v;
      else {
        pending += v;
        const isOverdue = (e.due_date && e.due_date < today) || (!e.due_date && e.expense_date < today);
        if (isOverdue) overdue += v;
      }
    }
    return { total, paid, pending, overdue, count: filtered.length };
  }, [filtered, today]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage, PAGE_SIZE],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["fin-expenses"] });

  const togglePaid = async (e: Expense) => {
    const nextPaid = !e.paid;
    const { error } = await supabase
      .from("expenses")
      .update({ paid: nextPaid, paid_at: nextPaid ? todayIso() : null } as any)
      .eq("id", e.id);
    if (error) toast.error(error.message);
    else {
      toast.success(nextPaid ? "Despesa marcada como paga" : "Despesa reaberta");
      invalidate();
    }
  };

  const remove = async (e: Expense) => {
    const ok = await confirmAction({
      title: "Excluir despesa?",
      description: `"${e.description}" — ${formatBRL(Number(e.amount || 0))}`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) toast.error(error.message);
    else { toast.success("Despesa excluída"); invalidate(); }
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("todos"); setCategoryFilter("todos"); setMonthFilter("");
  };

  const exportCsv = () => {
    const header = ["Descrição","Categoria","Fornecedor","Data","Competência","Vencimento","Valor","Status","Pago em","Método","Observações"];
    const lines = filtered.map((e) => [
      e.description, e.category, e.vendor ?? "",
      e.expense_date, ymOf(e.reference_month), e.due_date ?? "",
      String(e.amount).replace(".", ","),
      e.paid ? "pago" : "pendente",
      e.paid_at ?? "", e.payment_method ?? "", (e.notes ?? "").replace(/\n/g, " "),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob([[header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `despesas-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total no filtro" value={formatBRL(totals.total)} sub={`${totals.count} registros`} tone="slate" icon={<Receipt className="size-4" />} />
        <KpiCard label="Pagas" value={formatBRL(totals.paid)} tone="emerald" icon={<CheckCircle2 className="size-4" />} />
        <KpiCard label="Pendentes" value={formatBRL(totals.pending)} tone="amber" icon={<Clock className="size-4" />} />
        <KpiCard label="Vencidas" value={formatBRL(totals.overdue)} tone="rose" icon={<TrendingDown className="size-4" />} />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200/70 rounded-lg p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição, fornecedor..." className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="vencido">Vencidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="h-9 w-[150px]" />
        {(search || statusFilter !== "todos" || categoryFilter !== "todos" || monthFilter) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9"><X className="size-4 mr-1" /> Limpar</Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9"><Download className="size-4 mr-1" /> Exportar</Button>
          {canManage && (
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="h-9">
              <Plus className="size-4 mr-1" /> Nova despesa
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200/70 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma despesa encontrada"
            description={expenses.length === 0 ? "Comece lançando sua primeira despesa operacional." : "Ajuste os filtros para ver outros registros."}
            actionLabel={canManage && expenses.length === 0 ? "Lançar despesa" : undefined}
            onAction={canManage && expenses.length === 0 ? () => { setEditing(null); setDialogOpen(true); } : undefined}
          />

        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                  <th className="text-left px-3 py-2 font-semibold">Categoria</th>
                  <th className="text-left px-3 py-2 font-semibold">Fornecedor</th>
                  <th className="text-left px-3 py-2 font-semibold">Competência</th>
                  <th className="text-left px-3 py-2 font-semibold">Vencimento</th>
                  <th className="text-right px-3 py-2 font-semibold">Valor</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-3 py-2 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((e) => {
                  const overdue = !e.paid && ((e.due_date && e.due_date < today) || (!e.due_date && e.expense_date < today));
                  return (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{e.description}</div>
                        {e.notes && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{e.notes}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-700 capitalize">
                        {CATEGORY_OPTIONS.find((c) => c.value === e.category)?.label ?? e.category}
                        {e.subcategory && <div className="text-[11px] text-slate-500">{e.subcategory}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{e.vendor || "—"}</td>
                      <td className="px-3 py-2 text-slate-700 font-mono text-xs">{ymOf(e.reference_month || e.expense_date)}</td>
                      <td className="px-3 py-2 text-slate-700 font-mono text-xs">{e.due_date ? formatDate(e.due_date) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{formatBRL(Number(e.amount || 0))}</td>
                      <td className="px-3 py-2">
                        {e.paid ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                            <CheckCircle2 className="size-3" /> Pago {e.paid_at ? `· ${formatDate(e.paid_at)}` : ""}
                          </Badge>
                        ) : overdue ? (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] gap-1">
                            <TrendingDown className="size-3" /> Vencida
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1">
                            <Clock className="size-3" /> Pendente
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => togglePaid(e)}>
                                {e.paid ? "Reabrir" : "Marcar paga"}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(e); setDialogOpen(true); }}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700" onClick={() => remove(e)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              itemsPerPage={PAGE_SIZE}
              pageSize={__ps}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
        onSaved={() => { invalidate(); setDialogOpen(false); setEditing(null); }}
      />
    </div>
  );
}

function KpiCard({ label, value, sub, tone, icon }: {
  label: string; value: string; sub?: string;
  tone: "slate" | "emerald" | "amber" | "rose"; icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
        {icon} {label}
      </div>
      <div className="text-lg font-mono font-bold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ExpenseFormDialog({ open, onOpenChange, expense, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: Expense | null;
  onSaved: () => void;
}) {
  const editing = !!expense;
  const [form, setForm] = useState(() => initForm(expense));
  const [saving, setSaving] = useState(false);

  // Sync when opening
  useMemo(() => { if (open) setForm(initForm(expense)); return null; }, [open, expense]);

  function initForm(e: Expense | null) {
    return {
      description: e?.description ?? "",
      category: e?.category ?? "operacional",
      subcategory: e?.subcategory ?? "",
      amount: e ? String(e.amount) : "",
      expense_date: e?.expense_date ?? todayIso(),
      reference_month: e?.reference_month ? e.reference_month.slice(0, 7) : todayIso().slice(0, 7),
      due_date: e?.due_date ?? "",
      paid: e?.paid ?? false,
      paid_at: e?.paid_at ?? "",
      payment_method: e?.payment_method ?? "",
      vendor: e?.vendor ?? "",
      notes: e?.notes ?? "",
      receipt_url: e?.receipt_url ?? "",
    };
  }

  const save = async () => {
    if (!form.description.trim()) { toast.error("Informe a descrição"); return; }
    const amount = Number(String(form.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    const payload: any = {
      description: form.description.trim(),
      category: form.category,
      subcategory: form.subcategory || null,
      amount,
      expense_date: form.expense_date || todayIso(),
      reference_month: monthIso(form.reference_month + "-01"),
      due_date: form.due_date || null,
      paid: form.paid,
      paid_at: form.paid ? (form.paid_at || todayIso()) : null,
      payment_method: form.payment_method || null,
      vendor: form.vendor || null,
      notes: form.notes || null,
      receipt_url: form.receipt_url || null,
    };
    let error;
    if (editing && expense) {
      ({ error } = await supabase.from("expenses").update(payload).eq("id", expense.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id ?? null;
      ({ error } = await supabase.from("expenses").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Despesa atualizada" : "Despesa lançada");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar despesa" : "Nova despesa operacional"}</DialogTitle>
          <DialogDescription>Preencha os dados da despesa. Ela será debitada do lucro líquido do período.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Aluguel do escritório — junho/2026" />
          </div>

          <div>
            <Label className="text-xs">Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Subcategoria</Label>
            <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} placeholder="Opcional" />
          </div>

          <div>
            <Label className="text-xs">Valor (R$) *</Label>
            <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
          </div>

          <div>
            <Label className="text-xs">Fornecedor</Label>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Ex.: Google Workspace" />
          </div>

          <div>
            <Label className="text-xs">Data da despesa *</Label>
            <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Mês de referência *</Label>
            <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Vencimento</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Método de pagamento</Label>
            <Select value={form.payment_method || "__none"} onValueChange={(v) => setForm({ ...form, payment_method: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={(e) => setForm({ ...form, paid: e.target.checked, paid_at: e.target.checked ? (form.paid_at || todayIso()) : "" })}
                className="size-4 rounded border-slate-300 text-indigo-600"
              />
              Já foi paga
            </label>
            {form.paid && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Pago em</Label>
                <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} className="h-9 w-[160px]" />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">Link do comprovante</Label>
            <Input value={form.receipt_url} onChange={(e) => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://..." />
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Detalhes internos, número da nota, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Lançar despesa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
