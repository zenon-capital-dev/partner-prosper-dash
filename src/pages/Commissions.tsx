import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
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

type StatusFilter = "all" | "aguardando_confirmacao" | "pendente" | "liberada" | "em_pagamento" | "paga" | "cancelada" | "estornada";

const statusBadge: Record<string, string> = {
  aguardando_confirmacao: "bg-blue-50 text-blue-600 border-blue-200",
  pendente: "bg-amber-50 text-amber-600 border-amber-200",
  liberada: "bg-indigo-50 text-indigo-600 border-indigo-200",
  em_pagamento: "bg-purple-50 text-purple-600 border-purple-200",
  paga: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
  estornada: "bg-slate-100 text-slate-600 border-slate-300",
};

const commissionTriggerEvents = [
  { value: "first_sale", label: "Primeira Venda" },
  { value: "renewal", label: "Renovação" },
  { value: "recurrence", label: "Recorrência" },
  { value: "single_payment", label: "Pagamento Único" },
];


export default function Commissions() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "rules">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [ruleCreateOpen, setRuleCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
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
    commission_type: "percentual",
    status: "aguardando_confirmacao",
    notes: "",
  });

  const [ruleForm, setRuleForm] = useState<any>({
    partner_id: "",
    product_id: "",
    rule_type: "percentage",
    value: 0,
    is_recurring: false,
    trigger_event: "first_sale",
    release_after_payment: true,
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

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["commission-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_rules")
        .select("*, partners(full_name), products(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-simple"],
    queryFn: async () => (await supabase.from("partners").select("id,full_name,pix_key").order("full_name")).data ?? [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-simple"],
    queryFn: async () => (await supabase.from("products").select("id,name").order("name")).data ?? [],
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-simple"],
    queryFn: async () => (await supabase.from("sales").select("id,amount,sale_date,commission_percent,clients(full_name),products(name)").order("sale_date", { ascending: false }).limit(200)).data ?? [],
  });


  // ----- Filtering -----
  const filtered = useMemo(() => {
    return commissions.filter((c: any) => {
      if (statusFilter !== "all" && c.workflow_status !== statusFilter) return false;
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
    const acc = { paid: 0, pending: 0, total: 0, count: filtered.length };
    filtered.forEach((c: any) => {
      const v = Number(c.amount || 0);
      acc.total += v;
      if (c.workflow_status === "paga") acc.paid += v;
      else if (["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(c.workflow_status)) acc.pending += v;
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
      commission_type: createForm.commission_type,
      workflow_status: createForm.status,
      notes: createForm.notes || null,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("commissions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão criada");
    setCreateOpen(false);
    setCreateForm({ partner_id: "", sale_id: "", amount: 0, percent: 10, status: "aguardando_confirmacao", notes: "" });
    qc.invalidateQueries({ queryKey: ["commissions-list"] });
  };

  const saveRule = async () => {
    if (!ruleForm.rule_type) { toast.error("Selecione o tipo de regra"); return; }
    const payload = {
      partner_id: ruleForm.partner_id || null,
      product_id: ruleForm.product_id || null,
      rule_type: ruleForm.rule_type,
      value: Number(ruleForm.value),
      is_recurring: ruleForm.is_recurring,
      trigger_event: ruleForm.trigger_event,
      release_after_payment: ruleForm.release_after_payment,
    };
    const { error } = await supabase.from("commission_rules").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Regra de comissão salva");
    setRuleCreateOpen(false);
    setRuleForm({ partner_id: "", product_id: "", rule_type: "percentage", value: 0, is_recurring: false, trigger_event: "first_sale", release_after_payment: true });
    qc.invalidateQueries({ queryKey: ["commission-rules"] });
  };


  const openEdit = (c: any) => {
    setEditing(c);
    setEditForm({
      amount: c.amount,
      percent: c.percent,
      commission_type: c.commission_type || "percentual",
      status: c.workflow_status || "aguardando_confirmacao",
      notes: c.notes ?? "",
      payment_method: c.payment_method ?? "",
      paid_at: c.paid_at ? c.paid_at.slice(0, 10) : "",
      approval_date: c.approval_date ? c.approval_date.slice(0, 10) : "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const payload: any = {
      amount: Number(editForm.amount),
      percent: Number(editForm.percent),
      commission_type: editForm.commission_type,
      workflow_status: editForm.status,
      notes: editForm.notes || null,
      payment_method: editForm.payment_method || null,
      approval_date: editForm.status === "aprovada" ? (editForm.approval_date ? new Date(editForm.approval_date).toISOString() : new Date().toISOString()) : (editing.approval_date || null),
      paid_at: editForm.status === "paga" ? (editForm.paid_at ? new Date(editForm.paid_at).toISOString() : new Date().toISOString()) : (editing.paid_at || null),
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
    const { error } = await supabase.from("commissions").update({ workflow_status: "cancelada", paid_at: null }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão cancelada"); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  const reopenOne = async (c: any) => {
    const { error } = await supabase.from("commissions").update({ workflow_status: "aguardando_confirmacao", paid_at: null }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão redefinida para Aguardando Confirmação"); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
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
      workflow_status: "paga" as const,
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
    const { error } = await supabase.from("commissions").update({ workflow_status: "cancelada", paid_at: null }).in("id", selectedIds);
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
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Financeiro"
        category="Commission Engine"
        title="Central de Comissões"
        description="Gestão de regras e pagamentos para parceiros e indicadores."
        icon={<Wallet className="size-6" />}
        actions={
          <div className="flex gap-2">
            {activeTab === "rules" ? (
              <Button onClick={() => setRuleCreateOpen(true)} className="btn-premium h-10 px-5 gap-2 font-semibold">
                <Plus className="size-4" strokeWidth={2.5} /> Nova Regra
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={exportCSV} className="h-10 gap-2">
                  <FileSpreadsheet className="size-4" /> Exportar CSV
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="btn-premium h-10 px-5 gap-2 font-semibold">
                  <Plus className="size-4" strokeWidth={2.5} /> Nova Comissão
                </Button>
              </>
            )}
          </div>
        }

        kpis={[
          { label: "Total filtrado", value: formatBRL(totals.total), tone: "primary", hint: `${totals.count} registros`, icon: <CircleDollarSign className="size-4" /> },
          { label: "Pendente / Análise", value: formatBRL(totals.pending), tone: "warning", icon: <Clock className="size-4" /> },
          { label: "Pagas", value: formatBRL(totals.paid), tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Taxa Conversão", value: `${totals.total ? Math.round((totals.paid / totals.total) * 100) : 0}%`, tone: "info", icon: <TrendingUp className="size-4" /> },
        ]}
      />


      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-white/50 backdrop-blur-sm border border-slate-200/60 p-1 h-12 rounded-2xl w-fit">
          <TabsTrigger value="list" className="h-10 px-6 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Histórico de Comissões</TabsTrigger>
          <TabsTrigger value="rules" className="h-10 px-6 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Regras de Comissionamento</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
              <TabsList className="h-10 bg-slate-50/50">
                <TabsTrigger value="all">Todas <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1">{commissions.length}</Badge></TabsTrigger>
                <TabsTrigger value="aguardando_confirmacao" className="data-[state=active]:text-blue-500">Aguardando Confirmação</TabsTrigger>
                <TabsTrigger value="pendente" className="data-[state=active]:text-amber-600">Pendentes</TabsTrigger>
                <TabsTrigger value="liberada" className="data-[state=active]:text-indigo-500">Liberadas</TabsTrigger>
                <TabsTrigger value="em_pagamento" className="data-[state=active]:text-purple-500">Em Pagamento</TabsTrigger>
                <TabsTrigger value="paga" className="data-[state=active]:text-emerald-700">Pagas</TabsTrigger>
                <TabsTrigger value="cancelada" className="data-[state=active]:text-destructive">Canceladas</TabsTrigger>
                <TabsTrigger value="estornada" className="data-[state=active]:text-slate-600">Estornadas</TabsTrigger>
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
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge[c.workflow_status || "aguardando_confirmacao"]}`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {String(c.workflow_status || "aguardando_confirmacao").replace(/_/g, " ")}
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
                      {["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(c.workflow_status) && (

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
                          {c.workflow_status !== "aguardando_confirmacao" && (
                            <DropdownMenuItem onClick={() => reopenOne(c)}><Clock className="size-3.5 mr-2" /> Resetar (Aguardando)</DropdownMenuItem>
                          )}
                          {c.workflow_status !== "cancelada" && (
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
    </TabsContent>


    <TabsContent value="rules" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4 text-left font-semibold">Regra Aplicada</th>
                <th className="px-6 py-4 text-left font-semibold">Evento Disparador</th>
                <th className="px-6 py-4 text-right font-semibold">Valor</th>
                <th className="px-6 py-4 text-center font-semibold">Recorrência</th>
                <th className="px-6 py-4 text-center font-semibold">Liberação</th>
                <th className="px-6 py-4 text-right font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingRules ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground text-sm">Carregando regras...</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">Nenhuma regra de comissão configurada</td></tr>
              ) : rules.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">
                        {r.partners?.full_name ?? "Todos Parceiros"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.products?.name ?? "Todos os Produtos"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-slate-200 text-slate-600">
                      {commissionTriggerEvents.find(e => e.value === r.trigger_event)?.label ?? r.trigger_event}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right vx-mono font-bold">
                    {r.rule_type === 'percentage' ? formatPercent(r.value) : formatBRL(r.value)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.is_recurring ? (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200">Recorrente</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-xs">
                    {r.release_after_payment ? "Pós Pagamento" : "Imediata"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TabsContent>
  </Tabs>

  {/* DIALOGS */}

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
                  <SelectItem value="aguardando_confirmacao">Aguardando Confirmação</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="liberada">Liberada</SelectItem>
                  <SelectItem value="em_pagamento">Em Pagamento</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="estornada">Estornada</SelectItem>
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
                  <SelectItem value="aguardando_confirmacao">Aguardando Confirmação</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="liberada">Liberada</SelectItem>
                  <SelectItem value="em_pagamento">Em Pagamento</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="estornada">Estornada</SelectItem>
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

      {/* RULE CREATE Dialog */}
      <Dialog open={ruleCreateOpen} onOpenChange={setRuleCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nova Regra de Comissionamento</DialogTitle>
            <DialogDescription>Defina como o sistema deve calcular as comissões automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Parceiro / Indicador (opcional)</Label>
              <Select value={ruleForm.partner_id || "all"} onValueChange={(v) => setRuleForm({ ...ruleForm, partner_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos os parceiros" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os parceiros</SelectItem>
                  {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Deixe vazio para regra geral.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Produto (opcional)</Label>
              <Select value={ruleForm.product_id || "all"} onValueChange={(v) => setRuleForm({ ...ruleForm, product_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Valor</Label>
              <Select value={ruleForm.rule_type} onValueChange={(v) => setRuleForm({ ...ruleForm, rule_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={ruleForm.value} onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Evento de Disparo</Label>
              <Select value={ruleForm.trigger_event} onValueChange={(v) => setRuleForm({ ...ruleForm, trigger_event: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {commissionTriggerEvents.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-center space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="is_recurring" checked={ruleForm.is_recurring} onCheckedChange={(v) => setRuleForm({ ...ruleForm, is_recurring: !!v })} />
                <Label htmlFor="is_recurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Comissão Recorrente?
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="release_after_payment" checked={ruleForm.release_after_payment} onCheckedChange={(v) => setRuleForm({ ...ruleForm, release_after_payment: !!v })} />
                <Label htmlFor="release_after_payment" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Liberar só após pagamento do cliente?
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleCreateOpen(false)}>Cancelar</Button>
            <Button onClick={saveRule} className="bg-gradient-primary gap-2"><Sparkles className="size-4" /> Salvar Regra</Button>
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
