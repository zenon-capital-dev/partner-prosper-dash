import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GOAL_KINDS, kindMeta, type InteractionKind } from "@/lib/interaction-kinds";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";

type PeriodKind = "day" | "week" | "month";

function startOfWeekMon(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return x; }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function computePeriod(kind: PeriodKind, ref: Date) {
  if (kind === "day") {
    const start = startOfDay(ref);
    return { start, end: addDays(start, 1), label: start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) };
  }
  if (kind === "week") {
    const start = startOfWeekMon(ref);
    const end = addDays(start, 7);
    return { start, end, label: `Semana ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} → ${addDays(end, -1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` };
  }
  const start = startOfMonth(ref);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end, label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
}

export function ActivityGoalsPanel() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PeriodKind>("day");
  const [ref, setRef] = useState<Date>(new Date());
  const { start, end, label } = useMemo(() => computePeriod(period, ref), [period, ref]);
  const startKey = ymd(start);

  const { data: goals = [] } = useQuery({
    queryKey: ["activity-goals", period, startKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("activity_goals")
        .select("*")
        .eq("period_kind", period)
        .eq("period_start", startKey);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contagem de interações + clientes únicos no período
  const { data: agg = { counts: {} as Record<string, number>, clients: {} as Record<string, number> } } = useQuery({
    queryKey: ["activity-counts", startKey, ymd(end)],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_interactions")
        .select("kind, client_id, occurred_at")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .limit(10000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      const clientsSet: Record<string, Set<string>> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.kind] = (counts[r.kind] ?? 0) + 1;
        (clientsSet[r.kind] ??= new Set()).add(r.client_id);
      });
      const clients: Record<string, number> = {};
      Object.entries(clientsSet).forEach(([k, s]) => { clients[k] = s.size; });
      return { counts, clients };
    },
    refetchInterval: 60_000,
  });

  // Snapshot total de clientes por tipo (todo o histórico — mostra "onde estamos hoje")
  const { data: totalsByKind = {} as Record<string, number> } = useQuery({
    queryKey: ["activity-clients-total"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_interactions")
        .select("kind, client_id")
        .limit(50000);
      if (error) throw error;
      const setMap: Record<string, Set<string>> = {};
      (data ?? []).forEach((r: any) => { (setMap[r.kind] ??= new Set()).add(r.client_id); });
      const out: Record<string, number> = {};
      Object.entries(setMap).forEach(([k, s]) => { out[k] = s.size; });
      return out;
    },
    refetchInterval: 120_000,
  });

  const counts = agg.counts;
  const clientsInPeriod = agg.clients;


  useEffect(() => {
    const ch = supabase
      .channel(`activity-goals-live:${period}:${startKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_interactions" },
        () => {
          qc.invalidateQueries({ queryKey: ["activity-counts", startKey, ymd(end)] });
          qc.invalidateQueries({ queryKey: ["activity-clients-total"] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_goals" },
        () => qc.invalidateQueries({ queryKey: ["activity-goals", period, startKey] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [period, startKey, end, qc]);

  const goalMap = useMemo(() => {
    const m: Record<string, any> = {};
    (goals ?? []).forEach((g: any) => { m[g.kind] = g; });
    return m;
  }, [goals]);

  const totals = useMemo(() => {
    let done = 0, target = 0;
    GOAL_KINDS.forEach((k) => {
      done += counts[k] ?? 0;
      target += Number(goalMap[k]?.target_value ?? 0);
    });
    return { done, target, missing: Math.max(0, target - done) };
  }, [counts, goalMap]);

  async function saveTarget(kind: InteractionKind, value: number) {
    const v = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    const { error } = await (supabase as any).from("activity_goals").upsert({
      period_kind: period, period_start: startKey, kind, target_value: v,
    }, { onConflict: "period_kind,period_start,kind" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["activity-goals", period, startKey] });
  }

  const shift = (n: number) => {
    if (period === "day") setRef((d) => addDays(d, n));
    else if (period === "week") setRef((d) => addDays(d, 7 * n));
    else setRef((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  };

  return (
    <Card className="p-4 bg-white border-slate-200/70">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Target className="size-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Metas de Atividade</div>
            <div className="text-[11px] text-slate-500 capitalize">{label}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => { setPeriod(v as PeriodKind); setRef(new Date()); }}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-[11px] px-3">Dia</TabsTrigger>
              <TabsTrigger value="week" className="text-[11px] px-3">Semana</TabsTrigger>
              <TabsTrigger value="month" className="text-[11px] px-3">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setRef(new Date())}>Hoje</Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Feitos</div>
          <div className="text-xl font-black font-mono text-emerald-800">{totals.done}</div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Meta</div>
          <div className="text-xl font-black font-mono text-slate-800">{totals.target}</div>
        </div>
        <div className="rounded-lg bg-rose-50 border border-rose-100 p-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Faltam</div>
          <div className="text-xl font-black font-mono text-rose-800">{totals.missing}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left px-3 py-2 font-bold">Atividade</th>
              <th className="text-right px-3 py-2 font-bold w-20">Feito</th>
              <th className="text-right px-3 py-2 font-bold w-24">Meta</th>
              <th className="text-right px-3 py-2 font-bold w-20">Falta</th>
              <th className="text-left px-3 py-2 font-bold w-[35%]">Progresso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {GOAL_KINDS.map((k) => {
              const meta = kindMeta(k);
              const done = counts[k] ?? 0;
              const target = Number(goalMap[k]?.target_value ?? 0);
              const missing = Math.max(0, target - done);
              const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
              const barColor = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
              return (
                <tr key={k} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", meta.dot)} />
                      <span className="font-medium text-slate-800">{meta.label}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 font-mono font-bold text-slate-900">{done}</td>
                  <td className="text-right px-3 py-2">
                    <Input
                      type="number" min={0}
                      defaultValue={target}
                      key={`${period}-${startKey}-${k}-${target}`}
                      className="h-7 w-20 ml-auto text-right font-mono"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value || "0", 10);
                        if (v !== target) saveTarget(k, v);
                      }}
                    />
                  </td>
                  <td className={cn("text-right px-3 py-2 font-mono font-bold", missing > 0 ? "text-rose-600" : "text-emerald-600")}>{missing}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500 mt-3">
        Contagem baseada no <b>Registro de Interações</b> do cliente (aba Relacionamento). Cada interação classificada pelo tipo entra automaticamente aqui.
      </p>
    </Card>
  );
}
