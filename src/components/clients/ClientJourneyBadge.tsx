import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";
import { toast } from "sonner";

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

  const current = stages.find((s: any) => s.id === stageId);

  const onChange = async (newId: string) => {
    const { error } = await supabase.from("clients").update({ journey_stage_id: newId || null } as any).eq("id", clientId);
    if (error) toast.error(error.message);
    else {
      toast.success("Estágio atualizado");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
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
    </div>
  );
}
