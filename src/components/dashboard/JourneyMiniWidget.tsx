import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Route, ArrowRight } from "lucide-react";

export function JourneyMiniWidget() {
  const { data: stages = [] } = useQuery({
    queryKey: ["journey-mini-stages"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_journey_stages")
        .select("id, name, color, position")
        .eq("active", true)
        .order("position");
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["journey-mini-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, journey_stage_id" as any);
      return (data as any[]) ?? [];
    },
  });

  const counts = new Map<string, number>();
  stages.forEach((s: any) => counts.set(s.id, 0));
  let unassigned = 0;
  clients.forEach((c: any) => {
    if (c.journey_stage_id && counts.has(c.journey_stage_id)) {
      counts.set(c.journey_stage_id, (counts.get(c.journey_stage_id) || 0) + 1);
    } else {
      unassigned += 1;
    }
  });

  return (
    <div className="cp-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Route className="size-4 text-indigo-600" />
          <h3 className="text-sm font-bold tracking-tight">Esteira de Atendimento</h3>
        </div>
        <Link
          to="/esteira"
          className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
        >
          Abrir esteira <ArrowRight className="size-3" />
        </Link>
      </div>

      {stages.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum estágio configurado.{" "}
          <Link to="/esteira" className="text-indigo-600 hover:underline">
            Criar agora
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stages.map((s: any) => (
            <div
              key={s.id}
              className="rounded-xl border border-slate-200/70 bg-white p-3"
              style={{ borderTopColor: s.color, borderTopWidth: 3 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                {s.name}
              </p>
              <p className="mt-1 text-xl font-black text-slate-900 font-mono">
                {counts.get(s.id) || 0}
              </p>
            </div>
          ))}
          {unassigned > 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sem estágio
              </p>
              <p className="mt-1 text-xl font-black text-slate-700 font-mono">{unassigned}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
