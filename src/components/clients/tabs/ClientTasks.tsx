import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Clock, CheckCircle2, User } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClientTasks({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, assigned_profile:profiles!assigned_to(full_name)")
        .or(`client_id.eq.${clientId},related_entity_id.eq.${clientId}`)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Tarefas e Pendências</h3>
          <p className="text-xs text-muted-foreground">Acompanhamento de obrigações e prazos</p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4 mr-2" /> Criar Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : tasks?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa registrada.</div>
        ) : tasks?.map((task: any) => (
          <div key={task.id} className="cp-panel p-5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className={cn("size-10 rounded-xl flex items-center justify-center", 
                task.status === "concluida" || task.status === "completed" 
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-50 text-slate-500"
              )}>
                {task.status === "concluida" || task.status === "completed" ? <CheckCircle2 className="size-5" /> : <ClipboardList className="size-5" />}
              </div>
              <div>
                <h4 className={cn("font-bold text-foreground", (task.status === "concluida" || task.status === "completed") && "line-through opacity-40")}>{task.title}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    <Clock className="size-3" />
                    {task.due_date ? formatDate(task.due_date) : "Sem prazo"}
                  </div>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    <User className="size-3" />
                    {task.responsible_id || "Não atribuído"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <PriorityBadge priority={task.priority} />
              <div className="h-6 w-px bg-border/40" />
              <Button variant="ghost" size="sm" className="text-xs font-bold">
                Detalhes
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: any = {
    baixa: { label: "BAIXA", color: "text-slate-500 bg-slate-50 border-slate-200" },
    media: { label: "MÉDIA", color: "text-amber-500 bg-amber-50 border-amber-200" },
    alta: { label: "ALTA", color: "text-orange-500 bg-orange-50 border-orange-200" },
    urgente: { label: "URGENTE", color: "text-rose-600 bg-rose-50 border-rose-200" },
  };
  const config = map[priority] || { label: priority, color: "text-slate-500 bg-slate-50 border-slate-200" };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border", config.color)}>
      {config.label}
    </span>
  );
}
