import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { Check, X } from "lucide-react";

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  partner: { label: "Parceiro", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  referrer: { label: "Indicador", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  collaborator: { label: "Colaborador", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pago: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function AllBeneficiariesTable() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "pix",
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["commission-splits-unified"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_commissions_unified" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any[]) ?? [];
    },
  });

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const selectedTotals = useMemo(() => {
    const list = data.filter((r: any) => selected[r.id]);
    return {
      count: list.length,
      sum: list.reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
    };
  }, [data, selected]);

  const allSelected = data.length > 0 && data.every((r: any) => selected[r.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else {
      const next: Record<string, boolean> = {};
      data.forEach((r: any) => { if (r.status !== "pago") next[r.id] = true; });
      setSelected(next);
    }
  };

  const confirmPay = async () => {
    if (!selectedIds.length) return;
    const { error } = await supabase
      .from("commission_splits")
      .update({
        status: "pago",
        paid_at: new Date(payForm.paid_at).toISOString(),
        payment_method: payForm.payment_method,
      })
      .in("id", selectedIds);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selectedIds.length} comissão(ões) marcada(s) como paga(s)`);
    setPayOpen(false);
    setSelected({});
    qc.invalidateQueries({ queryKey: ["commission-splits-unified"] });
    qc.invalidateQueries({ queryKey: ["commissions-list"] });
  };

  const bulkCancel = async () => {
    if (!selectedIds.length) return;
    if (!(await confirmAction(`Cancelar ${selectedIds.length} comissão(ões)?`))) return;
    const { error } = await supabase
      .from("commission_splits")
      .update({ status: "cancelado", paid_at: null })
      .in("id", selectedIds);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissões canceladas");
    setSelected({});
    qc.invalidateQueries({ queryKey: ["commission-splits-unified"] });
  };

  return (
    <div className="vx-card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-900">Comissões por beneficiário</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão unificada de parceiros, indicadores e colaboradores (gerada automaticamente em cada venda).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <>
              <span className="text-xs text-slate-600 vx-mono">
                {selectedTotals.count} selecionada(s) · {formatBRL(selectedTotals.sum)}
              </span>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8" onClick={() => setPayOpen(true)}>
                <Check className="size-3.5 mr-1" /> Marcar como pago
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={bulkCancel}>
                <X className="size-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected({})}>Limpar</Button>
            </>
          ) : (
            <Badge variant="secondary" className="vx-mono">{data.length}</Badge>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60">
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Beneficiário</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente / Produto</th>
              <th className="px-4 py-3 text-right font-semibold">Base</th>
              <th className="px-4 py-3 text-right font-semibold">%</th>
              <th className="px-4 py-3 text-right font-semibold">Comissão</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Pago em</th>
              <th className="px-4 py-3 text-left font-semibold">Venda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {isLoading && (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Carregando…</td></tr>
            )}
            {!isLoading && data.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Nenhuma comissão registrada.</td></tr>
            )}
            {data.map((r: any) => {
              const t = TYPE_LABEL[r.beneficiary_type] ?? { label: r.beneficiary_type, cls: "" };
              const s = STATUS_LABEL[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-600" };
              const isPaid = r.status === "pago";
              return (
                <tr key={r.id} className="hover:bg-slate-50/40">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={!!selected[r.id]}
                      disabled={isPaid}
                      onCheckedChange={(v) => setSelected((p) => ({ ...p, [r.id]: !!v }))}
                    />
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className={t.cls}>{t.label}</Badge></td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.beneficiary_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{r.client_name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{r.product_name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-right vx-mono">{formatBRL(Number(r.sale_amount ?? 0))}</td>
                  <td className="px-4 py-3 text-right vx-mono">{Number(r.percent ?? 0).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right vx-mono font-semibold">{formatBRL(Number(r.amount ?? 0))}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={s.cls}>{s.label}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.paid_at ? formatDate(r.paid_at) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.sale_date ? formatDate(r.sale_date) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>
              {selectedTotals.count} comissão(ões) · Total {formatBRL(selectedTotals.sum)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Data do pagamento</Label>
              <Input
                type="date"
                value={payForm.paid_at}
                onChange={(e) => setPayForm((f) => ({ ...f, paid_at: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Método</Label>
              <Select value={payForm.payment_method} onValueChange={(v) => setPayForm((f) => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmPay}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
