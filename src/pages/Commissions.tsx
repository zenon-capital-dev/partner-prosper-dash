import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { formatBRL, formatDate, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { Wallet, Clock, CheckCircle2 } from "lucide-react";

export default function Commissions() {
  const qc = useQueryClient();

  const { data: commissions } = useQuery({
    queryKey: ["commissions-list"],
    queryFn: async () => (await supabase.from("commissions").select("*, partners(full_name), sales(amount, sale_date, clients(full_name), products(name))").order("created_at", { ascending: false })).data ?? [],
  });

  const totals = (commissions ?? []).reduce((acc: any, c: any) => {
    if (c.status === "pago") acc.paid += Number(c.amount);
    else if (c.status === "pendente") acc.pending += Number(c.amount);
    acc.total += Number(c.amount);
    return acc;
  }, { paid: 0, pending: 0, total: 0 });

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("commissions").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão marcada como paga"); qc.invalidateQueries({ queryKey: ["commissions-list"] }); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Comissões" description="Gerencie e pague comissões de parceiros." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Geral" value={formatBRL(totals.total)} icon={Wallet} iconColor="primary" />
        <StatCard label="Pendentes" value={formatBRL(totals.pending)} icon={Clock} iconColor="warning" />
        <StatCard label="Pagas" value={formatBRL(totals.paid)} icon={CheckCircle2} iconColor="success" />
      </div>

      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-semibold">Parceiro</th>
                <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                <th className="px-6 py-3 text-left font-semibold">Produto</th>
                <th className="px-6 py-3 text-left font-semibold">Valor venda</th>
                <th className="px-6 py-3 text-left font-semibold">%</th>
                <th className="px-6 py-3 text-left font-semibold">Comissão</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(commissions ?? []).length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-muted-foreground text-sm">Nenhuma comissão gerada</td></tr>
              ) : commissions?.map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 font-medium">{c.partners?.full_name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.sales?.clients?.full_name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.sales?.products?.name ?? "—"}</td>
                  <td className="px-6 py-4 vx-mono">{formatBRL(c.sales?.amount)}</td>
                  <td className="px-6 py-4 vx-mono">{formatPercent(c.percent)}</td>
                  <td className="px-6 py-4 vx-mono font-semibold text-success">{formatBRL(c.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${
                      c.status === "pago" ? "bg-success-muted text-success" :
                      c.status === "cancelado" ? "bg-destructive-muted text-destructive" :
                      "bg-warning-muted text-warning"
                    }`}>{c.status}</span>
                    {c.paid_at && <p className="text-[10px] text-muted-foreground mt-1">Pago em {formatDate(c.paid_at)}</p>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {c.status === "pendente" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(c.id)} className="gap-1.5"><Check className="size-3.5" /> Marcar pago</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
