import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Route, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJourneyStages, useSharedStageFilter } from "@/hooks/useSharedStageFilter";

interface Props {
  className?: string;
  /** Label alternativo — padrão "Estágio". */
  label?: string;
}

/**
 * Barra compartilhada de filtro por Estágio da Jornada. Aparece em todas as
 * páginas onde a fase do cliente é relevante (Clientes, Esteira, Vendas,
 * Metas, Financeira, Dashboard, Painel do Parceiro).
 */
export function StageFilterBar({ className, label = "Estágio" }: Props) {
  const { data: stages = [] } = useJourneyStages();
  const { stageIds, toggle, clear, isActive } = useSharedStageFilter();

  const selectedNames = stages.filter((s) => stageIds.includes(s.id)).map((s) => s.name);
  const summary =
    selectedNames.length === 0
      ? "Todos os estágios"
      : selectedNames.length === 1
      ? selectedNames[0]
      : `${selectedNames.length} estágios`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 border-slate-200 text-slate-700 hover:bg-slate-50",
            isActive && "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-50",
            className,
          )}
        >
          <Route className="size-3.5" />
          <span className="font-medium">{label}:</span>
          <span className="font-semibold">{summary}</span>
          {isActive && (
            <span
              role="button"
              aria-label="Limpar filtro de estágio"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }}
              className="ml-1 rounded p-0.5 hover:bg-indigo-100"
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Filtrar por estágio da jornada
        </div>
        {stages.length === 0 ? (
          <div className="px-2 py-3 text-xs text-slate-500">Nenhum estágio configurado.</div>
        ) : (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {stages.map((s) => {
              const active = stageIds.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50",
                      active && "bg-indigo-50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: s.color || "#94a3b8" }}
                      />
                      <span className={cn("text-slate-700", active && "font-semibold text-indigo-700")}>
                        {s.name}
                      </span>
                    </span>
                    {active && <Check className="size-3.5 text-indigo-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {isActive && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button
              onClick={clear}
              className="w-full rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Limpar seleção
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
