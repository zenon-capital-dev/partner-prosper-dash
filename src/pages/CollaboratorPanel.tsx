import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LayoutDashboard, ClipboardList, ListChecks, Users, FileText, UserCog,
  Search, Clock, AlertCircle, CheckCircle2, ArrowRight, Calendar,
  ExternalLink, Loader2, Inbox,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS = ["dashboard", "demandas", "tarefas", "clientes", "documentos", "perfil"] as const;
type Tab = typeof TABS[number];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando início", tone: "bg-slate-100 text-slate-700" },
  em_execucao: { label: "Em execução", tone: "bg-indigo-50 text-indigo-700" },
  pausado: { label: "Pausado", tone: "bg-amber-50 text-amber-700" },
  concluida: { label: "Concluída", tone: "bg-emerald-50 text-emerald-700" },
  cancelada: { label: "Cancelada", tone: "bg-rose-50 text-rose-700" },
};

const TASK_STATUS: Record<string, { label: string; tone: string; done: boolean }> = {
  a_fazer: { label: "A fazer", tone: "bg-slate-100 text-slate-700", done: false },
  em_andamento: { label: "Em andamento", tone: "bg-indigo-50 text-indigo-700", done: false },
  concluida: { label: "Concluída", tone: "bg-emerald-50 text-emerald-700", done: true },
};

