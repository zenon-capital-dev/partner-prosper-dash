import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Route, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deriveClientStatusFromStageName,
  invalidateJourneyStageCaches,
} from "@/lib/journey-stage-sync";

interface Props {
  clientId: string;
  stageId: string | null;
  /** Aparência: full (pílula colorida) ou compact (chip enxuto). */
  variant?: "full" | "compact";
  className?: string;
}

const NONE_VALUE = "__none__";

/**
 * Seletor inline de estágio da esteira. Usa Select do shadcn (portalizado)
 * para evitar bubbling/navegação quando renderizado dentro de cards clicáveis
 * e para ficar visualmente consistente com o resto do admin.
 */
export function InlineStageSelect({
  clientId,
  stageId,
  variant = "full",
  className,
}: Props) {
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
  const color = current?.color || "#64748b";

  const onChange = async (raw: string) => {
    const newId = raw === NONE_VALUE ? null : raw;
    if ((stageId ?? "") === (newId ?? "")) return;

    const nextStage = stages.find((s: any) => s.id === newId);
    const derivedStatus = deriveClientStatusFromStageName(nextStage?.name);

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

  // Para não navegar quando estiver dentro de <a>/card clicável
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if ((e as any).preventDefault) (e as any).preventDefault();
  };

  return (
    <div
      className={cn("inline-flex items-center min-w-0 max-w-full", className)}
      onClick={stop}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Select value={stageId ?? NONE_VALUE} onValueChange={onChange}>
        <SelectTrigger
          onClick={stop}
          className={cn(
            "group h-7 gap-1.5 rounded-full border pl-2 pr-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            "focus:ring-2 focus:ring-offset-0 focus:ring-indigo-100",
            variant === "full" ? "min-w-[160px]" : "min-w-[120px]",
          )}
          style={{
            color,
            borderColor: `${color}55`,
            background: `${color}12`,
          }}
        >
          <span
            className="inline-flex size-4 items-center justify-center rounded-full shrink-0"
            style={{ background: `${color}22`, color }}
            aria-hidden
          >
            <Route className="size-2.5" />
          </span>
          <SelectValue placeholder="Sem estágio" className="truncate">
            <span className="truncate">{current?.name ?? "Sem estágio"}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={6}
          className="z-[80] min-w-[220px]"
          onClick={stop}
        >
          <SelectItem value={NONE_VALUE} className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Sem estágio
          </SelectItem>
          {stages.map((s: any) => (
            <SelectItem
              key={s.id}
              value={s.id}
              className="text-[11px] font-bold uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: s.color || "#64748b" }}
                  aria-hidden
                />
                <span style={{ color: s.color || undefined }}>{s.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
