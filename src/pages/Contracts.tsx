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
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ContractDialog } from "@/components/contracts/ContractDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";

export type ContractStatus = 'criado' | 'enviado' | 'aguardando_assinatura' | 'assinado' | 'pendente_correcao' | 'cancelado' | 'finalizado';

const statusConfig: Record<ContractStatus, { label: string; color: string; icon: any }> = {
  criado: { label: "Criado", color: "bg-slate-100 text-slate-600 border-slate-200", icon: FileText },
  enviado: { label: "Enviado", color: "bg-info-muted text-info border-info/20", icon: Clock },
  aguardando_assinatura: { label: "Aguar. Assinatura", color: "bg-warning-muted text-warning border-warning/20", icon: FileSignature },
  assinado: { label: "Assinado", color: "bg-success-muted text-success border-success/20", icon: FileCheck2 },
  pendente_correcao: { label: "Pendente correção", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-destructive-muted text-destructive border-destructive/20", icon: Ban },
  finalizado: { label: "Finalizado", color: "bg-primary-muted text-primary border-primary/20", icon: CheckCircle2 },
};

export default function Contracts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const { data: contracts, refetch, isLoading } = useQuery({
    queryKey: ["contracts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          clients(full_name),
          products(name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: ContractStatus) => {
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

      <div className="vx-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Carregando contratos...</div>
        ) : (contracts ?? []).length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhum contrato gerado ainda</div>
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
                {contracts?.map((c: any) => {
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
    </div>
  );
}
