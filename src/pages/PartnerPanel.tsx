import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, Wallet, CheckCircle2, TrendingUp, Clock, Inbox,
  ArrowUpRight, FileText, Download, XCircle,
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function PartnerPanel() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["partner-panel", user?.id],
    queryFn: async () => {
      const { data: partner } = await supabase
        .from("partners")
        .select("id, full_name, email, phone, commission_percent, pix_key, partner_type, active")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!partner) return null;

      const [clients, splits] = await Promise.all([
        supabase.from("clients").select("id, full_name, company, email, phone, status, created_at, sales(amount, sale_date, status)").eq("partner_id", partner.id).order("created_at", { ascending: false }),
        supabase.from("commission_splits").select("*, sales(sale_date, clients(full_name), products(name))").eq("beneficiary_type", "partner").eq("beneficiary_id", partner.id).order("created_at", { ascending: false }),
      ]);

      return {
        partner,
        clients: clients.data ?? [],
        splits: splits.data ?? [],
      };
    },
    enabled: !!user,
  });

  const totals = useMemo(() => {
    if (!data) return { total: 0, paid: 0, pending: 0, thisMonth: 0 };
    const splits = data.splits;
    const total = splits.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = splits.filter((x: any) => x.status === "pago").reduce((s, x: any) => s + Number(x.amount), 0);
    const pending = splits.filter((x: any) => x.status === "pendente").reduce((s, x: any) => s + Number(x.amount), 0);
    const now = new Date();
    const thisMonth = splits.filter((x: any) => {
      const d = new Date(x.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, x: any) => s + Number(x.amount), 0);
    return { total, paid, pending, thisMonth };
  }, [data]);

  if (isLoading) return <div className="p-12 text-center text-sm font-editorial italic text-muted-foreground">Processando ganhos...</div>;

  if (!data) return (
    <div className="min-h-[70vh] flex items-center justify-center p-8 bg-premium">
      <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white/40 backdrop-blur-xl border-white/20">
        <Inbox className="size-12 text-primary/30 mx-auto mb-6" />
        <h2 className="font-editorial text-3xl font-bold tracking-tight mb-3">Seu portal de parceiro está quase pronto</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nossa equipe de parcerias está validando seu cadastro. <br/>Em breve você poderá acompanhar suas indicações e comissões.
        </p>
      </div>
    </div>
  );

  const { partner, clients, splits } = data;

  return (
    <div className="bg-premium min-h-screen">
      <div className="page-shell space-y-12 py-12">
        {/* Partner Header */}
        <section className="relative overflow-hidden rounded-[40px] bg-slate-900 p-10 lg:p-16 text-white group shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]">
           <div className="absolute bottom-0 right-0 size-96 bg-primary/10 blur-[100px] -mb-48 -mr-48 rounded-full" />
           <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative">
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                   <div className="size-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
                   <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">Active Partner Network</span>
                 </div>
                 <h1 className="font-editorial text-4xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
                   Eleve seu <br/><span className="italic text-primary">impacto</span>.
                 </h1>
                 <div className="flex items-center gap-4 text-white/60 font-editorial italic text-lg lg:text-xl">
                   <span>{partner.full_name}</span>
                   <span className="size-1 bg-white/20 rounded-full" />
                   <span>{Number(partner.commission_percent).toFixed(1)}% comissão</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8 lg:gap-16 lg:pl-16 lg:border-l border-white/10">
                 <PartnerStat label="Indicados" value={String(clients.length)} />
                 <PartnerStat label="Ganhos Totais" value={formatBRL(totals.total)} highlight />
              </div>
           </div>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
           <SimpleKpi label="Ganhos este mês" value={formatBRL(totals.thisMonth)} tone="info" icon={TrendingUp} />
           <SimpleKpi label="Comissões Pendentes" value={formatBRL(totals.pending)} tone="warning" icon={Clock} />
           <SimpleKpi label="Total Recebido" value={formatBRL(totals.paid)} tone="success" icon={CheckCircle2} />
           <div className="vx-card p-6 bg-slate-900 text-white rounded-[28px] border-slate-900 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                 <Wallet className="size-6 text-primary" />
                 <Button variant="ghost" className="h-7 text-[10px] uppercase font-bold text-primary hover:bg-white/5" onClick={() => toast.info("Solicitação enviada ao financeiro")}>Solicitar Saque</Button>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Saldo Disponível</p>
                <p className="font-editorial text-2xl font-bold text-white mt-1">{formatBRL(totals.pending)}</p>
              </div>
           </div>
        </div>

        <Tabs defaultValue="clientes" className="space-y-10">
           <TabsList className="bg-transparent h-auto p-0 flex gap-12 border-b border-slate-200 rounded-none pb-px">
              <PremiumTabTrigger value="clientes" label="Carteira Indicada" count={clients.length} />
              <PremiumTabTrigger value="comissoes" label="Extrato de Splits" count={splits.length} />
           </TabsList>

           <TabsContent value="clientes" className="animate-fade-up">
              {clients.length === 0 ? (
                <div className="vx-card p-20 text-center border-dashed border-2">
                   <Users className="size-12 text-slate-300 mx-auto mb-4" />
                   <p className="font-editorial text-xl font-bold">Nenhuma indicação registrada</p>
                   <p className="text-muted-foreground text-sm mt-2">Suas indicações aparecerão aqui conforme o processamento.</p>
                </div>
              ) : (
                <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/20">
                   <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                         <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                               <th className="px-8 py-5 text-left">Cliente / Empresa</th>
                               <th className="px-8 py-5 text-left">Status</th>
                               <th className="px-8 py-5 text-right">LTV</th>
                               <th className="px-8 py-5 text-right">Desde</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {clients.map((c: any) => {
                               const revenue = (c.sales ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
                               return (
                                 <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                       <div className="flex items-center gap-4">
                                          <div className="size-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                             {initials(c.full_name)}
                                          </div>
                                          <div>
                                             <p className="font-bold text-slate-900">{c.full_name}</p>
                                             <p className="text-xs text-muted-foreground">{c.company || "Pessoa Física"}</p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <span className="vx-pill vx-pill-muted uppercase tracking-widest text-[9px]">{c.status}</span>
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold tabular-nums text-slate-900">{formatBRL(revenue)}</td>
                                    <td className="px-8 py-6 text-right text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                                 </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
              )}
           </TabsContent>

           <TabsContent value="comissoes" className="animate-fade-up">
              <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                           <th className="px-8 py-5 text-left">Data</th>
                           <th className="px-8 py-5 text-left">Referência</th>
                           <th className="px-8 py-5 text-right">Percentual</th>
                           <th className="px-8 py-5 text-right">Crédito</th>
                           <th className="px-8 py-5 text-left">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {splits.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                             <td className="px-8 py-6 text-xs text-muted-foreground">{formatDate(s.created_at)}</td>
                             <td className="px-8 py-6">
                                <p className="font-bold text-slate-900">{s.sales?.clients?.full_name ?? "—"}</p>
                                <p className="text-[11px] text-muted-foreground">{s.sales?.products?.name ?? "Venda direta"}</p>
                             </td>
                             <td className="px-8 py-6 text-right font-mono text-xs">{Number(s.percent).toFixed(1)}%</td>
                             <td className="px-8 py-6 text-right font-bold text-emerald-500 tabular-nums">{formatBRL(s.amount)}</td>
                             <td className="px-8 py-6">
                                <span className={cn(
                                  "vx-pill uppercase tracking-widest text-[9px]",
                                  s.status === 'pago' ? "vx-pill-success" : "vx-pill-warning"
                                )}>{s.status}</span>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
                </div>
              </div>
           </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PartnerStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-2">
       <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">{label}</p>
       <p className={cn(
         "font-editorial text-4xl lg:text-6xl font-bold tracking-tight",
         highlight ? "text-primary" : "text-white"
       )}>{value}</p>
    </div>
  );
}

function SimpleKpi({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: any }) {
  const tones = {
     success: "bg-emerald-500/10 text-emerald-600 border-emerald-100",
     warning: "bg-amber-500/10 text-amber-600 border-amber-100",
     info: "bg-primary/5 text-primary border-primary/10",
     primary: "bg-slate-900 text-white border-slate-900",
  } as any;
  
  return (
     <div className="vx-card p-6 bg-white rounded-[28px] border-slate-100 shadow-lg shadow-slate-200/20 group hover:shadow-xl transition-all">
        <div className="flex items-center justify-between mb-4">
           <div className={cn("size-10 rounded-2xl flex items-center justify-center", tones[tone])}>
              <Icon className="size-5" />
           </div>
           <ArrowUpRight className="size-4 text-slate-200 group-hover:text-primary transition-colors" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="font-editorial text-2xl font-bold text-slate-900 mt-1">{value}</p>
     </div>
  );
}

function PremiumTabTrigger({ value, label, count }: { value: string; label: string; count?: number }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-none rounded-none p-0 pb-4 text-[13px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 transition-all relative group h-auto"
    >
      <div className="flex items-center gap-2">
        {label}
        {count !== undefined && (
          <span className="size-5 rounded-full bg-slate-100 text-[10px] flex items-center justify-center text-slate-500 group-data-[state=active]:bg-primary group-data-[state=active]:text-white transition-colors">
            {count}
          </span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary scale-x-0 data-[state=active]:scale-x-100 transition-transform origin-left" />
    </TabsTrigger>
  );
}
