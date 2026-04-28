import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Users, Wallet, CheckCircle2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";

export default function PartnerPanel() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["partner-panel", user?.id],
    queryFn: async () => {
      const { data: partner } = await supabase.from("partners").select("id, full_name, commission_percent").eq("user_id", user!.id).maybeSingle();
      if (!partner) return null;
      const { data: clients } = await supabase.from("clients").select("id, full_name, status").eq("partner_id", partner.id);
      const { data: commissions } = await supabase.from("commissions").select("amount, status, created_at, sales(clients(full_name), products(name))").eq("partner_id", partner.id).order("created_at", { ascending: false });
      return { partner, clients: clients ?? [], commissions: commissions ?? [] };
    },
    enabled: !!user,
  });

  if (!data) {
    return (
      <div className="p-12 text-center">
        <p className="font-display text-2xl font-bold">Bem-vindo!</p>
        <p className="text-muted-foreground mt-2">Seu cadastro como parceiro ainda não foi vinculado. Aguarde a liberação do administrador.</p>
      </div>
    );
  }

  const totalEarned = data.commissions.reduce((s, c: any) => s + Number(c.amount), 0);
  const paid = data.commissions.filter((c: any) => c.status === "pago").reduce((s, c: any) => s + Number(c.amount), 0);
  const pending = data.commissions.filter((c: any) => c.status === "pendente").reduce((s, c: any) => s + Number(c.amount), 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
      <PageHeader title={`Olá, ${data.partner.full_name.split(" ")[0]}!`} description="Acompanhe suas indicações e comissões." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Indicações" value={String(data.clients.length)} icon={Users} iconColor="primary" />
        <StatCard label="Comissões a Receber" value={formatBRL(pending)} icon={Wallet} iconColor="warning" />
        <StatCard label="Já Recebido" value={formatBRL(paid)} icon={CheckCircle2} iconColor="success" />
      </div>

      <div className="vx-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border"><p className="text-sm font-semibold">Histórico de comissões</p></div>
        {data.commissions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhuma comissão ainda</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-semibold">Data</th>
                <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                <th className="px-6 py-3 text-left font-semibold">Produto</th>
                <th className="px-6 py-3 text-left font-semibold">Comissão</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.commissions.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4 font-medium">{c.sales?.clients?.full_name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.sales?.products?.name}</td>
                  <td className="px-6 py-4 vx-mono font-semibold text-success">{formatBRL(c.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${c.status === "pago" ? "bg-success-muted text-success" : "bg-warning-muted text-warning"}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
