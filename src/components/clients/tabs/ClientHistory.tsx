import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History, Clock, User, Zap } from "lucide-react";
import { formatDate } from "@/lib/format";

export function ClientHistory({ clientId }: { clientId: string }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["client-history", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select(`
          *,
          profiles(full_name)
        `)
        .eq("entity_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h3 className="text-lg font-bold tracking-tight">Histórico e Auditoria</h3>
        <p className="text-xs text-muted-foreground">Linha do tempo de todas as interações</p>
      </div>

      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/20 before:via-border/40 before:to-transparent">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : history?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum histórico encontrado.</div>
        ) : history?.map((item: any) => (
          <div key={item.id} className="relative flex items-center justify-between gap-6 group">
            <div className="flex items-center gap-6">
              <div className="relative flex size-10 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 border border-border/40 shadow-sm z-10 group-hover:bg-white transition-colors">
                <Zap className="size-4 text-indigo-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-foreground">{item.action}</p>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{formatDate(item.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <User className="size-3" />
                    {item.profiles?.full_name || "Sistema"}
                  </div>
                  <span className="text-border text-[11px]">/</span>
                  <p className="text-[11px] text-muted-foreground">Entidade: {item.entity_type}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
