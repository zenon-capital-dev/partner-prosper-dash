import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet, Clock, CheckCircle2, XCircle, Plus, Search, Filter, MoreHorizontal,
  Pencil, Trash2, Check, Download, FileSpreadsheet, Sparkles, CalendarRange,
  TrendingUp, AlertTriangle, X, Receipt, CircleDollarSign,
} from "lucide-react";
import { formatBRL, formatDate, formatPercent, initials } from "@/lib/format";
import { toast } from "sonner";

type StatusFilter = "all" | "pendente" | "pago" | "cancelado";

const statusBadge: Record<string, string> = {
  pendente: "bg-warning-muted text-warning",
  pago: "bg-success-muted text-success",
  cancelado: "bg-destructive-muted text-destructive",
};

export default function Commissions() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null); // single id or { ids: [...] }
  const [payForm, setPayForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "pix",
    notes: "",
  });

  const [createForm, setCreateForm] = useState<any>({
    partner_id: "",
    sale_id: "",
    amount: 0,
    percent: 10,
    status: "pendente",
    notes: "",
  });

  // ----- Queries -----
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["commissions-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commissions")
        .select("*, partners(id,full_name,email,pix_key), sales(amount, sale_date, clients(id,full_name), products(name))")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-simple"],
    queryFn: async () => (await supabase.from("partners").select("id,full_name,pix_key").order("full_name")).data ?? [],
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-simple"],
    queryFn: async () => (await supabase.from("sales").select("id,amount,sale_date,commission_percent,clients(full_name),products(name)").order("sale_date", { ascending: false }).limit(200)).data ?? [],
  });

  // ----- Filtering -----
  const filtered = useMemo(() => {
    return commissions.filter((c: any) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (partnerFilter !== "all" && c.partner_id !== partnerFilter) return false;
      if (dateFrom && c.created_at < dateFrom) return false;
      if (dateTo && c.created_at > `${dateTo}T23:59:59`) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${c.partners?.full_name ?? ""} ${c.sales?.clients?.full_name ?? ""} ${c.sales?.products?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, partnerFilter, dateFrom, dateTo, search]);

  const totals = useMemo(() => {
    const acc = { paid: 0, pending: 0, cancelled: 0, total: 0, count: filtered.length };
    filtered.forEach((c: any) => {
      const v = Number(c.amount || 0);
      acc.total += v;
      if (c.status === "pago") acc.paid += v;
      else if (c.status === "pendente") acc.pending += v;
      else if (c.status === "cancelado") acc.cancelled += v;
    });
    return acc;
  }, [filtered]);

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const selectedTotals = useMemo(() => {
    const list = filtered.filter((c: any) => selected[c.id]);
    return { count: list.length, sum: list.reduce((s: number, c: any) => s + Number(c.amount || 0), 0) };
  }, [filtered, selected]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c: any) => selected[c.id]);
  const toggleAll = () => {
    if (allFilteredSelected) setSelected({});
    else {
      const next: Record<string, boolean> = {};
      filtered.forEach((c: any) => { next[c.id] = true; });
      setSelected(next);
    }
  };

  // ----- Mutations -----
  const createCommission = async () => {
    if (!createForm.partner_id) { toast.error("Selecione um indicador"); return; }
    if (!Number(createForm.amount)) { toast.error("Valor inválido"); return; }
    const payload: any = {
      partner_id: createForm.partner_id,
      sale_id: createForm.sale_id || null,
      amount: Number(createForm.amount),
      percent: Number(createForm.percent || 0),
      status: createForm.status,
      notes: createForm.notes || null,
    };
    const { error } = await supabase.from("commissions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão criada");
    setCreateOpen(false);
    setCreateForm({ partner_id: "", sale_id: "", amount: 0, percent: 10, status: "pendente", notes: "" });
    qc.invalidateQueries({ queryKey: ["commissions-list"] });
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setEditForm({
      amount: c.amount,
      percent: c.percent,
      status: c.status,
      notes: c.notes ?? "",
      payment_method: c.payment_method ?? "",
      paid_at: c.paid_at ? c.paid_at.slice(0, 10) : "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const payload: any = {
      amount: Number(editForm.amount),
      percent: Number(editForm.percent),
      status: editForm.status,
      notes: editForm.notes || null,
      payment_method: editForm.payment_method || null,
      paid_at: editForm.status === "pago" ? (editForm.paid_at ? new Date(editForm.paid_at).toISOString() : new Date().toISOString()) : null,
    };
    const { error } = await supabase.from("commissions").update(payload).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão atualizada");
    setEditOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["commissions-list"] });
  };

  const removeOne = async (c: any) => {
    if (!confirm(`Excluir comissão de ${formatBRL(c.amount)} para ${c.partners?.full_name}?`)) return;
    const { error } = await supabase.from("commissions").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão excluída"); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  const cancelOne = async (c: any) => {
    const { error } = await supabase.from("commissions").update({ status: "cancelado", paid_at: null }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão cancelada"); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  const reopenOne = async (c: any) => {
    const { error } = await supabase.from("commissions").update({ status: "pendente", paid_at: null }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão reaberta"); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  const openPaySingle = (c: any) => { setPayTarget({ ids: [c.id] }); setPayOpen(true); };
  const openPayBulk = () => {
    if (selectedIds.length === 0) { toast.error("Selecione ao menos uma comissão"); return; }
    setPayTarget({ ids: selectedIds });
    setPayOpen(true);
  };

  const confirmPay = async () => {
    if (!payTarget?.ids?.length) return;
    const payload = {
      status: "pago" as const,
      paid_at: new Date(payForm.paid_at).toISOString(),
      payment_method: payForm.payment_method,
      notes: payForm.notes || null,
    };
    const { error } = await supabase.from("commissions").update(payload).in("id", payTarget.ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payTarget.ids.length} comissão(ões) marcada(s) como paga(s)`);
    setPayOpen(false); setPayTarget(null); setSelected({});
    qc.invalidateQueries({ queryKey: ["commissions-list"] });
  };

  const bulkCancel = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Cancelar ${selectedIds.length} comissão(ões)?`)) return;
    const { error } = await supabase.from("commissions").update({ status: "cancelado", paid_at: null }).in("id", selectedIds);
    if (error) toast.error(error.message);
    else { toast.success("Comissões canceladas"); setSelected({}); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Excluir ${selectedIds.length} comissão(ões)? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("commissions").delete().in("id", selectedIds);
    if (error) toast.error(error.message);
    else { toast.success("Comissões excluídas"); setSelected({}); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  // CSV export
  const exportCSV = () => {
    const rows = filtered.map((c: any) => ({
      indicador: c.partners?.full_name ?? "",
      cliente: c.sales?.clients?.full_name ?? "",
      produto: c.sales?.products?.name ?? "",
      valor_venda: c.sales?.amount ?? "",
      percentual: c.percent,
      comissao: c.amount,
      status: c.status,
      pago_em: c.paid_at ? formatDate(c.paid_at) : "",
      metodo: c.payment_method ?? "",
      criada_em: formatDate(c.created_at),
    }));
    const headers = Object.keys(rows[0] ?? { vazio: "" });
    const csv = [headers.join(";"), ...rows.map((r: any) => headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `comissoes_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setPartnerFilter("all"); setDateFrom(""); setDateTo("");
  };

  const activeFiltersCount = [
    search, statusFilter !== "all", partnerFilter !== "all", dateFrom, dateTo
  ].filter(Boolean).length;

  // Auto-sync amount/percent on create
  const onSelectSale = (saleId: string) => {
    const s = sales.find((x: any) => x.id === saleId);
    if (s) {
      const pct = Number(s.commission_percent ?? createForm.percent ?? 10);
      const amount = Math.round(Number(s.amount) * pct) / 100;
      setCreateForm((f: any) => ({ ...f, sale_id: saleId, percent: pct, amount }));
    } else {
      setCreateForm((f: any) => ({ ...f, sale_id: saleId }));
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-5">
      <PageHeader
        title="Comissões"
        description="Gestão completa de comissões: criar, editar, pagar, cancelar e exportar."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <FileSpreadsheet className="size-4" /> Exportar CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90">
              <Plus className="size-4" /> Nova comissão
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={CircleDollarSign} label="Total filtrado" value={formatBRL(totals.total)} sub={`${totals.count} registros`} tone="primary" />
        <KpiCard icon={Clock} label="A pagar" value={formatBRL(totals.pending)} tone="warning" />
        <KpiCard icon={CheckCircle2} label="Pagas" value={formatBRL(totals.paid)} tone="success" />
        <KpiCard icon={XCircle} label="Canceladas" value={formatBRL(totals.cancelled)} tone="destructive" />
      </div>

      {/* Toolbar */}
      <div className="vx-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar indicador, cliente, produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="w-[200px] h-10"><Filter className="size-3.5 mr-1" /><SelectValue placeholder="Indicador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos indicadores</SelectItem>
                {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarRange className="size-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-[150px]" />
              <span className="text-muted-foreground">→</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-[150px]" />
            </div>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-10">
                <X className="size-3.5" /> Limpar ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <TabsList className="h-10">
            <TabsTrigger value="all">Todas <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1">{commissions.length}</Badge></TabsTrigger>
            <TabsTrigger value="pendente" className="data-[state=active]:text-warning">A pagar</TabsTrigger>
            <TabsTrigger value="pago" className="data-[state=active]:text-success">Pagas</TabsTrigger>
            <TabsTrigger value="cancelado" className="data-[state=active]:text-destructive">Canceladas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="vx-card p-3 flex items-center justify-between border-primary/30 ring-1 ring-primary/20 animate-fade-in">
          <div className="flex items-center gap-3">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm">
              <span className="font-semibold">{selectedTotals.count}</span> selecionada(s) ·
              <span className="font-semibold vx-mono ml-1">{formatBRL(selectedTotals.sum)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected({})} className="gap-1"><X className="size-3.5" /> Limpar</Button>
            <Button size="sm" variant="outline" onClick={bulkCancel} className="gap-1"><XCircle className="size-3.5" /> Cancelar</Button>
            <Button size="sm" variant="outline" onClick={bulkDelete} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="size-3.5" /> Excluir</Button>
            <Button size="sm" onClick={openPayBulk} className="gap-1 bg-gradient-primary"><Check className="size-3.5" /> Marcar como pagas</Button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Indicador</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente / Produto</th>
                <th className="px-4 py-3 text-right font-semibold">Base</th>
                <th className="px-4 py-3 text-right font-semibold">%</th>
                <th className="px-4 py-3 text-right font-semibold">Comissão</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Pagamento</th>
                <th className="px-4 py-3 text-right font-semibold w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center">
                  <Wallet className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma comissão encontrada</p>
                  {activeFiltersCount > 0 && <Button size="sm" variant="ghost" onClick={clearFilters} className="mt-2">Limpar filtros</Button>}
                </td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} className={`hover:bg-muted/30 transition-colors ${selected[c.id] ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3">
                    <Checkbox checked={!!selected[c.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-warning-muted text-warning flex items-center justify-center text-[10px] font-bold">{initials(c.partners?.full_name)}</div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.partners?.full_name ?? "—"}</p>
                        {c.partners?.pix_key && <p className="text-[10px] text-muted-foreground vx-mono truncate max-w-[180px]">PIX: {c.partners.pix_key}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{c.sales?.clients?.full_name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{c.sales?.products?.name ?? "Manual"}</p>
                  </td>
                  <td className="px-4 py-3 text-right vx-mono text-muted-foreground">{c.sales?.amount ? formatBRL(c.sales.amount) : "—"}</td>
                  <td className="px-4 py-3 text-right vx-mono">{formatPercent(c.percent)}</td>
                  <td className="px-4 py-3 text-right vx-mono font-bold text-success">{formatBRL(c.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusBadge[c.status]}`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {c.status === "pendente" ? "a pagar" : c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.paid_at ? (
                      <div>
                        <p className="text-xs">{formatDate(c.paid_at)}</p>
                        {c.payment_method && <p className="text-[10px] text-muted-foreground uppercase">{c.payment_method}</p>}
                      </div>
                    ) : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "pendente" && (
                        <Button size="sm" variant="outline" onClick={() => openPaySingle(c)} className="h-7 gap-1 text-xs">
                          <Check className="size-3" /> Pagar
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="size-7 rounded-md hover:bg-muted flex items-center justify-center"><MoreHorizontal className="size-3.5 text-muted-foreground" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                          {c.status !== "pendente" && (
                            <DropdownMenuItem onClick={() => reopenOne(c)}><Clock className="size-3.5 mr-2" /> Reabrir</DropdownMenuItem>
                          )}
                          {c.status !== "cancelado" && (
                            <DropdownMenuItem onClick={() => cancelOne(c)}><XCircle className="size-3.5 mr-2" /> Cancelar</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => removeOne(c)} className="text-destructive">
                            <Trash2 className="size-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-muted/30 border-t-2 border-border">
                <tr className="text-xs font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px]">Total visível</td>
                  <td className="px-4 py-3 text-right vx-mono text-success">{formatBRL(totals.total)}</td>
                  <td colSpan={3} className="px-4 py-3 text-muted-foreground text-[11px]">{filtered.length} registros</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* CREATE Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nova comissão manual</DialogTitle>
            <DialogDescription>Bônus, ajuste ou comissão avulsa fora de uma venda.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Indicador *</Label>
              <Select value={createForm.partner_id} onValueChange={(v) => setCreateForm({ ...createForm, partner_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar indicador" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Vincular a uma venda (opcional)</Label>
              <Select value={createForm.sale_id || "none"} onValueChange={(v) => onSelectSale(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma (manual)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma · comissão avulsa</SelectItem>
                  {sales.slice(0, 50).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.clients?.full_name ?? "?"} — {s.products?.name ?? "?"} ({formatBRL(s.amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>% Comissão</Label>
              <Input type="number" step="0.01" value={createForm.percent} onChange={(e) => setCreateForm({ ...createForm, percent: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Status</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">A pagar</SelectItem>
                  <SelectItem value="pago">Já paga</SelectItem>
                  <SelectItem value="cancelado">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Motivo, contexto, referência..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createCommission} className="bg-gradient-primary gap-2"><Sparkles className="size-4" /> Criar comissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Editar comissão</DialogTitle>
            <DialogDescription>{editing?.partners?.full_name} · {editing?.sales?.clients?.full_name ?? "Manual"}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>% Comissão</Label>
              <Input type="number" step="0.01" value={editForm.percent} onChange={(e) => setEditForm({ ...editForm, percent: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">A pagar</SelectItem>
                  <SelectItem value="pago">Paga</SelectItem>
                  <SelectItem value="cancelado">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Método de pagamento</Label>
              <Select value={editForm.payment_method || "none"} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.status === "pago" && (
              <div className="col-span-2 space-y-1.5">
                <Label>Data do pagamento</Label>
                <Input type="date" value={editForm.paid_at} onChange={(e) => setEditForm({ ...editForm, paid_at: e.target.value })} />
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} className="bg-gradient-primary gap-2"><Check className="size-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAY Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Receipt className="size-5 text-success" /> Confirmar pagamento
            </DialogTitle>
            <DialogDescription>
              {payTarget?.ids?.length === 1
                ? "Marcar 1 comissão como paga."
                : `Marcar ${payTarget?.ids?.length ?? 0} comissões como pagas.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="vx-card p-3 bg-success-muted/30 border-success/20">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Total a pagar</p>
              <p className="font-display text-2xl font-bold vx-mono text-success mt-1">
                {formatBRL(
                  filtered.filter((c: any) => payTarget?.ids?.includes(c.id))
                    .reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="ted">TED</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações / referência</Label>
              <Textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Ex: TXID, comprovante #123..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPay} className="bg-success hover:bg-success/90 text-success-foreground gap-2">
              <CheckCircle2 className="size-4" /> Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }: any) {
  const map: any = {
    primary: "text-primary bg-primary/10 border-primary/20",
    success: "text-success bg-success-muted border-success/20",
    warning: "text-warning bg-warning-muted border-warning/20",
    destructive: "text-destructive bg-destructive-muted border-destructive/20",
  };
  return (
    <div className="vx-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="font-display text-2xl font-bold vx-mono mt-1 truncate">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`size-9 rounded-md border flex items-center justify-center ${map[tone]}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
