import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList, Search, Plus, Filter, Calendar, Clock, AlertCircle, MoreHorizontal,
  CheckCircle2, XCircle, Pencil, Trash2, ArrowUpRight, AlertTriangle
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusBadge: Record<string, string> = {
  Aberta: "bg-blue-50 text-blue-600 border-blue-200",
  "Em andamento": "bg-amber-50 text-amber-600 border-amber-200",
  "Aguardando terceiro": "bg-indigo-50 text-indigo-600 border-indigo-200",
  "Concluída": "bg-emerald-50 text-emerald-600 border-emerald-200",
  "Atrasada": "bg-destructive/10 text-destructive border-destructive/20",
  "Cancelada": "bg-muted text-muted-foreground border-border",
};

const priorityBadge: Record<string, string> = {
  Baixa: "bg-slate-50 text-slate-600 border-slate-200",
  Média: "bg-blue-50 text-blue-600 border-blue-200",
  Alta: "bg-amber-50 text-amber-600 border-amber-200",
  Urgente: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Tasks() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    priority: "Média",
    status: "Aberta",
    due_date: "",
    assigned_to: "",
    related_entity_type: "cliente",
    related_entity_id: "",
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_user:employees(id, full_name)
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-simple"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name").order("full_name")).data ?? [],
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t: any) => ["Aberta", "Em andamento"].includes(t.status)).length,
      done: tasks.filter((t: any) => t.status === "Concluída").length,
      overdue: tasks.filter((t: any) => t.status === "Atrasada").length,
    };
  }, [tasks]);

  const handleCreate = async () => {
    if (!form.title) return toast.error("Título é obrigatório");
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      assigned_to: form.assigned_to || null,
      related_entity_type: form.related_entity_type,
      related_entity_id: form.related_entity_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setCreateOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks-list"] });
    resetForm();
  };

  const handleEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("tasks").update({
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      assigned_to: form.assigned_to || null,
      related_entity_type: form.related_entity_type,
      related_entity_id: form.related_entity_id || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Tarefa atualizada");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks-list"] });
    resetForm();
  };

  const openEdit = (task: any) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
      assigned_to: task.assigned_to || "",
      related_entity_type: task.related_entity_type || "cliente",
      related_entity_id: task.related_entity_id || "",
    });
    setEditOpen(true);
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      priority: "Média",
      status: "Aberta",
      due_date: "",
      assigned_to: "",
      related_entity_type: "cliente",
      related_entity_id: "",
    });
    setEditing(null);
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tarefa excluída"); qc.invalidateQueries({ queryKey: ["tasks-list"] }); }
  };

  return (
    <div className="page-shell space-y-7 animate-fade-in">
      <PageHeader 
        title="Tarefas / Pendências" 
        description="Gerencie o fluxo de trabalho e prazos da equipe."
        actions={
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2 bg-gradient-primary">
            <Plus className="size-4" /> Nova Tarefa
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendentes', count: stats.pending, tone: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Em Andamento', count: tasks.filter((t: any) => t.status === 'Em andamento').length, tone: 'text-amber-600 bg-amber-50 border-amber-100' },
          { label: 'Concluídas', count: stats.done, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Atrasadas', count: stats.overdue, tone: 'text-destructive bg-destructive/5 border-destructive/10' },
        ].map((stat, i) => (
          <div key={i} className={cn("vx-card p-4 flex flex-col items-center justify-center text-center border", stat.tone)}>
            <p className="text-[10px] uppercase font-bold opacity-80">{stat.label}</p>
            <p className="text-3xl font-black mt-1">{stat.count}</p>
          </div>
        ))}
      </div>

      <div className="vx-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10" placeholder="Buscar por título ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-fit">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="Aberta">Abertas</TabsTrigger>
              <TabsTrigger value="Em andamento">Fazendo</TabsTrigger>
              <TabsTrigger value="Concluída">Concluídas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando tarefas...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center vx-card border-dashed">
            <ClipboardList className="size-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
          </div>
        ) : (
          filteredTasks.map((task: any) => (
            <div key={task.id} className="vx-card p-4 hover:border-primary/30 transition-all group flex items-center gap-4 border">
              <div className={cn(
                "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                priorityBadge[task.priority] || "bg-slate-100"
              )}>
                <AlertCircle className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold group-hover:text-primary transition-colors truncate">{task.title}</h4>
                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1 uppercase tracking-tighter", priorityBadge[task.priority])}>
                    {task.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1"><Calendar className="size-3" /> {task.due_date ? formatDate(task.due_date) : "Sem prazo"}</span>
                  {task.assigned_user && (
                    <span className="flex items-center gap-1 text-foreground">
                      <Clock className="size-3" /> {task.assigned_user.full_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <span className={cn(
                   "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                   statusBadge[task.status] || "bg-slate-50"
                 )}>
                   {task.status}
                 </span>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-40">
                     <DropdownMenuItem onClick={() => openEdit(task)}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
                     <DropdownMenuItem onClick={() => deleteOne(task.id)} className="text-destructive"><Trash2 className="size-4 mr-2" /> Excluir</DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={createOpen || editOpen} onOpenChange={val => { if (!val) { setCreateOpen(false); setEditOpen(false); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editOpen ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detalhes da tarefa..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberta">Aberta</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Aguardando terceiro">Aguardando terceiro</SelectItem>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                    <SelectItem value="Atrasada">Atrasada</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm({...form, assigned_to: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditOpen(false); }}>Cancelar</Button>
            <Button onClick={editOpen ? handleEdit : handleCreate} className="bg-gradient-primary">
              {editOpen ? "Salvar Alterações" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}