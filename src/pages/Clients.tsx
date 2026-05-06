import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, MoreHorizontal, Eye, Trash2, Users, UserCheck, UserPlus,
  TrendingUp, LayoutGrid, List, SlidersHorizontal, Download, Mail, Phone,
  Building2, Tag, Sparkles, ArrowUpRight, Crown, X,
} from "lucide-react";
import { formatDate, formatBRL, initials, formatPhone, timeAgo } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ViewMode = "list" | "grid";
type StatusFilter = "todos" | "ativo" | "prospecto" | "inativo";
type SortKey = "recent" | "name" | "revenue" | "sales";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [partnerFilter, setPartnerFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients-rich"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id, full_name, email, phone, company, status, created_at, tags, city, state,
          partner_id, partners(id, full_name),
          sales(id, amount, status, sale_date)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enriched = useMemo(() => {
    return (clients ?? []).map((c: any) => {
      const sales = c.sales ?? [];
      const ltv = sales.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
      const paid = sales
        .filter((x: any) => x.status === "pago")
        .reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
      const lastSale = sales
        .map((x: any) => x.sale_date)
        .sort()
        .reverse()[0];
      return {
        ...c,
        _ltv: ltv,
        _paid: paid,
        _salesCount: sales.length,
        _lastSale: lastSale,
        _isVip: ltv >= 50000,
      };
    });
  }, [clients]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c: any) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q),
      );
    }
    if (statusFilter !== "todos") list = list.filter((c: any) => c.status === statusFilter);
    if (partnerFilter === "sem") list = list.filter((c: any) => !c.partner_id);
    else if (partnerFilter !== "todos") list = list.filter((c: any) => c.partner_id === partnerFilter);

    const sorted = [...list];
    if (sortBy === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sortBy === "revenue") sorted.sort((a, b) => b._ltv - a._ltv);
    else if (sortBy === "sales") sorted.sort((a, b) => b._salesCount - a._salesCount);
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [enriched, search, statusFilter, partnerFilter, sortBy]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "ativo").length;
    const prospects = enriched.filter((c: any) => c.status === "prospecto").length;
    const totalLTV = enriched.reduce((s: number, c: any) => s + c._ltv, 0);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = enriched.filter((c: any) => new Date(c.created_at) >= startMonth).length;
    return { total, active, prospects, totalLTV, newThisMonth };
  }, [enriched]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente? Vendas e documentos vinculados serão removidos.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clients-rich"] });
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Nome", "Email", "Telefone", "Empresa", "Status", "Parceiro", "Vendas", "LTV", "Cadastro"],
      ...filtered.map((c: any) => [
        c.full_name,
        c.email ?? "",
        c.phone ?? "",
        c.company ?? "",
        c.status,
        c.partners?.full_name ?? "",
        c._salesCount,
        c._ltv.toFixed(2),
        formatDate(c.created_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("todos");
    setPartnerFilter("todos");
    setSortBy("recent");
  };
  const hasFilters = !!search || statusFilter !== "todos" || partnerFilter !== "todos" || sortBy !== "recent";

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-5">
      <PageHeader
        title="Clientes"
        description="Carteira completa: contatos, indicações, faturamento e ciclo de vida."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
              <Download className="size-4" /> Exportar
            </Button>
            <Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90">
              <Plus className="size-4" /> Novo Cliente
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Total" value={kpis.total} tone="primary" />
        <KpiCard icon={UserCheck} label="Ativos" value={kpis.active} tone="success" sub={`${kpis.total ? Math.round((kpis.active / kpis.total) * 100) : 0}% da carteira`} />
        <KpiCard icon={Sparkles} label="Prospectos" value={kpis.prospects} tone="warning" />
        <KpiCard icon={UserPlus} label="Novos no mês" value={kpis.newThisMonth} tone="info" />
        <KpiCard icon={TrendingUp} label="LTV total" value={formatBRL(kpis.totalLTV)} tone="primary" highlight />
      </div>

      {/* Filtros + view toggle */}
      <div className="vx-card p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, empresa ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="prospecto">Prospectos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos parceiros</SelectItem>
              <SelectItem value="sem">Sem indicação</SelectItem>
              {partnersList.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SlidersHorizontal className="size-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
              <SelectItem value="revenue">Maior receita</SelectItem>
              <SelectItem value="sales">Mais vendas</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
              <X className="size-3" /> Limpar
            </Button>
          )}
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            <button
              onClick={() => setView("list")}
              className={`size-7 rounded flex items-center justify-center transition ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Lista"
            >
              <List className="size-3.5" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`size-7 rounded flex items-center justify-center transition ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Cartões"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> de {enriched.length} clientes
        </span>
        {filtered.length > 0 && sortBy === "revenue" && (
          <span className="flex items-center gap-1"><Crown className="size-3 text-warning" /> Ordenado por LTV</span>
        )}
      </div>

      {isLoading ? (
        <div className="vx-card py-20 text-center text-muted-foreground text-sm">Carregando carteira...</div>
      ) : filtered.length === 0 ? (
        <div className="vx-card py-20 text-center">
          <Users className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhum cliente encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasFilters ? "Tente ajustar os filtros" : "Cadastre seu primeiro cliente"}
          </p>
          <Button size="sm" onClick={hasFilters ? clearFilters : () => setOpen(true)} className="mt-4 gap-2">
            {hasFilters ? <><X className="size-4" /> Limpar filtros</> : <><Plus className="size-4" /> Novo Cliente</>}
          </Button>
        </div>
      ) : view === "list" ? (
        <ListView clients={filtered} onOpen={(id) => navigate(`/clientes/${id}`)} onDelete={handleDelete} />
      ) : (
        <GridView clients={filtered} onOpen={(id) => navigate(`/clientes/${id}`)} onDelete={handleDelete} />
      )}

      <ClientFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["clients-rich"] })} />
    </div>
  );
}

