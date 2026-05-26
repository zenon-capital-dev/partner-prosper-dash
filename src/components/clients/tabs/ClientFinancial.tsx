import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Wallet, DollarSign, ArrowUpRight, CheckCircle2, AlertCircle, ShoppingBag, Plus, ExternalLink } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";

export function ClientFinancial({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [marking, setMarking] = useState<string | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);

  const markPaid = async (paymentId: string, amount: number) => {
    const ok = await confirmAction({ title: "Confirmar baixa?", description: `Marcar este pagamento como pago no valor de ${formatBRL(amount)}.`, confirmText: "Dar baixa" });
    if (!ok) return;
    setMarking(paymentId);
    const { error } = await supabase.from("payments").update({ status: "pago", amount_paid: amount, paid_at: new Date().toISOString() }).eq("id", paymentId);
    setMarking(null);
    if (error) return toast.error("Erro ao dar baixa");
    toast.success("Pagamento confirmado");
    qc.invalidateQueries({ queryKey: ["client-payments", clientId] });
  };

  const { data: payments, isLoading } = useQuery({
    queryKey: ["client-payments", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(`
          *,
          client_product:client_products(products(name))
        `)
        .eq("client_id", clientId)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["client-sales", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, products(name), partners(full_name), referrers(full_name)")
        .eq("client_id", clientId)
        .order("sale_date", { ascending: false });
      return data ?? [];
    },
  });

  const totals = payments?.reduce((acc: any, p: any) => {
    acc.total += Number(p.amount || 0);
    acc.paid += Number(p.amount_paid || 0);
    acc.pending = acc.total - acc.paid;
    return acc;
  }, { total: 0, paid: 0, pending: 0 }) || { total: 0, paid: 0, pending: 0 };

  const salesTotal = sales.reduce((a: number, s: any) => a + Number(s.amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-up">
      <SaleFormDialog open={saleOpen} onOpenChange={setSaleOpen} clientId={clientId} onCreated={() => { qc.invalidateQueries({ queryKey: ["client-sales", clientId] }); qc.invalidateQueries({ queryKey: ["client-payments", clientId] }); }} />

      {/* Vendas do cliente */}
      <div className="cp-panel overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-gradient-to-r from-indigo-50/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><ShoppingBag className="size-4" /></div>
            <div>
              <h3 className="text-sm font-bold">Vendas registradas</h3>
              <p className="text-[11px] text-muted-foreground">{sales.length} venda(s) · Total {formatBRL(salesTotal)}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setSaleOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="size-4 mr-1.5" /> Nova venda
          </Button>
        </div>
        {salesLoading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Carregando vendas...</div>
        ) : sales.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhuma venda registrada para este cliente.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/40">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Produto</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parceiro / Indicador</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sales.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3 text-xs font-mono">{formatDate(s.sale_date)}</td>
                  <td className="px-6 py-3 font-medium">{s.products?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    {s.partners?.full_name || s.referrers?.full_name || "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-bold tabular-nums">{formatBRL(s.amount)}</td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      s.status === "concluida" && "bg-emerald-100 text-emerald-700",
                      s.status === "pendente" && "bg-amber-100 text-amber-700",
                      s.status === "em_andamento" && "bg-sky-100 text-sky-700",
                      s.status === "cancelada" && "bg-rose-100 text-rose-700",
                    )}>{s.status}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/vendas?search=${encodeURIComponent(s.id)}`)}>
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinancialCard label="Total Contratado" value={totals.total} icon={Wallet} color="indigo" />
        <FinancialCard label="Valor Recebido" value={totals.paid} icon={CheckCircle2} color="emerald" />
        <FinancialCard label="Saldo Devedor" value={totals.pending} icon={AlertCircle} color="amber" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Fluxo de Pagamentos</h3>
          <p className="text-xs text-muted-foreground">Controle de parcelas e faturas</p>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate(`/financeiro?clientId=${clientId}&new=1`)}>
          <DollarSign className="size-4 mr-2" /> Lançar Pagamento
        </Button>
      </div>

      <div className="cp-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parcela / Referência</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vencimento</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Carregando...</td></tr>
            ) : payments?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Nenhum lançamento financeiro.</td></tr>
            ) : payments?.map((payment: any, idx: number) => (
              <tr key={payment.id} className="hover:bg-muted/20 transition-colors group">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-bold text-foreground">Parcela {payment.installment_number || idx + 1}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{payment.client_product?.products?.name || "Geral"}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-mono">
                  {formatDate(payment.due_date)}
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-foreground tabular-nums">{formatBRL(payment.amount)}</p>
                  {payment.amount_paid > 0 && (
                    <p className="text-[10px] text-emerald-500 font-bold">Pago: {formatBRL(payment.amount_paid)}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusPill status={payment.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  {payment.status === "pago" ? (
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Quitado</span>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-xs font-bold hover:bg-emerald-500/10 hover:text-emerald-600" disabled={marking === payment.id} onClick={() => markPaid(payment.id, Number(payment.amount || 0))}>
                      {marking === payment.id ? "..." : "Dar baixa"} <ArrowUpRight className="size-3 ml-1" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinancialCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };
  return (
    <div className={cn("cp-panel p-6 flex items-center gap-5", colors[color])}>
      <div className="size-12 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">{label}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{formatBRL(value)}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    pago: { label: "PAGO", color: "text-emerald-600 bg-emerald-50" },
    pendente: { label: "PENDENTE", color: "text-amber-600 bg-amber-50" },
    atrasado: { label: "ATRASADO", color: "text-rose-600 bg-rose-50" },
    cancelado: { label: "CANCELADO", color: "text-slate-600 bg-slate-50" },
  };
  const config = map[status] || { label: status, color: "text-slate-600 bg-slate-50" };
  return (
    <span className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold tracking-widest border border-current", config.color)}>
      {config.label}
    </span>
  );
}
