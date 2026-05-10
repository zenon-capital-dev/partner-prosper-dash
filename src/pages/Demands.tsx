import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  ClipboardList, Search, Filter, ArrowUpRight, 
  Clock, AlertCircle, CheckCircle2, User, 
  Building2, Package, MoreHorizontal, Calendar,
  ShieldAlert, LayoutGrid, List, Kanban as KanbanIcon,
  MessageSquare, UserRound, Users, Briefcase, 
  FileCheck, FileClock, History, Plus,
  FileText, Activity, Timer
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Priority = "baixa" | "normal" | "alta" | "urgente";

const PRIORITY_META: Record<Priority, { label: string; color: string; icon: any; dot: string }> = {
  baixa: { label: "Baixa", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock, dot: "bg-slate-400" },
  normal: { label: "Normal", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Clock, dot: "bg-blue-500" },
  alta: { label: "Alta", color: "bg-orange-50 text-orange-600 border-orange-200", icon: AlertCircle, dot: "bg-orange-500" },
  urgente: { label: "Urgente", color: "bg-rose-50 text-rose-600 border-rose-200", icon: ShieldAlert, dot: "bg-rose-500" },
};

const Th = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <th className={cn("px-4 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-b border-border/50 bg-muted/5", className)}>
    {children}
  </th>
);

const SLAIndicator = ({ dueDate, status }: { dueDate: string | null, status: string | null }) => {
  if (!dueDate) return <span className="text-[10px] text-muted-foreground/40 italic font-medium">Não definido</span>;
  
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let color = "text-emerald-600 bg-emerald-500/10 border-emerald-500/20";
  let label = `${diffDays}d restantes`;
  
  if (diffDays < 0) {
    color = "text-rose-600 bg-rose-500/10 border-rose-500/20";
    label = `${Math.abs(diffDays)}d atrasado`;
  } else if (diffDays <= 2) {
    color = "text-amber-600 bg-amber-500/10 border-amber-500/20";
    label = "Vence em breve";
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold", color)}>
      <Timer className="size-3" />
      {label}
    </div>
  );
};


