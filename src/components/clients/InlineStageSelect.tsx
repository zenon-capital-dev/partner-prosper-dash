import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { deriveClientStatusFromStageName, invalidateJourneyStageCaches } from "@/lib/journey-stage-sync";

interface Props {
  clientId: string;
  stageId: string | null;
  /** Aparência: full (com borda destacada por cor) ou compact (chip enxuto). */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Seletor compacto de estágio, usado nos cards/linhas de listagem de clientes
 * para permitir mover o cliente na esteira sem abrir o dossiê.
 */
export function InlineStageSelect({ clientId, stageId, variant = "full", className }: Props) {
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
  const color = current?.color || "#94a3b8";

  const onChange = async (raw: string) => {
    const newId = raw || null;
    if ((stageId ?? "") === (newId ?? "")) return;

    const nextStage = stages.find((s: any) => s.id === newId);
    const derivedStatus = deriveClientStatusFromStageName(nextStage?.name);

    // Otimista
    qc.setQueryData<Map<string, string | null>>(["client-stage-map"], (old) => {
      if (!old) return old;
      const next = new Map(old);
      next.set(clientId, newId);
      return next;
    });

    const { error } = await supabase
      .from("clients")
      .update({ journey_stage_id: newId } as any)
      .eq("id", clientId);

    if (error) {
      toast.error(error.message);
      invalidateJourneyStageCaches(qc, clientId);
      return;
    }
    toast.success(
      `Estágio movido para "${nextStage?.name ?? "Sem estágio"}"${
        derivedStatus ? ` · status ${derivedStatus.replace(/_/g, " ")}` : ""
      }`,
    );
    invalidateJourneyStageCaches(qc, clientId);
  };

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 min-w-0", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className="inline-flex size-5 items-center justify-center rounded-md shrink-0"
        style={{ background: `${color}1a`, color }}
        aria-hidden
      >
        <Route className="size-3" />
      </span>
      <select
        value={stageId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "min-w-0 max-w-full truncate rounded-md border bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors",
          variant === "full"
            ? "border-slate-200 hover:border-indigo-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            : "border-transparent hover:border-slate-200",
        )}
        style={{
          color,
          borderColor: variant === "full" ? `${color}40` : undefined,
          background: variant === "full" ? `${color}0d` : undefined,
        }}
        title={current?.name || "Definir estágio"}
      >
        <option value="">Sem estágio</option>
        {stages.map((s: any) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
