import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { PageHero } from "@/components/PageHero";
import { paymentSaleIsFinalized } from "@/lib/financial";
import { StageFilterBar } from "@/components/filters/StageFilterBar";
import { useStageMatcher } from "@/hooks/useSharedStageFilter";

type GoalType = "leads" | "proposals" | "sales_count" | "revenue" | "stage_movements" | "clients_closed";
const TYPES: { value: GoalType; label: string; isCurrency: boolean }[] = [
  { value: "leads", label: "Leads captados", isCurrency: false },
  { value: "proposals", label: "Propostas enviadas", isCurrency: false },
  { value: "sales_count", label: "Qtd. de vendas", isCurrency: false },
  { value: "revenue", label: "Receita recebida (R$)", isCurrency: true },
  { value: "stage_movements", label: "Movimentações na esteira", isCurrency: false },
  { value: "clients_closed", label: "Clientes fechados", isCurrency: false },
];


function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthLabel(s: string) {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
const fmtMoney = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function SalesGoals() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ goal_type: "revenue" as GoalType | "custom", custom_name: "", is_currency: false, target_value: "" });

  const { data: goals = [] } = useQuery({
    queryKey: ["sales_goals", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sales_goals").select("*").eq("period_month", month).order("goal_type");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // Realizado a partir das tabelas existentes
  const { stageIds } = useStageMatcher();
  const stageKey = stageIds.slice().sort().join(",");
  const stageFilterActive = stageIds.length > 0;

  const { data: actual } = useQuery({
    queryKey: ["sales_goals_actual", month, stageKey],
    queryFn: async () => {
      const start = month;
      const next = new Date(month + "T12:00:00");
      next.setMonth(next.getMonth() + 1);
      const end = next.toISOString().slice(0, 10);

      const [leadsR, propR, salesR, paymentsR, stageR, closedR] = await Promise.all([
        (supabase as any).from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", start).lt("created_at", end),
        (supabase as any).from("proposals").select("id", { count: "exact", head: true })
          .gte("created_at", start).lt("created_at", end),
        (supabase as any).from("sales").select("id, client_id, stage_id_at_sale")
          .eq("status", "concluida").gte("created_at", start).lt("created_at", end).limit(2000),
        (supabase as any).from("payments").select("amount, sale_id, sales(id, status, client_id, stage_id_at_sale)")
          .eq("status", "pago").gte("paid_at", start).lt("paid_at", end).limit(1000),
        (supabase as any).from("client_timeline").select("id", { count: "exact", head: true })
          .eq("event_type", "journey_stage_change").gte("created_at", start).lt("created_at", end),
        (supabase as any).from("leads").select("id", { count: "exact", head: true })
          .eq("status", "won").gte("updated_at", start).lt("updated_at", end),
      ]);

      // Filtro histórico: usa o snapshot do estágio no momento da venda
      // (stage_id_at_sale) para não distorcer números quando o cliente muda
      // de estágio depois. Vendas sem snapshot ficam de fora quando o filtro
      // de estágio está ativo.
      const stageSet = new Set(stageIds);
      const saleMatches = (row: any) =>
        !stageFilterActive || (row?.stage_id_at_sale && stageSet.has(row.stage_id_at_sale));

      const saleRows = ((salesR.data ?? []) as any[]).filter(saleMatches);
      const payRows = ((paymentsR.data ?? []) as any[])
        .filter(paymentSaleIsFinalized)
        .filter((p) => saleMatches(p.sales));
      return {
        leads: leadsR.count ?? 0,
        proposals: propR.count ?? 0,
        sales_count: saleRows.length,
        revenue: payRows.reduce((s, r) => s + Number(r.amount || 0), 0),
        stage_movements: stageR.count ?? 0,
        clients_closed: closedR.count ?? 0,
      };
    },
    enabled: isAdmin,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  // Atualiza realizado quando leads/propostas/vendas/pagamentos/timeline mudarem
  useEffect(() => {
    if (!isAdmin) return;
    const invalidateActual = () => qc.invalidateQueries({ queryKey: ["sales_goals_actual", month] });
    const invalidateGoals = () => qc.invalidateQueries({ queryKey: ["sales_goals", month] });
    const invalidateAll = () => { invalidateActual(); invalidateGoals(); };
    const ch = supabase
      .channel(`goals-actual-live:${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, invalidateActual)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposals" }, invalidateActual)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, invalidateActual)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, invalidateActual)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_timeline" }, invalidateActual)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, invalidateActual)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_goals" }, invalidateAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, month, qc]);

  const funnel = useMemo(() => {
    if (!actual) return null;
    const conv = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
    return {
      leadToProp: conv(actual.proposals, actual.leads),
      propToSale: conv(actual.sales_count, actual.proposals),
      leadToSale: conv(actual.sales_count, actual.leads),
    };
  }, [actual]);

  async function saveGoal() {
    const value = parseFloat(form.target_value.replace(",", "."));
    if (!value || value <= 0) { toast.error("Valor da meta inválido"); return; }
    let goalTypeKey: string = form.goal_type;
    if (form.goal_type === "custom") {
      const name = form.custom_name.trim();
      if (!name) { toast.error("Dê um nome ao índice personalizado"); return; }
      goalTypeKey = `custom:${form.is_currency ? "money" : "num"}:${name}`;
    }
    const { error } = await (supabase as any).from("sales_goals").upsert({
      period_month: month, goal_type: goalTypeKey, target_value: value, responsible_id: null,
    }, { onConflict: "period_month,goal_type" });
    if (error) { toast.error(error.message); return; }
    toast.success("Meta salva");
    setOpen(false); setForm({ goal_type: "revenue", custom_name: "", is_currency: false, target_value: "" });
    qc.invalidateQueries({ queryKey: ["sales_goals", month] });
  }


  async function deleteGoal(id: string) {
    if (!(await confirmAction({ title: "Remover meta?", description: "Esta ação não pode ser desfeita." }))) return;
    const { error } = await (supabase as any).from("sales_goals").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["sales_goals", month] });
  }

  if (!isAdmin) return <div className="p-8 text-sm text-slate-600">Acesso restrito.</div>;

  if (!isAdmin) return <div className="p-8 text-sm text-slate-600">Acesso restrito.</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        icon={<Target className="size-5" />}
        title="Metas Comerciais"
        description="Converte a esteira de atendimento em números: leads → propostas → vendas."
      />

      <ActivityGoalsPanel />



      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs font-bold uppercase text-slate-600">Período</Label>
        <Input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")} className="w-44" />
        <span className="text-sm text-slate-600 capitalize">{monthLabel(month)}</span>
        <StageFilterBar />
        <div className="flex-1" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Nova meta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Definir meta</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.goal_type} onValueChange={(v) => setForm({ ...form, goal_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    <SelectItem value="custom">✨ Índice personalizado…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.goal_type === "custom" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome do índice</Label>
                    <Input value={form.custom_name} onChange={(e) => setForm({ ...form, custom_name: e.target.value })} placeholder="ex: NPS, Reuniões agendadas, Ticket médio…" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="is_currency" type="checkbox" checked={form.is_currency} onChange={(e) => setForm({ ...form, is_currency: e.target.checked })} />
                    <Label htmlFor="is_currency" className="cursor-pointer">Meta em R$ (valor monetário)</Label>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Valor da meta</Label>
                <Input value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="ex: 50000" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={saveGoal}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Esteira / funil */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { k: "leads", label: "Leads", v: actual?.leads ?? 0 },
          { k: "proposals", label: "Propostas", v: actual?.proposals ?? 0 },
          { k: "sales_count", label: "Vendas (qtd)", v: actual?.sales_count ?? 0 },
          { k: "revenue", label: "Receita", v: actual?.revenue ?? 0, money: true },
        ].map((c) => (
          <Card key={c.k} className="p-4 bg-white border-slate-200/70">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {c.money ? fmtMoney(c.v) : c.v}
            </div>
          </Card>
        ))}
      </div>

      {funnel && (
        <Card className="p-4 bg-white border-slate-200/70">
          <div className="text-xs font-bold uppercase text-slate-600 mb-3">Conversão da esteira</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>Lead → Proposta: <span className="font-bold text-indigo-700">{funnel.leadToProp.toFixed(1)}%</span></div>
            <div>Proposta → Venda: <span className="font-bold text-indigo-700">{funnel.propToSale.toFixed(1)}%</span></div>
            <div>Lead → Venda: <span className="font-bold text-indigo-700">{funnel.leadToSale.toFixed(1)}%</span></div>
          </div>
        </Card>
      )}

      {/* Metas vs realizado */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-slate-600">Metas definidas</h2>
        {goals.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500 bg-white border-slate-200/70">
            Nenhuma meta para este mês. Clique em <b>Nova meta</b> para definir.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {goals.map((g: any) => {
              const isCustom = typeof g.goal_type === "string" && g.goal_type.startsWith("custom:");
              const t = isCustom
                ? { label: g.goal_type.split(":").slice(2).join(":") || "Personalizado", isCurrency: g.goal_type.startsWith("custom:money:") }
                : TYPES.find((x) => x.value === g.goal_type) ?? { label: g.goal_type, isCurrency: false };
              const realized = isCustom ? Number(g.actual_value ?? 0) : ((actual as any)?.[g.goal_type] ?? 0);
              const pct = g.target_value > 0 ? Math.min(100, (realized / g.target_value) * 100) : 0;
              return (
                <Card key={g.id} className="p-4 bg-white border-slate-200/70">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold uppercase text-slate-500 truncate">{t.label}{isCustom && <span className="ml-1 text-[9px] text-indigo-600 font-black">CUSTOM</span>}</div>
                      <div className="text-lg font-black mt-1">
                        {t.isCurrency ? fmtMoney(realized) : realized}
                        <span className="text-slate-400 font-semibold text-sm"> / {t.isCurrency ? fmtMoney(Number(g.target_value)) : Number(g.target_value)}</span>
                      </div>
                      {isCustom && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Input
                            type="number" step="any"
                            defaultValue={g.actual_value ?? 0}
                            className="h-7 text-xs w-28"
                            onBlur={async (e) => {
                              const v = parseFloat(e.target.value.replace(",", ".")) || 0;
                              const { error } = await (supabase as any).from("sales_goals").update({ actual_value: v }).eq("id", g.id);
                              if (error) toast.error(error.message);
                              else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["sales_goals", month] }); }
                            }}
                          />
                          <span className="text-[10px] text-slate-500">realizado</span>
                        </div>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteGoal(g.id)}>
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                  <Progress value={pct} className="mt-3 h-2" />
                  <div className="text-[11px] mt-1 text-slate-500">{pct.toFixed(1)}% da meta</div>
                </Card>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}
