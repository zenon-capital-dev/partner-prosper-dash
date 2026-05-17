import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History, Clock, User, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const RESULT_LABELS: Record<string, { label: string; tone: string }> = {
  contatado: { label: "Contatado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  sem_resposta: { label: "Sem resposta", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  fechado: { label: "Fechado", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  reagendar: { label: "Reagendar", tone: "bg-slate-100 text-slate-700 border-slate-200" },
};

export function ClientHistory({ clientId }: { clientId: string }) {
  const { data: activityHistory, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["client-history", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select(`*, profiles(full_name)`)
        .eq("entity_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: actionsHistory, isLoading: isLoadingActions } = useQuery({
    queryKey: ["client-actions-history", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_actions")
        .select(`*`)
        .eq("client_id", clientId)
        .eq("status", "executada")
        .order("executed_at", { ascending: false });
      return data ?? [];
    },
  });

  const mergedHistory = [...(activityHistory || []), ...(actionsHistory || []).map(a => ({
    ...a,
    isAction: true,
    created_at: a.executed_at,
  }))].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = isLoadingActivity || isLoadingActions;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h3 className="text-lg font-bold tracking-tight">Histórico e Auditoria</h3>
        <p className="text-xs text-muted-foreground">Linha do tempo de todas as interações</p>
      </div>

      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/20 before:via-border/40 before:to-transparent">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : mergedHistory?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum histórico encontrado.</div>
        ) : mergedHistory?.map((item: any) => (
          <div key={item.id} className="relative flex items-start justify-between gap-6 group">
            <div className="flex items-start gap-6">
              <div className="relative flex size-10 items-center justify-center rounded-full bg-slate-50 border border-border/40 shadow-sm z-10 group-hover:bg-white transition-colors shrink-0">
                {item.isAction ? (
                  <MessageSquare className="size-4 text-emerald-500" />
                ) : (
                  <Zap className="size-4 text-indigo-500" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-bold text-foreground">
                    {item.isAction ? "Atuação Comercial" : item.action}
                  </p>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatDate(item.created_at)}
                  </span >
                  {item.isAction && item.result && (
                    <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-bold py-0 h-4 ${RESULT_LABELS[item.result]?.tone}`}>
                      {RESULT_LABELS[item.result]?.label}
                    </Badge>
                  )}
                </div>
                
                {item.isAction ? (
                  <div className="mt-2 text-xs text-slate-700 bg-slate-50/70 border border-slate-200/60 rounded-lg px-3 py-2 leading-relaxed">
                    <p className="font-semibold text-slate-500 text-[10px] uppercase mb-1">Nota da Execução:</p>
                    {item.execution_notes || "Sem anotações detalhadas."}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <User className="size-3" />
                      {item.profiles?.full_name || "Sistema"}
                    </div>
                    <span className="text-border text-[11px]">/</span>
                    <p className="text-[11px] text-muted-foreground">Entidade: {item.entity_type}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
