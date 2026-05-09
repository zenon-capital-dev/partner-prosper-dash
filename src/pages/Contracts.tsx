import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { 
  FileSignature, Plus, Download, Eye, Clock, CheckCircle2, 
  XCircle, AlertCircle, FileText, Filter, MoreHorizontal,
  FileCheck2, Ban, History, Search, DollarSign
} from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ContractDialog } from "@/components/contracts/ContractDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";

export type ContractStatus = 'rascunho' | 'enviado' | 'aguardando_assinatura' | 'assinado' | 'vencido' | 'cancelado' | 'finalizado' | 'criado' | 'pendente_correcao';

const statusConfig: Record<ContractStatus, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-600 border-slate-200", icon: FileText },
  criado: { label: "Criado", color: "bg-slate-100 text-slate-600 border-slate-200", icon: FileText },
  enviado: { label: "Enviado", color: "bg-info-muted text-info border-info/20", icon: Clock },
  aguardando_assinatura: { label: "Aguar. Assinatura", color: "bg-warning-muted text-warning border-warning/20", icon: FileSignature },
  assinado: { label: "Assinado", color: "bg-success-muted text-success border-success/20", icon: FileCheck2 },
  vencido: { label: "Vencido", color: "bg-destructive-muted text-destructive border-destructive/20", icon: AlertCircle },
  pendente_correcao: { label: "Pendente correção", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-destructive-muted text-destructive border-destructive/20", icon: Ban },
  finalizado: { label: "Finalizado", color: "bg-primary-muted text-primary border-primary/20", icon: CheckCircle2 },
};

