import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { PageHero } from "@/components/PageHero";

const POOL_TYPES = [
  { v: "zenon", l: "Zenon" },
  { v: "escritorio", l: "Escritório" },
  { v: "funcionarios", l: "Funcionários" },
  { v: "projeto", l: "Projeto" },
  { v: "geral", l: "Geral" },
];
const fmtMoney = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ResourcePools() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [openPool, setOpenPool] = useState(false);
  const [openMov, setOpenMov] = useState<string | null>(null);
  const [openHist, setOpenHist] = useState<string | null>(null);
  const [poolForm, setPoolForm] = useState({ name: "", pool_type: "geral", target_amount: "", description: "", color: "#6366F1" });
  const [movForm, setMovForm] = useState({ movement_type: "entrada", amount: "", description: "" });

  const { data: pools = [] } = useQuery({
    queryKey: ["resource_pools"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("resource_pools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["resource_pool_movements", openHist],
    queryFn: async () => {
      if (!openHist) return [];
      const { data, error } = await (supabase as any).from("resource_pool_movements")
        .select("*").eq("pool_id", openHist).order("occurred_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!openHist,
  });

  async function savePool() {
    if (!poolForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await (supabase as any).from("resource_pools").insert({
      name: poolForm.name.trim(),
      pool_type: poolForm.pool_type,
      target_amount: parseFloat(poolForm.target_amount || "0") || 0,
      description: poolForm.description || null,
      color: poolForm.color,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Caixinha criada");
    setOpenPool(false);
    setPoolForm({ name: "", pool_type: "geral", target_amount: "", description: "", color: "#6366F1" });
    qc.invalidateQueries({ queryKey: ["resource_pools"] });
  }

  async function deletePool(id: string) {
    if (!(await confirmAction({ title: "Excluir caixinha?", description: "Todos os movimentos vinculados serão removidos." }))) return;
    const { error } = await (supabase as any).from("resource_pools").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["resource_pools"] });
  }

  async function saveMov() {
    const amount = parseFloat(movForm.amount.replace(",", "."));
    if (!amount || amount <= 0) { toast.error("Valor inválido"); return; }
    if (!openMov) return;
    const { error } = await (supabase as any).from("resource_pool_movements").insert({
      pool_id: openMov,
      movement_type: movForm.movement_type,
      amount,
      description: movForm.description || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Movimento registrado");
    setOpenMov(null); setMovForm({ movement_type: "entrada", amount: "", description: "" });
    qc.invalidateQueries({ queryKey: ["resource_pools"] });
    qc.invalidateQueries({ queryKey: ["resource_pool_movements"] });
  }

  if (!isAdmin) return <div className="p-8 text-sm text-slate-600">Acesso restrito.</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        icon={<Wallet className="size-5" />}
        title="Caixinhas & Projetos"
        description="Cofrinhos virtuais para metas internas (Zenon, escritório, funcionários) e projetos. Lance valores manualmente ou vincule uma venda a um projeto — quando o pagamento for confirmado, a caixinha é creditada automaticamente."
      />


      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Zenon", pool_type: "zenon", color: "#6366F1" },
            { name: "Escritório", pool_type: "escritorio", color: "#0EA5E9" },
            { name: "Funcionários", pool_type: "funcionarios", color: "#10B981" },
          ].map((preset) => {
            const exists = pools.some((p: any) => p.pool_type === preset.pool_type);
            return (
              <Button
                key={preset.pool_type}
                size="sm"
                variant="outline"
                disabled={exists}
                onClick={async () => {
                  const { error } = await (supabase as any).from("resource_pools").insert({
                    name: preset.name, pool_type: preset.pool_type, color: preset.color, target_amount: 0,
                  });
                  if (error) { toast.error(error.message); return; }
                  toast.success(`Caixinha "${preset.name}" criada`);
                  qc.invalidateQueries({ queryKey: ["resource_pools"] });
                }}
              >
                <Plus className="size-3.5 mr-1" />{preset.name}{exists ? " ✓" : ""}
              </Button>
            );
          })}
        </div>
        <Dialog open={openPool} onOpenChange={setOpenPool}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Nova caixinha</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova caixinha</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nome</Label>
                <Input value={poolForm.name} onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Tipo</Label>
                  <Select value={poolForm.pool_type} onValueChange={(v) => setPoolForm({ ...poolForm, pool_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{POOL_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Meta (R$)</Label>
                  <Input value={poolForm.target_amount} onChange={(e) => setPoolForm({ ...poolForm, target_amount: e.target.value })} placeholder="0,00" />
                </div>
              </div>
              <div className="space-y-1.5"><Label>Descrição</Label>
                <Textarea value={poolForm.description} onChange={(e) => setPoolForm({ ...poolForm, description: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1.5"><Label>Cor</Label>
                <Input type="color" value={poolForm.color} onChange={(e) => setPoolForm({ ...poolForm, color: e.target.value })} className="w-20 h-10" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenPool(false)}>Cancelar</Button>
              <Button onClick={savePool}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pools.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500 bg-white border-slate-200/70">
          Nenhuma caixinha criada ainda.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((p: any) => {
            const pct = p.target_amount > 0 ? Math.min(100, (Number(p.current_balance) / Number(p.target_amount)) * 100) : 0;
            return (
              <Card key={p.id} className="p-4 bg-white border-slate-200/70 overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      {POOL_TYPES.find((t) => t.v === p.pool_type)?.l ?? p.pool_type}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deletePool(p.id)}>
                    <Trash2 className="size-4 text-rose-600" />
                  </Button>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black font-mono text-slate-900">{fmtMoney(Number(p.current_balance))}</div>
                  {p.target_amount > 0 && (
                    <div className="text-[11px] text-slate-500 mt-0.5">Meta: {fmtMoney(Number(p.target_amount))}</div>
                  )}
                </div>
                {p.target_amount > 0 && <Progress value={pct} className="mt-2 h-2" />}
                {p.description && <p className="text-xs text-slate-600 mt-2 line-clamp-2">{p.description}</p>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setOpenMov(p.id); setMovForm({ movement_type: "entrada", amount: "", description: "" }); }}>
                    <ArrowUpRight className="size-3.5 mr-1" />Movimento
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpenHist(p.id)}>Histórico</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Movement dialog */}
      <Dialog open={!!openMov} onOpenChange={(o) => !o && setOpenMov(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançar movimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Tipo</Label>
              <Select value={movForm.movement_type} onValueChange={(v) => setMovForm({ ...movForm, movement_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (aporte)</SelectItem>
                  <SelectItem value="saida">Saída (uso)</SelectItem>
                  <SelectItem value="ajuste">Ajuste manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Valor (R$)</Label>
              <Input value={movForm.amount} onChange={(e) => setMovForm({ ...movForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Descrição</Label>
              <Textarea value={movForm.description} onChange={(e) => setMovForm({ ...movForm, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMov(null)}>Cancelar</Button>
            <Button onClick={saveMov}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!openHist} onOpenChange={(o) => !o && setOpenHist(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico de movimentos</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {movements.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Sem movimentos.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-slate-500"><tr>
                  <th className="text-left py-2">Data</th><th className="text-left">Tipo</th>
                  <th className="text-right">Valor</th><th className="text-left">Descrição</th>
                </tr></thead>
                <tbody>
                  {movements.map((m: any) => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="py-2">{new Date(m.occurred_at).toLocaleDateString("pt-BR")}</td>
                      <td className="capitalize">
                        {m.movement_type === "entrada" ? <span className="text-emerald-700 inline-flex items-center gap-1"><ArrowUpRight className="size-3" />Entrada</span>
                          : m.movement_type === "saida" ? <span className="text-rose-700 inline-flex items-center gap-1"><ArrowDownRight className="size-3" />Saída</span>
                          : <span className="text-slate-700">Ajuste</span>}
                      </td>
                      <td className="text-right font-mono font-bold">{fmtMoney(Number(m.amount))}</td>
                      <td className="text-slate-600">{m.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
