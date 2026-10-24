import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  LayoutDashboard, ClipboardList, ListChecks, Users, FileText, UserCog,
  CheckCircle2, AlertCircle, Calendar, Inbox, Clock, Flame, Search,
  ChevronRight, Mail, Phone, Wallet, LifeBuoy,
} from "lucide-react";
import { PanelShell } from "@/components/panels/PanelShell";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, initials, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UserSupportCenter } from "@/components/support/UserSupportCenter";

const NAV = [
  { key: "dashboard",  label: "Início",     shortLabel: "Início",   icon: LayoutDashboard },
  { key: "demandas",   label: "Demandas",   shortLabel: "Demandas", icon: ClipboardList  },
  { key: "tarefas",    label: "Tarefas",    shortLabel: "Tarefas",  icon: ListChecks     },
  { key: "comissoes",  label: "Comissões",  shortLabel: "Comissões",icon: Wallet         },
  { key: "documentos", label: "Documentos", shortLabel: "Docs",     icon: FileText       },
  { key: "perfil",     label: "Perfil",     shortLabel: "Perfil",   icon: UserCog        },
  { key: "clientes",   label: "Clientes",                            icon: Users          },
  { key: "suporte",    label: "Suporte",                             icon: LifeBuoy       },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando início", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  em_andamento:      { label: "Em andamento",      tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  em_execucao:       { label: "Em execução",       tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pausado:           { label: "Pausada",           tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida:         { label: "Concluída",         tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluido:         { label: "Concluída",         tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada:         { label: "Cancelada",         tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

const isToday = (d?: string | null) => { if (!d) return false; const a = new Date(d), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
const isOverdue = (d?: string | null) => { if (!d) return false; const today = new Date(); today.setHours(0, 0, 0, 0); return new Date(d) < today; };

export default function CollaboratorPanel() {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [demandStatus, setDemandStatus] = useState("todos");

  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/colaborador" : `/colaborador/${k}`);

  const { data: demandas = [], isLoading: loadingDemandas } = useQuery({
    queryKey: ["collab-demandas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`id, status, sla_due_date, sla_status, deadline, priority, updated_at, created_at,
                 custom_product_name, value, start_date,
                 clients ( id, full_name, email, phone, status, document ),
                 products ( name )`)
        .eq("responsible_employee_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["collab-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, priority, status_new, client_id, client_product_id")
        .eq("assigned_to", user!.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const demandIds = useMemo(() => (demandas as any[]).map((d) => d.id), [demandas]);
  const { data: docs = [] } = useQuery({
    queryKey: ["collab-docs", user?.id, demandIds.join(",")],
    enabled: !!user?.id,
    queryFn: async () => {
      const filters: string[] = [`collaborator_id.eq.${user!.id}`];
      if (demandIds.length > 0) filters.push(`client_product_id.in.(${demandIds.join(",")})`);
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, status, created_at, due_date, description, client_id, client_product_id, clients(full_name)")
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: comissoes = [], isLoading: loadingComissoes } = useQuery({
    queryKey: ["collab-comissoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: splits } = await supabase
        .from("commission_splits")
        .select("*, sales(amount, sale_date, clients(full_name), products(name))")
        .eq("beneficiary_type", "collaborator")
        .eq("beneficiary_id", user!.id)
        .order("created_at", { ascending: false });
      return splits ?? [];
    },
  });
  const comissoesKpis = useMemo(() => {
    const total = (comissoes as any[]).reduce((a, c) => a + Number(c.amount || 0), 0);
    const pago = (comissoes as any[]).filter((c) => c.status === "pago").reduce((a, c) => a + Number(c.amount || 0), 0);
    const pendente = (comissoes as any[]).filter((c) => c.status === "pendente").reduce((a, c) => a + Number(c.amount || 0), 0);
    return { total, pago, pendente, count: (comissoes as any[]).length };
  }, [comissoes]);

  const clientes = useMemo(() => {
    const m = new Map<string, any>();
    for (const d of demandas as any[]) {
      const c = d.clients; if (!c?.id) continue;
      if (!m.has(c.id)) m.set(c.id, { ...c, _count: 0 });
      m.get(c.id)._count += 1;
    }
    return Array.from(m.values());
  }, [demandas]);

  const kpis = useMemo(() => {
    const open = (demandas as any[]).filter((d) => !["concluida", "cancelada", "concluido", "cancelado"].includes(d.status)).length;
    const overdue = (demandas as any[]).filter((d) => {
      if (["concluida", "cancelada", "concluido", "cancelado"].includes(d.status)) return false;
      if (d.sla_status === "atrasado") return true;
      const due = d.deadline || d.sla_due_date || d.end_date;
      return due && isOverdue(due);
    }).length;
    const tasksOpen = (tasks as any[]).filter((t) => t.status_new !== "concluida").length;
    const dueToday = (tasks as any[]).filter((t) => t.status_new !== "concluida" && isToday(t.due_date)).length;
    return { open, overdue, tasksOpen, dueToday };
  }, [demandas, tasks]);

  const taskGroups = useMemo(() => {
    const open = (tasks as any[]).filter((t) => t.status_new !== "concluida");
    return {
      overdue: open.filter((t) => isOverdue(t.due_date) && !isToday(t.due_date)),
      today: open.filter((t) => isToday(t.due_date)),
      upcoming: open.filter((t) => !isOverdue(t.due_date) && !isToday(t.due_date)).slice(0, 30),
      done: (tasks as any[]).filter((t) => t.status_new === "concluida").slice(0, 20),
    };
  }, [tasks]);

  const filteredDemandas = useMemo(() => (demandas as any[]).filter((d) => {
    const s = search.toLowerCase();
    const m = !s || (d.clients?.full_name || "").toLowerCase().includes(s) || (d.products?.name || d.custom_product_name || "").toLowerCase().includes(s);
    return m && (demandStatus === "todos" || d.status === demandStatus);
  }), [demandas, search, demandStatus]);

  async function toggleTask(t: any) {
    const next = t.status_new === "concluida" ? "a_fazer" : "concluida";
    const { error } = await supabase.from("tasks").update({ status_new: next, completed_at: next === "concluida" ? new Date().toISOString() : null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(next === "concluida" ? "Tarefa concluída" : "Tarefa reaberta");
    qc.invalidateQueries({ queryKey: ["collab-tasks"] });
  }

  const firstName = (user?.user_metadata?.full_name || user?.email || "Colaborador").split(" ")[0];

  return (
    <PanelShell
      role="colaborador"
      nav={NAV}
      activeKey={activeKey}
      onNavigate={onNavigate}
      notifCount={kpis.overdue + kpis.dueToday}
    >
      <PanelContainer>
        {activeKey === "dashboard" && (
          <>
            <PanelHero
              role="colaborador"
              eyebrow="Painel do colaborador"
              title={<>Olá, {firstName} 👋</>}
              subtitle="Aqui está o que precisa da sua atenção agora."
              stats={[
                { label: "Demandas abertas", value: kpis.open },
                { label: "SLA atrasado", value: kpis.overdue, sub: kpis.overdue ? "ação imediata" : "tudo em dia" },
                { label: "Tarefas abertas", value: kpis.tasksOpen },
                { label: "Vencem hoje", value: kpis.dueToday },
              ]}
            />

            <div className="grid lg:grid-cols-3 gap-5">
              <SectionCard
                className="lg:col-span-2"
                title="Para agora"
                subtitle={`${taskGroups.overdue.length + taskGroups.today.length} pendência(s)`}
                icon={Flame}
              >
                {taskGroups.overdue.length === 0 && taskGroups.today.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Tudo em dia" description="Bom trabalho. Nada urgente agora." />
                ) : (
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {taskGroups.overdue.map((t) => <TaskRow key={t.id} t={t} tone="overdue" onToggle={() => toggleTask(t)} />)}
                    {taskGroups.today.map((t) => <TaskRow key={t.id} t={t} tone="today" onToggle={() => toggleTask(t)} />)}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Demandas em destaque" subtitle="Mais recentes" icon={ClipboardList}>
                {demandas.length === 0 ? (
                  <EmptyState icon={Inbox} title="Sem demandas" description="Você ainda não foi atribuído a nenhuma demanda." />
                ) : (
                  <ul className="space-y-1 -mx-1">
                    {(demandas as any[]).slice(0, 5).map((d) => (
                      <li key={d.id}>
                        <button onClick={() => onNavigate("demandas")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 text-left transition">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{d.clients?.full_name || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] border shrink-0", STATUS_META[d.status]?.tone || "bg-slate-100")}>
                            {STATUS_META[d.status]?.label || d.status}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            <SectionCard title="Documentos recentes" subtitle={`${docs.length} documento(s)`} icon={FileText}>
              {docs.length === 0 ? (
                <EmptyState icon={FileText} title="Sem documentos" />
              ) : (
                <ul className="divide-y divide-slate-100 -mx-1">
                  {docs.slice(0, 6).map((d: any) => (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="size-8 rounded-md bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400 shrink-0">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{d.name}</p>
                        <p className="text-[11px] text-slate-500">{d.clients?.full_name || ""} · {formatDate(d.created_at)}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize border-slate-200">{d.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </>
        )}

        {activeKey === "demandas" && (
          <>
            <PanelHero
              role="colaborador"
              eyebrow="Operação"
              title="Minhas demandas"
              subtitle={`${filteredDemandas.length} de ${demandas.length} demanda(s) sob sua responsabilidade.`}
            />
            <SectionCard
              title="Filtrar"
              padding="default"
              action={
                <Select value={demandStatus} onValueChange={setDemandStatus}>
                  <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              }
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input placeholder="Buscar cliente ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
              </div>
            </SectionCard>

            {loadingDemandas ? (
              <SectionCard title=""><EmptyState icon={Clock} title="Carregando..." /></SectionCard>
            ) : filteredDemandas.length === 0 ? (
              <SectionCard title=""><EmptyState icon={ClipboardList} title="Nenhuma demanda" description="Ajuste os filtros ou aguarde uma nova atribuição." /></SectionCard>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {filteredDemandas.map((d: any) => <DemandCard key={d.id} d={d} />)}
              </div>
            )}
          </>
        )}

        {activeKey === "tarefas" && (
          <>
            <PanelHero
              role="colaborador"
              eyebrow="Tarefas"
              title="Minhas tarefas"
              subtitle={`${kpis.tasksOpen} aberta(s) · ${kpis.dueToday} para hoje`}
              stats={[
                { label: "Atrasadas", value: taskGroups.overdue.length },
                { label: "Hoje", value: taskGroups.today.length },
                { label: "Próximas", value: taskGroups.upcoming.length },
                { label: "Concluídas", value: taskGroups.done.length },
              ]}
            />
            <div className="grid lg:grid-cols-2 gap-5">
              <SectionCard title="Atrasadas" icon={AlertCircle}>
                {taskGroups.overdue.length === 0 ? <EmptyState icon={CheckCircle2} title="Nada atrasado" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">{taskGroups.overdue.map((t) => <TaskRow key={t.id} t={t} tone="overdue" onToggle={() => toggleTask(t)} />)}</ul>}
              </SectionCard>
              <SectionCard title="Hoje" icon={Flame}>
                {taskGroups.today.length === 0 ? <EmptyState icon={Calendar} title="Nada para hoje" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">{taskGroups.today.map((t) => <TaskRow key={t.id} t={t} tone="today" onToggle={() => toggleTask(t)} />)}</ul>}
              </SectionCard>
              <SectionCard title="Próximas" icon={Calendar} className="lg:col-span-2">
                {taskGroups.upcoming.length === 0 ? <EmptyState icon={Calendar} title="Sem tarefas futuras" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">{taskGroups.upcoming.map((t) => <TaskRow key={t.id} t={t} onToggle={() => toggleTask(t)} />)}</ul>}
              </SectionCard>
              {taskGroups.done.length > 0 && (
                <SectionCard title="Concluídas (recentes)" icon={CheckCircle2} className="lg:col-span-2">
                  <ul className="divide-y divide-slate-100 -mx-1">{taskGroups.done.map((t) => <TaskRow key={t.id} t={t} done onToggle={() => toggleTask(t)} />)}</ul>
                </SectionCard>
              )}
            </div>
          </>
        )}

        {activeKey === "clientes" && (
          <>
            <PanelHero role="colaborador" eyebrow="Carteira" title="Meus clientes" subtitle={`${clientes.length} cliente(s) sob sua responsabilidade.`} />
            <SectionCard title="">
              {clientes.length === 0 ? <EmptyState icon={Users} title="Sem clientes" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {clientes.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[12px] font-semibold shrink-0">
                        {initials(c.full_name || "?")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-slate-900 truncate">{c.full_name}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-slate-500">
                          {c.email && <span className="flex items-center gap-1"><Mail className="size-3" />{c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{c.phone}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-slate-200 shrink-0">{c._count} demanda(s)</Badge>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "documentos" && (
          <>
            <PanelHero role="colaborador" eyebrow="Documentos" title="Documentos das demandas" subtitle={`${docs.length} documento(s)`} />
            <SectionCard title="">
              {docs.length === 0 ? <EmptyState icon={FileText} title="Sem documentos" /> : (() => {
                const groups = new Map<string, { name: string; items: any[] }>();
                (docs as any[]).forEach((d) => {
                  const cid = d.client_id || "sem-cliente";
                  const cname = d.clients?.full_name || "Sem cliente";
                  if (!groups.has(cid)) groups.set(cid, { name: cname, items: [] });
                  groups.get(cid)!.items.push(d);
                });
                return (
                  <div className="space-y-2">
                    {Array.from(groups.entries()).map(([cid, g]) => (
                      <details key={cid} className="group rounded-lg border border-slate-200/70 bg-white overflow-hidden">
                        <summary className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-slate-50 list-none">
                          <div className="size-9 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 text-[11px] font-semibold">
                            {initials(g.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-medium text-slate-900 truncate">{g.name}</p>
                            <p className="text-[11.5px] text-slate-500">{g.items.length} documento(s)</p>
                          </div>
                          <ChevronRight className="size-4 text-slate-400 transition-transform group-open:rotate-90" />
                        </summary>
                        <ul className="divide-y divide-slate-100 border-t border-slate-100">
                          {g.items.map((d: any) => (
                            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 pl-14">
                              <div className="size-8 rounded-md bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400 shrink-0">
                                <FileText className="size-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-slate-900 truncate">{d.name}</p>
                                <p className="text-[11px] text-slate-500 truncate">{formatDate(d.created_at)}{d.due_date ? ` · prazo ${formatDate(d.due_date)}` : ""}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px] capitalize border-slate-200 shrink-0">{d.status}</Badge>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </SectionCard>
          </>
        )}

        {activeKey === "comissoes" && (
          <>
            <PanelHero
              role="colaborador"
              eyebrow="Financeiro"
              title="Minhas comissões"
              subtitle={`${comissoesKpis.count} lançamento(s)`}
              stats={[
                { label: "Total", value: formatBRL(comissoesKpis.total) },
                { label: "Pago", value: formatBRL(comissoesKpis.pago) },
                { label: "Pendente", value: formatBRL(comissoesKpis.pendente) },
              ]}
            />
            <SectionCard title="Histórico" icon={Wallet}>
              {loadingComissoes ? (
                <EmptyState icon={Clock} title="Carregando..." />
              ) : comissoes.length === 0 ? (
                <EmptyState icon={Wallet} title="Sem comissões" description="Suas comissões aparecerão aqui assim que forem geradas." />
              ) : (
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(comissoes as any[]).map((c) => {
                    const tone = c.status === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : c.status === "cancelado" ? "bg-slate-100 text-slate-600 border-slate-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                        <div className="size-9 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                          <Wallet className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-slate-900 truncate">
                            {c.sales?.clients?.full_name || "—"} · {c.sales?.products?.name || "—"}
                          </p>
                          <p className="text-[11.5px] text-slate-500">
                            {Number(c.percent || 0).toFixed(2)}% sobre {formatBRL(c.sales?.amount || 0)} · {formatDate(c.created_at)}
                            {c.paid_at ? ` · Pago em ${formatDate(c.paid_at)}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-semibold text-slate-900 text-[13.5px]">{formatBRL(c.amount)}</p>
                          <Badge variant="outline" className={cn("text-[10px] mt-1 capitalize", tone)}>{c.status}</Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </>
        )}

        {activeKey === "perfil" && <PerfilTab />}
        {activeKey === "suporte" && <UserSupportCenter role="colaborador" />}
      </PanelContainer>
    </PanelShell>
  );
}

function TaskRow({ t, tone, done, onToggle }: { t: any; tone?: "overdue" | "today"; done?: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <Checkbox checked={done || t.status_new === "concluida"} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13.5px] font-medium text-slate-900 truncate", done && "line-through text-slate-400")}>{t.title}</p>
        {t.description && <p className="text-[11.5px] text-slate-500 truncate">{t.description}</p>}
      </div>
      {t.due_date && (
        <span className={cn(
          "text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0",
          tone === "overdue" ? "bg-rose-50 text-rose-700" :
          tone === "today" ? "bg-amber-50 text-amber-700" :
          "bg-slate-100 text-slate-600"
        )}>
          {formatDate(t.due_date)}
        </span>
      )}
    </li>
  );
}

function DemandCard({ d }: { d: any }) {
  const meta = STATUS_META[d.status] || STATUS_META.em_andamento;
  return (
    <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition">
      <div className="flex items-start justify-between gap-2 mb-3">
        <Badge variant="outline" className={cn("text-[10px] border", meta.tone)}>{meta.label}</Badge>
        {d.priority === "alta" && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">alta</Badge>}
      </div>
      <p className="text-[14.5px] font-semibold text-slate-900 leading-tight">{d.clients?.full_name || "—"}</p>
      <p className="text-[12px] text-slate-500 mt-0.5 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11.5px] text-slate-500">
        <span>Início: {d.start_date ? formatDate(d.start_date) : "—"}</span>
        {d.sla_due_date && (
          <span className={cn("font-medium", new Date(d.sla_due_date) < new Date() ? "text-rose-600" : "text-slate-600")}>
            SLA: {formatDate(d.sla_due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

function PerfilTab() {
  const { user, signOut } = useAuth() as any;
  return (
    <>
      <PanelHero role="colaborador" eyebrow="Perfil" title="Sua conta" subtitle={user?.email} />
      <SectionCard title="Dados básicos" icon={UserCog}>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <div>
            <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</dt>
            <dd className="mt-0.5 text-slate-900">{user?.user_metadata?.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</dt>
            <dd className="mt-0.5 text-slate-900">{user?.email}</dd>
          </div>
        </dl>
        <Button variant="outline" className="mt-5 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>
          Sair da conta
        </Button>
      </SectionCard>
    </>
  );
}
