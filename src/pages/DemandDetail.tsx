import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Package, User, Clock, 
  AlertCircle, CheckCircle2, FileText, 
  MessageSquare, History, ListChecks, 
  Calendar, ShieldAlert, Paperclip, ArrowRight,
  PauseCircle, PlayCircle, AlertTriangle, FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { PauseDemandDialog } from "@/components/clients/PauseDemandDialog";
import { RecordDelayDialog } from "@/components/clients/RecordDelayDialog";
import { QualityApprovalDialog } from "@/components/clients/QualityApprovalDialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

import { calculateSLA } from "@/lib/sla";
import { AutoStatusBadge } from "@/components/StatusBadge";

export default function DemandDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin' || user?.user_metadata?.role === 'admin_secondary';

  const { data: demand, isLoading } = useQuery({
    queryKey: ["demand-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          *,
          clients(id, full_name, email, phone, company, document),
          products(id, name, description, sla_day_type),
          service_providers:service_provider_id(id, name, specialty),
          documents(*)
        `)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["demand-reports", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_status_reports")
        .select("*")
        .eq("client_product_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-20 text-center animate-pulse">Carregando detalhes da demanda...</div>;
  if (!demand) return <div className="p-20 text-center text-rose-500 font-bold">Demanda não encontrada.</div>;

  const PRIORITY_COLORS: any = {
    baixa: "bg-slate-100 text-slate-600",
    normal: "bg-blue-50 text-blue-600",
    alta: "bg-orange-50 text-orange-600",
    urgente: "bg-rose-50 text-rose-600",
  };

  const sla = calculateSLA(
    demand.sla_start_date || demand.created_at,
    demand.sla_due_date,
    demand.status,
    (demand.products as any)?.sla_day_type || 'working'
  );

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/demandas")} className="rounded-xl border-border/40">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
               <Badge variant="outline" className={cn("uppercase text-[10px] font-bold tracking-widest px-2 py-0", PRIORITY_COLORS[demand.priority] || "bg-slate-100")}>
                  {demand.priority}
               </Badge>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Demand Management</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">{demand.clients?.full_name} / {demand.products?.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button className="btn-premium h-11 rounded-xl gap-2 px-6">
                 Ações da Demanda <ArrowRight className="size-4" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-card shadow-xl">
               <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Operações</DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem 
                 onClick={() => setPauseDialogOpen(true)}
                 className={cn("gap-2 cursor-pointer", demand.status === 'pausado' ? "text-emerald-600 focus:text-emerald-700" : "text-amber-600 focus:text-amber-700")}
               >
                 {demand.status === 'pausado' ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
                 {demand.status === 'pausado' ? "Retomar Demanda" : "Pausar Demanda"}
               </DropdownMenuItem>

               {(demand.status === 'aguardando_aprovacao_final' || demand.status === 'em_execucao' || demand.status === 'ajuste_solicitado') && (
                 <DropdownMenuItem 
                   onClick={() => setQualityDialogOpen(true)}
                   className="gap-2 cursor-pointer text-primary focus:text-primary/80"
                 >
                   <FileCheck className="size-4" /> Controle de Qualidade
                 </DropdownMenuItem>
               )}

               <DropdownMenuItem 
                 onClick={() => setDelayDialogOpen(true)}
                 className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700"
               >
                 <AlertTriangle className="size-4" /> Registrar Atraso
               </DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem className="gap-2 cursor-pointer">
                 <CheckCircle2 className="size-4" /> Finalizar Demanda
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           {/* Core Info */}
           <div className="vx-card p-8 bg-card">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status Atual</p>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase text-[10px]">
                       {demand.status?.replace('_', ' ')}
                    </Badge>
                 </div>
                 <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Controle de SLA</p>
                    <div className="flex flex-col gap-1">
                      <AutoStatusBadge status={sla?.status} className="h-5 text-[9px] w-fit" />
                      <p className={cn("text-sm font-bold flex items-center gap-2", sla?.isOverdue ? "text-rose-500" : "text-foreground")}>
                         <Clock className="size-3.5" />
                         {sla?.dueDate ? formatDate(sla.dueDate.toISOString()) : "Nenhum"}
                      </p>
                      {sla?.daysRemaining !== null && (
                        <p className={cn("text-[9px] font-black uppercase tracking-tight", sla?.isOverdue ? "text-rose-500" : "text-muted-foreground")}>
                           {sla.isOverdue ? `${Math.abs(sla.daysRemaining)} dias de atraso` : `${sla.daysRemaining} dias restantes`}
                        </p>
                      )}
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Valor Negociado</p>
                    <p className="text-sm font-bold text-foreground font-mono">{formatBRL(demand.value)}</p>
                 </div>
                 <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Início</p>
                    <p className="text-sm font-bold text-foreground">{formatDate(demand.created_at)}</p>
                 </div>
              </div>
           </div>

           <Tabs defaultValue="checklist" className="space-y-6">
              <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-8">
                 <TabsTrigger value="checklist" className="tab-trigger">
                    <ListChecks className="size-4 mr-2" /> Checklist Operacional
                 </TabsTrigger>
                 <TabsTrigger value="docs" className="tab-trigger">
                    <FileText className="size-4 mr-2" /> Documentação
                 </TabsTrigger>
                 <TabsTrigger value="history" className="tab-trigger">
                    <History className="size-4 mr-2" /> Histórico & Reportes
                 </TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="animate-fade-up">
                 <div className="vx-card p-8 bg-card border-slate-100 dark:border-white/5">
                    <ClientProductSteps clientProductId={demand.id} />
                 </div>
              </TabsContent>

              <TabsContent value="docs" className="animate-fade-up space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {demand.documents?.length === 0 ? (
                      <div className="col-span-2 p-12 text-center border-dashed border-2 rounded-2xl">
                         <Paperclip className="size-10 text-muted-foreground/20 mx-auto mb-4" />
                         <p className="text-sm text-muted-foreground">Nenhum documento vinculado a esta demanda.</p>
                      </div>
                    ) : demand.documents?.map((doc: any) => (
                      <div key={doc.id} className="vx-card p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                         <div className="flex items-center gap-4 min-w-0">
                            <div className="size-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                               <FileText className="size-5" />
                            </div>
                            <div className="min-w-0">
                               <p className="text-sm font-bold truncate">{doc.name}</p>
                               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{doc.status}</p>
                            </div>
                         </div>
                         <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider">Ver Arquivo</Button>
                      </div>
                    ))}
                 </div>
              </TabsContent>

              <TabsContent value="history" className="animate-fade-up space-y-6">
                 <div className="space-y-6">
                    {reports.length === 0 ? (
                      <div className="p-12 text-center border-dashed border-2 rounded-2xl">
                         <MessageSquare className="size-10 text-muted-foreground/20 mx-auto mb-4" />
                         <p className="text-sm text-muted-foreground">Nenhum reporte técnico registrado ainda.</p>
                      </div>
                    ) : reports.map((r: any) => (
                      <div key={r.id} className="relative pl-8 group">
                         <div className="absolute left-0 top-0 bottom-0 w-px bg-border group-last:h-4" />
                         <div className="absolute left-[-4px] top-1.5 size-2 rounded-full bg-primary" />
                         <div className="vx-card p-6 bg-card border-slate-100 dark:border-white/5">
                            <div className="flex items-center justify-between mb-4">
                               <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-muted/50">
                                  {r.status?.replace('_', ' ')}
                               </Badge>
                               <span className="text-[10px] font-mono text-muted-foreground">{formatDate(r.created_at)}</span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed italic">"{r.notes}"</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </TabsContent>
           </Tabs>
        </div>

        <div className="space-y-8">
           {/* Client Summary */}
           <div className="vx-card p-6 bg-card space-y-6">
              <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                 <div className="size-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                    <User className="size-6" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Cliente</p>
                    <h3 className="font-bold truncate text-foreground">{demand.clients?.full_name}</h3>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Empresa</span>
                    <span className="font-bold text-foreground">{demand.clients?.company || "Pessoa Física"}</span>
                 </div>
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Email</span>
                    <span className="font-bold text-foreground truncate max-w-[150px]">{demand.clients?.email}</span>
                 </div>
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Documento</span>
                    <span className="font-bold text-foreground font-mono">{demand.clients?.document || "—"}</span>
                 </div>
              </div>
           </div>

           {/* Responsible Provider */}
           <div className="vx-card p-6 bg-card space-y-6">
              <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                 <div className="size-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <ShieldAlert className="size-6" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Responsável Técnico</p>
                    <h3 className="font-bold truncate text-foreground">{(demand.service_providers as any)?.name || "Não Delegado"}</h3>
                 </div>
              </div>
              {demand.service_providers ? (
                <div className="space-y-4">
                   <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Especialidade</span>
                      <span className="font-bold text-foreground">{(demand.service_providers as any).specialty || "—"}</span>
                   </div>
                   <Button variant="outline" className="w-full h-10 rounded-xl text-[11px] font-bold uppercase tracking-wider">Alterar Responsável</Button>
                </div>
              ) : (
                <Button className="w-full h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-none text-[11px] font-bold uppercase tracking-wider">Delegar Prestador</Button>
              )}
           </div>

           {/* Internal Notes */}
           <div className="vx-card p-6 bg-card space-y-4 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2">
                 <MessageSquare className="size-4 text-amber-500" />
                 <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Observações Internas</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                 {demand.internal_notes || "Nenhuma observação interna para esta demanda."}
              </p>
              <Button variant="ghost" size="sm" className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-[10px] font-bold uppercase px-0">Editar Notas</Button>
           </div>
        </div>
      </div>

      <style>{`
        .tab-trigger {
          @apply relative px-1 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 transition-all rounded-none border-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none;
        }
        .tab-trigger[data-state=active]::after {
          content: "";
          @apply absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-full;
        }
      `}</style>

      <PauseDemandDialog 
        open={pauseDialogOpen} 
        onOpenChange={setPauseDialogOpen} 
        demandId={demand.id} 
        isPaused={demand.status === 'pausado'} 
      />
      <RecordDelayDialog 
        open={delayDialogOpen} 
        onOpenChange={setDelayDialogOpen} 
        demandId={demand.id} 
      />
    </div>
  );
}
