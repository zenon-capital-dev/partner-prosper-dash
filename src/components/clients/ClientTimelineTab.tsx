import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInCalendarDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Video, Phone, FileText, Bell, RotateCcw, Calendar, Plus, Clock, AlertTriangle, MapPin,
  MessageSquare, LifeBuoy, Inbox, ArrowRight, User, Building2, Wrench, Package, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  tarefa:              { label: "Tarefa",     icon: CheckCircle2, color: "bg-slate-100 text-slate-700 border-slate-200" },
  reuniao:             { label: "Reunião",    icon: Video,        color: "bg-violet-50 text-violet-700 border-violet-200" },
  ligacao:             { label: "Ligação",    icon: Phone,        color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pendencia_documento: { label: "Documento",  icon: FileText,     color: "bg-amber-50 text-amber-700 border-amber-200" },
  lembrete:            { label: "Lembrete",   icon: Bell,         color: "bg-blue-50 text-blue-700 border-blue-200" },
  follow_up:           { label: "Follow-up",  icon: RotateCcw,    color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const ROLE_META: Record<string, { label: string; icon: any; color: string }> = {
  admin:      { label: "Zenon",     icon: Building2, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  colaborador:{ label: "Zenon",     icon: Building2, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  cliente:    { label: "Cliente",   icon: User,      color: "bg-sky-50 text-sky-700 border-sky-200" },
  prestador:  { label: "Prestador", icon: Wrench,    color: "bg-amber-50 text-amber-700 border-amber-200" },
  parceiro:   { label: "Parceiro",  icon: User,      color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export function ClientTimelineTab({ clientId }: { clientId: string }) {
  const [mode, setMode] = useState<"tarefas" | "acoes">("acoes");
  const [filter, setFilter] = useState<"all" | "pendentes" | "concluidas">("all");


  const { data: items = [], isLoading } = useQuery({
    queryKey: ["client-timeline", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, kind, due_date, status_new, priority, location, meeting_url, completed_at, outcome, created_at, assigned_to")
        .eq("client_id", clientId)
        .order("due_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = data || [];
      const ids = Array.from(new Set(rows.map((r: any) => r.assigned_to).filter(Boolean)));
      let profMap = new Map<string, any>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      }
      return rows.map((r: any) => ({ ...r, assignee: r.assigned_to ? profMap.get(r.assigned_to) || null : null }));
    },
  });

  // Unified cross-portal action feed (support tickets, demand requests, document requests)
  const { data: actions = [], isLoading: loadingActions } = useQuery({
    queryKey: ["client-actions-feed", clientId],
    enabled: mode === "acoes",
    queryFn: async () => {
      // Primeiro pegamos os client_products do cliente para filtrar chat/entregas
      const { data: cps } = await supabase
        .from("client_products")
        .select("id, products(name)")
        .eq("client_id", clientId);
      const cpIds = (cps ?? []).map((c: any) => c.id);
      const cpNameMap = new Map<string, string>();
      (cps ?? []).forEach((c: any) => cpNameMap.set(c.id, c.products?.name || "Demanda"));

      const [tickets, requests, docs, comments, deliveries, receipts] = await Promise.all([
        supabase
          .from("client_support_tickets")
          .select("id, subject, category, status, priority, created_by, created_at, last_message_at, client_product_id")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("demand_requests")
          .select("id, title, description, kind, status, requested_by, requested_role, target_role, created_at, client_product_id")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("document_requests")
          .select("id, request_title, description, status, priority, requested_at, deadline, client_product_id")
          .eq("client_id", clientId)
          .order("requested_at", { ascending: false })
          .limit(100),
        cpIds.length
          ? supabase
              .from("demand_comments")
              .select("id, content, visibility, author_id, created_at, client_product_id")
              .in("client_product_id", cpIds)
              .order("created_at", { ascending: false })
              .limit(150)
          : Promise.resolve({ data: [] as any[] } as any),
        cpIds.length
          ? supabase
              .from("demand_deliveries")
              .select("id, title, description, status, created_at, client_product_id")
              .in("client_product_id", cpIds)
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase
          .from("payments")
          .select("id, amount, description, receipt_url, status, updated_at, installment_number")
          .eq("client_id", clientId)
          .not("receipt_url", "is", null)
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);

      // Autores dos comentários (para inferir papel: cliente/prestador/admin)
      const authorIds = Array.from(new Set(((comments as any).data || []).map((c: any) => c.author_id).filter(Boolean))) as string[];
      const roleByUser = new Map<string, string>();
      if (authorIds.length) {
        const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", authorIds);
        (roles ?? []).forEach((r: any) => {
          const existing = roleByUser.get(r.user_id);
          // prioridade: admin > prestador > cliente > outros
          const rank = (x: string) => ["admin","admin_secondary","colaborador"].includes(x) ? 3 : x === "prestador" ? 2 : x === "cliente" ? 1 : 0;
          if (!existing || rank(r.role) > rank(existing)) roleByUser.set(r.user_id, r.role);
        });
      }

      const merged: any[] = [];
      for (const t of tickets.data || []) {
        merged.push({
          _type: "ticket",
          id: t.id,
          when: t.last_message_at || t.created_at,
          title: t.subject,
          subtitle: t.category ? `Categoria: ${t.category}` : null,
          status: t.status,
          from: "cliente",
          to: "admin",
          link: `/admin/atendimento-cliente?ticket=${t.id}`,
        });
      }
      for (const r of requests.data || []) {
        merged.push({
          _type: "request",
          id: r.id,
          when: r.created_at,
          title: r.title,
          subtitle: r.description,
          status: r.status,
          from: r.requested_role,
          to: r.target_role,
          link: r.client_product_id ? `/demandas/${r.client_product_id}?tab=requests` : `/solicitacoes`,
        });
      }
      for (const d of docs.data || []) {
        merged.push({
          _type: "doc",
          id: d.id,
          when: d.requested_at,
          title: d.request_title,
          subtitle: d.description,
          status: d.status,
          from: "admin",
          to: "cliente",
          link: `/clientes/${clientId}?tab=documentos`,
        });
      }
      for (const c of (comments as any).data || []) {
        const role = roleByUser.get(c.author_id) || "admin";
        const from = ["admin","admin_secondary","colaborador"].includes(role) ? "admin" : role;
        const to = c.visibility === "client" ? "cliente" : c.visibility === "provider" ? "prestador" : from === "cliente" ? "admin" : "admin";
        merged.push({
          _type: "chat",
          id: c.id,
          when: c.created_at,
          title: `Mensagem em ${cpNameMap.get(c.client_product_id) || "Demanda"}`,
          subtitle: c.content,
          status: c.visibility,
          from,
          to,
          link: `/demandas/${c.client_product_id}?tab=comments`,
        });
      }
      for (const d of (deliveries as any).data || []) {
        merged.push({
          _type: "delivery",
          id: d.id,
          when: d.created_at,
          title: `Entrega: ${d.title}`,
          subtitle: d.description || cpNameMap.get(d.client_product_id) || null,
          status: d.status,
          from: "admin",
          to: "cliente",
          link: `/clientes/${clientId}?tab=entregas`,
        });
      }
      for (const p of receipts.data || []) {
        merged.push({
          _type: "receipt",
          id: p.id,
          when: p.updated_at,
          title: `Comprovante · Parcela ${p.installment_number || ""}`.trim(),
          subtitle: p.description || `Valor: R$ ${Number(p.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          status: p.status,
          from: "cliente",
          to: "admin",
          link: `/clientes/${clientId}?tab=financeiro`,
        });
      }
      return merged.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    },
  });

  const filtered = useMemo(() => {
    if (filter === "pendentes") return items.filter((i: any) => i.status_new !== "concluida" && i.status_new !== "cancelada");
    if (filter === "concluidas") return items.filter((i: any) => i.status_new === "concluida");
    return items;
  }, [items, filter]);

  const pendentes = items.filter((i: any) => i.status_new !== "concluida" && i.status_new !== "cancelada").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900">Atividades & pendências</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === "tarefas"
              ? <>{pendentes} pendente{pendentes !== 1 ? "s" : ""} · {items.length} no total</>
              : <>{actions.length} ação{actions.length !== 1 ? "ões" : ""} registrada{actions.length !== 1 ? "s" : ""} entre portais</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["tarefas", "acoes"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 h-7 text-[11px] font-bold rounded-md transition-all",
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {m === "tarefas" ? "Tarefas" : "Histórico de ações"}
              </button>
            ))}
          </div>
          {mode === "tarefas" && (
            <>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(["all", "pendentes", "concluidas"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 h-7 text-[11px] font-bold rounded-md transition-all",
                      filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {f === "all" ? "Tudo" : f === "pendentes" ? "Pendentes" : "Concluídas"}
                  </button>
                ))}
              </div>
              <Link to={`/agenda?new=1&client=${clientId}`}>
                <Button size="sm" className="gap-1.5 h-8">
                  <Plus className="size-3.5" /> Nova
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {mode === "acoes" && (
        <ActionsFeed items={actions} loading={loadingActions} />
      )}
      {mode === "tarefas" && (
        isLoading ? (
        <div className="text-center py-12 text-sm text-slate-500">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <Calendar className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Sem atividades registradas</p>
          <p className="text-xs text-slate-500 mt-1">Crie uma reunião, ligação ou pendência pra este cliente.</p>
        </div>
      ) : (
        <div className="relative space-y-3 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
          {filtered.map((it: any) => {
            const meta = KIND_META[it.kind] || KIND_META.tarefa;
            const Icon = meta.icon;
            const isDone = it.status_new === "concluida";
            const isCancelled = it.status_new === "cancelada";
            const due = it.due_date ? parseISO(it.due_date) : null;
            const overdue = due && !isDone && !isCancelled && due < new Date();
            return (
              <div key={it.id} className="relative">
                <div className={cn(
                  "absolute -left-[18px] top-3 size-3 rounded-full ring-2 ring-white border-2",
                  isDone ? "bg-emerald-500 border-emerald-500" :
                  isCancelled ? "bg-slate-300 border-slate-300" :
                  overdue ? "bg-rose-500 border-rose-500" : "bg-white border-indigo-400",
                )} />
                <div className={cn(
                  "rounded-xl border bg-white p-3.5 shadow-sm",
                  isDone && "opacity-70",
                  overdue && "border-rose-200 bg-rose-50/30",
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-bold uppercase tracking-wider", meta.color)}>
                        <Icon className="size-3" />
                        {meta.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[13.5px] font-bold text-slate-900", isDone && "line-through")}>
                          {it.title}
                        </p>
                        {it.description && (
                          <p className="text-[12px] text-slate-600 mt-1">{it.description}</p>
                        )}
                        {it.outcome && (
                          <p className="text-[12px] text-emerald-700 mt-1.5 font-semibold">
                            ✓ {it.outcome}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          {due && (
                            <span className={cn(
                              "inline-flex items-center gap-1 font-semibold",
                              overdue && "text-rose-700",
                              isToday(due) && !isDone && "text-orange-700",
                            )}>
                              <Clock className="size-3" />
                              {format(due, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                              {overdue && (
                                <span className="text-rose-700">
                                  · atrasou {Math.abs(differenceInCalendarDays(due, new Date()))}d
                                </span>
                              )}
                            </span>
                          )}
                          {it.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{it.location}</span>}
                          {it.assignee && (
                            <span className="inline-flex items-center gap-1">
                              · {it.assignee.full_name || it.assignee.email}
                            </span>
                          )}
                          {it.completed_at && (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              · Concluído em {format(parseISO(it.completed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}
    </div>
  );
}

function ActionsFeed({ items, loading }: { items: any[]; loading: boolean }) {
  if (loading) return <div className="text-center py-12 text-sm text-slate-500">Carregando histórico...</div>;
  if (!items.length) return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
      <Inbox className="size-10 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-semibold text-slate-700">Sem ações entre portais ainda</p>
      <p className="text-xs text-slate-500 mt-1">Solicitações e mensagens trocadas entre cliente, prestador, parceiro e Zenon aparecerão aqui.</p>
    </div>
  );
  const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
    ticket:   { label: "Suporte",       icon: LifeBuoy,       color: "bg-rose-50 text-rose-700 border-rose-200" },
    request:  { label: "Solicitação",   icon: MessageSquare,  color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    doc:      { label: "Documento",     icon: FileText,       color: "bg-amber-50 text-amber-700 border-amber-200" },
    chat:     { label: "Mensagem",      icon: MessageSquare,  color: "bg-sky-50 text-sky-700 border-sky-200" },
    delivery: { label: "Entrega",       icon: Package,        color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    receipt:  { label: "Comprovante",   icon: Receipt,        color: "bg-violet-50 text-violet-700 border-violet-200" },
  };
  return (
    <div className="relative space-y-3 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
      {items.map((it) => {
        const meta = TYPE_META[it._type];
        const Icon = meta.icon;
        const from = ROLE_META[it.from] || { label: it.from || "—", icon: User, color: "bg-slate-100 text-slate-700 border-slate-200" };
        const to = ROLE_META[it.to] || { label: it.to || "—", icon: User, color: "bg-slate-100 text-slate-700 border-slate-200" };
        return (
          <div key={`${it._type}-${it.id}`} className="relative">
            <div className="absolute -left-[18px] top-3 size-3 rounded-full ring-2 ring-white border-2 bg-white border-indigo-400" />
            <Link to={it.link} className="block group">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md">
                <div className="flex items-start gap-2.5">
                  <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-bold uppercase tracking-wider", meta.color)}>
                    <Icon className="size-3" />
                    {meta.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-bold uppercase", from.color)}>
                        <from.icon className="size-2.5" />{from.label}
                      </span>
                      <ArrowRight className="size-3 text-slate-400" />
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-bold uppercase", to.color)}>
                        <to.icon className="size-2.5" />{to.label}
                      </span>
                      {it.status && (
                        <span className="ml-auto text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                          {it.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[13.5px] font-bold text-slate-900 group-hover:text-indigo-700">{it.title}</p>
                    {it.subtitle && <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">{it.subtitle}</p>}
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="size-3" />
                      {format(parseISO(it.when), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

