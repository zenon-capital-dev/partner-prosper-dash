import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, ClipboardList, ListChecks, Users, FileText, UserCog,
  Search, Clock, AlertCircle, CheckCircle2, Calendar, Inbox, Loader2,
  Phone, Mail, Building2, ArrowUpRight, Flame, CalendarDays, Filter,
  ChevronRight, LogOut,
} from "lucide-react";
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV = [
  { v: "dashboard", icon: LayoutDashboard, label: "Visão geral" },
  { v: "demandas",  icon: ClipboardList,  label: "Minhas demandas" },
  { v: "tarefas",   icon: ListChecks,     label: "Tarefas" },
  { v: "clientes",  icon: Users,          label: "Clientes" },
  { v: "documentos",icon: FileText,       label: "Documentos" },
  { v: "perfil",    icon: UserCog,        label: "Perfil" },
] as const;
type Tab = typeof NAV[number]["v"];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando início", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  em_execucao:       { label: "Em execução",       tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pausado:           { label: "Pausada",           tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida:         { label: "Concluída",         tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada:         { label: "Cancelada",         tone: "bg-rose-50 text-rose-700 border-rose-200" },
};
const TASK_STATUS: Record<string, { label: string; tone: string; done: boolean }> = {
  a_fazer:      { label: "A fazer",      tone: "bg-slate-100 text-slate-700",   done: false },
  em_andamento: { label: "Em andamento", tone: "bg-indigo-50 text-indigo-700",  done: false },
  concluida:    { label: "Concluída",    tone: "bg-emerald-50 text-emerald-700", done: true },
};
const PRIORITY_TONE: Record<string, string> = {
  alta: "bg-rose-50 text-rose-700 border-rose-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

function isToday(d: string | null | undefined) {
  if (!d) return false;
  const a = new Date(d);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isOverdue(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d).getTime() < new Date(new Date().toDateString()).getTime();
}
function isThisWeek(d: string | null | undefined) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

export default function CollaboratorPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const activeTab: Tab = (NAV.find((n) => n.v === tabParam)?.v ?? "dashboard") as Tab;
  const goTab = (v: Tab) => navigate(v === "dashboard" ? "/colaborador" : `/colaborador/${v}`);
  const qc = useQueryClient();

  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ===== DATA =====
  const { data: demandas = [], isLoading: loadingDemandas } = useQuery({
    queryKey: ["collab-demandas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          id, status, sla_due_date, sla_status, deadline, priority, updated_at, created_at,
          custom_product_name, value, start_date,
          clients ( id, full_name, email, phone, status, document_number ),
          products ( name )
        `)
        .eq("responsible_employee_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["collab-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, priority, status_new, client_id, client_product_id, kind")
        .eq("assigned_to", user!.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientes = useMemo(() => {
    const seen = new Map<string, any>();
    for (const d of demandas as any[]) {
      const c = d.clients;
      if (c?.id && !seen.has(c.id)) seen.set(c.id, { ...c, _demands: 0 });
      if (c?.id) seen.get(c.id)._demands += 1;
    }
    return Array.from(seen.values());
  }, [demandas]);
  const demandIds = useMemo(() => (demandas as any[]).map((d) => d.id), [demandas]);

  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["collab-docs", demandIds.join(",")],
    enabled: demandIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, status, created_at, client_id, client_product_id")
        .in("client_product_id", demandIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const open = (demandas as any[]).filter((d) => !["concluida", "cancelada"].includes(d.status)).length;
    const overdue = (demandas as any[]).filter((d) => d.sla_status === "atrasado").length;
    const tasksOpen = (tasks as any[]).filter((t) => t.status_new !== "concluida").length;
    const dueToday = (tasks as any[]).filter((t) => t.status_new !== "concluida" && isToday(t.due_date)).length;
    return { open, overdue, tasksOpen, dueToday };
  }, [demandas, tasks]);

  async function toggleTask(t: any) {
    const next = t.status_new === "concluida" ? "a_fazer" : "concluida";
    const { error } = await supabase
      .from("tasks")
      .update({ status_new: next, completed_at: next === "concluida" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(next === "concluida" ? "Tarefa concluída" : "Tarefa reaberta");
    qc.invalidateQueries({ queryKey: ["collab-tasks"] });
  }

  const [demandStatus, setDemandStatus] = useState("todos");
  const filteredDemandas = useMemo(() => (demandas as any[]).filter((d) => {
    const s = search.toLowerCase();
    const matchSearch = !s
      || (d.clients?.full_name || "").toLowerCase().includes(s)
      || (d.products?.name || d.custom_product_name || "").toLowerCase().includes(s);
    const matchStatus = demandStatus === "todos" || d.status === demandStatus;
    return matchSearch && matchStatus;
  }), [demandas, search, demandStatus]);

  const filteredClientes = useMemo(() => clientes.filter((c) => {
    const s = search.toLowerCase();
    return !s || (c.full_name || "").toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s);
  }), [clientes, search]);

  // Tarefas agrupadas
  const taskGroups = useMemo(() => {
    const all = tasks as any[];
    const open = all.filter((t) => t.status_new !== "concluida");
    return {
      overdue: open.filter((t) => isOverdue(t.due_date) && !isToday(t.due_date)),
      today: open.filter((t) => isToday(t.due_date)),
      week: open.filter((t) => !isOverdue(t.due_date) && !isToday(t.due_date) && isThisWeek(t.due_date)),
      later: open.filter((t) => t.due_date && !isToday(t.due_date) && !isOverdue(t.due_date) && !isThisWeek(t.due_date)),
      noDate: open.filter((t) => !t.due_date),
      done: all.filter((t) => t.status_new === "concluida").slice(0, 20),
    };
  }, [tasks]);

  return (
    <div className="min-h-screen flex bg-slate-50/60">
      {/* ============ SIDEBAR ============ */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Painel</p>
          <h1 className="text-[15px] font-semibold text-slate-900 mt-0.5">Operação</h1>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map((n) => {
            const active = activeTab === n.v;
            return (
              <button
                key={n.v}
                onClick={() => goTab(n.v)}
                className={cn(
                  "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-indigo-600" />}
                <n.icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {initials(user?.user_metadata?.full_name || user?.email || "C")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.user_metadata?.full_name || "Colaborador"}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button onClick={() => signOut?.()} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Sair">
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* HEADER */}
        <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-slate-200/70">
          <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-3">
            {/* Mobile select */}
            <div className="lg:hidden">
              <Select value={activeTab} onValueChange={(v) => goTab(v as Tab)}>
                <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NAV.map((n) => (
                    <SelectItem key={n.v} value={n.v}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente, demanda…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-slate-50 border-slate-200/70 focus-visible:bg-white"
              />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="size-4" />
              <span className="font-medium text-slate-700">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </span>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto">
          {/* ===== DASHBOARD ===== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[22px] font-semibold text-slate-900 tracking-tight">
                  Olá, {(user?.user_metadata?.full_name || "").split(" ")[0] || "colaborador"} 👋
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Aqui está o que precisa da sua atenção hoje.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Demandas abertas" value={kpis.open} icon={ClipboardList} tone="indigo" />
                <Kpi label="SLA atrasado" value={kpis.overdue} icon={AlertCircle} tone="rose" />
                <Kpi label="Tarefas abertas" value={kpis.tasksOpen} icon={ListChecks} tone="amber" />
                <Kpi label="Vencem hoje" value={kpis.dueToday} icon={Flame} tone="emerald" />
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                <Panel
                  title="Para agora"
                  subtitle={`${taskGroups.overdue.length + taskGroups.today.length} pendência(s)`}
                  className="lg:col-span-2"
                >
                  {taskGroups.overdue.length === 0 && taskGroups.today.length === 0 ? (
                    <EmptyHint message="Tudo em dia. Bom trabalho." icon={CheckCircle2} />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {taskGroups.overdue.map((t) => <TaskRow key={t.id} t={t} overdue onToggle={() => toggleTask(t)} />)}
                      {taskGroups.today.map((t) => <TaskRow key={t.id} t={t} today onToggle={() => toggleTask(t)} />)}
                    </div>
                  )}
                </Panel>

                <Panel title="Demandas em destaque" subtitle="Atualizadas recentemente">
                  {(demandas as any[]).slice(0, 5).length === 0 ? (
                    <EmptyHint message="Nenhuma demanda atribuída" icon={ClipboardList} />
                  ) : (
                    <div className="space-y-1">
                      {(demandas as any[]).slice(0, 5).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setOpenClientId(d.clients?.id || null)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 text-left transition"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{d.clients?.full_name || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[d.status]?.tone || "bg-slate-100")}>
                            {STATUS_META[d.status]?.label || d.status}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <Panel title="Esta semana" subtitle={`${taskGroups.week.length} tarefa(s)`}>
                  {taskGroups.week.length === 0 ? <EmptyHint message="Nada agendado nos próximos 7 dias" icon={Calendar} />
                    : <div className="divide-y divide-slate-100">{taskGroups.week.map((t) => <TaskRow key={t.id} t={t} onToggle={() => toggleTask(t)} />)}</div>}
                </Panel>
                <Panel title="Últimos documentos" subtitle={`${docs.length} no total`}>
                  {loadingDocs ? <LoadingRow /> : docs.length === 0 ? <EmptyHint message="Nenhum documento" icon={FileText} />
                    : <div className="divide-y divide-slate-100">
                        {docs.slice(0, 6).map((d: any) => (
                          <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-7 rounded bg-slate-100 flex items-center justify-center shrink-0"><FileText className="size-3.5 text-slate-500" /></div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                                <p className="text-[11px] text-slate-500">{formatDate(d.created_at)}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize border-slate-200">{d.status}</Badge>
                          </div>
                        ))}
                      </div>}
                </Panel>
              </div>
            </div>
          )}

          {/* ===== DEMANDAS ===== */}
          {activeTab === "demandas" && (
            <div className="space-y-4">
              <SectionHeader title="Minhas demandas" count={filteredDemandas.length} icon={ClipboardList}>
                <div className="flex items-center gap-2">
                  <Filter className="size-3.5 text-slate-400" />
                  <Select value={demandStatus} onValueChange={setDemandStatus}>
                    <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="aguardando_inicio">Aguardando início</SelectItem>
                      <SelectItem value="em_execucao">Em execução</SelectItem>
                      <SelectItem value="pausado">Pausada</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SectionHeader>

              {loadingDemandas ? <LoadingRow /> : filteredDemandas.length === 0 ? (
                <EmptyState message="Nenhuma demanda encontrada" icon={ClipboardList} />
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredDemandas.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => setOpenClientId(d.clients?.id || null)}
                      className="group text-left bg-white border border-slate-200/70 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-9 shrink-0"><AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-semibold">{initials(d.clients?.full_name || "?")}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{d.clients?.full_name || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="size-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[d.status]?.tone)}>{STATUS_META[d.status]?.label || d.status}</Badge>
                        {d.sla_status === "atrasado" && <Badge variant="outline" className="text-[10px] border bg-rose-50 text-rose-700 border-rose-200">SLA atrasado</Badge>}
                        {d.priority && <Badge variant="outline" className={cn("text-[10px] border capitalize", PRIORITY_TONE[d.priority] || "bg-slate-100")}>{d.priority}</Badge>}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                        <span className="flex items-center gap-1"><Calendar className="size-3" /> {d.deadline ? formatDate(d.deadline) : "Sem prazo"}</span>
                        <span>Atualizada {formatDate(d.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== TAREFAS ===== */}
          {activeTab === "tarefas" && (
            <div className="space-y-5">
              <SectionHeader title="Tarefas" count={tasks.length} icon={ListChecks} />
              {loadingTasks ? <LoadingRow /> : tasks.length === 0 ? (
                <EmptyState message="Nenhuma tarefa atribuída" icon={ListChecks} />
              ) : (
                <div className="space-y-4">
                  <TaskGroup label="Atrasadas" tone="rose" items={taskGroups.overdue} onToggle={toggleTask} />
                  <TaskGroup label="Hoje" tone="indigo" items={taskGroups.today} onToggle={toggleTask} />
                  <TaskGroup label="Esta semana" tone="amber" items={taskGroups.week} onToggle={toggleTask} />
                  <TaskGroup label="Mais para frente" tone="slate" items={taskGroups.later} onToggle={toggleTask} />
                  <TaskGroup label="Sem data" tone="slate" items={taskGroups.noDate} onToggle={toggleTask} />
                  <TaskGroup label="Concluídas" tone="emerald" items={taskGroups.done} onToggle={toggleTask} collapsedDefault />
                </div>
              )}
            </div>
          )}

          {/* ===== CLIENTES ===== */}
          {activeTab === "clientes" && (
            <div className="space-y-4">
              <SectionHeader title="Meus clientes" count={filteredClientes.length} icon={Users}>
                <p className="text-xs text-slate-500">Apenas leitura · derivados das suas demandas</p>
              </SectionHeader>
              {filteredClientes.length === 0 ? (
                <EmptyState message="Nenhum cliente vinculado às suas demandas" icon={Users} />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredClientes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setOpenClientId(c.id)}
                      className="group text-left bg-white border border-slate-200/70 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="size-11"><AvatarFallback className="bg-indigo-50 text-indigo-700 text-sm font-semibold">{initials(c.full_name)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5"><Mail className="size-3" />{c.email || "—"}</p>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5"><Phone className="size-3" />{c.phone || "—"}</p>
                        </div>
                        <ChevronRight className="size-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-600">{c.status || "—"}</Badge>
                        <span className="text-[11px] font-mono font-semibold text-slate-700">{c._demands} demanda{c._demands > 1 ? "s" : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== DOCUMENTOS ===== */}
          {activeTab === "documentos" && (
            <div className="space-y-4">
              <SectionHeader title="Documentos" count={docs.length} icon={FileText} />
              {loadingDocs ? <LoadingRow /> : docs.length === 0 ? (
                <EmptyState message="Nenhum documento nas suas demandas" icon={FileText} />
              ) : (
                <Card className="border-slate-200/70 shadow-sm">
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {(docs as any[]).map((d) => {
                        const cli = clientes.find((c) => c.id === d.client_id);
                        return (
                          <button
                            key={d.id}
                            onClick={() => cli && setOpenClientId(cli.id)}
                            className="w-full flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 text-left transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-9 rounded bg-slate-100 flex items-center justify-center shrink-0"><FileText className="size-4 text-slate-500" /></div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{d.name}</p>
                                <p className="text-[11px] text-slate-500">{cli?.full_name || "—"} · {formatDate(d.created_at)}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-600">{d.status}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ===== PERFIL ===== */}
          {activeTab === "perfil" && (
            <div className="max-w-2xl space-y-4">
              <SectionHeader title="Meu perfil" icon={UserCog} />
              <Card className="border-slate-200/70 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                    <Avatar className="size-14"><AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold">{initials(user?.user_metadata?.full_name || user?.email || "C")}</AvatarFallback></Avatar>
                    <div>
                      <p className="text-base font-semibold text-slate-900">{user?.user_metadata?.full_name || "—"}</p>
                      <p className="text-sm text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm">
                    <Info label="ID" value={user?.id?.slice(0, 8)} />
                    <Info label="Cargo" value="Colaborador" />
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-5">
                    <Link to="/perfil">Editar perfil completo</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* ===== CLIENT DETAIL DRAWER ===== */}
      <ClientDrawer clientId={openClientId} onClose={() => setOpenClientId(null)} userId={user?.id} />
    </div>
  );
}

/* =============== Sub-components =============== */
function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "indigo" | "rose" | "amber" | "emerald" }) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-[26px] font-bold text-slate-900 mt-1.5 font-mono leading-none">{value}</p>
        </div>
        <div className={cn("size-9 rounded-md flex items-center justify-center", toneClass)}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-slate-200/70 rounded-lg shadow-sm", className)}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function SectionHeader({ title, count, icon: Icon, children }: { title: string; count?: number; icon: any; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center"><Icon className="size-4" /></div>
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</h2>
          {typeof count === "number" && <p className="text-[11px] text-slate-500 font-mono">{count} item{count !== 1 ? "s" : ""}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function TaskRow({ t, overdue, today, onToggle }: { t: any; overdue?: boolean; today?: boolean; onToggle: () => void }) {
  const meta = TASK_STATUS[t.status_new] || TASK_STATUS.a_fazer;
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 rounded">
      <Checkbox checked={meta.done} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", meta.done ? "line-through text-slate-400" : "text-slate-900")}>{t.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">Atrasada</span>}
          {today && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">Hoje</span>}
          {t.due_date && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Calendar className="size-3" />{formatDate(t.due_date)}</span>}
          {t.priority && <span className={cn("text-[10px] px-1.5 py-0.5 rounded capitalize", PRIORITY_TONE[t.priority] || "bg-slate-100 text-slate-700")}>{t.priority}</span>}
        </div>
      </div>
    </div>
  );
}

function TaskGroup({ label, tone, items, onToggle, collapsedDefault }: { label: string; tone: "rose"|"indigo"|"amber"|"slate"|"emerald"; items: any[]; onToggle: (t: any)=>void; collapsedDefault?: boolean }) {
  const [open, setOpen] = useState(!collapsedDefault);
  if (items.length === 0) return null;
  const toneClass = {
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded", toneClass)}>{label}</span>
          <span className="text-[11px] text-slate-500 font-mono">{items.length}</span>
        </div>
        <ChevronRight className={cn("size-4 text-slate-400 transition", open && "rotate-90")} />
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {items.map((t) => <TaskRow key={t.id} t={t} onToggle={() => onToggle(t)} />)}
        </div>
      )}
    </div>
  );
}

function EmptyHint({ message, icon: Icon = Inbox }: { message: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon className="size-7 text-slate-300 mb-2" />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}
function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: any }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center py-16 text-center">
      <Icon className="size-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
function LoadingRow() {
  return <div className="flex items-center justify-center py-10"><Loader2 className="size-5 text-slate-400 animate-spin" /></div>;
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5">{value || "—"}</p>
    </div>
  );
}

/* =============== Client detail drawer =============== */
function ClientDrawer({ clientId, onClose, userId }: { clientId: string | null; onClose: () => void; userId?: string }) {
  const open = !!clientId;
  const { data: client } = useQuery({
    queryKey: ["collab-client-detail", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: company } = useQuery({
    queryKey: ["collab-client-company", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("client_id", clientId!).maybeSingle();
      return data;
    },
  });
  const { data: clientDemandas = [] } = useQuery({
    queryKey: ["collab-client-demandas", clientId, userId],
    enabled: !!clientId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select("id, status, sla_status, deadline, priority, updated_at, custom_product_name, value, products(name)")
        .eq("client_id", clientId!)
        .eq("responsible_employee_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: clientTasks = [] } = useQuery({
    queryKey: ["collab-client-tasks", clientId, userId],
    enabled: !!clientId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, status_new, priority")
        .eq("client_id", clientId!)
        .eq("assigned_to", userId!)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const demandIds = (clientDemandas as any[]).map((d) => d.id);
  const { data: clientDocs = [] } = useQuery({
    queryKey: ["collab-client-docs", clientId, demandIds.join(",")],
    enabled: !!clientId && demandIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, status, created_at")
        .in("client_product_id", demandIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto bg-slate-50/40">
        {!client ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="size-5 animate-spin text-slate-400" /></div>
        ) : (
          <div>
            <SheetHeader className="bg-white border-b border-slate-200/70 px-6 py-5">
              <div className="flex items-start gap-4">
                <Avatar className="size-14"><AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold text-base">{initials(client.full_name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-[17px] text-slate-900 truncate">{client.full_name}</SheetTitle>
                  <p className="text-xs text-slate-500 mt-0.5">{client.email || "—"}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-700">{client.status || "—"}</Badge>
                    {client.document_number && <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 font-mono">{client.document_number}</Badge>}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="p-5 space-y-5">
              {/* Contato */}
              <Card className="border-slate-200/70 shadow-sm">
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Telefone" value={client.phone} />
                  <Info label="Empresa" value={company?.legal_name || company?.trade_name || "—"} />
                  <Info label="CNPJ" value={company?.cnpj} />
                  <Info label="Cidade" value={[client.address_city, client.address_state].filter(Boolean).join(" / ") || "—"} />
                </CardContent>
              </Card>

              <Tabs defaultValue="demandas">
                <TabsList className="bg-white border border-slate-200/70 p-1 h-auto rounded-lg w-full grid grid-cols-3">
                  <TabsTrigger value="demandas" className="text-xs data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold">Demandas ({clientDemandas.length})</TabsTrigger>
                  <TabsTrigger value="tarefas" className="text-xs data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold">Tarefas ({clientTasks.length})</TabsTrigger>
                  <TabsTrigger value="docs" className="text-xs data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold">Docs ({clientDocs.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="demandas" className="mt-3 space-y-2">
                  {clientDemandas.length === 0 ? <EmptyHint message="Nenhuma demanda sua para este cliente" icon={ClipboardList} />
                    : (clientDemandas as any[]).map((d) => (
                      <div key={d.id} className="bg-white border border-slate-200/70 rounded-lg p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{d.products?.name || d.custom_product_name || "—"}</p>
                          <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[d.status]?.tone)}>{STATUS_META[d.status]?.label || d.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                          {d.deadline && <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(d.deadline)}</span>}
                          {d.sla_status === "atrasado" && <span className="text-rose-600 font-semibold">SLA atrasado</span>}
                          {d.priority && <span className="capitalize">· {d.priority}</span>}
                        </div>
                      </div>
                    ))}
                </TabsContent>

                <TabsContent value="tarefas" className="mt-3 space-y-1">
                  {clientTasks.length === 0 ? <EmptyHint message="Nenhuma tarefa atribuída a você para este cliente" icon={ListChecks} />
                    : (clientTasks as any[]).map((t) => (
                      <div key={t.id} className="bg-white border border-slate-200/70 rounded-lg px-3.5 py-2.5 shadow-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                          <p className="text-[11px] text-slate-500">{t.due_date ? formatDate(t.due_date) : "Sem prazo"}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border", TASK_STATUS[t.status_new]?.tone || "bg-slate-100")}>{TASK_STATUS[t.status_new]?.label || t.status_new}</Badge>
                      </div>
                    ))}
                </TabsContent>

                <TabsContent value="docs" className="mt-3 space-y-1">
                  {clientDocs.length === 0 ? <EmptyHint message="Nenhum documento" icon={FileText} />
                    : (clientDocs as any[]).map((d) => (
                      <div key={d.id} className="bg-white border border-slate-200/70 rounded-lg px-3.5 py-2.5 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="size-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                            <p className="text-[11px] text-slate-500">{formatDate(d.created_at)}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-600">{d.status}</Badge>
                      </div>
                    ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
