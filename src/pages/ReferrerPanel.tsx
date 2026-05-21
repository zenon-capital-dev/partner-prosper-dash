import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users2, Award, Wallet, TrendingUp, Clock, Inbox,
  ArrowUpRight, Star, Gift, Share2, ClipboardList
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function ReferrerPanel() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["referrer-panel", user?.id],
    queryFn: async () => {
      const { data: referrer } = await supabase
        .from("referrers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      if (!referrer) return null;

      const [clients, splits] = await Promise.all([
        supabase.from("clients").select("id, full_name, company, status, created_at").eq("referrer_id", referrer.id).order("created_at", { ascending: false }),
        supabase.from("commission_splits").select("*, sales(sale_date, clients(full_name), products(name))").eq("beneficiary_type", "referrer").eq("beneficiary_id", referrer.id).order("created_at", { ascending: false }),
      ]);

      return {
        referrer,
        clients: clients.data ?? [],
        splits: splits.data ?? [],
      };
    },
    enabled: !!user,
  });

  const totals = useMemo(() => {
    if (!data) return { total: 0, paid: 0, pending: 0, conversion: 0 };
    const splits = data.splits;
    const total = splits.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = splits.filter((x: any) => x.status === "pago").reduce((s, x: any) => s + Number(x.amount), 0);
    const pending = splits.filter((x: any) => x.status === "pendente").reduce((s, x: any) => s + Number(x.amount), 0);
    const totalClients = data.clients.length;
    const activeClients = data.clients.filter((c: any) => c.status === "ativo").length;
    const conversion = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;
    return { total, paid, pending, conversion };
  }, [data]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="font-editorial italic text-primary/60 tracking-wide">Preparando seu painel de indicador...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#FDFCFB]">
      <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white border-slate-100 rounded-[32px]">
        <Gift className="size-16 text-primary/20 mx-auto mb-8 animate-bounce" />
        <h2 className="font-editorial text-4xl font-bold tracking-tight mb-4 text-slate-900">Seja bem-vindo ao programa</h2>
        <p className="text-slate-500 leading-relaxed text-lg">
          Estamos finalizando as configurações do seu perfil de indicador. <br/>
          Em breve, você poderá transformar suas conexões em recompensas premium.
        </p>
      </div>
    </div>
  );

  const { referrer, clients, splits } = data;

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 lg:py-20 space-y-16">
        
        {/* Header Section — Sophisticated & Clean */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
              <Star className="size-3 text-primary fill-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Indicador Exclusive</span>
            </div>
            <h1 className="font-editorial text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              Suas conexões, <br/><span className="text-primary italic">seu legado</span>.
            </h1>
            <p className="text-lg text-slate-500 font-medium max-w-md">
              Olá, {referrer.full_name}. Você tem <span className="text-slate-900 font-bold">{clients.length}</span> indicações ativas e <span className="text-primary font-bold">{formatBRL(totals.pending)}</span> a receber.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Olá! Quero indicar um novo cliente. Aqui estão os dados de contato:")}`, "_blank")}
              className="rounded-full bg-slate-900 hover:bg-slate-800 text-white px-8 h-14 font-bold tracking-wide shadow-xl shadow-slate-200"
            >
              Nova Indicação <Share2 className="size-4 ml-2" />
            </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <IndicadorStat 
            icon={TrendingUp} 
            label="Total em Comissões" 
            value={formatBRL(totals.total)} 
            description="Acumulado desde o início"
          />
          <IndicadorStat 
            icon={Clock} 
            label="Crédito Pendente" 
            value={formatBRL(totals.pending)} 
            description="Aguardando liquidação"
            highlight
          />
          <IndicadorStat
            icon={Award}
            label="Taxa de Conversão"
            value={`${totals.conversion}%`}
            description="Indicados que viraram clientes ativos"
          />
        </div>

        {/* Content Section */}
        <Tabs defaultValue="indicacoes" className="space-y-12">
          <TabsList className="bg-transparent h-auto p-0 flex gap-12 border-b border-slate-200 rounded-none pb-px">
            <ReferrerTabTrigger value="indicacoes" label="Minhas Indicações" count={clients.length} />
            <ReferrerTabTrigger value="extrato" label="Histórico Financeiro" count={splits.length} />
          </TabsList>

          <TabsContent value="indicacoes" className="animate-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {clients.map((c: any) => (
                <div key={c.id} className="group bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
                  <div className="flex justify-between items-start mb-6">
                    <div className="size-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center font-editorial text-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {initials(c.full_name)}
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      c.status === "ativo" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {c.status}
                    </span>
                  </div>
                  <h3 className="font-editorial text-2xl font-bold text-slate-900 group-hover:text-primary transition-colors">{c.full_name}</h3>
                  <p className="text-slate-500 text-sm mt-2 font-medium">{c.company || "Indicação Direta"}</p>
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider uppercase">
                    <span>Desde {formatDate(c.created_at)}</span>
                  </div>
                </div>
              ))}
              {clients.length === 0 && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <Inbox className="size-12 text-slate-200 mx-auto" />
                  <p className="font-editorial text-2xl text-slate-400">Você ainda não possui indicações registradas.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="extrato" className="animate-fade-up">
            <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      <th className="px-8 py-6 text-left">Data</th>
                      <th className="px-8 py-6 text-left">Origem</th>
                      <th className="px-8 py-6 text-right">Comissão</th>
                      <th className="px-8 py-6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {splits.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-8 py-6 text-slate-400 font-medium">{formatDate(s.created_at)}</td>
                        <td className="px-8 py-6">
                          <p className="font-bold text-slate-900">{s.sales?.clients?.full_name || "Venda Direta"}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{s.sales?.products?.name || "Produto"}</p>
                        </td>
                        <td className="px-8 py-6 text-right font-editorial text-xl font-bold text-emerald-600">
                          {formatBRL(s.amount)}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                              s.status === "pago" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              {s.status}
                            </span>
                          </div>
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

function IndicadorStat({ icon: Icon, label, value, description, highlight }: any) {
  return (
    <div className={cn(
      "p-10 rounded-[40px] border transition-all duration-500",
      highlight ? "bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-200" : "bg-white border-slate-100 shadow-sm hover:shadow-xl"
    )}>
      <div className={cn(
        "size-12 rounded-2xl flex items-center justify-center mb-6",
        highlight ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
      )}>
        <Icon className="size-6" />
      </div>
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.3em] mb-2", highlight ? "text-white/40" : "text-slate-400")}>{label}</p>
      <p className="font-editorial text-4xl font-bold tracking-tight mb-3">{value}</p>
      <p className={cn("text-sm font-medium", highlight ? "text-white/40" : "text-slate-400")}>{description}</p>
    </div>
  );
}

function ReferrerTabTrigger({ value, label, count }: { value: string; label: string; count?: number }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-none rounded-none p-0 pb-6 text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-all relative group h-auto"
    >
      <div className="flex items-center gap-3">
        {label}
        {count !== undefined && (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 group-data-[state=active]:bg-primary group-data-[state=active]:text-white transition-colors">
            {count}
          </span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-primary scale-x-0 data-[state=active]:scale-x-100 transition-transform origin-left rounded-full" />
    </TabsTrigger>
  );
}
