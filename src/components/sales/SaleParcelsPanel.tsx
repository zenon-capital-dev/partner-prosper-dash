import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { paymentReceivedAmount, isVoidedPaymentStatus } from "@/lib/financial";
import { formatCashDate } from "@/lib/cashFlow";

/** Parcelas da venda, só leitura. A baixa fica em Registrar Recebimento e no Fluxo de caixa. */
export function SaleParcelsPanel({ saleId, saleAmount }: { saleId: string; saleAmount: number }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["sale-parcels", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, amount_paid, paid_at, due_date, status, installment_number, installments_count, description")
        .eq("sale_id", saleId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = (data as any[]).filter((p) => !isVoidedPaymentStatus(p.status));
  const total = active.reduce((t, p) => t + Number(p.amount || 0), 0);
  const received = active.reduce((t, p) => t + paymentReceivedAmount(p), 0);
  const differs = active.length > 0 && Math.abs(total - saleAmount) > 0.01;

  return (
    <div className="px-6 sm:px-8 py-4 bg-white border-t border-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-700">Parcelas</h4>
        <p className="text-[12px] text-slate-600 tabular-nums">
          Soma {formatBRL(total)} · Recebido {formatBRL(received)} · Em aberto {formatBRL(Math.max(total - received, 0))}
        </p>
      </div>
      {differs && (
        <p className="mb-2 text-[12px] text-amber-700">A soma das parcelas é diferente do valor da venda ({formatBRL(saleAmount)}). Em venda recorrente, confira se o valor é mensal ou total.</p>
      )}
      {isLoading && <p className="text-[12px] text-slate-500">Carregando…</p>}
      {!isLoading && active.length === 0 && <p className="text-[12px] text-slate-500">Nenhuma parcela gerada. Elas são criadas quando a venda é finalizada.</p>}
      {active.length > 0 && (
        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-md border border-slate-200/70 text-[12px]">
          {active.map((p: any) => {
            const got = paymentReceivedAmount(p);
            return (
              <div key={p.id} className="grid grid-cols-4 gap-2 px-3 py-1.5 tabular-nums">
                <span>{p.installment_number && p.installments_count > 1 ? `${p.installment_number}/${p.installments_count}` : "Única"} · {formatCashDate(p.due_date)}</span>
                <span className="text-right">{formatBRL(Number(p.amount || 0))}</span>
                <span className="text-right">{formatBRL(got)}</span>
                <span className="text-right text-slate-500">{got >= Number(p.amount || 0) ? "Quitada" : got > 0 ? "Parcial" : "Em aberto"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}