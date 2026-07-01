import { useState, useMemo } from "react";
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
  const [form, setForm] = useState({ goal_type: "revenue" as GoalType, target_value: "" });

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
  const { data: actual } = useQuery({
    queryKey: ["sales_goals_actual", month],
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
        (supabase as any).from("sales").select("id", { count: "exact", head: true })
          .gte("created_at", start).lt("created_at", end),
        (supabase as any).from("payments").select("amount")
          .eq("status", "pago").gte("paid_at", start).lt("paid_at", end).limit(1000),
        (supabase as any).from("client_timeline").select("id", { count: "exact", head: true })
          .eq("event_type", "journey_stage_change").gte("created_at", start).lt("created_at", end),
        (supabase as any).from("leads").select("id", { count: "exact", head: true })
          .eq("status", "won").gte("updated_at", start).lt("updated_at", end),
      ]);
      const payRows = (paymentsR.data ?? []) as { amount: number }[];
      return {
        leads: leadsR.count ?? 0,
        proposals: propR.count ?? 0,
        sales_count: salesR.count ?? 0,
        revenue: payRows.reduce((s, r) => s + Number(r.amount || 0), 0),
        stage_movements: stageR.count ?? 0,
        clients_closed: closedR.count ?? 0,
      };
    },

    enabled: isAdmin,
  });

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
    const { error } = await (supabase as any).from("sales_goals").upsert({
      period_month: month, goal_type: form.goal_type, target_value: value, responsible_id: null,
    }, { onConflict: "period_month,goal_type" });
    if (error) { toast.error(error.message); return; }
    toast.success("Meta salva");
    setOpen(false); setForm({ goal_type: "revenue", target_value: "" });
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

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs font-bold uppercase text-slate-600">Período</Label>
        <Input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")} className="w-44" />
        <span className="text-sm text-slate-600 capitalize">{monthLabel(month)}</span>
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
                <Select value={form.goal_type} onValueChange={(v) => setForm({ ...form, goal_type: v as GoalType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
              const t = TYPES.find((x) => x.value === g.goal_type)!;
              const realized = (actual as any)?.[g.goal_type] ?? 0;
              const pct = g.target_value > 0 ? Math.min(100, (realized / g.target_value) * 100) : 0;
              return (
                <Card key={g.id} className="p-4 bg-white border-slate-200/70">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-500">{t.label}</div>
                      <div className="text-lg font-black mt-1">
                        {t.isCurrency ? fmtMoney(realized) : realized}
                        <span className="text-slate-400 font-semibold text-sm"> / {t.isCurrency ? fmtMoney(Number(g.target_value)) : Number(g.target_value)}</span>
                      </div>
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
