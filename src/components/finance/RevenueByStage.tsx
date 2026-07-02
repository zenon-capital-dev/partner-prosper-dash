import { useMemo } from "react";
import { useJourneyStages, useClientStageMap, useSharedStageFilter } from "@/hooks/useSharedStageFilter";
import { Route } from "lucide-react";
import { cn } from "@/lib/utils";

const PAID = new Set(["pago", "paga", "pago_parcial", "recebido", "recebida", "concluido", "concluida"]);
const receivedAmount = (p: any) => {
  if (p.amount_paid != null) return Number(p.amount_paid) || 0;
  if (p.received_amount != null) return Number(p.received_amount) || 0;
  return PAID.has(String(p.status)) ? Number(p.amount || 0) : 0;
};

interface Props {
  /** Payments already scoped to the desired period (date filter applied by caller). */
  payments: any[];
  /** Only count paid amounts (default true). If false, uses full amount. */
  onlyReceived?: boolean;
  title?: string;
  className?: string;
  /** When true, dims stages not present in the shared filter. */
  highlightShared?: boolean;
}

/**
 * Breakdown de receita por Estágio da Jornada do cliente.
 * Compartilhado entre Central Financeira, Dashboard e Painel do Parceiro.
 */
export function RevenueByStage({
  payments,
  onlyReceived = true,
  title = "Receita por estágio",
  className,
  highlightShared = true,
}: Props) {
  const { data: stages = [] } = useJourneyStages();
  const { data: stageMap } = useClientStageMap();
  const { stageIds: sharedStageIds, isActive: sharedActive } = useSharedStageFilter();

  const { rows, total, unassigned } = useMemo(() => {
    const totals = new Map<string, number>();
    let un = 0;
    for (const p of payments) {
      const value = onlyReceived ? receivedAmount(p) : Number(p.amount || 0);
      if (value <= 0) continue;
      const stage = p.client_id ? stageMap?.get(p.client_id) ?? null : null;
      if (!stage) { un += value; continue; }
      totals.set(stage, (totals.get(stage) || 0) + value);
    }
    const rows = stages
      .map((s) => ({ ...s, total: totals.get(s.id) || 0 }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
    const total = rows.reduce((a, r) => a + r.total, 0) + un;
    return { rows, total, unassigned: un };
  }, [payments, stageMap, stages, onlyReceived]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

  return (
    <div className={cn("bg-white border border-slate-200/70 rounded-lg shadow-sm p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-indigo-50 p-1.5">
            <Route className="size-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</div>
          <div className="text-sm font-mono font-bold text-slate-900">{fmt(total)}</div>
        </div>
      </div>

      {rows.length === 0 && unassigned === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500">
          Nenhuma receita no período.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? (r.total / total) * 100 : 0;
            const dim = highlightShared && sharedActive && !sharedStageIds.includes(r.id);
            return (
              <div key={r.id} className={cn("group", dim && "opacity-40")}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="size-2 rounded-full" style={{ background: r.color || "#94a3b8" }} />
                    {r.name}
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {fmt(r.total)}
                    <span className="ml-2 text-[10px] text-slate-500 font-normal">{pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: r.color || "#6366f1" }}
                  />
                </div>
              </div>
            );
          })}
          {unassigned > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Sem estágio atribuído</span>
                <span className="font-mono text-slate-500">{fmt(unassigned)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