export default function Contracts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyContractId, setHistoryContractId] = useState<string | null>(null);

  const { data: contracts, refetch, isLoading } = useQuery({
    queryKey: ["contracts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          clients(id, full_name),
          partners(id, full_name),
          service_providers(id, name),
          products(id, name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contractHistory = [] } = useQuery({
    queryKey: ["contract-history-admin", historyContractId],
    enabled: !!historyContractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_history")
        .select(`
          *,
          profiles:action_by(full_name)
        `)
        .eq("contract_id", historyContractId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: ContractStatus, notes?: string) => {
    const updateData: any = { status };
    if (status === 'enviado') updateData.sent_at = new Date().toISOString();
    if (status === 'assinado') updateData.signed_at = new Date().toISOString();
    if (status === 'finalizado') updateData.finished_at = new Date().toISOString();

    const { error } = await supabase.from("contracts").update(updateData).eq("id", id);
    if (error) return toast.error(error.message);
    
    toast.success(`Contrato atualizado para ${statusConfig[status].label}`);
    refetch();
  };

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("contracts").download(path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const allContracts = contracts ?? [];
  const kpis = useMemo(() => ({
    total: allContracts.length,
    pendentes: allContracts.filter((c: any) => ['criado','enviado','aguardando_assinatura','pendente_correcao'].includes(c.status)).length,
    assinados: allContracts.filter((c: any) => c.status === 'assinado' || c.status === 'finalizado').length,
    valorTotal: allContracts.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0),
  }), [allContracts]);

  const filteredContracts = useMemo(() => allContracts.filter((c: any) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !`${c.name} ${c.clients?.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allContracts, search, statusFilter]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Contratos" 
          description="Controle todos os contratos de prestação de serviço." 
        />
        <Button onClick={() => { setSelectedContract(null); setIsDialogOpen(true); }} className="gap-2 self-start bg-gradient-primary">
          <Plus className="size-4" /> Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={String(kpis.total)} icon={FileSignature} iconColor="primary" />
        <StatCard label="Em andamento" value={String(kpis.pendentes)} icon={Clock} iconColor="warning" />
        <StatCard label="Assinados / Finalizados" value={String(kpis.assinados)} icon={CheckCircle2} iconColor="success" />
        <StatCard label="Valor total" value={formatBRL(kpis.valorTotal)} icon={DollarSign} iconColor="info" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por contrato ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Carregando contratos...</div>
        ) : filteredContracts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhum contrato encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-6 py-4 text-left">Contrato / Cliente</th>
                  <th className="px-6 py-4 text-left">Produto</th>
                  <th className="px-6 py-4 text-left">Valor</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Datas</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredContracts.map((c: any) => {
                  const config = statusConfig[c.status as ContractStatus] || statusConfig.criado;
                  const StatusIcon = config.icon;
                  
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-lg ${config.color.split(' ')[0]} flex items-center justify-center shrink-0`}>
                            <FileSignature className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.clients?.full_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          {c.products?.name || "Geral"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium tabular-nums text-foreground">
                        {c.amount ? formatBRL(c.amount) : "---"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`w-fit gap-1.5 text-[10px] font-bold uppercase py-1 ${config.color}`}>
                          <StatusIcon className="size-3" />
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span className="font-medium">Criado:</span> {formatDate(c.created_at)}
                          </p>
                          {c.signed_at && (
                            <p className="text-[11px] text-success flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="size-2.5" /> Assinado: {formatDate(c.signed_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {c.file_path && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="size-8 text-muted-foreground hover:text-primary"
                                      onClick={() => viewFile(c.file_path)}
                                    >
                                      <Eye className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver contrato</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="size-8 text-muted-foreground hover:text-primary"
                                      onClick={() => downloadFile(c.file_path, c.name)}
                                    >
                                      <Download className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar arquivo</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8">
                                <MoreHorizontal className="size-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => updateStatus(c.id, "enviado")}>
                                <Clock className="size-4 mr-2" /> Marcar como Enviado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(c.id, "aguardando_assinatura")}>
                                <FileSignature className="size-4 mr-2" /> Aguardando Assinatura
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(c.id, "assinado")} className="text-success">
                                <FileCheck2 className="size-4 mr-2" /> Marcar como Assinado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(c.id, "finalizado")} className="text-primary font-semibold">
                                <CheckCircle2 className="size-4 mr-2" /> Finalizar Contrato
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateStatus(c.id, "pendente_correcao")} className="text-orange-600">
                                <AlertCircle className="size-4 mr-2" /> Solicitar correção
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(c.id, "cancelado")} className="text-destructive">
                                <Ban className="size-4 mr-2" /> Cancelar Contrato
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setHistoryContractId(c.id); setIsHistoryOpen(true); }}>
                                <History className="size-4 mr-2" /> Ver Histórico Auditado
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedContract(c); setIsDialogOpen(true); }}>
                                <FileText className="size-4 mr-2" /> Editar / Detalhes
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

      <ContractDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        contract={selectedContract}
        onSuccess={refetch}
      />

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="font-editorial text-2xl">Histórico de Alterações</DialogTitle>
            <DialogDescription>Rastreabilidade completa de todas as movimentações e status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 my-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-100 dark:before:bg-white/5">
             {contractHistory.length === 0 ? (
               <p className="text-center py-8 text-muted-foreground italic">Nenhuma alteração registrada até o momento.</p>
             ) : (
               contractHistory.map((h: any) => {
                 const config = statusConfig[h.status as ContractStatus] || statusConfig.criado;
                 return (
                   <div key={h.id} className="relative pl-10 group">
                      <div className={cn("absolute left-0 top-1.5 size-6 rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center", config.color.split(' ')[0])}>
                         <div className="size-1 bg-current rounded-full" />
                      </div>
                      <div className="space-y-1">
                         <div className="flex items-center justify-between">
                            <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0", config.color)}>
                               {config.label}
                            </Badge>
                            <span className="text-[10px] font-mono text-muted-foreground">{formatDate(h.created_at)}</span>
                         </div>
                         <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{h.notes || "Alteração de status"}</p>
                         <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="size-3" /> Por: {h.profiles?.full_name || "Sistema"}
                         </p>
                         {h.file_path && (
                            <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary" onClick={() => viewFile(h.file_path)}>
                               <Download className="size-3 mr-1" /> Baixar Versão Deste Momento
                            </Button>
                         )}
                      </div>
                   </div>
                 );
               })
             )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)} className="rounded-xl">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
