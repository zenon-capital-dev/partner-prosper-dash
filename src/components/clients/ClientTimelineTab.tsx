import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInCalendarDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Video, Phone, FileText, Bell, RotateCcw, Calendar, Plus, Clock, AlertTriangle, MapPin,
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

export function ClientTimelineTab({ clientId }: { clientId: string }) {
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
            {pendentes} pendente{pendentes !== 1 ? "s" : ""} · {items.length} no total
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {isLoading ? (
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
      )}
    </div>
  );
}
