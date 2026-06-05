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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Briefcase, Plus, Search, ArrowUpRight, Star, Users2, ClipboardCheck,
  Mail, Phone, Link2, Pencil, LayoutGrid, List, Power, MoreHorizontal,
  CheckCircle2, Trash2, X, Download, KeyRound, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { initials, formatPhone, formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { ProviderFormDialog } from "@/components/provider/ProviderFormDialog";
import { ProviderAssignDialog } from "@/components/provider/ProviderAssignDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { CredentialsManager } from "@/components/CredentialsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ViewMode = "grid" | "list";
type SortKey = "name" | "specialty" | "active_demands" | "clients" | "revenue" | "rating" | "status";
type SortDir = "asc" | "desc";

const norm = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");

const IN_PROGRESS_STATUSES = new Set([
  "novo", "em_andamento", "em-andamento", "em andamento", "andamento",
  "pendente", "iniciado", "ativo", "execucao", "em_execucao", "aguardando",
]);
const DONE_STATUSES = new Set(["concluido", "concluida", "entregue", "finalizado", "finalizada"]);
const CANCELLED_STATUSES = new Set(["cancelado", "cancelada", "arquivado", "arquivada"]);

export default function Providers() {
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [view, setView] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("todas");
  const [accessFilter, setAccessFilter] = useState<"todos" | "com" | "sem">("todos");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [credRow, setCredRow] = useState<any>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, specialtyFilter, accessFilter, sortKey, sortDir]);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["providers-rich"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select(`
          *,
          client_products!client_products_service_provider_id_fkey(id, status, value, clients(id, full_name)),
          contracts(id, status)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enriched = useMemo(() => providers.map((p: any) => {
    const cps = p.client_products ?? [];
    const clientsSet = new Set<string>();
    let active = 0, done = 0, revenue = 0;
    cps.forEach((cp: any) => {
      const st = norm(cp.status);
      if (cp.clients?.id) clientsSet.add(cp.clients.id);
      revenue += Number(cp.value || 0);
      if (DONE_STATUSES.has(st)) done++;
      else if (CANCELLED_STATUSES.has(st)) { /* skip */ }
      else if (IN_PROGRESS_STATUSES.has(st) || !st) active++;
    });
    return {
      ...p,
      _activeCount: active,
      _doneCount: done,
      _clientsCount: clientsSet.size,
      _revenue: revenue,
      _contractsCount: p.contracts?.length ?? 0,
      _hasAccess: !!p.user_id,
    };
  }), [providers]);

  const specialties = useMemo(() => {
    const s = new Set<string>();
    enriched.forEach((p: any) => p.specialty && s.add(p.specialty));
    return Array.from(s).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = norm(debouncedSearch);
    const qDigits = onlyDigits(debouncedSearch);
    return enriched.filter((p: any) => {
      if (statusFilter === "ativos" && !p.active) return false;
      if (statusFilter === "inativos" && p.active) return false;
      if (specialtyFilter !== "todas" && p.specialty !== specialtyFilter) return false;
      if (accessFilter === "com" && !p._hasAccess) return false;
      if (accessFilter === "sem" && p._hasAccess) return false;
      if (q) {
        const hay = `${norm(p.name)} ${norm(p.email)} ${norm(p.specialty)}`;
        if (hay.includes(q)) return true;
        if (qDigits && (onlyDigits(p.phone).includes(qDigits) || onlyDigits(p.document_number).includes(qDigits))) return true;
        return false;
      }
      return true;
    });
  }, [enriched, statusFilter, specialtyFilter, accessFilter, debouncedSearch]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (p: any) => {
      switch (sortKey) {
        case "name": return norm(p.name);
        case "specialty": return norm(p.specialty);
        case "active_demands": return p._activeCount;
        case "clients": return p._clientsCount;
        case "revenue": return p._revenue;
        case "rating": return Number(p.internal_rating ?? -1);
        case "status": return p.active ? 1 : 0;
      }
    };
    arr.sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage]);

  const kpis = useMemo(() => {
    const withRevenue = enriched.filter((p: any) => p._revenue > 0);
    const totalRevenue = enriched.reduce((s: number, p: any) => s + p._revenue, 0);
    return {
      total: enriched.length,
      active: enriched.filter((p: any) => p.active).length,
      demands: enriched.reduce((s: number, p: any) => s + p._activeCount, 0),
      clients: new Set(enriched.flatMap((p: any) =>
        (p.client_products ?? []).map((cp: any) => cp.clients?.id).filter(Boolean))).size,
      avgTicket: withRevenue.length ? totalRevenue / withRevenue.length : 0,
    };
  }, [enriched]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleActive = async (p: any) => {
    if (p.active && p._activeCount > 0) {
      if (!(await confirmAction(`${p.name} possui ${p._activeCount} demanda(s) ativa(s). Desativar mesmo assim?`))) return;
    }
    const { error } = await supabase.from("service_providers").update({ active: !p.active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.active ? "Prestador desativado" : "Prestador ativado");
    qc.invalidateQueries();
  };

  const removeProvider = async (p: any) => {
    const demands = p.client_products?.length ?? 0;
    const contracts = p.contracts?.length ?? 0;
    if (demands + contracts > 0) {
      toast.error(
        `Não é possível excluir "${p.name}": ${demands} demanda(s) e ${contracts} contrato(s) vinculado(s). Desative em vez de excluir.`,
        { action: { label: "Desativar", onClick: () => toggleActive(p) } }
      );
      return;
    }
    if (!(await confirmAction(`Excluir definitivamente "${p.name}"? Esta ação é irreversível.`))) return;
    const { error } = await supabase.from("service_providers").delete().eq("id", p.id);
    if (error) { toast.error(error.message || "Não foi possível excluir."); return; }
    toast.success("Prestador excluído");
    qc.invalidateQueries();
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["providers-rich"] });
    qc.invalidateQueries({ queryKey: ["service-providers-active"] });
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("todos"); setSpecialtyFilter("todas"); setAccessFilter("todos");
  };
  const hasFilters = !!search || statusFilter !== "todos" || specialtyFilter !== "todas" || accessFilter !== "todos";

  const exportCsv = () => {
    const headers = ["Nome","Email","Telefone","Documento","Especialidade","Demandas ativas","Concluídas","Clientes","Receita","Avaliação","Status","Acesso ao painel","Criado em"];
    const rows = sorted.map((p: any) => [
      p.name ?? "",
      p.email ?? "",
      p.phone ?? "",
      p.document_number ?? "",
      p.specialty ?? "",
      p._activeCount,
      p._doneCount,
      p._clientsCount,
      Number(p._revenue || 0).toFixed(2),
      p.internal_rating != null ? Number(p.internal_rating).toFixed(1) : "",
      p.active ? "Ativo" : "Inativo",
      p._hasAccess ? "Sim" : "Não",
      p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => {
      const s = String(c ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestadores_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${sorted.length} prestador(es) exportado(s)`);
  };

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Network"
        category="Operação Externa"
        title="Prestadores de Serviço"
        description="Gerencie sua rede de fornecedores externos. Delegue demandas, controle entregas e acompanhe a operação terceirizada."
        icon={<Briefcase className="size-6" />}
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} className="h-9">
                <Download className="size-4 mr-1.5" /> Exportar
              </Button>
              <Button onClick={() => { setEditing(null); setCreateOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Novo Prestador
              </Button>
            </div>
          )
        }
        kpis={[
          { label: "Total da Rede", value: kpis.total, tone: "primary", icon: <Briefcase className="size-4" /> },
          { label: "Ativos", value: kpis.active, tone: "success", icon: <CheckCircle2 className="size-4" />, onClick: () => setStatusFilter(statusFilter === "ativos" ? "todos" : "ativos") },
          { label: "Demandas em curso", value: kpis.demands, tone: "info", icon: <ClipboardCheck className="size-4" /> },
          { label: "Clientes atendidos", value: kpis.clients, tone: "primary", icon: <Users2 className="size-4" /> },
          { label: "Ticket médio", value: formatBRL(kpis.avgTicket), tone: "primary" },
        ]}
      />

      <div className="px-5 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome, email, especialidade, telefone ou documento..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-md bg-white border-slate-200/70"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-10 w-[180px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas especialidades</SelectItem>
              {specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-10 w-[130px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={(v) => setAccessFilter(v as any)}>
            <SelectTrigger className="h-10 w-[160px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos acessos</SelectItem>
              <SelectItem value="com">Com acesso ao painel</SelectItem>
              <SelectItem value="sem">Sem acesso ao painel</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-white border border-slate-200/70 rounded-md p-1">
            <button onClick={() => setView("grid")} className={cn("size-8 rounded flex items-center justify-center transition-colors", view === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>
              <LayoutGrid className="size-4" />
            </button>
            <button onClick={() => setView("list")} className={cn("size-8 rounded flex items-center justify-center transition-colors", view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="px-5 lg:px-8 flex items-center gap-2 flex-wrap">
          {search && <FilterChip label={`Busca: "${search}"`} onClear={() => setSearch("")} />}
          {statusFilter !== "todos" && <FilterChip label={`Status: ${statusFilter}`} onClear={() => setStatusFilter("todos")} />}
          {specialtyFilter !== "todas" && <FilterChip label={`Especialidade: ${specialtyFilter}`} onClear={() => setSpecialtyFilter("todas")} />}
          {accessFilter !== "todos" && <FilterChip label={`Acesso: ${accessFilter === "com" ? "com painel" : "sem painel"}`} onClear={() => setAccessFilter("todos")} />}
          <button onClick={clearFilters} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 ml-1">Limpar tudo</button>
        </div>
      )}

      <div className="px-5 lg:px-8 pb-10">
        {isLoading ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 rounded-lg bg-white border border-slate-200/70 shadow-sm animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          )
        ) : sorted.length === 0 ? (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-16 text-center">
            <Briefcase className="size-12 mx-auto text-slate-300 mb-4" />
            <p className="font-display text-lg text-slate-700">
              {hasFilters ? "Nenhum prestador bate com os filtros" : "Nenhum prestador cadastrado"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {hasFilters ? "Ajuste ou limpe os filtros para ver outros resultados." : "Cadastre fornecedores externos para delegar entregas e atendimentos."}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters} className="mt-5">Limpar filtros</Button>
            ) : canManage && (
              <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Cadastrar primeiro prestador
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {paginated.map((p: any) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  canManage={canManage}
                  onDetail={() => navigate(`/prestadores/${p.id}`)}
                  onEdit={() => { setEditing(p); setCreateOpen(true); }}
                  onAssign={() => { setAssignTarget(p); setAssignOpen(true); }}
                  onToggle={() => toggleActive(p)}
                  onDelete={() => removeProvider(p)}
                  onCredentials={() => setCredRow(p)}
                />
              ))}
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={itemsPerPage}
              className="mt-6 bg-white border border-slate-200/70 rounded-lg"
            />
          </>
        ) : (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/70 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <SortableTh label="Prestador" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Especialidade" k="specialty" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Demandas" k="active_demands" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <SortableTh label="Clientes" k="clients" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <SortableTh label="Receita" k="revenue" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Avaliação" k="rating" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {paginated.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/prestadores/${p.id}`)}>
                          <div className="size-9 rounded-md bg-indigo-50 text-indigo-700 border border-slate-200/70 flex items-center justify-center font-semibold text-xs">
                            {initials(p.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors flex items-center gap-1.5 truncate">
                              {p.name}
                              {p._hasAccess && <KeyRound className="size-3 text-emerald-600 shrink-0" aria-label="Tem acesso ao painel" />}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{p.email || formatPhone(p.phone) || "Sem contato"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {p.specialty ? <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-700">{p.specialty}</Badge> : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <p className="font-semibold tabular-nums text-slate-800 font-mono">{p._activeCount}</p>
                        <p className="text-[10px] text-slate-400">{p._doneCount} concluídas</p>
                      </td>
                      <td className="px-5 py-3 text-center font-semibold tabular-nums text-slate-800 font-mono">{p._clientsCount}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-800 font-mono">{formatBRL(p._revenue)}</td>
                      <td className="px-5 py-3 text-center">
                        {p.internal_rating != null ? (
                          <div className="inline-flex items-center gap-1 text-amber-600">
                            <Star className="size-3.5 fill-current" />
                            <span className="font-semibold tabular-nums font-mono">{Number(p.internal_rating).toFixed(1)}</span>
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge className={cn("text-[10px] border", p.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <Button size="sm" variant="outline" onClick={() => { setAssignTarget(p); setAssignOpen(true); }} className="h-8 text-xs">
                              <Link2 className="size-3 mr-1" /> Delegar
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/prestadores/${p.id}`)}><ArrowUpRight className="size-4 mr-2" /> Ver perfil</DropdownMenuItem>
                              {canManage && <DropdownMenuItem onClick={() => { setEditing(p); setCreateOpen(true); }}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>}
                              {canManage && <DropdownMenuSeparator />}
                              {canManage && <DropdownMenuItem onClick={() => toggleActive(p)}><Power className="size-4 mr-2" /> {p.active ? "Desativar" : "Ativar"}</DropdownMenuItem>}
                              {canManage && <DropdownMenuItem onClick={() => setCredRow(p)}><KeyRound className="size-4 mr-2" /> Alterar e-mail/senha</DropdownMenuItem>}
                              {canManage && (
                                <DropdownMenuItem onClick={() => removeProvider(p)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="size-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              )}
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
              totalItems={sorted.length}
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

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-medium text-indigo-700">
      {label}
      <button onClick={onClear} className="hover:bg-indigo-100 rounded-full p-0.5"><X className="size-3" /></button>
    </span>
  );
}

function SortableTh({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;
  return (
    <th className={cn("px-5 py-3 select-none", align === "center" && "text-center", align === "right" && "text-right")}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-slate-700 transition-colors", active && "text-indigo-700")}>
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

function ProviderCard({ provider, canManage, onDetail, onEdit, onAssign, onToggle, onDelete, onCredentials }: any) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200/70 bg-white shadow-sm p-5 hover:border-indigo-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4 gap-3">
        <button onClick={onDetail} className="flex items-center gap-3 min-w-0 text-left flex-1">
          <div className="size-11 rounded-md bg-indigo-50 text-indigo-700 border border-slate-200/70 flex items-center justify-center font-semibold shrink-0">
            {initials(provider.name)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors flex items-center gap-1.5">
              {provider.name}
              {provider._hasAccess && <KeyRound className="size-3 text-emerald-600 shrink-0" aria-label="Tem acesso ao painel" />}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {provider.specialty && <Badge variant="outline" className="text-[9.5px] bg-slate-50 border-slate-200 text-slate-700">{provider.specialty}</Badge>}
              <Badge className={cn("text-[9.5px] border", provider.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                {provider.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </button>
        {provider.internal_rating != null && (
          <div className="inline-flex items-center gap-0.5 text-amber-600 text-[11px] font-semibold shrink-0">
            <Star className="size-3 fill-current" />
            <span className="font-mono">{Number(provider.internal_rating).toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="space-y-1 text-[11.5px] text-slate-500 mb-4 min-h-[36px]">
        {provider.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3 shrink-0" /> {provider.email}</div>}
        {provider.phone && <div className="flex items-center gap-1.5"><Phone className="size-3 shrink-0" /> {formatPhone(provider.phone)}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200/70">
        <Stat label="Em curso" value={provider._activeCount} />
        <Stat label="Clientes" value={provider._clientsCount} />
        <Stat label="Receita" value={formatBRL(provider._revenue)} small />
      </div>

      <div className="flex items-center gap-2 mt-4">
        {canManage ? (
          <>
            <Button size="sm" onClick={onAssign} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Link2 className="size-3.5 mr-1.5" /> Delegar demanda
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit} className="px-2"><Pencil className="size-3.5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="px-2"><MoreHorizontal className="size-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDetail}><ArrowUpRight className="size-4 mr-2" /> Ver perfil</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggle}><Power className="size-4 mr-2" /> {provider.active ? "Desativar" : "Ativar"}</DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="size-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={onDetail} className="flex-1">
            <ArrowUpRight className="size-3.5 mr-1.5" /> Ver perfil
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <div className="p-2 rounded-md text-center bg-slate-50 border border-slate-200/70">
      <p className={cn("font-semibold font-mono leading-none text-slate-800", small ? "text-[11px]" : "text-[14px]")}>{value}</p>
      <p className="text-[9px] uppercase font-semibold tracking-wider text-slate-500 mt-1">{label}</p>
    </div>
  );
}
