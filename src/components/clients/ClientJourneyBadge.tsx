import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatBR as format } from "@/lib/datetime";
import { parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { deriveClientStatusFromStageName, invalidateJourneyStageCaches } from "@/lib/journey-stage-sync";

interface Props {
  clientId: string;
  stageId: string | null;
}

export function ClientJourneyBadge({ clientId, stageId }: Props) {
  const qc = useQueryClient();
  const { data: stages = [] } = useQuery({
    queryKey: ["journey-stages-mini"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_journey_stages")
        .select("id, name, color, position")
        .eq("active", true)
        .order("position");
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: client } = useQuery({
    queryKey: ["client-closed-flag", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("is_closed, stage_changed_at" as any)
        .eq("id", clientId)
        .maybeSingle();
      return data as any;
    },
  });

  const current = stages.find((s: any) => s.id === stageId);

  const onChange = async (newId: string) => {
    if ((stageId ?? "") === (newId ?? "")) return;
    const nextStage = stages.find((s: any) => s.id === newId);
    const currentName = current?.name ?? "Sem estágio";
    const nextName = nextStage?.name ?? "Sem estágio";
    if (!window.confirm(`Mover cliente de "${currentName}" para "${nextName}"?`)) return;
    const derivedStatus = deriveClientStatusFromStageName(nextStage?.name);
    qc.setQueryData(["client", clientId], (old: any) => old ? { ...old, journey_stage_id: newId || null, status: derivedStatus ?? old.status } : old);
    qc.setQueryData<Map<string, string | null>>(["client-stage-map"], (old) => {
      if (!old) return old;
      const next = new Map(old);
      next.set(clientId, newId || null);
      return next;
    });
    const { error } = await supabase.from("clients").update({ journey_stage_id: newId || null } as any).eq("id", clientId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Estágio atualizado${derivedStatus ? ` · status ${derivedStatus.replace(/_/g, " ")}` : ""}`);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-closed-flag", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      invalidateJourneyStageCaches(qc, clientId);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Activity className="size-4 shrink-0 text-slate-400" />
      <select
        className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2 py-1 cursor-pointer hover:border-indigo-300"
        value={stageId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: current?.color || "#475569" }}
      >
        <option value="">Sem estágio</option>
        {stages.map((s: any) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {client?.stage_changed_at && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500"
          title="Última alteração de estágio"
        >
          <Clock className="size-3" />
          {format(parseISO(client.stage_changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
      )}
      {client?.is_closed && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
          <CheckCircle2 className="size-3" /> Fechado
        </span>
      )}
    </div>
  );
}

