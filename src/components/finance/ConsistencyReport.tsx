import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = { check_code: string; check_name: string; severity: string; problems: number };

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-slate-50 text-slate-600 border-slate-200",
};

export function ConsistencyReport() {
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ["financial-consistency-report"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("financial_consistency_report");
      if (error) throw error;
      setLastRun(new Date());
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const total = data.reduce((a, r) => a + Number(r.problems || 0), 0);
  const allGreen = total === 0 && data.length > 0;

  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <div className={cn("size-8 rounded-md flex items-center justify-center border",
            allGreen ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200")}>
            {allGreen ? <CheckCircle2 className="size-4" /> : <ShieldCheck className="size-4" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Auditoria de consistência financeira</h3>
            <p className="text-[11px] text-slate-500">
              {allGreen ? "Todos os checks bateram." : `${total} problema(s) detectado(s)`}
              {lastRun && ` · última execução ${lastRun.toLocaleTimeString("pt-BR")}`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-slate-200 bg-white">
          <RefreshCw className={cn("size-3.5 mr-1.5", isFetching && "animate-spin")} />
          Rodar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/60">
              <th className="text-left px-4 py-2 w-12">#</th>
              <th className="text-left px-4 py-2">Verificação</th>
              <th className="text-left px-4 py-2 w-28">Severidade</th>
              <th className="text-right px-4 py-2 w-32">Problemas</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-500">Aguardando primeira execução…</td></tr>
            ) : data.sort((a, b) => a.check_code.localeCompare(b.check_code)).map((r) => {
              const ok = Number(r.problems) === 0;
              return (
                <tr key={r.check_code} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-mono text-slate-500">{r.check_code}</td>
                  <td className="px-4 py-2.5 text-slate-800">{r.check_name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn("text-[10px] font-semibold border", SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.info)}>
                      {r.severity.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("inline-flex items-center gap-1 font-mono font-bold tabular-nums",
                      ok ? "text-emerald-700" : "text-rose-700")}>
                      {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                      {r.problems}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-200/70 text-[10px] text-slate-500">
        Cada linha executa uma consulta agregada. Problemas &gt; 0 devem ser investigados antes do fechamento do mês.
      </div>
    </div>
  );
}
