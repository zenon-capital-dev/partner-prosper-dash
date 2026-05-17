import { Target, Search, Plus, Filter, Download, MoreHorizontal, Eye, UserPlus, Phone, Mail, MessageSquare, Trash2, Pencil, LayoutGrid, List, Upload, CalendarClock } from "lucide-react";
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

const statusColors: Record<string, string> = {
  "Novo": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Em contato": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Interessado": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Proposta enviada": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Aguardando resposta": "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  "Negociação": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Fechado": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Primeiro contato": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "Diagnóstico": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Contrato enviado": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Perdido": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "Sem resposta": "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400",
};

const PAGE_SIZE = 25;

export default function Leads() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const openFollowUp = (lead: any) => {
    setFollowUpLead(lead);
    setFollowUpOpen(true);
  };

  const { data: leads, isLoading } = useQuery({
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
      return data;
    },
  });

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter((l: any) => 
      l.full_name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.includes(q)
    );
  }, [leads, search]);

  const handleEdit = (lead: any) => {
    setSelectedLead(lead);
    setOpen(true);
  };

  const handleNew = () => {
    setSelectedLead(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este lead permanentemente?")) return;
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
    <div className="page-shell space-y-7 animate-fade-in">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Target className="size-3 text-primary" />
            Gestão de Prospecção
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Leads / Convidados
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie potenciais clientes e indicações em um só lugar.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-card p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors ${
                view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors ${
                view === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
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
      </header>

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
              <tr className="border-b border-border/50 bg-muted/20">
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
                filteredLeads.map((lead: any) => (
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
            <p className="text-xs text-muted-foreground">Mostrando {filteredLeads.length} resultados</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled className="h-8 text-[11px]">Anterior</Button>
              <Button variant="outline" size="sm" disabled className="h-8 text-[11px]">Próximo</Button>
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
  );
}
