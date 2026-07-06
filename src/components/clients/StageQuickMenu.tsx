import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Route, Check } from "lucide-react";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useJourneyStages } from "@/hooks/useSharedStageFilter";
import {
  deriveClientStatusFromStageName,
  invalidateJourneyStageCaches,
} from "@/lib/journey-stage-sync";

interface Props {
  clientId?: string | null;
  currentStageId?: string | null;
  label?: string;
}

/**
 * Submenu "Mover estágio →" reutilizável em qualquer DropdownMenu
 * (Vendas, Demandas, Clientes...). Atualiza `clients.journey_stage_id` e
 * invalida os caches compartilhados para refletir em todas as abas.
 */
export function StageQuickMenu({ clientId, currentStageId, label = "Mover estágio" }: Props) {
  const qc = useQueryClient();
  const { data: stages = [] } = useJourneyStages();

  const change = async (newId: string | null) => {
    if (!clientId) {
      toast.error("Venda sem cliente vinculado.");
      return;
    }
    if ((currentStageId ?? "") === (newId ?? "")) return;

    const nextStage = stages.find((s) => s.id === newId);
    const derived = deriveClientStatusFromStageName(nextStage?.name);

    // atualização otimista do map compartilhado
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
        derived ? ` · status ${derived.replace(/_/g, " ")}` : ""
      }`,
    );
    invalidateJourneyStageCaches(qc, clientId);
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={!clientId} className="gap-2">
        <Route className="size-3.5 text-indigo-600" /> {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[220px]">
        <DropdownMenuItem
          onClick={() => change(null)}
          className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          <span className="flex-1">Sem estágio</span>
          {!currentStageId && <Check className="size-3.5" />}
        </DropdownMenuItem>
        {stages.map((s) => {
          const active = s.id === currentStageId;
          return (
            <DropdownMenuItem
              key={s.id}
              onClick={() => change(s.id)}
              className="text-[11px] font-bold uppercase tracking-wider"
            >
              <span
                className="inline-block size-2 rounded-full mr-2"
                style={{ background: s.color || "#64748b" }}
                aria-hidden
              />
              <span className="flex-1" style={{ color: s.color || undefined }}>
                {s.name}
              </span>
              {active && <Check className="size-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
