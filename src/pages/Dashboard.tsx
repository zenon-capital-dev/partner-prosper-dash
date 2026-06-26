import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight, Zap, Search, Bell, Calendar,
  DollarSign, Users, Wallet, Target, Activity,
  FileSignature, FileUp, MoreHorizontal, Clock
} from "lucide-react";
;
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { cn } from "@/lib/utils";
import ClientPanel from "./ClientPanel";
import PartnerPanel from "./PartnerPanel";
import { GoalsPanel } from "@/components/dashboard/GoalsPanel";
import { JourneyMiniWidget } from "@/components/dashboard/JourneyMiniWidget";

type RangeKey = "today" | "7d" | "30d" | "month";

function makeRange(key: RangeKey) {
  switch (key) {
    case "today": return { label: "HOJE" };
    case "7d": return { label: "7 DIAS" };
    case "30d": return { label: "30 DIAS" };
    case "month": default: return { label: "MÊS" };
  }
}

export default function Dashboard() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const { data: stats, isLoading } = useDashboardStats();

  if (roles.includes("cliente")) return <ClientPanel />;
  if (roles.includes("parceiro")) return <PartnerPanel />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="relative">
          <div className="size-12 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 size-12 rounded-full border border-primary/10 blur-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background bg-premium">
      <div className="px-6 lg:px-10 py-4 flex items-center justify-end border-b border-border/5 bg-background/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
          {(["today", "7d", "30d", "month"] as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRangeKey(k)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                rangeKey === k 
                  ? "bg-background text-foreground shadow-sm border border-border/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {makeRange(k).label}
            </button>
          ))}
        </div>
      </div>

      <main className="page-shell space-y-8 animate-fade-up">
        {/* Breadcrumb / Info */}
        <div className="flex items-center gap-3 text-muted-foreground/40">
          <Calendar className="size-3.5" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <span className="text-border/20">/</span>
          <Zap className="size-3.5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">​</span>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <KPICard 
            label="Receita Recebida" 
            value={formatBRL(stats?.financial.received || 0)} 
            delta="+8.4%" 
            trend="up"
            icon={<DollarSign className="size-6" />}
            color="indigo"
          />
          <KPICard 
            label="Novos Clientes" 
            value={String(stats?.clients.month || 0)} 
            delta="+12.5%" 
            trend="up"
            icon={<Users className="size-6" />}
            color="emerald"
          />
          <KPICard 
            label="Conv. Leads" 
            value={Math.round((stats?.leads.conversionRate || 0) * 100) + "%"} 
            delta="+2.1%" 
            trend="up"
            icon={<Target className="size-6" />}
            color="amber"
          />
          <KPICard 
            label="Ticket Médio" 
            value={formatBRL((stats?.financial.total || 0) / (stats?.clients.total || 1))} 
            delta="+5.2%" 
            trend="up"
            icon={<Wallet className="size-6" />}
            color="blue"
          />
        </div>

        {/* Secondary KPI Strip (Mini) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <MiniKPICard
            label="MRR ATIVO"
            value={formatBRL(stats?.sales?.mrrActive || 0)}
            color="emerald"
            hint="Receita Recorrente Mensal — soma de todas as vendas do tipo MRR ainda dentro da vigência."
          />
          <MiniKPICard
            label="RECEITA PONTUAL (MÊS)"
            value={formatBRL(stats?.sales?.monthRevenueOneOff || 0)}
            color="blue"
            hint="Receita avulsa (na cabeça) — vendas pontuais finalizadas neste mês."
          />
          <MiniKPICard label="VENDAS FINALIZADAS" value={stats?.sales?.count || 0} color="emerald" />
          <MiniKPICard label="DOCS PENDENTES" value={stats?.documents.pending || 0} color="amber" />
          <MiniKPICard label="TAREFAS EM ATRASO" value={stats?.tasks.overdue || 0} color="rose" />
          <button
            onClick={() => navigate("/financeiro/caixinhas")}
            className="vx-card p-6 flex flex-col justify-between transition-all duration-500 cursor-pointer group hover:translate-y-[-2px] text-left text-indigo-700 border-indigo-200/40 bg-indigo-50/40 hover:bg-indigo-50/80"
            title="Caixinhas & Projetos — acompanhar metas internas (Zenon, escritório, funcionários...)"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1.5">Caixinhas & Projetos</p>
            <p className="text-xs font-bold tracking-tight">Ver progresso →</p>
          </button>
        </div>


        <GoalsPanel />

        <JourneyMiniWidget />

        {/* Charts Section */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 cp-panel p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-base font-bold tracking-tight">Performance Financeira</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Fluxo de receita e ticket médio mensal</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-muted-foreground">RECEITA REAL</span>
              </div>
            </div>
            <div className="h-[300px] w-full flex items-end justify-around p-6 gap-2">
               {[40, 65, 45, 90, 55, 80, 70, 85, 60, 95, 75, 100].map((h, i) => (
                 <div key={i} className="flex-1 space-y-2 group flex flex-col items-center">
                   <div className="relative w-full max-w-[32px] bg-indigo-500/10 rounded-full transition-all group-hover:bg-indigo-500/20" style={{ height: `${h}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        R${h}k
                      </div>
                   </div>
                   <p className="text-[9px] font-bold text-muted-foreground/60">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</p>
                 </div>
               ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 cp-panel p-6">
            <h3 className="text-base font-bold tracking-tight mb-6">Origem dos Clientes</h3>
            <div className="space-y-5">
              <SourceItem label="Instagram" value={45} color="bg-pink-500" />
              <SourceItem label="Indicação de Parceiro" value={30} color="bg-indigo-500" />
              <SourceItem label="WhatsApp" value={15} color="bg-emerald-500" />
              <SourceItem label="Orgânico / Site" value={10} color="bg-slate-400" />
            </div>
            <div className="mt-8 pt-6 border-t border-border/40">
               <p className="text-[11px] text-muted-foreground leading-relaxed">
                 O tráfego vindo de <strong>redes sociais</strong> continua sendo o maior canal de aquisição deste trimestre.
               </p>
            </div>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Recent Activities */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="cp-panel p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Activity className="size-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">Histórico de Auditoria</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Últimas ações realizadas no sistema</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate("/auditoria")}
                  className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Ver Auditoria
                </button>
              </div>

              <div className="space-y-6">
                {stats?.recentActivities.length ? stats.recentActivities.map((activity) => (
                  <ActivityItem 
                    key={activity.id}
                    title={activity.title} 
                    desc={activity.desc} 
                    time={activity.time} 
                    icon={<Clock className="size-4 text-slate-500" />}
                  />
                )) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade recente encontrada.</div>
                )}
              </div>
            </div>

            {/* Bottom Highlight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue Card */}
              <div className="bg-[#0f172a] rounded-2xl p-6 text-white relative overflow-hidden group border border-white/5">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">RECEITA PREVISTA</p>
                    <h4 className="text-2xl font-bold tracking-tight mb-2">{formatBRL(stats?.financial.total || 0)}</h4>
                    <p className="text-xs text-white/40 font-medium">{formatBRL(stats?.financial.pending || 0)} ainda pendente</p>
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-bold text-white/60">FINANCEIRO EM DIA</span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Target className="size-32" />
                </div>
              </div>

              {/* Conversion Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden group shadow-xl shadow-indigo-500/20">
                <div className="relative z-10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">PERFORMANCE DE LEADS</p>
                  <h4 className="text-2xl font-bold tracking-tight mb-2">{stats?.leads.converted} de {stats?.leads.total} Leads</h4>
                  <p className="text-xs text-white/60 font-medium">Taxa de conversão em {Math.round((stats?.leads.conversionRate || 0) * 100)}%</p>
                  
                  <div className="mt-8 h-12 flex items-end gap-1">
                    {[40, 60, 45, 70, 55, 80, 65].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/20 rounded-t-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 size-32 bg-white/10 rounded-full blur-3xl" />
              </div>
            </div>
          </div>

          {/* Right Column: Status Summary */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="cp-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <FileUp className="size-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-bold tracking-tight">Status de Operação</h3>
              </div>

              <div className="space-y-4">
                <StatusItem label="Documentos em Análise" value={stats?.documents.analysis || 0} color="amber" />
                <StatusItem label="Aguardando Assinatura" value={stats?.contracts.pending || 0} color="blue" />
                <StatusItem label="Tarefas Abertas" value={stats?.tasks.open || 0} color="slate" isDark />
              </div>
            </div>

            <div className="cp-panel p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold tracking-tight">Vendas por Status</h3>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Contratos Assinados</span>
                  <span className="text-xs font-bold">{stats?.contracts.signed}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(stats?.contracts.signed || 0) / (stats?.contracts.total || 1) * 100}%` }} />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Leads em Negociação</span>
                  <span className="text-xs font-bold">{stats?.leads.total - stats?.leads.converted}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${(stats?.leads.total - stats?.leads.converted) / (stats?.leads.total || 1) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* --- Components --- */

function KPICard({ label, value, delta, trend, icon, color }: any) {
  const gradients: any = {
    indigo: "from-primary/10 to-transparent",
    emerald: "from-success/10 to-transparent",
    amber: "from-warning/10 to-transparent",
    blue: "from-info/10 to-transparent",
  };
  
  const iconColors: any = {
    indigo: "text-primary bg-primary/10",
    emerald: "text-success bg-success/10",
    amber: "text-warning bg-warning/10",
    blue: "text-info bg-info/10",
  };

  return (
    <div className={cn("vx-card-premium p-8 group cursor-pointer hover:border-primary/20", gradients[color])}>
      <div className="flex items-center justify-between mb-8">
        <div className={cn("size-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl", iconColors[color])}>
          {icon}
        </div>
        <div className={cn("cp-pill scale-110", trend === "up" ? "cp-pill-success" : "cp-pill-danger")}>
          <ArrowUpRight className={cn("size-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5")} />
          {delta}
        </div>
      </div>
      <p className="vx-kpi-label mb-1.5">{label}</p>
      <h4 className="vx-kpi-value text-3xl">{value}</h4>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-1000 w-[65%]", {
            "bg-primary": color === "indigo",
            "bg-success": color === "emerald",
            "bg-warning": color === "amber",
            "bg-info": color === "blue",
          })} />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/30">65%</span>
      </div>
    </div>
  );
}


function MiniKPICard({ label, value, color }: any) {
  const colorMap: any = {
    blue: "text-info border-info/10 bg-info/5 hover:bg-info/10",
    emerald: "text-success border-success/10 bg-success/5 hover:bg-success/10",
    amber: "text-warning border-warning/10 bg-warning/5 hover:bg-warning/10",
    rose: "text-destructive border-destructive/10 bg-destructive/5 hover:bg-destructive/10",
    slate: "text-muted-foreground border-border/10 bg-muted/5 hover:bg-muted/10",
  };
  return (
    <div className={cn("vx-card p-6 flex flex-col justify-between transition-all duration-500 cursor-default group hover:translate-y-[-2px]", colorMap[color] || colorMap.slate)}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-1.5">{label}</p>
      <p className="text-xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}


function SourceItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-tight">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ActivityItem({ title, desc, time, icon }: any) {
  return (
    <div className="flex items-start gap-4 group cursor-pointer">
      <div className="size-11 rounded-2xl bg-muted/40 border border-border/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
        {icon}
      </div>
      <div className="flex-1 min-w-0 border-b border-border/5 pb-5 group-last:border-none group-last:pb-0 transition-colors group-hover:border-primary/20">
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <h4 className="text-[13px] font-black tracking-tight text-foreground/90 truncate">{title}</h4>
          <span className="text-[10px] font-black tracking-widest text-muted-foreground/40">{time}</span>
        </div>
        <p className="text-xs text-muted-foreground/60 truncate font-medium">{desc}</p>
      </div>
    </div>
  );
}

function StatusItem({ label, value, color }: any) {
  const colors: any = {
    rose: "bg-rose-500/5 text-rose-500 border-rose-500/10",
    amber: "bg-amber-500/5 text-amber-500 border-amber-500/10",
    blue: "bg-blue-500/5 text-blue-500 border-blue-500/10",
    slate: "bg-slate-500/5 text-slate-500 border-slate-500/10",
  };
  
  return (
    <div className={cn("flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] cursor-default", colors[color])}>
      <span className="text-[11px] font-black uppercase tracking-widest opacity-80">{label}</span>
      <span className="text-2xl font-black tabular-nums">{value}</span>
    </div>
  );
}

