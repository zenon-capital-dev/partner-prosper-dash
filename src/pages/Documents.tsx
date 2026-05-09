import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Download, Check, X, Clock, FilePlus, Eye, AlertCircle, MessageSquare, History, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { logAudit } from "@/lib/audit";

export type DocumentStatus = 'solicitado' | 'enviado' | 'em_analise' | 'aprovado' | 'reprovado' | 'pendente_correcao' | 'vencido';

const statusConfig: Record<DocumentStatus, { label: string; color: string; icon: any }> = {
  solicitado: { label: "Solicitado", color: "bg-warning-muted text-warning border-warning/20", icon: Clock },
  enviado: { label: "Enviado", color: "bg-info-muted text-info border-info/20", icon: FileText },
  em_analise: { label: "Em análise", color: "bg-primary-muted text-primary border-primary/20", icon: Eye },
  aprovado: { label: "Aprovado", color: "bg-success-muted text-success border-success/20", icon: Check },
  reprovado: { label: "Reprovado", color: "bg-destructive-muted text-destructive border-destructive/20", icon: X },
  pendente_correcao: { label: "Pendente correção", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  vencido: { label: "Vencido", color: "bg-slate-100 text-slate-500 border-slate-200", icon: History },
};

export default function Documents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: docs, refetch } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          clients(full_name),
          products(name),
          client_products(service_providers:service_provider_id(name))
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: DocumentStatus, notes?: string, reason?: string) => {
    const updateData: any = { status, reviewed_at: new Date().toISOString() };
    if (notes !== undefined) updateData.internal_notes = notes;
    if (reason !== undefined) updateData.rejection_reason = reason;

    const { error } = await supabase.from("documents").update(updateData).eq("id", id);
    if (error) return toast.error(error.message);
    
    toast.success(`Documento atualizado para ${statusConfig[status].label}`);
    refetch();
  };

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };


  const handleRequestCorrection = (doc: any) => {
    const reason = window.prompt("Motivo da solicitação de correção:");
    if (reason) {
      updateStatus(doc.id, "pendente_correcao", undefined, reason);
    }
  };

  const handleReprove = (doc: any) => {
    const reason = window.prompt("Motivo da reprovação:");
    if (reason) {
      updateStatus(doc.id, "reprovado", undefined, reason);
    }
  };

  const allDocs = docs ?? [];
  const kpis = useMemo(() => ({
    total: allDocs.length,
    pendentes: allDocs.filter((d: any) => ['solicitado','enviado','em_analise','pendente_correcao'].includes(d.status)).length,
    aprovados: allDocs.filter((d: any) => d.status === 'aprovado').length,
    reprovados: allDocs.filter((d: any) => d.status === 'reprovado' || d.status === 'vencido').length,
  }), [allDocs]);

  const filteredDocs = useMemo(() => allDocs.filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search && !`${d.name} ${d.clients?.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allDocs, search, statusFilter]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Documentos" 
          description="Gerenciamento completo de documentos de clientes." 
        />
        <Button onClick={() => { setSelectedDoc(null); setIsDialogOpen(true); }} className="gap-2 self-start">
          <FilePlus className="size-4" /> Solicitar Documento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={String(kpis.total)} icon={FileText} iconColor="primary" />
        <StatCard label="Pendentes" value={String(kpis.pendentes)} icon={Clock} iconColor="warning" />
        <StatCard label="Aprovados" value={String(kpis.aprovados)} icon={Check} iconColor="success" />
        <StatCard label="Reprovados / vencidos" value={String(kpis.reprovados)} icon={X} iconColor="destructive" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por documento ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="vx-card overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhum documento encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-6 py-4 text-left">Documento / Cliente</th>
                  <th className="px-6 py-4 text-left">Produto / Demanda</th>
                  <th className="px-6 py-4 text-left">Status / Visib.</th>
                  <th className="px-6 py-4 text-left">Resp. Técnico</th>
                  <th className="px-6 py-4 text-left">Prazos</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.map((d: any) => {
                  const config = statusConfig[d.status as DocumentStatus] || statusConfig.solicitado;
                  const StatusIcon = config.icon;
                  
                  return (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-lg ${config.color.split(' ')[0]} flex items-center justify-center shrink-0`}>
                            <FileText className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.clients?.full_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          {d.products?.name || "Geral"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`w-fit gap-1 text-[10px] font-bold uppercase py-0.5 ${config.color}`}>
                            <StatusIcon className="size-2.5" />
                            {config.label}
                          </Badge>
                          <div className="flex items-center gap-1.5 mt-0.5">
                             <Badge variant="secondary" className="text-[9px] font-bold py-0 h-4 border-none opacity-60">
                               {d.is_required ? "OBRIGATÓRIO" : "OPCIONAL"}
                             </Badge>
                             <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 border-none opacity-40">
                               {d.is_public ? "PÚBLICO" : "INTERNO"}
                             </Badge>
                          </div>
                          {d.rejection_reason && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 text-[10px] text-destructive hover:underline text-left mt-1">
                                  <AlertCircle className="size-2.5" /> Ver motivo
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{d.rejection_reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-foreground">
                          {(d.client_products?.service_providers as any)?.name || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span className="font-medium">Solicitado:</span> {formatDate(d.requested_at || d.created_at)}
                          </p>
                          {d.due_date && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <span className="font-medium">Prazo:</span> {formatDate(d.due_date)}
                            </p>
                          )}
                          {d.uploaded_at && (
                            <p className="text-[11px] text-success flex items-center gap-1">
                              <span className="font-medium">Enviado:</span> {formatDate(d.uploaded_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {d.file_path && (
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="size-8 text-muted-foreground hover:text-primary"
                                      onClick={() => viewFile(d.file_path)}
                                    >
                                      <Eye className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Visualizar documento</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="size-8 text-muted-foreground hover:text-primary"
                                      onClick={() => {
                                        // Simple download implementation using signed URL to avoid CORS issues if any
                                        supabase.storage.from("documents").download(d.file_path).then(({ data, error }) => {
                                          if (error) return toast.error(error.message);
                                          const url = URL.createObjectURL(data);
                                          const a = document.createElement("a");
                                          a.href = url; a.download = d.name; a.click();
                                        });
                                      }}
                                    >
                                      <Download className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar arquivo</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8">
                                <MessageSquare className="size-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => updateStatus(d.id, "aprovado")} className="text-success">
                                <Check className="size-4 mr-2" /> Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(d.id, "em_analise")}>
                                <Eye className="size-4 mr-2" /> Marcar em análise
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRequestCorrection(d)} className="text-orange-600">
                                <AlertCircle className="size-4 mr-2" /> Solicitar correção
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReprove(d)} className="text-destructive">
                                <X className="size-4 mr-2" /> Reprovar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedDoc(d); setIsDialogOpen(true); }}>
                                <FilePlus className="size-4 mr-2" /> Editar solicitação
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
        )}
      </div>

      <DocumentDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        document={selectedDoc}
        onSuccess={refetch}
      />
    </div>
  );
}
