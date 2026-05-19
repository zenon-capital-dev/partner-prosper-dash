import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserCheck, Plus, Search, MoreHorizontal, Pencil, Trash2, Award, Wallet, Users2, TrendingUp, Power } from "lucide-react";
import { formatBRL, formatPercent, initials, formatPhone } from "@/lib/format";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";

const empty = { active: true, commission_percent: 5 };

export default function Indicators() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState("");

  const { data: referrers = [] } = useQuery({
    queryKey: ["referrers-rich"],
    queryFn: async () => (await supabase.from("referrers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: splits = [] } = useQuery({
    queryKey: ["referrer-splits-all"],
    queryFn: async () => (await supabase.from("commission_splits").select("beneficiary_id, amount, status").eq("beneficiary_type", "referrer")).data ?? [],
  });

  const { data: clientsByReferrer = [] } = useQuery({
    queryKey: ["clients-by-referrer"],
    queryFn: async () => (await supabase.from("clients").select("id, referrer_id")).data ?? [],
  });

  const enriched = useMemo(() => {
    return (referrers ?? []).map((r: any) => {
      const mySplits = splits.filter((s: any) => s.beneficiary_id === r.id);
      const total = mySplits.reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const paid = mySplits.filter((s: any) => s.status === "pago").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const pending = mySplits.filter((s: any) => s.status === "pendente").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const clients = clientsByReferrer.filter((c: any) => c.referrer_id === r.id).length;
      return { ...r, _total: total, _paid: paid, _pending: pending, _clients: clients };
    }).filter((r: any) => !search || r.full_name?.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase()));
  }, [referrers, splits, clientsByReferrer, search]);

  const totals = useMemo(() => ({
    count: enriched.length,
    active: enriched.filter((r: any) => r.active).length,
    revenue: enriched.reduce((a: number, r: any) => a + r._total, 0),
    pending: enriched.reduce((a: number, r: any) => a + r._pending, 0),
  }), [enriched]);

  const submit = async () => {
    if (!form.full_name) { toast.error("Nome obrigatório"); return; }
    const payload = {
      full_name: form.full_name, email: form.email || null, phone: form.phone || null,
      document: form.document || null, pix_key: form.pix_key || null,
      commission_percent: Number(form.commission_percent ?? 5),
      active: form.active ?? true, notes: form.notes || null,
    };
    const { error } = editing?.id
      ? await supabase.from("referrers").update(payload).eq("id", editing.id)
      : await supabase.from("referrers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing?.id ? "Indicador atualizado" : "Indicador cadastrado");
    setOpen(false); setEditing(null); setForm(empty);
    qc.invalidateQueries({ queryKey: ["referrers-rich"] });
  };

  const remove = async (id: string) => {
    const { checkFkLinks, summarizeBlocks } = await import("@/lib/safe-delete");
    const res = await checkFkLinks(id, [
      { table: "clients", column: "referrer_id", label: "cliente(s)" },
      { table: "sales", column: "referrer_id", label: "venda(s)" },
    ]);
    if (!res.canDelete) {
      const summary = summarizeBlocks(res.blockedBy);
      if (!(await confirmAction(`Indicador vinculado a ${summary}. DESATIVAR em vez de excluir?`))) return;
      const { error } = await supabase.from("referrers").update({ active: false }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Indicador desativado"); qc.invalidateQueries({ queryKey: ["referrers-rich"] });
      return;
    }
    if (!(await confirmAction("Excluir este indicador?"))) return;
    const { error } = await supabase.from("referrers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); qc.invalidateQueries({ queryKey: ["referrers-rich"] });
  };

  const toggle = async (r: any) => {
    await supabase.from("referrers").update({ active: !r.active }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["referrers-rich"] });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        title="Indicadores"
        description="Pessoas que indicam clientes e recebem comissão por venda fechada."
        actions={
          canManage ? (
            <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="gap-2">
              <Plus className="size-4" /> Novo indicador
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users2} label="Indicadores" value={String(totals.count)} hint={`${totals.active} ativos`} />
        <Kpi icon={Award} label="Comissões geradas" value={formatBRL(totals.revenue)} />
        <Kpi icon={Wallet} label="A pagar" value={formatBRL(totals.pending)} tone="warning" />
        <Kpi icon={TrendingUp} label="Conversão média" value={enriched.length ? `${Math.round(enriched.reduce((a:number,r:any)=>a+r._clients,0)/enriched.length*10)/10} clientes/indicador` : "—"} />
      </div>

      <div className="vx-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou email" className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {enriched.length === 0 ? (
          <div className="p-16 text-center">
            <div className="size-14 rounded-2xl bg-primary-muted text-primary mx-auto mb-3 flex items-center justify-center"><UserCheck className="size-6" /></div>
            <p className="text-sm font-semibold">Nenhum indicador cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Cadastre quem traz clientes e configure a % de comissão.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Indicador</th>
                <th className="px-4 py-3 text-left font-semibold">Contato</th>
                <th className="px-4 py-3 text-left font-semibold">PIX</th>
                <th className="px-4 py-3 text-right font-semibold">% padrão</th>
                <th className="px-4 py-3 text-right font-semibold">Clientes</th>
                <th className="px-4 py-3 text-right font-semibold">Pago</th>
                <th className="px-4 py-3 text-right font-semibold">A pagar</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enriched.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-primary-muted text-primary flex items-center justify-center text-xs font-bold">{initials(r.full_name)}</div>
                      <div>
                        <p className="font-medium leading-tight">{r.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.notes ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{r.email ?? "—"}</div>
                    <div>{formatPhone(r.phone)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">{r.pix_key ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(r.commission_percent)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r._clients}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">{formatBRL(r._paid)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-warning">{formatBRL(r._pending)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">{r.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(r); setForm(r); setOpen(true); }}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggle(r)}><Power className="size-4 mr-2" /> {r.active ? "Desativar" : "Ativar"}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="size-4 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editing?.id ? "Editar indicador" : "Novo indicador"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2"><Label>Nome completo *</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div className="space-y-2"><Label>Chave PIX</Label><Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
            <div className="space-y-2"><Label>% Comissão padrão</Label><Input type="number" step="0.01" value={form.commission_percent ?? 5} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} /></div>
            <div className="space-y-2 flex items-end gap-3"><Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: any) {
  const toneCls = tone === "warning" ? "bg-warning-muted text-warning" : "bg-primary-muted text-primary";
  return (
    <div className="vx-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`size-8 rounded-lg ${toneCls} flex items-center justify-center`}><Icon className="size-4" /></div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
