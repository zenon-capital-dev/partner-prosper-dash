import { useEffect, useState, useMemo } from "react";
import { subDays, startOfMonth, startOfToday, endOfDay } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Target, Search, Plus, MoreHorizontal, UserPlus, Phone, Mail, MessageSquare,
  Trash2, Pencil, LayoutGrid, List, Upload, CalendarClock, Sparkles, CheckCircle2,
  X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, formatPhone, initials } from "@/lib/format";
import { onlyDigits } from "@/lib/masks";
import { LeadFormDialog } from "@/components/leads/LeadFormDialog";
import { LeadsPipeline } from "@/components/leads/LeadsPipeline";
import { LeadsCsvImport } from "@/components/leads/LeadsCsvImport";
import { LeadFollowUpDialog } from "@/components/leads/LeadFollowUpDialog";
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { PageHero } from "@/components/PageHero";
import { cn } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { EmptyState } from "@/components/EmptyState";

const STATUS_TONE: Record<string, string> = {
  "Novo": "bg-sky-50 text-sky-700 border-sky-200",
  "Primeiro contato": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Diagnóstico": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Proposta enviada": "bg-violet-50 text-violet-700 border-violet-200",
  "Negociação": "bg-orange-50 text-orange-700 border-orange-200",
  "Contrato enviado": "bg-amber-50 text-amber-700 border-amber-200",
  "Fechado": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Perdido": "bg-rose-50 text-rose-700 border-rose-200",
};

const OPEN_STATUSES = new Set([
  "Novo", "Primeiro contato", "Diagnóstico", "Proposta enviada",
  "Negociação", "Contrato enviado",
]);

const PAGE_SIZE = 25;
type SortKey = "name" | "status" | "source" | "created";
type SortDir = "asc" | "desc";

