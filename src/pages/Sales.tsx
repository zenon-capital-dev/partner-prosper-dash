import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Download, MoreHorizontal, CheckCircle2, XCircle, PlayCircle,
  Clock3, Receipt, Trash2, Eye, ShoppingBag, TrendingUp, X, SlidersHorizontal,
  CalendarRange, Sparkles, Printer, Copy, RotateCcw,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type StatusKey = "todos" | "pendente" | "em_andamento" | "concluida" | "cancelada";

const STATUS_META: Record<string, { label: string; class: string; icon: any }> = {
  pendente: { label: "Pendente", class: "bg-warning-muted text-warning", icon: Clock3 },
  em_andamento: { label: "Em andamento", class: "bg-info-muted text-info", icon: PlayCircle },
  concluida: { label: "Concluída", class: "bg-success-muted text-success", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", class: "bg-destructive-muted text-destructive", icon: XCircle },
};

export default function Sales() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("todos");
  const [partnerFilter, setPartnerFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [receiptOf, setReceiptOf] = useState<any>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-rich"],
    queryFn: async () => (await supabase
      .from("sales")
      .select("*, clients(id, full_name, email, document, company), products(name, product_categories(name, color)), partners(full_name, pix_key)")
      .order("sale_date", { ascending: false })).data ?? [],
  });

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-filter-sales"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").order("full_name")).data ?? [],
  });

  const filtered = useMemo(() => {
    return sales.filter((s: any) => {
      if (status !== "todos" && s.status !== status) return false;
      if (partnerFilter === "sem" && s.partner_id) return false;
      if (partnerFilter !== "todos" && partnerFilter !== "sem" && s.partner_id !== partnerFilter) return false;
      if (dateFrom && s.sale_date < dateFrom) return false;
      if (dateTo && s.sale_date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.clients?.full_name ?? ""} ${s.clients?.company ?? ""} ${s.products?.name ?? ""} ${s.partners?.full_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sales, status, partnerFilter, dateFrom, dateTo, search]);

  const kpis = useMemo(() => {
    const acc = { total: 0, concluida: 0, pendente: 0, em_andamento: 0, cancelada: 0, count: filtered.length };
    filtered.forEach((s: any) => {
      const v = Number(s.amount || 0);
      acc.total += v;
      if (s.status === "concluida") acc.concluida += v;
      else if (s.status === "pendente") acc.pendente += v;
      else if (s.status === "em_andamento") acc.em_andamento += v;
      else if (s.status === "cancelada") acc.cancelada += v;
    });
    return acc;
  }, [filtered]);

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const selectedSum = useMemo(() => filtered.filter((s: any) => selected[s.id]).reduce((a: number, s: any) => a + Number(s.amount || 0), 0), [filtered, selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((s: any) => selected[s.id]);
  const toggleAll = () => {
    if (allFilteredSelected) setSelected({});
    else { const next: Record<string, boolean> = {}; filtered.forEach((s: any) => { next[s.id] = true; }); setSelected(next); }
  };

  const updateStatus = async (ids: string[], newStatus: "pendente" | "em_andamento" | "concluida" | "cancelada", label: string) => {
    const { error } = await supabase.from("sales").update({ status: newStatus }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} venda(s) ${label}`);
    setSelected({});
    qc.invalidateQueries({ queryKey: ["sales-rich"] });
  };

  const removeOne = async (s: any) => {
    if (!confirm(`Excluir venda de ${formatBRL(s.amount)}? Comissões vinculadas serão removidas.`)) return;
    const { error } = await supabase.from("sales").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Venda excluída"); qc.invalidateQueries({ queryKey: ["sales-rich"] }); }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Excluir ${selectedIds.length} venda(s)? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("sales").delete().in("id", selectedIds);
    if (error) toast.error(error.message);
    else { toast.success("Vendas excluídas"); setSelected({}); qc.invalidateQueries({ queryKey: ["sales-rich"] }); }
  };

  const exportCSV = () => {
    const headers = ["Data", "Cliente", "Empresa", "Produto", "Categoria", "Parceiro", "Valor", "% Comissão", "Status"];
    const rows = filtered.map((s: any) => [
      s.sale_date, s.clients?.full_name ?? "", s.clients?.company ?? "",
      s.products?.name ?? "", s.products?.product_categories?.name ?? "",
      s.partners?.full_name ?? "", Number(s.amount).toFixed(2),
      s.commission_percent, s.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vendas_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const clearFilters = () => { setSearch(""); setStatus("todos"); setPartnerFilter("todos"); setDateFrom(""); setDateTo(""); };
  const activeFilters = [search, status !== "todos", partnerFilter !== "todos", dateFrom, dateTo].filter(Boolean).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-5">
      <PageHeader
        title="Vendas"
        description="Histórico, ciclo de vida e ações financeiras das vendas registradas."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2"><Download className="size-4" /> Exportar</Button>
            <Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90"><Plus className="size-4" /> Nova Venda</Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={ShoppingBag} label="Vendas (filtro)" value={kpis.count} sub={formatBRL(kpis.total)} tone="primary" highlight />
        <Kpi icon={CheckCircle2} label="Concluídas" value={formatBRL(kpis.concluida)} tone="success" />
        <Kpi icon={PlayCircle} label="Em andamento" value={formatBRL(kpis.em_andamento)} tone="info" />
        <Kpi icon={Clock3} label="Pendentes" value={formatBRL(kpis.pendente)} tone="warning" />
        <Kpi icon={XCircle} label="Canceladas" value={formatBRL(kpis.cancelada)} tone="destructive" />
      </div>

      {/* Filtros */}
      <div className="vx-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente, empresa, produto, parceiro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-background" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="h-9 w-[180px] text-xs"><SlidersHorizontal className="size-3.5 mr-1" /><SelectValue placeholder="Parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos parceiros</SelectItem>
                <SelectItem value="sem">Vendas diretas</SelectItem>
                {partnersList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <CalendarRange className="size-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[140px] text-xs" />
              <span className="text-muted-foreground text-xs">→</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[140px] text-xs" />
            </div>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
                <X className="size-3" /> Limpar ({activeFilters})
              </Button>
            )}
          </div>
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
          <TabsList className="h-9">
            <TabsTrigger value="todos" className="text-xs">Todas <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1">{sales.length}</Badge></TabsTrigger>
            <TabsTrigger value="pendente" className="text-xs data-[state=active]:text-warning">Pendentes</TabsTrigger>
            <TabsTrigger value="em_andamento" className="text-xs data-[state=active]:text-info">Em andamento</TabsTrigger>
            <TabsTrigger value="concluida" className="text-xs data-[state=active]:text-success">Concluídas</TabsTrigger>
            <TabsTrigger value="cancelada" className="text-xs data-[state=active]:text-destructive">Canceladas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="vx-card p-3 flex items-center justify-between border-primary/30 ring-1 ring-primary/20 animate-fade-in">
          <div className="flex items-center gap-3">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm">
              <span className="font-semibold">{selectedIds.length}</span> selecionada(s) ·
              <span className="font-semibold vx-mono ml-1">{formatBRL(selectedSum)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected({})} className="gap-1"><X className="size-3.5" /> Limpar</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus(selectedIds, "em_andamento", "em andamento")} className="gap-1 text-info hover:text-info"><PlayCircle className="size-3.5" /> Andamento</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus(selectedIds, "cancelada", "canceladas")} className="gap-1 text-destructive hover:text-destructive"><XCircle className="size-3.5" /> Cancelar</Button>
            <Button size="sm" variant="outline" onClick={bulkDelete} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="size-3.5" /> Excluir</Button>
            <Button size="sm" onClick={() => updateStatus(selectedIds, "concluida", "concluídas")} className="gap-1 bg-gradient-primary"><CheckCircle2 className="size-3.5" /> Concluir</Button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 w-10"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} /></th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold">Produto</th>
                <th className="px-4 py-3 text-left font-semibold">Parceiro</th>
                <th className="px-4 py-3 text-right font-semibold">Valor</th>
                <th className="px-4 py-3 text-right font-semibold">Comissão</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center text-muted-foreground text-sm">Carregando vendas...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center">
                  <ShoppingBag className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium">Nenhuma venda encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">{activeFilters > 0 ? "Ajuste os filtros para ver resultados" : "Registre sua primeira venda"}</p>
                  <Button size="sm" onClick={activeFilters > 0 ? clearFilters : () => setOpen(true)} className="mt-4 gap-2">
                    {activeFilters > 0 ? <><X className="size-4" /> Limpar filtros</> : <><Plus className="size-4" /> Nova Venda</>}
                  </Button>
                </td></tr>
              ) : filtered.map((s: any) => {
                const meta = STATUS_META[s.status] ?? STATUS_META.pendente;
                const StatusIcon = meta.icon;
                const commissionValue = Number(s.amount || 0) * Number(s.commission_percent || 0) / 100;
                return (
                  <tr key={s.id} className={`hover:bg-muted/30 transition-colors group ${selected[s.id] ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={!!selected[s.id]} onCheckedChange={(v) => setSelected({ ...selected, [s.id]: !!v })} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground vx-mono whitespace-nowrap">{formatDate(s.sale_date)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/clientes/${s.clients?.id}`)} className="text-left group/cli">
                        <p className="font-medium group-hover/cli:text-primary transition-colors truncate max-w-[200px]">{s.clients?.full_name ?? "—"}</p>
                        {s.clients?.company && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{s.clients.company}</p>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.products?.product_categories && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0" style={{ background: `${s.products.product_categories.color}20`, color: s.products.product_categories.color }}>
                            {s.products.product_categories.name}
                          </span>
                        )}
                        <span className="text-sm truncate max-w-[200px]">{s.products?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[140px]">{s.partners?.full_name ?? <span className="text-muted-foreground/60">Direto</span>}</td>
                    <td className="px-4 py-3 text-right vx-mono font-semibold">{formatBRL(s.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.partners ? (
                        <div>
                          <p className="vx-mono text-xs text-success font-semibold">{formatBRL(commissionValue)}</p>
                          <p className="text-[10px] text-muted-foreground">{Number(s.commission_percent).toFixed(1)}%</p>
                        </div>
                      ) : <span className="text-[11px] text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${meta.class}`}>
                        <StatusIcon className="size-2.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="size-8 rounded-md hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="size-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-[10px] uppercase">Ações da venda</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {s.clients && (
                            <DropdownMenuItem onClick={() => navigate(`/clientes/${s.clients.id}`)}>
                              <Eye className="size-3.5 mr-2" /> Ver cliente
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setReceiptOf(s)}>
                            <Receipt className="size-3.5 mr-2" /> Ver comprovante
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {s.status !== "concluida" && (
                            <DropdownMenuItem onClick={() => updateStatus([s.id], "concluida", "concluída")} className="text-success">
                              <CheckCircle2 className="size-3.5 mr-2" /> Marcar como concluída
                            </DropdownMenuItem>
                          )}
                          {s.status !== "em_andamento" && (
                            <DropdownMenuItem onClick={() => updateStatus([s.id], "em_andamento", "em andamento")}>
                              <PlayCircle className="size-3.5 mr-2" /> Em andamento
                            </DropdownMenuItem>
                          )}
                          {s.status !== "pendente" && (
                            <DropdownMenuItem onClick={() => updateStatus([s.id], "pendente", "reabertas")}>
                              <RotateCcw className="size-3.5 mr-2" /> Reabrir como pendente
                            </DropdownMenuItem>
                          )}
                          {s.status !== "cancelada" && (
                            <DropdownMenuItem onClick={() => updateStatus([s.id], "cancelada", "canceladas")} className="text-destructive">
                              <XCircle className="size-3.5 mr-2" /> Cancelar venda
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => removeOne(s)} className="text-destructive">
                            <Trash2 className="size-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> de {sales.length} vendas</span>
          <span>Total filtrado: <span className="font-semibold text-foreground vx-mono">{formatBRL(kpis.total)}</span></span>
        </div>
      </div>

      <SaleFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["sales-rich"] })} />
      <ReceiptDialog sale={receiptOf} onOpenChange={(o) => !o && setReceiptOf(null)} />
    </div>
  );
}

/* ============ COMPROVANTE ============ */
function ReceiptDialog({ sale, onOpenChange }: any) {
  if (!sale) return null;
  const meta = STATUS_META[sale.status] ?? STATUS_META.pendente;
  const StatusIcon = meta.icon;
  const commissionValue = Number(sale.amount || 0) * Number(sale.commission_percent || 0) / 100;
  const liquid = Number(sale.amount || 0) - commissionValue;

  const copyId = () => { navigator.clipboard.writeText(sale.id); toast.success("ID copiado"); };
  const print = () => window.print();

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-primary text-primary-foreground p-5 print:bg-primary">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-80 font-semibold">Comprovante de venda</p>
              <p className="font-display text-2xl font-bold mt-1 vx-mono">{formatBRL(sale.amount)}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-white/20 backdrop-blur`}>
              <StatusIcon className="size-2.5" /> {meta.label}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="opacity-70 uppercase font-semibold tracking-wider text-[9px]">Data</p>
              <p className="font-semibold mt-0.5">{formatDate(sale.sale_date)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-70 uppercase font-semibold tracking-wider text-[9px]">ID</p>
              <button onClick={copyId} className="font-mono text-[10px] mt-0.5 hover:underline inline-flex items-center gap-1">
                {sale.id.slice(0, 8)}... <Copy className="size-2.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-0 sr-only">
            <DialogTitle>Comprovante</DialogTitle>
            <DialogDescription>Detalhes da venda</DialogDescription>
          </DialogHeader>

          <Section title="Cliente">
            <Row label="Nome" value={sale.clients?.full_name} />
            {sale.clients?.company && <Row label="Empresa" value={sale.clients.company} />}
            {sale.clients?.email && <Row label="E-mail" value={sale.clients.email} />}
            {sale.clients?.document && <Row label="Documento" value={sale.clients.document} mono />}
          </Section>

          <Section title="Produto">
            <Row label="Item" value={sale.products?.name} />
            {sale.products?.product_categories?.name && (
              <Row label="Categoria" value={sale.products.product_categories.name} />
            )}
          </Section>

          {sale.partners && (
            <Section title="Parceiro indicador">
              <Row label="Nome" value={sale.partners.full_name} />
              {sale.partners.pix_key && <Row label="PIX" value={sale.partners.pix_key} mono />}
            </Section>
          )}

          <Section title="Resumo financeiro">
            <Row label="Valor bruto" value={formatBRL(sale.amount)} mono strong />
            {sale.partners && (
              <>
                <Row label={`Comissão (${Number(sale.commission_percent).toFixed(1)}%)`} value={`- ${formatBRL(commissionValue)}`} mono className="text-warning" />
                <div className="border-t border-border pt-2 mt-1">
                  <Row label="Líquido p/ empresa" value={formatBRL(liquid)} mono strong className="text-success" />
                </div>
              </>
            )}
          </Section>

          {sale.notes && (
            <div className="rounded-md bg-muted/40 p-3 text-xs">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Observações</p>
              <p className="whitespace-pre-wrap">{sale.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 pb-5 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">Fechar</Button>
          <Button onClick={print} className="gap-2 bg-gradient-primary"><Printer className="size-4" /> Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ label, value, mono, strong, className = "" }: any) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "vx-mono" : ""} ${strong ? "font-semibold text-sm" : ""} ${className} text-right`}>{value}</span>
    </div>
  );
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
    <div className={`vx-card p-3.5 ${highlight ? `ring-1 ${t.ring}` : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="font-display text-xl font-bold vx-mono mt-1 truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 vx-mono">{sub}</p>}
        </div>
        <div className={`size-8 rounded-md flex items-center justify-center ${t.bg} ${t.color}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
