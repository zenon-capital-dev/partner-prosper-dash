import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Clock, CheckCircle2, ArrowRight, ClipboardList, Zap } from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProviderPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: provider } = useQuery({
    queryKey: ["provider-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("id, name").eq("email", user!.email!).maybeSingle();
      return data;
    },
  });

  const providerId = provider?.id;

  const { data: assignments = [] } = useQuery({
    queryKey: ["provider-assignments", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase.from("service_assignments").select("*, clients(full_name), products(name)").eq("provider_id", providerId!).order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["provider-client-products", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase.from("client_products").select("id, status, value, deadline, clients(id, full_name), products(name)").eq("service_provider_id", providerId!);
      return data ?? [];
    },
  });

  const pending = assignments.filter((a: any) => a.status !== "completed" && a.status !== "cancelled");
  const completed = assignments.filter((a: any) => a.status === "completed");
  const totalValue = clientProducts.reduce((sum: number, cp: any) => sum + Number(cp.value || 0), 0);

  return (
    <div className="bg-premium min-h-screen">
      <div className="page-shell space-y-12 py-12">
        {/* Provider Header */}
        <section className="relative overflow-hidden rounded-[40px] bg-slate-900 p-10 lg:p-16 text-white group shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)]">
           <div className="absolute top-0 right-0 size-80 bg-primary/10 blur-[100px] -mr-40 -mt-40 rounded-full" />
           <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative">
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                   <Zap className="size-4 text-primary" />
                   <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">Expert Service Network</span>
                 </div>
                 <h1 className="font-editorial text-4xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
                   Mestre da <br/><span className="italic text-primary">execução</span>.
                 </h1>
                 <p className="font-editorial italic text-xl text-white/60">
                    {provider?.name || "Especialista Parceiro"}
                 </p>
              </div>

              <div className="grid grid-cols-2 gap-10 lg:pl-16 lg:border-l border-white/10">
                 <ProviderStat label="Pendentes" value={String(pending.length)} />
                 <ProviderStat label="Produção" value={formatBRL(totalValue)} highlight />
              </div>
           </div>
        </section>

        {!provider && (
          <div className="vx-card p-12 text-center bg-white/40 backdrop-blur-xl border-white/20 rounded-[32px]">
            <p className="font-editorial text-xl italic text-muted-foreground">Sua conta de prestador está sendo vinculada ao sistema...</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
           {/* Assignments List */}
           <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/10">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <ClipboardList className="size-5 text-primary" />
                    <h3 className="font-editorial text-2xl font-bold text-slate-900">Ordens de Serviço</h3>
                 </div>
                 <Badge className="bg-slate-100 text-slate-500 rounded-full px-4">{pending.length} abertas</Badge>
              </div>
              <div className="divide-y divide-slate-50">
                 {assignments.length === 0 ? (
                   <p className="p-12 text-center font-editorial italic text-muted-foreground">Nenhum serviço atribuído no momento.</p>
                 ) : (
                   assignments.map((a: any) => (
                     <div key={a.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-5">
                           <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:bg-primary/5 transition-all">
                              <Briefcase className="size-6" />
                           </div>
                           <div>
                              <p className="font-bold text-slate-900">{a.products?.name || "Serviço"}</p>
                              <p className="text-xs text-muted-foreground">Cliente: {a.clients?.full_name}</p>
                              {a.due_date && <p className="text-[10px] uppercase font-bold tracking-widest text-primary/60 mt-2">Prazo: {formatDate(a.due_date)}</p>}
                           </div>
                        </div>
                        <Badge variant="outline" className="rounded-full px-4 py-1 text-[9px] uppercase tracking-widest font-bold border-slate-200">{a.status}</Badge>
                     </div>
                   ))
                 )}
              </div>
           </div>

           {/* Production List */}
           <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/10">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Users className="size-5 text-primary" />
                    <h3 className="font-editorial text-2xl font-bold text-slate-900">Em Execução</h3>
                 </div>
                 <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Capacidade Atual</span>
              </div>
              <div className="divide-y divide-slate-50">
                 {clientProducts.length === 0 ? (
                   <p className="p-12 text-center font-editorial italic text-muted-foreground">Nenhum projeto em execução ativa.</p>
                 ) : (
                   clientProducts.map((cp: any) => (
                     <div key={cp.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div>
                           <p className="font-bold text-slate-900">{cp.clients?.full_name}</p>
                           <p className="text-xs text-muted-foreground">{cp.products?.name}</p>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-slate-900 tabular-nums">{formatBRL(cp.value)}</p>
                           <button onClick={() => navigate(`/clientes/${cp.clients?.id}`)} className="text-[10px] font-bold uppercase tracking-widest text-primary mt-1 hover:underline">Ver Processo</button>
                        </div>
                     </div>
                   ))
                 )}
              </div>
              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                 <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Valor Total Produzido</p>
                 <p className="font-editorial text-3xl font-bold text-slate-900">{formatBRL(totalValue)}</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function ProviderStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-2">
       <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">{label}</p>
       <p className={cn(
         "font-editorial text-4xl lg:text-5xl font-bold tracking-tight",
         highlight ? "text-primary" : "text-white"
       )}>{value}</p>
    </div>
  );
}
