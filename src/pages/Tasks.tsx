import { useMemo, useState } from "react";
import { format, subDays, startOfMonth, startOfToday, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  ClipboardList, Search, Plus, Calendar as CalendarIcon, Clock, AlertCircle,
  MoreHorizontal, Pencil, Trash2, LayoutList, Columns3, CalendarDays, User,
  Building2, Briefcase, FileSignature, CreditCard, Users as UsersIcon, Package,
  CheckCircle2,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { confirmAction } from "@/lib/confirm";
import { TaskDetailsExtras } from "@/components/tasks/TaskDetailsExtras";

const STATUSES = [
  { value: "a_fazer", label: "A fazer", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20" },
  { value: "em_andamento", label: "Em andamento", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20" },
  { value: "aguardando_terceiros", label: "Aguardando terceiros", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20" },
  { value: "bloqueada", label: "Bloqueada", color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20" },
  { value: "concluida", label: "Concluída", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20" },
  { value: "cancelada", label: "Cancelada", color: "bg-muted text-muted-foreground border-border dark:bg-muted/10" },
] as const;

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-slate-50 text-slate-600 border-slate-200" },
  { value: "normal", label: "Normal", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { value: "alta", label: "Alta", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "urgente", label: "Urgente", color: "bg-destructive/10 text-destructive border-destructive/20" },
] as const;

const ENTITY_TYPES = [
  { value: "none", label: "Nenhum", icon: ClipboardList },
  { value: "client", label: "Cliente", icon: User },
  { value: "client_product", label: "Produto/Demanda", icon: Package },
  { value: "provider", label: "Prestador", icon: Briefcase },
  { value: "partner", label: "Parceiro", icon: UsersIcon },
  { value: "payment", label: "Pagamento", icon: CreditCard },
  { value: "contract", label: "Contrato", icon: FileSignature },
] as const;

const statusMeta = (s: string) => STATUSES.find(x => x.value === s) ?? STATUSES[0];
const priorityMeta = (p: string) => PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1];

const isOverdue = (t: any) =>
  t.due_date && new Date(t.due_date) < new Date() && !["concluida", "cancelada"].includes(t.status_new);

type EntityType = "none" | "client" | "client_product" | "provider" | "partner" | "payment" | "contract";

type FormState = {
  title: string;
  description: string;
  priority: string;
  status_new: string;
  due_date: string;
  assigned_to: string;
  entity_type: EntityType;
  entity_id: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  priority: "normal",
  status_new: "a_fazer",
  due_date: "",
  assigned_to: "",
  entity_type: "none",
  entity_id: "",
};

const toLocalDateKey = (d: Date | string) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return format(dt, "yyyy-MM-dd");
};

export default function Tasks() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<"lista" | "kanban" | "calendario">("lista");
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("TUDO");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks-central"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_user:profiles!tasks_assigned_to_fkey(id, full_name),
          client:clients(id, full_name),
          client_product:client_products(id, custom_product_name, products(name)),
          provider:service_providers(id, name),
          partner:partners(id, full_name),
          payment:payments(id, amount, status),
          contract:contracts(id, name)
        `)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) {
        // fallback se join falhar (FK ausente etc.)
        const r = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
        return r.data ?? [];
      }
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["tasks-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["tasks-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: clientProducts = [] } = useQuery({
    queryKey: ["tasks-client-products"],
    queryFn: async () => (await supabase.from("client_products").select("id, custom_product_name, products(name), clients(full_name)").limit(500)).data ?? [],
  });
  const { data: serviceProviders = [] } = useQuery({
    queryKey: ["tasks-providers"],
    queryFn: async () => (await supabase.from("service_providers").select("id, name").order("name")).data ?? [],
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["tasks-partners"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["tasks-payments"],
    queryFn: async () => (await supabase.from("payments").select("id, amount, status").limit(300)).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["tasks-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, name").limit(300)).data ?? [],
  });


  const filtered = useMemo(() => {
    const today = startOfToday();
    let start = today;
    let end = endOfDay(today);

    if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "30 DIAS") {
      start = subDays(today, 29);
    } else if (rangeKey === "MÊS") {
      start = startOfMonth(today);
    } else if (rangeKey === "TUDO") {
      start = new Date(0);
      end = new Date(8640000000000000);
    }

    return tasks.filter((t: any) => {
      // Período aplica em due_date; tarefas sem prazo são sempre visíveis (exceto buscas pontuais por status/prioridade)
      if (rangeKey !== "TUDO" && t.due_date) {
        const due = new Date(t.due_date);
        if (due < start || due > end) return false;
      }
      if (statusFilter !== "all" && t.status_new !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, search, rangeKey]);

  const stats = useMemo(() => ({
    total: tasks.length,
    overdue: tasks.filter(isOverdue).length,
    urgent: tasks.filter((t: any) => t.priority === "urgente" && !["concluida", "cancelada"].includes(t.status_new)).length,
    done: tasks.filter((t: any) => t.status_new === "concluida").length,
  }), [tasks]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openEdit = (task: any) => {
    setEditing(task);
    let entity_type: EntityType = "none";
    let entity_id = "";
    if (task.client_product_id) { entity_type = "client_product"; entity_id = task.client_product_id; }
    else if (task.client_id) { entity_type = "client"; entity_id = task.client_id; }
    else if (task.provider_id) { entity_type = "provider"; entity_id = task.provider_id; }
    else if (task.partner_id) { entity_type = "partner"; entity_id = task.partner_id; }
    else if (task.payment_id) { entity_type = "payment"; entity_id = task.payment_id; }
    else if (task.contract_id) { entity_type = "contract"; entity_id = task.contract_id; }
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      priority: task.priority ?? "normal",
      status_new: task.status_new ?? "a_fazer",
      due_date: task.due_date ? String(task.due_date).split("T")[0] : "",
      assigned_to: task.assigned_to ?? "",
      entity_type,
      entity_id,
    });
    setCreateOpen(true);
  };

  const buildPayload = () => {
    const base: any = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      status_new: form.status_new,
      status: form.status_new,
      due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : null,
      assigned_to: form.assigned_to || null,
      client_id: null,
      client_product_id: null,
      provider_id: null,
      partner_id: null,
      payment_id: null,
      contract_id: null,
      related_entity_type: form.entity_type === "none" ? null : form.entity_type,
      related_entity_id: form.entity_id || null,
      completed_at: form.status_new === "concluida" ? new Date().toISOString() : null,
    };
    if (form.entity_id && form.entity_type !== "none") {
      const map: Record<string, string> = {
        client: "client_id", client_product: "client_product_id", provider: "provider_id",
        partner: "partner_id", payment: "payment_id", contract: "contract_id",
      };
      base[map[form.entity_type]] = form.entity_id;
    }
    return base;
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título é obrigatório");
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editing.id);
        if (error) return toast.error(error.message);
        toast.success("Tarefa atualizada");
      } else {
        const { error } = await supabase.from("tasks").insert({ ...payload, created_by: user?.id ?? null });
        if (error) return toast.error(error.message);
        toast.success("Tarefa criada");
      }
      setCreateOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["tasks-central"] });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status_new: string) => {
    const { error } = await supabase.from("tasks").update({
      status_new: status_new as any, status: status_new,
      completed_at: status_new === "concluida" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["tasks-central"] });
  };

  const remove = async (id: string) => {
    if (!(await confirmAction("Excluir esta tarefa?"))) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tarefa excluída"); qc.invalidateQueries({ queryKey: ["tasks-central"] }); }
  };

  const renderEntity = (task: any) => {
    if (task.client_product) {
      const name = task.client_product.custom_product_name || task.client_product.products?.name || "Demanda";
      return <Link to={`/demandas/${task.client_product_id}`} className="hover:text-primary inline-flex items-center gap-1"><Package className="size-3" />{name}</Link>;
    }
    if (task.client) return <Link to={`/clientes/${task.client_id}`} className="hover:text-primary inline-flex items-center gap-1"><User className="size-3" />{task.client.full_name}</Link>;
    if (task.provider) return <Link to={`/prestadores/${task.provider_id}`} className="hover:text-primary inline-flex items-center gap-1"><Briefcase className="size-3" />{task.provider.name}</Link>;
    if (task.partner) return <Link to={`/parceiros/${task.partner_id}`} className="hover:text-primary inline-flex items-center gap-1"><UsersIcon className="size-3" />{task.partner.full_name}</Link>;
    if (task.payment) return <span className="inline-flex items-center gap-1"><CreditCard className="size-3" />Pagamento</span>;
    if (task.contract) return <Link to="/contratos" className="hover:text-primary inline-flex items-center gap-1"><FileSignature className="size-3" />{task.contract.name}</Link>;
    return null;
  };

  const TaskRow = ({ task }: { task: any }) => {
    const sm = statusMeta(task.status_new);
    const pm = priorityMeta(task.priority);
    const overdue = isOverdue(task);
    return (
      <div className={cn(
        "vx-card p-4 border hover:border-primary/30 transition-all flex items-center gap-4",
        overdue && "border-destructive/30"
      )}>
        <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 border", pm.color)}>
          <AlertCircle className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold truncate">{task.title}</h4>
            <Badge variant="outline" className={cn("text-[9px] h-4 px-1 uppercase", pm.color)}>{pm.label}</Badge>
            {overdue && <Badge variant="outline" className="text-[9px] h-4 px-1 uppercase bg-destructive/10 text-destructive border-destructive/20">Atrasada</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-medium flex-wrap">
            <span className="flex items-center gap-1"><CalendarIcon className="size-3" /> {task.due_date ? formatDate(task.due_date) : "Sem prazo"}</span>
            {task.assigned_user && <span className="flex items-center gap-1"><Clock className="size-3" /> {task.assigned_user.full_name}</span>}
            {renderEntity(task) && <span className="flex items-center gap-1">{renderEntity(task)}</span>}
          </div>
        </div>
        <Select value={task.status_new} onValueChange={(v) => updateStatus(task.id, v)}>
          <SelectTrigger className={cn("w-[170px] h-8 text-xs border", sm.color)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => openEdit(task)}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => remove(task.id)} className="text-destructive"><Trash2 className="size-4 mr-2" /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const tasksByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((t: any) => {
      if (!t.due_date) return;
      const k = String(t.due_date).split("T")[0];
      (map[k] ||= []).push(t);
    });
    return map;
  }, [filtered]);

  const dayKey = (d?: Date) => d ? d.toISOString().split("T")[0] : "";
  const tasksOnDay = calendarDate ? (tasksByDate[dayKey(calendarDate)] ?? []) : [];
  const datesWithTasks = useMemo(() => Object.keys(tasksByDate).map(k => new Date(k)), [tasksByDate]);

  const entityOptions = () => {
    switch (form.entity_type) {
      case "client": return clients.map((x: any) => ({ id: x.id, label: x.full_name }));
      case "client_product": return clientProducts.map((x: any) => ({
        id: x.id,
        label: `${x.custom_product_name || x.products?.name || "Demanda"} — ${x.clients?.full_name ?? ""}`,
      }));
      case "provider": return serviceProviders.map((x: any) => ({ id: x.id, label: x.name }));
      case "partner": return partners.map((x: any) => ({ id: x.id, label: x.full_name }));
      case "payment": return payments.map((x: any) => ({ id: x.id, label: `Pagamento R$ ${x.amount} (${x.status})` }));
      case "contract": return contracts.map((x: any) => ({ id: x.id, label: x.name }));
      default: return [];
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060608] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 admin-shell">
      <PageHero
        eyebrow="Operacional"
        category="Task Management"
        title="Central de Tarefas"
        icon={<ClipboardList className="size-6" />}
        description="Gerencie tarefas internas vinculadas a clientes, demandas, prestadores, parceiros, pagamentos e contratos."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-card p-1 rounded-2xl border border-slate-200 dark:border-border shadow-sm mr-2">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase",
                    rangeKey === k ? "bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg" : "text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2 bg-gradient-primary">
              <Plus className="size-4" /> Nova Tarefa
            </Button>
          </div>
        }
        kpis={[
          { label: "Total", value: stats.total, tone: "primary", icon: <ClipboardList className="size-4" /> },
          { label: "Urgentes", value: stats.urgent, tone: "warning", icon: <AlertCircle className="size-4" /> },
          { label: "Atrasadas", value: stats.overdue, tone: "danger", icon: <Clock className="size-4" /> },
          { label: "Concluídas", value: stats.done, tone: "success", icon: <CheckCircle2 className="size-4" /> },
        ]}
      />
      
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-7 pb-10">
        <div className="hidden grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", count: stats.total, tone: "text-primary bg-primary/5 border-primary/10" },
          { label: "Urgentes", count: stats.urgent, tone: "text-amber-600 bg-amber-50 border-amber-100" },
          { label: "Atrasadas", count: stats.overdue, tone: "text-destructive bg-destructive/5 border-destructive/10" },
          { label: "Concluídas", count: stats.done, tone: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        ].map((s, i) => (
          <div key={i} className={cn("vx-card p-4 flex flex-col items-center justify-center text-center border", s.tone)}>
            <p className="text-[10px] uppercase font-bold opacity-80">{s.label}</p>
            <p className="text-3xl font-black mt-1">{s.count}</p>
          </div>
        ))}
        </div>

        <div className="vx-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10" placeholder="Buscar por título ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[170px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="lista" className="gap-2"><LayoutList className="size-4" /> Lista</TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2"><Columns3 className="size-4" /> Kanban</TabsTrigger>
            <TabsTrigger value="calendario" className="gap-2"><CalendarDays className="size-4" /> Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-3 mt-4">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando tarefas...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center vx-card border-dashed">
                <ClipboardList className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
              </div>
            ) : filtered.map((t: any) => <TaskRow key={t.id} task={t} />)}
          </TabsContent>

          <TabsContent value="kanban" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {STATUSES.map(col => {
                const colTasks = filtered.filter((t: any) => t.status_new === col.value);
                return (
                  <div key={col.value} className="vx-card border p-3 space-y-3 min-h-[200px] bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-[10px] uppercase", col.color)}>{col.label}</Badge>
                      <span className="text-xs text-muted-foreground font-bold">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((t: any) => {
                        const pm = priorityMeta(t.priority);
                        const overdue = isOverdue(t);
                        return (
                          <button key={t.id} onClick={() => openEdit(t)} className={cn(
                            "w-full text-left vx-card border p-3 hover:border-primary/40 transition-all space-y-2 bg-background",
                            overdue && "border-destructive/30"
                          )}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold leading-snug">{t.title}</p>
                              <Badge variant="outline" className={cn("text-[8px] h-4 px-1 shrink-0", pm.color)}>{pm.label}</Badge>
                            </div>
                            {t.due_date && (
                              <p className={cn("text-[10px] flex items-center gap-1", overdue ? "text-destructive font-bold" : "text-muted-foreground")}>
                                <CalendarIcon className="size-3" /> {formatDate(t.due_date)}
                              </p>
                            )}
                            {t.assigned_user && <p className="text-[10px] text-muted-foreground truncate">{t.assigned_user.full_name}</p>}
                          </button>
                        );
                      })}
                      {colTasks.length === 0 && <p className="text-[10px] text-muted-foreground/60 text-center py-4">Vazio</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="calendario" className="mt-4">
            <div className="grid md:grid-cols-[auto_1fr] gap-6">
              <div className="vx-card p-4 border w-fit">
                <CalendarUI
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                  modifiers={{ hasTasks: datesWithTasks }}
                  modifiersClassNames={{ hasTasks: "bg-primary/15 text-primary font-bold rounded-md" }}
                />
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-sm">
                  Tarefas em {calendarDate ? formatDate(calendarDate.toISOString()) : "—"}
                </h3>
                {tasksOnDay.length === 0 ? (
                  <div className="p-8 text-center vx-card border-dashed">
                    <p className="text-muted-foreground text-sm">Nenhuma tarefa nesta data.</p>
                  </div>
                ) : tasksOnDay.map((t: any) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) { setCreateOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status_new} onValueChange={v => setForm({ ...form, status_new: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.assigned_to || "none"} onValueChange={v => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Relacionado a</Label>
                <Select value={form.entity_type} onValueChange={v => setForm({ ...form, entity_type: v as EntityType, entity_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Item vinculado</Label>
                <Select
                  value={form.entity_id || "none"}
                  onValueChange={v => setForm({ ...form, entity_id: v === "none" ? "" : v })}
                  disabled={form.entity_type === "none"}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {entityOptions().map((o: any) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing && <TaskDetailsExtras taskId={editing.id} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={save} className="bg-gradient-primary">
              {editing ? "Salvar Alterações" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
