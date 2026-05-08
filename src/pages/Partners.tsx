import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Trash2, MoreHorizontal, Pencil, Package, ArrowUpRight,
  Users2, Wallet, TrendingUp, CheckCircle2, Clock3, Award, Crown,
  LayoutGrid, List, Download, X, Power, PowerOff, Mail, Phone, KeyRound, Copy,
} from "lucide-react";
import { formatBRL, formatPercent, initials, formatPhone, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PartnerDetailDrawer } from "@/components/PartnerDetailDrawer";

const emptyForm = { active: true, commission_percent: 10 };
type SortKey = "recent" | "name" | "commissions" | "clients";
type ViewMode = "list" | "grid";

export default function Partners() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [sortBy, setSortBy] = useState<SortKey>("commissions");
  const qc = useQueryClient();

  const { data: partners } = useQuery({
    queryKey: ["partners-rich"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("*, commissions(amount, status, created_at), clients(id), partner_products(id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const enriched = useMemo(() => {
    return (partners ?? []).map((p: any) => {
      const comms = p.commissions ?? [];
      const total = comms.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const paid = comms.filter((c: any) => c.status === "paga").reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const pending = comms.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      // Sparkline: 6 últimos meses
      const now = new Date();
      const months: { key: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, total: 0 });
      }
      comms.forEach((c: any) => {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = months.find((mm) => mm.key === key);
        if (m) m.total += Number(c.amount || 0);
      });
      return {
        ...p,
        _total: total,
        _paid: paid,
        _pending: pending,
        _spark: months.map((m) => m.total),
        _clientsCount: p.clients?.length ?? 0,
        _productsCount: p.partner_products?.length ?? 0,
      };
    });
  }, [partners]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q),
      );
    }
    if (statusFilter === "ativos") list = list.filter((p: any) => p.active);
    else if (statusFilter === "inativos") list = list.filter((p: any) => !p.active);

    const sorted = [...list];
    if (sortBy === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sortBy === "commissions") sorted.sort((a, b) => b._total - a._total);
    else if (sortBy === "clients") sorted.sort((a, b) => b._clientsCount - a._clientsCount);
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [enriched, search, statusFilter, sortBy]);

  // Top 3 ranking baseado em comissão total
  const topIds = useMemo(() => {
    const ranking = [...enriched].sort((a, b) => b._total - a._total).slice(0, 3);
    return new Map(ranking.filter((r) => r._total > 0).map((r, i) => [r.id, i + 1]));
  }, [enriched]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((p: any) => p.active).length;
    const totalComms = enriched.reduce((s: number, p: any) => s + p._total, 0);
    const totalPending = enriched.reduce((s: number, p: any) => s + p._pending, 0);
    const totalClients = enriched.reduce((s: number, p: any) => s + p._clientsCount, 0);
    return { total, active, totalComms, totalPending, totalClients };
  }, [enriched]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      full_name: p.full_name, 
      email: p.email, 
      phone: p.phone, 
      whatsapp: p.whatsapp,
      document: p.document,
      pix_key: p.pix_key, 
      bank_name: p.bank_name,
      bank_agency: p.bank_agency,
      bank_account: p.bank_account,
      partner_category: p.partner_category || "indicador",
      has_system_access: !!p.has_system_access,
      commission_percent: p.commission_percent, 
      notes: p.notes, 
      active: p.active,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.full_name) { toast.error("Nome obrigatório"); return; }
    const payload = {
      full_name: form.full_name, 
      email: form.email || null, 
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      document: form.document || null, 
      pix_key: form.pix_key || null,
      bank_name: form.bank_name || null,
      bank_agency: form.bank_agency || null,
      bank_account: form.bank_account || null,
      partner_category: form.partner_category || "indicador",
      has_system_access: !!form.has_system_access,
      commission_percent: Number(form.commission_percent ?? 10), 
      notes: form.notes || null, 
      active: !!form.active,
    };
    const { error } = editing
      ? await supabase.from("partners").update(payload).eq("id", editing.id)
      : await supabase.from("partners").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Parceiro atualizado" : "Parceiro cadastrado");
    setOpen(false); setEditing(null); setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["partners-rich"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir parceiro? Vínculos com produtos e clientes podem ser afetados.")) return;
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Parceiro excluído"); qc.invalidateQueries({ queryKey: ["partners-rich"] }); }
  };

  const toggleActive = async (p: any) => {
    const { error } = await supabase.from("partners").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(p.active ? "Parceiro desativado" : "Parceiro ativado");
      qc.invalidateQueries({ queryKey: ["partners-rich"] });
    }
  };

  const copyPix = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave PIX copiada");
  };

  const exportCSV = () => {
    const rows = [
      ["Nome", "Email", "Telefone", "PIX", "% Padrão", "Clientes", "Produtos", "Comissão Total", "Pendente", "Status"],
      ...filtered.map((p: any) => [
        p.full_name, p.email ?? "", p.phone ?? "", p.pix_key ?? "",
        p.commission_percent, p._clientsCount, p._productsCount,
        p._total.toFixed(2), p._pending.toFixed(2), p.active ? "ativo" : "inativo",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `parceiros_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const clearFilters = () => { setSearch(""); setStatusFilter("todos"); setSortBy("commissions"); };
  const hasFilters = !!search || statusFilter !== "todos" || sortBy !== "commissions";

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">● ecosystem</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">PARTNER NETWORK</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Parceiros</h1>
          <p className="text-xs text-muted-foreground/60 font-medium leading-relaxed max-w-lg">
            Indicadores, vínculos com produtos e desempenho de comissões. Gerencie sua rede de indicações de alto nível.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 px-4 text-[10px] font-bold uppercase tracking-wider gap-2">
            <Download className="size-3.5" /> Exportar
          </Button>
          <Button size="sm" onClick={openNew} className="h-9 px-4 font-bold uppercase tracking-wider text-[10px] gap-2 shadow-lg shadow-primary/20">
            <Plus className="size-4" strokeWidth={3} /> Novo Parceiro
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users2} label="Parceiros" value={kpis.total} tone="primary" />
        <KpiCard icon={CheckCircle2} label="Ativos" value={kpis.active} tone="success" sub={`${kpis.total ? Math.round((kpis.active / kpis.total) * 100) : 0}% do total`} />
        <KpiCard icon={Users2} label="Indicações" value={kpis.totalClients} tone="info" />
        <KpiCard icon={Clock3} label="A pagar" value={formatBRL(kpis.totalPending)} tone="warning" />
        <KpiCard icon={Wallet} label="Comissões geradas" value={formatBRL(kpis.totalComms)} tone="primary" highlight />
      </div>

      {/* Filtros */}
      <div className="vx-card p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar parceiro por nome, email ou telefone..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="commissions">Maior comissão</SelectItem>
              <SelectItem value="clients">Mais indicações</SelectItem>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
              <X className="size-3" /> Limpar
            </Button>
          )}
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            <button onClick={() => setView("list")} className={`size-7 rounded flex items-center justify-center ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="size-3.5" />
            </button>
            <button onClick={() => setView("grid")} className={`size-7 rounded flex items-center justify-center ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground px-1">
        Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> de {enriched.length} parceiros
      </div>

      {filtered.length === 0 ? (
        <div className="vx-card py-20 text-center">
          <Users2 className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhum parceiro encontrado</p>
          <Button size="sm" onClick={hasFilters ? clearFilters : openNew} className="mt-4 gap-2">
            {hasFilters ? <><X className="size-4" /> Limpar</> : <><Plus className="size-4" /> Novo</>}
          </Button>
        </div>
      ) : view === "list" ? (
        <ListView
          partners={filtered} topIds={topIds}
          onDetail={setDrawerId} onEdit={openEdit} onDelete={handleDelete} onToggle={toggleActive} onCopyPix={copyPix}
        />
      ) : (
        <GridView
          partners={filtered} topIds={topIds}
          onDetail={setDrawerId} onEdit={openEdit} onDelete={handleDelete} onToggle={toggleActive}
        />
      )}

      {/* Form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Editar parceiro" : "Novo parceiro"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2"><Label>Nome completo *</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            
            <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border border-border/50 mt-2">
              <div className="col-span-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dados Financeiros</p></div>
              <div className="space-y-2"><Label>Chave PIX</Label><Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
              <div className="space-y-2"><Label>Banco</Label><Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Agência</Label><Input value={form.bank_agency ?? ""} onChange={(e) => setForm({ ...form, bank_agency: e.target.value })} /></div>
              <div className="space-y-2"><Label>Conta</Label><Input value={form.bank_account ?? ""} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de parceiro</Label>
              <Select value={form.partner_category} onValueChange={(v) => setForm({ ...form, partner_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicador">Indicador</SelectItem>
                  <SelectItem value="afiliado">Afiliado</SelectItem>
                  <SelectItem value="consultoria">Consultoria</SelectItem>
                  <SelectItem value="agencia">Agência</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>% Comissão padrão</Label><Input type="number" step="0.01" value={form.commission_percent ?? 10} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} /></div>
            
            <div className="space-y-2 flex flex-col justify-center">
              <Label className="mb-2">Acesso ao sistema</Label>
              <div className="flex items-center gap-2">
                <Switch checked={!!form.has_system_access} onCheckedChange={(v) => setForm({ ...form, has_system_access: v })} />
                <span className="text-xs text-muted-foreground">{form.has_system_access ? "Permitido" : "Bloqueado"}</span>
              </div>
            </div>
            <div className="space-y-2 flex flex-col justify-center">
              <Label className="mb-2">Status</Label>
              <div className="flex items-center gap-2">
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <span className="text-xs text-muted-foreground">{form.active ? "Ativo" : "Inativo"}</span>
              </div>
            </div>
            <div className="col-span-2 space-y-2"><Label>Observações internas</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-gradient-primary hover:opacity-90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartnerDetailDrawer partnerId={drawerId} open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)} />
    </div>
  );
}

/* ============ LIST VIEW ============ */
function ListView({ partners, topIds, onDetail, onEdit, onDelete, onToggle, onCopyPix }: any) {
  return (
    <div className="vx-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 text-left font-semibold">Parceiro</th>
              <th className="px-6 py-3 text-left font-semibold">Contato / PIX</th>
              <th className="px-6 py-3 text-right font-semibold">% / Produtos</th>
              <th className="px-6 py-3 text-right font-semibold">Indicações</th>
              <th className="px-6 py-3 text-right font-semibold">Comissões</th>
              <th className="px-6 py-3 text-center font-semibold w-32">Tendência (6m)</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-right font-semibold w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {partners.map((p: any) => {
              const rank = topIds.get(p.id);
              return (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-3.5">
                    <button onClick={() => onDetail(p.id)} className="flex items-center gap-3 text-left">
                      <div className="relative">
                        <div className="size-9 rounded-full bg-gradient-to-br from-warning/30 to-warning/10 text-warning flex items-center justify-center text-xs font-semibold ring-1 ring-warning/20">
                          {initials(p.full_name)}
                        </div>
                        {rank && <RankBadge rank={rank} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium group-hover:text-primary transition-colors truncate">{p.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">desde {formatDate(p.created_at)}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <p className="text-xs truncate flex items-center gap-1 text-muted-foreground">
                      {p.email ? <><Mail className="size-2.5" /> {p.email}</> : "—"}
                    </p>
                    {p.phone && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="size-2.5" /> {formatPhone(p.phone)}</p>}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <p className="vx-mono text-sm font-semibold">{formatPercent(p.commission_percent)}</p>
                    <button onClick={() => onDetail(p.id)} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5">
                      <Package className="size-2.5" /> {p._productsCount} produto{p._productsCount !== 1 ? "s" : ""}
                    </button>
                  </td>
                  <td className="px-6 py-3.5 text-right vx-mono text-sm">{p._clientsCount}</td>
                  <td className="px-6 py-3.5 text-right">
                    <p className="vx-mono text-sm font-semibold">{formatBRL(p._total)}</p>
                    {p._pending > 0 && (
                      <p className="text-[10px] text-warning vx-mono">A pagar: {formatBRL(p._pending)}</p>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <Sparkline data={p._spark} />
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${p.active ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"}`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {p.active ? "ativo" : "inativo"}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onDetail(p.id)} className="h-8 gap-1 text-xs">
                        Detalhes <ArrowUpRight className="size-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="size-8 rounded-md hover:bg-muted flex items-center justify-center">
                            <MoreHorizontal className="size-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-[10px] uppercase">{p.full_name}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEdit(p)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggle(p)}>
                            {p.active ? <><PowerOff className="size-3.5 mr-2" /> Desativar</> : <><Power className="size-3.5 mr-2" /> Ativar</>}
                          </DropdownMenuItem>
                          {p.pix_key && (
                            <DropdownMenuItem onClick={() => onCopyPix(p.pix_key)}>
                              <Copy className="size-3.5 mr-2" /> Copiar PIX
                            </DropdownMenuItem>
                          )}
                          {p.email && (
                            <DropdownMenuItem onClick={() => window.open(`mailto:${p.email}`)}>
                              <Mail className="size-3.5 mr-2" /> Enviar email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(p.id)} className="text-destructive">
                            <Trash2 className="size-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ GRID VIEW ============ */
function GridView({ partners, topIds, onDetail, onEdit, onDelete, onToggle }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {partners.map((p: any) => {
        const rank = topIds.get(p.id);
        return (
          <div key={p.id} className="vx-card p-4 hover:border-primary/40 hover:shadow-vx-md transition-all group">
            <div className="flex items-start gap-3">
              <button onClick={() => onDetail(p.id)} className="relative shrink-0">
                <div className="size-12 rounded-xl bg-gradient-to-br from-warning/30 to-warning/10 text-warning flex items-center justify-center text-sm font-semibold ring-1 ring-warning/20">
                  {initials(p.full_name)}
                </div>
                {rank && <RankBadge rank={rank} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onDetail(p.id)} className="text-left min-w-0">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">{p.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.email ?? formatPhone(p.phone) ?? "—"}</p>
                  </button>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${p.active ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {p.active ? "ativo" : "inativo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
              <Mini label="%" value={formatPercent(p.commission_percent)} />
              <Mini label="Produtos" value={p._productsCount} />
              <Mini label="Indicações" value={p._clientsCount} />
              <Mini label="Total" value={formatBRL(p._total)} highlight={p._total > 0} />
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Tendência 6m</p>
                <Sparkline data={p._spark} />
              </div>
              {p._pending > 0 && (
                <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                  {formatBRL(p._pending)} a pagar
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-end gap-1 mt-3">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEdit(p)}>
                <Pencil className="size-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onToggle(p)}>
                {p.active ? <PowerOff className="size-3" /> : <Power className="size-3" />}
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-primary" onClick={() => onDetail(p.id)}>
                Abrir <ArrowUpRight className="size-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ HELPERS ============ */
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0 || data.every((v) => v === 0)) {
    return <div className="h-6 flex items-center justify-center text-[10px] text-muted-foreground/60">sem dados</div>;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 88;
  const H = 24;
  const step = W / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${H - ((v - min) / range) * H}`).join(" ");
  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const trend = last >= prev ? "stroke-success" : "stroke-destructive";
  return (
    <svg width={W} height={H} className="overflow-visible mx-auto block">
      <polyline points={points} fill="none" className={trend} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={H - ((v - min) / range) * H} r={i === data.length - 1 ? 2 : 1} className={i === data.length - 1 ? trend.replace("stroke-", "fill-") : "fill-muted-foreground/40"} />
      ))}
    </svg>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const map: Record<number, { bg: string; icon: any }> = {
    1: { bg: "bg-warning text-warning-foreground", icon: Crown },
    2: { bg: "bg-muted-foreground text-background", icon: Award },
    3: { bg: "bg-warning/60 text-warning-foreground", icon: Award },
  };
  const { bg, icon: Icon } = map[rank];
  return (
    <div className={`absolute -top-1 -right-1 size-4 rounded-full flex items-center justify-center ${bg} ring-2 ring-background`} title={`Top ${rank} em comissões`}>
      <Icon className="size-2.5" />
    </div>
  );
}

function Mini({ label, value, highlight }: any) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">{label}</p>
      <p className={`text-[13px] font-bold tabular-nums mt-1 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, sub, highlight = false }: any) {
  const map: any = {
    primary: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/10" },
    success: { color: "text-success", bg: "bg-success/10", border: "border-success/10" },
    warning: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/10" },
    info: { color: "text-info", bg: "bg-info/10", border: "border-info/10" },
  };
  const t = map[tone] ?? map.primary;
  return (
    <div className={cn(
      "vx-card p-5 group transition-all duration-300", 
      highlight ? "border-primary/20 shadow-lg shadow-primary/5" : "hover:border-primary/10"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{label}</p>
          <div className="space-y-1">
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
            {sub && <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">{sub}</p>}
          </div>
        </div>
        <div className={cn("size-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110", t.bg, t.color)}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
