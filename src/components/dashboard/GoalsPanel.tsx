import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Target, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/format";

import { goalActual, MONEY_GOAL_TYPES, type GoalActuals } from "@/lib/goals";
const GOAL_LABELS: Record<string, string> = {
  faturamento: "Faturamento",
  revenue: "Receita recebida",
  leads: "Leads captados",
  proposals: "Propostas enviadas",
  sales_count: "Qtd. de vendas",
  stage_movements: "Movimentações na esteira",
  clients_closed: "Clientes fechados (leads)",
  recorrencia_mensal: "Recorrência mensal",
  receita_avulsa: "Receita avulsa (na cabeça)",
  captacao_clientes_mes: "Captação clientes (mês)",
  captacao_clientes_semana: "Captação (semana)",
  captacao_clientes_dia: "Captação (dia)",
  atendimentos_realizados: "Atendimentos realizados",
  clientes_fechados: "Clientes fechados",
};

const isMoney = (k: string) => MONEY_GOAL_TYPES.has(k) || k.startsWith("custom:money:");

export function GoalsPanel() {
  const month = new Date().toISOString().slice(0, 7) + "-01";

  // Realizado: mesma fórmula da tela de Metas, calculada no banco.
  const { data: actuals } = useQuery({
    queryKey: ["dashboard-goals-actuals", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("sales_goal_actuals", { p_month: month, p_stage_ids: null });
      if (error) return null;
      return (data ?? null) as GoalActuals | null;
    },
    refetchInterval: 60_000,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["dashboard-goals", month],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sales_goals")
        .select("*")
        .eq("period_month", month)
        .order("goal_type");
      return data ?? [];
    },
  });

  if (goals.length === 0) {
    return (
      <div className="cp-panel p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-indigo-600" />
            <h3 className="text-sm font-bold tracking-tight">Painel de Metas</h3>
          </div>
          <Link to="/metas-comerciais" className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1">
            Definir metas <ArrowRight className="size-3" />
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">Nenhuma meta definida para o mês atual.</p>
      </div>
    );
  }

  return (
    <div className="cp-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-indigo-600" />
          <h3 className="text-sm font-bold tracking-tight">Painel de Metas — {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
        </div>
        <Link to="/metas-comerciais" className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1">
          Ver tudo <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {goals.map((g: any) => {
          const target = Number(g.target_value || 0);
          const actual = goalActual(g, actuals);
          const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
          const label = GOAL_LABELS[g.goal_type] || (String(g.goal_type).startsWith("custom:") ? String(g.goal_type).split(":").slice(2).join(":") : g.goal_type);
          const fmt = isMoney(g.goal_type) ? formatBRL : (n: number) => String(Math.round(n));
          return (
            <div key={g.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base font-black text-slate-900 font-mono">{fmt(actual)}</span>
                <span className="text-[10px] text-slate-400">/ {fmt(target)}</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-indigo-500" : "bg-amber-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-500">{Math.round(pct)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
