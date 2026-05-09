import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Zap, Clock, AlertTriangle, PauseCircle, CheckCircle2, User, Package, Calendar, ChevronRight } from "lucide-react";
import { calculateSLA, SLAStatus } from "@/lib/sla";
import { AutoStatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SLAPages() {
  const navigate = useNavigate();

  const { data: demands = [], isLoading } = useQuery({
    queryKey: ["admin-sla-demands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          *,
          clients(full_name, company),
          products(name, default_sla_days, sla_day_type),
          service_providers:service_provider_id(name)
        `)
        .neq("status", "concluido")
        .order("sla_due_date", { ascending: true });
      
      if (error) throw error;

      return (data || []).map(d => {
        const sla = calculateSLA(
          d.sla_start_date || d.created_at,
          d.sla_due_date,
          d.status,
          (d.products as any)?.sla_day_type || 'working'
        );
        return { ...d, sla };
      });
    }
  });

  const stats = {
    atrasadas: demands.filter(d => d.sla?.status === 'atrasado').length,
    venceHoje: demands.filter(d => d.sla?.status === 'vence_hoje').length,
    atencao: demands.filter(d => d.sla?.status === 'atencao').length,
    pausadas: demands.filter(d => d.status === 'pausado').length,
  };

  const providersWithDelays = demands.reduce((acc: any, d: any) => {
    if (d.sla?.status === 'atrasado' && d.service_providers?.name) {
      acc[d.service_providers.name] = (acc[d.service_providers.name] || 0) + 1;
    }
    return acc;
  }, {});

  const sortedProviders = Object.entries(providersWithDelays)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5);

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Operations"
        category="SLA & Deadlines"
        title="Controle de SLA e Prazos"
        description="Monitoramento em tempo real do tempo de resposta e execução de todas as demandas."
        icon={<Zap className="size-6 text-primary fill-primary/20" />}
        kpis={[
          { label: "Atrasadas", value: stats.atrasadas, tone: "danger", icon: <AlertTriangle className="size-4" /> },
          { label: "Vence Hoje", value: stats.venceHoje, tone: "warning", icon: <Clock className="size-4" /> },
          { label: "Em Atenção", value: stats.atencao, tone: "info", icon: <Zap className="size-4" /> },
          { label: "Pausadas", value: stats.pausadas, tone: "neutral", icon: <PauseCircle className="size-4" /> },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-500" />
                Demandas Críticas (Atrasadas ou Próximas)
              </h3>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : demands.length === 0 ? (
              <div className="vx-card p-12 text-center border-dashed border-2">
                <CheckCircle2 className="size-10 text-emerald-500/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Tudo em dia! Nenhuma demanda crítica no momento.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {demands
                  .filter(d => ['atrasado', 'vence_hoje', 'atencao'].includes(d.sla?.status || ''))
                  .map((d: any) => (
                    <div 
                      key={d.id} 
                      onClick={() => navigate(`/demandas/${d.id}`)}
                      className={cn(
                        "vx-card p-5 group cursor-pointer hover:border-primary/30 transition-all",
                        d.sla?.status === 'atrasado' && "border-l-4 border-l-rose-500 bg-rose-500/[0.02]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                              {d.products?.name}
                            </span>
                            <AutoStatusBadge status={d.sla?.status} className="h-5" />
                          </div>
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {d.clients?.full_name}
                          </h4>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                              <User className="size-3" />
                              {d.service_providers?.name || "Não atribuído"}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                              <Calendar className="size-3" />
                              Prazo: {d.sla?.dueDate ? formatDate(d.sla.dueDate.toISOString()) : "Sem prazo"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-2xl font-display font-black tracking-tight tabular-nums",
                            d.sla?.status === 'atrasado' ? "text-rose-500" : d.sla?.status === 'vence_hoje' ? "text-amber-500" : "text-foreground"
                          )}>
                            {d.sla?.daysRemaining !== null ? (
                              d.sla.daysRemaining < 0 ? d.sla.daysRemaining : `+${d.sla.daysRemaining}`
                            ) : "—"}
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Dias
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="vx-card p-6 bg-slate-900 text-white border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="size-24 rotate-12" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-rose-400" />
              Ranking de Atrasos
            </h3>
            
            <div className="space-y-5">
              {sortedProviders.length > 0 ? (
                sortedProviders.map(([name, count]: any) => (
                  <div key={name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold">
                        {name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                        {name}
                      </span>
                    </div>
                    <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 border-none font-black tabular-nums">
                      {count}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-white/30 font-medium italic">Nenhum atraso registrado.</p>
                </div>
              )}
            </div>
          </section>

          <section className="vx-card p-6 border-dashed border-2 bg-muted/30">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
               Dicas de Gestão de SLA
             </h3>
             <ul className="space-y-3">
               {[
                 "Revise demandas em 'Atenção' para evitar atrasos.",
                 "Demandas pausadas congelam a contagem do SLA.",
                 "Priorize o que vence hoje para manter o NPS alto.",
                 "Atribua prestadores rapidamente para iniciar o prazo."
               ].map((text, i) => (
                 <li key={i} className="flex gap-2 text-[11px] font-medium text-muted-foreground">
                   <ChevronRight className="size-3 text-primary shrink-0 mt-0.5" />
                   {text}
                 </li>
               ))}
             </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
