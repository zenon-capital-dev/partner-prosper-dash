import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Briefcase, Plus, Search, ArrowUpRight, Star, Users2, Package, ClipboardCheck,
  Mail, Phone, Link2, Pencil, LayoutGrid, List, Power, MoreHorizontal,
  CheckCircle2, AlertCircle, TrendingUp, Trash2,
} from "lucide-react";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { initials, formatPhone } from "@/lib/format";
import { toast } from "sonner";
import { ProviderFormDialog } from "@/components/provider/ProviderFormDialog";
import { ProviderAssignDialog } from "@/components/provider/ProviderAssignDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PaginationControl } from "@/components/ui/PaginationControl";

type ViewMode = "grid" | "list";

export default function Providers() {
  const { isAdmin, isAdminSecondary } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [view, setView] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("todas");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, specialtyFilter]);

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-rich"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select(`
          *,
          client_products(id, status, value, clients(id, full_name)),
          contracts(id, status)
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const enriched = useMemo(() => providers.map((p: any) => {
    const cps = p.client_products ?? [];
    const clientsSet = new Set<string>();
    let active = 0, done = 0, late = 0, revenue = 0;
    cps.forEach((cp: any) => {
      if (cp.clients?.id) clientsSet.add(cp.clients.id);
      revenue += Number(cp.value || 0);
      if (["concluido", "concluida", "entregue"].includes(cp.status)) done++;
      else active++;
    });
    return { ...p, _activeCount: active, _doneCount: done, _clientsCount: clientsSet.size, _revenue: revenue, _contractsCount: p.contracts?.length ?? 0 };
  }), [providers]);

  const specialties = useMemo(() => {
    const s = new Set<string>();
    enriched.forEach((p: any) => p.specialty && s.add(p.specialty));
    return Array.from(s).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((p: any) => {
      if (statusFilter === "ativos" && !p.active) return false;
      if (statusFilter === "inativos" && p.active) return false;
      if (specialtyFilter !== "todas" && p.specialty !== specialtyFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${p.name ?? ""} ${p.email ?? ""} ${p.specialty ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [enriched, statusFilter, specialtyFilter, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const kpis = useMemo(() => ({
    total: enriched.length,
    active: enriched.filter((p: any) => p.active).length,
    demands: enriched.reduce((s: number, p: any) => s + p._activeCount, 0),
    clients: new Set(enriched.flatMap((p: any) => (p.client_products ?? []).map((cp: any) => cp.clients?.id).filter(Boolean))).size,
  }), [enriched]);

  const toggleActive = async (p: any) => {
    const { error } = await supabase.from("service_providers").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.active ? "Prestador desativado" : "Prestador ativado"); qc.invalidateQueries({ queryKey: ["providers-rich"] }); }
  };

  const removeProvider = async (p: any) => {
    const refs = (p.client_products?.length ?? 0) + (p.contracts?.length ?? 0);
    if (refs > 0) {
      toast.error(
        `Não é possível excluir: existem ${refs} vínculo(s) (demandas/contratos). Desative o prestador em vez de excluir.`
      );
      return;
    }
    if (!(await confirmAction(`Excluir definitivamente "${p.name}"? Esta ação é irreversível.`))) return;
    const { error } = await supabase.from("service_providers").delete().eq("id", p.id);
    if (error) {
      toast.error("Não foi possível excluir. Há vínculos no sistema — desative em vez de excluir.");
      return;
    }
    toast.success("Prestador excluído");
    qc.invalidateQueries({ queryKey: ["providers-rich"] });
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["providers-rich"] });

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Network"
        category="Operação Externa"
        title="Prestadores de Serviço"
        description="Gerencie sua rede de fornecedores externos. Delegue demandas, controle entregas e acompanhe a operação terceirizada."
        icon={<Briefcase className="size-6" />}
        actions={
          (isAdmin || isAdminSecondary) && (
            <Button onClick={() => { setEditing(null); setCreateOpen(true); }} className="bg-gradient-to-r from-indigo-500 via-indigo-500 to-indigo-600 text-white shadow-xl">
              <Plus className="size-4 mr-1.5" /> Novo Prestador
            </Button>
          )
        }
        kpis={[
          { label: "Total da Rede", value: kpis.total, tone: "primary", icon: <Briefcase className="size-4" /> },
          { label: "Ativos", value: kpis.active, tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Demandas em curso", value: kpis.demands, tone: "info", icon: <ClipboardCheck className="size-4" /> },
          { label: "Clientes atendidos", value: kpis.clients, tone: "primary", icon: <Users2 className="size-4" /> },
        ]}
      />

      <div className="px-5 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou especialidade..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={specialtyFilter} onValueChange={(v) => setSpecialtyFilter(v)}>
            <SelectTrigger className="h-11 w-[170px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas especialidades</SelectItem>
              {specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-11 w-[130px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-muted/30 border border-border rounded-xl p-1">
            <button onClick={() => setView("grid")} className={cn("size-9 rounded-lg flex items-center justify-center transition-colors", view === "grid" ? "bg-card shadow text-foreground" : "text-muted-foreground")}>
              <LayoutGrid className="size-4" />
            </button>
            <button onClick={() => setView("list")} className={cn("size-9 rounded-lg flex items-center justify-center transition-colors", view === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground")}>
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-8 pb-10">
        {filtered.length === 0 ? (
          <div className="vx-card p-16 text-center">
            <Briefcase className="size-14 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-display text-lg">Nenhum prestador cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">Cadastre fornecedores externos para delegar entregas e atendimentos.</p>
            <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
              <Plus className="size-4 mr-1.5" /> Cadastrar primeiro prestador
            </Button>
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {paginated.map((p: any) => (
                <ProviderCard key={p.id}
                  provider={p}
                  onDetail={() => navigate(`/prestadores/${p.id}`)}
                  onEdit={() => { setEditing(p); setCreateOpen(true); }}
                  onAssign={() => { setAssignTarget(p); setAssignOpen(true); }}
                  onToggle={() => toggleActive(p)}
                />
              ))}
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
              className="mt-6 border rounded-xl"
            />
          </>
        ) : (
          <div className="vx-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="px-5 py-4 text-left">Prestador</th>
                    <th className="px-5 py-4 text-left">Especialidade</th>
                    <th className="px-5 py-4 text-center">Demandas</th>
                    <th className="px-5 py-4 text-center">Clientes</th>
                    <th className="px-5 py-4 text-center">Avaliação</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/prestadores/${p.id}`)}>
                          <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-500/20">
                            {initials(p.name)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{p.email || formatPhone(p.phone) || "Sem contato"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {p.specialty ? <Badge variant="outline" className="text-[10px]">{p.specialty}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className="font-bold tabular-nums">{p._activeCount}</p>
                        <p className="text-[10px] text-muted-foreground">{p._doneCount} concluídas</p>
                      </td>
                      <td className="px-5 py-4 text-center font-bold tabular-nums">{p._clientsCount}</td>
                      <td className="px-5 py-4 text-center">
                        {p.internal_rating != null ? (
                          <div className="inline-flex items-center gap-1 text-amber-600">
                            <Star className="size-3.5 fill-current" />
                            <span className="font-bold tabular-nums">{Number(p.internal_rating).toFixed(1)}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Badge className={cn("text-[10px]", p.active ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground")}>
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setAssignTarget(p); setAssignOpen(true); }} className="h-8 text-xs">
                            <Link2 className="size-3 mr-1" /> Delegar
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/prestadores/${p.id}`)}><ArrowUpRight className="size-4 mr-2" /> Ver perfil</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditing(p); setCreateOpen(true); }}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleActive(p)}><Power className="size-4 mr-2" /> {p.active ? "Desativar" : "Ativar"}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => removeProvider(p)} className="text-destructive focus:text-destructive">
                                <Trash2 className="size-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>

      <ProviderFormDialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditing(null); }} provider={editing} onSuccess={refresh} />
      {assignTarget && (
        <ProviderAssignDialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setAssignTarget(null); }} providerId={assignTarget.id} providerName={assignTarget.name} onSuccess={refresh} />
      )}
    </div>
  );
}

