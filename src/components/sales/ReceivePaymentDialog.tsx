import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "@/lib/format";
import { ymdBR, nowBR } from "@/lib/datetime";
import { Wallet, TrendingUp, Receipt, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saleIsFinalized, paymentReceivedAmount, isPaymentPaidInFuture } from "@/lib/financial";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sale: any | null;
  onSaved?: () => void;
}

export function ReceivePaymentDialog({ open, onOpenChange, sale, onSaved }: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(ymdBR(nowBR()));
  const [competenceMonth, setCompetenceMonth] = useState(ymdBR(nowBR()).slice(0, 7));
  const [method, setMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const saleId = sale?.id;

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["sale-receipts", saleId],
    enabled: !!saleId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, amount_paid, paid_at, due_date, status, payment_method, notes, description, competence_month")
        .eq("sale_id", saleId)
        .order("paid_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      setAmount("");
      const today = ymdBR(nowBR());
      setPaidAt(today);
      setCompetenceMonth(today.slice(0, 7));
      setMethod("pix");
      setNotes("");
    }
  }, [open, saleId]);


  if (!sale) return null;

  const gross = Number(sale.amount || 0);
  const canReceive = saleIsFinalized(sale);
  // Recebido efetivo = somente pagamentos já quitados até hoje (agendamentos futuros NÃO contam).
  const received = receipts.reduce((s: number, r: any) => s + paymentReceivedAmount(r), 0);
  const scheduled = receipts.reduce(
    (s: number, r: any) => s + (isPaymentPaidInFuture(r) ? Number(r.amount_paid || r.amount || 0) : 0),
    0
  );
  const remaining = Math.max(gross - received - scheduled, 0);
  const pct = gross > 0 ? Math.min(100, (received / gross) * 100) : 0;

  const submit = async () => {
    if (!canReceive) {
      toast.error("Finalize a venda antes de registrar recebimentos");
      return;
    }
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (v > remaining + 0.009) {
      toast.error(`Valor excede o saldo restante (${formatBRL(remaining)})`);
      return;
    }
    setSaving(true);
    try {
      const today = ymdBR(nowBR());
      const isFuture = paidAt > today;
      const newReceived = received + (isFuture ? 0 : v);
      const isFull = !isFuture && newReceived >= gross - 0.009;
      const { error } = await supabase.from("payments").insert({
        sale_id: sale.id,
        client_id: sale.client_id,
        product_id: sale.product_id,
        amount: v,
        amount_paid: v,
        paid_at: `${paidAt}T12:00:00`,
        due_date: paidAt,
        competence_month: `${competenceMonth}-01`,
        status: (isFuture ? "pendente" : "pago") as any,
        payment_method: method,
        description: isFuture
          ? `Recebimento agendado — Venda ${sale.id.slice(0, 8)}`
          : `Recebimento parcial — Venda ${sale.id.slice(0, 8)}`,
        notes: notes || null,
      } as any);
      if (error) throw error;

      toast.success(isFuture ? "Recebimento agendado para o futuro" : (isFull ? "Venda quitada integralmente!" : "Recebimento registrado"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sale-receipts", sale.id] }),
        qc.invalidateQueries({ queryKey: ["sales-receipts-by-sale"] }),
        qc.invalidateQueries({ queryKey: ["sales-rich-v2"] }),
      ]);
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-snapshot"] });
      onSaved?.();
      setAmount("");
      setNotes("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar recebimento");
    } finally {
      setSaving(false);
    }
  };

  const removeReceipt = async (id: string) => {
    if (!confirm("Excluir este recebimento?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Recebimento excluído");
    qc.refetchQueries({ queryKey: ["sale-receipts", sale.id] });
    qc.refetchQueries({ queryKey: ["sales-receipts-by-sale"] });
  };

  const updateReceiptCompetence = async (id: string, ym: string) => {
    if (!ym) return;
    const { error } = await supabase.from("payments").update({ competence_month: `${ym}-01` } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Competência atualizada");
    qc.refetchQueries({ queryKey: ["sale-receipts", sale.id] });
    qc.refetchQueries({ queryKey: ["sales-receipts-by-sale"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border-slate-200 bg-white">
        <DialogHeader className="px-6 pt-6 pb-5 bg-gradient-to-br from-emerald-50 via-white to-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wallet className="size-5" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-slate-900">Recebimentos da Venda</DialogTitle>
              <DialogDescription className="text-[12px] text-slate-500 mt-0.5">
                {sale.clients?.full_name ?? "—"} · {sale.products?.name ?? "—"}
              </DialogDescription>
            </div>
          </div>

          {!canReceive && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
              Esta venda ainda está em negociação. Marque como finalizada para ativar o cronograma e lançar recebimentos.
            </div>
          )}

          {/* Progresso */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white border border-slate-200/70 px-3 py-2.5">
              <p className="text-[9.5px] uppercase tracking-wider font-bold text-slate-500">Total da Venda</p>
              <p className="text-base font-bold font-mono text-slate-900 tabular-nums">{formatBRL(gross)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/70 px-3 py-2.5">
              <p className="text-[9.5px] uppercase tracking-wider font-bold text-emerald-700">Recebido</p>
              <p className="text-base font-bold font-mono text-emerald-700 tabular-nums">{formatBRL(received)}</p>
            </div>
            <div className={cn(
              "rounded-lg border px-3 py-2.5",
              remaining > 0 ? "bg-amber-50/70 border-amber-200/70" : "bg-slate-50 border-slate-200/70"
            )}>
              <p className={cn("text-[9.5px] uppercase tracking-wider font-bold", remaining > 0 ? "text-amber-700" : "text-slate-500")}>
                Restante
              </p>
              <p className={cn("text-base font-bold font-mono tabular-nums", remaining > 0 ? "text-amber-700" : "text-slate-500")}>
                {formatBRL(remaining)}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-emerald-400")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10.5px] text-slate-500 mt-1 font-mono">{pct.toFixed(1)}% recebido</p>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[55vh] overflow-y-auto">
          {/* Form novo recebimento */}
          {remaining > 0 && canReceive ? (
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-3.5 text-emerald-600" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Registrar Novo Recebimento</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Valor recebido *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <Input
                      type="number" step="0.01" min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="h-10 pl-9 bg-white font-mono text-right tabular-nums"
                    />
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setAmount(String(remaining))}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                    >
                      Quitar tudo · {formatBRL(remaining)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(String((remaining / 2).toFixed(2)))}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                    >
                      50%
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Data do recebimento</Label>
                  <Input
                    type="date"
                    value={paidAt}
                    onChange={(e) => {
                      setPaidAt(e.target.value);
                      if (e.target.value) setCompetenceMonth(e.target.value.slice(0, 7));
                    }}
                    className="h-10 bg-white"
                  />
                  {paidAt > ymdBR(nowBR()) && (
                    <p className="text-[10px] font-semibold text-amber-700">
                      Data futura — registrado como <strong>agendado</strong>. Não entra no caixa até chegar a data.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Competência (mês de referência)</Label>
                  <Input
                    type="month"
                    value={competenceMonth}
                    onChange={(e) => setCompetenceMonth(e.target.value)}
                    className="h-10 bg-white"
                  />
                  <p className="text-[10px] text-slate-500">
                    Mês em que este valor entra no fluxo (mesmo que pago em outro mês).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Forma</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="ted">TED</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Observação</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ref. mês 06/2026..."
                    className="h-10 bg-white"
                  />
                </div>
              </div>
            </div>
          ) : remaining > 0 ? (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-4 flex items-start gap-3">
              <Wallet className="size-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-amber-900">Recebimento bloqueado até a finalização</p>
                <p className="text-[11px] text-amber-800/80">O saldo existe como projeção, mas não entra no caixa nem no cronograma enquanto a venda estiver em negociação.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/70 p-4 flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <div>
                <p className="text-[13px] font-bold text-emerald-800">Venda totalmente recebida</p>
                <p className="text-[11px] text-emerald-700/80">Não há saldo restante.</p>
              </div>
            </div>
          )}

          {/* Histórico */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="size-3.5 text-slate-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Histórico de Recebimentos</p>
              <span className="text-[10px] font-mono text-slate-400">({receipts.length})</span>
            </div>
            {isLoading ? (
              <p className="text-[12px] text-slate-400">Carregando...</p>
            ) : receipts.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">Nenhum recebimento registrado ainda.</p>
            ) : (
              <div className="rounded-lg border border-slate-200/70 overflow-hidden divide-y divide-slate-100">
                {receipts.map((r: any) => {
                  const future = isPaymentPaidInFuture(r);
                  const comp = r.competence_month ? String(r.competence_month).slice(0, 7) : null;
                  return (
                  <div key={r.id} className={cn("flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50/60", future ? "bg-amber-50/40" : "bg-white")}>
                    <div className={cn("size-7 rounded-md flex items-center justify-center text-[10px] font-bold uppercase", future ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                      {(r.payment_method || "—").slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[12.5px] font-bold font-mono tabular-nums", future ? "text-amber-800" : "text-slate-900")}>
                        {formatBRL(Number(r.amount_paid ?? r.amount ?? 0))}
                        {future && <span className="ml-2 text-[9.5px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">Agendado</span>}
                      </p>
                      <p className="text-[10.5px] text-slate-500 truncate">
                        {r.paid_at ? new Date(r.paid_at).toLocaleDateString("pt-BR") : "Sem data"} · {r.payment_method || "—"}
                        {comp ? ` · comp. ${comp.slice(5,7)}/${comp.slice(0,4)}` : ""}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeReceipt(r.id)}
                      className="text-[10.5px] font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded hover:bg-rose-50"
                    >
                      Excluir
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {remaining > 0 && canReceive && (
            <Button
              onClick={submit}
              disabled={saving || !amount || !canReceive}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Wallet className="size-4" />
              {saving ? "Registrando..." : "Registrar Recebimento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