export default function Demands() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "kanban">("list");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<string>("all");

  const { data: demands = [], isLoading } = useQuery({
    queryKey: ["admin-demands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          *,
          clients(
            id, 
            full_name, 
            company, 
            partners(id, full_name),
            referrers(id, full_name)
          ),
          products(id, name),
          service_providers:service_provider_id(id, name),
          documents(id, status),
          reports:client_product_status_reports(id, notes, created_at)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Post-process to get last report
      return data?.map(d => ({
        ...d,
        last_report: d.reports && d.reports.length > 0 
          ? d.reports.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] 
          : null
      })) ?? [];
    },
  });

  const { data: productsList = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await supabase.from("products").select("id, name")).data ?? [],
  });

  const { data: providersList = [] } = useQuery({
    queryKey: ["providers-list"],
    queryFn: async () => (await supabase.from("service_providers").select("id, name")).data ?? [],
  });

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-list"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name")).data ?? [],
  });

  const filtered = useMemo(() => {
    return demands.filter((d: any) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (priorityFilter !== "all" && d.priority !== priorityFilter) return false;
      if (productFilter !== "all" && d.product_id !== productFilter) return false;
      if (providerFilter !== "all" && d.service_provider_id !== providerFilter) return false;
      if (partnerFilter !== "all" && d.clients?.partners?.id !== partnerFilter) return false;
      
      if (deadlineFilter !== "all") {
        const today = new Date();
        const deadline = d.sla_due_date ? new Date(d.sla_due_date) : null;
        if (!deadline) return false;
        
        if (deadlineFilter === "atrasado") return deadline < today && d.status !== 'concluido';
        if (deadlineFilter === "hoje") return deadline.toDateString() === today.toDateString();
        if (deadlineFilter === "semana") {
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          return deadline > today && deadline <= nextWeek;
        }
      }
      
      if (search) {
        const q = search.toLowerCase();
        const matches = 
          d.clients?.full_name?.toLowerCase().includes(q) ||
          d.clients?.company?.toLowerCase().includes(q) ||
          d.products?.name?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [demands, search, statusFilter, priorityFilter, productFilter, providerFilter, partnerFilter, deadlineFilter]);

  const stats = useMemo(() => {
    return {
      total: demands.length,
      urgent: demands.filter(d => d.priority === 'urgente').length,
      pendingDocs: demands.filter(d => d.documents?.some((doc: any) => doc.status === 'solicitado')).length,
      inProgress: demands.filter(d => d.status === 'em_andamento').length
    };
  }, [demands]);

  const KANBAN_COLUMNS = [
    { id: "aguardando_inicio", label: "Aguardando início" },
    { id: "aguardando_documentos", label: "Aguardando documentos" },
    { id: "em_analise", label: "Em análise" },
    { id: "em_execucao", label: "Em execução" },
    { id: "pendente_cliente", label: "Pendente com cliente" },
    { id: "pendente_prestador", label: "Pendente com prestador" },
    { id: "aguardando_aprovacao_final", label: "Aguardando aprovação" },
    { id: "concluido", label: "Concluído" },
  ];

  const [completeDialog, setCompleteDialog] = useState<{ id: string; date: string } | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, completedAt }: { id: string; status: string; completedAt?: string }) => {
      const updateData: any = { status };
      if (status === 'concluido') {
        updateData.completed_at = completedAt ?? new Date().toISOString();
      }
      const { error } = await supabase
        .from("client_products")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      toast.success("Status atualizado com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  });

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const demand = demands.find((d: any) => d.id === draggableId);
    if (!demand || demand.status === newStatus) return;
    if (newStatus === 'concluido') {
      setCompleteDialog({ id: draggableId, date: new Date().toISOString().split("T")[0] });
      return;
    }
    updateStatusMutation.mutate({ id: draggableId, status: newStatus });
  };

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Operations"
        category="Demand Center"
        title="Central de Demandas"
        description="Gestão operacional 360º de todos os produtos e serviços em execução."
        icon={<ClipboardList className="size-6" />}
        kpis={[
          { label: "Total Demandas", value: stats.total, tone: "primary", icon: <ClipboardList className="size-4" /> },
          { label: "Em Andamento", value: stats.inProgress, tone: "info", icon: <Clock className="size-4" /> },
          { label: "Urgentes", value: stats.urgent, tone: "danger", icon: <ShieldAlert className="size-4" /> },
          { label: "Pendência Doc", value: stats.pendingDocs, tone: "warning", icon: <AlertCircle className="size-4" /> },
        ]}
      />

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1 w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente, empresa ou serviço..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("size-9 rounded-md", viewMode === 'kanban' && "bg-background shadow-sm")} 
                onClick={() => setViewMode('kanban')}
                title="Kanban"
              >
                <KanbanIcon className="size-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("size-9 rounded-md", viewMode === 'list' && "bg-background shadow-sm")} 
                onClick={() => setViewMode('list')}
                title="Lista"
              >
                <List className="size-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("size-9 rounded-md", viewMode === 'grid' && "bg-background shadow-sm")} 
                onClick={() => setViewMode('grid')}
                title="Cards"
              >
                <LayoutGrid className="size-4" />
              </Button>
            </div>
            
            <Button className="h-11 gap-2 rounded-xl" onClick={() => navigate("/clientes")}>
              <Plus className="size-4" /> Nova Demanda
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {KANBAN_COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Prioridades</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Produtos</SelectItem>
              {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Prestador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Prestadores</SelectItem>
              {providersList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Parceiro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Parceiros</SelectItem>
              {partnersList.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Prazo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Prazos</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="hoje">Vence Hoje</SelectItem>
              <SelectItem value="semana">Vence na Semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="vx-card p-4 space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="vx-card p-20 text-center border-dashed border-2">
           <ClipboardList className="size-12 text-muted-foreground/20 mx-auto mb-4" />
           <p className="font-medium text-muted-foreground">Nenhuma demanda encontrada para os filtros aplicados.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="overflow-x-auto pb-4">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 min-w-max">
              {KANBAN_COLUMNS.map((column) => (
                <Droppable key={column.id} droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "w-[320px] flex flex-col rounded-xl bg-slate-50/50 dark:bg-white/[0.02] border border-border/50",
                        snapshot.isDraggingOver && "bg-slate-100/50 dark:bg-white/[0.04] border-primary/20"
                      )}
                    >
                      <div className="p-4 border-b border-border/50 flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                          {column.label}
                        </h3>
                        <Badge variant="secondary" className="h-5 text-[10px] px-1.5 font-bold tabular-nums">
                          {filtered.filter((d: any) => d.status === column.id).length}
                        </Badge>
                      </div>
                      
                      <div className="p-3 flex flex-col gap-3 flex-1 min-h-[600px]">
                        {filtered
                          .filter((d: any) => d.status === column.id)
                          .map((demand: any, index: number) => {
                            const priority = PRIORITY_META[demand.priority as Priority] || PRIORITY_META.normal;
                            const pendingDocs = demand.documents?.filter((doc: any) => doc.status === 'solicitado').length || 0;
                            
                            return (
                              <Draggable key={demand.id} draggableId={demand.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "vx-card p-4 bg-background hover:border-primary/30 transition-all select-none group relative",
                                      snapshot.isDragging && "shadow-xl border-primary/50 rotate-2 scale-[1.02] z-50",
                                      priority.label === "Urgente" && "border-l-4 border-l-rose-500"
                                    )}
                                    onClick={() => navigate(`/demandas/${demand.id}`)}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                                        {demand.products?.name}
                                      </span>
                                      <Badge variant="outline" className={cn("h-4 text-[8px] font-black uppercase border-none px-0", priority.color.replace('border-slate-200', '').replace('bg-', 'text-'))}>
                                        {priority.label}
                                      </Badge>
                                    </div>
                                    
                                    <h4 className="text-xs font-bold text-foreground mb-0.5 leading-tight group-hover:text-primary transition-colors">
                                      {demand.clients?.full_name}
                                    </h4>
                                    <p className="text-[9px] text-muted-foreground/60 font-medium mb-3 truncate">
                                      {demand.clients?.company || "Pessoa Física"}
                                    </p>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/60">
                                        <span className="flex items-center gap-1">
                                          <UserRound className="size-2.5" />
                                          {demand.service_providers?.name || "N/A"}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Calendar className="size-2.5" />
                                          {demand.deadline ? formatDate(demand.deadline) : "—"}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                        {pendingDocs > 0 ? (
                                          <div className="flex items-center gap-1 text-[8px] font-black text-amber-600 bg-amber-500/5 px-1 rounded">
                                            <AlertCircle className="size-2" /> {pendingDocs} DOCS
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 bg-emerald-500/5 px-1 rounded">
                                            <CheckCircle2 className="size-2" /> DOCS OK
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground/40 italic truncate max-w-[120px]">
                                           <History className="size-2" /> {demand.last_report?.notes || "Sem reporte"}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        </div>
      ) : viewMode === 'list' ? (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead className="vx-table-head">
              <tr>
                <th className="vx-table-cell">Cliente / Empresa</th>
                <th className="vx-table-cell">Produto</th>
                <th className="vx-table-cell">Responsável</th>
                <th className="vx-table-cell">Status</th>
                <th className="vx-table-cell">Prioridade</th>
                <th className="vx-table-cell">Prazo / Docs</th>
                <th className="vx-table-cell">Último Reporte</th>
                <th className="vx-table-cell text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const priority = PRIORITY_META[d.priority as Priority] || PRIORITY_META.normal;
                const pendingDocs = d.documents?.filter((doc: any) => doc.status === 'solicitado').length || 0;
                const isOverdue = d.sla_due_date && new Date(d.sla_due_date) < new Date() && d.status !== 'concluido';
                const daysLeft = d.sla_due_date ? Math.ceil((new Date(d.sla_due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                
                return (
                  <tr key={d.id} className={cn("vx-table-row group", isOverdue && "bg-rose-500/[0.02]")}>
                    <td className="vx-table-cell">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(`/demandas/${d.id}`)}>
                          {d.clients?.full_name}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/50 tracking-wider">
                          {d.clients?.company || "Pessoa Física"}
                        </span>
                      </div>
                    </td>
                    <td className="vx-table-cell">
                      <div className="flex items-center gap-2">
                        <Package className="size-3.5 text-primary/60" />
                        <span className="text-xs font-bold text-foreground">{d.products?.name}</span>
                      </div>
                    </td>
                    <td className="vx-table-cell">
                      <div className="flex items-center gap-2">
                        <UserRound className="size-3.5 text-muted-foreground/60" />
                        <span className="text-xs font-medium">{d.service_providers?.name || "—"}</span>
                      </div>
                    </td>
                    <td className="vx-table-cell">
                      <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-wider bg-muted/30">
                        {d.status?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="vx-table-cell">
                      <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold uppercase", priority.color)}>
                        <priority.icon className="size-3" />
                        {priority.label}
                      </Badge>
                    </td>
                    <td className="vx-table-cell">
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-bold tabular-nums", isOverdue ? "text-rose-500" : "text-foreground")}>
                          {d.sla_due_date ? formatDate(d.sla_due_date) : "—"}
                        </span>
                        {pendingDocs > 0 ? (
                          <span className="text-[9px] font-black uppercase text-amber-600">
                             {pendingDocs} Docs Pendentes
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase text-emerald-600">
                             Docs em dia
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="vx-table-cell max-w-[200px]">
                       {d.last_report ? (
                         <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground line-clamp-1 italic font-medium">"{d.last_report.notes}"</span>
                            <span className="text-[9px] font-bold text-muted-foreground/40">{formatDate(d.last_report.created_at)}</span>
                         </div>
                       ) : (
                         <span className="text-[10px] text-muted-foreground/40 italic">Sem reporte</span>
                       )}
                    </td>
                    <td className="vx-table-cell text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuItem onClick={() => navigate(`/demandas/${d.id}`)} className="gap-2 cursor-pointer">
                            <ArrowUpRight className="size-4" /> Abrir Demanda
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <MessageSquare className="size-4" /> Notificar Cliente
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <UserRound className="size-4" /> Delegar Prestador
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-amber-600 focus:text-amber-700">
                            <ShieldAlert className="size-4" /> Alterar Status
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((d: any) => {
             const priority = PRIORITY_META[d.priority as Priority] || PRIORITY_META.normal;
             const pendingDocs = d.documents?.filter((doc: any) => doc.status === 'solicitado').length || 0;
             
             return (
               <div key={d.id} className="vx-card p-6 hover:border-primary/30 transition-all cursor-pointer group flex flex-col h-full" onClick={() => navigate(`/demandas/${d.id}`)}>
                 <div className="flex items-start justify-between mb-4">
                    <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                       <Package className="size-5" />
                    </div>
                    <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold uppercase", priority.color)}>
                      {priority.label}
                    </Badge>
                 </div>
                 
                 <div className="flex-1 mb-6">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors leading-tight mb-1">{d.clients?.full_name}</h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                       <Building2 className="size-3" /> {d.clients?.company || "Pessoa Física"}
                    </p>
                    <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-black uppercase tracking-wider text-primary">
                       {d.products?.name}
                    </div>
                 </div>
                 
                 <div className="space-y-3 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-muted-foreground font-bold uppercase tracking-widest">Status</span>
                       <Badge variant="secondary" className="h-5 text-[9px] font-bold uppercase tracking-wider">{d.status?.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-muted-foreground font-bold uppercase tracking-widest">Responsável</span>
                       <span className="font-bold text-foreground flex items-center gap-1">
                          <UserRound className="size-3" /> {d.service_providers?.name || "Não atribuído"}
                       </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-muted-foreground font-bold uppercase tracking-widest">Prazo / Docs</span>
                       <div className="text-right">
                          <p className="font-bold text-foreground">{d.deadline ? formatDate(d.deadline) : "—"}</p>
                          {pendingDocs > 0 && <p className="text-[9px] font-black text-amber-500 uppercase">{pendingDocs} Docs Pendentes</p>}
                       </div>
                    </div>
                 </div>
               </div>
             );
          })}
        </div>
      )}

      <Dialog open={!!completeDialog} onOpenChange={(v) => { if (!v) setCompleteDialog(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Concluir demanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Confirme a data de conclusão. Essa ação atualiza o status para Concluído e registra a finalização.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data de conclusão</label>
              <Input
                type="date"
                value={completeDialog?.date ?? ""}
                onChange={(e) => completeDialog && setCompleteDialog({ ...completeDialog, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>Cancelar</Button>
            <Button
              className="bg-gradient-primary"
              onClick={() => {
                if (!completeDialog) return;
                updateStatusMutation.mutate({
                  id: completeDialog.id,
                  status: "concluido",
                  completedAt: new Date(completeDialog.date).toISOString(),
                });
                setCompleteDialog(null);
              }}
            >
              Confirmar conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}