function ProviderCard({ provider, onDetail, onEdit, onAssign, onToggle }: any) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-xl transition-all">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-4">
        <button onClick={onDetail} className="flex items-center gap-3 min-w-0 text-left">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 text-indigo-600 flex items-center justify-center font-bold border border-indigo-500/20 shrink-0">
            {initials(provider.name)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{provider.name}</p>
            {provider.specialty && <Badge variant="outline" className="text-[9.5px] mt-1">{provider.specialty}</Badge>}
          </div>
        </button>
        <div className="flex items-center gap-1.5">
          {provider.internal_rating != null && (
            <div className="inline-flex items-center gap-0.5 text-amber-500 text-[11px] font-bold">
              <Star className="size-3 fill-current" />
              {Number(provider.internal_rating).toFixed(1)}
            </div>
          )}
          <Switch checked={!!provider.active} onCheckedChange={onToggle} className="scale-75" />
        </div>
      </div>

      <div className="space-y-1.5 text-[11.5px] text-muted-foreground mb-4">
        {provider.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3 shrink-0" /> {provider.email}</div>}
        {provider.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" /> {formatPhone(provider.phone)}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
        <Stat label="Em curso" value={provider._activeCount} tone="info" />
        <Stat label="Clientes" value={provider._clientsCount} tone="primary" />
        <Stat label="Concluídas" value={provider._doneCount} tone="success" />
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" onClick={onAssign} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow">
          <Link2 className="size-3.5 mr-1.5" /> Delegar demanda
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="px-2"><Pencil className="size-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={onDetail} className="px-2"><ArrowUpRight className="size-3.5" /></Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  const colors: any = {
    primary: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-500/10",
  };
  return (
    <div className={cn("p-2 rounded-xl text-center", colors[tone] || "bg-muted")}>
      <p className="text-[14px] font-bold font-mono leading-none">{value}</p>
      <p className="text-[9px] uppercase font-bold tracking-wider opacity-60 mt-1">{label}</p>
    </div>
  );
}
