import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

const ROLE: Record<string, string> = { partner: "Parceiro", referrer: "Indicador", collaborator: "Colaborador" };

/**
 * Vendas antigas não quitadas aguardando revisão das deduções para entrar
 * na regra nova, e quem já recebeu mais do que a regra nova daria.
 */
export function LegacyReviewBanner({ pendingCount, reviewOnly, onToggle }: { pendingCount: number; reviewOnly: boolean; onToggle: () => void }) {
  const [showOverpaid, setShowOverpaid] = useState(false);
  const { data: overpaid = [] } = useQuery({
    queryKey: ["commission-overpayments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_commission_overpayments")
        .select("sale_id, client_name, beneficiary_type, beneficiary_name, due_amount, paid_amount, overpaid")
        .order("overpaid", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 60_000,
  });

  if (pendingCount === 0 && overpaid.length === 0 && !reviewOnly) return null;
  const totalOver = overpaid.reduce((s, r) => s + Number(r.overpaid || 0), 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 mt-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex flex-wrap items-center gap-3">
        <AlertTriangle className="size-4 text-amber-700 shrink-0" />
        <div className="flex-1 min-w-[220px] text-[13px] text-amber-900">
          {pendingCount > 0 ? (
            <>
              <strong>{pendingCount} {pendingCount === 1 ? "venda antiga aguarda" : "vendas antigas aguardam"}</strong> revisão das deduções.
              Abra cada uma, preencha as deduções e salve: a regra nova passa a valer só para o que ainda não foi pago.
            </>
          ) : reviewOnly ? (
            <>Nenhuma venda antiga aguardando revisão.</>
          ) : null}
          {overpaid.length > 0 && (
            <span className="block mt-0.5">
              {overpaid.length} {overpaid.length === 1 ? "pessoa recebeu" : "pessoas receberam"} {formatBRL(totalOver)} a mais do que a regra nova daria. Nada é cobrado de volta automaticamente.
            </span>
          )}
        </div>
        {(pendingCount > 0 || reviewOnly) && (
          <Button size="sm" variant={reviewOnly ? "default" : "outline"} onClick={onToggle}>
            {reviewOnly ? "Mostrar todas" : "Ver só as pendentes"}
          </Button>
        )}
        {overpaid.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShowOverpaid(true)}>Ver pagos a mais</Button>
        )}
      </div>

      <Dialog open={showOverpaid} onOpenChange={setShowOverpaid}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Pago a mais pela regra nova</DialogTitle>
            <DialogDescription>Quanto cada um já recebeu na venda e quanto daria pela regra nova. É só informativo.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Quem</th>
                  <th className="py-2 pr-3 text-right">Regra nova</th>
                  <th className="py-2 pr-3 text-right">Já pago</th>
                  <th className="py-2 text-right">A mais</th>
                </tr>
              </thead>
              <tbody>
                {overpaid.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{r.client_name || "—"}</td>
                    <td className="py-2 pr-3">{r.beneficiary_name || "—"} <span className="text-slate-500">· {ROLE[r.beneficiary_type] ?? r.beneficiary_type}</span></td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatBRL(r.due_amount)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatBRL(r.paid_amount)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-rose-700">{formatBRL(r.overpaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
