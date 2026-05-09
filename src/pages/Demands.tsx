import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  ClipboardList, Search, Filter, ArrowUpRight, 
  Clock, AlertCircle, CheckCircle2, User, 
  Building2, Package, MoreHorizontal, Calendar,
  ShieldAlert, LayoutGrid, List, Kanban as KanbanIcon,
  MessageSquare
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";

type Priority = "baixa" | "normal" | "alta" | "urgente";

const PRIORITY_META: Record<Priority, { label: string; color: string; icon: any }> = {
  baixa: { label: "Baixa", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
  normal: { label: "Normal", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Clock },
  alta: { label: "Alta", color: "bg-orange-50 text-orange-600 border-orange-200", icon: AlertCircle },
  urgente: { label: "Urgente", color: "bg-rose-50 text-rose-600 border-rose-200", icon: ShieldAlert },
};

export default function Demands() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "kanban">("kanban");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  const { data: demands = [], isLoading } = useQuery({
    queryKey: ["admin-demands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          *,
          clients(id, full_name, company, partners(full_name)),
          products(id, name),
          service_providers:service_provider_id(id, name),
          documents(id, status)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await supabase.from("products").select("id, name")).data ?? [],
  });

  const filtered = useMemo(() => {
    return demands.filter((d: any) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (priorityFilter !== "all" && d.priority !== priorityFilter) return false;
      if (productFilter !== "all" && d.product_id !== productFilter) return false;
      
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
  }, [demands, search, statusFilter, priorityFilter, productFilter]);

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
    { id: "aguardando_aprovacao", label: "Aguardando aprovação" },
    { id: "concluido", label: "Concluído" },
  ];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === 'concluido') {
        updateData.completed_at = new Date().toISOString();
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
      if (!window.confirm("Deseja marcar esta demanda como concluída?")) return;
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

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente, empresa ou serviço..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="aguardando_inicio">Aguardando</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Produtos</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border ml-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("size-8 rounded-md", viewMode === 'kanban' && "bg-background shadow-sm")} 
              onClick={() => setViewMode('kanban')}
              title="Kanban"
            >
              <KanbanIcon className="size-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("size-8 rounded-md", viewMode === 'list' && "bg-background shadow-sm")} 
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <List className="size-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("size-8 rounded-md", viewMode === 'grid' && "bg-background shadow-sm")} 
              onClick={() => setViewMode('grid')}
              title="Cards"
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="vx-card p-4 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="pt-2 border-t border-border/40">
                <Skeleton className="h-3 w-full" />
              </div>
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
                        "w-[300px] flex flex-col rounded-xl bg-slate-50/50 dark:bg-white/[0.02] border border-border/50",
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
                      
                      <div className="p-3 flex flex-col gap-3 flex-1 min-h-[500px]">
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
                                      "vx-card p-4 bg-background hover:border-primary/30 transition-all select-none group",
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
                                    
                                    <h4 className="text-xs font-bold text-foreground mb-1 leading-tight group-hover:text-primary transition-colors">
                                      {demand.clients?.full_name}
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground/60 font-medium mb-3 truncate">
                                      {demand.clients?.company || "Pessoa Física"}
                                    </p>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <User className="size-2.5" />
                                          {(demand.service_providers as any)?.name || "N/A"}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="size-2.5" />
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
                                        
                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground">
                                           <MessageSquare className="size-2" /> REPORTE
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
                <th className="vx-table-cell">Demanda / Cliente</th>
                <th className="vx-table-cell">Produto</th>
                <th className="vx-table-cell">Responsável</th>
                <th className="vx-table-cell">Status</th>
                <th className="vx-table-cell">Prioridade</th>
                <th className="vx-table-cell">Prazo</th>
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
                        <Package className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{d.products?.name}</span>
                      </div>
                    </td>
                    <td className="vx-table-cell">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{d.service_providers?.name || "Não atribuído"}</span>
                      </div>
                    </td>
                    <td className="vx-table-cell">
                      <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-wider">
                        {d.status?.replace('_', ' ')}
                      </Badge>
                      {pendingDocs > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-600 font-bold uppercase">
                          <AlertCircle className="size-2.5" /> {pendingDocs} Docs Pendentes
                        </div>
                      )}
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
                        {daysLeft !== null && (
                          <span className={cn("text-[9px] font-black uppercase", isOverdue ? "text-rose-500" : "text-muted-foreground")}>
                            {isOverdue ? `${Math.abs(daysLeft)} dias de atraso` : `${daysLeft} dias restantes`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="vx-table-cell text-right">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(`/demandas/${d.id}`)}>
                        <ArrowUpRight className="size-4" />
                      </Button>
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
             return (
               <div key={d.id} className="vx-card p-6 hover:border-primary/30 transition-all cursor-pointer group" onClick={() => navigate(`/demandas/${d.id}`)}>
                 <div className="flex items-start justify-between mb-4">
                    <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                       <Package className="size-5" />
                    </div>
                    <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold uppercase", priority.color)}>
                      {priority.label}
                    </Badge>
                 </div>
                 <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{d.clients?.full_name}</h3>
                 <p className="text-xs text-muted-foreground font-medium mb-4">{d.products?.name}</p>
                 
                 <div className="space-y-3 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-muted-foreground font-bold uppercase tracking-widest">Status</span>
                       <span className="font-bold text-foreground capitalize">{d.status?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-muted-foreground font-bold uppercase tracking-widest">Responsável</span>
                       <span className="font-bold text-foreground">{d.service_providers?.name || "Não atribuído"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-muted-foreground font-bold uppercase tracking-widest">Prazo</span>
                       <span className="font-bold text-foreground">{d.deadline ? formatDate(d.deadline) : "—"}</span>
                    </div>
                 </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );
}