export default function Leads() {
  const { isAdmin, isAdminSecondary } = useAuth();
  const canWrite = isAdmin || isAdminSecondary;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("TUDO");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [csvOpen, setCsvOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<any>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, rangeKey, statusFilter, view, sortKey, sortDir]);

  const openFollowUp = (lead: any) => {
    setFollowUpLead(lead);
    setFollowUpOpen(true);
  };

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          products(name),
          partners(full_name),
          profiles:responsible_id(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredLeads = useMemo(() => {
    const today = startOfToday();
    let start = today;
    let end = endOfDay(today);
    if (rangeKey === "7 DIAS") start = subDays(today, 6);
    else if (rangeKey === "30 DIAS") start = subDays(today, 29);
    else if (rangeKey === "MÊS") start = startOfMonth(today);
    else if (rangeKey === "TUDO") { start = new Date(0); end = new Date(8640000000000000); }

    const q = debouncedSearch.trim().toLowerCase();
    const qDigits = onlyDigits(debouncedSearch);

    return leads.filter((l: any) => {
      const createdAt = new Date(l.created_at);
      if (rangeKey !== "TUDO" && (createdAt < start || createdAt > end)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (!q) return true;
      const phoneDigits = onlyDigits(l.phone || "") + " " + onlyDigits(l.whatsapp || "");
      const hay = [
        l.full_name, l.email, l.company, l.source,
        l.products?.name, l.partners?.full_name, l.profiles?.full_name, l.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      if (qDigits && phoneDigits.includes(qDigits)) return true;
      return false;
    });
  }, [leads, debouncedSearch, rangeKey, statusFilter]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    const mult = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name": av = (a.full_name || "").toLowerCase(); bv = (b.full_name || "").toLowerCase(); break;
        case "status": av = a.status || ""; bv = b.status || ""; break;
        case "source": av = (a.source || "").toLowerCase(); bv = (b.source || "").toLowerCase(); break;
        case "created": av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); break;
      }
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
    return arr;
  }, [filteredLeads, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedLeads = useMemo(
    () => sortedLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedLeads, currentPage]
  );

  const stats = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l: any) => l.status === "Novo").length;
    const emAndamento = leads.filter((l: any) => OPEN_STATUSES.has(l.status) && l.status !== "Novo").length;
    const fechados = leads.filter((l: any) => l.status === "Fechado").length;
    return { total, novos, emAndamento, fechados };
  }, [leads]);

  const handleEdit = (lead: any) => { setSelectedLead(lead); setOpen(true); };
  const handleNew = () => { setSelectedLead(null); setOpen(true); };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction("Excluir este lead permanentemente? Histórico e propostas vinculadas serão removidos."))) return;
    try {
      await supabase.from("lead_history").delete().eq("lead_id", id);
      await supabase.from("proposals").delete().eq("lead_id", id);
    } catch (e) { console.error("Erro ao limpar dependências do lead", e); }
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lead excluído");
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
  };

  const convertToClient = (lead: any) => { setConvertLead(lead); setConvertOpen(true); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "created" ? "desc" : "asc"); }
  };

  const SortHeader = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={cn("px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500", className)}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors">
        {label}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );

  const hasActiveFilters = !!debouncedSearch || rangeKey !== "TUDO" || !!statusFilter;

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans animate-in fade-in duration-500 admin-shell">
      <PageHero
        eyebrow="CRM"
        category="Sales Pipeline"
        title="Leads / Convidados"
        description="Gerencie potenciais clientes e indicações em um só lugar."
        icon={<Target className="size-6" />}
        actions={
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 max-w-full pb-1">
            <div className="flex bg-white p-1 rounded-lg border border-slate-200/70 shadow-sm shrink-0">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase whitespace-nowrap",
                    rangeKey === k ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-slate-200/70 bg-white p-0.5 shrink-0 shadow-sm">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 h-8 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap",
                  view === "kanban" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <LayoutGrid className="size-3.5" /> Pipeline
              </button>
              <button
                onClick={() => setView("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 h-8 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap",
                  view === "table" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <List className="size-3.5" /> Tabela
              </button>
            </div>
            <Button variant="outline" size="sm" className="h-9 text-xs font-bold uppercase tracking-wider shrink-0 bg-white" onClick={() => setCsvOpen(true)}>
              <Upload className="size-3.5 mr-2" />
              <span className="hidden sm:inline">Importar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            {canWrite && (
              <Button onClick={handleNew} className="h-9 px-5 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shrink-0">
                <Plus className="size-3.5 mr-2" />
                <span className="hidden sm:inline">Novo Lead</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Total Leads", value: stats.total, tone: "primary", icon: <Target className="size-4" />, onClick: () => setStatusFilter(null) },
          { label: "Novos", value: stats.novos, tone: "info", icon: <Sparkles className="size-4" />, onClick: () => setStatusFilter("Novo") },
          { label: "Em Andamento", value: stats.emAndamento, tone: "warning", icon: <Phone className="size-4" />, onClick: () => setStatusFilter(null) },
          { label: "Fechados", value: stats.fechados, tone: "success", icon: <CheckCircle2 className="size-4" />, onClick: () => setStatusFilter("Fechado") },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 space-y-5 sm:space-y-6 pb-10 animate-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <div className="relative flex-1 min-w-0 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                className="pl-10 h-10 text-sm w-full bg-white"
                placeholder="Buscar nome, email, telefone, empresa, origem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-[11px] font-medium text-slate-500 shrink-0">
              {sortedLeads.length} de {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtros ativos:</span>
              {debouncedSearch && (
                <FilterChip label={`"${debouncedSearch}"`} onClear={() => setSearch("")} />
              )}
              {rangeKey !== "TUDO" && (
                <FilterChip label={rangeKey} onClear={() => setRangeKey("TUDO")} />
              )}
              {statusFilter && (
                <FilterChip label={statusFilter} onClear={() => setStatusFilter(null)} />
              )}
              <button
                onClick={() => { setSearch(""); setRangeKey("TUDO"); setStatusFilter(null); }}
                className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 ml-auto"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>

        {view === "kanban" ? (
          isLoading ? (
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-12 text-center text-sm text-slate-500">
              Carregando leads...
            </div>
          ) : sortedLeads.length === 0 ? (
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-10">
              <EmptyState
                icon={Target}
                title={leads.length === 0 ? "Nenhum lead cadastrado" : "Nenhum lead com esses filtros"}
                description={leads.length === 0 ? "Cadastre o primeiro lead para começar." : "Ajuste a busca, o período ou o status."}
                actionLabel={leads.length === 0 ? "Novo lead" : "Limpar filtros"}
                onAction={leads.length === 0 ? () => setOpen(true) : () => { setSearch(""); setRangeKey("TUDO"); setStatusFilter(null); }}
              />
            </div>
          ) : (
            <LeadsPipeline leads={sortedLeads} onEdit={handleEdit} onConvert={convertToClient} />
          )
        ) : (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    <SortHeader k="name" label="Lead" />
                    <SortHeader k="status" label="Status" />
                    <SortHeader k="source" label="Origem / Indicação" />
                    <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Produto</th>
                    <SortHeader k="created" label="Cadastro" />
                    <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 animate-pulse">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded" /></td>
                        ))}
                      </tr>
                    ))
                  ) : sortedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10">
                        <EmptyState
                          icon={Target}
                          title={leads.length === 0 ? "Nenhum lead cadastrado" : "Nenhum lead com esses filtros"}
                          description={leads.length === 0 ? "Cadastre o primeiro lead para começar." : "Ajuste a busca, o período ou o status."}
                          actionLabel={leads.length === 0 ? "Novo lead" : "Limpar filtros"}
                          onAction={leads.length === 0 ? () => setOpen(true) : () => { setSearch(""); setRangeKey("TUDO"); setStatusFilter(null); }}
                        />
                      </td>
                    </tr>
                  ) : (
                    pagedLeads.map((lead: any) => (
                      <tr key={lead.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50/60 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-xs text-indigo-700 ring-1 ring-indigo-100 shrink-0">
                              {initials(lead.full_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{lead.full_name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {lead.whatsapp && <span className="text-[10px] text-slate-500 flex items-center gap-1"><MessageSquare className="size-2.5" /> {formatPhone(lead.whatsapp)}</span>}
                                {lead.email && <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate"><Mail className="size-2.5" /> {lead.email}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            STATUS_TONE[lead.status] || "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {lead.status || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[11px] font-semibold text-slate-900">{lead.source || "—"}</p>
                          <p className="text-[10px] text-slate-500">{lead.partners?.full_name || "Direto"}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[11px] font-medium text-slate-700">{lead.products?.name || "—"}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-mono">{formatDate(lead.created_at)}</td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400">Opções</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEdit(lead)}>
                                <Pencil className="size-3.5 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFollowUp(lead)}>
                                <CalendarClock className="size-3.5 mr-2" /> Agendar follow-up
                              </DropdownMenuItem>
                              {lead.status !== "Fechado" && (
                                <DropdownMenuItem onClick={() => convertToClient(lead)} className="text-indigo-700 font-semibold">
                                  <UserPlus className="size-3.5 mr-2" /> Converter em cliente
                                </DropdownMenuItem>
                              )}
                              {canWrite && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(lead.id)} className="text-rose-600">
                                    <Trash2 className="size-3.5 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && sortedLeads.length > 0 && (
              <PaginationControl
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={sortedLeads.length}
                itemsPerPage={PAGE_SIZE}
              />
            )}
          </div>
        )}

        <LeadFormDialog
          open={open}
          onOpenChange={setOpen}
          lead={selectedLead}
          onCreated={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        />
        <LeadsCsvImport
          open={csvOpen}
          onOpenChange={setCsvOpen}
          onImported={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        />
        <LeadFollowUpDialog
          open={followUpOpen}
          onOpenChange={setFollowUpOpen}
          lead={followUpLead}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["leads"] });
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
        <ConvertLeadDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          lead={convertLead}
          onConverted={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        />
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-[10.5px] font-bold uppercase tracking-wider text-indigo-700">
      {label}
      <button onClick={onClear} className="hover:text-indigo-900">
        <X className="size-3" />
      </button>
    </span>
  );
}