/* ============ LIST VIEW ============ */
function ListView({ clients, onOpen, onDelete }: any) {
  return (
    <div className="vx-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 text-left font-semibold">Cliente</th>
              <th className="px-6 py-3 text-left font-semibold">Produto / Status</th>
              <th className="px-6 py-3 text-left font-semibold">Origem / Indicação</th>
              <th className="px-6 py-3 text-left font-semibold">Responsável</th>
              <th className="px-6 py-3 text-right font-semibold">Valor Vendido</th>
              <th className="px-6 py-3 text-left font-semibold">Financeiro</th>
              <th className="px-6 py-3 text-left font-semibold">Documentos</th>
              <th className="px-6 py-3 text-right font-semibold w-12">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.map((c: any) => (
              <tr
                key={c.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => onOpen(c.id)}
              >
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold ring-1 ring-border">
                        {initials(c.full_name)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate group-hover:text-primary transition-colors">{c.full_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <p className="text-[11px] font-bold text-foreground">Gestão Financeira</p>
                  <StatusPill status={c.status} />
                </td>
                <td className="px-6 py-3.5">
                  <p className="text-[11px] font-medium capitalize">{c.source?.replace("_", " ") || "Manual"}</p>
                  <p className="text-[10px] text-muted-foreground">{c.partners?.full_name || "Direto"}</p>
                </td>
                <td className="px-6 py-3.5 text-sm font-medium">
                  {c.collaborators?.full_name || "Douglas"}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <p className="vx-mono font-bold">{formatBRL(c.sale_value || 0)}</p>
                </td>
                <td className="px-6 py-3.5">
                   <Badge variant="outline" className="text-[10px] uppercase bg-emerald-50 text-emerald-600 border-emerald-100">Confirmado</Badge>
                </td>
                <td className="px-6 py-3.5">
                   <Badge variant="outline" className="text-[10px] uppercase bg-blue-50 text-blue-600 border-blue-100">7/12</Badge>
                </td>
                <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="size-8 rounded-md hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="size-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel className="text-[10px] uppercase">{c.full_name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpen(c.id)}>
                        <Eye className="size-3.5 mr-2" /> Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Pencil className="size-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Plus className="size-3.5 mr-2" /> Adicionar produto
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Plus className="size-3.5 mr-2" /> Criar tarefa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onDelete(c.id)} className="text-destructive">
                        <Trash2 className="size-3.5 mr-2" /> Desativar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ GRID VIEW ============ */
function GridView({ clients, onOpen, onDelete }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {clients.map((c: any) => (
        <div
          key={c.id}
          className="vx-card p-4 hover:border-primary/40 hover:shadow-vx-md transition-all cursor-pointer group"
          onClick={() => onOpen(c.id)}
        >
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="size-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-sm font-semibold ring-1 ring-primary/10">
                {initials(c.full_name)}
              </div>
              {c._isVip && (
                <div className="absolute -top-1 -right-1 size-4 rounded-full bg-warning text-warning-foreground flex items-center justify-center">
                  <Crown className="size-2.5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{c.full_name}</p>
                  {c.company && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><Building2 className="size-2.5" /> {c.company}</p>}
                </div>
                <StatusPill status={c.status} />
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground truncate">
                {c.email && <span className="truncate">{c.email}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
            <Mini label="Vendas" value={c._salesCount} />
            <Mini label="LTV" value={c._ltv > 0 ? formatBRL(c._ltv) : "—"} highlight={c._ltv > 0} />
            <Mini label="Última" value={c._lastSale ? timeAgo(c._lastSale) : "Nunca"} muted />
          </div>

          {(c.tags?.length > 0 || c.partners) && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {c.partners && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  via {c.partners.full_name}
                </Badge>
              )}
              {(c.tags ?? []).slice(0, 3).map((t: string) => (
                <Badge key={t} variant="outline" className="text-[10px] font-normal gap-1">
                  <Tag className="size-2" /> {t}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onOpen(c.id)}>
              Ver perfil <ArrowUpRight className="size-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ HELPERS ============ */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo: "bg-success-muted text-success",
    prospecto: "bg-warning-muted text-warning",
    inativo: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Mini({ label, value, highlight, muted }: any) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-xs vx-mono font-semibold mt-0.5 ${highlight ? "text-primary" : muted ? "text-muted-foreground" : ""}`}>{value}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, sub, highlight = false }: any) {
  const map: any = {
    primary: { color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20" },
    success: { color: "text-success", bg: "bg-success-muted", ring: "ring-success/20" },
    warning: { color: "text-warning", bg: "bg-warning-muted", ring: "ring-warning/20" },
    info: { color: "text-info", bg: "bg-info-muted", ring: "ring-info/20" },
  };
  const t = map[tone] ?? map.primary;
  return (
    <div className={`vx-card p-3.5 ${highlight ? `ring-1 ${t.ring}` : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="font-display text-xl font-bold vx-mono mt-1 truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`size-8 rounded-md flex items-center justify-center ${t.bg} ${t.color}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
