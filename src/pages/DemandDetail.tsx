import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { openDownloadUrl, downloadStorageFile } from "@/lib/download";
import { nowBR, toBR, isTodayBR } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { confirmAction } from "@/lib/confirm";
import { 
  ArrowLeft, Package, User, Clock, 
  AlertCircle, CheckCircle2, FileText, 
  MessageSquare, History, ListChecks, 
  Calendar, ShieldAlert, Paperclip, ArrowRight,
  PauseCircle, PlayCircle, AlertTriangle, FileCheck,
  Zap, FilePlus, Download, Info, ClipboardList, Plus,
  Pencil, Copy, Trash2, XCircle, UserCircle, Share2
} from "lucide-react";
import { DemandShareDialog } from "@/components/demands/DemandShareDialog";
import { DemandRequestsPanel } from "@/components/demands/DemandRequestsPanel";
import { EditDemandDialog } from "@/components/demands/EditDemandDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OperationalChecklist } from "@/components/clients/OperationalChecklist";
import { DemandComments } from "@/components/demands/DemandComments";
import { ProductDocumentFolders } from "@/components/demands/ProductDocumentFolders";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { toast } from "sonner";
import { PauseDemandDialog } from "@/components/clients/PauseDemandDialog";
import { RecordDelayDialog } from "@/components/clients/RecordDelayDialog";
import { QualityApprovalDialog } from "@/components/clients/QualityApprovalDialog";
import { DelegateProviderDialog } from "@/components/clients/DelegateProviderDialog";
import { ReportStatusDialog } from "@/components/provider/ReportStatusDialog";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const { user, isAdmin, isAdminSecondary, isColaborador, isVendedor, isPrestador, isCliente, isParceiro } = useAuth();
  const canManage = isAdmin || isAdminSecondary || isColaborador || isVendedor;

  // Detecta se o usuário logado é um prestador atribuído a esta demanda
  // (via service_provider_id principal ou via client_product_providers).
  // Usado para liberar reporte/entrega mesmo se o role "prestador" não estiver em user_roles.
  const { data: isAssignedProvider = false } = useQuery({
    queryKey: ["demand-is-my-provider", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const email = (user?.email ?? "").toLowerCase();
      const orClauses = [`user_id.eq.${user!.id}`];
      if (email) orClauses.push(`email.eq.${email}`);
      const { data: sps } = await supabase
        .from("service_providers")
        .select("id")
        .or(orClauses.join(","));
      const spIds = (sps ?? []).map((s: any) => s.id);
      if (spIds.length === 0) return false;
      const { data: cp } = await supabase
        .from("client_products")
        .select("service_provider_id, client_product_providers(service_provider_id)")
        .eq("id", id!)
        .maybeSingle();
      if (!cp) return false;
      if (cp.service_provider_id && spIds.includes(cp.service_provider_id)) return true;
      const linked = (cp as any).client_product_providers ?? [];
      return linked.some((l: any) => spIds.includes(l.service_provider_id));
    },
  });

  // Liberado para qualquer usuário do time de execução (admin, colaborador, vendedor, prestador
  // atribuído ou não). Cliente e parceiro não reportam/entregam. RLS valida a inserção.
  const canReport = !!user && !isCliente && !isParceiro;
  const canAdminActions = canManage;
  const currentRole = isCliente ? "cliente" : (isPrestador || isAssignedProvider) ? "prestador" : isParceiro ? "parceiro" : isColaborador ? "colaborador" : "admin";
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState<{ title: string; description: string; files: File[] }>({ title: "", description: "", files: [] });
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const canUploadDoc = canManage || isPrestador || isAssignedProvider || isCliente;


  const handleQuickDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !demand?.id) return;
    try {
      const { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage } = await import("@/lib/uploads");
      files.forEach(assertUploadFile);
      setUploadingDoc(true);
      const clientId = (demand as any).client_id;
      if (!clientId) throw new Error("Demanda sem cliente vinculado");
      const now = nowBR().toISOString();
      const rows: any[] = [];
      for (const [index, file] of files.entries()) {
        const path = `${clientId}/${demand.id}/${Date.now()}-${index + 1}-${sanitizeStorageFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        rows.push({
          client_id: (demand as any).client_id,
          client_product_id: demand.id,
          product_id: (demand as any).product_id ?? null,
          name: file.name,
          description: `Enviado por ${currentRole}`,
          is_required: false,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_at: now,
          uploaded_by: user?.id ?? null,
          source: currentRole,
          status: "em_analise",
        });
      }
      const { error: insErr } = await supabase.from("documents").insert(rows as any);
      if (insErr) throw insErr;
      toast.success(`${files.length} documento(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["demand-detail", id] });
    } catch (err: any) {
      const { uploadErrorMessage } = await import("@/lib/uploads");
      toast.error(uploadErrorMessage(err));
    } finally {
      setUploadingDoc(false);
    }
  };

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;
    if (action === "edit") setEditOpen(true);
    if (action === "delegate") setDelegateOpen(true);
    if (action === "pause") setPauseDialogOpen(true);
    searchParams.delete("action");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
        .maybeSingle();
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
        .order("created_at", { ascending: true });
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.reported_by).filter(Boolean)));
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return rows.map((r: any) => ({ ...r, _author: map.get(r.reported_by) }));
      }
      return rows;
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
        .in("entity_type", ["client_product", "client_products"])
        .eq("entity_id", id!)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return rows.map((r: any) => ({ ...r, _author: map.get(r.user_id) }));
      }
      return rows;
    },
    enabled: !!id,
  });

  const finalizeDemand = async () => {
    if (!demand) return;
    const ok = await confirmAction("Finalizar esta demanda?");
    if (!ok) return;
    const { error } = await supabase
      .from("client_products")
      .update({ status: "concluido", end_date: nowBR().toISOString().slice(0, 10) })
      .eq("id", demand.id);
    if (error) return toast.error(error.message);
    toast.success("Demanda finalizada");
    qc.invalidateQueries({ queryKey: ["demand-detail", id] });
  };

  const completeNextStep = async () => {
    if (!nextAction) return;
    const { error } = await supabase
      .from("client_product_steps")
      .update({ completed: true, status: "concluido", completed_at: nowBR().toISOString() })
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
    if (!deliveryForm.title.trim()) return toast.error("Nome da entrega é obrigatório");
    setSavingDelivery(true);
    try {
      const { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage } = await import("@/lib/uploads");
      deliveryForm.files.forEach(assertUploadFile);
      const clientId = (demand as any)?.client_id;
      const uploaded: Array<{ path: string; name: string; size: number; type: string }> = [];
      for (const [idx, file] of deliveryForm.files.entries()) {
        const path = `${clientId ?? "misc"}/${id}/deliveries/${Date.now()}-${idx + 1}-${sanitizeStorageFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        uploaded.push({ path, name: file.name, size: file.size, type: file.type });
      }
      const { error } = await supabase.from("demand_deliveries").insert({
        client_product_id: id!,
        title: deliveryForm.title,
        description: deliveryForm.description || null,
        status: "delivered",
        files: uploaded as any,
      });
      if (error) throw error;
      toast.success("Entrega registrada");
      setDeliveryForm({ title: "", description: "", files: [] });
      setDeliveryOpen(false);
      qc.invalidateQueries({ queryKey: ["demand-detail", id] });
    } catch (err: any) {
      const { uploadErrorMessage } = await import("@/lib/uploads");
      toast.error(uploadErrorMessage(err));
    } finally {
      setSavingDelivery(false);
    }
  };

  const duplicateDemand = async () => {
    if (!demand) return;
    const ok = await confirmAction({
      title: "Duplicar demanda",
      description: "Será criada uma nova demanda com os mesmos dados, sem documentos, checklist nem histórico.",
      confirmText: "Duplicar",
    });
    if (!ok) return;
    const { id: _id, created_at, updated_at, sla_start_date, sla_status, completed_at, current_step_id, ...base } = demand as any;
    const insertPayload = {
      ...base,
      status: "aguardando_inicio",
      sla_start_date: null,
      sla_status: null,
      completed_at: null,
      current_step_id: null,
      end_date: null,
      paused_at: null,
      resumed_at: null,
    };
    // Remove relacionamentos populados pelo select para não estourar insert
    ["clients","companies","products","service_providers","documents","steps","deliveries","reports"].forEach(k => delete insertPayload[k]);
    const { data, error } = await supabase
      .from("client_products")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (!data?.id) return toast.error("Não foi possível duplicar a demanda");
    toast.success("Demanda duplicada");
    qc.invalidateQueries({ queryKey: ["admin-demands"] });
    navigate(`/demandas/${data.id}`);
  };

  const deleteDemand = async () => {
    if (!demand) return;
    const ok = await confirmAction({
      title: "Excluir demanda",
      description: "Esta ação remove permanentemente a demanda, seu checklist, comentários, reportes e documentos vinculados. Não é possível desfazer.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("client_products").delete().eq("id", demand.id);
    if (error) return toast.error(error.message);
    toast.success("Demanda excluída");
    qc.invalidateQueries({ queryKey: ["admin-demands"] });
    navigate("/demandas");
  };

  const reviewDocument = async (docId: string, status: "aprovado" | "reprovado", reason?: string) => {
    const patch: any = {
      status,
      reviewed_at: nowBR().toISOString(),
      approved_by: status === "aprovado" ? (user?.id ?? null) : null,
      rejection_reason: status === "reprovado" ? (reason ?? null) : null,
    };
    const { error } = await supabase.from("documents").update(patch).eq("id", docId);
    if (error) return toast.error(error.message);
    toast.success(status === "aprovado" ? "Documento aprovado" : "Documento rejeitado");
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
          <Button variant="outline" size="icon" aria-label="Voltar" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/demandas"); }} className="rounded-xl border-border/40">
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

        {canAdminActions && <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              className="h-11 rounded-xl gap-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50"
              onClick={() => setDelegateOpen(true)}
            >
              <UserCircle className="size-4" /> Delegar Prestador
            </Button>

            <Button
              variant="outline"
              className="h-11 rounded-xl gap-2 border-violet-100 text-violet-700 hover:bg-violet-50"
              onClick={() => setShareOpen(true)}
              title="Compartilhar com vários prestadores (anônimo entre eles)"
            >
              <Share2 className="size-4" /> Compartilhar
            </Button>



            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="btn-premium h-11 rounded-xl gap-2 px-6">
                  Ações da Demanda <ArrowRight className="size-4" />
                </Button>
              </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-card shadow-xl">
               <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Operações</DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2 cursor-pointer">
                 <Pencil className="size-4" /> Editar Demanda
               </DropdownMenuItem>
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
               <DropdownMenuItem onClick={duplicateDemand} className="gap-2 cursor-pointer">
                 <Copy className="size-4" /> Duplicar Demanda
               </DropdownMenuItem>
               <DropdownMenuItem onClick={finalizeDemand} disabled={demand.status === 'concluido'} className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700">
                 <CheckCircle2 className="size-4" /> Finalizar Demanda
               </DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={deleteDemand} className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700">
                 <Trash2 className="size-4" /> Excluir Demanda
               </DropdownMenuItem>
             </DropdownMenuContent>
            </DropdownMenu>
          </div>}
        {!canAdminActions && canReport && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="btn-premium h-11 rounded-xl gap-2 px-6"
              onClick={() => setReportOpen(true)}
            >
              <FileCheck className="size-4" /> Reportar Status
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl gap-2 border-emerald-100 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setDeliveryOpen(true)}
            >
              <Package className="size-4" /> Registrar Entrega
            </Button>
          </div>
        )}
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
                {canManage && <Button onClick={completeNextStep} className="rounded-xl h-11 px-8 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Concluir Etapa <CheckCircle2 className="size-4" />
                </Button>}
              </div>
            )}

              <Tabs
                value={["resumo","checklist","docs","reportes","tarefas","entregas","comments","solicitacoes","history"].includes(searchParams.get("tab") || "") ? (searchParams.get("tab") as string) : "resumo"}
                onValueChange={(v) => { searchParams.set("tab", v); setSearchParams(searchParams, { replace: true }); }}
                className="space-y-6"
              >

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
                  <TabsTrigger value="solicitacoes" className="tab-trigger">
                     <MessageSquare className="size-4 mr-2" /> Solicitações
                  </TabsTrigger>
                  <TabsTrigger value="history" className="tab-trigger">
                     <History className="size-4 mr-2" /> Histórico
                  </TabsTrigger>
               </TabsList>

               <TabsContent value="solicitacoes" className="animate-fade-up">
                  <div className="vx-card p-6 bg-card">
                    <DemandRequestsPanel clientProductId={demand.id} currentRole={currentRole as any} />
                  </div>
               </TabsContent>

               <TabsContent value="resumo" className="animate-fade-up space-y-4">
                  <div className="vx-card p-5 bg-blue-50/40 border-blue-100">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      O <b>Resumo</b> é o briefing desta demanda específica — o que precisa ser feito, escopo, contexto e observações. Ele começa com a descrição padrão do produto (cadastrada em <b>Produtos</b>) e pode ser personalizado aqui para este cliente. {canManage && "Clique em \"Editar resumo\" para ajustar."}
                    </p>
                  </div>
                  <div className="vx-card p-8 bg-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sobre a demanda</h3>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={async () => {
                            const current = (demand as any).notes || (demand.products as any)?.description || "";
                            const val = window.prompt("Resumo / briefing desta demanda:", current);
                            if (val === null) return;
                            const { error } = await supabase.from("client_products").update({ notes: val }).eq("id", demand.id);
                            if (error) { toast.error(error.message); return; }
                            toast.success("Resumo atualizado");
                            qc.invalidateQueries({ queryKey: ["demand-detail", id] });
                          }}
                        >
                          Editar resumo
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {(demand as any).notes || (demand.products as any)?.description || "Nenhum resumo cadastrado ainda. O texto padrão vem da descrição do produto (cadastro em Produtos) e pode ser personalizado aqui para esta demanda."}
                    </p>
                  </div>
               </TabsContent>

                <TabsContent value="checklist" className="animate-fade-up space-y-4">
                  <div className="vx-card p-5 bg-blue-50/40 border-blue-100">
                     <h3 className="text-sm font-bold text-foreground mb-1">O que é o Checklist?</h3>
                     <p className="text-xs text-muted-foreground leading-relaxed">
                       O checklist é a lista de <b>etapas operacionais</b> que precisam ser cumpridas para entregar esta demanda (ex: "Coletar documentos", "Enviar proposta", "Aprovação do cliente"). Cada etapa tem status, responsável (Admin / Prestador / Cliente), data prevista e pode ser visível ou não para o cliente. Use os botões abaixo para criar e organizar as etapas.
                     </p>
                  </div>
                  <div className="vx-card p-8 bg-card border-slate-100">
                     <OperationalChecklist clientProductId={demand.id} canEdit={canManage} canManage={canManage} />
                  </div>
               </TabsContent>
               
               <TabsContent value="docs" className="animate-fade-up space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-base font-bold text-foreground">Documentação</h3>
                        <p className="text-xs text-muted-foreground">Solicite e acompanhe os arquivos desta demanda.</p>
                     </div>
                       <div className="flex gap-2">
                         {canUploadDoc && (
                           <label className={cn("inline-flex items-center gap-2 h-9 px-3 rounded-md border text-xs font-medium cursor-pointer bg-white hover:bg-slate-50", uploadingDoc && "opacity-60 pointer-events-none")}>
                             <Paperclip className="size-4" />
                             {uploadingDoc ? "Enviando..." : "Enviar documento"}
                              <input type="file" multiple className="hidden" onChange={handleQuickDocUpload} disabled={uploadingDoc} />
                           </label>
                         )}
                         {canManage && <Button onClick={() => setDocDialogOpen(true)} size="sm" className="gap-2">
                           <FilePlus className="size-4" /> Solicitar Documento
                         </Button>}
                       </div>
                   </div>
                   <div className="vx-card p-6 bg-card border-slate-100">
                     <ProductDocumentFolders
                       clientProductId={demand.id}
                       role={canManage ? "admin" : isCliente ? "client" : "provider"}
                     />
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
                                    openDownloadUrl(data.signedUrl);
                                  }}
                               >
                                  <Download className="size-3.5" /> Ver arquivo
                               </Button>
                            )}
                            {canManage && doc.file_path && !["aprovado","reprovado"].includes(doc.status) && (
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-8 text-[11px] gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => reviewDocument(doc.id, "aprovado")}
                                >
                                  <CheckCircle2 className="size-3.5" /> Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-8 text-[11px] gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                                  onClick={() => { setRejectReason(""); setRejectFor(doc.id); }}
                                >
                                  <XCircle className="size-3.5" /> Rejeitar
                                </Button>
                              </div>
                            )}
                            {canManage && doc.status === "reprovado" && doc.rejection_reason && (
                              <p className="text-[10px] text-rose-600 mt-2 italic">Motivo: {doc.rejection_reason}</p>
                            )}
                         </div>
                       );
                     })}
                  </div>
               </TabsContent>
               
                  <TabsContent value="reportes" className="animate-fade-up">
                    <div className="vx-card bg-card border-slate-100 flex flex-col overflow-hidden" style={{ minHeight: 480 }}>
                      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-transparent">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <FileCheck className="size-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground leading-tight">Reportes de status</h3>
                            <p className="text-[11px] text-muted-foreground">Histórico em formato de conversa — andamentos, pendências e próximos passos.</p>
                          </div>
                        </div>
                        {canReport && (
                          <Button size="sm" className="gap-2 h-8" onClick={() => setReportOpen(true)}>
                            <Plus className="size-3.5" /> Novo reporte
                          </Button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.04),transparent_60%)]">
                        {reports.length === 0 ? (
                          <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
                            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                              <FileCheck className="size-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-foreground">Nenhum reporte ainda</p>
                            <p className="text-xs mt-1">Registre o primeiro andamento para iniciar o histórico.</p>
                          </div>
                        ) : reports.map((r: any) => {
                          const hasBody = r.notes || r.pending || r.next_steps;
                          const isMe = r.reported_by && user?.id && r.reported_by === user.id;
                          const author = r._author?.full_name || "Usuário";
                          const initials = author.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
                          return (
                            <div key={r.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                              <div className={`size-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm ${isMe ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
                                {initials}
                              </div>
                              <div className={`max-w-[78%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                                <div className={`flex items-center gap-2 text-[11px] ${isMe ? "flex-row-reverse" : ""}`}>
                                  <span className="font-semibold text-foreground">{isMe ? "Você" : author}</span>
                                  <span className="text-muted-foreground font-mono">{formatDate(r.created_at)}</span>
                                </div>
                                <div className={`rounded-2xl px-4 py-3 shadow-sm border ${isMe ? "bg-indigo-600 text-white border-indigo-600 rounded-tr-sm" : "bg-white text-foreground border-slate-200 rounded-tl-sm"}`}>
                                  <div className="mb-2">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${isMe ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                                      {String(r.status || "").replace(/_/g, " ")}
                                    </span>
                                  </div>
                                  {r.notes ? (
                                    <div className="mb-2 last:mb-0">
                                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>Andamento</p>
                                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.notes}</p>
                                    </div>
                                  ) : null}
                                  {r.pending ? (
                                    <div className={`mb-2 last:mb-0 rounded-lg px-3 py-2 ${isMe ? "bg-white/10" : "bg-amber-50 border border-amber-100"}`}>
                                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isMe ? "text-amber-100" : "text-amber-700"}`}>Pendências</p>
                                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isMe ? "text-white" : "text-amber-900"}`}>{r.pending}</p>
                                    </div>
                                  ) : null}
                                  {r.next_steps ? (
                                    <div className={`mb-0 rounded-lg px-3 py-2 ${isMe ? "bg-white/10" : "bg-slate-50 border border-slate-100"}`}>
                                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isMe ? "text-indigo-100" : "text-indigo-700"}`}>Próximos passos</p>
                                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isMe ? "text-white" : "text-foreground"}`}>{r.next_steps}</p>
                                    </div>
                                  ) : null}
                                  {!hasBody && (
                                    <p className={`text-xs italic ${isMe ? "text-white/80" : "text-muted-foreground"}`}>
                                      Apenas mudança de status registrada.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {canReport && (
                        <div className="border-t border-slate-100 px-4 sm:px-6 py-3 bg-white">
                          <div className="flex items-end gap-2">
                            <textarea
                              value={chatMsg}
                              onChange={(e) => setChatMsg(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  (async () => {
                                    const v = chatMsg.trim();
                                    if (!v || chatSending) return;
                                    setChatSending(true);
                                    const { error } = await supabase.from("client_product_status_reports").insert({
                                      client_product_id: id!,
                                      status: (demand as any)?.status || "em_andamento",
                                      notes: v,
                                      reported_by: user?.id ?? null,
                                    });
                                    setChatSending(false);
                                    if (error) { toast.error(error.message); return; }
                                    setChatMsg("");
                                    qc.invalidateQueries({ queryKey: ["demand-reports", id] });
                                  })();
                                }
                              }}
                              rows={1}
                              placeholder="Escreva um andamento e pressione Enter para enviar..."
                              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 min-h-[42px] max-h-40"
                            />
                            <Button
                              size="sm"
                              className="h-[42px] gap-1.5 rounded-2xl px-4"
                              disabled={!chatMsg.trim() || chatSending}
                              onClick={async () => {
                                const v = chatMsg.trim();
                                if (!v) return;
                                setChatSending(true);
                                const { error } = await supabase.from("client_product_status_reports").insert({
                                  client_product_id: id!,
                                  status: (demand as any)?.status || "em_andamento",
                                  notes: v,
                                  reported_by: user?.id ?? null,
                                });
                                setChatSending(false);
                                if (error) { toast.error(error.message); return; }
                                setChatMsg("");
                                qc.invalidateQueries({ queryKey: ["demand-reports", id] });
                              }}
                            >
                              Enviar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-[42px] rounded-2xl gap-1.5 text-xs"
                              onClick={() => setReportOpen(true)}
                              title="Reporte completo (status, pendências, próximos passos)"
                            >
                              <Plus className="size-3.5" /> Completo
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                            Enter para enviar · Shift+Enter para quebrar linha · use "Completo" para status + pendências + próximos passos
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>



               <TabsContent value="tarefas" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card">
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Tarefas Internas</h3>
                        {canManage && <Button size="sm" className="h-8 gap-2" onClick={() => setTaskOpen(true)}>
                          <Plus className="size-3.5" /> Adicionar Tarefa
                        </Button>}
                    </div>
                    {demandTasks.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-10">Nenhuma tarefa vinculada a esta demanda.</p>
                    ) : (
                      <div className="space-y-2">
                        {demandTasks.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{t.title}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                {(t.status_new || t.status || "—").replace(/_/g, " ")} · {t.priority}
                                {t.due_date && ` · ${formatDate(t.due_date)}`}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => navigate(`/tarefas`)}>Ver</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
               </TabsContent>

               <TabsContent value="entregas" className="animate-fade-up">
                  <div className="vx-card p-8 bg-card">
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Entregas de Valor</h3>
                        {canReport && <Button size="sm" className="h-8 gap-2" onClick={() => setDeliveryOpen(true)}>
                          <Plus className="size-3.5" /> Registrar Entrega
                        </Button>}
                    </div>
                    {(!demand.deliveries || demand.deliveries.length === 0) ? (
                       <div className="text-center py-12">
                          <Package className="size-10 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground/80 mb-4">Nenhuma entrega formalizada para este produto.</p>
                          {canReport && (
                            <Button size="sm" className="gap-2" onClick={() => setDeliveryOpen(true)}>
                              <Plus className="size-3.5" /> Registrar primeira entrega
                            </Button>
                          )}
                       </div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {demand.deliveries.map((delivery: any) => {
                             const files: any[] = Array.isArray(delivery.files) ? delivery.files : [];
                             return (
                             <div key={delivery.id} className="p-4 rounded-xl border border-border bg-muted/20 hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                   <h4 className="font-bold text-sm">{delivery.title}</h4>
                                   <Badge variant="outline" className="text-[9px] uppercase">{delivery.status}</Badge>
                                </div>
                                {delivery.description && <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{delivery.description}</p>}
                                {files.length > 0 && (
                                   <div className="space-y-1.5">
                                     {files.map((f: any, i: number) => (
                                       <button
                                         key={i}
                                         onClick={async () => {
                                           try { await downloadStorageFile("documents", f.path, f.name); }
                                           catch (e: any) { toast.error(e?.message || "Falha ao baixar"); }
                                         }}
                                         className="w-full flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-[11px] hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                                       >
                                         <Download className="size-3 shrink-0 text-primary" />
                                         <span className="truncate flex-1">{f.name}</span>
                                         {f.size ? <span className="text-muted-foreground shrink-0">{Math.round(f.size / 1024)} KB</span> : null}
                                       </button>
                                     ))}
                                   </div>
                                )}
                                {files.length === 0 && delivery.file_url && (
                                   <Button variant="outline" size="sm" className="w-full h-8 text-[11px] gap-2" onClick={() => window.open(delivery.file_url, "_blank")}>
                                      <Download className="size-3" /> Baixar Entrega
                                   </Button>
                                )}
                             </div>
                             );
                          })}
                       </div>
                    )}
                  </div>
               </TabsContent>

               <TabsContent value="comments" className="animate-fade-up">
                  <div className="vx-card p-6 bg-card border-slate-100">
                     <DemandComments clientProductId={demand.id} role={canManage ? "admin" : currentRole === "cliente" ? "client" : "provider"} />
                  </div>
               </TabsContent>
               
               <TabsContent value="history" className="animate-fade-up">
                  <div className="vx-card p-6 bg-card">
                    {history.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-10">Nenhum evento registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((h: any) => (
                          <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/10">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <History className="size-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold capitalize">{String(h.action).toLowerCase().replace(/_/g, " ")}</p>
                              {h.new_data?.description && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{h.new_data.description}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                                {formatDate(h.created_at)}
                                {h._author?.full_name && <> · por <span className="font-semibold">{h._author.full_name}</span></>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                    {canManage && <Button onClick={() => setDelegateOpen(true)} variant="outline" className="w-full h-10 rounded-xl text-[11px] font-bold uppercase tracking-wider">Alterar Responsável</Button>}
                </div>
              ) : (
                 canManage ? <Button onClick={() => setDelegateOpen(true)} className="w-full h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-none text-[11px] font-bold uppercase tracking-wider">Delegar Prestador</Button> : null
              )}
           </div>

            {/* Internal Notes */}
            {canManage && <div className="vx-card p-6 bg-card space-y-4 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2">
                 <MessageSquare className="size-4 text-amber-500" />
                 <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600">Observações Internas</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic whitespace-pre-wrap">
                 {demand.internal_notes || "Nenhuma observação interna para esta demanda."}
              </p>
              <Button onClick={openNotesEditor} variant="ghost" size="sm" className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100 text-[10px] font-bold uppercase px-0">Editar Notas</Button>
            </div>}
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
      <DemandShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        clientProductId={demand.id}
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

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa para esta demanda</DialogTitle></DialogHeader>
          <Textarea rows={3} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="O que precisa ser feito?" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancelar</Button>
            <Button onClick={createTask}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryOpen} onOpenChange={(v) => { setDeliveryOpen(v); if (!v) setDeliveryForm({ title: "", description: "", files: [] }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
            <p className="text-xs text-muted-foreground">Dê um nome à entrega e anexe os arquivos que o cliente poderá baixar.</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nome da entrega *</label>
              <input className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                placeholder="Ex: Relatório mensal de junho"
                value={deliveryForm.title}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</label>
              <Textarea rows={3} placeholder="Contexto ou instruções para o cliente"
                value={deliveryForm.description}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Arquivos para o cliente baixar</label>
              <input
                type="file"
                multiple
                onChange={(e) => setDeliveryForm({ ...deliveryForm, files: [...deliveryForm.files, ...Array.from(e.target.files ?? [])] })}
                className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {deliveryForm.files.length > 0 && (
                <ul className="space-y-1 pt-2">
                  {deliveryForm.files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                      <span className="truncate">{f.name} <span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span></span>
                      <button
                        type="button"
                        className="text-rose-600 hover:text-rose-700 text-[11px]"
                        onClick={() => setDeliveryForm({ ...deliveryForm, files: deliveryForm.files.filter((_, j) => j !== i) })}
                      >Remover</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryOpen(false)} disabled={savingDelivery}>Cancelar</Button>
            <Button onClick={createDelivery} disabled={savingDelivery}>
              {savingDelivery ? "Enviando..." : "Salvar entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <EditDemandDialog open={editOpen} onOpenChange={setEditOpen} demand={demand} />

      <ReportStatusDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        clientProductId={demand.id}
        productName={(demand.products as any)?.name || demand.custom_product_name}
        clientName={(demand.clients as any)?.name}
      />

      <Dialog open={!!rejectFor} onOpenChange={(v) => { if (!v) setRejectFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar documento</DialogTitle></DialogHeader>
          <Textarea
            rows={4}
            placeholder="Descreva o motivo da rejeição para o cliente corrigir"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!rejectReason.trim()) return toast.error("Informe o motivo");
                await reviewDocument(rejectFor!, "reprovado", rejectReason.trim());
                setRejectFor(null);
              }}
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
