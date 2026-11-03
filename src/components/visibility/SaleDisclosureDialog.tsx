import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatBRL, formatDate } from "@/lib/format";

interface Disclosure {
  sale_id: string;
  gross_amount?: number;
  revenue_type?: string | null;
  recurrence_months?: number | null;
  payments?: { installment_number: number | null; installments_count: number | null; due_date: string | null; amount: number; amount_paid: number | null; paid_at: string | null; status: string }[];
  deductions?: { name: string; percent: number | null; amount: number }[];
}

const STATUS: Record<string, string> = { pago: "Pago", paga: "Pago", pendente: "Em aberto", em_aberto: "Em aberto", parcial: "Parcial", parcialmente_pago: "Parcial", atrasado: "Atrasado", vencido: "Vencido" };

/**
 * Detalhes de uma venda para parceiro, indicador ou prestador.
 * O banco (my_sale_disclosure) só devolve o que o admin liberou para quem está logado.
 */
export function SaleDisclosureDialog({ saleId, title, onOpenChange }: { saleId: string | null; title?: string; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-sale-disclosure", saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("my_sale_disclosure", { p_sale_id: saleId });
      if (error) throw error;
      return (data ?? null) as Disclosure | null;
    },
  });

  const nothing = data && data.gross_amount == null && !data.payments && !data.deductions;

  return (
    <Dialog open={!!saleId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>{title || "Detalhes da venda"}</DialogTitle>
          <DialogDescription>Informações liberadas para você nesta venda.</DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && (!data || nothing) && <p className="text-sm text-muted-foreground">Nenhum detalhe adicional liberado para esta venda.</p>}

        {data?.gross_amount != null && (
          <div className="flex items-center justify-between border-b pb-2 text-sm">
            <span className="text-muted-foreground">
              Valor da venda{data.revenue_type === "recorrente" && data.recurrence_months ? ` (contrato de ${data.recurrence_months} meses)` : ""}
            </span>
            <span className="font-mono font-semibold tabular-nums">{formatBRL(data.gross_amount)}</span>
          </div>
        )}

        {data?.deductions && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deduções</p>
            {data.deductions.length === 0 && <p className="text-sm text-muted-foreground">Sem deduções.</p>}
            {data.deductions.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span>{d.name}{d.percent != null ? ` · ${Number(d.percent).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : ""}</span>
                <span className="font-mono tabular-nums">{formatBRL(d.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {data?.payments && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pagamentos do cliente</p>
            {data.payments.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma parcela gerada.</p>}
            {data.payments.map((p, i) => {
              const paid = Number(p.amount_paid || 0) > 0 ? Number(p.amount_paid) : p.status === "pago" || p.status === "paga" ? Number(p.amount) : 0;
              return (
                <div key={i} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 py-1">
                  <span className="min-w-0">
                    {p.installments_count && p.installments_count > 1 ? `Parcela ${p.installment_number}/${p.installments_count}` : "Parcela única"}
                    <span className="block text-xs text-muted-foreground">
                      vence {p.due_date ? formatDate(p.due_date) : "sem data"}{p.paid_at ? ` · pago ${formatDate(p.paid_at)}` : ""}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-mono tabular-nums">{formatBRL(p.amount)}</span>
                    <span className="block text-xs text-muted-foreground">{STATUS[p.status] ?? p.status}{paid > 0 && paid < Number(p.amount) ? ` · ${formatBRL(paid)} pago` : ""}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
