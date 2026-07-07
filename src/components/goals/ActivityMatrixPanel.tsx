import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Table as TableIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { GOAL_KINDS, kindMeta, type InteractionKind } from "@/lib/interaction-kinds";
import { toast } from "sonner";

type PeriodKind = "day" | "week" | "month";

function startOfWeekMon(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function computePeriod(kind: PeriodKind, ref: Date) {
  if (kind === "day") { const s = startOfDay(ref); return { start: s, end: addDays(s,1), label: s.toLocaleDateString("pt-BR",{ weekday:"long", day:"2-digit", month:"long" }) }; }
  if (kind === "week") { const s = startOfWeekMon(ref); const e = addDays(s,7); return { start: s, end: e, label: `Semana ${s.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} → ${addDays(e,-1).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}` }; }
  const s = startOfMonth(ref); const e = new Date(s.getFullYear(), s.getMonth()+1, 1);
  return { start: s, end: e, label: s.toLocaleDateString("pt-BR",{ month:"long", year:"numeric" }) };
}

export function ActivityMatrixPanel() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [ref, setRef] = useState<Date>(new Date());
  const [q, setQ] = useState("");
  const { start, end, label } = useMemo(() => computePeriod(period, ref), [period, ref]);
  const startKey = ymd(start);

  // Metas do período
  const { data: goals = [] } = useQuery({
    queryKey: ["activity-goals", period, startKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("activity_goals").select("*").eq("period_kind", period).eq("period_start", startKey);
      if (error) throw error; return data ?? [];
    },
  });
  const goalMap = useMemo(() => {
    const m: Record<string, number> = {};
    (goals ?? []).forEach((g: any) => { m[g.kind] = Number(g.target_value ?? 0); });
    return m;
  }, [goals]);

  // Interações do período
  const { data: interactions = [] } = useQuery({
    queryKey: ["activity-matrix", startKey, ymd(end)],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_interactions")
        .select("kind, client_id, created_by, occurred_at")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .limit(20000);
      if (error) throw error; return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const clientIds = useMemo(() => Array.from(new Set(interactions.map((i: any) => i.client_id).filter(Boolean))), [interactions]);
  const responsibleIds = useMemo(() => Array.from(new Set(interactions.map((i: any) => i.created_by).filter(Boolean))), [interactions]);

  const { data: clientsMap = {} } = useQuery({
    queryKey: ["matrix-clients", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("clients").select("id, full_name, partner_id, responsible_id").in("id", clientIds);
      if (error) throw error;
      const m: Record<string, any> = {}; (data ?? []).forEach((c: any) => m[c.id] = c); return m;
    },
  });

  const partnerIds = useMemo(() => Array.from(new Set(Object.values(clientsMap as any).map((c: any) => c?.partner_id).filter(Boolean))), [clientsMap]);
  const { data: partnersMap = {} } = useQuery({
    queryKey: ["matrix-partners", partnerIds.join(",")],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("partners").select("id, full_name").in("id", partnerIds);
      if (error) throw error;
      const m: Record<string, string> = {}; (data ?? []).forEach((p: any) => m[p.id] = p.full_name); return m;
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["matrix-profiles", responsibleIds.join(",")],
    enabled: responsibleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("id, full_name").in("id", responsibleIds);
      if (error) throw error;
      const m: Record<string, string> = {}; (data ?? []).forEach((p: any) => m[p.id] = p.full_name); return m;
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`activity-matrix:${period}:${startKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_interactions" },
        () => qc.invalidateQueries({ queryKey: ["activity-matrix", startKey, ymd(end)] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_goals" },
        () => qc.invalidateQueries({ queryKey: ["activity-goals", period, startKey] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [period, startKey, end, qc]);

  // Agregação por cliente × kind
  type Row = { clientId: string; clientName: string; partnerName: string; responsibleName: string; counts: Record<string, number>; total: number };
  const rows = useMemo<Row[]>(() => {
    const map: Record<string, Row> = {};
    (interactions as any[]).forEach((i) => {
      const cid = i.client_id;
      if (!cid) return;
      const c = (clientsMap as any)[cid];
      const r = map[cid] ??= {
        clientId: cid,
        clientName: c?.full_name || "—",
        partnerName: c?.partner_id ? ((partnersMap as any)[c.partner_id] || "—") : "—",
        responsibleName: i.created_by ? ((profilesMap as any)[i.created_by] || "—") : "—",
        counts: {},
        total: 0,
      };
      r.counts[i.kind] = (r.counts[i.kind] ?? 0) + 1;
      r.total += 1;
    });
    const arr = Object.values(map);
    const term = q.trim().toLowerCase();
    return (term ? arr.filter(r => r.clientName.toLowerCase().includes(term) || r.partnerName.toLowerCase().includes(term) || r.responsibleName.toLowerCase().includes(term)) : arr)
      .sort((a, b) => b.total - a.total || a.clientName.localeCompare(b.clientName));
  }, [interactions, clientsMap, partnersMap, profilesMap, q]);

  const totalsPerKind = useMemo(() => {
    const t: Record<string, number> = {};
    GOAL_KINDS.forEach((k) => { t[k] = rows.reduce((s, r) => s + (r.counts[k] ?? 0), 0); });
    return t;
  }, [rows]);

  const sim = rows.filter(r => r.total > 0).length;
  const nao = 0; // clientes explicitamente "sem sucesso" — reservado
  const semAtuacao = rows.length === 0 ? 0 : 0;

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
            <TableIcon className="size-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Planilha de Atividade</div>
            <div className="text-[11px] text-slate-500 capitalize">{label} · {rows.length} cliente(s) com registro</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente / parceiro / responsável" className="h-8 pl-7 text-xs w-64" />
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-3">
        {/* Coluna lateral: SIM / NÃO / SEM ATUAÇÃO */}
        <div className="space-y-2">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">SIM</div>
            <div className="text-2xl font-black font-mono text-emerald-800">{sim}</div>
            <div className="text-[10px] text-emerald-600">clientes com interação</div>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">NÃO</div>
            <div className="text-2xl font-black font-mono text-rose-800">{nao}</div>
            <div className="text-[10px] text-rose-600">sem sucesso</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">SEM ATUAÇÃO</div>
            <div className="text-2xl font-black font-mono text-amber-800">{semAtuacao}</div>
            <div className="text-[10px] text-amber-600">período em branco</div>
          </div>
        </div>

        {/* Tabela principal */}
        <div className="overflow-auto rounded-lg border border-slate-200 max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-800 text-white">
              <tr>
                <th className="text-left px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Responsável</th>
                <th className="text-left px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Cliente</th>
                <th className="text-left px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Parceiro</th>
                {GOAL_KINDS.map((k) => (
                  <th key={k} className="text-center px-2 py-2 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">{kindMeta(k).label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={3 + GOAL_KINDS.length} className="text-center text-slate-400 py-8">Nenhuma interação registrada neste período</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.clientId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700 uppercase text-[11px]">{r.responsibleName}</td>
                  <td className="px-3 py-1.5 text-slate-900 font-medium">{r.clientName}</td>
                  <td className="px-3 py-1.5 text-slate-600">{r.partnerName}</td>
                  {GOAL_KINDS.map((k) => {
                    const v = r.counts[k] ?? 0;
                    return (
                      <td key={k} className={cn("text-center px-2 py-1.5 font-mono", v > 0 ? "text-slate-900 font-bold" : "text-slate-300")}>{v}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-slate-800 text-white">
                <td colSpan={3} className="px-3 py-2 text-[11px] font-black uppercase tracking-wider">Feitos</td>
                {GOAL_KINDS.map((k) => (
                  <td key={k} className="text-center px-2 py-2 font-mono font-black">{totalsPerKind[k]}</td>
                ))}
              </tr>
              <tr className="bg-slate-100">
                <td colSpan={3} className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700">Metas</td>
                {GOAL_KINDS.map((k) => (
                  <td key={k} className="text-center px-1 py-1">
                    <Input
                      type="number" min={0}
                      defaultValue={goalMap[k] ?? 0}
                      key={`${period}-${startKey}-${k}-${goalMap[k] ?? 0}`}
                      className="h-7 w-16 mx-auto text-center font-mono text-xs"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value || "0", 10);
                        if (v !== (goalMap[k] ?? 0)) saveTarget(k, v);
                      }}
                    />
                  </td>
                ))}
              </tr>
              <tr className="bg-rose-600 text-white">
                <td colSpan={3} className="px-3 py-2 text-[11px] font-black uppercase tracking-wider">Falta</td>
                {GOAL_KINDS.map((k) => {
                  const done = totalsPerKind[k] ?? 0;
                  const target = goalMap[k] ?? 0;
                  const miss = Math.max(0, target - done);
                  return <td key={k} className="text-center px-2 py-2 font-mono font-black">{miss}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mt-3">
        Cada linha é um <b>cliente</b> com interações no período. Colunas contam por tipo (Abordado, Retorno, Agenda…). Rodapé <b>Feitos / Metas / Falta</b> replica o modelo de planilha — edite as metas direto na linha.
      </p>
    </Card>
  );
}
