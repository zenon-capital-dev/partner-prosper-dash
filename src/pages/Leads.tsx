import { useEffect } from "react";
import { format, subDays, startOfMonth, startOfToday, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { Target, Search, Plus, Filter, Download, MoreHorizontal, Eye, UserPlus, Phone, Mail, MessageSquare, Trash2, Pencil, LayoutGrid, List, Upload, CalendarClock, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { formatDate, formatPhone, initials } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { LeadFormDialog } from "@/components/leads/LeadFormDialog";
import { LeadsKanban } from "@/components/leads/LeadsKanban";
import { LeadsCsvImport } from "@/components/leads/LeadsCsvImport";
import { LeadFollowUpDialog } from "@/components/leads/LeadFollowUpDialog";
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { confirmAction } from "@/lib/confirm";
import { PageHero } from "@/components/PageHero";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  "Novo": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "Em contato": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "Interessado": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "Proposta enviada": "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  "Aguardando resposta": "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  "Negociação": "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  "Fechado": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "Primeiro contato": "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  "Diagnóstico": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "Contrato enviado": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "Perdido": "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "Sem resposta": "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300",
};

const PAGE_SIZE = 25;

export default function Leads() {
  const [search, setSearch] = useState("");
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("HOJE");
  const [open, setOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [csvOpen, setCsvOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<any>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<any>(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredLeads = useMemo(() => {
    const today = startOfToday();
    let start = today;
    let end = endOfDay(today);

    if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "30 DIAS") {
      start = subDays(today, 29);
    } else if (rangeKey === "MÊS") {
      start = startOfMonth(today);
    } else if (rangeKey === "TUDO") {
      start = new Date(0);
      end = new Date(8640000000000000);
    }

    return leads.filter((l: any) => {
      const createdAt = new Date(l.created_at);
      if (rangeKey !== "TUDO" && (createdAt < start || createdAt > end)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.full_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      );
    });
  }, [leads, search, rangeKey]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedLeads = useMemo(
    () => filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredLeads, currentPage]
  );

  const handleEdit = (lead: any) => {
    setSelectedLead(lead);
    setOpen(true);
  };

  const handleNew = () => {
    setSelectedLead(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction("Excluir este lead permanentemente?"))) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lead excluído");
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
  };

  const convertToClient = (lead: any) => {
    setConvertLead(lead);
    setConvertOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-black text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 animate-in fade-in duration-700 admin-shell">
      <PageHero
        eyebrow="CRM"
        category="Sales Pipeline"
        title="Leads / Convidados"
        description="Gerencie potenciais clientes e indicações em um só lugar."
        icon={<Target className="size-6" />}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-card p-1 rounded-2xl border border-slate-200 dark:border-border shadow-sm mr-2">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase",
                    rangeKey === k ? "bg-slate-900 dark:bg-primary text-white dark:text-primary-foreground shadow-lg" : "text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border/70 bg-card p-0.5">
                <button
                  onClick={() => setView("kanban")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-8 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors",
                    view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="size-3.5" /> Kanban
                </button>
                <button
                  onClick={() => setView("table")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-8 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors",
                    view === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="size-3.5" /> Tabela
                </button>
              </div>
              <Button variant="outline" size="sm" className="h-9 text-xs font-bold uppercase tracking-wider" onClick={() => setCsvOpen(true)}>
                <Upload className="size-3.5 mr-2" />
                Importar CSV
              </Button>
              <Button onClick={handleNew} className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 bg-gradient-primary">
                <Plus className="size-3.5 mr-2" />
                Novo Lead
              </Button>
            </div>
          </div>
        }
        kpis={[
          { label: "Total Leads", value: leads?.length || 0, tone: "primary", icon: <Target className="size-4" /> },
          { label: "Novos", value: leads?.filter((l: any) => l.status === 'Novo').length || 0, tone: "info", icon: <Sparkles className="size-4" /> },
          { label: "Em Contato", value: leads?.filter((l: any) => l.status === 'Em contato').length || 0, tone: "warning", icon: <Phone className="size-4" /> },
          { label: "Fechados", value: leads?.filter((l: any) => l.status === 'Fechado').length || 0, tone: "success", icon: <CheckCircle2 className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-7 pb-10 animate-in slide-in-from-bottom-4 duration-1000">
        <div className="vx-card p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                className="pl-10 h-10 text-sm" 
                placeholder="Buscar por nome, email ou telefone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-10 text-xs font-bold px-4">
              <Filter className="size-3.5 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        {view === "kanban" ? (
          isLoading ? (
            <div className="vx-card p-12 text-center text-sm text-muted-foreground">Carregando leads...</div>
          ) : (
            <LeadsKanban leads={filteredLeads} onEdit={handleEdit} onConvert={convertToClient} />
          )
        ) : (
        <div className="vx-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20 dark:bg-muted/10">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lead</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Origem / Indicação</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Produto Interesse</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Data Cadastro</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-sm text-muted-foreground">Carregando leads...</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</td>
                  </tr>
                ) : (
                  pagedLeads.map((lead: any) => (
                    <tr key={lead.id} className="border-b last:border-0 border-border/40 hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary ring-1 ring-primary/20">
                            {initials(lead.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{lead.full_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {lead.whatsapp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><MessageSquare className="size-2.5" /> {formatPhone(lead.whatsapp)}</span>}
                              {lead.email && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="size-2.5" /> {lead.email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[lead.status] || "bg-muted text-muted-foreground"}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[11px] font-bold">{lead.source}</p>
                        <p className="text-[10px] text-muted-foreground">{lead.partners?.full_name || "Direto"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[11px] font-medium text-foreground">{lead.products?.name || "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">Opções</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(lead)}>
                              <Pencil className="size-3.5 mr-2" /> Editar Informações
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openFollowUp(lead)}>
                              <CalendarClock className="size-3.5 mr-2" /> Agendar Follow-up
                            </DropdownMenuItem>
                            {lead.status !== "Fechado" && (
                              <DropdownMenuItem onClick={() => convertToClient(lead)} className="text-primary font-bold">
                                <UserPlus className="size-3.5 mr-2" /> Converter em Cliente
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(lead.id)} className="text-destructive">
                              <Trash2 className="size-3.5 mr-2" /> Excluir Lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredLeads.length > 0 && (
            <div className="p-4 border-t border-border/40 bg-muted/5 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · Mostrando {pagedLeads.length} de {filteredLeads.length} leads
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8 text-[11px]">Anterior</Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-8 text-[11px]">Próximo</Button>
              </div>
            </div>
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
