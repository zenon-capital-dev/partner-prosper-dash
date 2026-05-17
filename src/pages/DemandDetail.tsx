import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Package, User, Clock, 
  AlertCircle, CheckCircle2, FileText, 
  MessageSquare, History, ListChecks, 
  Calendar, ShieldAlert, Paperclip, ArrowRight,
  PauseCircle, PlayCircle, AlertTriangle, FileCheck,
  Zap, FilePlus, Download, Info, ClipboardList, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OperationalChecklist } from "@/components/clients/OperationalChecklist";
import { DemandComments } from "@/components/demands/DemandComments";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { toast } from "sonner";
import { PauseDemandDialog } from "@/components/clients/PauseDemandDialog";
import { RecordDelayDialog } from "@/components/clients/RecordDelayDialog";
import { QualityApprovalDialog } from "@/components/clients/QualityApprovalDialog";
import { DelegateProviderDialog } from "@/components/clients/DelegateProviderDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  const qc = useQueryClient();
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const { user, isAdmin, isAdminSecondary, isColaborador } = useAuth();
  const canManage = isAdmin || isAdminSecondary || isColaborador;
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({ title: "", description: "" });

  const openNotesEditor = () => {
    setNotesDraft((demand as any)?.internal_notes ?? "");
    setNotesOpen(true);
  };

  const saveNotes = async () => {
    if (!demand?.id) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("client_products")
      .update({ internal_notes: notesDraft })
      .eq("id", demand.id);
    setSavingNotes(false);
    if (error) return toast.error("Erro ao salvar observações");
    toast.success("Observações atualizadas");
    setNotesOpen(false);
    qc.invalidateQueries({ queryKey: ["demand-detail", id] });
  };

  const { data: demand, isLoading } = useQuery({
    queryKey: ["demand-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          *,
          clients(id, full_name, email, phone, company, document),
          companies(id, name, trade_name),
          products(id, name, description, sla_day_type),
          service_providers:service_provider_id(id, name, specialty),
          documents(*),
          steps:client_product_steps(*),
          deliveries:demand_deliveries(*)
        `)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const nextAction = demand?.steps?.find((s: any) => !s.completed);


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

  const { data: demandTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["demand-tasks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status_new, status, priority, due_date, assigned_to")
        .eq("client_product_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["demand-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, new_data, created_at, user_id")
        .eq("entity_type", "client_product")
        .eq("entity_id", id!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!id,
  });

  const finalizeDemand = async () => {
    if (!demand) return;
    const ok = await (await import("@/lib/confirm")).confirmAction("Finalizar esta demanda?");
    if (!ok) return;
    const { error } = await supabase
      .from("client_products")
      .update({ status: "concluido", end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", demand.id);
    if (error) return toast.error(error.message);
    toast.success("Demanda finalizada");
    qc.invalidateQueries({ queryKey: ["demand-detail", id] });
  };

  const completeNextStep = async () => {
    if (!nextAction) return;
    const { error } = await supabase
      .from("client_product_steps")
      .update({ completed: true, status: "concluido", completed_at: new Date().toISOString() })
      .eq("id", nextAction.id);
    if (error) return toast.error(error.message);
    toast.success(`Etapa "${nextAction.label}" concluída`);
    qc.invalidateQueries({ queryKey: ["demand-detail", id] });
  };

  const createTask = async () => {
    if (!taskTitle.trim()) return toast.error("Título obrigatório");
    const { error } = await supabase.from("tasks").insert({
      title: taskTitle,
      status: "a_fazer",
      status_new: "a_fazer",
      priority: "normal",
      client_product_id: id,
      client_id: demand?.client_id,
      created_by: user?.id ?? null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setTaskTitle("");
    setTaskOpen(false);
    refetchTasks();
  };

  const createDelivery = async () => {
    if (!deliveryForm.title.trim()) return toast.error("Título obrigatório");
    const { error } = await supabase.from("demand_deliveries").insert({
      client_product_id: id,
      title: deliveryForm.title,
      description: deliveryForm.description || null,
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Entrega registrada");
    setDeliveryForm({ title: "", description: "" });
    setDeliveryOpen(false);
    qc.invalidateQueries({ queryKey: ["demand-detail", id] });
  };

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
            <h1 className="text-3xl font-bold text-foreground">
              {demand.companies?.trade_name || demand.companies?.name || demand.clients?.company || demand.clients?.full_name} / {demand.products?.name}
            </h1>
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
               <DropdownMenuItem onClick={finalizeDemand} disabled={demand.status === 'concluido'} className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700">
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
                        {demand.status?.replace(/_/g, ' ')}
                     </Badge>
                     {demand.status === 'ajuste_solicitado' && (
                       <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                         <p className="text-[9px] font-black uppercase text-amber-600 mb-1">Ajuste Solicitado</p>
                         <p className="text-[11px] text-amber-700 font-medium italic">"{demand.adjustment_description}"</p>
                         {demand.adjustment_due_date && (
                           <p className="text-[9px] font-bold text-amber-600/60 mt-2">Prazo: {formatDate(demand.adjustment_due_date)}</p>
                         )}
                       </div>
                     )}
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

            {nextAction && (
              <div className="vx-card p-6 bg-primary/[0.03] border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in mb-8">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-pulse">
                    <Zap className="size-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-0.5">Próxima Ação Recomendada</p>
                    <h3 className="text-base font-bold text-foreground">{nextAction.label}</h3>
                  </div>
                </div>
                <Button onClick={completeNextStep} className="rounded-xl h-11 px-8 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Concluir Etapa <CheckCircle2 className="size-4" />
                </Button>
              </div>
            )}

             <Tabs defaultValue="resumo" className="space-y-6">
               <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-6">
                  <TabsTrigger value="resumo" className="tab-trigger">
                     <Info className="size-4 mr-2" /> Resumo
                  </TabsTrigger>
                  <TabsTrigger value="checklist" className="tab-trigger">
                     <ListChecks className="size-4 mr-2" /> Checklist
                  </TabsTrigger>
                  <TabsTrigger value="docs" className="tab-trigger">
                     <FileText className="size-4 mr-2" /> Documentos
                  </TabsTrigger>
                  <TabsTrigger value="reportes" className="tab-trigger">
                     <FileCheck className="size-4 mr-2" /> Reportes
                  </TabsTrigger>
                  <TabsTrigger value="tarefas" className="tab-trigger">
                     <ClipboardList className="size-4 mr-2" /> Tarefas
                  </TabsTrigger>
                  <TabsTrigger value="entregas" className="tab-trigger">
                     <Package className="size-4 mr-2" /> Entregas
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="tab-trigger">
                     <MessageSquare className="size-4 mr-2" /> Comentários
                  </TabsTrigger>
                  <TabsTrigger value="history" className="tab-trigger">
                     <History className="size-4 mr-2" /> Histórico
                  </TabsTrigger>
               </TabsList>

               <TabsContent value="resumo" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Sobre a demanda</h3>
                    <p className="text-sm text-foreground leading-relaxed">{(demand.products as any)?.description || "Nenhuma descrição disponível para este produto."}</p>
                  </div>
               </TabsContent>

               <TabsContent value="checklist" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card border-slate-100">
                     <OperationalChecklist clientProductId={demand.id} canEdit={isAdmin} canManage={isAdmin} />
                  </div>
               </TabsContent>
               
               <TabsContent value="docs" className="animate-fade-up space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-base font-bold text-foreground">Documentação</h3>
                        <p className="text-xs text-muted-foreground">Solicite e acompanhe os arquivos desta demanda.</p>
                     </div>
                     <Button onClick={() => setDocDialogOpen(true)} size="sm" className="gap-2">
                        <FilePlus className="size-4" /> Solicitar Documento
                     </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {!demand.documents || demand.documents.length === 0 ? (
                       <div className="col-span-2 p-12 text-center border-dashed border-2 rounded-2xl">
                          <Paperclip className="size-10 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground">Nenhum documento vinculado.</p>
                       </div>
                     ) : demand.documents.map((doc: any) => {
                       const isOverdue = doc.due_date && new Date(doc.due_date) < new Date() && !['aprovado', 'enviado', 'em_analise'].includes(doc.status);
                       const computedStatus = isOverdue ? 'atrasado' : doc.status;
                       const statusTone: Record<string, string> = {
                         solicitado: "bg-amber-50 text-amber-700 border-amber-200",
                         enviado: "bg-blue-50 text-blue-700 border-blue-200",
                         em_analise: "bg-primary-muted text-primary border-primary/20",
                         aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
                         reprovado: "bg-rose-50 text-rose-700 border-rose-200",
                         pendente_correcao: "bg-orange-50 text-orange-700 border-orange-200",
                         atrasado: "bg-rose-100 text-rose-700 border-rose-200",
                         vencido: "bg-slate-100 text-slate-500 border-slate-200",
                       };
                       const tone = statusTone[computedStatus] || statusTone.solicitado;
                       return (
                         <div key={doc.id} className="vx-card p-5 hover:bg-muted/10 transition-colors space-y-3">
                            <div className="flex items-start justify-between gap-3">
                               <div className="flex items-start gap-3 min-w-0">
                                  <div className="size-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                                     <FileText className="size-5" />
                                  </div>
                                  <div className="min-w-0">
                                     <p className="text-sm font-bold truncate">{doc.name}</p>
                                  </div>
                               </div>
                               <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider shrink-0", tone)}>
                                  {computedStatus.replace(/_/g, ' ')}
                               </Badge>
                            </div>
                            {doc.file_path && (
                               <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 h-8 text-xs w-full mt-2"
                                  onClick={async () => {
                                    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 3600);
                                    if (error) return toast.error(error.message);
                                    window.open(data.signedUrl, "_blank");
                                  }}
                               >
                                  <Download className="size-3.5" /> Ver arquivo
                               </Button>
                            )}
                         </div>
                       );
                     })}
                  </div>
               </TabsContent>
               
               <TabsContent value="reportes" className="animate-fade-up">
                  <div className="vx-card p-6 bg-card border-slate-100 space-y-6">
                    {reports.length === 0 ? (
                       <div className="p-8 text-center text-muted-foreground text-sm">Nenhum reporte registrado.</div>
                    ) : reports.map((r: any) => (
                      <div key={r.id} className="p-4 rounded-xl bg-muted/40 border border-border">
                         <div className="flex items-center justify-between mb-2">
                           <Badge variant="outline">{r.status}</Badge>
                           <span className="text-xs font-mono text-muted-foreground">{formatDate(r.created_at)}</span>
                         </div>
                         <p className="text-sm">{r.notes}</p>
                      </div>
                    ))}
                  </div>
               </TabsContent>

               <TabsContent value="tarefas" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card">
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Tarefas Internas</h3>
                       <Button size="sm" className="h-8 gap-2">
                          <Plus className="size-3.5" /> Adicionar Tarefa
                       </Button>
                    </div>
                    <div className="space-y-3">
                       {/* Simplified task list view for demand-specific tasks */}
                       <p className="text-sm text-center text-muted-foreground py-10">Use a aba de checklist para gerenciar as etapas principais do processo.</p>
                    </div>
                  </div>
               </TabsContent>

               <TabsContent value="entregas" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card">
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Entregas de Valor</h3>
                       <Button size="sm" className="h-8 gap-2">
                          <Plus className="size-3.5" /> Registrar Entrega
                       </Button>
                    </div>
                    {(!demand.deliveries || demand.deliveries.length === 0) ? (
                       <div className="text-center py-12 text-muted-foreground/60">
                          <Package className="size-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm">Nenhuma entrega formalizada para este produto.</p>
                       </div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {demand.deliveries.map((delivery: any) => (
                             <div key={delivery.id} className="p-4 rounded-xl border border-border bg-muted/20 hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                   <h4 className="font-bold text-sm">{delivery.title}</h4>
                                   <Badge variant="outline" className="text-[9px] uppercase">{delivery.status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{delivery.description}</p>
                                {delivery.file_url && (
                                   <Button variant="outline" size="sm" className="w-full h-8 text-[11px] gap-2">
                                      <Download className="size-3" /> Baixar Entrega
                                   </Button>
                                )}
                             </div>
                          ))}
                       </div>
                    )}
                  </div>
               </TabsContent>

               <TabsContent value="comments" className="animate-fade-up">
                  <div className="vx-card p-6 bg-card border-slate-100">
                     <DemandComments clientProductId={demand.id} role={isAdmin ? "admin" : "provider"} />
                  </div>
               </TabsContent>
               
               <TabsContent value="history" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card text-center text-muted-foreground">Histórico de mudanças da demanda...</div>
               </TabsContent>
             </Tabs>
        </div>

        <div className="space-y-8">
           {/* Client Summary */}
           <div className="vx-card p-6 bg-card space-y-6">
              <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                 <div className="size-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
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
                   <Button onClick={() => setDelegateOpen(true)} variant="outline" className="w-full h-10 rounded-xl text-[11px] font-bold uppercase tracking-wider">Alterar Responsável</Button>
                </div>
              ) : (
                <Button onClick={() => setDelegateOpen(true)} className="w-full h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-none text-[11px] font-bold uppercase tracking-wider">Delegar Prestador</Button>
              )}
           </div>

           {/* Internal Notes */}
           <div className="vx-card p-6 bg-card space-y-4 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2">
                 <MessageSquare className="size-4 text-amber-500" />
                 <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600">Observações Internas</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic whitespace-pre-wrap">
                 {demand.internal_notes || "Nenhuma observação interna para esta demanda."}
              </p>
              <Button onClick={openNotesEditor} variant="ghost" size="sm" className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100 text-[10px] font-bold uppercase px-0">Editar Notas</Button>
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
      <QualityApprovalDialog
        open={qualityDialogOpen}
        onOpenChange={setQualityDialogOpen}
        demandId={demand.id}
      />
      <DocumentDialog
        open={docDialogOpen}
        onOpenChange={setDocDialogOpen}
        clientId={demand.client_id}
        clientProductId={demand.id}
        defaultProductId={demand.product_id}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["demand-detail", id] })}
      />
      <DelegateProviderDialog
        open={delegateOpen}
        onOpenChange={setDelegateOpen}
        clientProductId={demand.id}
        currentProviderId={(demand as any).service_provider_id}
        productName={(demand as any).products?.name || (demand as any).custom_product_name}
      />
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações Internas</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={8}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Anotações visíveis apenas para o time interno..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)}>Cancelar</Button>
            <Button onClick={saveNotes} disabled={savingNotes}>{savingNotes ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
