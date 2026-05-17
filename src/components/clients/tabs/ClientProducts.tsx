import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ChevronRight, Package, User, UserCog, ClipboardCheck, 
  Plus, Layers, Calendar, DollarSign, Activity,
  MoreVertical, Edit3, Trash2, Clock
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DelegateProviderDialog } from "@/components/clients/DelegateProviderDialog";
import { AddProductDialog } from "@/components/clients/AddProductDialog";
import { ClientProductSteps } from "./ClientProductSteps";
import { confirmAction } from "@/lib/confirm";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function ClientProducts({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [delegateTarget, setDelegateTarget] = useState<{ id: string; providerId?: string | null; productName?: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: clientProducts, isLoading } = useQuery({
    queryKey: ["client-products", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select(`
          *,
          products(name, description),
          service_providers(id, name, specialty)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-products", clientId] });
      toast.success("Produto removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cpIds = (clientProducts ?? []).map((c: any) => c.id);

  const { data: latestReports = {} } = useQuery({
    queryKey: ["latest-status-reports", cpIds.join(",")],
    enabled: cpIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_status_reports")
        .select("client_product_id, status, notes, created_at")
        .in("client_product_id", cpIds)
        .order("created_at", { ascending: false });
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.client_product_id]) map[r.client_product_id] = r;
      });
      return map;
    },
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-editorial text-2xl font-bold">Ecossistema de Soluções</h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Serviços ativos e gestão operacional dedicada</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="btn-premium gap-2 h-10 px-5 rounded-xl">
          <Plus className="size-4" /> Adicionar Produto
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="p-20 text-center"><Activity className="size-8 animate-spin mx-auto text-primary/20" /></div>
        ) : clientProducts?.length === 0 ? (
          <div className="vx-card p-20 text-center border-dashed border-2 bg-slate-50 rounded-[40px]">
            <Package className="size-16 text-slate-200 mx-auto mb-6" />
            <p className="font-editorial text-xl font-bold">Nenhum serviço contratado</p>
            <p className="text-muted-foreground text-sm mt-2 mb-8 max-w-xs mx-auto">Vincule os produtos negociados para iniciar a gestão operacional e técnica.</p>
            <Button onClick={() => setAddOpen(true)} variant="outline" className="gap-2 rounded-xl">
              <Plus className="size-4" /> Adicionar Primeiro Produto
            </Button>
          </div>
        ) : clientProducts?.map((cp: any) => {
          const lastReport = (latestReports as any)[cp.id];
          return (
            <div key={cp.id} className="vx-card bg-white border-slate-100 rounded-[40px] overflow-hidden group hover:border-primary/20 transition-all duration-500">
               <div className="p-8 lg:p-10">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                     <div className="flex items-start gap-6">
                        <div className="size-16 rounded-[24px] bg-primary/5 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                           <Package className="size-8" />
                        </div>
                        <div className="space-y-2">
                           <div className="flex items-center gap-3">
                              <h4 className="font-editorial text-3xl font-bold text-slate-900 leading-none">
                                {cp.products?.name || cp.custom_product_name}
                              </h4>
                              <StatusBadge status={cp.status} />
                           </div>
                           <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                              {cp.products?.description || "Acompanhamento técnico e gestão estratégica personalizada para o perfil do cliente."}
                           </p>
                        </div>
                     </div>

                     <div className="flex items-center gap-3 self-end lg:self-start">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-slate-200 gap-2 hover:bg-primary hover:text-white transition-all"
                          onClick={() => setDelegateTarget({ id: cp.id, providerId: cp.service_provider_id, productName: cp.products?.name })}
                        >
                          <UserCog className="size-4" /> Delegar Técnico
                        </Button>
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-9 rounded-xl hover:bg-slate-100">
                                 <MoreVertical className="size-4 text-muted-foreground" />
                              </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem className="gap-2 cursor-pointer"><Edit3 className="size-4" /> Editar Detalhes</DropdownMenuItem>
                              <DropdownMenuItem 
                                className="gap-2 text-rose-500 focus:text-rose-500 cursor-pointer"
                                onClick={async () => { if (await confirmAction("Remover este produto?")) deleteProduct.mutate(cp.id); }}
                              >
                                <Trash2 className="size-4" /> Remover Produto
                              </DropdownMenuItem>
                           </DropdownMenuContent>
                        </DropdownMenu>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10 pt-10 border-t border-slate-50">
                     <DataField label="Investimento" value={formatBRL(cp.value)} icon={DollarSign} />
                     <DataField label="Data de Início" value={formatDate(cp.created_at)} icon={Calendar} />
                     <DataField label="Prazo Fatal" value={cp.deadline ? formatDate(cp.deadline) : "Nenhum"} icon={Clock} />
                     <DataField 
                       label="Prestador Responsável" 
                       value={cp.service_providers?.name || "Não Delegado"} 
                       icon={User}
                       highlight={!!cp.service_providers}
                     />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 mt-10">
                     <div className="space-y-6">
                        <div className="flex items-center gap-3">
                           <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                              <ClipboardCheck className="size-4" />
                           </div>
                           <h5 className="text-sm font-bold uppercase tracking-widest text-slate-900">Checklist de Entrega</h5>
                        </div>
                        <div className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100">
                           <ClientProductSteps clientProductId={cp.id} />
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="flex items-center gap-3">
                           <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                              <Activity className="size-4" />
                           </div>
                           <h5 className="text-sm font-bold uppercase tracking-widest text-slate-900">Último Reporte Técnico</h5>
                        </div>
                        <div className={cn(
                          "rounded-[32px] p-8 border border-slate-100 h-full min-h-[160px] flex flex-col justify-between transition-colors",
                          lastReport ? "bg-indigo-50/30" : "bg-slate-50/50 border-dashed border-2"
                        )}>
                           {lastReport ? (
                             <>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{lastReport.notes}"</p>
                                <div className="mt-6 flex items-center justify-between border-t border-indigo-100/50 pt-4">
                                   <StatusBadge status={lastReport.status} />
                                   <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatDate(lastReport.created_at)}</span>
                                </div>
                             </>
                           ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                                <Activity className="size-6 text-slate-200" />
                                <p className="text-xs text-muted-foreground font-medium">Nenhum reporte enviado pelo técnico ainda.</p>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          );
        })}
      </div>

      {delegateTarget && (
        <DelegateProviderDialog
          open={!!delegateTarget}
          onOpenChange={(v) => !v && setDelegateTarget(null)}
          clientProductId={delegateTarget.id}
          currentProviderId={delegateTarget.providerId}
          productName={delegateTarget.productName}
        />
      )}

      <AddProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
      />
    </div>
  );
}

function DataField({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: any; highlight?: boolean }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="size-3 text-muted-foreground/60" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 truncate">{label}</p>
      </div>
      <p className={cn(
        "text-sm font-bold truncate",
        highlight ? "text-primary" : "text-slate-900"
      )}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    aguardando_documentos: { label: "AGUARDANDO DOCS", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    em_analise: { label: "EM ANÁLISE", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    aguardando_cliente: { label: "AGUARDANDO CLIENTE", className: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    em_andamento: { label: "EM ANDAMENTO", className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    pendente_correcao: { label: "PEND. CORREÇÃO", className: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
    concluido: { label: "CONCLUÍDO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    aguardando_inicio: { label: "AGUARDANDO", className: "bg-slate-100 text-slate-600 border-slate-200" },
    ativo: { label: "ATIVO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    finalizado: { label: "FINALIZADO", className: "bg-muted text-muted-foreground border-border" },
  };
  const cfg = map[status] || { label: (status || "—").toUpperCase(), className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest border px-2 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}