export default function CollaboratorPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const activeTab: Tab = (TABS.includes(tabParam as Tab) ? tabParam : "dashboard") as Tab;
  const setActiveTab = (v: string) => navigate(v === "dashboard" ? "/colaborador" : `/colaborador/${v}`);
  const qc = useQueryClient();

  const { data: assignedClients = [] } = useQuery({
    queryKey: ["collab-assigned-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, status, created_at")
        .eq("collaborator_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const assignedClientIds = useMemo(() => assignedClients.map((c: any) => c.id).filter(Boolean), [assignedClients]);

  // --- Demandas atribuídas ---
  const { data: demandas = [], isLoading: loadingDemandas } = useQuery({
    queryKey: ["collab-demandas", user?.id, assignedClientIds.join(",")],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from("client_products")
        .select(`
          id, status, sla_due_date, sla_status, deadline, priority, updated_at, created_at,
          custom_product_name,
          clients ( id, full_name ),
          products ( name )
        `);
      query = assignedClientIds.length > 0
        ? query.or(`responsible_employee_id.eq.${user!.id},client_id.in.(${assignedClientIds.join(",")})`)
        : query.eq("responsible_employee_id", user!.id);

      const { data, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Tarefas atribuídas ---
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["collab-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, priority, status_new, client_id, client_product_id")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Clientes vinculados (via demandas) ---
  const clientIds = useMemo(
    () => Array.from(new Set([...assignedClientIds, ...demandas.map((d: any) => d.clients?.id).filter(Boolean)])),
    [assignedClientIds, demandas]
  );
  const { data: clientes = [] } = useQuery({
    queryKey: ["collab-clients", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, status, created_at")
        .in("id", clientIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Documentos das demandas dele ---
  const demandIds = useMemo(() => demandas.map((d: any) => d.id), [demandas]);
  const { data: docs = [] } = useQuery({
    queryKey: ["collab-docs", user?.id, demandIds.join(","), clientIds.join(",")],
    enabled: !!user?.id && (demandIds.length > 0 || clientIds.length > 0),
    queryFn: async () => {
      let query = supabase
        .from("documents")
        .select("id, name, status, created_at, client_id, client_product_id")
        .order("created_at", { ascending: false })
        .limit(200);

      const filters: string[] = [];
      if (demandIds.length) filters.push(`client_product_id.in.(${demandIds.join(",")})`);
      if (clientIds.length) filters.push(`client_id.in.(${clientIds.join(",")})`);
      if (filters.length) query = query.or(filters.join(","));

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- KPIs ---
  const kpis = useMemo(() => {
    const open = demandas.filter((d: any) => !["concluida", "cancelada"].includes(d.status)).length;
    const overdue = demandas.filter((d: any) => d.sla_status === "atrasado").length;
    const tasksOpen = tasks.filter((t: any) => t.status_new !== "concluida").length;
    const dueToday = tasks.filter((t: any) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length;
    return { open, overdue, tasksOpen, dueToday };
  }, [demandas, tasks]);

  // --- Toggle task done ---
  async function toggleTask(t: any) {
    const next = t.status_new === "concluida" ? "a_fazer" : "concluida";
    const { error } = await supabase.from("tasks").update({ status_new: next, completed_at: next === "concluida" ? new Date().toISOString() : null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(next === "concluida" ? "Tarefa concluída" : "Tarefa reaberta");
    qc.invalidateQueries({ queryKey: ["collab-tasks"] });
  }

  // --- Filtros locais ---
  const [demandSearch, setDemandSearch] = useState("");
  const [demandStatus, setDemandStatus] = useState("todos");
  const filteredDemandas = useMemo(() => demandas.filter((d: any) => {
    const matchSearch = !demandSearch || (d.clients?.full_name || "").toLowerCase().includes(demandSearch.toLowerCase()) || (d.products?.name || d.custom_product_name || "").toLowerCase().includes(demandSearch.toLowerCase());
    const matchStatus = demandStatus === "todos" || d.status === demandStatus;
    return matchSearch && matchStatus;
  }), [demandas, demandSearch, demandStatus]);

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="border-b border-slate-200/70 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Painel do Colaborador</p>
              <h1 className="text-[22px] font-semibold text-slate-900 mt-1">Minha operação</h1>
              <p className="text-sm text-slate-500 mt-0.5">Demandas e tarefas atribuídas a você.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/clientes" className="gap-2">
                <Users className="size-4" /> Ver lista de clientes
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-200/70 p-1 h-auto rounded-lg shadow-sm flex-wrap">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="size-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="demandas" className="gap-2"><ClipboardList className="size-4" /> Minhas Demandas</TabsTrigger>
            <TabsTrigger value="tarefas" className="gap-2"><ListChecks className="size-4" /> Tarefas</TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2"><Users className="size-4" /> Clientes</TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2"><FileText className="size-4" /> Documentos</TabsTrigger>
            <TabsTrigger value="perfil" className="gap-2"><UserCog className="size-4" /> Perfil</TabsTrigger>
          </TabsList>

          {/* ============ DASHBOARD ============ */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Demandas abertas" value={kpis.open} icon={ClipboardList} tone="indigo" />
              <Kpi label="Atrasadas" value={kpis.overdue} icon={AlertCircle} tone="rose" />
              <Kpi label="Tarefas pendentes" value={kpis.tasksOpen} icon={ListChecks} tone="amber" />
              <Kpi label="Vencem hoje" value={kpis.dueToday} icon={Clock} tone="emerald" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-900">Demandas recentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {demandas.slice(0, 5).map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/colaborador/demandas`)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 text-left transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{d.clients?.full_name || "Sem cliente"}</p>
                        <p className="text-xs text-slate-500 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                      </div>
                      <Badge variant="secondary" className={cn("text-[10px]", STATUS_META[d.status]?.tone || "bg-slate-100")}>
                        {STATUS_META[d.status]?.label || d.status}
                      </Badge>
                    </button>
                  ))}
                  {!loadingDemandas && demandas.length === 0 && <EmptyHint message="Nenhuma demanda atribuída ainda" />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-900">Próximas tarefas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.filter((t: any) => t.status_new !== "concluida").slice(0, 5).map((t: any) => (
                    <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50">
                      <Checkbox checked={false} onCheckedChange={() => toggleTask(t)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                        {t.due_date && <p className="text-xs text-slate-500"><Calendar className="size-3 inline mr-1" />{formatDate(t.due_date)}</p>}
                      </div>
                    </div>
                  ))}
                  {!loadingTasks && tasks.filter((t: any) => t.status_new !== "concluida").length === 0 && <EmptyHint message="Sem tarefas pendentes" />}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============ DEMANDAS ============ */}
          <TabsContent value="demandas" className="mt-6 space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input placeholder="Buscar cliente ou produto..." value={demandSearch} onChange={(e) => setDemandSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={demandStatus} onValueChange={setDemandStatus}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="aguardando_inicio">Aguardando início</SelectItem>
                  <SelectItem value="em_execucao">Em execução</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingDemandas ? <LoadingRow /> : filteredDemandas.length === 0 ? (
                  <EmptyHint message="Nenhuma demanda encontrada" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredDemandas.map((d: any) => (
                      <button
                        key={d.id}
                        onClick={() => navigate(`/demandas/${d.id}`)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 text-left transition group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">{d.clients?.full_name || "—"}</p>
                            <Badge variant="secondary" className={cn("text-[10px]", STATUS_META[d.status]?.tone || "bg-slate-100")}>{STATUS_META[d.status]?.label || d.status}</Badge>
                            {d.sla_status === "atrasado" && <Badge variant="destructive" className="text-[10px]">SLA atrasado</Badge>}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          {d.deadline && <p className="text-[11px] text-slate-400 mt-0.5">Prazo: {formatDate(d.deadline)}</p>}
                        </div>
                        <ArrowRight className="size-4 text-slate-400 group-hover:text-indigo-600 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TAREFAS ============ */}
          <TabsContent value="tarefas" className="mt-6">
            <Card>
              <CardContent className="p-0">
                {loadingTasks ? <LoadingRow /> : tasks.length === 0 ? (
                  <EmptyHint message="Nenhuma tarefa atribuída" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {tasks.map((t: any) => {
                      const meta = TASK_STATUS[t.status_new] || TASK_STATUS.a_fazer;
                      return (
                        <div key={t.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50">
                          <Checkbox checked={meta.done} onCheckedChange={() => toggleTask(t)} className="mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium", meta.done ? "line-through text-slate-400" : "text-slate-900")}>{t.title}</p>
                            {t.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>}
                            <div className="flex items-center gap-3 mt-1.5">
                              <Badge variant="secondary" className={cn("text-[10px]", meta.tone)}>{meta.label}</Badge>
                              {t.due_date && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Calendar className="size-3" />{formatDate(t.due_date)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ CLIENTES (read-only) ============ */}
          <TabsContent value="clientes" className="mt-6">
            <div className="text-xs text-slate-500 mb-3 flex items-center gap-2">
              <AlertCircle className="size-3.5" /> Modo somente leitura. Lista filtrada pelos clientes das suas demandas.
            </div>
            <Card>
              <CardContent className="p-0">
                {clientes.length === 0 ? (
                  <EmptyHint message="Nenhum cliente vinculado às suas demandas" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {clientes.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">{c.email || "—"} · {c.phone || "—"}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ DOCUMENTOS ============ */}
          <TabsContent value="documentos" className="mt-6">
            <Card>
              <CardContent className="p-0">
                {docs.length === 0 ? (
                  <EmptyHint message="Nenhum documento nas suas demandas" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {docs.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50">
                        <div className="min-w-0 flex items-center gap-3">
                          <FileText className="size-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                            <p className="text-[11px] text-slate-500">{formatDate(d.created_at)}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">{d.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ PERFIL ============ */}
          <TabsContent value="perfil" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Meus dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-slate-500">Nome:</span> {user?.user_metadata?.full_name || "—"}</p>
                <p><span className="text-slate-500">Email:</span> {user?.email}</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/perfil">Editar perfil completo <ArrowRight className="size-3.5 ml-1.5" /></Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "indigo" | "rose" | "amber" | "emerald" }) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2 font-mono">{value}</p>
          </div>
          <div className={cn("size-9 rounded-lg flex items-center justify-center", toneClass)}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="size-8 text-slate-300 mb-2" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-5 text-slate-400 animate-spin" />
    </div>
  );
}
